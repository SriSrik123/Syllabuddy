import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { syllabusAPI, calendarAPI, friendsAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Upload,
  FileText,
  Trash2,
  CalendarDays,
  Clock,
  Loader2,
  MessageSquare,
  ChevronRight,
  BookOpen,
  Plus,
  ClipboardList,
  Users,
  X,
} from 'lucide-react';

interface Syllabus {
  _id: string;
  className: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
}

interface CalEvent {
  _id: string;
  title: string;
  date: string;
  className: string;
  eventType: string;
}

interface FriendProgress {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}

const typeLabel: Record<string, string> = {
  exam: 'Exam',
  assignment: 'Assignment',
  deadline: 'Deadline',
  quiz: 'Quiz',
  project: 'Project',
  holiday: 'Holiday',
  other: 'Event',
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

export default function Dashboard() {
  const { user } = useAuth();
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendProgress, setFriendProgress] = useState<Record<string, FriendProgress>>({});
  const [eventOverlap, setEventOverlap] = useState<Record<string, number>>({});
  const [classOverlap, setClassOverlap] = useState<Record<string, number>>({});
  const [friendCount, setFriendCount] = useState(0);

  // Modal state
  const [modalEvent, setModalEvent] = useState<CalEvent | null>(null);
  const [modalFriends, setModalFriends] = useState<Array<{ name: string; email: string; status: string }>>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [syllRes, eventsRes] = await Promise.all([
        syllabusAPI.list(),
        calendarAPI.getEvents({ upcoming: true }),
      ]);
      setSyllabi(syllRes.data);
      setUpcomingEvents(eventsRes.data.slice(0, 7));

      // Load friend data
      try {
        const [progressRes, overlapRes, friendsRes] = await Promise.all([
          friendsAPI.getProgress(),
          friendsAPI.getClassOverlap(),
          friendsAPI.list(),
        ]);
        setFriendProgress(progressRes.data.progress || {});
        setEventOverlap(overlapRes.data.eventOverlap || {});
        setClassOverlap(overlapRes.data.classOverlap || {});
        setFriendCount(friendsRes.data.length || 0);
      } catch { /* friends data is optional */ }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" and its events?`)) return;
    try {
      await syllabusAPI.delete(id);
      toast.success('Removed');
      loadData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleEventClick = async (event: CalEvent) => {
    setModalEvent(event);
    setModalLoading(true);
    setModalFriends([]);
    try {
      const res = await friendsAPI.getEventFriends(event._id);
      setModalFriends(res.data.friends || []);
    } catch {
      setModalFriends([]);
    } finally {
      setModalLoading(false);
    }
  };

  const relativeDate = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (diff < 0) return 'Past';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return `${diff} days`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isUrgent = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 2;
  };

  const thisWeekCount = upcomingEvents.filter(e => {
    const d = Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000);
    return d >= 0 && d <= 7;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Here's an overview of your courses and upcoming deadlines.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-px bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden mb-8">
        {[
          { label: 'Courses', value: syllabi.length, icon: BookOpen },
          { label: 'Upcoming events', value: upcomingEvents.length, icon: CalendarDays },
          { label: 'Due this week', value: thisWeekCount, icon: Clock },
          { label: 'Friends', value: friendCount, icon: Users },
        ].map((m) => (
          <div key={m.label} className="bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center gap-2 mb-2">
              <m.icon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{m.label}</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Courses + Actions */}
        <div className="space-y-6">
          {/* Courses */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Courses</h2>
              <Link to="/upload" className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Add
              </Link>
            </div>

            {syllabi.length === 0 ? (
              <Link to="/upload" className="block border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-5 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                <Upload className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Upload your first syllabus</p>
              </Link>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {syllabi.map((s) => (
                  <div key={s._id} className="flex items-center gap-3 px-3.5 py-3 group">
                    <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{s.className}</p>
                      {classOverlap[s.className] ? (
                        <p className="text-[10px] text-blue-500 dark:text-blue-400">
                          {classOverlap[s.className]} friend{classOverlap[s.className] !== 1 ? 's' : ''} also taking this
                        </p>
                      ) : null}
                    </div>
                    <button
                      onClick={() => handleDelete(s._id, s.className)}
                      className="p-1 text-gray-300 dark:text-gray-700 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {[
              { to: '/assignments', icon: ClipboardList, label: 'Assignments', desc: 'Add tasks manually or with AI' },
              { to: '/chat', icon: MessageSquare, label: 'Ask AI', desc: 'Search across all syllabi' },
              { to: '/calendar', icon: CalendarDays, label: 'Calendar', desc: 'View and export dates' },
              { to: '/friends', icon: Users, label: 'Friends', desc: 'Connect with classmates' },
              { to: '/upload', icon: Upload, label: 'Upload', desc: 'Add a new syllabus' },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="flex items-center gap-3 px-3.5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <item.icon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{item.desc}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
              </Link>
            ))}
          </div>
        </div>

        {/* Right column - Timeline */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Upcoming</h2>
            <Link to="/calendar" className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              View all
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
              <CalendarDays className="w-5 h-5 text-blue-300 dark:text-blue-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming deadlines</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Dates are extracted when you upload a syllabus.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <div className="col-span-1">Date</div>
                <div className="col-span-4">Event</div>
                <div className="col-span-3">Course</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2 text-right">Due</div>
              </div>

              {/* Rows */}
              {upcomingEvents.map((event) => {
                const urgent = isUrgent(event.date);
                const d = new Date(event.date);
                const overlap = eventOverlap[event._id];
                const fp = friendProgress[event._id];
                const friendInfo = overlap || (fp && fp.total > 0);

                return (
                  <div
                    key={event._id}
                    onClick={() => friendInfo ? handleEventClick(event) : undefined}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-gray-50 dark:border-gray-800/50 last:border-0 ${
                      urgent ? 'bg-red-50/50 dark:bg-red-950/10' : ''
                    } ${friendInfo ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors' : ''}`}
                  >
                    {/* Date */}
                    <div className="col-span-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-white">
                        {d.getDate()}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">
                        {d.toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                    </div>

                    {/* Event name + friend info */}
                    <div className="col-span-4">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{event.title}</p>
                      {friendInfo && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Users className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          <span className="text-[10px] text-blue-500 dark:text-blue-400">
                            {fp && fp.total > 0
                              ? `${fp.done} of ${fp.total} done`
                              : `${overlap} friend${overlap !== 1 ? 's' : ''} also have this`
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Course */}
                    <div className="col-span-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{event.className}</p>
                    </div>

                    {/* Type */}
                    <div className="col-span-2 flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${typeDot[event.eventType] || typeDot.other}`} />
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {typeLabel[event.eventType] || 'Event'}
                      </span>
                    </div>

                    {/* Due */}
                    <div className="col-span-2 text-right">
                      <span className={`text-xs font-medium ${
                        urgent
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {relativeDate(event.date)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: friends who have this event */}
      {modalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModalEvent(null)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-xl w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{modalEvent.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{modalEvent.className}</p>
              </div>
              <button
                onClick={() => setModalEvent(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Friends with this {typeLabel[modalEvent.eventType]?.toLowerCase() || 'event'}
              </p>

              {modalLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                </div>
              ) : modalFriends.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No friends have this event yet
                </p>
              ) : (
                <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
                  {modalFriends.map((friend, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <div className="w-7 h-7 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                          {friend.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">{friend.name}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        friend.status === 'done'
                          ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                          : friend.status === 'in_progress'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {friend.status === 'done' ? 'Done' : friend.status === 'in_progress' ? 'Working' : 'To do'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
