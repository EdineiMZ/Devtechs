/**
 * @devtechs/ui - DevTechs shared design system.
 *
 * Re-exports every public component, layout and hook.
 */

// ---------- utilities ----------
export { cn } from './lib/cn';

// ---------- components ----------
export { Button, buttonVariants, type ButtonProps } from './components/Button';
export { Input, inputVariants, type InputProps } from './components/Input';
export { Badge, badgeVariants, type BadgeProps } from './components/Badge';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
  type CardProps,
} from './components/Card';
export {
  Modal,
  ModalTrigger,
  ModalClose,
  ModalFooter,
  type ModalProps,
} from './components/Modal';
export {
  Sidebar,
  type SidebarProps,
  type SidebarItem,
} from './components/Sidebar';
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  avatarVariants,
  type AvatarProps,
} from './components/Avatar';
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './components/Table';
export { Spinner, spinnerVariants, type SpinnerProps } from './components/Spinner';
export { Alert, alertVariants, type AlertProps } from './components/Alert';
export {
  StatusIndicator,
  statusIndicatorVariants,
  type StatusIndicatorProps,
  type ServiceStatus,
} from './components/StatusIndicator';

// ---------- layouts ----------
export { AppShell, type AppShellProps } from './layouts/AppShell';
export { AuthLayout, type AuthLayoutProps } from './layouts/AuthLayout';

// ---------- hooks ----------
export {
  useToast,
  toast,
  type Toast,
  type ToastOptions,
  type ToastVariant,
} from './hooks/useToast';
export {
  useConfirm,
  type ConfirmOptions,
  type ConfirmState,
} from './hooks/useConfirm';
