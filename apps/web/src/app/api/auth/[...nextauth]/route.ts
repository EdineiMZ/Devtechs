/**
 * NextAuth v5 API route.
 *
 * The v5 handler exposes `{ GET, POST }` as a single `handlers`
 * object on the configured instance. We destructure it here so the
 * App Router picks up both method exports. Everything (sign-in,
 * sign-out, callbacks, CSRF, session) runs through this catch-all.
 *
 * Server components, client components, and the middleware all
 * import `auth`, `signIn`, and `signOut` directly from `@/auth`
 * instead.
 */
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
