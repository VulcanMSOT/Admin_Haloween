import assert from 'node:assert';
import { prisma } from '../api/_lib/prisma.js';
import referralsAdminHandler from '../api/referrals-admin.js';
import { createSession } from '../api/_lib/session.js';

function createMockReqRes({ method = 'GET', url = '/api/referrals-admin', body = null, token = null }) {
  let statusCode = 200;
  let headers = {};
  let bodyData = null;

  const req = {
    method,
    url,
    headers: {
      host: 'localhost',
      ...(token ? { cookie: `vulcan_admin_session=${token}` } : {}),
    },
    body,
  };

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(code) {
      statusCode = code;
    },
    setHeader(key, val) {
      headers[key.toLowerCase()] = val;
    },
    getHeader(key) {
      return headers[key.toLowerCase()];
    },
    end(data) {
      if (data) {
        try {
          bodyData = JSON.parse(data);
        } catch {
          bodyData = data;
        }
      }
    },
  };

  return { req, res, getStatusCode: () => statusCode, getBody: () => bodyData };
}

async function runTests() {
  console.log('--- Starting Admin Referrals Verification Tests ---');

  const adminToken = createSession('super-admin@vulcan.org');
  const rand = Math.floor(100000 + Math.random() * 900000);

  // -------------------------------------------------------------
  // Test 1: Unauthenticated request rejected with 401
  // -------------------------------------------------------------
  {
    const { req, res, getStatusCode } = createMockReqRes({ method: 'GET' });
    await referralsAdminHandler(req, res);
    assert.strictEqual(getStatusCode(), 401);
    console.log('✓ Test 1 Passed: Unauthenticated request rejected with 401');
  }

  // -------------------------------------------------------------
  // Test 2: Add single Vulcan club member
  // -------------------------------------------------------------
  const clubEmail = `club_lead_${rand}@vulcan.org`;
  let clubReferrer = null;
  {
    const { req, res, getStatusCode, getBody } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: {
        action: 'add_club_member',
        name: 'Aditi Sharma',
        email: clubEmail,
        phone: '9876543210',
      },
    });
    await referralsAdminHandler(req, res);
    assert.strictEqual(getStatusCode(), 200);
    const body = getBody();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.referrer.email, clubEmail.toLowerCase());
    assert.strictEqual(body.referrer.type, 'club_member');
    assert.strictEqual(body.referrer.active, true);
    assert.ok(body.referrer.code.startsWith('ADIT-') || body.referrer.code.startsWith('REF-'));
    clubReferrer = body.referrer;
    console.log('✓ Test 2 Passed: Single Vulcan club member added with active code:', clubReferrer.code);
  }

  // -------------------------------------------------------------
  // Test 3: Duplicate club member addition returns 400 error
  // -------------------------------------------------------------
  {
    const { req, res, getStatusCode, getBody } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: {
        action: 'add_club_member',
        name: 'Aditi Sharma Duplicate',
        email: clubEmail,
      },
    });
    await referralsAdminHandler(req, res);
    assert.strictEqual(getStatusCode(), 400);
    assert.ok(getBody().error.includes('already exists'));
    console.log('✓ Test 3 Passed: Duplicate club member returns 400 error');
  }

  // -------------------------------------------------------------
  // Test 4: Existing Mirai student upgraded to type "both" when added as club member
  // -------------------------------------------------------------
  const miraiEmail = `mirai_dual_${rand}@mirai.edu.in`;
  const existingMirai = await prisma.referrer.create({
    data: {
      name: 'Dual Member',
      email: miraiEmail.toLowerCase(),
      type: 'mirai_student',
      code: `DUAL-${rand}`,
      active: true,
    },
  });

  {
    const { req, res, getStatusCode, getBody } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: {
        action: 'add_club_member',
        name: 'Dual Member',
        email: miraiEmail,
        phone: '9988776655',
      },
    });
    await referralsAdminHandler(req, res);
    assert.strictEqual(getStatusCode(), 200);
    const body = getBody();
    assert.strictEqual(body.referrer.type, 'both');
    assert.strictEqual(body.referrer.id, existingMirai.id);
    console.log('✓ Test 4 Passed: Mirai student upgraded to type "both"');
  }

  // -------------------------------------------------------------
  // Test 5: Bulk import club members (adds new, upgrades Mirai, skips existing)
  // -------------------------------------------------------------
  const bulkNewEmail = `bulk_new_${rand}@test.com`;
  {
    const { req, res, getStatusCode, getBody } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: {
        action: 'import_club_members',
        members: [
          { name: 'Bulk New Member', email: bulkNewEmail, phone: '9123456780' },
          { name: 'Aditi Sharma', email: clubEmail, phone: '9876543210' }, // Existing club member -> skipped
          { name: 'Dual Member', email: miraiEmail, phone: '9988776655' }, // Already both -> skipped
        ],
      },
    });
    await referralsAdminHandler(req, res);
    assert.strictEqual(getStatusCode(), 200);
    const body = getBody();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.summary.added, 1);
    assert.strictEqual(body.summary.skipped, 2);
    console.log('✓ Test 5 Passed: Bulk import correctly added 1 and skipped 2');
  }

  // -------------------------------------------------------------
  // Test 6: Deactivate and Reactivate referrer (with reason validation)
  // -------------------------------------------------------------
  {
    // 6a: Reject if reason missing when deactivating
    const { req: reqNoReason, res: resNoReason, getStatusCode: getStatusNoReason } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: {
        action: 'toggle_active',
        referrerId: clubReferrer.id,
        active: false,
      },
    });
    await referralsAdminHandler(reqNoReason, resNoReason);
    assert.strictEqual(getStatusNoReason(), 400);

    // 6b: Deactivate with reason
    const { req: reqDeact, res: resDeact, getStatusCode: getStatusDeact, getBody: getBodyDeact } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: {
        action: 'toggle_active',
        referrerId: clubReferrer.id,
        active: false,
        reason: 'Temporary hold on marketing outreach',
      },
    });
    await referralsAdminHandler(reqDeact, resDeact);
    assert.strictEqual(getStatusDeact(), 200);
    assert.strictEqual(getBodyDeact().referrer.active, false);
    assert.strictEqual(getBodyDeact().referrer.deactivatedReason, 'Temporary hold on marketing outreach');

    // 6c: Reactivate
    const { req: reqReact, res: resReact, getStatusCode: getStatusReact, getBody: getBodyReact } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: {
        action: 'toggle_active',
        referrerId: clubReferrer.id,
        active: true,
      },
    });
    await referralsAdminHandler(reqReact, resReact);
    assert.strictEqual(getStatusReact(), 200);
    assert.strictEqual(getBodyReact().referrer.active, true);
    assert.strictEqual(getBodyReact().referrer.deactivatedReason, null);
    console.log('✓ Test 6 Passed: Deactivation requires reason; reactivation restores active state');
  }

  // -------------------------------------------------------------
  // Test 7: Reissue referral code
  // -------------------------------------------------------------
  const oldCode = clubReferrer.code;
  {
    const { req, res, getStatusCode, getBody } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: {
        action: 'reissue_code',
        referrerId: clubReferrer.id,
        reason: 'Previous code was leaked on public Discord',
      },
    });
    await referralsAdminHandler(req, res);
    assert.strictEqual(getStatusCode(), 200);
    const body = getBody();
    assert.strictEqual(body.ok, true);
    assert.notStrictEqual(body.referrer.code, oldCode);
    console.log(`✓ Test 7 Passed: Referral code reissued from ${oldCode} to ${body.referrer.code}`);
  }

  // -------------------------------------------------------------
  // Test 8: Leaderboard tie-breaking (equal count sorted by earliest confirmed referral)
  // -------------------------------------------------------------
  // Create Referrer A and Referrer B
  const refA = await prisma.referrer.create({
    data: { name: `A Ranker ${rand}`, email: `ref_a_${rand}@test.com`, code: `REFA-${rand}`, type: 'club_member', active: true },
  });
  const refB = await prisma.referrer.create({
    data: { name: `B Ranker ${rand}`, email: `ref_b_${rand}@test.com`, code: `REFB-${rand}`, type: 'club_member', active: true },
  });

  // Create dummy registrations for referred teams
  const reg1 = await prisma.registration.create({
    data: { teamId: `T1-${rand}`, paymentRef: `P1-${rand}`, teamName: `T1 ${rand}`, normalizedTeamName: `t1${rand}`, amount: 300, listPrice: 300, paymentStatus: 'PAID' },
  });
  const reg2 = await prisma.registration.create({
    data: { teamId: `T2-${rand}`, paymentRef: `P2-${rand}`, teamName: `T2 ${rand}`, normalizedTeamName: `t2${rand}`, amount: 300, listPrice: 300, paymentStatus: 'PAID' },
  });

  // Both have 1 confirmed referral.
  // Referrer B has an EARLIER confirmedAt date (10:00 AM) than Referrer A (12:00 PM).
  const earlyTime = new Date('2026-10-31T10:00:00Z');
  const lateTime = new Date('2026-10-31T12:00:00Z');

  await prisma.referral.create({
    data: { referrerId: refB.id, referredTeamId: reg1.id, status: 'confirmed', confirmedAt: earlyTime },
  });
  await prisma.referral.create({
    data: { referrerId: refA.id, referredTeamId: reg2.id, status: 'confirmed', confirmedAt: lateTime },
  });

  {
    const { req, res, getStatusCode, getBody } = createMockReqRes({
      method: 'GET',
      token: adminToken,
    });
    await referralsAdminHandler(req, res);
    assert.strictEqual(getStatusCode(), 200);
    const body = getBody();
    assert.ok(body.leaderboard && body.leaderboard.length > 0);

    const posB = body.leaderboard.findIndex((r) => r.id === refB.id);
    const posA = body.leaderboard.findIndex((r) => r.id === refA.id);

    assert.ok(posB !== -1 && posA !== -1, 'Both referrers found in leaderboard');
    assert.ok(posB < posA, `Referrer B (earlier confirmedAt) ranks higher (${posB + 1}) than Referrer A (${posA + 1})`);
    console.log(`✓ Test 8 Passed: Tie-breaking verified: Referrer B (earliest: ${earlyTime.toISOString()}) placed at #${posB + 1} ahead of Referrer A (#${posA + 1})`);
  }

  // -------------------------------------------------------------
  // Test 9: Manual referral status override
  // -------------------------------------------------------------
  const refRecord = await prisma.referral.findFirst({
    where: { referrerId: refA.id },
  });

  {
    const { req, res, getStatusCode, getBody } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: {
        action: 'manual_override',
        referralId: refRecord.id,
        status: 'reversed',
        reason: 'Organizer audit detected disqualified team',
      },
    });
    await referralsAdminHandler(req, res);
    assert.strictEqual(getStatusCode(), 200);
    const body = getBody();
    assert.strictEqual(body.referral.status, 'reversed');
    assert.strictEqual(body.referral.reversedReason, 'Organizer audit detected disqualified team');
    console.log('✓ Test 9 Passed: Manual referral override successfully updated status to reversed with reason');
  }

  // -------------------------------------------------------------
  // Test 10: CSV Exports (Leaderboard & All Referrals)
  // -------------------------------------------------------------
  {
    // 10a: Leaderboard CSV
    const { req: reqLead, res: resLead, getStatusCode: getStatusLead, getBody: getBodyLead } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: { action: 'export_csv', exportType: 'leaderboard' },
    });
    await referralsAdminHandler(reqLead, resLead);
    assert.strictEqual(getStatusLead(), 200);
    assert.ok(getBodyLead().csvContent.includes('Confirmed Referrals'));
    assert.ok(getBodyLead().csvContent.includes('Aditi Sharma'));

    // 10b: All Referrals CSV
    const { req: reqRefs, res: resRefs, getStatusCode: getStatusRefs, getBody: getBodyRefs } = createMockReqRes({
      method: 'POST',
      token: adminToken,
      body: { action: 'export_csv', exportType: 'all_referrals' },
    });
    await referralsAdminHandler(reqRefs, resRefs);
    assert.strictEqual(getStatusRefs(), 200);
    assert.ok(getBodyRefs().csvContent.includes('Referral ID'));
    assert.ok(getBodyRefs().csvContent.includes('Payment Status'));

    console.log('✓ Test 10 Passed: Both CSV export formats generated valid CSV payloads');
  }

  // -------------------------------------------------------------
  // Test 11: Audit log entries written for admin actions
  // -------------------------------------------------------------
  const logs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          'add_club_member_referrer',
          'upgrade_referrer_to_both',
          'import_club_members',
          'deactivate_referrer',
          'reactivate_referrer',
          'reissue_referrer_code',
          'manual_referral_override',
        ],
      },
    },
    take: 10,
  });
  assert.ok(logs.length >= 5, `Expected at least 5 audit log entries, found ${logs.length}`);
  console.log(`✓ Test 11 Passed: Audit logs recorded for admin actions (${logs.length} found)`);

  console.log('\n--- ALL ADMIN REFERRAL TESTS PASSED SUCCESSFULLY ---');
}

runTests()
  .catch((err) => {
    console.error('Admin Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
