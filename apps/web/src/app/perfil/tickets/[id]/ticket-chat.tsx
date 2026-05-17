'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { NewMessageComposer } from '@/components/tickets/new-message-composer';
import { TicketTimeline, type TimelineEvent } from '@/components/tickets/ticket-timeline';
import { TypingIndicator } from '@/components/tickets/typing-indicator';
import { useTicketChat } from '@/hooks/use-ticket-chat';
import { getTicket, type TicketAttachmentDto, type TicketMessageDto } from '@/lib/support-api';
import type { SupportMessageDto } from '@/lib/support-socket';

export interface TicketChatProps {
  ticketId: string;
  accessToken: string;
  currentUserId: string;
  isAgent: boolean;
  initialMessages: SupportMessageDto[];
  initialTicketAttachments?: TicketAttachmentDto[];
  ticketStatus: string;
}

/** Merge REST messages (with attachments) into socket messages (without). */
function mergeAttachments(
  socketMsgs: SupportMessageDto[],
  restMsgs: TicketMessageDto[],
): SupportMessageDto[] {
  const byId = new Map(restMsgs.map((m) => [m.id, m]));
  return socketMsgs.map((sm) => {
    const rest = byId.get(sm.id);
    if (rest && rest.attachments.length > 0) {
      return { ...sm, attachments: rest.attachments };
    }
    return sm;
  });
}

export function TicketChat({
  ticketId,
  accessToken,
  currentUserId,
  isAgent,
  initialMessages,
  initialTicketAttachments,
  ticketStatus,
}: TicketChatProps): JSX.Element {
  const isClosed = ticketStatus === 'CLOSED';
  const {
    connected,
    joined,
    messages: socketMessages,
    typers,
    error,
    sendMessage,
    onKeyStroke,
  } = useTicketChat({ ticketId, accessToken, initialMessages });

  // REST-backed attachment data layered on top of socket messages.
  const [restMessages, setRestMessages] = useState<TicketMessageDto[]>([]);
  // Ticket-level attachments (not linked to any message).
  const [ticketAttachments, setTicketAttachments] = useState<TicketAttachmentDto[]>(
    initialTicketAttachments ?? [],
  );

  const [attachmentToast, setAttachmentToast] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastMessageId = socketMessages[socketMessages.length - 1]?.id;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lastMessageId]);

  useEffect(() => {
    if (!attachmentToast) return;
    const t = setTimeout(() => setAttachmentToast(null), 4000);
    return () => clearTimeout(t);
  }, [attachmentToast]);

  const refreshAttachments = useCallback(async () => {
    const res = await getTicket(ticketId, accessToken);
    if (res.ok) {
      const detail = res.data as { messages: TicketMessageDto[]; attachments: TicketAttachmentDto[] };
      setRestMessages(detail.messages ?? []);
      setTicketAttachments(detail.attachments ?? []);
    }
  }, [ticketId, accessToken]);

  const messages = mergeAttachments(socketMessages, restMessages);

  const events: TimelineEvent[] = messages.map((message) => ({
    kind: 'message',
    message,
  }));

  const offline = !connected;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-background/40">
      {offline ? (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-300"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          Conexão perdida — tentando reconectar…
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive"
        >
          {error.message}
        </div>
      ) : null}
      {attachmentToast ? (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-400">
          Arquivo <strong>{attachmentToast}</strong> enviado com sucesso.
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        className="flex max-h-[60vh] min-h-[300px] flex-col gap-4 overflow-y-auto px-5 py-5"
      >
        {events.length === 0 ? (
          <div className="m-auto text-sm text-ash">
            Nenhuma mensagem ainda. Seja o primeiro a responder!
          </div>
        ) : (
          <TicketTimeline
            events={events}
            currentUserId={currentUserId}
            isAgent={isAgent}
            ticketId={ticketId}
          />
        )}
      </div>

      {ticketAttachments.length > 0 ? (
        <div className="border-t border-white/8 px-5 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ash">
            Arquivos anexados ({ticketAttachments.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {ticketAttachments.map((a) => (
              <a
                key={a.id}
                href={`/api/download/${ticketId}/${a.id}`}
                download={a.filename}
                className={`group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                  a.isPrivate && isAgent
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10'
                    : 'border-white/10 bg-white/[0.05] text-ash hover:bg-white/10 hover:text-foreground'
                }`}
                title={`Baixar ${a.filename}`}
              >
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="max-w-[160px] truncate font-medium">{a.filename}</span>
                <span className="text-[10px] opacity-60">
                  {a.size < 1024 * 1024
                    ? `${(a.size / 1024).toFixed(1)} KB`
                    : `${(a.size / (1024 * 1024)).toFixed(1)} MB`}
                </span>
                {a.isPrivate && isAgent ? (
                  <span className="ml-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                    Privado
                  </span>
                ) : null}
                <svg
                  className="h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
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
        </div>
      ) : null}

      <div className="border-t border-white/8 px-3 pb-3 pt-2">
        {!isClosed && (
          <TypingIndicator typers={typers.filter((t) => t.userId !== currentUserId)} />
        )}
        <NewMessageComposer
          onSend={(body, internal) => sendMessage(body, internal)}
          onKeyStroke={onKeyStroke}
          isAgent={isAgent}
          disabled={!joined}
          isClosed={isClosed}
          ticketId={ticketId}
          accessToken={accessToken}
          onAttachmentUploaded={(filename) => {
            setAttachmentToast(filename);
            void refreshAttachments();
          }}
        />
      </div>
    </section>
  );
}
