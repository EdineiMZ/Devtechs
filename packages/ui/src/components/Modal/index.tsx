import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';

import { cn } from '../../lib/cn';

/**
 * Accessible modal built on top of Radix Dialog.
 *
 * @example
 *   <Modal open={open} onOpenChange={setOpen} title="Confirmação">
 *     <p>Tem certeza?</p>
 *   </Modal>
 */
export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** If false, clicking the overlay/pressing ESC will not close the modal. */
  dismissable?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissable = true,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-fade-in dark:bg-black/70" />
        <Dialog.Content
          onEscapeKeyDown={(e) => !dismissable && e.preventDefault()}
          onPointerDownOutside={(e) => !dismissable && e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-border bg-background p-6 shadow-lg animate-fade-in',
            'dark:bg-background dark:text-foreground',
          )}
        >
          {title ? (
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              {title}
            </Dialog.Title>
          ) : null}
          {description ? (
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {description}
            </Dialog.Description>
          ) : null}

          {children ? <div className="mt-4">{children}</div> : null}

          {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}

          {dismissable ? (
            <Dialog.Close
              aria-label="Fechar"
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Low-level primitives for custom layouts
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

export const ModalFooter = forwardRef<
  ElementRef<'div'>,
  ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex justify-end gap-2', className)} {...props} />
));
ModalFooter.displayName = 'ModalFooter';
