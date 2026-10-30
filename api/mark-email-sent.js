import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';

export default async function handler(request, response) {
  if (handleCors(request, response, ['POST', 'OPTIONS'])) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  const session = requireSession(request, response);
  if (!session) return;

  const { registrationId, status: nextStatus } = parseBody(request);
  if (!registrationId) return json(response, 400, { error: 'Registration ID is required.' });

  try {
    const existing = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
    });
    if (!existing) return json(response, 404, { error: 'Registration not found.' });

    const now = new Date();
    const isUnmark = nextStatus === 'pending';
    const updated = await prisma.registration.update({
      where: { id: existing.id },
      data: isUnmark
        ? { emailStatus: 'pending' }
        : {
            emailStatus: 'sent',
            emailSentBy: session.email || 'admin',
            emailSentAt: now,
            emailSentCount: { increment: 1 },
          },
    });

    await logAdminAction({
      adminEmail: session.email,
      action: isUnmark ? 'unmark_email_sent' : 'mark_email_sent',
      targetId: updated.id,
      details: {
        teamId: updated.teamId || updated.orderRef,
        emailStatus: updated.emailStatus,
        emailSentCount: updated.emailSentCount,
        emailSentAt: isUnmark ? null : now.toISOString(),
      },
    });

    return json(response, 200, {
      ok: true,
      registration: updated,
      message: isUnmark ? 'Email marked as pending.' : 'Email marked as sent.',
    });
  } catch (error) {
    console.error('Mark email sent error:', error);
    return json(response, 500, { error: 'Could not record email status.' });
  }
}
