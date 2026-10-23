import { json, methodNotAllowed } from './_lib/http.js';
import { clearSession } from './_lib/session.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  clearSession(response);
  return json(response, 200, { ok: true });
}
