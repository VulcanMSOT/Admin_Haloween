import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../api/_lib/prisma.js';

async function main() {
  console.log('=== STARTING DATABASE BACKUP BEFORE CLEARING REFERRAL TEST DATA ===\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 1. Snapshot all tables
  console.log('1. Fetching all data from database...');
  const [
    referrers,
    referrals,
    registrations,
    coupons,
    settings,
    admins,
    auditLogs,
    rateLimits,
  ] = await Promise.all([
    prisma.referrer.findMany({ include: { referrals: true } }),
    prisma.referral.findMany(),
    prisma.registration.findMany({ include: { members: true, referral: true } }),
    prisma.coupon.findMany(),
    prisma.eventSettings.findMany(),
    prisma.admin.findMany(),
    prisma.auditLog.findMany(),
    prisma.registrationRateLimit.findMany(),
  ]);

  const backupData = {
    metadata: {
      createdAt: new Date().toISOString(),
      purpose: 'Backup prior to clearing referral test data',
      counts: {
        referrers: referrers.length,
        referrals: referrals.length,
        registrations: registrations.length,
        coupons: coupons.length,
        eventSettings: settings.length,
        admins: admins.length,
        auditLogs: auditLogs.length,
        rateLimits: rateLimits.length,
      },
    },
    tables: {
      referrers,
      referrals,
      registrations,
      coupons,
      eventSettings: settings,
      admins,
      auditLogs,
      registrationRateLimits: rateLimits,
    },
  };

  const backupFilePath = path.join(backupDir, `backup_before_referral_cleanup_${timestamp}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`✓ Backup successfully written to:\n  ${backupFilePath}`);
  console.log('  Snapshot counts:', backupData.metadata.counts);

  // Also copy to brain artifact directory if accessible
  const brainBackupDir = '/Users/sapnilbiswas/.gemini/antigravity-ide/brain/db06fb97-97b0-4a24-9aeb-332f142824a1';
  if (fs.existsSync(brainBackupDir)) {
    const brainBackupPath = path.join(brainBackupDir, `backup_before_referral_cleanup_${timestamp}.json`);
    fs.writeFileSync(brainBackupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`✓ Mirror backup saved to:\n  ${brainBackupPath}`);
  }

  // 2. Perform selective cleanup of ONLY referral test data
  console.log('\n2. Clearing ONLY referral test data...');

  // Delete all test referrals first
  const deletedReferrals = await prisma.referral.deleteMany({});
  console.log(`✓ Deleted ${deletedReferrals.count} referral records.`);

  // Delete all test referrers
  const deletedReferrers = await prisma.referrer.deleteMany({});
  console.log(`✓ Deleted ${deletedReferrers.count} referrer records.`);

  // Delete referral rate limit records
  const deletedRateLimits = await prisma.registrationRateLimit.deleteMany({
    where: { key: { startsWith: 'ref_check:' } },
  });
  console.log(`✓ Deleted ${deletedRateLimits.count} referral rate-limit records.`);

  // 3. Post-cleanup Verification
  console.log('\n3. Verifying database integrity after cleanup...');
  const [
    postReferrersCount,
    postReferralsCount,
    postRegistrationsCount,
    postCouponsCount,
    postSettingsCount,
    postAdminsCount,
  ] = await Promise.all([
    prisma.referrer.count(),
    prisma.referral.count(),
    prisma.registration.count(),
    prisma.coupon.count(),
    prisma.eventSettings.count(),
    prisma.admin.count(),
  ]);

  console.log('Post-cleanup table counts:');
  console.log(` - Referrers: ${postReferrersCount} (expected: 0)`);
  console.log(` - Referrals: ${postReferralsCount} (expected: 0)`);
  console.log(` - Registrations: ${postRegistrationsCount} (unmodified: was ${registrations.length})`);
  console.log(` - Coupons: ${postCouponsCount} (unmodified: was ${coupons.length})`);
  console.log(` - EventSettings: ${postSettingsCount} (unmodified: was ${settings.length})`);
  console.log(` - Admins: ${postAdminsCount} (unmodified: was ${admins.length})`);

  if (postRegistrationsCount !== registrations.length) {
    throw new Error('Integrity check failed: Registration count changed!');
  }
  if (postCouponsCount !== coupons.length) {
    throw new Error('Integrity check failed: Coupon count changed!');
  }

  console.log('\n=== REFERRAL TEST DATA CLEARED SUCCESSFULLY WITH INTEGRITY VERIFIED ===');
}

main()
  .catch((err) => {
    console.error('Cleanup error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
