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
    isPrivate?: boolean;
  }>;
}

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string): JSX.Element {
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  if (isImage) {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (isPdf) {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

export interface MessageBubbleProps {
  message: TimelineMessage;
  /** True if the viewer is the author. Aligns the bubble to the right. */
  isOwn: boolean;
  /** True if the viewer is a support agent. Required to render
   *  internal notes — non-agents should never see internal notes
   *  even if the data leaks through. */
  isAgent: boolean;
  /** Ticket ID — required to build attachment download URLs. */
  ticketId: string;
}

export function MessageBubble({
  message,
  isOwn,
  isAgent,
  ticketId,
}: MessageBubbleProps): JSX.Element | null {
  if (message.isInternal && !isAgent) return null;

  const showInternalChip = message.isInternal && isAgent;
  const attachments = message.attachments ?? [];

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

        {/* Attachment list */}
        {attachments.length > 0 ? (
          <div className={`flex flex-col gap-1.5 ${isOwn ? 'items-end' : 'items-start'}`}>
            {attachments.map((a) => (
              <a
                key={a.id}
                href={`/api/download/${ticketId}/${a.id}`}
                download={a.filename}
                className={`group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                  a.isPrivate
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10'
                    : 'border-white/10 bg-white/[0.05] text-ash hover:bg-white/10 hover:text-foreground'
                }`}
                title={`Baixar ${a.filename}`}
              >
                {fileIcon(a.mimeType)}
                <span className="max-w-[180px] truncate font-medium">{a.filename}</span>
                <span className="text-[10px] opacity-60">{formatBytes(a.size)}</span>
                {a.isPrivate && isAgent ? (
                  <span className="ml-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                    Privado
                  </span>
                ) : null}
                <svg
                  className="h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
