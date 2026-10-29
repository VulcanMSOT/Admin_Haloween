import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { prisma } from '../api/_lib/prisma.js';
import handler from '../api/coupons.js';
import { createSession } from '../api/_lib/session.js';

function mockReqRes(options) {
  let responseData = null;
  const headers = {};

  const req = {
    method: options.method || 'GET',
    headers: {
      cookie: options.cookie || '',
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body || null,
    query: options.query || {},
  };

  const res = {
    statusCode: 200,
    setHeader: (k, v) => {
      headers[k.toLowerCase()] = v;
    },
    getHeader: (k) => headers[k.toLowerCase()],
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      responseData = data;
      return this;
    },
    end: function(str) {
      if (str && typeof str === 'string') {
        try {
          responseData = JSON.parse(str);
        } catch {
          responseData = str;
        }
      }
      return this;
    },
    get _getData() {
      return responseData;
    },
  };

  return { req, res };
}

async function run() {
  console.log('Testing Admin Coupon Editing...');

  // Set up admin session
  const adminCookie = `vulcan_admin_session=${createSession('admin@vulcanmsot.com')};`;

  // 1. Create a test coupon
  const initialCode = `test_edit_${Date.now().toString().slice(-6)}`;
  const { req: createReq, res: createRes } = mockReqRes({
    method: 'POST',
    cookie: adminCookie,
    body: {
      code: initialCode,
      type: 'flat',
      value: 100,
      active: true,
      maxUses: 5,
    },
  });

  await handler(createReq, createRes);
  if (createRes.statusCode !== 201) {
    throw new Error(`Failed to create test coupon: ${JSON.stringify(createRes._getData)}`);
  }
  const createdCoupon = createRes._getData.coupon;
  console.log('1. Created test coupon:', createdCoupon.code, 'ID:', createdCoupon.id);

  // 2. Edit coupon (code, type, value, maxUses, active) via PATCH
  const updatedCode = `renamed_${Date.now().toString().slice(-6)}`;
  const { req: patchReq, res: patchRes } = mockReqRes({
    method: 'PATCH',
    cookie: adminCookie,
    body: {
      id: createdCoupon.id,
      code: updatedCode,
      type: 'percent',
      value: 25,
      maxUses: 20,
      active: false,
    },
  });

  await handler(patchReq, patchRes);
  if (patchRes.statusCode !== 200) {
    throw new Error(`Failed to update test coupon: ${JSON.stringify(patchRes._getData)}`);
  }
  console.log('2. PATCH response:', patchRes._getData.message);

  // 3. Verify in DB
  const dbCoupon = await prisma.coupon.findUnique({
    where: { id: createdCoupon.id },
  });
  if (!dbCoupon) throw new Error('Coupon not found in DB after update!');
  if (dbCoupon.code !== updatedCode) throw new Error(`Code mismatch: expected ${updatedCode}, got ${dbCoupon.code}`);
  if (dbCoupon.type !== 'percent') throw new Error(`Type mismatch: expected percent, got ${dbCoupon.type}`);
  if (dbCoupon.value !== 25) throw new Error(`Value mismatch: expected 25, got ${dbCoupon.value}`);
  if (dbCoupon.maxUses !== 20) throw new Error(`maxUses mismatch: expected 20, got ${dbCoupon.maxUses}`);
  if (dbCoupon.active !== false) throw new Error(`active mismatch: expected false, got ${dbCoupon.active}`);
  console.log('3. Verified all edited fields in database successfully.');

  // 4. Test duplicate code error handling
  const { req: dupReq, res: dupRes } = mockReqRes({
    method: 'PATCH',
    cookie: adminCookie,
    body: {
      id: createdCoupon.id,
      code: 'last_minute', // Existing coupon
    },
  });

  await handler(dupReq, dupRes);
  if (dupRes.statusCode !== 400) {
    throw new Error(`Expected 400 for duplicate code, got ${dupRes.statusCode}`);
  }
  console.log('4. Duplicate coupon code rejection verified (400):', dupRes._getData.error);

  // 5. Clean up
  await prisma.coupon.delete({ where: { id: createdCoupon.id } });
  console.log('5. Cleaned up test coupon successfully.');

  console.log('\nAll Coupon Editing tests passed with 100% success!');
}

run()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
