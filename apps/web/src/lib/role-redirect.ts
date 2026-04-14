/**
 * Role-based post-login routing.
 *
 * Maps a user's primary role to the landing route they should see
 * immediately after authentication. Mapping is case-insensitive so
 * uppercase role names (`ADMIN`) from the spec and lowercase names
 * (`admin`) from the seeder both resolve to the same target.
 *
 * Unmapped roles fall back to `/perfil` as a neutral default — users
 * still have a page to land on instead of being stuck in a redirect
 * loop if a new role slips into the system without a mapping.
 *
 * For pages that live in sibling apps (suporte, rh, financeiro) the
 * value points at the nginx-routed public URL when available;
 * otherwise it returns the local path so dev without nginx still
 * works.
 */

const DEFAULT_REDIRECT = '/perfil';

const ROLE_REDIRECTS: Record<string, string> = {
  client: '/perfil',
  admin: '/admin',
  support: '/suporte/chamados',
  rh: '/rh',
  finance: '/financeiro',
  // Legacy / alternate spellings for the same roles.
  cliente: '/perfil',
  suporte: '/suporte/chamados',
  financeiro: '/financeiro',
  // `member` is the bootstrap role from the Prisma seeder — treat it
  // the same as CLIENT so fresh signups land on the profile page.
  member: '/perfil',
};

export function getRedirectForRole(role: string | null | undefined): string {
  if (!role) return DEFAULT_REDIRECT;
  return ROLE_REDIRECTS[role.toLowerCase()] ?? DEFAULT_REDIRECT;
}

/**
 * Pick the "best" landing route from a list of roles. Useful when a
 * user holds several roles at once — we prefer the first mapped role
 * in the list, so role ordering (which the backend sorts by
 * `assignedAt ASC`) doubles as priority.
 */
export function pickRedirectFromRoles(roles: string[] | null | undefined): string {
  if (!roles?.length) return DEFAULT_REDIRECT;
  for (const role of roles) {
    const target = ROLE_REDIRECTS[role.toLowerCase()];
    if (target) return target;
  }
  return DEFAULT_REDIRECT;
}
