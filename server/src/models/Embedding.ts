import mongoose, { Document, Schema } from 'mongoose';

export interface IEmbedding extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  syllabusId: mongoose.Types.ObjectId;
  className: string;
  chunkIndex: number;
  text: string;
  vector: number[];
}

const embeddingSchema = new Schema<IEmbedding>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  syllabusId: { type: Schema.Types.ObjectId, ref: 'Syllabus', required: true, index: true },
  className: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  vector: { type: [Number], required: true },
});

// Compound index for efficient user-scoped queries
embeddingSchema.index({ userId: 1, syllabusId: 1 });

export default mongoose.model<IEmbedding>('Embedding', embeddingSchema);
