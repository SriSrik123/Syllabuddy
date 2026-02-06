import mongoose, { Document, Schema } from 'mongoose';

export interface IGoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  googleId?: string;
  googleTokens?: IGoogleTokens;
  googleCalendarConnected: boolean;
  createdAt: Date;
}

const googleTokensSchema = new Schema<IGoogleTokens>({
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiryDate: { type: Number, required: true },
}, { _id: false });

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: '' },
  name: { type: String, required: true, trim: true },
  googleId: { type: String, sparse: true, unique: true },
  googleTokens: { type: googleTokensSchema },
  googleCalendarConnected: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IUser>('User', userSchema);
