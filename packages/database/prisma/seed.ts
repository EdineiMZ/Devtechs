/**
 * DevTechs — database seed.
 *
 * Idempotent: safe to run repeatedly. Uses `upsert` so re-running only
 * syncs definitions (name/description/module changes) and never
 * deletes rows that are no longer in this file — that's a manual
 * migration step to avoid surprising a running system.
 *
 * Execute with: `pnpm --filter @devtechs/database db:seed`
 */
import { PrismaClient, PermissionModule } from '@prisma/client';

const prisma = new PrismaClient();

interface PermissionSeed {
  key: string;
  name: string;
  description: string;
  module: PermissionModule;
}

const PERMISSIONS: PermissionSeed[] = [
  // ------------------------------------------------------------------
  // RH
  // ------------------------------------------------------------------
  {
    key: 'rh:employees:view',
    name: 'View employees',
    description: 'Read-only access to the employee directory',
    module: PermissionModule.RH,
  },
  {
    key: 'rh:employees:edit',
    name: 'Edit employees',
    description: 'Create, update, and deactivate employee records',
    module: PermissionModule.RH,
  },
  {
    key: 'rh:vacations:approve',
    name: 'Approve vacations',
    description: 'Approve or reject employee vacation requests',
    module: PermissionModule.RH,
  },
  {
    key: 'rh:documents:upload',
    name: 'Upload HR documents',
    description: 'Attach contracts, certificates, and other HR documents',
    module: PermissionModule.RH,
  },
  {
    key: 'rh:performance:manage',
    name: 'Manage performance reviews',
    description: 'Create, edit, and close performance review cycles',
    module: PermissionModule.RH,
  },

  // ------------------------------------------------------------------
  // Financeiro
  // ------------------------------------------------------------------
  {
    key: 'finance:reports:view',
    name: 'View financial reports',
    description: 'Read financial reports and dashboards',
    module: PermissionModule.FINANCEIRO,
  },
  {
    key: 'finance:invoices:issue',
    name: 'Issue invoices',
    description: 'Create and send invoices to customers',
    module: PermissionModule.FINANCEIRO,
  },
  {
    key: 'finance:accounts:edit',
    name: 'Edit accounts',
    description: 'Update chart of accounts and account configuration',
    module: PermissionModule.FINANCEIRO,
  },
  {
    key: 'finance:costs:manage',
    name: 'Manage costs',
    description: 'Register, categorize, and reconcile operating costs',
    module: PermissionModule.FINANCEIRO,
  },

  // ------------------------------------------------------------------
  // Projetos
  // ------------------------------------------------------------------
  {
    key: 'projects:create',
    name: 'Create projects',
    description: 'Create new projects and project templates',
    module: PermissionModule.PROJETOS,
  },
  {
    key: 'projects:delete',
    name: 'Delete projects',
    description: 'Archive or permanently remove projects',
    module: PermissionModule.PROJETOS,
  },
  {
    key: 'projects:tasks:assign',
    name: 'Assign tasks',
    description: 'Assign tasks to project members',
    module: PermissionModule.PROJETOS,
  },
  {
    key: 'projects:sprints:manage',
    name: 'Manage sprints',
    description: 'Create, plan, and close sprints',
    module: PermissionModule.PROJETOS,
  },
  {
    key: 'projects:reports:view',
    name: 'View project reports',
    description: 'Read velocity, burndown, and other project analytics',
    module: PermissionModule.PROJETOS,
  },

  // ------------------------------------------------------------------
  // Suporte
  // ------------------------------------------------------------------
  {
    key: 'support:tickets:view',
    name: 'View support tickets',
    description: 'Read support tickets and their history',
    module: PermissionModule.SUPORTE,
  },
  {
    key: 'support:tickets:close',
    name: 'Close support tickets',
    description: 'Resolve and close support tickets',
    module: PermissionModule.SUPORTE,
  },
  {
    key: 'support:kb:edit',
    name: 'Edit knowledge base',
    description: 'Create and update support knowledge base articles',
    module: PermissionModule.SUPORTE,
  },
  {
    key: 'support:sla:manage',
    name: 'Manage SLAs',
    description: 'Configure SLA policies for support tickets',
    module: PermissionModule.SUPORTE,
  },
  {
    key: 'support:reports:view',
    name: 'View support reports',
    description: 'Read support analytics and team performance reports',
    module: PermissionModule.SUPORTE,
  },

  // ------------------------------------------------------------------
  // Pagamentos
  // ------------------------------------------------------------------
  {
    key: 'payments:plans:manage',
    name: 'Manage plans',
    description: 'Create and edit subscription plans',
    module: PermissionModule.PAGAMENTOS,
  },
  {
    key: 'payments:subscriptions:cancel',
    name: 'Cancel subscriptions',
    description: 'Cancel customer subscriptions',
    module: PermissionModule.PAGAMENTOS,
  },
  {
    key: 'payments:coupons:create',
    name: 'Create coupons',
    description: 'Create and distribute discount coupons',
    module: PermissionModule.PAGAMENTOS,
  },
  {
    key: 'payments:reports:view',
    name: 'View payment reports',
    description: 'Read billing, revenue, and churn reports',
    module: PermissionModule.PAGAMENTOS,
  },

  // ------------------------------------------------------------------
  // Licenças
  // ------------------------------------------------------------------
  {
    key: 'licenses:tokens:generate',
    name: 'Generate license tokens',
    description: 'Generate signed license tokens for customers',
    module: PermissionModule.LICENCAS,
  },
  {
    key: 'licenses:tokens:revoke',
    name: 'Revoke license tokens',
    description: 'Invalidate previously issued license tokens',
    module: PermissionModule.LICENCAS,
  },
  {
    key: 'licenses:clients:bind',
    name: 'Bind license clients',
    description: 'Bind licenses to specific client installations',
    module: PermissionModule.LICENCAS,
  },
  {
    key: 'licenses:audit:view',
    name: 'View license audit',
    description: 'Read the license validation and rotation audit trail',
    module: PermissionModule.LICENCAS,
  },

  // ------------------------------------------------------------------
  // DevOps
  // ------------------------------------------------------------------
  {
    key: 'devops:pipelines:view',
    name: 'View pipelines',
    description: 'Read CI/CD pipeline definitions and run history',
    module: PermissionModule.DEVOPS,
  },
  {
    key: 'devops:deploys:trigger',
    name: 'Trigger deploys',
    description: 'Kick off deployments to any environment',
    module: PermissionModule.DEVOPS,
  },
  {
    key: 'devops:rollback:execute',
    name: 'Execute rollbacks',
    description: 'Roll a service back to a previous release',
    module: PermissionModule.DEVOPS,
  },
  {
    key: 'devops:logs:view',
    name: 'View logs',
    description: 'Read aggregated service logs and metrics',
    module: PermissionModule.DEVOPS,
  },

  // ------------------------------------------------------------------
  // Developer (super-user / platform-level)
  // ------------------------------------------------------------------
  {
    key: 'dev:services:restart',
    name: 'Restart services',
    description: 'Restart internal services on the VPS',
    module: PermissionModule.DEVELOPER,
  },
  {
    key: 'dev:services:stop',
    name: 'Stop services',
    description: 'Stop internal services on the VPS',
    module: PermissionModule.DEVELOPER,
  },
  {
    key: 'dev:logs:view',
    name: 'View dev logs',
    description: 'Read low-level service and platform logs',
    module: PermissionModule.DEVELOPER,
  },
  {
    key: 'dev:config:edit',
    name: 'Edit platform config',
    description:
      'Edit roles, permissions, and other platform configuration (required to manage RBAC itself)',
    module: PermissionModule.DEVELOPER,
  },
  {
    key: 'dev:vps:manage',
    name: 'Manage VPS',
    description: 'Provision, scale, and decommission VPS resources',
    module: PermissionModule.DEVELOPER,
  },
];

