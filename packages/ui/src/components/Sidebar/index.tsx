import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  forwardRef,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
  type SVGProps,
} from 'react';

import { cn } from '../../lib/cn';

export interface SidebarItem {
  /** Unique id (used as React key). */
  id: string;
  /** Visible label. */
  label: string;
  /** Lucide-style icon component. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Link destination - the consuming app decides how to navigate. */
  href?: string;
  /** Marks the item as currently active. */
  active?: boolean;
  /** Click handler (falls back to href navigation). */
  onClick?: () => void;
}

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  items: SidebarItem[];
  /** Collapse the sidebar to an icon rail. */
  collapsed?: boolean;
  /** Called when the user clicks the collapse toggle. */
  onToggleCollapsed?: () => void;
  /** Brand / logo rendered at the top. */
  brand?: ReactNode;
  /** Optional footer (user menu, version, etc.). */
  footer?: ReactNode;
}

/**
 * Application sidebar. Supports collapsed (icon-only) and expanded modes
 * and exposes `aria-current="page"` on the active item.
 */
export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  (
    { items, collapsed = false, onToggleCollapsed, brand, footer, className, ...props },
    ref,
  ) => {
    return (
      <aside
        ref={ref}
        data-collapsed={collapsed ? 'true' : 'false'}
        aria-label="Menu principal"
        className={cn(
          'flex h-full flex-col border-r border-border bg-background transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-64',
          'dark:bg-background dark:text-foreground',
          className,
        )}
        {...props}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-16 items-center border-b border-border px-4',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && brand ? <div className="truncate font-semibold">{brand}</div> : null}
          {onToggleCollapsed ? (
            <button
              type="button"
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        {/* Items */}
        <nav className="flex-1 overflow-y-auto py-2">
          <ul className="flex flex-col gap-1 px-2">
            {items.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  {Icon ? <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /> : null}
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </>
              );
              const baseClasses = cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                item.active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                collapsed && 'justify-center px-2',
              );

              return (
                <li key={item.id}>
                  {item.href ? (
                    <a
                      href={item.href}
                      aria-current={item.active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      onClick={item.onClick}
                      className={baseClasses}
                    >
                      {content}
                    </a>
                  ) : (
                    <button
                      type="button"
                      aria-current={item.active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      onClick={item.onClick}
                      className={cn(baseClasses, 'w-full text-left')}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        {footer ? (
          <div className={cn('border-t border-border p-3', collapsed && 'flex justify-center')}>
            {footer}
          </div>
        ) : null}
      </aside>
    );
  },
);
Sidebar.displayName = 'Sidebar';
