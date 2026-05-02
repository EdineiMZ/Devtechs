import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';

const STORAGE_KEY          = 'devtechs:config:storage_provider';
const FEATURE_FLAGS_KEY    = 'devtechs:config:feature_flags';
const EMAIL_PROVIDER_KEY   = 'devtechs:config:email_provider';
const GMAIL_CREDS_KEY      = 'devtechs:config:gmail_creds';
const SMTP_CREDS_KEY       = 'devtechs:config:smtp_creds';
const API_KEYS_KEY         = 'devtechs:config:api_keys';
const PAYMENT_PROVIDER_KEY = 'devtechs:config:payment_provider';

interface ApiKeyDef {
  key:    string;
  envVar: string;
  group:  string;
  label:  string;
}

export interface ApiKeyStatus {
  key:        string;
  label:      string;
  group:      string;
  configured: boolean;
  source:     'env' | 'redis' | 'unset';
  hint:       string | null;
}

const API_KEY_DEFS: ApiKeyDef[] = [
  // Email
  { key: 'RESEND_API_KEY',               envVar: 'RESEND_API_KEY',                  group: 'Email — Resend',           label: 'API Key' },
  // SMTP
  { key: 'SMTP_HOST',                    envVar: 'SMTP_HOST',                       group: 'Email — SMTP',             label: 'Host' },
  { key: 'SMTP_PORT',                    envVar: 'SMTP_PORT',                       group: 'Email — SMTP',             label: 'Porta' },
  { key: 'SMTP_USER',                    envVar: 'SMTP_USER',                       group: 'Email — SMTP',             label: 'Usuário' },
  { key: 'SMTP_PASS',                    envVar: 'SMTP_PASS',                       group: 'Email — SMTP',             label: 'Senha' },
  { key: 'SMTP_FROM',                    envVar: 'SMTP_FROM',                       group: 'Email — SMTP',             label: 'From' },
  // Google OAuth (login)
  { key: 'GOOGLE_CLIENT_ID',             envVar: 'GOOGLE_CLIENT_ID',                group: 'Google OAuth (Login)',     label: 'Client ID' },
  { key: 'GOOGLE_CLIENT_SECRET',         envVar: 'GOOGLE_CLIENT_SECRET',            group: 'Google OAuth (Login)',     label: 'Client Secret' },
  // GitHub OAuth (login)
  { key: 'GITHUB_CLIENT_ID',             envVar: 'GITHUB_CLIENT_ID',                group: 'GitHub OAuth (Login)',     label: 'Client ID' },
  { key: 'GITHUB_CLIENT_SECRET',         envVar: 'GITHUB_CLIENT_SECRET',            group: 'GitHub OAuth (Login)',     label: 'Client Secret' },
  // Stripe
  { key: 'STRIPE_SECRET_KEY',            envVar: 'STRIPE_SECRET_KEY',               group: 'Stripe (Pagamentos)',      label: 'Secret Key' },
  { key: 'STRIPE_PUBLISHABLE_KEY',       envVar: 'STRIPE_PUBLISHABLE_KEY',          group: 'Stripe (Pagamentos)',      label: 'Publishable Key' },
  { key: 'STRIPE_WEBHOOK_SECRET',        envVar: 'STRIPE_WEBHOOK_SECRET',           group: 'Stripe (Pagamentos)',      label: 'Webhook Secret' },
  // Mercado Pago
  { key: 'MP_ACCESS_TOKEN',             envVar: 'MP_ACCESS_TOKEN',                  group: 'Mercado Pago',             label: 'Access Token' },
  { key: 'MP_PUBLIC_KEY',               envVar: 'MP_PUBLIC_KEY',                    group: 'Mercado Pago',             label: 'Public Key' },
  { key: 'MP_WEBHOOK_SECRET',           envVar: 'MP_WEBHOOK_SECRET',                group: 'Mercado Pago',             label: 'Webhook Secret' },
  // Storage
  { key: 'STORAGE_ENDPOINT',            envVar: 'STORAGE_ENDPOINT',                 group: 'Object Storage',           label: 'Endpoint' },
  { key: 'STORAGE_ACCESS_KEY',          envVar: 'STORAGE_ACCESS_KEY',               group: 'Object Storage',           label: 'Access Key' },
  { key: 'STORAGE_SECRET_KEY',          envVar: 'STORAGE_SECRET_KEY',               group: 'Object Storage',           label: 'Secret Key' },
  { key: 'STORAGE_BUCKET',              envVar: 'STORAGE_BUCKET',                   group: 'Object Storage',           label: 'Bucket' },
  // Hostinger
  { key: 'HOSTINGER_API_TOKEN',         envVar: 'HOSTINGER_API_TOKEN',              group: 'Hostinger VPS',            label: 'API Token' },
  { key: 'HOSTINGER_API_URL',           envVar: 'HOSTINGER_API_URL',                group: 'Hostinger VPS',            label: 'API URL' },
  // Licenças
  { key: 'LICENSE_SIGNING_KEY',         envVar: 'LICENSE_SIGNING_KEY',              group: 'Licenças',                 label: 'Signing Key (Ed25519)' },
  { key: 'LICENSE_PUBLIC_KEY',          envVar: 'LICENSE_PUBLIC_KEY',               group: 'Licenças',                 label: 'Public Key' },
  // Observability
  { key: 'SENTRY_DSN',                  envVar: 'SENTRY_DSN',                       group: 'Observabilidade',          label: 'Sentry DSN' },
  { key: 'OTEL_ENDPOINT',              envVar: 'OTEL_EXPORTER_OTLP_ENDPOINT',       group: 'Observabilidade',          label: 'OTLP Endpoint' },
];

