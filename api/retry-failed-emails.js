import { json, methodNotAllowed } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';
import { sendAndRecordTicketEmail } from './_lib/ticket-email.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  const session = requireSession(request, response);
  if (!session) return;

  try {
    const failed = await prisma.registration.findMany({
      where: {
        paymentStatus: 'PAID',
        ticketId: { not: null },
        OR: [
          { emailStatus: 'failed' },
          { emailSentCount: 0 },
        ],
      },
      include: { members: { orderBy: { position: 'asc' } } },
      take: 20,
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const r of failed) {
      try {
        const res = await sendAndRecordTicketEmail(r, { isResend: true });
        if (res.sent) sentCount++;
        else failedCount++;
      } catch {
        failedCount++;
      }
    }

    await logAdminAction({
      adminEmail: session.email,
      action: 'retry_failed_emails',
      details: { attempted: failed.length, sentCount, failedCount },
    });

    return json(response, 200, {
      ok: true,
      attempted: failed.length,
      sentCount,
      failedCount,
      message: `Processed ${failed.length} tickets: ${sentCount} sent, ${failedCount} still failed.`,
    });
  } catch (error) {
    console.error('Retry failed emails error:', error);
    return json(response, 500, { error: 'Could not retry failed emails.' });
  }
}
