import { randomBytes } from 'node:crypto';
import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';
import { sendAndRecordTicketEmail } from './_lib/ticket-email.js';

function ticketId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('');
  return `VULCAN-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  const session = requireSession(request, response);
  if (!session) return;

  const { registrationId, reason } = parseBody(request);
  if (!registrationId) return json(response, 400, { error: 'Choose a registration first.' });
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) return json(response, 400, { error: 'Enter a reason for issuing a complimentary ticket.' });

  try {
    const existing = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
      include: { members: { orderBy: { position: 'asc' } } },
    });
    if (!existing) return json(response, 404, { error: 'Registration not found.' });

    const updated = await prisma.registration.update({
      where: { id: existing.id },
      data: {
        paymentStatus: 'PAID',
        isComp: true,
        compReason: cleanReason,
        paymentApprovedAt: new Date(),
        paymentApprovedBy: session.email,
        paymentNote: `Complimentary pass: ${cleanReason}`,
        ticketId: existing.ticketId || ticketId(),
        ticketToken: existing.ticketToken || randomBytes(24).toString('base64url'),
      },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    await logAdminAction({
      adminEmail: session.email,
      action: 'issue_comp_ticket',
      targetId: updated.id,
      details: {
        ticketId: updated.ticketId,
        reason: cleanReason,
      },
    });

    let email = { sent: false };
    try {
      email = await sendAndRecordTicketEmail(updated);
    } catch (err) {
      console.warn('Comp ticket email error:', err);
    }

    return json(response, 200, {
      ok: true,
      registration: updated,
      message: 'Complimentary ticket issued and emailed.',
    });
  } catch (error) {
    console.error('Comp ticket error:', error);
    return json(response, 500, { error: 'Could not issue complimentary ticket.' });
  }
}
