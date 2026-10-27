import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';

const CODE_REGEX = /^[a-zA-Z0-9_-]{4,32}$/;

export default async function handler(request, response) {
  if (handleCors(request, response, ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'])) return;

  const session = requireSession(request, response);
  if (!session) return;

  const method = request.method;

  // 1. GET: List all coupons
  if (method === 'GET') {
    try {
      const [coupons, usageByReg] = await Promise.all([
        prisma.coupon.findMany({
          orderBy: { createdAt: 'desc' },
        }),
        prisma.registration.groupBy({
          by: ['couponCode'],
          _count: { _all: true },
        }),
      ]);

      const regCounts = Object.fromEntries(
        usageByReg
          .filter((row) => row.couponCode)
          .map((row) => [row.couponCode, row._count._all])
      );

      const enriched = coupons.map((c) => ({
        ...c,
        registrationsCount: regCounts[c.code] || 0,
      }));

      return json(response, 200, { ok: true, coupons: enriched });
    } catch (error) {
      console.error('List coupons error:', error);
      return json(response, 500, { error: 'Could not load coupons.' });
    }
  }

  // 2. POST: Create a coupon
  if (method === 'POST') {
    const { code, type = 'flat', value, maxUses, expiresAt, active = true } = parseBody(request);

    const rawCode = String(code || '').trim();
    if (!CODE_REGEX.test(rawCode)) {
      return json(response, 400, {
        error: 'Coupon code must be 4–32 characters and contain only letters, numbers, hyphens, and underscores.',
      });
    }

    const normalisedCode = rawCode.toLowerCase();

    if (!['flat', 'percent'].includes(type)) {
      return json(response, 400, { error: 'Coupon type must be either "flat" or "percent".' });
    }

    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) {
      return json(response, 400, { error: 'Coupon discount value must be a positive number.' });
    }

    if (type === 'percent' && numValue > 100) {
      return json(response, 400, { error: 'Percentage discount cannot exceed 100%.' });
    }

    let parsedMaxUses = null;
    if (maxUses !== undefined && maxUses !== null && String(maxUses).trim() !== '') {
      parsedMaxUses = parseInt(maxUses, 10);
      if (isNaN(parsedMaxUses) || parsedMaxUses <= 0) {
        return json(response, 400, { error: 'Max uses must be a positive integer if specified.' });
      }
    }

    let parsedExpiresAt = null;
    if (expiresAt && String(expiresAt).trim() !== '') {
      const date = new Date(expiresAt);
      if (isNaN(date.getTime())) {
        return json(response, 400, { error: 'Invalid expiration date format.' });
      }
      parsedExpiresAt = date;
    }

    try {
      const existing = await prisma.coupon.findUnique({
        where: { code: normalisedCode },
      });
      if (existing) {
        return json(response, 400, { error: `A coupon with code "${normalisedCode}" already exists.` });
      }

      const created = await prisma.coupon.create({
        data: {
          code: normalisedCode,
          type,
          value: numValue,
          maxUses: parsedMaxUses,
          expiresAt: parsedExpiresAt,
          active: Boolean(active),
          usedCount: 0,
        },
      });

      await logAdminAction({
        adminEmail: session.email,
        action: 'create_coupon',
        targetId: created.id,
        details: {
          code: created.code,
          type: created.type,
          value: created.value,
          maxUses: created.maxUses,
          expiresAt: created.expiresAt,
          active: created.active,
        },
      });

      return json(response, 201, {
        ok: true,
        coupon: created,
        message: `Coupon "${created.code}" created successfully.`,
      });
    } catch (error) {
      console.error('Create coupon error:', error);
      return json(response, 500, { error: 'Could not create coupon.' });
    }
  }

  // 3. PATCH: Update coupon settings (toggle active, maxUses, expiresAt)
  if (method === 'PATCH') {
    const { id, active, maxUses, expiresAt, value, type } = parseBody(request);
    if (!id) return json(response, 400, { error: 'Coupon ID is required.' });

    try {
      const existing = await prisma.coupon.findUnique({
        where: { id: String(id) },
      });
      if (!existing) return json(response, 404, { error: 'Coupon not found.' });

      const updateData = {};
      if (active !== undefined) updateData.active = Boolean(active);

      if (maxUses !== undefined) {
        if (maxUses === null || String(maxUses).trim() === '') {
          updateData.maxUses = null;
        } else {
          const parsed = parseInt(maxUses, 10);
          if (isNaN(parsed) || parsed < 0) {
            return json(response, 400, { error: 'Max uses must be a non-negative integer or null.' });
          }
          updateData.maxUses = parsed;
        }
      }

      if (expiresAt !== undefined) {
        if (expiresAt === null || String(expiresAt).trim() === '') {
          updateData.expiresAt = null;
        } else {
          const date = new Date(expiresAt);
          if (isNaN(date.getTime())) {
            return json(response, 400, { error: 'Invalid expiration date format.' });
          }
          updateData.expiresAt = date;
        }
      }

      if (value !== undefined) {
        const numVal = Number(value);
        if (isNaN(numVal) || numVal <= 0) {
          return json(response, 400, { error: 'Value must be positive.' });
        }
        updateData.value = numVal;
      }

      if (type !== undefined) {
        if (!['flat', 'percent'].includes(type)) {
          return json(response, 400, { error: 'Type must be flat or percent.' });
        }
        updateData.type = type;
      }

      const updated = await prisma.coupon.update({
        where: { id: existing.id },
        data: updateData,
      });

      await logAdminAction({
        adminEmail: session.email,
        action: 'update_coupon',
        targetId: updated.id,
        details: {
          code: updated.code,
          changes: updateData,
        },
      });

      return json(response, 200, {
        ok: true,
        coupon: updated,
        message: `Coupon "${updated.code}" updated successfully.`,
      });
    } catch (error) {
      console.error('Update coupon error:', error);
      return json(response, 500, { error: 'Could not update coupon.' });
    }
  }

  // 4. DELETE: Delete coupon (only if usedCount === 0 and no registrations use it)
  if (method === 'DELETE') {
    const { id } = parseBody(request);
    const queryId = request.query?.id || id;
    if (!queryId) return json(response, 400, { error: 'Coupon ID is required.' });

    try {
      const existing = await prisma.coupon.findUnique({
        where: { id: String(queryId) },
      });
      if (!existing) return json(response, 404, { error: 'Coupon not found.' });

      if (existing.usedCount > 0) {
        return json(response, 400, {
          error: `Cannot delete coupon "${existing.code}" because it has already been used ${existing.usedCount} time(s). You can deactivate it instead.`,
        });
      }

      const regCount = await prisma.registration.count({
        where: { couponCode: existing.code },
      });
      if (regCount > 0) {
        return json(response, 400, {
          error: `Cannot delete coupon "${existing.code}" because ${regCount} registration(s) currently reference it. You can deactivate it instead.`,
        });
      }

      await prisma.coupon.delete({
        where: { id: existing.id },
      });

      await logAdminAction({
        adminEmail: session.email,
        action: 'delete_coupon',
        targetId: existing.id,
        details: { code: existing.code },
      });

      return json(response, 200, {
        ok: true,
        message: `Coupon "${existing.code}" deleted.`,
      });
    } catch (error) {
      console.error('Delete coupon error:', error);
      return json(response, 500, { error: 'Could not delete coupon.' });
    }
  }

  return methodNotAllowed(response, ['GET', 'POST', 'PATCH', 'DELETE']);
}
