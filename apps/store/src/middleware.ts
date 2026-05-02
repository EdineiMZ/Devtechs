export { auth as middleware } from '@/auth';

export const config = {
  matcher: ['/checkout/:path*', '/conta/:path*'],
};
