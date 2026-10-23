export function json(response, status, data) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return response.send(JSON.stringify(data));
}

export function methodNotAllowed(response, methods) {
  response.setHeader('Allow', methods.join(', '));
  return json(response, 405, { error: 'Method not allowed.' });
}

export function parseBody(request) {
  if (!request.body) return {};
  return typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
}
