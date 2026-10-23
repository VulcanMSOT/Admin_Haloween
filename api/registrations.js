import { json, methodNotAllowed } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';

const validStatuses = new Set(['PENDING_PAYMENT', 'PENDING_REVIEW', 'PAID', 'REJECTED', 'EXPIRED']);

function toTeam(registration) {
  return { ...registration, members: registration.members.map((member) => ({ position: member.position, fullName: member.fullName, email: member.email, phone: member.phone, college: member.college })) };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  if (!requireSession(request, response)) return;
  const search = String(request.query.search || '').trim().slice(0, 80);
  const status = validStatuses.has(request.query.status) ? request.query.status : undefined;
  const where = {
    ...(status ? { paymentStatus: status } : {}),
    ...(search ? { OR: [
      { teamName: { contains: search, mode: 'insensitive' } },
      { ticketId: { contains: search, mode: 'insensitive' } },
      { paymentReference: { contains: search, mode: 'insensitive' } },
      { members: { some: { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { college: { contains: search, mode: 'insensitive' } }] } } },
    ] } : {}),
  };
  try {
    const [registrations, grouped] = await prisma.$transaction([
      prisma.registration.findMany({ where, take: 100, orderBy: { createdAt: 'desc' }, include: { members: { orderBy: { position: 'asc' } } } }),
      prisma.registration.groupBy({ by: ['paymentStatus'], _count: { _all: true } }),
    ]);
    const totals = Object.fromEntries(grouped.map((row) => [row.paymentStatus, row._count._all]));
    return json(response, 200, { registrations: registrations.map(toTeam), totals });
  } catch (error) {
    console.error('Admin registration list error', error);
    return json(response, 500, { error: 'Could not load registrations.' });
  }
}
