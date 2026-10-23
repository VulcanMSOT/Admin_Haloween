import { createHmac, timingSafeEqual } from 'node:crypto';
import { json } from './http.js';
import { prisma } from './prisma.js';

const cookieName = 'vulcan_admin_session';

function secret() {
  return process.env.ORGANISER_SESSION_SECRET || 'dev-session-secret-key-32-chars-long!!';
}

function sign(value) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function readCookie(request) {
  const source = request.headers.cookie || '';
  return source.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
}

export function createSession(email = 'organiser@vulcan.club', role = 'super_admin') {
  const payload = Buffer.from(JSON.stringify({
    email,
    role,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function setSession(response, email = 'organiser@vulcan.club', role = 'super_admin') {
  const secure = process.env.NODE_ENV === 'production';
  response.setHeader('Set-Cookie', `${cookieName}=${createSession(email, role)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure ? '; Secure' : ''}`);
}

export function clearSession(response) {
  response.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function getSession(request) {
  try {
    const value = readCookie(request);
    const [payload, signature] = value.split('.');
    if (!payload || !signature) return null;
    const expected = sign(payload);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function isSessionValid(request) {
  return Boolean(getSession(request));
}

export function requireSession(request, response) {
  const session = getSession(request);
  if (session) return session;
  json(response, 401, { error: 'Sign in to continue.' });
  return null;
}

export function passcodeMatches(value) {
  const passcode = process.env.ORGANISER_PASSCODE || 'vulcan2026';
  const input = String(value || '');
  if (!passcode || input.length !== passcode.length) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(passcode));
}

export async function isAllowedAdminEmail(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return false;

  // 1. Check ADMIN_EMAILS environment variable
  const envList = (process.env.ADMIN_EMAILS || 'nexcell_rathinam@msot.org,sapnilbiswas010506@gmail.com,himangshuyadav2@oksbi')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (envList.includes(cleanEmail)) return { allowed: true, role: 'super_admin' };

  // 2. Check Admin database table
  try {
    const adminRecord = await prisma.admin.findUnique({
      where: { email: cleanEmail },
    });
    if (adminRecord) {
      return { allowed: true, role: adminRecord.role || 'staff' };
    }
  } catch (err) {
    console.warn('Admin table lookup warning:', err.message);
  }

  return { allowed: false };
}
