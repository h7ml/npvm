import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer } from '../packages/server/src/index.js';

let handler: ((req: VercelRequest, res: VercelResponse) => void) | null = null;

async function getHandler() {
  if (handler) return handler;
  const { app } = await createServer({ host: '0.0.0.0' });
  await app.ready();
  handler = async (req: VercelRequest, res: VercelResponse) => {
    await app.server.emit('request', req, res);
  };
  return handler;
}

export default async function (req: VercelRequest, res: VercelResponse) {
  const fn = await getHandler();
  return fn(req, res);
}
