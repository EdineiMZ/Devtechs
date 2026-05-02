import type { ReactNode } from 'react';

import { AppSidebar, type AppSidebarItem } from './app-sidebar';
import { AppTopbar } from './app-topbar';

/**
 * AppShell — full-height flex layout with the gradient sidebar
 * on the left and a content column with a sticky topbar on the
 * right. Every authenticated page inside the app renders inside
 * this shell.
 *
 * Async server component so the embedded AppTopbar (which also
 * awaits the auth() session) is resolved on the Node layer
 * before any JS loads in the browser.
 */
export interface AppShellProps {
  navItems: AppSidebarItem[];
  pathname: string;
  permissions: string[];
  breadcrumbs?: Array<{ label: string; href?: string }>;
  topbarActions?: JSX.Element;
  children: ReactNode;
}

export async function AppShell({
  navItems,
  pathname,
  permissions,
  breadcrumbs,
  topbarActions,
  children,
}: AppShellProps): Promise<JSX.Element> {
  const topbar = await AppTopbar({ breadcrumbs, actions: topbarActions });
  return (
    <div className="flex min-h-screen w-full bg-ink text-foreground">
      <AppSidebar items={navItems} pathname={pathname} permissions={permissions} />
      <div className="flex min-h-screen flex-1 flex-col">
        {topbar}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
