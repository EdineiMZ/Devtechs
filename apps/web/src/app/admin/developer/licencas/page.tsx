import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listUsers } from '@/lib/auth-admin-api';
import {
  listProducts,
  listTokens,
  type ActivationToken,
  type LicensedProduct,
} from '@/lib/license-api';
import { listBillingProducts, type BillingProduct } from '@/lib/recurring-billing-api';

import { GenerateTokenDialog } from './_components/generate-token-dialog';
import { ProductsSection } from './_components/products-section';
import { TokensSection } from './_components/tokens-section';
import { BillingProductsSection } from './_components/billing-products-section';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <p className="text-xs font-medium text-ash">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${accent ?? 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}

export default async function LicensasPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/developer/licencas');
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/developer/licencas');

  const { user } = session;
  const canView = user.permissions.includes('licenses:audit:view');
  const canGenerate = user.permissions.includes('licenses:tokens:generate');
  const canCreateProduct = user.permissions.includes('dev:config:edit');

  if (!canView) redirect('/perfil');

  const [productsRes, tokensRes, usersRes, billingProductsRes] = await Promise.all([
    listProducts(session.accessToken).catch(() => ({ ok: false, data: [] })),
    listTokens({}, session.accessToken).catch(() => ({ ok: false, data: [] })),
    listUsers({ pageSize: 500 }).catch(() => ({ ok: false, data: { items: [] } })),
    listBillingProducts({ licensedOnly: true, accessToken: session.accessToken }).catch(() => ({ ok: false, data: [] })),
  ]);

  const products: LicensedProduct[] =
    productsRes.ok && Array.isArray(productsRes.data)
      ? (productsRes.data as LicensedProduct[])
      : [];

  const tokens: ActivationToken[] =
    tokensRes.ok && Array.isArray(tokensRes.data)
      ? (tokensRes.data as ActivationToken[])
      : [];

  const billingProducts: BillingProduct[] =
    billingProductsRes.ok && Array.isArray(billingProductsRes.data)
      ? (billingProductsRes.data as BillingProduct[])
      : [];

  const clients = usersRes.ok
    ? ((usersRes.data as { items: Array<{ id: string; name: string; email: string }> }).items ?? [])
    : [];

  // Stats
  const activeCount = tokens.filter((t) => t.status === 'ACTIVE').length;
  const revokedCount = tokens.filter((t) => t.status === 'REVOKED').length;
  const expiredCount = tokens.filter((t) => t.status === 'EXPIRED').length;

  const serviceError =
    !productsRes.ok || !tokensRes.ok
      ? 'license-service pode estar indisponível. Alguns dados podem não aparecer.'
      : null;

  const billingServiceError =
    !billingProductsRes.ok
      ? 'finance-service indisponível — produtos licenciados não carregados.'
      : null;

  return (
    <AppShell
      pathname="/admin/developer/licencas"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Developer', href: '/admin/developer' },
        { label: 'Licenças & Keys' },
      ]}
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Licenças & Keys</h1>
          <p className="mt-1 text-sm text-ash">
            Gerencie produtos licenciados, emita tokens de ativação e controle cobranças.
          </p>
        </div>
        {canGenerate && products.length > 0 && clients.length > 0 ? (
          <GenerateTokenDialog products={products} clients={clients} />
        ) : null}
      </div>

      {serviceError ? (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
          ⚠ {serviceError}
        </div>
      ) : null}

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Produtos (licença)" value={products.length} />
        <StatCard label="Tokens ativos" value={activeCount} accent="text-emerald-400" />
        <StatCard label="Revogados" value={revokedCount} accent="text-destructive" />
        <StatCard label="Expirados" value={expiredCount} accent="text-ash" />
      </div>

      {/* Billing Products (licensed) */}
      {billingServiceError ? (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
          ⚠ {billingServiceError}
        </div>
      ) : (
        <div className="mb-10">
          <BillingProductsSection products={billingProducts} />
        </div>
      )}

      {/* Licensed Products (license-service) */}
      <div className="mb-10">
        <ProductsSection products={products} canCreate={canCreateProduct} />
      </div>

      {/* Tokens */}
      <TokensSection tokens={tokens} products={products} clients={clients} />
    </AppShell>
  );
}
