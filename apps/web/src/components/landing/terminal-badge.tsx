type Props = {
  children: React.ReactNode;
  variant?: 'acid' | 'copper' | 'muted';
  dot?: boolean;
  className?: string;
};

export function TerminalBadge({ children, variant = 'acid', dot = true, className = '' }: Props) {
  const styles = {
    acid:   'bg-acid/10 text-acid border-acid/25',
    copper: 'bg-copper/10 text-copper border-copper/25',
    muted:  'bg-white/5 text-ash border-white/10',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded border ${styles[variant]} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          variant === 'acid'   ? 'bg-acid animate-pulse' :
          variant === 'copper' ? 'bg-copper' : 'bg-ash'
        }`} />
      )}
      {children}
    </span>
  );
}
