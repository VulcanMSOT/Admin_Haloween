import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { passcodeMatches, setSession } from './_lib/session.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  if (!passcodeMatches(parseBody(request).passcode)) return json(response, 401, { error: 'That passcode is not recognised.' });
  setSession(response);
  return json(response, 200, { ok: true });
}
