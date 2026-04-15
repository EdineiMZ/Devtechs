import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/** Name of every template shipped in `./templates/*.html`. */
export const EMAIL_TEMPLATES = [
  'email-verification',
  'contact-form',
  'contact-confirmation',
  'vacation-approved',
  'vacation-rejected',
  'payment-due',
  'welcome',
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  template: EmailTemplate | string;
  data: Record<string, unknown>;
  /** Optional Reply-To header. Used by the contact-form relay so
   *  hitting Reply in the ops inbox goes back to the customer. */
  replyTo?: string;
}

/**
 * EmailService — templated email delivery via Resend.
 *
 * Templates live in `./templates/*.html` and are cached in memory
 * on first use. The cache keeps a ~200KB footprint across all
 * templates and eliminates the per-send disk hit.
 *
 * Placeholder syntax: `{{name}}`. HTML-escapes every value by
 * default so a malicious payload never bleeds into the rendered
 * markup. The `{{{raw}}}` triple-brace form is intentionally NOT
 * supported — every send goes through escaping.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly fromAddress: string;
  private readonly templatesDir: string;
  private readonly cache = new Map<string, string>();
  private readonly devMode: boolean;

  constructor(private readonly config: ConfigService) {
    this.devMode = (process.env.NODE_ENV ?? 'development') !== 'production';
    this.fromAddress =
      this.config.get<string>('RESEND_FROM') ??
      'DevTechs <no-reply@devtechs.com.br>';
    this.templatesDir = join(__dirname, 'templates');
  }

  async onModuleInit(): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      if (this.devMode) {
        this.logger.warn(
          'RESEND_API_KEY not configured — email sends will be logged instead of delivered (dev mode)',
        );
        return;
      }
      throw new Error('RESEND_API_KEY is required in production');
    }
    this.resend = new Resend(apiKey);
    // Warm the template cache so the first real send doesn't pay
    // the disk-read cost. Silent fallback if a template file is
    // missing — we'll re-check on actual use.
    await Promise.all(
      EMAIL_TEMPLATES.map((name) => this.loadTemplate(name).catch(() => undefined)),
    );
    this.logger.log(`Resend client ready; ${this.cache.size} templates cached`);
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  async send(input: SendEmailInput): Promise<{ id: string | null }> {
    const html = await this.renderTemplate(input.template, input.data);

    if (!this.resend) {
      // Dev fallback — log and pretend-send. Avoids accidental
      // traffic to Resend from local development.
      this.logger.log(
        `[dev] would send "${input.subject}" to ${Array.isArray(input.to) ? input.to.join(', ') : input.to} using ${input.template}`,
      );
      return { id: null };
    }

    const result = await this.resend.emails.send({
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      html,
      reply_to: input.replyTo,
    });

    if (result.error) {
      this.logger.error(
        `Resend error sending ${input.template} to ${Array.isArray(input.to) ? input.to.join(', ') : input.to}: ${result.error.message}`,
      );
      throw new Error(`Resend send failed: ${result.error.message}`);
    }

    this.logger.log(
      `Sent ${input.template} to ${Array.isArray(input.to) ? input.to.join(', ') : input.to} (id: ${result.data?.id ?? 'unknown'})`,
    );
    return { id: result.data?.id ?? null };
  }

  // -------------------------------------------------------------------
  // Template rendering
  // -------------------------------------------------------------------

  private async renderTemplate(
    template: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const raw = await this.loadTemplate(template);
    return raw.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
      const value = resolvePath(data, key);
      if (value === undefined || value === null) return '';
      return escapeHtml(String(value));
    });
  }

  private async loadTemplate(name: string): Promise<string> {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const file = join(this.templatesDir, `${name}.html`);
    const raw = await readFile(file, 'utf-8');
    this.cache.set(name, raw);
    return raw;
  }
}

/** Resolve `"a.b.c"` against `{ a: { b: { c: 1 } } }`. */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = obj;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in (cursor as object)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
