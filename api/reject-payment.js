import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';
import { sendRejectionEmail } from './_lib/ticket-email.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  const session = requireSession(request, response);
  if (!session) return;

  const { registrationId, rejectReason } = parseBody(request);
  if (!registrationId) return json(response, 400, { error: 'Choose a registration first.' });

  const cleanReason = String(rejectReason || '').trim();
  if (!cleanReason) {
    return json(response, 400, { error: 'A rejection reason is required so the attendee knows why it was rejected.' });
  }

  try {
    const existing = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    if (!existing) return json(response, 404, { error: 'Registration not found.' });

    const updated = await prisma.registration.update({
      where: { id: existing.id },
      data: {
        paymentStatus: 'REJECTED',
        rejectReason: cleanReason.slice(0, 500),
        paymentNote: `Rejected by ${session.email}: ${cleanReason.slice(0, 300)}`,
      },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    await logAdminAction({
      adminEmail: session.email,
      action: 'reject_payment',
      targetId: updated.id,
      details: {
        orderRef: updated.orderRef,
        utr: updated.utr,
        rejectReason: cleanReason,
      },
    });

    let emailResult = { sent: false };
    try {
      emailResult = await sendRejectionEmail(updated, cleanReason);
    } catch (emailErr) {
      console.warn('Rejection email error:', emailErr);
    }

    return json(response, 200, {
      ok: true,
      registration: updated,
      emailSent: emailResult.sent,
      message: emailResult.sent
        ? 'Payment rejected and notification email sent to team leader.'
        : 'Payment rejected. (Notification email could not be delivered).',
    });
  } catch (error) {
    console.error('Payment rejection error:', error);
    return json(response, 500, { error: 'Could not reject this payment.' });
  }
}
