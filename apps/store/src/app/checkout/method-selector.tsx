'use client';

type Method = 'PIX' | 'BOLETO' | 'CREDIT_CARD';

const METHODS: { value: Method; label: string; icon: string; desc: string }[] = [
  {
    value: 'PIX',
    label: 'Pix',
    icon: '⚡',
    desc: 'Aprovacao instantanea',
  },
  {
    value: 'BOLETO',
    label: 'Boleto',
    icon: '📄',
    desc: 'Ate 3 dias uteis',
  },
  {
    value: 'CREDIT_CARD',
    label: 'Cartao de credito',
    icon: '💳',
    desc: 'Aprovacao imediata',
  },
];

export function MethodSelector({
  value,
  onChange,
}: {
  value: Method;
  onChange: (m: Method) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {METHODS.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          className={`flex flex-col items-center rounded-xl border-2 p-4 transition-all ${
            value === m.value
              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
              : 'border-border hover:border-primary/30'
          }`}
        >
          <span className="text-2xl">{m.icon}</span>
          <span className="mt-2 text-sm font-semibold text-foreground">{m.label}</span>
          <span className="mt-0.5 text-xs text-muted-foreground">{m.desc}</span>
        </button>
      ))}
    </div>
  );
}
