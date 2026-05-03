'use client';

import { Button } from '@szdevs/ui';
import { useEffect, useRef, useState } from 'react';

import { uploadAttachment } from '@/lib/support-api';

export interface NewMessageComposerProps {
  /** Called with the message body and the internal-note flag. */
  onSend: (body: string, isInternal: boolean) => void;
  /** Called on every keystroke for the typing indicator. */
  onKeyStroke?: () => void;
  /** Render the "internal note" toggle (agents only). */
  isAgent?: boolean;
  /** Render-blocking flag — true when not yet joined to the room. */
  disabled?: boolean;
  /**
   * When true the composer is replaced by a "ticket finalizado" notice.
   * No messages can be sent on a CLOSED ticket.
   */
  isClosed?: boolean;
  placeholder?: string;
  /** Ticket ID for file uploads. Required to enable file attachment. */
  ticketId?: string;
  /** Access token for REST file upload. */
  accessToken?: string;
  /** Called after a file is successfully uploaded. */
  onAttachmentUploaded?: (filename: string) => void;
}

/**
 * Resizing textarea + send button with optional file attachment support.
 * Keyboard contract:
 *   - Enter sends.
 *   - Shift+Enter inserts a newline.
 * Agents can toggle "internal note". Files can be attached via the
 * paperclip button and are uploaded via the REST endpoint independently.
 */
export function NewMessageComposer({
  onSend,
  onKeyStroke,
  isAgent = false,
  disabled = false,
  isClosed = false,
  placeholder = 'Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)',
  ticketId,
  accessToken,
  onAttachmentUploaded,
}: NewMessageComposerProps): JSX.Element {
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autosize: keep the textarea from sprouting scrollbars on every
  // keystroke until it crosses ~6 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [body]);

  function submit(): void {
    const trimmed = body.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, isAgent && isInternal);
    setBody('');
    setIsInternal(false);
  }

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!file || !ticketId || !accessToken) return;

    setUploading(true);
    setUploadError(null);

    const result = await uploadAttachment(ticketId, file, accessToken);

    setUploading(false);
    // Reset so the same file can be re-selected after an error.
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (result.ok) {
      onAttachmentUploaded?.(file.name);
    } else {
      const errData = result.data as { message?: string };
      setUploadError(errData.message ?? 'Falha ao enviar arquivo.');
    }
  }

  const canAttach = Boolean(ticketId && accessToken) && !disabled && !isClosed;

  // Closed tickets: replace the composer with an informative notice.
  if (isClosed) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-ash">
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-10a4 4 0 100 8 4 4 0 000-8z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 11V7a5 5 0 00-10 0v4M5 11h14a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2z"
          />
        </svg>
        Chamado finalizado — não é possível enviar novas mensagens.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.05] p-3">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          onKeyStroke?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
        className="resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground placeholder:text-ash focus:outline-none disabled:opacity-60"
      />
      {uploadError ? (
        <p className="px-2 text-xs text-destructive">{uploadError}</p>
      ) : null}
      <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-2">
        <div className="flex items-center gap-3 text-xs text-ash">
          {isAgent ? (
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/8 accent-amber-500"
              />
              <span
                className={`select-none ${
                  isInternal ? 'text-amber-300' : 'text-ash'
                }`}
              >
                Nota interna
              </span>
            </label>
          ) : null}
          {canAttach ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { void handleFileChange(e); }}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded text-ash transition-colors hover:text-foreground disabled:opacity-50"
                title="Anexar arquivo"
              >
                {uploading ? (
                  <span className="text-sky-400">Enviando…</span>
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                )}
              </button>
            </>
          ) : null}
          {disabled ? (
            <span className="text-amber-300">Aguardando conexão…</span>
          ) : null}
        </div>
        <Button
          size="sm"
          variant={isInternal ? 'secondary' : 'primary'}
          disabled={disabled || body.trim().length === 0}
          onClick={submit}
          type="button"
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}
