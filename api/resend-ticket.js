import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { sendAndRecordTicketEmail } from './_lib/ticket-email.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  if (!requireSession(request, response)) return;
  const { registrationId } = parseBody(request);
  if (!registrationId) return json(response, 400, { error: 'Choose a registration first.' });
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
      include: { members: { orderBy: { position: 'asc' } } },
    });
    if (!registration || registration.paymentStatus !== 'PAID' || !registration.ticketId) return json(response, 400, { error: 'Only issued tickets can be emailed.' });
    const email = await sendAndRecordTicketEmail(registration);
    if (!email.sent) return json(response, 502, { error: email.error || 'Could not send the ticket email.' });
    return json(response, 200, { email });
  } catch (error) {
    console.error('Ticket resend error', error);
    return json(response, 500, { error: 'Could not send the ticket email.' });
  }
}
