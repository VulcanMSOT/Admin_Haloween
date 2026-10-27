import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { prisma } from '../api/_lib/prisma.js';
import deleteTeamHandler from '../api/delete-team.js';
import { createSession } from '../api/_lib/session.js';

async function run() {
  console.log('--- Testing Admin Delete Team Functionality ---');

  // 1. Create a dummy test team with 3 members
  const testTeamName = `Test Delete Team ${Date.now()}`;
  const testTeamId = `VHK-DEL-${Math.floor(1000 + Math.random() * 9000)}`;
  const testOrderRef = `VULCAN-DEL-${Date.now()}`;
  const testPaymentRef = `PAY-DEL-${Date.now()}`;
  const testMemberEmail = `deltest_${Date.now()}@example.com`;

  const createdReg = await prisma.registration.create({
    data: {
      teamId: testTeamId,
      orderRef: testOrderRef,
      paymentRef: testPaymentRef,
      teamName: testTeamName,
      normalizedTeamName: testTeamName.toLowerCase().replace(/[^a-z0-9]/g, ''),
      amount: 300,
      listPrice: 300,
      paymentStatus: 'PENDING_REVIEW',
      utr: `UTR${Date.now()}`,
      members: {
        create: [
          {
            position: 1,
            fullName: 'Leader One',
            email: testMemberEmail,
            normalizedEmail: testMemberEmail.toLowerCase(),
            phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
            normalizedPhone: `99${Math.floor(10000000 + Math.random() * 90000000)}`.slice(0, 10),
            college: 'Test College',
          },
          {
            position: 2,
            fullName: 'Member Two',
            email: `two_${testMemberEmail}`,
            normalizedEmail: `two_${testMemberEmail}`.toLowerCase(),
            phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            normalizedPhone: `98${Math.floor(10000000 + Math.random() * 90000000)}`.slice(0, 10),
            college: 'Test College',
          },
          {
            position: 3,
            fullName: 'Member Three',
            email: `three_${testMemberEmail}`,
            normalizedEmail: `three_${testMemberEmail}`.toLowerCase(),
            phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
            normalizedPhone: `97${Math.floor(10000000 + Math.random() * 90000000)}`.slice(0, 10),
            college: 'Test College',
          },
        ],
      },
    },
    include: { members: true },
  });

  console.log('✓ Successfully created test team:', createdReg.teamName, 'ID:', createdReg.id);
  if (createdReg.members.length !== 3) {
    throw new Error(`Expected 3 members, found ${createdReg.members.length}`);
  }

  // 2. Test unauthorized delete attempt
  let unauthStatusCode = null;
  const mockUnauthReq = {
    method: 'POST',
    headers: {},
    body: { registrationId: createdReg.id },
  };
  const mockUnauthRes = {
    statusCode: 200,
    setHeader: () => {},
    end: (str) => {
      unauthStatusCode = mockUnauthRes.statusCode;
    },
  };
  await deleteTeamHandler(mockUnauthReq, mockUnauthRes);
  console.log('✓ Unauthenticated request rejected with status:', unauthStatusCode);
  if (unauthStatusCode !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${unauthStatusCode}`);
  }

  // 3. Test authorized delete using valid session cookie
  const validToken = createSession('admin-tester@vulcan.club');
  let authStatus = null;
  let authResponseBody = null;

  const mockAuthReq = {
    method: 'POST',
    headers: {
      cookie: `vulcan_admin_session=${validToken}`,
    },
    body: {
      registrationId: createdReg.id,
      reason: 'Automated test team deletion',
    },
  };
  const mockAuthRes = {
    statusCode: 200,
    setHeader: () => {},
    end: (str) => {
      authStatus = mockAuthRes.statusCode;
      try {
        authResponseBody = JSON.parse(str);
      } catch {
        authResponseBody = str;
      }
    },
  };

  await deleteTeamHandler(mockAuthReq, mockAuthRes);
  console.log('✓ Authorized delete returned status:', authStatus, authResponseBody);
  if (authStatus !== 200 || !authResponseBody.ok) {
    throw new Error(`Expected 200 OK, got ${authStatus}: ${JSON.stringify(authResponseBody)}`);
  }

  // 4. Verify database state: registration and cascading members must not exist
  const checkReg = await prisma.registration.findUnique({ where: { id: createdReg.id } });
  if (checkReg) {
    throw new Error('Registration still exists in database after delete!');
  }
  const checkMembers = await prisma.teamMember.findMany({ where: { registrationId: createdReg.id } });
  if (checkMembers.length > 0) {
    throw new Error(`Team members were not cascade deleted! Found ${checkMembers.length} rows.`);
  }
  console.log('✓ Verified: Registration and all associated members permanently removed from database.');

  // 5. Verify AuditLog
  const auditEntry = await prisma.auditLog.findFirst({
    where: {
      action: 'delete_team',
      targetId: createdReg.id,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!auditEntry) {
    throw new Error('AuditLog entry not found for delete_team action!');
  }
  console.log('✓ Verified: Audit log recorded successfully:', {
    admin: auditEntry.adminEmail,
    action: auditEntry.action,
    targetId: auditEntry.targetId,
    reason: auditEntry.details?.reason,
  });

  // 6. Test 404 when deleting already deleted team
  let notFoundStatus = null;
  const mockNotFoundRes = {
    statusCode: 200,
    setHeader: () => {},
    end: (str) => {
      notFoundStatus = mockNotFoundRes.statusCode;
    },
  };
  await deleteTeamHandler(mockAuthReq, mockNotFoundRes);
  console.log('✓ Re-deleting returns status:', notFoundStatus);
  if (notFoundStatus !== 404) {
    throw new Error(`Expected 404 for deleted team, got ${notFoundStatus}`);
  }

  console.log('\n--- ALL DELETE TEAM TESTS PASSED WITH 100% SUCCESS ---');
}

run()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
