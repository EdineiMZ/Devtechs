'use client';

import type { TypingEntry } from '@/lib/support-socket';

/**
 * Small floating row that shows who's currently typing in the room.
 * The animation is pure CSS (Tailwind `animate-bounce` with stagger
 * via inline style delay) so no JS frame loop is needed.
 */
export function TypingIndicator({
  typers,
}: {
  typers: TypingEntry[];
}): JSX.Element | null {
  if (typers.length === 0) return null;

  const names =
    typers.length === 1
      ? typers[0]!.name
      : typers.length === 2
        ? `${typers[0]!.name} e ${typers[1]!.name}`
        : `${typers[0]!.name} e mais ${typers.length - 1} pessoas`;

  return (
    <div
      className="flex items-center gap-2 px-1 py-1 text-xs text-ash"
      data-testid="typing-indicator"
    >
      <span className="flex gap-0.5">
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: '300ms' }}
        />
      </span>
      <span>{names} digitando…</span>
    </div>
  );
}
