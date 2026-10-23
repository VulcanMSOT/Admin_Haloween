import { json, methodNotAllowed } from './_lib/http.js';
import { isSessionValid } from './_lib/session.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  return json(response, 200, { authenticated: isSessionValid(request) });
}
