import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';
import { generateUniqueReferralCode, normalizePhone } from './_lib/referral.js';

export default async function handler(request, response) {
  if (handleCors(request, response, ['GET', 'POST', 'OPTIONS'])) return;

  const session = requireSession(request, response);
  if (!session) return;

  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET') {
    const referrerId = url.searchParams.get('referrerId');

    // Drill-down for a single referrer's referrals
    if (referrerId) {
      try {
        const referrer = await prisma.referrer.findUnique({
          where: { id: referrerId },
          include: {
            referrals: {
              orderBy: { createdAt: 'desc' },
              include: {
                referredTeam: {
                  select: {
                    id: true,
                    teamName: true,
                    teamId: true,
                    orderRef: true,
                    paymentStatus: true,
                    amount: true,
                    createdAt: true,
                    paymentApprovedAt: true,
                    members: {
                      where: { position: 1 },
                      select: { fullName: true, email: true, phone: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (!referrer) {
          return json(response, 404, { error: 'Referrer not found.' });
        }

        return json(response, 200, { ok: true, referrer });
      } catch (error) {
        console.error('Referrer drill-down error:', error);
        return json(response, 500, { error: 'Could not fetch referrer details.' });
      }
    }

    // Default: Summary & Leaderboard
    try {
      const referrers = await prisma.referrer.findMany({
        include: {
          referrals: {
            select: {
              id: true,
              status: true,
              confirmedAt: true,
              createdAt: true,
            },
          },
        },
      });

      let totalConfirmed = 0;
      let totalPending = 0;
      let totalReversed = 0;

      const processedReferrers = referrers.map((ref) => {
        const confirmed = ref.referrals.filter((r) => r.status === 'confirmed');
        const pending = ref.referrals.filter((r) => r.status === 'pending');
        const reversed = ref.referrals.filter((r) => r.status === 'reversed');

        totalConfirmed += confirmed.length;
        totalPending += pending.length;
        totalReversed += reversed.length;

        let earliestConfirmedAt = null;
        for (const r of confirmed) {
          if (r.confirmedAt) {
            const time = new Date(r.confirmedAt).getTime();
            if (!earliestConfirmedAt || time < earliestConfirmedAt) {
              earliestConfirmedAt = time;
            }
          }
        }

        return {
          id: ref.id,
          name: ref.name,
          email: ref.email,
          phone: ref.phone,
          code: ref.code,
          type: ref.type,
          active: ref.active,
          deactivatedAt: ref.deactivatedAt,
          deactivatedReason: ref.deactivatedReason,
          sourceTeamId: ref.sourceTeamId,
          createdAt: ref.createdAt,
          confirmedCount: confirmed.length,
          pendingCount: pending.length,
          reversedCount: reversed.length,
          totalCount: ref.referrals.length,
          earliestConfirmedAt: earliestConfirmedAt ? new Date(earliestConfirmedAt).toISOString() : null,
          _earliestTime: earliestConfirmedAt || Infinity,
        };
      });

      // Tie-breaker sorting:
      // 1. confirmedCount DESC
      // 2. earliestConfirmedAt ASC (earlier timestamp is better)
      // 3. createdAt ASC
      // 4. name ASC
      processedReferrers.sort((a, b) => {
        if (b.confirmedCount !== a.confirmedCount) {
          return b.confirmedCount - a.confirmedCount;
        }
        if (a._earliestTime !== b._earliestTime) {
          return a._earliestTime - b._earliestTime;
        }
        const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.name.localeCompare(b.name);
      });

      const totalPaidRegistrations = await prisma.registration.count({
        where: { paymentStatus: 'PAID' },
      });

      const confirmedTeamsFromReferrals = await prisma.referral.count({
        where: {
          status: 'confirmed',
          referredTeam: { paymentStatus: 'PAID' },
        },
      });

      const conversionRate = totalPaidRegistrations > 0
        ? ((confirmedTeamsFromReferrals / totalPaidRegistrations) * 100).toFixed(1)
        : '0.0';

      return json(response, 200, {
        summary: {
          totalReferrers: referrers.length,
          activeReferrers: referrers.filter((r) => r.active).length,
          deactivatedReferrers: referrers.filter((r) => !r.active).length,
          clubMembersCount: referrers.filter((r) => r.type === 'club_member' || r.type === 'both').length,
          miraiStudentsCount: referrers.filter((r) => r.type === 'mirai_student' || r.type === 'both').length,
          totalReferrals: {
            confirmed: totalConfirmed,
            pending: totalPending,
            reversed: totalReversed,
            total: totalConfirmed + totalPending + totalReversed,
          },
          totalPaidRegistrations,
          confirmedTeamsFromReferrals,
          conversionRate: `${conversionRate}%`,
        },
        leaderboard: processedReferrers.map(({ _earliestTime, ...item }, index) => ({
          rank: index + 1,
          ...item,
        })),
      });
    } catch (error) {
      console.error('Referrals admin summary error:', error);
      return json(response, 500, { error: 'Could not fetch referral leaderboard and stats.' });
    }
  }

  if (request.method === 'POST') {
    const body = parseBody(request);
    const { action } = body;

    // 1. ADD SINGLE VULCAN CLUB MEMBER
    if (action === 'add_club_member') {
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const rawPhone = String(body.phone || '').trim();
      const phone = rawPhone ? normalizePhone(rawPhone) : null;

      if (!name) return json(response, 400, { error: 'Member name is required.' });
      if (!email || !email.includes('@')) return json(response, 400, { error: 'A valid email is required.' });

      try {
        const existing = await prisma.referrer.findUnique({ where: { email } });

        if (existing) {
          if (existing.type === 'club_member' || existing.type === 'both') {
            return json(response, 400, { error: 'A club member with this email address already exists.' });
          }
          // If existing as mirai_student, upgrade to 'both'
          const updated = await prisma.referrer.update({
            where: { id: existing.id },
            data: {
              type: 'both',
              active: true,
              ...(phone ? { phone } : {}),
            },
          });

          await logAdminAction({
            adminEmail: session.email,
            action: 'upgrade_referrer_to_both',
            targetId: updated.id,
            details: { name: updated.name, email: updated.email, code: updated.code },
          });

          return json(response, 200, {
            ok: true,
            referrer: updated,
            message: `${name} is already registered as a Mirai student. Their status has been updated to Club Member & Mirai Student.`,
          });
        }

        const code = await generateUniqueReferralCode(name);
        const created = await prisma.referrer.create({
          data: {
            name,
            email,
            phone,
            code,
            type: 'club_member',
            active: true,
          },
        });

        await logAdminAction({
          adminEmail: session.email,
          action: 'add_club_member_referrer',
          targetId: created.id,
          details: { name: created.name, email: created.email, code: created.code },
        });

        return json(response, 200, {
          ok: true,
          referrer: created,
          message: `Club member ${name} added with referral code ${code}.`,
        });
      } catch (err) {
        console.error('Add club member error:', err);
        return json(response, 500, { error: 'Could not add club member.' });
      }
    }

    // 2. BULK IMPORT CLUB MEMBERS (from CSV / array)
    if (action === 'import_club_members') {
      const members = Array.isArray(body.members) ? body.members : [];
      if (!members.length) {
        return json(response, 400, { error: 'No members provided for import.' });
      }

      let added = 0;
      let upgraded = 0;
      let skipped = 0;
      const errors = [];

      for (let i = 0; i < members.length; i++) {
        const item = members[i];
        const name = String(item.name || '').trim();
        const email = String(item.email || '').trim().toLowerCase();
        const rawPhone = String(item.phone || '').trim();
        const phone = rawPhone ? normalizePhone(rawPhone) : null;

        if (!name || !email || !email.includes('@')) {
          errors.push(`Row ${i + 1}: Invalid name or email (${email || 'missing'}).`);
          continue;
        }

        try {
          const existing = await prisma.referrer.findUnique({ where: { email } });
          if (existing) {
            if (existing.type === 'mirai_student') {
              await prisma.referrer.update({
                where: { id: existing.id },
                data: { type: 'both', active: true, ...(phone ? { phone } : {}) },
              });
              upgraded++;
            } else {
              skipped++;
            }
          } else {
            const code = await generateUniqueReferralCode(name);
            await prisma.referrer.create({
              data: {
                name,
                email,
                phone,
                code,
                type: 'club_member',
                active: true,
              },
            });
            added++;
          }
        } catch (itemErr) {
          errors.push(`Row ${i + 1} (${email}): ${itemErr.message}`);
        }
      }

      await logAdminAction({
        adminEmail: session.email,
        action: 'import_club_members',
        targetId: null,
        details: { totalRows: members.length, added, upgraded, skipped, errorCount: errors.length },
      });

      return json(response, 200, {
        ok: true,
        summary: { added, upgraded, skipped, errors },
        message: `Import complete: ${added} added, ${upgraded} updated to both, ${skipped} already existed.`,
      });
    }

    // 3. TOGGLE ACTIVE / DEACTIVATE REFERRER
    if (action === 'toggle_active') {
      const { referrerId, active, reason } = body;
      if (!referrerId) return json(response, 400, { error: 'Referrer ID is required.' });

      const cleanReason = String(reason || '').trim();
      if (!active && !cleanReason) {
        return json(response, 400, { error: 'A reason is required to deactivate a referrer.' });
      }

      try {
        const updated = await prisma.referrer.update({
          where: { id: referrerId },
          data: {
            active: Boolean(active),
          },
        });

        await logAdminAction({
          adminEmail: session.email,
          action: active ? 'reactivate_referrer' : 'deactivate_referrer',
          targetId: updated.id,
          details: { name: updated.name, code: updated.code, active: updated.active, reason: cleanReason },
        });

        return json(response, 200, {
          ok: true,
          referrer: {
            ...updated,
            deactivatedReason: active ? null : cleanReason,
          },
          message: active ? `${updated.name}'s referral code has been reactivated.` : `${updated.name}'s referral code has been deactivated.`,
        });
      } catch (err) {
        console.error('Toggle active error:', err);
        return json(response, 500, { error: 'Could not update referrer status.' });
      }
    }

    // 4. REISSUE CODE (if compromised)
    if (action === 'reissue_code') {
      const { referrerId, reason } = body;
      if (!referrerId) return json(response, 400, { error: 'Referrer ID is required.' });

      const cleanReason = String(reason || '').trim();
      if (!cleanReason) {
        return json(response, 400, { error: 'A reason is required to reissue a referral code.' });
      }

      try {
        const existing = await prisma.referrer.findUnique({ where: { id: referrerId } });
        if (!existing) return json(response, 404, { error: 'Referrer not found.' });

        const oldCode = existing.code;
        const newCode = await generateUniqueReferralCode(existing.name);

        const updated = await prisma.referrer.update({
          where: { id: referrerId },
          data: { code: newCode },
        });

        await logAdminAction({
          adminEmail: session.email,
          action: 'reissue_referrer_code',
          targetId: updated.id,
          details: { oldCode, newCode, reason: cleanReason },
        });

        return json(response, 200, {
          ok: true,
          referrer: updated,
          message: `Referral code for ${updated.name} updated from ${oldCode} to ${newCode}.`,
        });
      } catch (err) {
        console.error('Reissue code error:', err);
        return json(response, 500, { error: 'Could not reissue referral code.' });
      }
    }

    // 5. MANUAL REFERRAL OVERRIDE (Confirm / Reverse / Reinstate)
    if (action === 'manual_override') {
      const { referralId, status, reason } = body;
      if (!referralId || !['confirmed', 'reversed', 'pending'].includes(status)) {
        return json(response, 400, { error: 'Invalid referral ID or status.' });
      }

      const cleanReason = String(reason || '').trim();
      if (!cleanReason) {
        return json(response, 400, { error: 'A reason is required for manual referral override.' });
      }

      try {
        const existing = await prisma.referral.findUnique({
          where: { id: referralId },
          include: { referrer: true, referredTeam: true },
        });

        if (!existing) return json(response, 404, { error: 'Referral record not found.' });

        const updated = await prisma.referral.update({
          where: { id: referralId },
          data: {
            status,
            confirmedAt: status === 'confirmed' ? (existing.confirmedAt || new Date()) : null,
            reversedAt: status === 'reversed' ? new Date() : null,
          },
        });

        await logAdminAction({
          adminEmail: session.email,
          action: 'manual_referral_override',
          targetId: updated.id,
          details: {
            previousStatus: existing.status,
            newStatus: status,
            referrerCode: existing.referrer.code,
            teamId: existing.referredTeam.teamId || existing.referredTeam.id,
            reason: cleanReason,
          },
        });

        return json(response, 200, {
          ok: true,
          referral: {
            ...updated,
            reversedReason: status === 'reversed' ? cleanReason : null,
          },
          message: `Referral status manually updated to ${status}.`,
        });
      } catch (err) {
        console.error('Manual override error:', err);
        return json(response, 500, { error: 'Could not apply manual override.' });
      }
    }

    // 6. CSV EXPORTS
    if (action === 'export_csv') {
      const type = String(body.exportType || 'leaderboard');

      try {
        if (type === 'leaderboard') {
          const referrers = await prisma.referrer.findMany({
            include: {
              referrals: {
                select: { status: true, confirmedAt: true },
              },
            },
          });

          const rows = referrers.map((ref) => {
            const confirmed = ref.referrals.filter((r) => r.status === 'confirmed').length;
            const pending = ref.referrals.filter((r) => r.status === 'pending').length;
            const reversed = ref.referrals.filter((r) => r.status === 'reversed').length;
            return {
              Name: ref.name,
              Email: ref.email,
              Phone: ref.phone || '',
              Code: ref.code,
              Type: ref.type,
              Active: ref.active ? 'Yes' : 'No',
              'Confirmed Referrals': confirmed,
              'Pending Referrals': pending,
              'Reversed Referrals': reversed,
              'Total Referrals': ref.referrals.length,
              'Created At': new Date(ref.createdAt).toISOString(),
            };
          });

          // Sort by confirmed referrals desc
          rows.sort((a, b) => b['Confirmed Referrals'] - a['Confirmed Referrals']);

          const headers = Object.keys(rows[0] || {
            Name: '', Email: '', Phone: '', Code: '', Type: '', Active: '', 'Confirmed Referrals': 0, 'Pending Referrals': 0, 'Reversed Referrals': 0, 'Total Referrals': 0, 'Created At': '',
          });

          const csvContent = [
            headers.join(','),
            ...rows.map((row) =>
              headers.map((h) => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
            ),
          ].join('\n');

          return json(response, 200, { ok: true, csvContent, filename: `referrals-leaderboard-${Date.now()}.csv` });
        }

        if (type === 'all_referrals') {
          const referrals = await prisma.referral.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
              referrer: true,
              referredTeam: {
                include: {
                  members: { where: { position: 1 } },
                },
              },
            },
          });

          const rows = referrals.map((r) => {
            const leader = r.referredTeam.members[0];
            return {
              'Referral ID': r.id,
              Status: r.status,
              'Referrer Name': r.referrer.name,
              'Referrer Email': r.referrer.email,
              'Referrer Code': r.referrer.code,
              'Referrer Type': r.referrer.type,
              'Team ID': r.referredTeam.teamId || r.referredTeam.orderRef || '',
              'Team Name': r.referredTeam.teamName,
              'Leader Name': leader?.fullName || '',
              'Leader Email': leader?.email || '',
              'Payment Status': r.referredTeam.paymentStatus,
              Amount: r.referredTeam.amount,
              'Created At': new Date(r.createdAt).toISOString(),
              'Confirmed At': r.confirmedAt ? new Date(r.confirmedAt).toISOString() : '',
              'Reversed At': r.reversedAt ? new Date(r.reversedAt).toISOString() : '',
            };
          });

          const headers = Object.keys(rows[0] || {
            'Referral ID': '', Status: '', 'Referrer Name': '', 'Referrer Email': '', 'Referrer Code': '', 'Referrer Type': '', 'Team ID': '', 'Team Name': '', 'Leader Name': '', 'Leader Email': '', 'Payment Status': '', Amount: 0, 'Created At': '', 'Confirmed At': '', 'Reversed At': '',
          });

          const csvContent = [
            headers.join(','),
            ...rows.map((row) =>
              headers.map((h) => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
            ),
          ].join('\n');

          return json(response, 200, { ok: true, csvContent, filename: `all-referrals-${Date.now()}.csv` });
        }

        return json(response, 400, { error: 'Unknown export type.' });
      } catch (err) {
        console.error('Export CSV error:', err);
        return json(response, 500, { error: 'Could not export referrals CSV.' });
      }
    }

    return json(response, 400, { error: 'Unknown action.' });
  }

  return methodNotAllowed(response, ['GET', 'POST']);
}
