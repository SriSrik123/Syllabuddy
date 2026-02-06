import { Router, Request, Response } from 'express';
import ical, { ICalCalendarMethod } from 'ical-generator';
import CalendarEvent from '../models/CalendarEvent';
import User from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getGoogleCalendarConnectUrl, getGoogleTokens, insertGoogleCalendarEvent } from '../services/googleAuth';

const router = Router();
const CLIENT_URL = 'http://localhost:5174';

// POST /api/calendar/events - create event manually
router.post('/events', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { title, className, date, time, eventType, description, source } = req.body;

    if (!title || !className || !date) {
      res.status(400).json({ error: 'Title, class name, and date are required' });
      return;
    }

    const event = await CalendarEvent.create({
      userId: req.userId,
      title,
      className,
      date: new Date(date),
      time: time || '09:00',
      eventType: eventType || 'assignment',
      description: description || '',
      source: source || 'manual',
    });

    res.status(201).json(event);
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// POST /api/calendar/events/bulk - create multiple events at once
router.post('/events/bulk', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { events: eventsData } = req.body;

    if (!Array.isArray(eventsData) || eventsData.length === 0) {
      res.status(400).json({ error: 'Events array is required' });
      return;
    }

    const docs = eventsData.map((e: any) => ({
      userId: req.userId,
      title: e.title,
      className: e.className,
      date: new Date(e.date),
      time: e.time || '09:00',
      eventType: e.eventType || 'assignment',
      description: e.description || '',
      source: e.source || 'ai',
    }));

    const created = await CalendarEvent.insertMany(docs);
    res.status(201).json({ added: created.length, events: created });
  } catch (err) {
    console.error('Bulk create events error:', err);
    res.status(500).json({ error: 'Failed to create events' });
  }
});

