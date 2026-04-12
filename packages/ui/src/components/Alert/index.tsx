import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../lib/cn';

export const alertVariants = cva(
  'relative w-full rounded-lg border p-4 text-sm [&>svg]:mr-3 [&>svg]:h-5 [&>svg]:w-5 flex items-start gap-3',
  {
    variants: {
      variant: {
        info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-200',
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200',
        warning:
          'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200',
        destructive:
          'border-destructive/40 bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/20',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

const iconByVariant = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  destructive: XCircle,
} as const;

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: ReactNode;
  /** Hide the default icon. */
  hideIcon?: boolean;
}

/** Inline status alert with semantic variants and an icon. */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, hideIcon, children, ...props }, ref) => {
    const Icon = iconByVariant[variant ?? 'info'];
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {!hideIcon ? <Icon aria-hidden="true" /> : null}
        <div className="flex-1">
          {title ? <div className="mb-1 font-medium leading-none">{title}</div> : null}
          {children ? <div className="text-sm opacity-90">{children}</div> : null}
        </div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';
