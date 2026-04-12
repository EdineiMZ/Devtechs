import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/**
 * Operational status of a DevTechs service.
 * - `online`      → service responding normally
 * - `degradado`   → service responding but with errors / latency
 * - `offline`     → service unreachable
 * - `manutencao`  → scheduled maintenance window
 */
export type ServiceStatus = 'online' | 'degradado' | 'offline' | 'manutencao';

const STATUS_META: Record<
  ServiceStatus,
  { label: string; dot: string; text: string; ariaLabel: string }
> = {
  online: {
    label: 'Online',
    dot: 'bg-status-online',
    text: 'text-status-online',
    ariaLabel: 'Status: Online',
  },
  degradado: {
    label: 'Degradado',
    dot: 'bg-status-degraded',
    text: 'text-status-degraded',
    ariaLabel: 'Status: Degradado',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-status-offline',
    text: 'text-status-offline',
    ariaLabel: 'Status: Offline',
  },
  manutencao: {
    label: 'Manutenção',
    dot: 'bg-status-maintenance',
    text: 'text-status-maintenance',
    ariaLabel: 'Status: Em manutenção',
  },
};

export const statusIndicatorVariants = cva(
  'inline-flex items-center gap-2 font-medium',
  {
    variants: {
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

const dotSize = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
} as const;

export interface StatusIndicatorProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof statusIndicatorVariants> {
  status: ServiceStatus;
  /** Override the default translated label. */
  label?: string;
  /** Hide the textual label (dot-only mode). */
  hideLabel?: boolean;
  /** Animate the dot (pulse) to call attention. */
  pulse?: boolean;
}

/**
 * Visual indicator of a service's operational status. Renders a colored dot
 * (with optional pulse) followed by a translated label.
 */
export const StatusIndicator = forwardRef<HTMLSpanElement, StatusIndicatorProps>(
  ({ status, label, hideLabel, pulse, size = 'md', className, ...props }, ref) => {
    const meta = STATUS_META[status];
    const resolvedLabel = label ?? meta.label;
    const resolvedDotSize = dotSize[size ?? 'md'];

    return (
      <span
        ref={ref}
        role="status"
        aria-label={hideLabel ? meta.ariaLabel : undefined}
        className={cn(statusIndicatorVariants({ size }), meta.text, className)}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block rounded-full',
            resolvedDotSize,
            meta.dot,
            pulse && 'animate-pulse-slow',
          )}
        />
        {!hideLabel ? <span>{resolvedLabel}</span> : null}
      </span>
    );
  },
);
StatusIndicator.displayName = 'StatusIndicator';
