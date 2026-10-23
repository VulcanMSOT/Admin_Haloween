import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis;

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1, ssl: { rejectUnauthorized: false } }) });
}

export const prisma = globalForPrisma.vulcanAdminPrisma || createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.vulcanAdminPrisma = prisma;
