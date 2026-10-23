import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';

export default async function handler(request, response) {
  if (handleCors(request, response, ['POST', 'OPTIONS'])) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  const session = requireSession(request, response);
  if (!session) return;

  const rawCandidate = String(parseBody(request).ticketId || '').trim();
  if (!rawCandidate) return json(response, 400, { error: 'Enter or scan a ticket ID or QR code.' });

  // Clean candidate: handles "VHK-1001:TOKEN", "TOKEN", full URLs, etc.
  const cleanString = rawCandidate.split('/').pop().trim();
  const parts = cleanString.split(':');
  const candidateTeamId = parts[0]?.trim().toUpperCase();
  const candidateUpper = cleanString.toUpperCase();

  let whereClause;
  if (parts.length >= 2 && parts[0] && parts[1]) {
    whereClause = {
      teamId: candidateTeamId,
      ticketToken: parts[1].trim(),
    };
  } else {
    whereClause = {
      OR: [
        { teamId: candidateUpper },
        { ticketToken: cleanString },
        { ticketId: candidateUpper },
        { orderRef: candidateUpper },
      ],
    };
  }

  try {
    const registration = await prisma.registration.findFirst({
      where: whereClause,
      include: { members: { orderBy: { position: 'asc' } } },
    });

    if (!registration) {
      return json(response, 404, {
        status: 'invalid',
        message: 'INVALID TICKET: No matching registration found in database.',
      });
    }

    if (registration.revokedAt) {
      return json(response, 200, {
        status: 'invalid',
        registration,
        message: `TICKET REVOKED: ${registration.revokedReason || 'Revoked by admin'}`,
      });
    }

    if (registration.paymentStatus !== 'PAID') {
      return json(response, 200, {
        status: 'invalid',
        registration,
        message: `PAYMENT UNCONFIRMED: Status is ${registration.paymentStatus}`,
      });
    }

    if (registration.checkedInAt) {
      return json(response, 200, {
        status: 'already',
        registration,
        message: `ALREADY ADMITTED at ${new Date(registration.checkedInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}`,
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
      return json(response, 200, {
        status: 'already',
        registration: current,
        message: 'ALREADY ADMITTED (concurrent scan caught).',
      });
    }

    await logAdminAction({
      adminEmail: session.email,
      action: 'checkin',
      targetId: registration.id,
      details: {
        teamId: registration.teamId || registration.ticketId,
        teamName: registration.teamName,
      },
    });

    return json(response, 200, {
      status: 'valid',
      registration: { ...registration, checkedInAt: now },
      message: 'VALID ENTRY — Welcome to Hack-O-Lantern!',
    });
  } catch (error) {
    console.error('Check-in error', error);
    return json(response, 500, { error: 'Could not process check-in.' });
  }
}
