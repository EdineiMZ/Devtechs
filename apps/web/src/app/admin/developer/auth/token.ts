import { createHmac, timingSafeEqual } from 'crypto';

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? 'dev-fallback-secret';
}

export function makeDevAccessToken(exp: number): string {
  const sig = createHmac('sha256', getSecret()).update(String(exp)).digest('hex');
  return `${exp}.${sig}`;
}

export function verifyDevAccessToken(token: string): boolean {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;
  const expStr = token.slice(0, dot);
  const sig    = token.slice(dot + 1);
  const exp    = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp) return false;
  const expected = createHmac('sha256', getSecret()).update(expStr).digest('hex');
  const a = Buffer.from(sig,      'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
