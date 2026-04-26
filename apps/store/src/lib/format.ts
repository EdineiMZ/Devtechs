/** Format decimal string/number as BRL currency */
export function formatPrice(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

/** Format ISO date string to pt-BR locale */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format ISO date with time */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Human-readable payment method */
export function formatMethod(method: string): string {
  const map: Record<string, string> = {
    PIX: 'Pix',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartao de credito',
    DEBIT_CARD: 'Cartao de debito',
  };
  return map[method] ?? method;
}

/** Human-readable subscription status */
export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Ativa',
    TRIALING: 'Periodo de teste',
    PAST_DUE: 'Pagamento pendente',
    CANCELLED: 'Cancelada',
    EXPIRED: 'Expirada',
  };
  return map[status] ?? status;
}

/** Payment status label */
export function formatPaymentStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pendente',
    PAID: 'Pago',
    FAILED: 'Falhou',
    REFUNDED: 'Reembolsado',
    EXPIRED: 'Expirado',
  };
  return map[status] ?? status;
}

/** Days until a date */
export function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}
