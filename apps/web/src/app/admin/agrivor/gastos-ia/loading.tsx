export default function Loading(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <div className="h-16 border-b border-white/5" />
      <div className="flex flex-1">
        <div className="hidden w-64 border-r border-white/5 md:block" />
        <main className="flex-1 p-8">
          <div className="mb-6 h-10 w-64 animate-pulse rounded-lg bg-white/[0.04]" />
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-white/[0.04]" />
        </main>
      </div>
    </div>
  );
}
