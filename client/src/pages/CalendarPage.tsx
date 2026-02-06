import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { calendarAPI, syllabusAPI, friendsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  CalendarDays,
  Trash2,
  Loader2,
  Download,
  Check,
  Link2,
  Link2Off,
  CalendarPlus,
  ChevronDown,
  Circle,
  Clock,
  CheckCircle2,
  Users,
} from 'lucide-react';

interface CalEvent {
  _id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  eventType: string;
  className: string;
  syllabusId: string;
  status: 'todo' | 'in_progress' | 'done';
}

interface Syllabus {
  _id: string;
  className: string;
}

interface FriendProgress {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}

const typeBadge: Record<string, string> = {
  exam: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  assignment: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  deadline: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  quiz: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
  project: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
  holiday: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const typeDot: Record<string, string> = {
  exam: 'bg-red-500',
  assignment: 'bg-blue-500',
  deadline: 'bg-amber-500',
  quiz: 'bg-yellow-500',
  project: 'bg-violet-500',
  holiday: 'bg-emerald-500',
  other: 'bg-gray-400',
};

const statusConfig = {
  todo: { icon: Circle, label: 'To do', color: 'text-gray-400 dark:text-gray-500', bg: '' },
  in_progress: { icon: Clock, label: 'Working', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20' },
  done: { icon: CheckCircle2, label: 'Done', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/20' },
};

const statusCycle: Record<string, 'todo' | 'in_progress' | 'done'> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

function GoogleCalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function FriendProgressBar({ progress }: { progress: FriendProgress }) {
  const { done, in_progress, total } = progress;
  if (total === 0) return null;

  const doneLabel = done > 0 ? `${done} done` : '';
  const wipLabel = in_progress > 0 ? `${in_progress} working` : '';
  const parts = [doneLabel, wipLabel].filter(Boolean).join(', ');

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Users className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
      <div className="flex items-center gap-1">
        {/* Mini progress bar */}
        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
          {done > 0 && (
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${(done / total) * 100}%` }}
            />
          )}
          {in_progress > 0 && (
            <div
              className="h-full bg-amber-400"
              style={{ width: `${(in_progress / total) * 100}%` }}
            />
          )}
        </div>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          {parts || `${total} friend${total !== 1 ? 's' : ''}`} of {total}
        </span>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [filterClass, setFilterClass] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [addingEventId, setAddingEventId] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [friendProgress, setFriendProgress] = useState<Record<string, FriendProgress>>({});
  const [friendCount, setFriendCount] = useState(0);
  const { refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('google') === 'connected') {
      toast.success('Google Calendar connected');
      setGoogleConnected(true);
      refreshUser();
      setSearchParams({});
    }
    if (searchParams.get('error')) {
      toast.error('Failed to connect Google Calendar');
      setSearchParams({});
    }
    loadData();
    checkGoogleStatus();
    loadFriendProgress();
  }, []);

  useEffect(() => { loadEvents(); }, [filterClass]);

  const loadData = async () => {
    try {
      const syllRes = await syllabusAPI.list();
      setSyllabi(syllRes.data);
    } catch {
      toast.error('Failed to load data');
    }
  };

  const checkGoogleStatus = async () => {
    try {
      const res = await calendarAPI.googleStatus();
      setGoogleConnected(res.data.connected);
    } catch { /* ignore */ }
  };

  const loadFriendProgress = async () => {
    try {
      const res = await friendsAPI.getProgress();
      setFriendProgress(res.data.progress || {});
      setFriendCount(res.data.friendCount || 0);
    } catch { /* ignore */ }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await calendarAPI.getEvents(filterClass ? { className: filterClass } : {});
      setEvents(res.data);
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (eventId: string, currentStatus: string) => {
    const newStatus = statusCycle[currentStatus || 'todo'];
    // Optimistic update
    setEvents(prev => prev.map(e => e._id === eventId ? { ...e, status: newStatus } : e));
    try {
      await calendarAPI.updateEventStatus(eventId, newStatus);
    } catch {
      // Revert on failure
      setEvents(prev => prev.map(e => e._id === eventId ? { ...e, status: currentStatus as any } : e));
      toast.error('Failed to update status');
    }
  };

  const handleExportICS = async () => {
    try {
      const res = await calendarAPI.exportICS(filterClass || undefined);
      const blob = new Blob([res.data], { type: 'text/calendar' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'syllabus-events.ics';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Calendar file downloaded');
    } catch {
      toast.error('Failed to export calendar');
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await calendarAPI.googleConnect();
      window.location.href = res.data.url;
    } catch {
      toast.error('Google Calendar not configured');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Disconnect Google Calendar?')) return;
    try {
      await calendarAPI.googleDisconnect();
      setGoogleConnected(false);
      refreshUser();
      toast.success('Google Calendar disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const handleAddToGoogle = async (eventId: string) => {
    if (!googleConnected) { toast.error('Connect Google Calendar first'); return; }
    setAddingEventId(eventId);
    try {
      await calendarAPI.googleAddEvent(eventId);
      toast.success('Event added to Google Calendar');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setGoogleConnected(false);
        toast.error('Session expired. Please reconnect.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to add event');
      }
    } finally {
      setAddingEventId(null);
    }
  };

  const handleAddAllToGoogle = async () => {
    if (!googleConnected) { toast.error('Connect Google Calendar first'); return; }
    if (!confirm(`Add ${events.length} events to Google Calendar?`)) return;
    setAddingAll(true);
    try {
      const res = await calendarAPI.googleAddAll(filterClass || undefined);
      toast.success(`Added ${res.data.added} events${res.data.failed > 0 ? ` (${res.data.failed} failed)` : ''}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add events');
    } finally {
      setAddingAll(false);
    }
  };

  const handleGoogleCalUrl = async (eventId: string) => {
    try {
      const res = await calendarAPI.getGoogleCalUrl(eventId);
      window.open(res.data.url, '_blank');
    } catch {
      toast.error('Failed to generate link');
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await calendarAPI.deleteEvent(eventId);
      setEvents(prev => prev.filter(e => e._id !== eventId));
      toast.success('Event deleted');
    } catch {
      toast.error('Failed to delete event');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const groupedEvents = events.reduce<Record<string, CalEvent[]>>((acc, event) => {
    const month = new Date(event.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(event);
    return acc;
  }, {});

  const uniqueClasses = [...new Set(syllabi.map(s => s.className))];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Track your progress and see how friends are doing.
          </p>
        </div>
        <button
          onClick={handleExportICS}
          disabled={events.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export .ics
        </button>
      </div>

      {/* Google Calendar */}
      <div className={`rounded-md border p-3.5 mb-5 transition-colors ${
        googleConnected
          ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900'
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
      }`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <GoogleCalIcon className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-gray-900 dark:text-white leading-tight">
                {googleConnected ? 'Google Calendar connected' : 'Google Calendar'}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                {googleConnected ? 'Events sync directly to your calendar' : 'Connect for automatic event sync'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {googleConnected ? (
              <>
                <button
                  onClick={handleAddAllToGoogle}
                  disabled={events.length === 0 || addingAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-[12px] font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {addingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarPlus className="w-3 h-3" />}
                  {addingAll ? 'Adding...' : 'Sync all'}
                </button>
                <button
                  onClick={handleDisconnectGoogle}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                  title="Disconnect"
                >
                  <Link2Off className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectGoogle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-[12px] font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Link2 className="w-3 h-3" />
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter */}
      {uniqueClasses.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <div className="relative">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-[13px] text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="">All courses</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {filterClass && (
            <button
              onClick={() => setFilterClass('')}
              className="text-[12px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Events */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      ) : events.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-800 rounded-md p-8 text-center">
          <CalendarDays className="w-5 h-5 text-blue-300 dark:text-blue-700 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No events found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Upload a syllabus or add assignments to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                {month}
              </h3>
              <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {monthEvents.map((event) => {
                  const st = statusConfig[event.status || 'todo'];
                  const StatusIcon = st.icon;
                  const fp = friendProgress[event._id];
                  return (
                    <div key={event._id} className={`flex items-start gap-3 px-4 py-3 group ${st.bg}`}>
                      {/* Status toggle */}
                      <button
                        onClick={() => handleStatusToggle(event._id, event.status || 'todo')}
                        className={`mt-0.5 flex-shrink-0 ${st.color} hover:scale-110 transition-transform`}
                        title={`${st.label} — click to change`}
                      >
                        <StatusIcon className="w-4 h-4" />
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-[13px] font-medium truncate ${
                            event.status === 'done'
                              ? 'text-gray-400 dark:text-gray-500 line-through'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {event.title}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${typeBadge[event.eventType] || typeBadge.other}`}>
                            {event.eventType}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
                          {event.className} &middot; {formatDate(event.date)}{event.time ? ` at ${event.time}` : ''}
                        </p>
                        {/* Friend progress */}
                        {fp && <FriendProgressBar progress={fp} />}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {googleConnected ? (
                          <button
                            onClick={() => handleAddToGoogle(event._id)}
                            disabled={addingEventId === event._id}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors disabled:opacity-50"
                            title="Add to Google Calendar"
                          >
                            {addingEventId === event._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <GoogleCalIcon className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGoogleCalUrl(event._id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                            title="Open in Google Calendar"
                          >
                            <GoogleCalIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(event._id)}
                          className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
