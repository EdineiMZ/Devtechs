import Link from 'next/link';

import { cn } from '@devtechs/ui';

/**
 * Server-rendered sidebar with per-role navigation. A client-side
 * version sits on top for interactive collapse, but the baseline
 * HTML is rendered on the Node layer so the nav is visible before
 * JavaScript hydrates.
 *
 * The consumer passes the current pathname so the active item
 * can be highlighted without a useEffect round trip.
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
      className="hidden w-64 shrink-0 border-r border-border/60 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 md:flex md:flex-col"
    >
      <div className="flex h-16 items-center gap-2 border-b border-white/5 px-5">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-[0_0_20px_hsl(217,91%,60%,0.45)]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">
            Dev<span className="text-sky-400">Techs</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            Platform
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 text-sm">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(`${item.href}/`));
          const granted =
            !item.permission || permissions.includes(item.permission);

          const base =
            'group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all';
          const active = isActive
            ? 'bg-gradient-to-r from-sky-500/15 via-indigo-500/10 to-transparent text-white ring-1 ring-sky-500/30 shadow-[inset_0_1px_0_0_hsl(217,91%,60%,0.2)]'
            : 'text-slate-300 hover:bg-white/5 hover:text-white';
          const disabled = !granted
            ? 'cursor-not-allowed text-slate-600 hover:bg-transparent hover:text-slate-600'
            : '';

          return (
            <Link
              key={item.href}
              href={granted ? item.href : '#'}
              className={cn(base, active, disabled)}
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={granted ? undefined : true}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 group-hover:text-sky-400',
                  isActive && 'text-sky-400',
                  !granted && 'text-slate-700 group-hover:text-slate-700',
                )}
              >
                {item.icon}
              </span>
              <span className="flex-1">
                <span className="block font-medium leading-tight">
                  {item.label}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3 text-[10px] uppercase tracking-widest text-slate-600">
        v0.1.0 &middot; DevTechs Platform
      </div>
    </aside>
  );
}