// GET /api/calendar/events - get all events for user
router.get('/events', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { className, upcoming } = req.query;
    const filter: any = { userId: req.userId };

    if (className) {
      filter.className = className;
    }

    if (upcoming === 'true') {
      filter.date = { $gte: new Date() };
    }

    const events = await CalendarEvent.find(filter).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/calendar/events/:syllabusId - get events for specific syllabus
router.get('/events/by-syllabus/:syllabusId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const events = await CalendarEvent.find({
      userId: req.userId,
      syllabusId: req.params.syllabusId,
    }).sort({ date: 1 });

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/calendar/export/ics - export all events as .ics file
router.get('/export/ics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { className } = req.query;
    const filter: any = { userId: req.userId };
    if (className) {
      filter.className = className;
    }

    const events = await CalendarEvent.find(filter).sort({ date: 1 });

    const calendar = ical({
      name: className ? `${className} - Syllabus Events` : 'All Syllabus Events',
      method: ICalCalendarMethod.PUBLISH,
    });

    for (const event of events) {
      const [hours, minutes] = (event.time || '09:00').split(':').map(Number);
      const startDate = new Date(event.date);
      startDate.setHours(hours, minutes, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      calendar.createEvent({
        start: startDate,
        end: endDate,
        summary: `[${event.className}] ${event.title}`,
        description: event.description || '',
        categories: [{ name: event.eventType }],
      });
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="syllabus-events.ics"`);
    res.send(calendar.toString());
  } catch (err) {
    res.status(500).json({ error: 'Failed to export calendar' });
  }
});

// GET /api/calendar/google-url/:eventId - get Google Calendar URL for an event (fallback)
router.get('/google-url/:eventId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const event = await CalendarEvent.findOne({
      _id: req.params.eventId,
      userId: req.userId,
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const [hours, minutes] = (event.time || '09:00').split(':').map(Number);
    const startDate = new Date(event.date);
    startDate.setHours(hours, minutes, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `[${event.className}] ${event.title}`,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details: event.description || '',
    });

    const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate Google Calendar URL' });
  }
});

// --- Google Calendar API Integration ---

// GET /api/calendar/google/connect - get URL to connect Google Calendar
router.get('/google/connect', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const state = Buffer.from(JSON.stringify({ userId: req.userId })).toString('base64');
    const url = getGoogleCalendarConnectUrl(state);
    res.json({ url });
  } catch (err: any) {
    console.error('Google Calendar connect error:', err);
    res.status(500).json({ error: 'Google OAuth not configured' });
  }
});

// GET /api/calendar/google/callback - handle Google Calendar OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      res.redirect(`${CLIENT_URL}/calendar?error=no_code`);
      return;
    }

    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const userId = stateData.userId;

    if (!userId) {
      res.redirect(`${CLIENT_URL}/calendar?error=no_user`);
      return;
    }

    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:5001/api/calendar/google/callback';
    const tokens = await getGoogleTokens(code as string, redirectUri);

    if (!tokens.access_token) {
      res.redirect(`${CLIENT_URL}/calendar?error=no_token`);
      return;
    }

    // Save tokens to user
    const user = await User.findById(userId);
    if (!user) {
      res.redirect(`${CLIENT_URL}/calendar?error=no_user`);
      return;
    }

    user.googleTokens = {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || user.googleTokens?.refreshToken || '',
      expiryDate: tokens.expiry_date || 0,
    };
    user.googleCalendarConnected = true;
    await user.save();

    res.redirect(`${CLIENT_URL}/calendar?google=connected`);
  } catch (err: any) {
    console.error('Google Calendar callback error:', err);
    res.redirect(`${CLIENT_URL}/calendar?error=google_failed`);
  }
});

// GET /api/calendar/google/status - check if Google Calendar is connected
router.get('/google/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    res.json({
      connected: user?.googleCalendarConnected || false,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check Google Calendar status' });
  }
});

// POST /api/calendar/google/add/:eventId - add single event to Google Calendar
router.post('/google/add/:eventId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user?.googleTokens || !user.googleCalendarConnected) {
      res.status(400).json({ error: 'Google Calendar not connected. Please connect your Google account first.' });
      return;
    }

    const event = await CalendarEvent.findOne({
      _id: req.params.eventId,
      userId: req.userId,
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const [hours, minutes] = (event.time || '09:00').split(':').map(Number);
    const startDate = new Date(event.date);
    startDate.setHours(hours, minutes, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    const result = await insertGoogleCalendarEvent(
      user.googleTokens.accessToken,
      user.googleTokens.refreshToken,
      {
        summary: `[${event.className}] ${event.title}`,
        description: event.description || `${event.eventType} for ${event.className}`,
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
      }
    );

    res.json({ success: true, eventId: result.id, link: result.htmlLink });
  } catch (err: any) {
    console.error('Google Calendar insert error:', err);
    if (err.code === 401) {
      // Token expired - mark as disconnected
      await User.findByIdAndUpdate(req.userId, { googleCalendarConnected: false });
      res.status(401).json({ error: 'Google Calendar session expired. Please reconnect.' });
    } else {
      res.status(500).json({ error: 'Failed to add event to Google Calendar' });
    }
  }
});

// POST /api/calendar/google/add-all - add all events (or filtered) to Google Calendar
router.post('/google/add-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user?.googleTokens || !user.googleCalendarConnected) {
      res.status(400).json({ error: 'Google Calendar not connected. Please connect your Google account first.' });
      return;
    }

    const { className } = req.body;
    const filter: any = { userId: req.userId };
    if (className) filter.className = className;

    const events = await CalendarEvent.find(filter).sort({ date: 1 });

    let added = 0;
    let failed = 0;

    for (const event of events) {
      try {
        const [hours, minutes] = (event.time || '09:00').split(':').map(Number);
        const startDate = new Date(event.date);
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);

        await insertGoogleCalendarEvent(
          user.googleTokens!.accessToken,
          user.googleTokens!.refreshToken,
          {
            summary: `[${event.className}] ${event.title}`,
            description: event.description || `${event.eventType} for ${event.className}`,
            startDateTime: startDate.toISOString(),
            endDateTime: endDate.toISOString(),
          }
        );
        added++;
      } catch {
        failed++;
      }
    }

    res.json({ added, failed, total: events.length });
  } catch (err: any) {
    console.error('Google Calendar bulk insert error:', err);
    res.status(500).json({ error: 'Failed to add events to Google Calendar' });
  }
});

// POST /api/calendar/google/disconnect - disconnect Google Calendar
router.post('/google/disconnect', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      googleCalendarConnected: false,
      $unset: { googleTokens: 1 },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
});

// PATCH /api/calendar/events/:eventId/status - update event status
router.patch('/events/:eventId/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['todo', 'in_progress', 'done'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be todo, in_progress, or done' });
      return;
    }

    const event = await CalendarEvent.findOneAndUpdate(
      { _id: req.params.eventId, userId: req.userId },
      { status },
      { new: true }
    );

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event status' });
  }
});

// DELETE /api/calendar/events/:eventId
router.delete('/events/:eventId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const event = await CalendarEvent.findOneAndDelete({
      _id: req.params.eventId,
      userId: req.userId,
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
