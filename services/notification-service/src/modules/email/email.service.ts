import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';

import { RedisService } from '../../redis/redis.service';

/** Name of every template shipped in `./templates/*.html`. */
export const EMAIL_TEMPLATES = [
  'email-verification',
  'login-otp',
  'contact-form',
  'contact-confirmation',
  'vacation-approved',
  'vacation-rejected',
  'payment-due',
  'welcome',
  'password-reset',
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  template: EmailTemplate | string;
  data: Record<string, unknown>;
  /**
   * Override the sender address for this specific email.
   * When omitted, falls back to the global `RESEND_FROM` env var.
   *
   * Use to give each department its own identity:
   *   - 'Suporte SZDevs <suporte@szdevs.com>'
   *   - 'RH SZDevs <rh@szdevs.com>'
   *   - 'Financeiro SZDevs <financeiro@szdevs.com>'
   *
   * Works with any address on the verified Resend domain — no extra
   * configuration needed in Resend itself.
   */
  from?: string;
  /** Optional Reply-To header. */
  replyTo?: string;
}

export type EmailProviderName = 'resend' | 'gmail';

const REDIS_PROVIDER_KEY    = 'SZDevs:config:email_provider';
const REDIS_GMAIL_CREDS_KEY = 'SZDevs:config:gmail_creds';

/**
 * EmailService â€” templated email delivery.
 *
 * Supports two providers, switchable at runtime via Redis:
 *   - `resend`  (default) â€” Resend HTTP API
 *   - `gmail`   â€” Gmail via Nodemailer + OAuth2
 *
 * Templates live in `./templates/*.html` and are cached in memory.
 * Placeholder syntax: `{{name}}` â€” always HTML-escaped.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  // --- Resend ---
  private resend: Resend | null = null;

  // --- Gmail ---
  private gmailTransporter: Transporter | null = null;
  private gmailUser: string | null = null;

  private readonly fromAddress: string;
  private readonly templatesDir: string;
  private readonly cache = new Map<string, string>();
  private readonly devMode: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.devMode     = (process.env.NODE_ENV ?? 'development') !== 'production';
    this.fromAddress = this.config.get<string>('RESEND_FROM') ?? 'SZDevs <no-reply@SZDevs.com.br>';
    this.templatesDir = join(__dirname, 'templates');
  }

  async onModuleInit(): Promise<void> {
    // --- Boot Resend (always try, even if Gmail is active) ---
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (resendKey) {
      this.resend = new Resend(resendKey);
    } else if (!this.devMode) {
      throw new Error('RESEND_API_KEY is required in production');
    } else {
      this.logger.warn('RESEND_API_KEY not set â€” Resend disabled (dev mode)');
    }

    // --- Boot Gmail if credentials exist in Redis ---
    await this.refreshGmailTransporter();

    // --- Warm template cache ---
    await Promise.all(
      EMAIL_TEMPLATES.map((n) => this.loadTemplate(n).catch(() => undefined)),
    );
    this.logger.log(
      `EmailService ready; ${this.cache.size} templates cached. Active provider: ${await this.activeProvider()}`,
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Public API
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async send(input: SendEmailInput): Promise<{ id: string | null }> {
    const html     = await this.renderTemplate(input.template, input.data);
    const provider = await this.activeProvider();

    if (provider === 'gmail') {
      return this.sendViaGmail(input, html);
    }
    return this.sendViaResend(input, html);
  }

  /** Returns which provider is currently active. */
  async activeProvider(): Promise<EmailProviderName> {
    const stored = await this.redis.get(REDIS_PROVIDER_KEY);
    if (stored === 'gmail') return 'gmail';
    return 'resend';
  }

  /**
   * Rebuild the Gmail transporter from Redis credentials.
   * Called by the config endpoint after credentials are saved.
   */
  async refreshGmailTransporter(): Promise<void> {
    const creds = await this.redis.hgetall(REDIS_GMAIL_CREDS_KEY);
    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken || !creds.user) {
      this.gmailTransporter = null;
      this.gmailUser        = null;
      return;
    }
    this.gmailUser = creds.user;
    this.gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: creds.user,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        refreshToken: creds.refreshToken,
      },
    });
    this.logger.log(`Gmail transporter initialized for ${creds.user}`);
  }

  /** Current Gmail credentials (masked) for the config snapshot. */
  async gmailCredentialsSummary(): Promise<{
    user: string | null;
    hasRefreshToken: boolean;
    clientIdHint: string | null;
  }> {
    const creds = await this.redis.hgetall(REDIS_GMAIL_CREDS_KEY);
    return {
      user:           creds.user  ?? null,
      hasRefreshToken: Boolean(creds.refreshToken),
      clientIdHint:  creds.clientId ? `${creds.clientId.slice(0, 12)}â€¦` : null,
    };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Private helpers
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async sendViaResend(
    input: SendEmailInput,
    html: string,
  ): Promise<{ id: string | null }> {
    if (!this.resend) {
      this.logger.log(
        `[dev] would send "${input.subject}" to ${recipients(input.to)} via Resend (${input.template})`,
      );
      return { id: null };
    }
    const result = await this.resend.emails.send({
      from: input.from ?? this.fromAddress,
      to: input.to,
      subject: input.subject,
      html,
      reply_to: input.replyTo,
    });
    if (result.error) {
      this.logger.error(`Resend error: ${result.error.message}`);
      throw new Error(`Resend send failed: ${result.error.message}`);
    }
    this.logger.log(`[resend] Sent ${input.template} to ${recipients(input.to)} (id: ${result.data?.id})`);
    return { id: result.data?.id ?? null };
  }

  private async sendViaGmail(
    input: SendEmailInput,
    html: string,
  ): Promise<{ id: string | null }> {
    if (!this.gmailTransporter || !this.gmailUser) {
      this.logger.warn('Gmail provider selected but transporter not ready â€” falling back to Resend');
      return this.sendViaResend(input, html);
    }
    const info = await this.gmailTransporter.sendMail({
      from: input.from ?? this.gmailUser,
      to: Array.isArray(input.to) ? input.to.join(', ') : input.to,
      subject: input.subject,
      html,
      replyTo: input.replyTo,
    }) as { messageId?: string };
    this.logger.log(`[gmail] Sent ${input.template} to ${recipients(input.to)} (messageId: ${info.messageId ?? 'n/a'})`);
    return { id: info.messageId ?? null };
  }

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
    const raw  = await readFile(file, 'utf-8');
    this.cache.set(name, raw);
    return raw;
  }
}

// â”€â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function recipients(to: string | string[]): string {
  return Array.isArray(to) ? to.join(', ') : to;
}

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
