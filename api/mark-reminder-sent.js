import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';

export default async function handler(request, response) {
  if (handleCors(request, response, ['POST', 'OPTIONS'])) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  const session = requireSession(request, response);
  if (!session) return;

  const body = parseBody(request);
  const { registrationId, status: nextStatus, action } = body;

  // Bulk action: reset all reminders to pending
  if (action === 'reset_all') {
    await prisma.auditLog.deleteMany({
      where: { action: { in: ['reminder_sent', 'reminder_unmarked'] } },
    });
    await logAdminAction({
      adminEmail: session.email,
      action: 'reminder_reset_all',
      details: { timestamp: new Date().toISOString() },
    });
    return json(response, 200, {
      ok: true,
      message: 'All event reminders have been reset to pending.',
    });
  }

  if (!registrationId) {
    return json(response, 400, { error: 'Registration ID is required.' });
  }

  try {
    const existing = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
    });
    if (!existing) {
      return json(response, 404, { error: 'Registration not found.' });
    }

    const isMarkSent = nextStatus !== 'pending';
    const auditAction = isMarkSent ? 'reminder_sent' : 'reminder_unmarked';

    await logAdminAction({
      adminEmail: session.email,
      action: auditAction,
      targetId: existing.id,
      details: {
        teamId: existing.teamId || existing.orderRef,
        teamName: existing.teamName,
        timestamp: new Date().toISOString(),
      },
    });

    return json(response, 200, {
      ok: true,
      status: isMarkSent ? 'sent' : 'pending',
      message: isMarkSent
        ? `Event reminder marked as sent for ${existing.teamName}.`
        : `Event reminder marked as pending for ${existing.teamName}.`,
    });
  } catch (error) {
    console.error('Mark reminder sent error:', error);
    return json(response, 500, { error: 'Could not record reminder status.' });
  }
}

