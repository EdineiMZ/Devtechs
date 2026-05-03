import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../lib/cn';

export const inputVariants = cva(
  // Base — dark terminal aesthetic: near-transparent background, whisper-thin border,
  // copper focus ring. All colours back to CSS variables so they follow the app's
  // design tokens and resolve in both light/dark contexts.
  'flex w-full rounded-lg border bg-white/[0.03] text-sm text-foreground transition-colors ' +
  'placeholder:text-ash/40 ' +
  'focus:outline-none focus:ring-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'file:border-0 file:bg-transparent file:text-sm file:font-medium',
  {
    variants: {
      variant: {
        default:
          'border-white/8 focus:border-copper/40 focus:ring-copper/20',
        error:
          'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20',
        success:
          'border-emerald-500/40 focus:border-emerald-500/60 focus:ring-emerald-500/20',
      },
      size: {
        sm: 'h-8 px-2 text-xs',
        md: 'h-10 px-3 py-2',
        lg: 'h-11 px-4 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'md',
    },
  },
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Visible label rendered above the input. */
  label?: ReactNode;
  /** Helper text shown below the input. */
  hint?: ReactNode;
  /** Error message; when provided forces the `error` variant. */
  error?: string;
}

/**
 * Text input with optional label, hint and error message. Associates
 * label/hint with the input via aria-describedby for accessibility.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, label, hint, error, id, ...props }, ref) => {
    const generatedId  = useId();
    const inputId      = id ?? `input-${generatedId}`;
    const hintId       = hint  ? `${inputId}-hint`  : undefined;
    const errorId      = error ? `${inputId}-error` : undefined;
    const describedBy  = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-ash"
          >
            {label}
          </label>
        ) : null}

        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={cn(
            inputVariants({ variant: error ? 'error' : variant, size }),
            className,
          )}
          {...props}
        />

        {hint && !error ? (
          <p id={hintId} className="text-xs text-ash/60">
            {hint}
          </p>
        ) : null}

        {error ? (
          <p id={errorId} role="alert" className="text-xs text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
