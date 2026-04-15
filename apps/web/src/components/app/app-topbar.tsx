import { Avatar, AvatarFallback, Button } from '@devtechs/ui';

import { auth, signOut } from '@/auth';

/**
 * Sticky topbar rendered above the content area inside the app
 * shell. Shows the current section title on the left and the
 * user avatar + sign-out button on the right.
 *
 * Kept as a server component so the session read happens once
 * per request and the buttons can use server actions for
 * sign-out.
 */
export interface AppTopbarProps {
  /** Breadcrumb segments, rendered as "Section / Subsection". */
  breadcrumbs?: Array<{ label: string; href?: string }>;
  /** Optional right-hand slot — actions, status pill, etc. */
  actions?: JSX.Element;
}

export async function AppTopbar({
  breadcrumbs,
  actions,
}: AppTopbarProps): Promise<JSX.Element> {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-md">
      <nav aria-label="Você está em" className="flex items-center gap-2 text-sm">
        {breadcrumbs?.map((crumb, idx) => {
          const last = idx === (breadcrumbs?.length ?? 0) - 1;
          return (
            <span key={`${crumb.label}-${idx}`} className="flex items-center gap-2">
              {idx > 0 ? (
                <span aria-hidden="true" className="text-muted-foreground/50">
                  /
                </span>
              ) : null}
              {crumb.href && !last ? (
                <a
                  href={crumb.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </a>
              ) : (
                <span
                  className={
                    last ? 'font-medium text-foreground' : 'text-muted-foreground'
                  }
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex items-center gap-4">
        {actions}
        {user ? (
          <>
            <div className="hidden items-center gap-3 md:flex">
              <Avatar size="sm" className="ring-2 ring-sky-500/30">
                <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
                  {user.name?.slice(0, 2).toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <div className="text-sm font-medium text-foreground">
                  {user.name ?? user.email}
                </div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {user.mainRole ?? 'member'}
                </div>
              </div>
            </div>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <Button type="submit" size="sm" variant="outline">
                Sair
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </header>
  );
}
