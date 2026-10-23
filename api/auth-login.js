import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { isAllowedAdminEmail, passcodeMatches, setSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  const body = parseBody(request);
  const passcode = String(body.passcode || '');
  const email = String(body.email || 'organiser@vulcan.club').trim().toLowerCase();

  if (!passcodeMatches(passcode)) {
    return json(response, 401, { error: 'That passcode is not recognised.' });
  }

  // If email was provided, verify it is allowed
  if (body.email) {
    const authCheck = await isAllowedAdminEmail(email);
    if (!authCheck.allowed) {
      return json(response, 403, { error: 'Your email is not on the organiser allow-list.' });
    }
    setSession(response, email, authCheck.role);
    await logAdminAction({ adminEmail: email, action: 'login', details: { role: authCheck.role } });
    return json(response, 200, { ok: true, email, role: authCheck.role });
  }

  setSession(response, 'organiser@vulcan.club', 'super_admin');
  await logAdminAction({ adminEmail: 'organiser@vulcan.club', action: 'login', details: { method: 'passcode' } });
  return json(response, 200, { ok: true, email: 'organiser@vulcan.club', role: 'super_admin' });
}
