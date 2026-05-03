import { Avatar, AvatarFallback } from '@szdevs/ui';

/**
 * Shared message shape used by REST (`TicketMessageDto`) AND the
 * WebSocket payload (`SupportMessageDto`). Both expose the fields
 * below — `attachments` is optional because the socket frame
 * doesn't carry them.
 */
export interface TimelineMessage {
  id: string;
  body: string;
  isInternal: boolean;
  author: { id: string; name: string | null; email: string };
  createdAt: string;
  attachments?: Array<{
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    fileKey: string;
  }>;
}

/**
 * Format a timestamp as a Portuguese relative phrase (`há 2 minutos`)
 * using `Intl.RelativeTimeFormat`. Falls back to the absolute time
 * if the value is older than a week.
 */
function relative(iso: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';
  const diffSec = Math.floor((target - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec > 7 * 24 * 3600) {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (absSec < 60) return rtf.format(diffSec, 'second');
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (absSec < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

function initials(name: string | null, email: string): string {
  const source = name && name.trim().length > 0 ? name : email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export interface MessageBubbleProps {
  message: TimelineMessage;
  /** True if the viewer is the author. Aligns the bubble to the right. */
  isOwn: boolean;
  /** True if the viewer is a support agent. Required to render
   *  internal notes — non-agents should never see internal notes
   *  even if the data leaks through. */
  isAgent: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  isAgent,
}: MessageBubbleProps): JSX.Element | null {
  // Defense-in-depth: even if an internal note slipped past the
  // backend filter (e.g. agent viewing the same payload), hide it
  // from non-agent viewers at the render layer.
  if (message.isInternal && !isAgent) return null;

  const showInternalChip = message.isInternal && isAgent;

  return (
    <div
      className={`flex w-full gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      data-testid="message-bubble"
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback>
          {initials(message.author.name, message.author.email)}
        </AvatarFallback>
      </Avatar>
      <div
        className={`flex max-w-[75%] flex-col gap-1 ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
        <div className="flex items-center gap-2 text-xs text-ash">
          <span className="font-medium text-foreground">
            {message.author.name ?? message.author.email}
          </span>
          <time dateTime={message.createdAt}>{relative(message.createdAt)}</time>
          {showInternalChip ? (
            <span
              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300"
              data-testid="internal-chip"
            >
              Nota interna
            </span>
          ) : null}
        </div>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
            showInternalChip
              ? 'border border-amber-500/30 bg-amber-500/5 text-amber-100'
              : isOwn
                ? 'bg-copper/15 text-foreground'
                : 'bg-secondary text-foreground'
          }`}
        >
          {message.body}
        </div>
      </div>
    </div>
  );
}
