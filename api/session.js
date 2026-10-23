import { json, methodNotAllowed } from './_lib/http.js';
import { getSession } from './_lib/session.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  const session = getSession(request);
  return json(response, 200, {
    authenticated: Boolean(session),
    email: session?.email || null,
    role: session?.role || null,
  });
}
