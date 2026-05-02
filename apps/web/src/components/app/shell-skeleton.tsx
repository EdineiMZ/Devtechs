/**
 * ShellSkeleton — zero-auth static version of the app shell.
 * Matches the copper/acid terminal aesthetic of AppShell exactly,
 * so there is zero layout shift when the real page takes over.
 */
export function ShellSkeleton({ rows = 6 }: { rows?: number }): JSX.Element {
  return (
    <div className="flex min-h-screen w-full bg-ink text-foreground">
      {/* Sidebar skeleton */}
      <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-ink md:flex md:flex-col">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-5">
          <div className="h-8 w-8 shrink-0 rounded-md border border-acid/20 bg-acid/8" />
          <div className="space-y-1.5">
            <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
            <div className="h-2 w-12 animate-pulse rounded bg-white/5" />
          </div>
        </div>
        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-24 animate-pulse rounded bg-white/8" />
            </div>
          ))}
        </nav>
        {/* Footer */}
        <div className="border-t border-white/5 p-3">
          <div className="h-2 w-28 animate-pulse rounded bg-white/5" />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Topbar skeleton */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-ink/90 px-6 backdrop-blur-md">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2">
            <div className="h-3 w-10 animate-pulse rounded bg-white/8" />
            <span className="font-mono text-xs text-white/20">/</span>
            <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
          </div>
          {/* User area */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-copper/15" />
            <div className="hidden space-y-1.5 md:block">
              <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
              <div className="h-2 w-14 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl space-y-5 px-6 py-8">
            {/* Hero card skeleton */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 space-y-3">
              <div className="h-5 w-48 animate-pulse rounded bg-acid/12" />
              <div className="h-8 w-64 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-96 max-w-full animate-pulse rounded bg-white/6" />
            </div>
            {/* Row skeletons — fade out toward bottom */}
            {Array.from({ length: rows }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
                style={{ opacity: Math.max(0.15, 1 - i * 0.1) }}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Compact skeleton for detail / form pages — fewer, taller cards. */
export function ShellSkeletonCards({ cards = 3 }: { cards?: number }): JSX.Element {
  return (
    <div className="flex min-h-screen w-full bg-ink text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-ink md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-5">
          <div className="h-8 w-8 shrink-0 rounded-md border border-acid/20 bg-acid/8" />
          <div className="space-y-1.5">
            <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
            <div className="h-2 w-12 animate-pulse rounded bg-white/5" />
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-24 animate-pulse rounded bg-white/8" />
            </div>
          ))}
        </nav>
        <div className="border-t border-white/5 p-3">
          <div className="h-2 w-28 animate-pulse rounded bg-white/5" />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-ink/90 px-6 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="h-3 w-10 animate-pulse rounded bg-white/8" />
            <span className="font-mono text-xs text-white/20">/</span>
            <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
          </div>
          <div className="h-8 w-8 animate-pulse rounded-full bg-copper/15" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl space-y-4 px-6 py-8">
            <div className="h-8 w-56 animate-pulse rounded bg-white/10" />
            {Array.from({ length: cards }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
                style={{ opacity: Math.max(0.15, 1 - i * 0.15) }}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
