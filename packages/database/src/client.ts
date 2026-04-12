import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client instance.
 *
 * In development Next.js / NestJS restart modules frequently, which would
 * otherwise create a new PrismaClient on every reload and exhaust database
 * connections. We cache the instance on `globalThis` to avoid that.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
