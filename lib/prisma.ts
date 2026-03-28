import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __AI_APP_BUILDER_PRISMA__: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  });
}

export const prisma = globalThis.__AI_APP_BUILDER_PRISMA__ ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__AI_APP_BUILDER_PRISMA__ = prisma;
}
