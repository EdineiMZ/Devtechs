'use client';

import { useEffect, useRef, useState } from 'react';

import { NewMessageComposer } from '@/components/tickets/new-message-composer';
import { TicketTimeline, type TimelineEvent } from '@/components/tickets/ticket-timeline';
import { TypingIndicator } from '@/components/tickets/typing-indicator';
import { useTicketChat } from '@/hooks/use-ticket-chat';
import type { SupportMessageDto } from '@/lib/support-socket';

export interface TicketChatProps {
  ticketId: string;
  /** JWT for the support-service socket. Server passes it as a prop;
   *  we never expose it via DOM attributes. */
  accessToken: string;
  currentUserId: string;
  isAgent: boolean;
  initialMessages: SupportMessageDto[];
  /** Current ticket status — used to lock the composer on CLOSED tickets. */
  ticketStatus: string;
}

export function TicketChat({
  ticketId,
  accessToken,
  currentUserId,
  isAgent,
  initialMessages,
  ticketStatus,
}: TicketChatProps): JSX.Element {
  const isClosed = ticketStatus === 'CLOSED';
  const {
    connected,
    joined,
    messages,
    typers,
    error,
    sendMessage,
    onKeyStroke,
  } = useTicketChat({ ticketId, accessToken, initialMessages });

  const [attachmentToast, setAttachmentToast] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  // Auto-scroll to the newest message every time the array grows.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lastMessageId]);

  // Clear the attachment toast after 4 seconds
  useEffect(() => {
    if (!attachmentToast) return;
    const t = setTimeout(() => setAttachmentToast(null), 4000);
    return () => clearTimeout(t);
  }, [attachmentToast]);

  const events: TimelineEvent[] = messages.map((message) => ({
    kind: 'message',
    message,
  }));

  const offline = !connected;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-background/40">
      {/* Connection banner — fail-soft, never blocks the page. */}
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
          />
        )}
      </div>

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
          onAttachmentUploaded={(filename) => setAttachmentToast(filename)}
        />
      </div>
    </section>
  );
}
