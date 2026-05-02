import { redirect } from 'next/navigation';

/**
 * /admin/developer/update-config
 * Convenience alias → /admin/developer/config
 * Linked from the developer main page quick-action bar.
 */
export default function UpdateConfigPage(): never {
  redirect('/admin/developer/config');
}
