import type { AppSidebarItem } from './app-sidebar';

/**
 * Navigation config shared between admin and client shells.
 * Icons are inline SVG so there's zero runtime dependency on
 * lucide — the list renders server-side without a hydration round.
 *
 * Items are filtered by `permission` at render time: a user
 * without the key sees the item as disabled (greyed out) so
 * the navigation still advertises the full platform surface
 * without letting them navigate to forbidden routes.
 */

const icon = (path: JSX.Element): JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-full w-full"
    aria-hidden="true"
  >
    {path}
  </svg>
);

export const ADMIN_NAV_ITEMS: AppSidebarItem[] = [
  {
    href: '/admin',
    label: 'Visão geral',
    description: 'Dashboard da plataforma',
    icon: icon(
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </>,
    ),
  },
  {
    href: '/admin/rh',
    label: 'Recursos Humanos',
    description: 'Funcionários e férias',
    permission: 'rh:employees:view',
    icon: icon(
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 11h-6" />
        <path d="M19 8v6" />
      </>,
    ),
  },
  {
    href: '/admin/financeiro',
    label: 'Financeiro',
    description: 'Receitas, NFs e DRE',
    permission: 'finance:reports:view',
    icon: icon(
      <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>,
    ),
  },
  {
    href: '/admin/financeiro/produtos',
    label: 'Produtos & Serviços',
    description: 'Catálogo de produtos para cobranças',
    permission: 'finance:products:view',
    icon: icon(
      <>
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </>,
    ),
  },
  {
    href: '/admin/financeiro/assinaturas',
    label: 'Assinaturas',
    description: 'Cobranças recorrentes por cliente',
    permission: 'finance:subscriptions:view',
    icon: icon(
      <>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>,
    ),
  },
  {
    href: '/admin/projetos',
    label: 'Projetos',
    description: 'Kanban e sprints',
    permission: 'projects:reports:view',
    icon: icon(
      <>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </>,
    ),
  },
  {
    href: '/admin/suporte',
    label: 'Suporte',
    description: 'Tickets e SLAs',
    permission: 'support:tickets:view',
    icon: icon(
      <>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </>,
    ),
  },
  {
    href: '/admin/devops',
    label: 'DevOps',
    description: 'Pipelines e deploys',
    permission: 'devops:pipelines:view',
    icon: icon(
      <>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </>,
    ),
  },
  {
    href: '/admin/integracoes',
    label: 'Integrações & API',
    description: 'API keys e integrações externas',
    permission: 'integrations:manage',
    icon: icon(
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>,
    ),
  },
  {
    href: '/admin/developer',
    label: 'Developer',
    description: 'Logs e diagnóstico',
    permission: 'dev:logs:view',
    icon: icon(
      <>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </>,
    ),
  },
  {
    href: '/admin/developer/vps',
    label: 'VPS',
    description: 'VPSs Hostinger por cliente',
    permission: 'dev:vps:manage',
    icon: icon(
      <>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="20" x2="16" y2="20" />
      </>,
    ),
  },
  {
    href: '/admin/developer/config',
    label: 'Config. Plataforma',
    description: 'APIs, email, flags e storage',
    permission: 'dev:config:view',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>,
    ),
  },
  {
    href: '/admin/developer/licencas',
    label: 'Licenças & Keys',
    description: 'Produtos e tokens de ativação',
    permission: 'licenses:audit:view',
    icon: icon(
      <>
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </>,
    ),
  },
  {
    href: '/admin/developer/servicos',
    label: 'Monitor de Serviços',
    description: 'Status, controle e logs em tempo real',
    permission: 'dev:logs:view',
    icon: icon(
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <circle cx="12" cy="10" r="3" />
      </>,
    ),
  },
  {
    href: '/admin/auditoria',
    label: 'Auditoria',
    description: 'Logs e relatórios de segurança',
    permission: 'dev:logs:view',
    icon: icon(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </>,
    ),
  },
  // ── AGRIVOR section (WS2–WS5 / SZD-690–693) ──────────────────────────────
  {
    href: '/admin/agrivor/gastos-ia',
    label: 'AGRIVOR · Gastos IA',
    description: 'Custo e consumo por empresa',
    permission: 'agrivor:report:view',
    icon: icon(
      <>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </>,
    ),
  },
  {
    href: '/admin/configuracoes',
    label: 'Configurações',
    description: 'Permissões e seed',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>,
    ),
  },
];

export const CLIENT_NAV_ITEMS: AppSidebarItem[] = [
  {
    href: '/perfil',
    label: 'Meu painel',
    description: 'Visão geral',
    icon: icon(
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>,
    ),
  },
  {
    href: '/perfil/tickets',
    label: 'Meus tickets',
    description: 'Suporte e chamados',
    icon: icon(
      <>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </>,
    ),
  },
  {
    href: '/perfil/projetos',
    label: 'Meus projetos',
    description: 'Acompanhar progresso',
    icon: icon(
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </>,
    ),
  },
  {
    href: '/perfil/faturas',
    label: 'Faturas',
    description: 'Notas e pagamentos',
    icon: icon(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </>,
    ),
  },
  {
    href: '/perfil/notificacoes',
    label: 'Notificações',
    description: 'Mensagens e avisos',
    icon: icon(
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>,
    ),
  },
  {
    href: '/perfil/configuracoes',
    label: 'Conta',
    description: 'Dados e segurança',
    icon: icon(
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>,
    ),
  },
];
