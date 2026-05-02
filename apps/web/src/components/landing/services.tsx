'use client';

import { motion } from 'framer-motion';
import { Cloud, Database, Globe, LayoutDashboard, ServerCog, ShieldCheck } from 'lucide-react';

import { BlurText } from './blur-text';
import { TerminalBadge } from './terminal-badge';

const SERVICES = [
  {
    icon: ServerCog,
    title: 'Arquitetura de Backend',
    body: 'Design de APIs REST e GraphQL, modelagem de banco de dados PostgreSQL, microsserviços e monólitos modulares — construídos para durar.',
    techs: ['Node.js', 'PostgreSQL', 'Docker', 'Redis'],
    large: true,
  },
  {
    icon: Globe,
    title: 'Aplicações Next.js',
    body: 'Full-stack com Next.js App Router, SSR/ISR otimizado, integração com CMS headless e deploy na Vercel ou VPS próprio.',
    techs: ['Next.js', 'TypeScript', 'Tailwind', 'Prisma'],
  },
  {
    icon: ShieldCheck,
    title: 'Segurança & Pentest',
    body: 'Testes de invasão autorizados, análise de vulnerabilidades OWASP Top 10, relatórios executivos e remediação guiada.',
    techs: ['Kali Linux', 'Burp Suite', 'OWASP', 'CVE'],
  },
  {
    icon: Database,
    title: 'Modelagem & Performance de Dados',
    body: 'Otimização de queries, índices estratégicos, migrations seguras e auditoria de schema para PostgreSQL em produção.',
    techs: ['PostgreSQL', 'pgAnalyze', 'explain', 'índices'],
  },
  {
    icon: Cloud,
    title: 'DevOps & Infraestrutura',
    body: 'CI/CD com GitHub Actions, containerização Docker, deploy em VPS e gerenciamento de ambientes com zero-downtime.',
    techs: ['Docker', 'Nginx', 'GitHub Actions', 'Ubuntu'],
  },
  {
    icon: LayoutDashboard,
    title: 'Produtos Digitais Completos',
    body: 'Do wireframe ao deploy: UX, frontend React, backend robusto e analytics integrado — entregue com documentação.',
    techs: ['React', 'Figma', 'Node.js', 'PostgreSQL'],
  },
];

const CODE_SNIPPET = `// auth.service.ts
async completeLogin(userId: string) {
  const tokens = await this.tokenService
    .issueTokenPair(userId);
  await this.audit.log({
    action: 'LOGIN_SUCCESS',
    userId, module: 'AUTH',
  });
  return tokens; // ✔
}`;

export function Services() {
  return (
    <section id="servicos" className="py-24 lg:py-32 bg-ink">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-14">
          <TerminalBadge variant="acid">// o que construímos</TerminalBadge>
          <BlurText
            text="Serviços de engenharia."
            className="font-display font-semibold text-foreground"
            style={{ fontSize: 'clamp(32px, 4.5vw, 60px)' } as React.CSSProperties}
          />
          <p className="max-w-xl text-ash font-body text-base leading-relaxed">
            Não somos uma agência de sites. Somos engenheiros que constroem o sistema que sustenta seu produto.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Large card */}
          {(() => {
            const s = SERVICES[0];
            const Icon = s.icon;
            return (
              <motion.div
                key={s.title}
                className="liquid-glass rounded-2xl p-8 md:col-span-2 relative overflow-hidden group"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <pre className="absolute bottom-0 right-0 w-64 terminal-card rounded-tl-xl p-4 text-[10px] leading-5 opacity-25 group-hover:opacity-45 transition-opacity overflow-hidden pointer-events-none select-none text-acid">
                  {CODE_SNIPPET}
                </pre>
                <Icon className="h-9 w-9 text-copper mb-4" />
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-ash text-sm leading-relaxed font-body mb-6 max-w-sm">{s.body}</p>
                <div className="flex flex-wrap gap-2">
                  {s.techs.map((t) => <span key={t} className="code-pill">{t}</span>)}
                </div>
              </motion.div>
            );
          })()}

          {/* Two stacked */}
          <div className="flex flex-col gap-4">
            {SERVICES.slice(1, 3).map((s) => {
              const Icon = s.icon;
              return (
                <motion.div key={s.title} className="liquid-glass rounded-2xl p-6 flex-1" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                  <Icon className="h-7 w-7 text-copper mb-3" />
                  <h3 className="font-display text-base font-semibold text-foreground mb-1">{s.title}</h3>
                  <p className="text-ash text-sm leading-relaxed font-body mb-4">{s.body}</p>
                  <div className="flex flex-wrap gap-1.5">{s.techs.map((t) => <span key={t} className="code-pill">{t}</span>)}</div>
                </motion.div>
              );
            })}
          </div>

          {/* Three equal */}
          {SERVICES.slice(3).map((s) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.title} className="liquid-glass rounded-2xl p-6" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                <Icon className="h-7 w-7 text-copper mb-3" />
                <h3 className="font-display text-base font-semibold text-foreground mb-1">{s.title}</h3>
                <p className="text-ash text-sm leading-relaxed font-body mb-4">{s.body}</p>
                <div className="flex flex-wrap gap-1.5">{s.techs.map((t) => <span key={t} className="code-pill">{t}</span>)}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
