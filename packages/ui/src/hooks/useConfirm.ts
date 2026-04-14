'use client';

import { useCallback, useRef, useState } from 'react';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual variant of the confirm button. */
  tone?: 'default' | 'destructive';
}

export interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

/**
 * Imperative confirm dialog hook. Pair it with a <Modal /> in the consumer
 * component to render the UI — the hook exposes `state` and handlers and
 * resolves a promise with `true` / `false` when the user makes a choice.
 *
 * @example
 *   const confirm = useConfirm();
 *
 *   async function handleDelete() {
 *     const ok = await confirm.ask({
 *       title: 'Remover item?',
 *       description: 'Esta ação não pode ser desfeita.',
 *       tone: 'destructive',
 *     });
 *     if (ok) await deleteItem();
 *   }
 *
 *   // In JSX:
 *   <Modal
 *     open={confirm.state.open}
 *     onOpenChange={(o) => !o && confirm.cancel()}
 *     title={confirm.state.title}
 *     description={confirm.state.description}
 *     footer={
 *       <>
 *         <Button variant="ghost" onClick={confirm.cancel}>
 *           {confirm.state.cancelLabel ?? 'Cancelar'}
 *         </Button>
 *         <Button
 *           variant={confirm.state.tone === 'destructive' ? 'destructive' : 'primary'}
 *           onClick={confirm.confirm}
 *         >
 *           {confirm.state.confirmLabel ?? 'Confirmar'}
 *         </Button>
 *       </>
 *     }
 *   />
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({ open: false });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const ask = useCallback((options: ConfirmOptions = {}) => {
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const confirm = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const cancel = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return { state, ask, confirm, cancel };
}
