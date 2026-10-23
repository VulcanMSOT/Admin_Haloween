import { json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  const session = requireSession(request, response);
  if (!session) return;

  const { memberId, fullName, email, phone, college } = parseBody(request);
  if (!memberId) return json(response, 400, { error: 'Member ID is required.' });

  try {
    const existing = await prisma.teamMember.findUnique({
      where: { id: String(memberId) },
    });
    if (!existing) return json(response, 404, { error: 'Team member not found.' });

    const cleanEmail = String(email || existing.email).trim().toLowerCase();
    const cleanPhone = String(phone || existing.phone).trim().replace(/[\s-]/g, '').replace(/^\+91/, '');

    const updated = await prisma.teamMember.update({
      where: { id: existing.id },
      data: {
        fullName: fullName ? String(fullName).trim().slice(0, 100) : existing.fullName,
        email: cleanEmail,
        normalizedEmail: cleanEmail,
        phone: cleanPhone,
        normalizedPhone: cleanPhone,
        college: college ? String(college).trim().slice(0, 80) : existing.college,
      },
    });

    await logAdminAction({
      adminEmail: session.email,
      action: 'edit_attendee',
      targetId: existing.registrationId,
      details: {
        memberId: existing.id,
        before: { fullName: existing.fullName, email: existing.email, phone: existing.phone, college: existing.college },
        after: { fullName: updated.fullName, email: updated.email, phone: updated.phone, college: updated.college },
      },
    });

    return json(response, 200, { ok: true, member: updated, message: 'Attendee details updated.' });
  } catch (error) {
    console.error('Attendee edit error:', error);
    return json(response, 500, { error: 'Could not update attendee details.' });
  }
}
