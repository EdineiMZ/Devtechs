'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { BlurText } from './blur-text';
import { TerminalBadge } from './terminal-badge';

const FAQ_ITEMS = [
  {
    q: 'Vocês aceitam projetos pequenos ou apenas grandes contratos?',
    a: 'Aceitamos desde consultoria pontual (otimização de queries, revisão de arquitetura) até desenvolvimento completo de produto. O critério não é tamanho — é clareza de escopo.',
  },
  {
    q: 'Qual stack vocês dominam?',
    a: 'Nossa especialidade central é Node.js + PostgreSQL + Next.js para fullstack, com Docker e GitHub Actions para infraestrutura. Para frontend puro, trabalhamos com React/Next.js. Python para projetos de IA/dados sob consulta.',
  },
  {
    q: 'Como funciona o contrato e pagamento?',
    a: 'Contrato por escopo fechado ou T&M (tempo e material) conforme o projeto. Pagamento em milestones — nunca pedimos 100% adiantado. Nota fiscal para PJ ou PF.',
  },
  {
    q: 'Posso ver o código durante o desenvolvimento?',
    a: 'Sim. O repositório é seu desde o primeiro commit. Você tem acesso ao GitHub/GitLab durante todo o projeto, não só na entrega final.',
  },
  {
    q: 'Fazem manutenção pós-entrega?',
    a: 'Oferecemos planos de suporte mensal que incluem monitoramento de erros, atualizações de dependências e banco de horas para features novas. Sem lock-in — você pode sair quando quiser.',
  },
  {
    q: 'O pentest é um serviço separado?',
    a: 'Sim. Realizamos testes de invasão como serviço standalone (com contrato de autorização formal) ou como fase de segurança integrada ao desenvolvimento. Entregamos relatório executivo + técnico.',
  },
  {
    q: 'Quanto tempo leva para iniciar um projeto?',
    a: 'Entre o primeiro contato e o início do desenvolvimento: geralmente 5-10 dias úteis (diagnóstico + escopo + contrato). Para consultorias pontuais, podemos começar em 48h.',
  },
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/8">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        aria-expanded={open}
      >
        <span className="font-display text-base font-medium text-foreground group-hover:text-copper transition-colors">
          {q}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-ash shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ maxHeight: open ? '400px' : '0px', opacity: open ? 1 : 0 }}
      >
        <p className="font-body text-sm text-ash leading-relaxed pb-5 max-w-2xl">
          {a}
        </p>
      </div>
    </div>
  );
}

export function Faq(): JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 lg:py-32 bg-ink border-t border-white/5">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-14">
          <TerminalBadge variant="muted">{'// perguntas frequentes'}</TerminalBadge>
          <BlurText
            text="Direto ao ponto."
            className="font-display font-semibold text-foreground"
            style={{ fontSize: 'clamp(32px, 4.5vw, 60px)' } as React.CSSProperties}
          />
        </div>

        <div>
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem
              key={i}
              q={item.q}
              a={item.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
