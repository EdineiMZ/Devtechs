import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/**
 * Button variants driven by CVA. Supports intent + size and a11y focus rings.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-background',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/80',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-secondary dark:text-secondary-foreground',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-transparent dark:hover:bg-accent',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent dark:hover:text-accent-foreground',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:hover:bg-destructive/80',
        link: 'text-primary underline-offset-4 hover:underline dark:text-primary',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as a child component (via Radix Slot) rather than a <button>. */
  asChild?: boolean;
  /** Show a spinner and disable the button while true. */
  loading?: boolean;
}

/**
 * Accessible button component with intent/size variants and loading state.
 *
 * When `asChild` is true we render a Radix `Slot` that clones the single
 * child element and merges the button's classes onto it. `Slot` uses
 * `React.Children.only` internally, so we MUST pass it exactly one child
 * — this is why the loading spinner is rendered only on the plain-button
 * branch. Callers that want a loading state should keep `asChild` off;
 * `asChild` is meant for composition with routed <Link> elements where
 * a native <button> would break navigation semantics.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
