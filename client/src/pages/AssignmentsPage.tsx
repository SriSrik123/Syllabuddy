import { useState, useEffect } from 'react';
import { calendarAPI, aiAPI, syllabusAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Plus,
  Sparkles,
  Loader2,
  Check,
  X,
  CalendarDays,
  Trash2,
  ClipboardPaste,
} from 'lucide-react';

interface ExtractedItem {
  title: string;
  description: string;
  date: string;
  time: string;
  eventType: string;
  className: string;
  selected: boolean;
}

interface Syllabus {
  _id: string;
  className: string;
}

const eventTypes = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'exam', label: 'Exam' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'project', label: 'Project' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'other', label: 'Other' },
];

export default function AssignmentsPage() {
  const [tab, setTab] = useState<'manual' | 'ai'>('manual');
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);

  // Manual form state
  const [title, setTitle] = useState('');
  const [className, setClassName] = useState('');
  const [customClass, setCustomClass] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('23:59');
  const [eventType, setEventType] = useState('assignment');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // AI state
  const [aiText, setAiText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedItem[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    syllabusAPI.list().then(res => setSyllabi(res.data)).catch(() => {});
  }, []);

  const courseNames = [...new Set(syllabi.map(s => s.className))];

  // ---- Manual submit ----
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedClass = className === '__custom__' ? customClass.trim() : className;
    if (!title.trim() || !resolvedClass || !date) {
      toast.error('Title, course, and date are required');
      return;
    }
    setSubmitting(true);
    try {
      await calendarAPI.createEvent({
        title: title.trim(),
        className: resolvedClass,
        date,
        time,
        eventType,
        description: description.trim(),
        source: 'manual',
      });
      toast.success('Assignment added!');
      setTitle('');
      setDate('');
      setTime('23:59');
      setDescription('');
      setEventType('assignment');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add assignment');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- AI extract ----
  const handleExtract = async () => {
    if (!aiText.trim()) {
      toast.error('Paste or type some text first');
      return;
    }
    setExtracting(true);
    setExtracted(null);
    try {
      const res = await aiAPI.extractAssignments(aiText.trim());
      const items: ExtractedItem[] = (res.data.assignments || []).map((a: any) => ({
        ...a,
        selected: true,
      }));
      if (items.length === 0) {
        toast.error('No assignments found in the text. Try pasting something with dates or deadlines.');
      } else {
        toast.success(`Found ${items.length} item${items.length > 1 ? 's' : ''}`);
      }
      setExtracted(items);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to extract. Check AI config.');
    } finally {
      setExtracting(false);
    }
  };

  const toggleItem = (idx: number) => {
    setExtracted(prev =>
      prev ? prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item)) : null
    );
  };

  const updateItem = (idx: number, field: keyof ExtractedItem, value: string) => {
    setExtracted(prev =>
      prev ? prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)) : null
    );
  };

  const removeItem = (idx: number) => {
    setExtracted(prev => prev ? prev.filter((_, i) => i !== idx) : null);
  };

  const handleSaveExtracted = async () => {
    if (!extracted) return;
    const selected = extracted.filter(item => item.selected);
    if (selected.length === 0) {
      toast.error('Select at least one item to save');
      return;
    }
    setSaving(true);
    try {
      const events = selected.map(({ title, className, date, time, eventType, description }) => ({
        title,
        className,
        date,
        time,
        eventType,
        description,
        source: 'ai' as const,
      }));
      const res = await calendarAPI.createBulk(events);
      toast.success(`Added ${res.data.added} item${res.data.added > 1 ? 's' : ''} to your calendar!`);
      setExtracted(null);
      setAiText('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const typeBadge: Record<string, string> = {
    exam: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    assignment: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    deadline: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    quiz: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
    project: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
    other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Add Assignments</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Add tasks manually or let AI extract them from text you paste.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setTab('manual')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
            tab === 'manual'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Manual
        </button>
        <button
          onClick={() => setTab('ai')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
            tab === 'ai'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Extract
        </button>
      </div>

      {/* Manual Tab */}
      {tab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="e.g. Homework 3, Midterm Exam"
            />
          </div>

          {/* Course */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Course
            </label>
            {courseNames.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select a course</option>
                  {courseNames.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__custom__">Other (type in)</option>
                </select>
                {className === '__custom__' && (
                  <input
                    type="text"
                    value={customClass}
                    onChange={(e) => setCustomClass(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter course name"
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                value={customClass}
                onChange={(e) => { setCustomClass(e.target.value); setClassName('__custom__'); }}
                required
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. CS 101"
              />
            )}
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Due date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {eventTypes.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setEventType(t.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    eventType === t.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Any additional details..."
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 text-white rounded-md text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding...</>
            ) : (
              <><CalendarDays className="w-3.5 h-3.5" /> Add Assignment</>
            )}
          </button>
        </form>
      )}

      {/* AI Tab */}
      {tab === 'ai' && (
        <div className="space-y-4">
          {!extracted ? (
            <>
              {/* Input area */}
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Paste your text
                </label>
                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder={"Paste anything here \u2014 copied text from your course website, an email from your professor, a list of assignments, lecture notes, etc.\n\nExample:\nCS 101 \u2014 Homework 4 due Feb 14\nMath 200 midterm on March 3 at 2pm\nEnglish essay draft due next Friday"}
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md">
                <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  AI will parse your text and find assignments, exams, deadlines, and other events. You can review and edit them before saving.
                </p>
              </div>

              <button
                onClick={handleExtract}
                disabled={extracting || !aiText.trim()}
                className="w-full py-2.5 bg-blue-600 text-white rounded-md text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {extracting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting...</>
                ) : (
                  <><ClipboardPaste className="w-3.5 h-3.5" /> Extract Assignments</>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Results */}
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">
                  Found {extracted.length} item{extracted.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => { setExtracted(null); }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Start over
                </button>
              </div>

              {extracted.length === 0 ? (
                <div className="border border-gray-200 dark:border-gray-800 rounded-md p-6 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No items found. Try different text.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {extracted.map((item, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-md p-3.5 transition-colors ${
                        item.selected
                          ? 'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900'
                          : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleItem(idx)}
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            item.selected
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {item.selected && <Check className="w-3 h-3" />}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              value={item.title}
                              onChange={(e) => updateItem(idx, 'title', e.target.value)}
                              className="flex-1 text-sm font-medium text-gray-900 dark:text-white bg-transparent border-0 p-0 focus:ring-0 outline-none"
                            />
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${typeBadge[item.eventType] || typeBadge.other}`}>
                              {item.eventType}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs">
                            <input
                              value={item.className}
                              onChange={(e) => updateItem(idx, 'className', e.target.value)}
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 border-0 focus:ring-1 focus:ring-blue-500 outline-none w-32"
                              placeholder="Course"
                            />
                            <input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateItem(idx, 'date', e.target.value)}
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 border-0 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <input
                              type="time"
                              value={item.time}
                              onChange={(e) => updateItem(idx, 'time', e.target.value)}
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 border-0 focus:ring-1 focus:ring-blue-500 outline-none w-24"
                            />
                            <select
                              value={item.eventType}
                              onChange={(e) => updateItem(idx, 'eventType', e.target.value)}
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 border-0 focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                              {eventTypes.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>

                          {item.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                          )}
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {extracted.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveExtracted}
                    disabled={saving || extracted.filter(i => i.selected).length === 0}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-md text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                    ) : (
                      <><Check className="w-3.5 h-3.5" /> Add {extracted.filter(i => i.selected).length} to Calendar</>
                    )}
                  </button>
                  <button
                    onClick={() => setExtracted(null)}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[13px] font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
