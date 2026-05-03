'use client';

import { useState } from 'react';

import { Button } from '@szdevs/ui';

/**
 * One-time display of recovery codes. The user MUST acknowledge
 * (by clicking "Já guardei") before the panel disappears, because
 * the codes are not retrievable later — only the bcrypt hashes
 * remain in the DB.
 *
 * We provide three actions:
 *   - "Copiar" — clipboard write of the join('\n') list
 *   - "Baixar .txt" — a download as a plain-text file
 *   - "Imprimir" — opens a print dialog with just the codes
 *
 * Acknowledgement clears the codes from React state — the parent
 * passes a callback that wipes its own copy too.
 */
export function RecoveryCodes({
  codes,
  onAcknowledge,
}: {
  codes: string[];
  onAcknowledge: () => void;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  function copyToClipboard(): void {
    void navigator.clipboard.writeText(codes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadTxt(): void {
    const blob = new Blob(
      [
        'SZDevs - Códigos de recuperação 2FA\n',
        '====================================\n',
        'Cada código pode ser usado uma única vez.\n',
        'Guarde este arquivo em local seguro.\n\n',
        codes.join('\n'),
        '\n',
      ],
      { type: 'text/plain;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SZDevs-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printCodes(): void {
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(`<!doctype html>
<html><head><title>Códigos de recuperação 2FA — SZDevs</title>
<style>body{font-family:system-ui,Segoe UI,sans-serif;padding:32px}
h1{font-size:20px;margin:0 0 8px}p{color:#555;margin:0 0 16px;font-size:13px}
ul{font-family:ui-monospace,monospace;font-size:18px;line-height:1.7;list-style:none;padding:0}
li{border-bottom:1px dashed #ccc;padding:6px 0}</style></head>
<body><h1>Códigos de recuperação 2FA</h1>
<p>SZDevs · Cada código pode ser usado uma única vez.</p>
<ul>${codes.map((c) => `<li>${c}</li>`).join('')}</ul>
<script>window.onload=()=>window.print()</script>
</body></html>`);
    w.document.close();
  }

  return (
    <div
      className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6"
      role="region"
      aria-label="Códigos de recuperação"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-sm text-amber-300"
        >
          !
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Salve seus códigos de recuperação
          </h3>
          <p className="mt-1 text-xs text-ash">
            Cada código pode ser usado <strong>uma única vez</strong> caso você
            perca acesso ao app autenticador. Eles <strong>não serão mostrados
            novamente</strong> — guarde-os em um gerenciador de senhas ou
            imprima.
          </p>
        </div>
      </div>

      <ul
        className="mt-4 grid grid-cols-2 gap-2 rounded-md border border-white/8 bg-background p-3 sm:grid-cols-4"
        data-testid="recovery-codes-grid"
      >
        {codes.map((code) => (
          <li
            key={code}
            className="select-all rounded bg-secondary/40 px-2 py-1.5 text-center font-mono text-sm tracking-wider text-foreground"
          >
            {code}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copyToClipboard}>
          {copied ? 'Copiado!' : 'Copiar'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={downloadTxt}>
          Baixar .txt
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={printCodes}>
          Imprimir
        </Button>
        <span className="flex-1" />
        <Button type="button" size="sm" variant="primary" onClick={onAcknowledge}>
          Já guardei os códigos
        </Button>
      </div>
    </div>
  );
}
