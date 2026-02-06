import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import Friendship from '../models/Friendship';
import User from '../models/User';
import CalendarEvent from '../models/CalendarEvent';
import mongoose from 'mongoose';

const router = Router();

// GET /api/friends/search?q=query - search users by name or email
router.get('/search', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }

    const regex = new RegExp(q, 'i');
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [
        { name: regex },
        { email: regex },
      ],
    })
      .select('name email')
      .limit(10);

    res.json(users);
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /api/friends/request - send friend request by userId or email
router.post('/request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { email, userId: targetUserId } = req.body;

    let recipient;
    if (targetUserId) {
      recipient = await User.findById(targetUserId);
    } else if (email) {
      recipient = await User.findOne({ email: email.toLowerCase().trim() });
    } else {
      res.status(400).json({ error: 'Name or email is required' });
      return;
    }

    if (!recipient) {
      res.status(404).json({ error: 'No user found' });
      return;
    }

    if (recipient._id.toString() === req.userId) {
      res.status(400).json({ error: "You can't add yourself" });
      return;
    }

    // Check if friendship already exists in either direction
    const existing = await Friendship.findOne({
      $or: [
        { requester: req.userId, recipient: recipient._id },
        { requester: recipient._id, recipient: req.userId },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        res.status(400).json({ error: 'You are already friends' });
      } else {
        res.status(400).json({ error: 'Friend request already pending' });
      }
      return;
    }

    const friendship = await Friendship.create({
      requester: req.userId,
      recipient: recipient._id,
    });

    res.status(201).json({ message: 'Friend request sent', friendship });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// GET /api/friends/requests - get pending requests for current user
router.get('/requests', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const incoming = await Friendship.find({
      recipient: req.userId,
      status: 'pending',
    }).populate('requester', 'name email');

    const outgoing = await Friendship.find({
      requester: req.userId,
      status: 'pending',
    }).populate('recipient', 'name email');

    res.json({ incoming, outgoing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// POST /api/friends/accept/:id - accept friend request
router.post('/accept/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const friendship = await Friendship.findOne({
      _id: req.params.id,
      recipient: req.userId,
      status: 'pending',
    });

    if (!friendship) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    friendship.status = 'accepted';
    await friendship.save();

    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// POST /api/friends/reject/:id - reject/cancel friend request
router.post('/reject/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const friendship = await Friendship.findOne({
      _id: req.params.id,
      $or: [{ recipient: req.userId }, { requester: req.userId }],
      status: 'pending',
    });

    if (!friendship) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    await friendship.deleteOne();
    res.json({ message: 'Request removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// GET /api/friends - list accepted friends
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const friendships = await Friendship.find({
      $or: [{ requester: req.userId }, { recipient: req.userId }],
      status: 'accepted',
    })
      .populate('requester', 'name email')
      .populate('recipient', 'name email');

    const friends = friendships.map((f) => {
      const isRequester = f.requester._id.toString() === req.userId;
      const friend = isRequester ? f.recipient : f.requester;
      return {
        friendshipId: f._id,
        user: friend,
      };
    });

    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// DELETE /api/friends/:id - remove friend
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const friendship = await Friendship.findOne({
      _id: req.params.id,
      $or: [{ requester: req.userId }, { recipient: req.userId }],
      status: 'accepted',
    });

    if (!friendship) {
      res.status(404).json({ error: 'Friendship not found' });
      return;
    }

    await friendship.deleteOne();
    res.json({ message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// GET /api/friends/class-overlap - how many friends share each class/event
router.get('/class-overlap', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Get friend IDs
    const friendships = await Friendship.find({
      $or: [{ requester: req.userId }, { recipient: req.userId }],
      status: 'accepted',
    });

    const friendIds = friendships.map((f) =>
      f.requester.toString() === req.userId ? f.recipient : f.requester
    );

    if (friendIds.length === 0) {
      res.json({ classOverlap: {}, eventOverlap: {} });
      return;
    }

    // Get user's events
    const myEvents = await CalendarEvent.find({ userId: req.userId });
    const myClassNorms = [...new Set(myEvents.map((e) => normalize(e.className)))];

    // Get ALL friend events (we'll match by normalized class name in JS)
    const friendEvents = await CalendarEvent.find({
      userId: { $in: friendIds },
    });

    // Filter friend events to those whose normalized class name matches
    const matchingFriendEvents = friendEvents.filter((fe) =>
      myClassNorms.includes(normalize(fe.className))
    );

    // Class overlap: how many unique friends per class (using my class name)
    const classOverlap: Record<string, number> = {};
    const classFriendSets: Record<string, Set<string>> = {};
    for (const fe of matchingFriendEvents) {
      // Map back to user's class name
      const feNorm = normalize(fe.className);
      const myClass = myEvents.find((e) => normalize(e.className) === feNorm)?.className || fe.className;
      if (!classFriendSets[myClass]) classFriendSets[myClass] = new Set();
      classFriendSets[myClass].add(fe.userId.toString());
    }
    for (const [cls, friendSet] of Object.entries(classFriendSets)) {
      classOverlap[cls] = friendSet.size;
    }

    // Event overlap: for each of user's events, how many friends have that same event
    const eventFriendCount: Record<string, Set<string>> = {};
    for (const fe of matchingFriendEvents) {
      const key = `${normalize(fe.className)}::${normalize(fe.title)}`;
      if (!eventFriendCount[key]) eventFriendCount[key] = new Set();
      eventFriendCount[key].add(fe.userId.toString());
    }

    const eventOverlap: Record<string, number> = {};
    for (const ev of myEvents) {
      const key = `${normalize(ev.className)}::${normalize(ev.title)}`;
      if (eventFriendCount[key]) {
        eventOverlap[ev._id.toString()] = eventFriendCount[key].size;
      }
    }

    res.json({ classOverlap, eventOverlap });
  } catch (err) {
    console.error('Class overlap error:', err);
    res.status(500).json({ error: 'Failed to fetch class overlap' });
  }
});

// GET /api/friends/event-friends/:eventId - get friends who have a matching event
router.get('/event-friends/:eventId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Get the user's event
    const myEvent = await CalendarEvent.findOne({ _id: req.params.eventId, userId: req.userId });
    if (!myEvent) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Get friend IDs
    const friendships = await Friendship.find({
      $or: [{ requester: req.userId }, { recipient: req.userId }],
      status: 'accepted',
    });

    const friendIds = friendships.map((f) =>
      f.requester.toString() === req.userId ? f.recipient : f.requester
    );

    if (friendIds.length === 0) {
      res.json({ friends: [] });
      return;
    }

    // Find matching events from friends (normalized class + normalized title)
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const myClassNorm = normalize(myEvent.className);
    const myTitleNorm = normalize(myEvent.title);

    const friendEvents = await CalendarEvent.find({
      userId: { $in: friendIds },
    }).populate('userId', 'name email');

    const matchingFriends = friendEvents
      .filter((fe) => normalize(fe.className) === myClassNorm && normalize(fe.title) === myTitleNorm)
      .map((fe) => {
        const user = fe.userId as any;
        return {
          name: user.name || 'Unknown',
          email: user.email || '',
          status: fe.status || 'todo',
        };
      });

    res.json({ friends: matchingFriends });
  } catch (err) {
    console.error('Event friends error:', err);
    res.status(500).json({ error: 'Failed to fetch event friends' });
  }
});

// GET /api/friends/progress - get friend progress on matching events
// Returns aggregated data for all of current user's events
router.get('/progress', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Get friend IDs
    const friendships = await Friendship.find({
      $or: [{ requester: req.userId }, { recipient: req.userId }],
      status: 'accepted',
    });

    const friendIds = friendships.map((f) =>
      f.requester.toString() === req.userId
        ? f.recipient
        : f.requester
    );

    if (friendIds.length === 0) {
      res.json({ progress: {}, friendCount: 0 });
      return;
    }

    // 2. Get user's events
    const myEvents = await CalendarEvent.find({ userId: req.userId });

    if (myEvents.length === 0) {
      res.json({ progress: {}, friendCount: friendIds.length });
      return;
    }

    // 3. Get ALL friends' events (match by normalized class name in JS)
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const myClassNorms = [...new Set(myEvents.map((e) => normalize(e.className)))];

    const allFriendEvents = await CalendarEvent.find({
      userId: { $in: friendIds },
    });

    // Filter to matching classes (case-insensitive)
    const friendEvents = allFriendEvents.filter((fe) =>
      myClassNorms.includes(normalize(fe.className))
    );

    // 4. Build lookup: normalize both class and title for matching
    const friendMap: Record<string, { todo: number; in_progress: number; done: number; total: number }> = {};
    for (const fe of friendEvents) {
      const key = `${normalize(fe.className)}::${normalize(fe.title)}`;
      if (!friendMap[key]) {
        friendMap[key] = { todo: 0, in_progress: 0, done: 0, total: 0 };
      }
      friendMap[key][fe.status || 'todo']++;
      friendMap[key].total++;
    }

    // 5. Map back to user's event IDs
    const progress: Record<string, { todo: number; in_progress: number; done: number; total: number }> = {};
    for (const ev of myEvents) {
      const key = `${normalize(ev.className)}::${normalize(ev.title)}`;
      if (friendMap[key]) {
        progress[ev._id.toString()] = friendMap[key];
      }
    }

    res.json({ progress, friendCount: friendIds.length });
  } catch (err) {
    console.error('Friend progress error:', err);
    res.status(500).json({ error: 'Failed to fetch friend progress' });
  }
});

export default router;
