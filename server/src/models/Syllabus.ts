import mongoose, { Document, Schema } from 'mongoose';

export interface ISyllabus extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  className: string;
  fileName: string;
  fileType: string;
  fileData: Buffer;
  extractedText: string;
  uploadedAt: Date;
}

const syllabusSchema = new Schema<ISyllabus>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  className: { type: String, required: true, trim: true },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileData: { type: Buffer, required: true },
  extractedText: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.model<ISyllabus>('Syllabus', syllabusSchema);
