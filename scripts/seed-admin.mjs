/**
 * Seed admin user with ALL permissions for testing.
 * Run: node scripts/seed-admin.mjs
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dbPath = path.join(__dirname, '..', 'packages', 'database');
const bcryptPath = path.join(__dirname, '..', 'services', 'auth-service', 'node_modules', 'bcrypt');
const { PrismaClient } = require(dbPath);
const bcrypt = require(bcryptPath);

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@SZDevs.com';
const ADMIN_PASSWORD = 'Admin@SZDevs2026';
const ADMIN_NAME = 'Administrador SZDevs';

const ALL_PERMISSIONS = [
  // AUTH
  { key: 'auth:roles:manage', module: 'AUTH' },
  { key: 'auth:permissions:manage', module: 'AUTH' },
  { key: 'auth:audit:view', module: 'AUTH' },
  { key: 'auth:users:manage', module: 'AUTH' },
  // RH
  { key: 'rh:employees:view', module: 'RH' },
  { key: 'rh:employees:manage', module: 'RH' },
  { key: 'rh:vacations:approve', module: 'RH' },
  { key: 'rh:schedules:manage', module: 'RH' },
  // PROJETOS
  { key: 'projects:view', module: 'PROJETOS' },
  { key: 'projects:manage', module: 'PROJETOS' },
  { key: 'projects:tasks:manage', module: 'PROJETOS' },
  // FINANCEIRO
  { key: 'finance:transactions:view', module: 'FINANCEIRO' },
  { key: 'finance:transactions:create', module: 'FINANCEIRO' },
  { key: 'finance:invoices:manage', module: 'FINANCEIRO' },
  { key: 'finance:dre:view', module: 'FINANCEIRO' },
  // SUPORTE
  { key: 'support:tickets:view', module: 'SUPORTE' },
  { key: 'support:tickets:manage', module: 'SUPORTE' },
  { key: 'support:tickets:assign', module: 'SUPORTE' },
  // PAGAMENTOS
  { key: 'payments:plans:manage', module: 'PAGAMENTOS' },
  { key: 'payments:reports:view', module: 'PAGAMENTOS' },
  { key: 'payments:coupons:create', module: 'PAGAMENTOS' },
  // LICENCAS
  { key: 'licenses:audit:view', module: 'LICENCAS' },
  { key: 'licenses:clients:bind', module: 'LICENCAS' },
  { key: 'licenses:tokens:generate', module: 'LICENCAS' },
  { key: 'licenses:tokens:revoke', module: 'LICENCAS' },
  // DEVOPS
  { key: 'devops:pipelines:view', module: 'DEVOPS' },
  { key: 'devops:pipelines:trigger', module: 'DEVOPS' },
  { key: 'devops:deployments:manage', module: 'DEVOPS' },
  // DEVELOPER
  { key: 'dev:config:edit', module: 'DEVELOPER' },
  { key: 'dev:logs:view', module: 'DEVELOPER' },
];

async function main() {
  console.log('Seeding permissions...');
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, name: p.key.split(':').join(' '), module: p.module },
      update: {},
    });
  }
  console.log(`  ${ALL_PERMISSIONS.length} permissions ensured`);

  console.log('Ensuring admin role...');
  let role = await prisma.role.findFirst({ where: { name: 'admin' } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        name: 'admin',
        description: 'Super administrator with all permissions',
        isSystem: true,
      },
    });
    console.log('  created admin role:', role.id);
  } else {
    console.log('  admin role exists:', role.id);
  }

  const allPerms = await prisma.permission.findMany({
    where: { key: { in: ALL_PERMISSIONS.map((x) => x.key) } },
  });
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: perm.id },
      },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    });
  }
  console.log(`  ${allPerms.length} permissions linked to admin role`);

  console.log('Creating/updating admin user...');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  let user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
        name: ADMIN_NAME,
      },
    });
    console.log('  admin user updated:', user.id);
  } else {
    user = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
    });
    console.log('  admin user created:', user.id);
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id, assignedBy: user.id },
    update: {},
  });

  console.log('\n========================================');
  console.log('ADMIN PRONTO');
  console.log('========================================');
  console.log('  Email:    ', ADMIN_EMAIL);
  console.log('  Password: ', ADMIN_PASSWORD);
  console.log('  User ID:  ', user.id);
  console.log('  Role:     ', role.name);
  console.log('  Perms:    ', allPerms.length);
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
