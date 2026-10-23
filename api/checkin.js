import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  if (!requireSession(request, response)) return;
  const ticketId = String(parseBody(request).ticketId || '').trim().toUpperCase();
  if (!ticketId) return json(response, 400, { error: 'Enter or scan a ticket ID.' });
  try {
    const registration = await prisma.registration.findUnique({ where: { ticketId }, include: { members: { orderBy: { position: 'asc' } } } });
    if (!registration || registration.paymentStatus !== 'PAID') return json(response, 404, { status: 'invalid', message: 'Invalid ticket.' });
    if (registration.checkedInAt) return json(response, 200, { status: 'already', registration, message: 'Already checked in.' });
    const now = new Date();
    const marked = await prisma.registration.updateMany({ where: { id: registration.id, checkedInAt: null, paymentStatus: 'PAID' }, data: { checkedInAt: now } });
    if (!marked.count) {
      const current = await prisma.registration.findUnique({ where: { id: registration.id }, include: { members: { orderBy: { position: 'asc' } } } });
      return json(response, 200, { status: 'already', registration: current, message: 'Already checked in.' });
    }
    return json(response, 200, { status: 'valid', registration: { ...registration, checkedInAt: now }, message: 'Valid ticket. Entry recorded.' });
  } catch (error) {
    console.error('Check-in error', error);
    return json(response, 500, { error: 'Could not check this ticket.' });
  }
}
