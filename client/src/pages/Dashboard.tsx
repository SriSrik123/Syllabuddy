import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { syllabusAPI, calendarAPI } from '../services/api';
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [syllRes, eventsRes] = await Promise.all([
        syllabusAPI.list(),
        calendarAPI.getEvents({ upcoming: true }),
      ]);
      setSyllabi(syllRes.data);
      setUpcomingEvents(eventsRes.data.slice(0, 7));
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
          { label: 'AI queries', value: '\u221E', icon: MessageSquare },
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
                return (
                  <div
                    key={event._id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-gray-50 dark:border-gray-800/50 last:border-0 ${
                      urgent ? 'bg-red-50/50 dark:bg-red-950/10' : ''
                    }`}
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

                    {/* Event name */}
                    <div className="col-span-4">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{event.title}</p>
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
    </div>
  );
}
