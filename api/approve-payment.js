import { randomBytes } from 'node:crypto';
import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';

function ticketId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('');
  return `VULCAN-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  if (!requireSession(request, response)) return;
  const { registrationId, note } = parseBody(request);
  if (!registrationId) return json(response, 400, { error: 'Choose a registration first.' });
  try {
    const registration = await prisma.$transaction(async (tx) => {
      const current = await tx.registration.findUnique({ where: { id: registrationId }, include: { members: { orderBy: { position: 'asc' } } } });
      if (!current || current.paymentStatus !== 'PENDING_REVIEW') return null;
      return tx.registration.update({
        where: { id: current.id },
        data: { paymentStatus: 'PAID', paymentApprovedAt: new Date(), paymentApprovedBy: 'organiser', paymentNote: String(note || '').trim().slice(0, 500) || null, ticketId: ticketId() },
        include: { members: { orderBy: { position: 'asc' } } },
      });
    });
    if (!registration) return json(response, 409, { error: 'This payment is no longer waiting for review.' });
    return json(response, 200, { registration });
  } catch (error) {
    console.error('Payment approval error', error);
    return json(response, 500, { error: 'Could not approve this payment.' });
  }
}
