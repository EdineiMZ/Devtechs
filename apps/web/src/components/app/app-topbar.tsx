import Link from 'next/link';

import { Avatar, AvatarFallback, Button } from '@devtechs/ui';

import { auth, signOut } from '@/auth';
import { NotificationsBell } from '@/components/app/notifications-bell';
import { listNotifications } from '@/lib/notifications-api';
import type { Notification } from '@/lib/notifications-api';

/**
 * Sticky topbar for the authenticated app shell.
 * Follows the copper/acid terminal aesthetic.
 */
export interface AppTopbarProps {
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: JSX.Element;
}

export async function AppTopbar({
  breadcrumbs,
  actions,
}: AppTopbarProps): Promise<JSX.Element> {
  const session = await auth();
  const user = session?.user;

  let initialNotifications: Notification[] = [];
  let initialUnreadCount = 0;
  if (session?.accessToken) {
    const res = await listNotifications({ pageSize: 10 }, session.accessToken).catch(() => null);
    if (res?.ok && res.data && 'items' in res.data) {
      initialNotifications = res.data.items;
      initialUnreadCount   = res.data.unreadCount;
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-ink/90 px-6 backdrop-blur-md">
      {/* Breadcrumbs */}
      <nav aria-label="Você está em" className="flex items-center gap-2 text-sm font-body">
        {breadcrumbs?.map((crumb, idx) => {
          const last = idx === (breadcrumbs?.length ?? 0) - 1;
          return (
            <span key={`${crumb.label}-${idx}`} className="flex items-center gap-2">
              {idx > 0 ? (
                <span aria-hidden="true" className="font-mono text-ash/30">/</span>
              ) : null}
              {crumb.href && !last ? (
                <a
                  href={crumb.href}
                  className="text-ash transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className={last ? 'font-medium text-foreground' : 'text-ash'}>
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {actions}

        {user && session?.accessToken ? (
          <NotificationsBell
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
            accessToken={session.accessToken}
          />
        ) : null}

        {user ? (
          <>
            <Link
              href="/perfil"
              className="hidden items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-white/5 md:flex"
            >
              <Avatar size="sm" className="ring-2 ring-copper/25">
                <AvatarFallback
                  className="font-display font-semibold text-xs text-ink"
                  style={{ background: 'linear-gradient(135deg, hsl(28 72% 58%), hsl(16 68% 40%))' }}
                >
                  {user.name?.slice(0, 2).toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <div className="font-body text-sm font-medium text-foreground">
                  {user.name ?? user.email}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-copper/70">
                  {user.mainRole ?? 'member'}
                </div>
              </div>
            </Link>

            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="border-white/10 text-ash hover:text-foreground hover:border-white/20 font-body text-xs"
              >
                Sair
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </header>
  );
}
