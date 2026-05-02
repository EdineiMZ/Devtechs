/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';

import { MessageBubble } from '@/components/tickets/message-bubble';
import { NewMessageComposer } from '@/components/tickets/new-message-composer';
import { TicketCard } from '@/components/tickets/ticket-card';
import type { TicketListItemDto, TicketMessageDto } from '@/lib/support-api';

// next/link's default behaviour is fine in jsdom — the component just
// renders an <a> with the href, which is exactly what we assert on.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

describe('TicketCard', () => {
  const ticket: TicketListItemDto = {
    id: 't-1',
    number: 42,
    title: 'Problema com nota fiscal',
    status: 'OPEN',
    priority: 'HIGH',
    category: 'BUG',
    client: { id: 'u-1', name: 'Maria', email: 'maria@cliente.com' },
    assignee: null,
    slaDeadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    rating: null,
    tags: ['nf-e'],
    messageCount: 2,
    attachmentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renderiza titulo, numero e status', () => {
    render(<TicketCard ticket={ticket} />);
    expect(screen.getByText('Problema com nota fiscal')).toBeInTheDocument();
    expect(screen.getByText(/#42/)).toBeInTheDocument();
    // status badge label "Aberto" comes from TicketStatusBadge
    expect(screen.getByText(/Aberto/i)).toBeInTheDocument();
  });

  it('aponta para a rota de detalhe do cliente por padrao', () => {
    render(<TicketCard ticket={ticket} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/perfil/tickets/t-1');
  });
});

describe('MessageBubble', () => {
  const baseMessage: TicketMessageDto = {
    id: 'm-1',
    body: 'Aqui vai uma resposta',
    isInternal: false,
    author: { id: 'u-2', name: 'Suporte', email: 'suporte@dev.com' },
    attachments: [],
    createdAt: new Date().toISOString(),
  };

  it('renderiza o corpo da mensagem', () => {
    render(<MessageBubble message={baseMessage} isOwn={false} isAgent={false} />);
    expect(screen.getByText('Aqui vai uma resposta')).toBeInTheDocument();
  });

  it('esconde nota interna quando isAgent=false', () => {
    const { container } = render(
      <MessageBubble
        message={{ ...baseMessage, isInternal: true }}
        isOwn={false}
        isAgent={false}
      />,
    );
    // O componente retorna null para nota interna sem permissao.
    expect(container.firstChild).toBeNull();
  });

  it('mostra chip "Nota interna" quando isAgent=true', () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, isInternal: true }}
        isOwn={false}
        isAgent={true}
      />,
    );
    expect(screen.getByTestId('internal-chip')).toBeInTheDocument();
  });
});

describe('NewMessageComposer', () => {
  it('chama onSend ao apertar Enter', () => {
    const onSend = jest.fn();
    render(<NewMessageComposer onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Olá mundo' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Olá mundo', false);
  });

  it('NAO chama onSend ao apertar Shift+Enter', () => {
    const onSend = jest.fn();
    render(<NewMessageComposer onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'linha 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('NAO renderiza toggle de nota interna sem isAgent', () => {
    render(<NewMessageComposer onSend={jest.fn()} />);
    expect(screen.queryByText(/nota interna/i)).not.toBeInTheDocument();
  });

  it('renderiza toggle de nota interna quando isAgent=true', () => {
    render(<NewMessageComposer onSend={jest.fn()} isAgent />);
    expect(screen.getByText(/nota interna/i)).toBeInTheDocument();
  });
});
