const ROW1 = [
  'Node.js','PostgreSQL','Next.js','TypeScript','Docker','Redis','Prisma','GitHub Actions','React','Tailwind CSS',
];
const ROW2 = [
  'REST APIs','GraphQL','Nginx','Ubuntu','Kali Linux','OpenAPI','Zod','JWT','Vitest','Playwright',
];

function MarqueeRow({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden mask-fade-x">
      <div className={`flex gap-3 w-max ${reverse ? 'animate-marquee-rev' : 'animate-marquee'}`}>
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-3 shrink-0">
            <span className="liquid-glass rounded-full px-4 py-1.5 text-sm font-mono text-ash whitespace-nowrap">
              {item}
            </span>
            <span className="text-copper/40 text-base select-none">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function TechStack() {
  return (
    <section className="py-16 border-y border-white/5 bg-ink overflow-hidden">
      <p className="text-center font-mono text-xs text-ash uppercase tracking-widest mb-8">
        stack que dominamos
      </p>
      <div className="flex flex-col gap-4">
        <MarqueeRow items={ROW1} />
        <MarqueeRow items={ROW2} reverse />
      </div>
    </section>
  );
}
