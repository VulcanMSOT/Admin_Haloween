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
  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error('Usage: node restore_database.js <path-to-backup.json>');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), backupFile);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Backup file not found at ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading backup file: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const backup = JSON.parse(raw);

  console.log('Backup metadata:', backup.metadata);

  console.log('\nRestoring registrations and check-in statuses...');
  if (backup.tables?.registrations) {
    for (const reg of backup.tables.registrations) {
      await prisma.registration.update({
        where: { id: reg.id },
        data: {
          checkedInAt: reg.checkedInAt ? new Date(reg.checkedInAt) : null,
          paymentStatus: reg.paymentStatus,
          amountReceived: reg.amountReceived,
        },
      });
    }
    console.log(`✓ Restored status for ${backup.tables.registrations.length} registrations.`);
  }

  console.log('\nDatabase restore process completed successfully.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Database restore failed:', err);
  process.exit(1);
});

