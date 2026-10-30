import { prisma } from '../api/_lib/prisma.js';
import { createSession } from '../api/_lib/session.js';
import checkinHandler from '../api/checkin.js';
import exportHandler from '../api/export.js';

function createMockResponse() {
  let statusCode = 200;
  let headers = {};
  let body = null;
  return {
    get statusCode() { return statusCode; },
    set statusCode(code) { statusCode = code; },
    setHeader(key, value) { headers[key] = value; },
    getHeader(key) { return headers[key]; },
    end(data) { body = data; },
    json(code, data) {
      statusCode = code;
      body = data;
    },
    _getData() {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    },
    _getHeaders() { return headers; },
  };
}

async function run() {
  console.log('=== TESTING CHECKIN & EXPORT APIS ===\n');

  // Find a confirmed team to test with
  const testTeam = await prisma.registration.findFirst({
    where: { paymentStatus: 'PAID' },
    select: { id: true, teamId: true, teamName: true, checkedInAt: true },
  });

  if (!testTeam) {
    throw new Error('No PAID team found to test checkin API.');
  }

  console.log(`Using test team: ${testTeam.teamName} (${testTeam.teamId})`);

  // Ensure checkedInAt is null to start
  await prisma.registration.update({
    where: { id: testTeam.id },
    data: { checkedInAt: null },
  });

  // Mock session cookie
  const sessionCookie = `vulcan_admin_session=${createSession('admin@vulcan.club', 'super_admin')}`;

  // Test 1: Action = 'lookup'
  console.log('1. Testing action: "lookup"...');
  const req1 = {
    method: 'POST',
    headers: { cookie: sessionCookie },
    body: { ticketId: testTeam.teamId, action: 'lookup' },
  };
  const res1 = createMockResponse();
  await checkinHandler(req1, res1);
  const data1 = res1._getData();
  console.log('Lookup response status:', data1.status, 'Message:', data1.message);
  if (data1.status !== 'ready') throw new Error(`Expected status 'ready', got '${data1.status}'`);

  // Verify DB state is still null
  const check1 = await prisma.registration.findUnique({ where: { id: testTeam.id } });
  if (check1.checkedInAt !== null) throw new Error('Lookup modified checkedInAt!');
  console.log('✓ Lookup succeeded and kept checkedInAt null.');

  // Test 2: Action = 'checkin'
  console.log('2. Testing action: "checkin"...');
  const req2 = {
    method: 'POST',
    headers: { cookie: sessionCookie },
    body: { ticketId: testTeam.teamId, action: 'checkin' },
  };
  const res2 = createMockResponse();
  await checkinHandler(req2, res2);
  const data2 = res2._getData();
  console.log('Checkin response status:', data2.status, 'Message:', data2.message);
  if (data2.status !== 'valid') throw new Error(`Expected status 'valid', got '${data2.status}'`);

  const check2 = await prisma.registration.findUnique({ where: { id: testTeam.id } });
  if (!check2.checkedInAt) throw new Error('Checkin did not set checkedInAt!');
  console.log('✓ Checkin succeeded and recorded checkedInAt timestamp.');

  // Test 3: Action = 'undo'
  console.log('3. Testing action: "undo"...');
  const req3 = {
    method: 'POST',
    headers: { cookie: sessionCookie },
    body: { ticketId: testTeam.teamId, action: 'undo' },
  };
  const res3 = createMockResponse();
  await checkinHandler(req3, res3);
  const data3 = res3._getData();
  console.log('Undo response status:', data3.status, 'Message:', data3.message);
  if (data3.status !== 'undone') throw new Error(`Expected status 'undone', got '${data3.status}'`);

  const check3 = await prisma.registration.findUnique({ where: { id: testTeam.id } });
  if (check3.checkedInAt !== null) throw new Error('Undo did not reset checkedInAt!');
  console.log('✓ Undo succeeded and reset checkedInAt to null.');

  // Test 4: Export with admitted filter
  console.log('4. Testing Export with filter=admitted...');
  const req4 = {
    method: 'GET',
    headers: { cookie: sessionCookie },
    query: { filter: 'admitted' },
  };
  const res4 = createMockResponse();
  await exportHandler(req4, res4);
  const csv4 = res4._getData();
  console.log('Export statusCode:', res4.statusCode);
  if (!csv4.startsWith('\uFEFF"Team ID"')) throw new Error('CSV output missing UTF-8 BOM or expected header!');
  console.log('✓ Export returned valid CSV with UTF-8 BOM.');

  console.log('\nALL CHECKIN & EXPORT TESTS PASSED SUCCESSFULLY!');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
