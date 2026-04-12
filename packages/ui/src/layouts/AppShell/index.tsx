import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Sidebar, type SidebarItem } from '../../components/Sidebar';
import { cn } from '../../lib/cn';

export interface AppShellProps {
  /** Navigation items for the sidebar. */
  sidebarItems: SidebarItem[];
  /** Logo or product name shown at the top of the sidebar. */
  brand?: ReactNode;
  /** Page title displayed in the header. */
  pageTitle?: ReactNode;
  /** Optional slot on the right of the header (avatar, menus, etc.). */
  headerRight?: ReactNode;
  /** Sidebar footer slot (commonly the user card). */
  sidebarFooter?: ReactNode;
  /** Page content. */
  children: ReactNode;
  /** Initial collapsed state of the sidebar (desktop). */
  defaultCollapsed?: boolean;
  className?: string;
}

/**
 * Base application shell: collapsible sidebar + sticky header + content area.
 * Responsive: on mobile the sidebar becomes an off-canvas drawer toggled by
 * the hamburger button in the header.
 */
export function AppShell({
  sidebarItems,
  brand,
  pageTitle,
  headerRight,
  sidebarFooter,
  children,
  defaultCollapsed = false,
  className,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={cn('flex h-screen w-full bg-background text-foreground', className)}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          items={sidebarItems}
          brand={brand}
          footer={sidebarFooter}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((prev) => !prev)}
        />
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 animate-slide-in-right">
            <Sidebar
              items={sidebarItems.map((item) => ({
                ...item,
                onClick: () => {
                  item.onClick?.();
                  setMobileOpen(false);
                },
              }))}
              brand={brand}
              footer={sidebarFooter}
              collapsed={false}
            />
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {pageTitle ? (
              <h1 className="truncate text-base font-semibold md:text-lg">{pageTitle}</h1>
            ) : null}
          </div>
          {headerRight ? <div className="flex items-center gap-3">{headerRight}</div> : null}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
