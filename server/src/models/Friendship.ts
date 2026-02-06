import mongoose, { Document, Schema } from 'mongoose';

export interface IFriendship extends Document {
  _id: mongoose.Types.ObjectId;
  requester: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted';
  createdAt: Date;
}

const friendshipSchema = new Schema<IFriendship>({
  requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

// Prevent duplicate friend requests
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export default mongoose.model<IFriendship>('Friendship', friendshipSchema);
