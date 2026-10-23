import { prisma } from './prisma.js';

export async function logAdminAction({ adminEmail, action, targetId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        adminEmail: adminEmail || 'organiser',
        action,
        targetId: targetId ? String(targetId) : null,
        details: details || {},
      },
    });
  } catch (err) {
    console.error('Audit log write error:', err);
  }
}
