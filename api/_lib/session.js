import { createHmac, timingSafeEqual } from 'node:crypto';
import { json } from './http.js';

const cookieName = 'vulcan_admin_session';

function secret() { return process.env.ORGANISER_SESSION_SECRET || ''; }
function sign(value) { return createHmac('sha256', secret()).update(value).digest('base64url'); }
function readCookie(request) {
  const source = request.headers.cookie || '';
  return source.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
}

export function createSession() {
  if (!secret()) throw new Error('ORGANISER_SESSION_SECRET is not configured.');
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function setSession(response) {
  const secure = process.env.NODE_ENV === 'production';
  response.setHeader('Set-Cookie', `${cookieName}=${createSession()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure ? '; Secure' : ''}`);
}

export function clearSession(response) {
  response.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

export function isSessionValid(request) {
  try {
    const value = readCookie(request);
    const [payload, signature] = value.split('.');
    if (!payload || !signature || !secret()) return false;
    const expected = sign(payload);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch { return false; }
}

export function requireSession(request, response) {
  if (isSessionValid(request)) return true;
  json(response, 401, { error: 'Sign in to continue.' });
  return false;
}

export function passcodeMatches(value) {
  const passcode = process.env.ORGANISER_PASSCODE || '';
  const input = String(value || '');
  if (!passcode || input.length !== passcode.length) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(passcode));
}
