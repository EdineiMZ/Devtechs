import { ShellSkeleton } from '@/components/app/shell-skeleton';

export default function VpsLoading(): JSX.Element {
  // VPS list is slow because it enriches each VM with live Hostinger state.
  // Show 4 card-height rows while it loads.
  return <ShellSkeleton rows={4} />;
}