// ---------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------

async function upsertPermissions(): Promise<void> {
  console.info(`[seed] upserting ${PERMISSIONS.length} permissions…`);
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {
        name: perm.name,
        description: perm.description,
        module: perm.module,
      },
      create: {
        key: perm.key,
        name: perm.name,
        description: perm.description,
        module: perm.module,
      },
    });
  }
}

/**
 * `admin` — system super-user role. Gets every permission and cannot
 * be deleted or renamed via the roles API (enforced by `isSystem`).
 */
async function upsertAdminRole(): Promise<void> {
  console.info(`[seed] upserting admin role…`);
  const admin = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {
      description: 'Platform administrator — holds every permission',
      isSystem: true,
      requireEmailVerified: true,
      require2FA: true,
    },
    create: {
      name: 'admin',
      description: 'Platform administrator — holds every permission',
      isSystem: true,
      requireEmailVerified: true,
      require2FA: true,
    },
  });

  // Wire every permission onto the admin role. `upsert` on the
  // composite key is idempotent so re-runs are safe.
  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  for (const p of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: admin.id, permissionId: p.id },
      },
      update: {},
      create: { roleId: admin.id, permissionId: p.id },
    });
  }
}

/**
 * A minimal, non-system `member` role with zero permissions. Intended
 * as the default role for newly registered users so the system has a
 * sensible starting point without granting anything sensitive.
 */
async function upsertMemberRole(): Promise<void> {
  console.info(`[seed] upserting member role…`);
  await prisma.role.upsert({
    where: { name: 'member' },
    update: {
      description: 'Default role for newly registered users',
      isSystem: true,
    },
    create: {
      name: 'member',
      description: 'Default role for newly registered users',
      isSystem: true,
      requireEmailVerified: false,
      require2FA: false,
    },
  });
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main(): Promise<void> {
  await upsertPermissions();
  await upsertAdminRole();
  await upsertMemberRole();
  console.info('[seed] done');
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