function maskValue(val: string): string {
  if (val.length <= 8) return '••••••••';
  return val.slice(0, 4) + '•'.repeat(Math.min(10, val.length - 8)) + val.slice(-4);
}

// ── Google OAuth2 token endpoint ─────────────────────────────────────────────
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface GmailCreds {
  user:         string;
  clientId:     string;
  clientSecret: string;
  refreshToken: string;
}

export interface SmtpSnapshot {
  host:      string | null;
  port:      string | null;
  user:      string | null;
  hasPass:   boolean;
  from:      string | null;
}

interface ConfigSnapshot {
  storage:         { provider: 'r2' | 'local'; source: 'redis' | 'env' };
  featureFlags:    Record<string, boolean>;
  env:             Record<string, string>;
  apiKeys:         ApiKeyStatus[];
  emailProvider:   {
    active: 'resend' | 'gmail' | 'smtp';
    gmail:  {
      user:            string | null;
      hasRefreshToken: boolean;
      clientIdHint:    string | null;
    };
    smtp:   SmtpSnapshot;
  };
  paymentProvider: { active: 'mercadopago' | 'stripe'; source: 'redis' | 'env' };
}

@Injectable()
export class DeveloperConfigService {
  private readonly logger = new Logger(DeveloperConfigService.name);

  constructor(private readonly redis: RedisService) {}

  // ── Snapshot ────────────────────────────────────────────────────────────────

