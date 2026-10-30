import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), 'Vulcan-admin/.env.local') });
}

import { prisma } from '../api/_lib/prisma.js';

async function main() {
  console.log('=== CREATING FULL DATABASE SNAPSHOT ===\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('1. Fetching all table records...');
  const [
    registrations,
    members,
    coupons,
    settings,
    admins,
    auditLogs,
    rateLimits,
    referrers,
    referrals,
  ] = await Promise.all([
    prisma.registration.findMany({ include: { members: true, referral: true } }),
    prisma.teamMember.findMany(),
    prisma.coupon.findMany(),
    prisma.eventSettings.findMany(),
    prisma.admin.findMany(),
    prisma.auditLog.findMany(),
    prisma.registrationRateLimit.findMany(),
    prisma.referrer.findMany(),
    prisma.referral.findMany(),
  ]);

  const backupData = {
    metadata: {
      createdAt: new Date().toISOString(),
      timestamp,
      purpose: 'Full database snapshot prior to admin check-in and attendance overhaul',
      counts: {
        registrations: registrations.length,
        members: members.length,
        coupons: coupons.length,
        eventSettings: settings.length,
        admins: admins.length,
        auditLogs: auditLogs.length,
        rateLimits: rateLimits.length,
        referrers: referrers.length,
        referrals: referrals.length,
      },
    },
    tables: {
      registrations,
      members,
      coupons,
      settings,
      admins,
      auditLogs,
      rateLimits,
      referrers,
      referrals,
    },
  };

  const backupFilePath = path.join(backupDir, `backup_full_${timestamp}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`✓ Backup successfully written to:\n  ${backupFilePath}`);
  console.log('\nSummary of backed up records:');
  console.table(backupData.metadata.counts);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Database backup failed:', err);
  process.exit(1);
});

