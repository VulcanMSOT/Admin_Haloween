import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';

export default async function handler(request, response) {
  if (handleCors(request, response, ['GET', 'POST', 'OPTIONS'])) return;

  const session = requireSession(request, response);
  if (!session) return;

  if (request.method === 'GET') {
    try {
      let settings = await prisma.eventSettings.findUnique({ where: { id: 'default' } });
      if (!settings) {
        settings = await prisma.eventSettings.create({
          data: {
            id: 'default',
            eventName: 'Hack-O-Lantern',
            eventDate: '31 Oct 2026, 7:00 PM – 1 Nov 2026, 7:00 AM',
            eventVenue: 'Mirai Floor, Bengaluru',
            registrationsOpen: true,
            maxCapacity: 100,
            ticketPrice: 300,
            upiId: 'himangshuyadav2@oksbi',
          },
        });
      }

      const totalTeams = await prisma.registration.count();
      const confirmedTeams = await prisma.registration.count({ where: { paymentStatus: 'PAID' } });

      return json(response, 200, {
        settings,
        totalTeams,
        confirmedTeams,
        spotsRemaining: Math.max(0, settings.maxCapacity - totalTeams),
      });
    } catch (error) {
      console.error('Settings fetch error:', error);
      return json(response, 500, { error: 'Could not fetch event settings.' });
    }
  }

  if (request.method === 'POST') {
    const body = parseBody(request);
    const {
      eventName,
      eventDate,
      eventVenue,
      registrationsOpen,
      maxCapacity,
      ticketPrice,
      upiId,
      opensAt,
      closesAt,
    } = body;

    try {
      const updated = await prisma.eventSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          eventName: String(eventName || 'Hack-O-Lantern').trim(),
          eventDate: String(eventDate || '').trim(),
          eventVenue: String(eventVenue || '').trim(),
          registrationsOpen: Boolean(registrationsOpen),
          maxCapacity: Number(maxCapacity) || 100,
          ticketPrice: Number(ticketPrice) || 300,
          upiId: String(upiId || 'himangshuyadav2@oksbi').trim(),
          opensAt: opensAt ? new Date(opensAt) : null,
          closesAt: closesAt ? new Date(closesAt) : null,
        },
        update: {
          eventName: eventName !== undefined ? String(eventName).trim() : undefined,
          eventDate: eventDate !== undefined ? String(eventDate).trim() : undefined,
          eventVenue: eventVenue !== undefined ? String(eventVenue).trim() : undefined,
          registrationsOpen: registrationsOpen !== undefined ? Boolean(registrationsOpen) : undefined,
          maxCapacity: maxCapacity !== undefined ? Number(maxCapacity) : undefined,
          ticketPrice: ticketPrice !== undefined ? Number(ticketPrice) : undefined,
          upiId: upiId !== undefined ? String(upiId).trim() : undefined,
          opensAt: opensAt !== undefined ? (opensAt ? new Date(opensAt) : null) : undefined,
          closesAt: closesAt !== undefined ? (closesAt ? new Date(closesAt) : null) : undefined,
        },
      });

      await logAdminAction({
        adminEmail: session.email,
        action: 'update_event_settings',
        targetId: 'default',
        details: {
          registrationsOpen: updated.registrationsOpen,
          maxCapacity: updated.maxCapacity,
          ticketPrice: updated.ticketPrice,
          upiId: updated.upiId,
        },
      });

      return json(response, 200, {
        ok: true,
        settings: updated,
        message: 'Event settings updated successfully.',
      });
    } catch (error) {
      console.error('Settings update error:', error);
      return json(response, 500, { error: 'Could not update event settings.' });
    }
  }

  return methodNotAllowed(response, ['GET', 'POST']);
}
