import { Code2 } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@devtechs/ui';

/**
 * Server-rendered sidebar with per-role navigation.
 * Follows the copper/acid terminal aesthetic of the landing page.
 */

export interface AppSidebarItem {
  href: string;
  label: string;
  description?: string;
  /** Permission key gating the item. When set and the caller
   *  doesn't hold it, the item renders as disabled. */
  permission?: string;
  icon: JSX.Element;
}

export interface AppSidebarProps {
  items: AppSidebarItem[];
  pathname: string;
  permissions: string[];
}

export function AppSidebar({
  items,
  pathname,
  permissions,
}: AppSidebarProps): JSX.Element {
  return (
    <aside
      aria-label="Menu principal"
      className="hidden w-64 shrink-0 border-r border-white/5 bg-ink md:flex md:flex-col"
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-acid/30 bg-acid/8">
          <Code2 className="h-4 w-4 text-acid" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold text-foreground tracking-tight">
            DevsTech
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-ash/60">
            Platform
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 text-sm">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(`${item.href}/`));
          const granted =
            !item.permission || permissions.includes(item.permission);

          return (
            <Link
              key={item.href}
              href={granted ? item.href : '#'}
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={granted ? undefined : true}
              className={cn(
                'group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-150',
                isActive
                  ? 'bg-copper/10 text-foreground ring-1 ring-copper/20 shadow-[inset_0_1px_0_0_hsl(28_72%_58%_/_0.15)]'
                  : 'text-ash hover:bg-white/5 hover:text-foreground',
                !granted && 'cursor-not-allowed opacity-35 hover:bg-transparent hover:text-ash',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center transition-colors',
                  isActive
                    ? 'text-copper'
                    : 'text-ash/70 group-hover:text-acid',
                  !granted && 'group-hover:text-ash/70',
                )}
              >
                {item.icon}
              </span>
              <span className="flex-1">
                <span className="block font-body font-medium leading-tight">
                  {item.label}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block font-mono text-[10px] leading-tight text-ash/50">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 p-3 font-mono text-[10px] uppercase tracking-widest text-ash/40">
        v0.1.0 · DevsTech
      </div>
    </aside>
  );
}
