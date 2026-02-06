import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import Friendship from '../models/Friendship';
import User from '../models/User';
import CalendarEvent from '../models/CalendarEvent';
import mongoose from 'mongoose';

const router = Router();

// POST /api/friends/request - send friend request by email
router.post('/request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const recipient = await User.findOne({ email: email.toLowerCase().trim() });
    if (!recipient) {
      res.status(404).json({ error: 'No user found with that email' });
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

    // 3. Get friends' events for matching classes
    const myClassNames = [...new Set(myEvents.map((e) => e.className))];

    const friendEvents = await CalendarEvent.find({
      userId: { $in: friendIds },
      className: { $in: myClassNames },
    });

    // 4. Build lookup: normalize title for matching
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Group friend events by className + normalized title
    const friendMap: Record<string, { todo: number; in_progress: number; done: number; total: number }> = {};
    for (const fe of friendEvents) {
      const key = `${fe.className}::${normalize(fe.title)}`;
      if (!friendMap[key]) {
        friendMap[key] = { todo: 0, in_progress: 0, done: 0, total: 0 };
      }
      friendMap[key][fe.status || 'todo']++;
      friendMap[key].total++;
    }

    // 5. Map back to user's event IDs
    const progress: Record<string, { todo: number; in_progress: number; done: number; total: number }> = {};
    for (const ev of myEvents) {
      const key = `${ev.className}::${normalize(ev.title)}`;
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