  async snapshot(): Promise<ConfigSnapshot> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('FEATURE_') || key.startsWith('CONFIG_')) {
        env[key] = value ?? '';
      }
    }

    const storageRedis   = await this.redis.get(STORAGE_KEY);
    const storageRaw     = (storageRedis ?? process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
    const storageProvider: 'r2' | 'local' = storageRaw === 'r2' ? 'r2' : 'local';

    const featureFlags   = await this.listFeatureFlags();
    const emailProvider  = await this.emailProviderSnapshot();
    const apiKeys        = await this.getApiKeys();
    const paymentProvider = await this.paymentProviderSnapshot();

    return {
      storage: { provider: storageProvider, source: storageRedis ? 'redis' : 'env' },
      featureFlags,
      env,
      apiKeys,
      emailProvider,
      paymentProvider,
    };
  }

  // ── Feature flags ────────────────────────────────────────────────────────────

  async listFeatureFlags(): Promise<Record<string, boolean>> {
    const flags: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith('FEATURE_')) continue;
      flags[key] = parseBool(value);
    }
    const overrides = await this.redis.hgetall(FEATURE_FLAGS_KEY);
    for (const [key, value] of Object.entries(overrides)) {
      flags[key] = parseBool(value);
    }
    return flags;
  }

  async paymentProviderSnapshot(): Promise<{ active: 'mercadopago' | 'stripe'; source: 'redis' | 'env' }> {
    const redis = await this.redis.get(PAYMENT_PROVIDER_KEY);
    if (redis === 'stripe' || redis === 'mercadopago') {
      return { active: redis, source: 'redis' };
    }
    const envVal = (process.env.PAYMENT_PROVIDER_NAME ?? 'mercadopago').toLowerCase();
    const active: 'mercadopago' | 'stripe' = envVal === 'stripe' ? 'stripe' : 'mercadopago';
    return { active, source: 'env' };
  }

  async setPaymentProvider(provider: 'mercadopago' | 'stripe'): Promise<{ provider: string }> {
    await this.redis.set(PAYMENT_PROVIDER_KEY, provider);
    await this.redis.publish('devtechs:config:payment:changed', JSON.stringify({ provider }));
    this.logger.log(`Payment provider switched to ${provider}`);
    return { provider };
  }

  async setStorageProvider(provider: 'r2' | 'local'): Promise<{ provider: 'r2' | 'local' }> {
    if (provider !== 'r2' && provider !== 'local') {
      throw new BadRequestException('provider must be "r2" or "local"');
    }
    await this.redis.set(STORAGE_KEY, provider);
    await this.redis.publish('devtechs:config:storage:changed', JSON.stringify({ provider }));
    this.logger.log(`Storage provider switched to ${provider}`);
    return { provider };
  }

  async setFeatureFlag(flag: string, enabled: boolean): Promise<{ flag: string; enabled: boolean }> {
    const normalized = flag.toUpperCase().startsWith('FEATURE_')
      ? flag.toUpperCase()
      : `FEATURE_${flag.toUpperCase()}`;
    await this.redis.hset(FEATURE_FLAGS_KEY, normalized, enabled ? 'true' : 'false');
    await this.redis.publish('devtechs:config:feature-flag:changed', JSON.stringify({ flag: normalized, enabled }));
    this.logger.log(`Feature flag ${normalized} = ${enabled}`);
    return { flag: normalized, enabled };
  }

  // ── API Keys ─────────────────────────────────────────────────────────────────

  async getApiKeys(): Promise<ApiKeyStatus[]> {
    const overrides = await this.redis.hgetall(API_KEYS_KEY);
    return API_KEY_DEFS.map((def) => {
      const redisVal = overrides[def.key] ?? null;
      const envVal   = process.env[def.envVar] ?? null;
      const val      = redisVal ?? envVal;
      return {
        key:        def.key,
        label:      def.label,
        group:      def.group,
        configured: Boolean(val),
        source:     redisVal ? 'redis' : envVal ? 'env' : 'unset',
        hint:       val ? maskValue(val) : null,
      };
    });
  }

  async setApiKey(key: string, value: string): Promise<{ key: string }> {
    const allowed = API_KEY_DEFS.map((d) => d.key);
    if (!allowed.includes(key)) {
      throw new BadRequestException(`Unknown API key: ${key}`);
    }
    if (value) {
      await this.redis.hset(API_KEYS_KEY, key, value);
    } else {
      await this.redis.getClient().hdel(API_KEYS_KEY, key);
    }
    await this.redis.publish('devtechs:config:api-key:changed', JSON.stringify({ key }));
    this.logger.log(`API key ${key} updated`);
    return { key };
  }

  // ── Email provider ────────────────────────────────────────────────────────────

  async emailProviderSnapshot(): Promise<ConfigSnapshot['emailProvider']> {
    const active     = await this.activeEmailProvider();
    const gmailCreds = await this.redis.hgetall(GMAIL_CREDS_KEY);
    const smtpCreds  = await this.redis.hgetall(SMTP_CREDS_KEY);

    // SMTP falls back to env vars if no Redis override set
    const smtpHost = smtpCreds.host ?? process.env.SMTP_HOST ?? null;
    const smtpPort = smtpCreds.port ?? process.env.SMTP_PORT ?? null;
    const smtpUser = smtpCreds.user ?? process.env.SMTP_USER ?? null;
    const smtpFrom = smtpCreds.from ?? process.env.SMTP_FROM ?? null;

    return {
      active,
      gmail: {
        user:            gmailCreds.user          ?? null,
        hasRefreshToken: Boolean(gmailCreds.refreshToken),
        clientIdHint:    gmailCreds.clientId ? `${gmailCreds.clientId.slice(0, 12)}…` : null,
      },
      smtp: {
        host:    smtpHost,
        port:    smtpPort,
        user:    smtpUser,
        hasPass: Boolean(smtpCreds.pass ?? process.env.SMTP_PASS),
        from:    smtpFrom,
      },
    };
  }

  async activeEmailProvider(): Promise<'resend' | 'gmail' | 'smtp'> {
    const v = await this.redis.get(EMAIL_PROVIDER_KEY);
    if (v === 'gmail') return 'gmail';
    if (v === 'smtp')  return 'smtp';
    return 'resend';
  }

  async setEmailProvider(provider: 'resend' | 'gmail' | 'smtp'): Promise<{ provider: string }> {
    await this.redis.set(EMAIL_PROVIDER_KEY, provider);
    await this.redis.publish('devtechs:config:email-provider:changed', JSON.stringify({ provider }));
    this.logger.log(`Email provider switched to ${provider}`);
    return { provider };
  }

  async saveSmtpCredentials(creds: {
    host: string; port: string; user: string; pass: string; from: string;
  }): Promise<void> {
    const client = this.redis.getClient();
    await client.hset(SMTP_CREDS_KEY,
      'host', creds.host,
      'port', creds.port,
      'user', creds.user,
      'pass', creds.pass,
      'from', creds.from,
    );
    await this.redis.publish('devtechs:config:smtp-creds:changed', JSON.stringify({ user: creds.user }));
    this.logger.log(`SMTP credentials saved for ${creds.user}`);
  }

  async saveGmailCredentials(creds: GmailCreds): Promise<void> {
    const client = this.redis.getClient();
    await client.hset(GMAIL_CREDS_KEY,
      'user',          creds.user,
      'clientId',      creds.clientId,
      'clientSecret',  creds.clientSecret,
      'refreshToken',  creds.refreshToken,
    );
    await this.redis.publish('devtechs:config:gmail-creds:changed', JSON.stringify({ user: creds.user }));
    this.logger.log(`Gmail credentials saved for ${creds.user}`);
  }

  /**
   * Resolves an API key: Redis override (hgetall API_KEYS_KEY) → process.env fallback.
   * This allows keys managed via the config panel to work without a service restart.
   */
  private async resolveApiKey(key: string): Promise<string | null> {
    const overrides = await this.redis.hgetall(API_KEYS_KEY);
    return overrides[key] ?? process.env[key] ?? null;
  }

  /**
   * Build the Google OAuth2 authorization URL so the browser can open
   * the consent screen for the `gmail.send` scope.
   * Reads GOOGLE_CLIENT_ID from Redis first, then falls back to env.
   */
  async buildGmailAuthUrl(redirectUri: string): Promise<string> {
    const clientId = await this.resolveApiKey('GOOGLE_CLIENT_ID');
    if (!clientId) throw new BadRequestException('GOOGLE_CLIENT_ID not configured');

    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: 'code',
      scope:         'https://www.googleapis.com/auth/gmail.send',
      access_type:   'offline',
      prompt:        'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange an OAuth2 authorization code for tokens.
   * Saves the refresh token in Redis and returns the sender email.
   * Reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from Redis first.
   */
  async exchangeGmailCode(code: string, redirectUri: string): Promise<{ user: string }> {
    const clientId     = await this.resolveApiKey('GOOGLE_CLIENT_ID');
    const clientSecret = await this.resolveApiKey('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth credentials not configured');
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Google token exchange failed: ${err}`);
      throw new BadRequestException('Failed to exchange Google authorization code');
    }

    const tokens = await res.json() as {
      access_token:  string;
      refresh_token?: string;
      id_token?:      string;
    };

    if (!tokens.refresh_token) {
      throw new BadRequestException('No refresh_token returned — ensure access_type=offline and prompt=consent');
    }

    // Decode the id_token to get the user's email (it's a JWT, no need to verify here)
    let user = 'unknown@gmail.com';
    if (tokens.id_token) {
      try {
        const part = tokens.id_token.split('.')[1] ?? '';
        const payload = JSON.parse(
          Buffer.from(part, 'base64url').toString('utf-8'),
        ) as { email?: string };
        user = payload.email ?? user;
      } catch { /* ignore */ }
    }

    await this.saveGmailCredentials({
      user,
      clientId,
      clientSecret,
      refreshToken: tokens.refresh_token,
    });

    return { user };
  }
}

function parseBool(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
