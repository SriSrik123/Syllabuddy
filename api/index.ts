import { app, connectDB } from '../server/src/index';

export default async function handler(req: any, res: any) {
  await connectDB();
  return app(req, res);
}
