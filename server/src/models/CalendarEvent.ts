import mongoose, { Document, Schema } from 'mongoose';

export interface ICalendarEvent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  syllabusId?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  date: Date;
  time: string;
  eventType: 'exam' | 'assignment' | 'deadline' | 'quiz' | 'project' | 'holiday' | 'other';
  className: string;
  source: 'syllabus' | 'manual' | 'ai';
  status: 'todo' | 'in_progress' | 'done';
}

const calendarEventSchema = new Schema<ICalendarEvent>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  syllabusId: { type: Schema.Types.ObjectId, ref: 'Syllabus' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  date: { type: Date, required: true },
  time: { type: String, default: '09:00' },
  eventType: {
    type: String,
    enum: ['exam', 'assignment', 'deadline', 'quiz', 'project', 'holiday', 'other'],
    default: 'other',
  },
  className: { type: String, required: true },
  source: { type: String, enum: ['syllabus', 'manual', 'ai'], default: 'syllabus' },
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
});

export default mongoose.model<ICalendarEvent>('CalendarEvent', calendarEventSchema);
