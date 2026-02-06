import { app, connectDB } from '../server/src/index';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  return app(req as any, res as any);
}
