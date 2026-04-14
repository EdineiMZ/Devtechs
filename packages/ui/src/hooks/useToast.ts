'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal, framework-agnostic toast store shared between components.
 * Subscribers (usually a <Toaster /> consumer in the app) re-render
 * whenever a toast is added, updated or dismissed.
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'destructive';

export interface ToastOptions {
  /** Short title (bold). */
  title?: string;
  /** Body text. */
  description?: string;
  /** Semantic variant, drives color. */
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Use 0 to keep the toast until dismissed. */
  duration?: number;
}

export interface Toast extends Required<Omit<ToastOptions, 'title' | 'description'>> {
  id: string;
  title?: string;
  description?: string;
  createdAt: number;
}

type Listener = (toasts: Toast[]) => void;

const listeners = new Set<Listener>();
let memoryState: Toast[] = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener(memoryState);
}

function scheduleDismiss(id: string, duration: number) {
  if (duration <= 0) return;
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.set(
    id,
    setTimeout(() => {
      dismissToast(id);
    }, duration),
  );
}

function dismissToast(id: string) {
  memoryState = memoryState.filter((t) => t.id !== id);
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  emit();
}

function pushToast(options: ToastOptions): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const toast: Toast = {
    id,
    title: options.title,
    description: options.description,
    variant: options.variant ?? 'info',
    duration: options.duration ?? 5000,
    createdAt: Date.now(),
  };
  memoryState = [...memoryState, toast];
  emit();
  scheduleDismiss(id, toast.duration);
  return id;
}

/**
 * Imperative toast API. Can be called from anywhere (event handlers,
 * async flows, non-React code) — no context provider required.
 */
export const toast = Object.assign(
  (options: ToastOptions) => pushToast(options),
  {
    success: (options: Omit<ToastOptions, 'variant'>) =>
      pushToast({ ...options, variant: 'success' }),
    error: (options: Omit<ToastOptions, 'variant'>) =>
      pushToast({ ...options, variant: 'destructive' }),
    warning: (options: Omit<ToastOptions, 'variant'>) =>
      pushToast({ ...options, variant: 'warning' }),
    info: (options: Omit<ToastOptions, 'variant'>) =>
      pushToast({ ...options, variant: 'info' }),
    dismiss: dismissToast,
  },
);

/**
 * React hook that returns the current toast list and helper callbacks.
 * A `<Toaster />` component in the app should call this and render the
 * toasts using `@devtechs/ui` Alert / Card primitives.
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(memoryState);

  useEffect(() => {
    const listener: Listener = (next) => setToasts(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const dismiss = useCallback((id: string) => dismissToast(id), []);

  return { toasts, toast, dismiss };
}
