import { createApp } from '../server/app.js';

/**
 * Vercel serverless entry — весь сайт (HTML + /api/*).
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  try {
    var app = await createApp();
    app(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Server setup error. Check DATABASE_URL in Vercel Environment Variables.');
  }
}
