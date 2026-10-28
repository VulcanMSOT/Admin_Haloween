import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';
import { reverseTeamReferral } from './_lib/referral.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  const session = requireSession(request, response);
  if (!session) return;

  const { registrationId, reason } = parseBody(request);
  if (!registrationId) return json(response, 400, { error: 'Choose a registration first.' });
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) return json(response, 400, { error: 'Enter a reason for revoking this ticket.' });

  try {
    const existing = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
    });
    if (!existing) return json(response, 404, { error: 'Registration not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      await reverseTeamReferral(existing.id, tx);

      return await tx.registration.update({
        where: { id: existing.id },
        data: {
          paymentStatus: 'REJECTED',
          revokedAt: new Date(),
          revokedReason: cleanReason,
          rejectReason: `Ticket revoked: ${cleanReason}`,
        },
      });
    }, { maxWait: 10000, timeout: 20000 });

    await logAdminAction({
      adminEmail: session.email,
      action: 'revoke_ticket',
      targetId: updated.id,
      details: {
        ticketId: updated.ticketId,
        reason: cleanReason,
      },
    });

    return json(response, 200, {
      ok: true,
      registration: updated,
      message: 'Ticket has been revoked. Entry with this QR will be blocked.',
    });
  } catch (error) {
    console.error('Revoke ticket error:', error);
    return json(response, 500, { error: 'Could not revoke ticket.' });
  }
}
