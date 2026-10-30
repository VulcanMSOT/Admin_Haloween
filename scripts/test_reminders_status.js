import handlerRegistrations from '../api/registrations.js';
import handlerMarkReminder from '../api/mark-reminder-sent.js';
import { createSession } from '../api/_lib/session.js';

function createMockReqRes({ method = 'GET', query = {}, body = null } = {}) {
  const sessionToken = createSession('admin@vulcan.club', 'super_admin');
  const headers = {
    cookie: `vulcan_admin_session=${sessionToken}`,
    'content-type': 'application/json',
  };

  const req = {
    method,
    query,
    headers,
    body,
  };

  let responseData = null;
  const res = {
    statusCode: 200,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    setHeader: () => res,
    end: (str) => {
      if (str) {
        try {
          responseData = JSON.parse(str);
        } catch {
          responseData = str;
        }
      }
      return res;
    },
  };

  return { req, res, getResult: () => ({ statusCode: res.statusCode, data: responseData }) };
}

async function run() {
  console.log('--- 1. Testing GET /api/registrations (Baseline) ---');
  const mock1 = createMockReqRes({ method: 'GET', query: {} });
  await handlerRegistrations(mock1.req, mock1.res);
  const res1 = mock1.getResult();

  console.log('Status:', res1.statusCode);
  console.log('Stats:', {
    confirmed: res1.data.stats.confirmed,
    reminderSentCount: res1.data.stats.reminderSentCount,
    reminderPendingCount: res1.data.stats.reminderPendingCount,
  });

  const paidTeams = res1.data.registrations.filter((r) => r.paymentStatus === 'PAID');
  const sentTeams = paidTeams.filter((r) => r.reminderSent);
  const pendingTeams = paidTeams.filter((r) => !r.reminderSent);

  console.log(`Paid Teams: ${paidTeams.length}`);
  console.log(`Sent Teams: ${sentTeams.length}`);
  console.log(`Pending Teams: ${pendingTeams.length}`);

  if (sentTeams.length !== 0 || pendingTeams.length !== paidTeams.length) {
    throw new Error(`Expected 0 sent and ${paidTeams.length} pending, but got ${sentTeams.length} sent and ${pendingTeams.length} pending!`);
  }

  const sampleTeam = paidTeams[0];
  console.log(`\n--- 2. Testing Marking Team ${sampleTeam.teamId} (${sampleTeam.teamName}) as SENT ---`);
  const mock2 = createMockReqRes({
    method: 'POST',
    body: { registrationId: sampleTeam.id, status: 'sent' },
  });
  await handlerMarkReminder(mock2.req, mock2.res);
  const res2 = mock2.getResult();
  console.log('Mark Sent Result:', res2.data);

  console.log('\n--- 3. Verifying registrations reflects 1 sent, 29 pending ---');
  const mock3 = createMockReqRes({ method: 'GET', query: {} });
  await handlerRegistrations(mock3.req, mock3.res);
  const res3 = mock3.getResult();
  const paidTeams3 = res3.data.registrations.filter((r) => r.paymentStatus === 'PAID');
  const sentTeams3 = paidTeams3.filter((r) => r.reminderSent);
  const pendingTeams3 = paidTeams3.filter((r) => !r.reminderSent);
  console.log(`Paid: ${paidTeams3.length}, Sent: ${sentTeams3.length}, Pending: ${pendingTeams3.length}`);

  if (sentTeams3.length !== 1 || pendingTeams3.length !== paidTeams3.length - 1) {
    throw new Error(`Expected 1 sent and 29 pending, got ${sentTeams3.length} sent`);
  }

  console.log(`\n--- 4. Testing Resetting All Reminders to PENDING ---`);
  const mock4 = createMockReqRes({
    method: 'POST',
    body: { action: 'reset_all' },
  });
  await handlerMarkReminder(mock4.req, mock4.res);
  const res4 = mock4.getResult();
  console.log('Reset All Result:', res4.data);

  console.log('\n--- 5. Final Verification (All 30 Confirmed Teams Pending Reminder) ---');
  const mock5 = createMockReqRes({ method: 'GET', query: {} });
  await handlerRegistrations(mock5.req, mock5.res);
  const res5 = mock5.getResult();
  const paidTeams5 = res5.data.registrations.filter((r) => r.paymentStatus === 'PAID');
  const sentTeams5 = paidTeams5.filter((r) => r.reminderSent);
  const pendingTeams5 = paidTeams5.filter((r) => !r.reminderSent);
  console.log(`Final Counts -> Paid: ${paidTeams5.length}, Sent: ${sentTeams5.length}, Pending: ${pendingTeams5.length}`);

  if (sentTeams5.length !== 0 || pendingTeams5.length !== 30) {
    throw new Error('Final reset check failed!');
  }

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Everything is 100% correct.');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
