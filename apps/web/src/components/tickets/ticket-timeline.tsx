import { MessageBubble, type TimelineMessage } from './message-bubble';

interface StatusEvent {
  kind: 'status';
  id: string;
  label: string;
  timestamp: string;
}

interface MessageEvent {
  kind: 'message';
  message: TimelineMessage;
}

export type TimelineEvent = StatusEvent | MessageEvent;

export function TicketTimeline({
  events,
  currentUserId,
  isAgent,
  ticketId,
}: {
  events: TimelineEvent[];
  currentUserId: string;
  isAgent: boolean;
  ticketId: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {events.map((event) => {
        if (event.kind === 'status') {
          return (
            <div
              key={event.id}
              className="relative my-1 flex items-center justify-center"
            >
              <span className="rounded-full border border-white/8 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-wider text-ash">
                {event.label}
              </span>
            </div>
          );
        }
        return (
          <MessageBubble
            key={event.message.id}
            message={event.message}
            isOwn={event.message.author.id === currentUserId}
            isAgent={isAgent}
            ticketId={ticketId}
          />
        );
      })}
    </div>
  );
}
