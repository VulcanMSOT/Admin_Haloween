import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function clean(val) {
  return String(val || '').trim();
}

export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.slice(-10);
}

function hashSecret(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

export function normalizeReferralCode(code) {
  return String(code || '').trim().toUpperCase();
}

export function generateReferralCode(name = '') {
  const cleanName = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
  const prefix = cleanName.length >= 2 ? cleanName : 'REF';
  const randomPart = Array.from(randomBytes(4), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  return `${prefix}-${randomPart}`;
}

export async function generateUniqueReferralCode(name = '', tx = prisma) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateReferralCode(name);
    const existing = await tx.referrer.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  const randomSuffix = Array.from(randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  return `REF-${randomSuffix}`;
}

export async function checkReferralRateLimit(ip) {
  if (!ip) return { ok: true };
  const key = `ref_check:${ip}`;
  const now = new Date();
  const windowMs = 10 * 60 * 1000;
  const maxAttempts = 5;

  try {
    const record = await prisma.registrationRateLimit.findUnique({
      where: { key },
    });

    if (!record) {
      return { ok: true, record: null };
    }

    const elapsed = now.getTime() - new Date(record.windowStarted).getTime();
    if (elapsed > windowMs) {
      await prisma.registrationRateLimit.delete({ where: { key } }).catch(() => {});
      return { ok: true, record: null };
    }

    if (record.attempts >= maxAttempts) {
      return {
        ok: false,
        error: 'Too many attempts. Please try again later.',
      };
    }

    return { ok: true, record };
  } catch (err) {
    console.warn('Referral rate limit check error:', err.message);
    return { ok: true };
  }
}

export async function recordFailedReferralAttempt(ip) {
  if (!ip) return;
  const key = `ref_check:${ip}`;
  const now = new Date();
  const windowMs = 10 * 60 * 1000;

  try {
    const record = await prisma.registrationRateLimit.findUnique({
      where: { key },
    });

    if (!record || now.getTime() - new Date(record.windowStarted).getTime() > windowMs) {
      await prisma.registrationRateLimit.upsert({
        where: { key },
        create: {
          key,
          windowStarted: now,
          attempts: 1,
        },
        update: {
          windowStarted: now,
          attempts: 1,
        },
      });
    } else {
      await prisma.registrationRateLimit.update({
        where: { key },
        data: {
          attempts: { increment: 1 },
        },
      });
    }
  } catch (err) {
    console.warn('Could not record failed referral attempt:', err.message);
  }
}

export async function clearReferralRateLimit(ip) {
  if (!ip) return;
  const key = `ref_check:${ip}`;
  try {
    await prisma.registrationRateLimit.delete({ where: { key } }).catch(() => {});
  } catch {}
}

export async function validateReferralCode(rawCode, options = {}) {
  const code = normalizeReferralCode(rawCode);
  if (!code) {
    return { valid: false, error: "That referral code isn't valid." };
  }

  const settings = await prisma.eventSettings.findFirst({
    where: { id: 'default' },
  });
  if (settings && settings.referralProgramActive === false) {
    return { valid: false, error: "That referral code isn't valid." };
  }

  const referrer = await prisma.referrer.findFirst({
    where: {
      code,
      active: true,
    },
  });

  if (!referrer) {
    return { valid: false, error: "That referral code isn't valid." };
  }

  if (options.teamMembers && Array.isArray(options.teamMembers)) {
    const refEmail = referrer.email.toLowerCase();
    const refPhone = referrer.phone ? normalizePhone(referrer.phone) : null;

    for (const m of options.teamMembers) {
      const memberEmail = String(m.email || '').trim().toLowerCase();
      const memberPhone = m.phone ? normalizePhone(m.phone) : null;

      if (memberEmail && memberEmail === refEmail) {
        return { valid: false, error: "That referral code isn't valid." };
      }
      if (refPhone && memberPhone && memberPhone === refPhone) {
        return { valid: false, error: "That referral code isn't valid." };
      }
    }
  }

  if (options.registrationId && referrer.sourceTeamId === options.registrationId) {
    return { valid: false, error: "That referral code isn't valid." };
  }

  return {
    valid: true,
    referrerId: referrer.id,
    code: referrer.code,
    referrer,
  };
}

export async function ensureMiraiReferrersForRegistration(registrationId, tx = prisma) {
  const reg = await tx.registration.findUnique({
    where: { id: registrationId },
    include: { members: { orderBy: { position: 'asc' } } },
  });
  if (!reg) return [];

  const settings = await tx.eventSettings.findFirst({ where: { id: 'default' } });
  const eligibleCollege = settings?.eligibleCollegeName || 'Mirai School of Technology';

  const createdReferrers = [];

  for (const member of reg.members) {
    if (member.college === eligibleCollege) {
      const email = member.normalizedEmail.toLowerCase();
      let referrer = await tx.referrer.findUnique({
        where: { email },
      });

      if (!referrer) {
        const code = await generateUniqueReferralCode(member.fullName, tx);
        referrer = await tx.referrer.create({
          data: {
            name: member.fullName,
            email,
            phone: member.normalizedPhone,
            type: 'mirai_student',
            code,
            active: true,
            sourceTeamId: reg.id,
          },
        });
        createdReferrers.push(referrer);
      } else {
        const newType = referrer.type === 'club_member' ? 'both' : referrer.type;
        const updated = await tx.referrer.update({
          where: { id: referrer.id },
          data: {
            type: newType,
            active: true,
            sourceTeamId: referrer.sourceTeamId || reg.id,
          },
        });
        createdReferrers.push(updated);
      }
    }
  }

  return createdReferrers;
}

export async function confirmTeamReferral(registrationId, tx = prisma) {
  const referral = await tx.referral.findUnique({
    where: { referredTeamId: registrationId },
  });

  if (referral) {
    return await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        reversedAt: null,
      },
    });
  }
  return null;
}

export async function reverseTeamReferral(registrationId, tx = prisma) {
  const referral = await tx.referral.findUnique({
    where: { referredTeamId: registrationId },
  });

  if (referral && referral.status === 'confirmed') {
    return await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: 'reversed',
        reversedAt: new Date(),
      },
    });
  }
  return null;
}
