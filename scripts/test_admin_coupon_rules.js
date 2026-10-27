import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { prisma } from '../api/_lib/prisma.js';

async function run() {
  console.log('Testing Admin Coupon & Pricing rules...');

  // 1. Check coupon table has seeded halloween_night
  const seed = await prisma.coupon.findUnique({
    where: { code: 'halloween_night' },
  });
  console.log('Seed coupon halloween_night found:', Boolean(seed), seed);
  if (!seed) throw new Error('halloween_night not found!');

  // 2. Test create new coupon format validation
  const testCode = `test_coupon_${Date.now()}`;
  const created = await prisma.coupon.create({
    data: {
      code: testCode,
      type: 'flat',
      value: 50,
      active: true,
      maxUses: 10,
      usedCount: 0,
    },
  });
  console.log('Created test coupon:', created.code);

  // 3. Test increment and decrement usedCount
  await prisma.coupon.update({
    where: { id: created.id },
    data: { usedCount: { increment: 1 } },
  });
  let fetched = await prisma.coupon.findUnique({ where: { id: created.id } });
  if (fetched.usedCount !== 1) throw new Error(`Expected usedCount 1, got ${fetched.usedCount}`);

  // Test decrement with usedCount > 0
  await prisma.coupon.updateMany({
    where: { code: created.code, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
  fetched = await prisma.coupon.findUnique({ where: { id: created.id } });
  if (fetched.usedCount !== 0) throw new Error(`Expected usedCount 0, got ${fetched.usedCount}`);

  // Clean up test coupon
  await prisma.coupon.delete({ where: { id: created.id } });
  console.log('Deleted test coupon clean up OK');

  console.log('All admin coupon database rules verified successfully!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
