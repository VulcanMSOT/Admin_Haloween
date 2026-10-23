import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  const session = requireSession(request, response);
  if (!session) return;

  const rawCandidate = String(parseBody(request).ticketId || '').trim();
  if (!rawCandidate) return json(response, 400, { error: 'Enter or scan a ticket ID / QR token.' });

  // Clean candidate: if a URL was scanned (e.g. https://.../verify/TOKEN), extract the token
  const cleanToken = rawCandidate.split('/').pop().trim();
  const upperToken = cleanToken.toUpperCase();

  try {
    const registration = await prisma.registration.findFirst({
      where: {
        OR: [
          { ticketId: upperToken },
          { ticketToken: cleanToken },
          { orderRef: upperToken },
        ],
      },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    if (!registration) {
      return json(response, 404, { status: 'invalid', message: 'Invalid ticket. No matching record.' });
    }

    if (registration.revokedAt) {
      return json(response, 200, {
        status: 'invalid',
        registration,
        message: `Ticket REVOKED: ${registration.revokedReason || 'Revoked by admin'}`,
      });
    }

    if (registration.paymentStatus !== 'PAID') {
      return json(response, 200, {
        status: 'invalid',
        registration,
        message: `Unconfirmed ticket. Current payment status: ${registration.paymentStatus}`,
      });
    }

    if (registration.checkedInAt) {
      return json(response, 200, {
        status: 'already',
        registration,
        message: `Already checked in at ${new Date(registration.checkedInAt).toLocaleTimeString('en-IN')}`,
      });
    }

    const now = new Date();
    const marked = await prisma.registration.updateMany({
      where: { id: registration.id, checkedInAt: null, paymentStatus: 'PAID' },
      data: { checkedInAt: now },
    });

    if (!marked.count) {
      const current = await prisma.registration.findUnique({
        where: { id: registration.id },
        include: { members: { orderBy: { position: 'asc' } } },
      });
      return json(response, 200, { status: 'already', registration: current, message: 'Already checked in.' });
    }

    await logAdminAction({
      adminEmail: session.email,
      action: 'checkin',
      targetId: registration.id,
      details: { ticketId: registration.ticketId, teamName: registration.teamName },
    });

    return json(response, 200, {
      status: 'valid',
      registration: { ...registration, checkedInAt: now },
      message: 'Valid ticket. Entry recorded!',
    });
  } catch (error) {
    console.error('Check-in error', error);
    return json(response, 500, { error: 'Could not check this ticket.' });
  }
}
