import { prisma } from '../api/_lib/prisma.js';

async function main() {
  console.log('=== RESETTING ADMITTED TEAMS TO 0 ===\n');

  // Find all teams currently marked as admitted
  const admitted = await prisma.registration.findMany({
    where: { checkedInAt: { not: null } },
    select: { id: true, teamId: true, teamName: true, checkedInAt: true, paymentStatus: true },
  });

  console.log(`Found ${admitted.length} admitted team(s):`);
  console.table(admitted);

  if (admitted.length === 0) {
    console.log('No teams currently marked as admitted. Nothing to reset.');
    await prisma.$disconnect();
    return;
  }

  // Reset checkedInAt to null
  const resetResult = await prisma.registration.updateMany({
    where: { checkedInAt: { not: null } },
    data: { checkedInAt: null },
  });

  console.log(`✓ Updated ${resetResult.count} registration(s) to checkedInAt = null.`);

  // Log in AuditLog
  for (const team of admitted) {
    await prisma.auditLog.create({
      data: {
        adminEmail: 'system_admin@vulcan',
        action: 'checkin_reset',
        targetId: team.id,
        details: {
          teamId: team.teamId,
          teamName: team.teamName,
          previousCheckedInAt: team.checkedInAt,
          reason: 'Pre-event operational reset requested by admin',
        },
      },
    });
  }
  console.log('✓ Logged checkin_reset in AuditLog.');

  // Verify
  const remaining = await prisma.registration.count({
    where: { checkedInAt: { not: null } },
  });
  console.log(`\nRemaining admitted teams in database: ${remaining}`);

  if (remaining === 0) {
    console.log('SUCCESS: Admitted count is now exactly 0.');
  } else {
    console.error('WARNING: Admitted count is not 0!');
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});

