import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, emailVerified: true, name: true, status: true },
  });
  console.log('USERS:', JSON.stringify(users, null, 2));
  const roles = await prisma.role.findMany({ select: { name: true, isSystem: true } });
  console.log('ROLES:', JSON.stringify(roles, null, 2));
} finally {
  await prisma.$disconnect();
}
