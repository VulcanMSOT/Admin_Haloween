import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';
import { sendAndRecordTicketEmail } from './_lib/ticket-email.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  const session = requireSession(request, response);
  if (!session) return;

  const { registrationId } = parseBody(request);
  if (!registrationId) return json(response, 400, { error: 'Choose a registration first.' });

  try {
    const registration = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    if (!registration || registration.paymentStatus !== 'PAID' || !registration.ticketId) {
      return json(response, 400, { error: 'Only confirmed tickets can be emailed.' });
    }

    const email = await sendAndRecordTicketEmail(registration, { isResend: true });

    await logAdminAction({
      adminEmail: session.email,
      action: 'resend_ticket',
      targetId: registration.id,
      details: {
        ticketId: registration.ticketId,
        sent: email.sent,
        error: email.error || null,
      },
    });

    if (!email.sent) {
      return json(response, 502, { error: email.error || 'Could not send the ticket email.' });
    }

    return json(response, 200, {
      ok: true,
      email,
      message: `Ticket successfully re-sent to ${registration.members[0]?.email || 'team leader'}.`,
    });
  } catch (error) {
    console.error('Ticket resend error', error);
    return json(response, 500, { error: 'Could not send the ticket email.' });
  }
}
