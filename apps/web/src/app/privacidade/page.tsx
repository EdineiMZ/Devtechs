import type { Metadata } from 'next';
import Link from 'next/link';

import { getPublicCompanySettings } from '@/lib/auth-admin-api';
import type { CompanySettings } from '@/lib/auth-admin-api';
import { LegalNavbar } from '@/components/landing/legal-navbar';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Política de Privacidade da DevTechs — como coletamos, usamos, armazenamos e protegemos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).',
  robots: { index: true, follow: true },
};

const UPDATED = '02 de maio de 2025';
const VERSION = '1.0';

export default async function PrivacidadePage(): Promise<JSX.Element> {
  const company = await getPublicCompanySettings();

  const name    = company?.name            ?? 'DevTechs Tecnologia Ltda.';
  const cnpj    = company?.cnpj            ?? '[CNPJ não cadastrado]';
  const email   = company?.email           ?? 'privacidade@devtechs.io';
  const website = company?.website         ?? 'https://devtechs.io';
  const address = formatAddress(company);

  return (
    <div className="relative min-h-screen bg-ink">
      {/* grid overlay — same as hero section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(160 100% 48% / 0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(160 100% 48% / 0.08) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      {/* top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-30"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(28 72% 58% / 0.12), transparent 70%)',
        }}
      />

      <LegalNavbar />

      {/* spacing for fixed navbar (h-16) */}
      <div className="pt-24" />

      <main className="relative mx-auto max-w-3xl px-6 pb-20">
        {/* Título */}
        <div className="mb-12 border-b border-white/8 pb-8">
          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-copper">
            {'// legal / privacidade'}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Política de Privacidade
          </h1>
          <p className="mt-3 font-body text-sm text-ash">
            Última atualização: <strong className="text-foreground">{UPDATED}</strong> · Versão {VERSION}
          </p>
          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 font-body text-xs text-amber-300/80">
            Esta Política foi elaborada em conformidade com a{' '}
            <strong>Lei nº 13.709/2018 (LGPD)</strong>, o{' '}
            <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong>, o{' '}
            <strong>Código de Defesa do Consumidor (Lei nº 8.078/1990)</strong> e as diretrizes
            da <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>.
          </div>
        </div>

        <div className="space-y-12 font-body text-sm leading-relaxed text-ash">

          {/* 1. CONTROLADOR */}
          <section>
            <H2 n="1">Identificação do Controlador</H2>
            <p>O <strong className="text-foreground">Controlador</strong> dos dados pessoais tratados nesta Política é:</p>
            <dl className="mt-4 space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-5 font-mono text-xs">
              <Row label="Razão Social" value={name} />
              <Row label="CNPJ"         value={cnpj} />
              <Row label="Endereço"     value={address} />
              <Row label="E-mail DPO"   value={email} />
              <Row label="Site"         value={website} />
            </dl>
            <p className="mt-4">
              O <strong className="text-foreground">Encarregado pelo Tratamento de Dados (DPO)</strong>{' '}
              indicado na forma do art. 41 da LGPD pode ser contatado pelo e-mail{' '}
              <a href={`mailto:${email}`} className="text-copper hover:underline">{email}</a>,
              com tempo de resposta de até <strong>15 (quinze) dias úteis</strong>.
            </p>
          </section>

          {/* 2. DEFINIÇÕES */}
          <section>
            <H2 n="2">Definições (art. 5º da LGPD)</H2>
            <ul className="space-y-2">
              {[
                ['Dado pessoal', 'Informação relacionada a pessoa natural identificada ou identificável (art. 5º, I da LGPD).'],
                ['Dado pessoal sensível', 'Dado sobre origem racial ou étnica, convicção religiosa, opinião política, filiação sindical, dado referente à saúde, à vida sexual, dado genético ou biométrico (art. 5º, II da LGPD).'],
                ['Tratamento', 'Toda operação realizada com dados pessoais, como coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação, controle, modificação, comunicação, transferência, difusão ou extração (art. 5º, X da LGPD).'],
                ['Titular', 'Pessoa natural a quem se referem os dados pessoais que são objeto de tratamento.'],
                ['Controlador', 'Pessoa natural ou jurídica que toma as decisões referentes ao tratamento.'],
                ['Operador', 'Pessoa natural ou jurídica que realiza o tratamento em nome do Controlador.'],
                ['Consentimento', 'Manifestação livre, informada e inequívoca, por escrito ou por outro meio que a demonstre (art. 5º, XII da LGPD).'],
              ].map(([term, def]) => (
                <Li key={term}>
                  <strong className="text-foreground">{term}:</strong> {def}
                </Li>
              ))}
            </ul>
          </section>

          {/* 3. DADOS COLETADOS */}
          <section>
            <H2 n="3">Dados Coletados, Finalidades e Bases Legais</H2>
            <p>Tratamos apenas os dados estritamente necessários para cada finalidade declarada abaixo (princípio da necessidade — art. 6º, III da LGPD).</p>

            <Table title="3.1 Dados de Cadastro" rows={[
              ['Nome completo',      'Identificação do usuário',              'Execução de contrato (art. 7º, V)'],
              ['E-mail',            'Autenticação, comunicados transacionais','Execução de contrato (art. 7º, V)'],
              ['Senha (hash bcrypt)','Autenticação segura',                   'Execução de contrato (art. 7º, V)'],
              ['Cargo / empresa',   'Personalização da experiência',          'Legítimo interesse (art. 7º, IX)'],
            ]} />

            <Table title="3.2 Dados de Uso e Navegação" rows={[
              ['Endereço IP',           'Segurança, prevenção de fraudes, logs (Marco Civil art. 15)',           'Obrigação legal (art. 7º, II) e Legítimo interesse (art. 7º, IX)'],
              ['User-agent / dispositivo','Compatibilidade e segurança da sessão',                              'Legítimo interesse (art. 7º, IX)'],
              ['Páginas e tempo de sessão','Análise de uso e melhorias da plataforma',                         'Legítimo interesse (art. 7º, IX)'],
              ['Logs de auditoria',     'Segurança, rastreabilidade e conformidade',                           'Obrigação legal (art. 7º, II) e Legítimo interesse (art. 7º, IX)'],
            ]} />

            <Table title="3.3 Dados de Pagamento" rows={[
              ['Dados de cartão','Processamento — tokenizados pelo gateway (Stripe/Mercado Pago); não armazenados pela DevTechs','Execução de contrato (art. 7º, V)'],
              ['CPF/CNPJ do pagador','Emissão de nota fiscal e compliance financeiro','Obrigação legal (art. 7º, II)'],
              ['Histórico de transações','Controle financeiro, suporte e disputas','Execução de contrato (art. 7º, V) e Obrigação legal (art. 7º, II)'],
            ]} />

            <Table title="3.4 Dados de Comunicação" rows={[
              ['Formulários de contato / tickets','Atendimento ao cliente','Execução de contrato (art. 7º, V)'],
              ['Preferências de notificação','Envio de comunicados conforme opção do titular','Consentimento (art. 7º, I) — revogável a qualquer momento'],
            ]} />

            <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.02] p-4 text-xs">
              <strong className="text-foreground">Dados pessoais sensíveis:</strong> A DevTechs{' '}
              <strong>não coleta intencionalmente</strong> dados sensíveis (art. 5º, II da LGPD).
              Caso o titular os inclua em campos livres (ex.: tickets de suporte), o tratamento
              dar-se-á com base no consentimento expresso (art. 11, I da LGPD) e exclusivamente
              para a finalidade do atendimento.
            </div>
          </section>

          {/* 4. COMPARTILHAMENTO */}
          <section>
            <H2 n="4">Compartilhamento de Dados</H2>
            <p>A DevTechs não vende, aluga nem comercializa dados pessoais. O compartilhamento ocorre exclusivamente nas hipóteses abaixo:</p>
            <ul className="mt-3 space-y-3">
              {[
                ['Prestadores de serviço (Operadores)', 'Contratados mediante cláusulas de confidencialidade e proteção de dados compatíveis com a LGPD (art. 39).'],
                ['Gateways de pagamento', 'Stripe Inc. e Mercado Pago S.A. recebem dados mínimos necessários para processamento. Dados de cartão são tokenizados diretamente no gateway.'],
                ['Autoridades públicas', 'Em cumprimento de obrigação legal ou determinação judicial (art. 7º, II e VI da LGPD e art. 15 do Marco Civil).'],
                ['Exercício regular de direitos', 'Para exercício de direitos em processo judicial, administrativo ou arbitral (art. 7º, VI da LGPD).'],
                ['Reorganização societária', 'Em fusões e aquisições, com comunicação prévia aos titulares.'],
              ].map(([title, desc]) => (
                <Li key={title}>
                  <strong className="text-foreground">{title}:</strong> {desc}
                </Li>
              ))}
            </ul>
          </section>

          {/* 5. TRANSFERÊNCIAS INTERNACIONAIS */}
          <section>
            <H2 n="5">Transferências Internacionais de Dados</H2>
            <p>As transferências internacionais são realizadas com base no art. 33 da LGPD, mediante:</p>
            <ul className="mt-3 space-y-2">
              <Li>Cláusulas contratuais específicas que garantam proteção equivalente à exigida pela LGPD (art. 33, II);</Li>
              <Li>Uso de serviços de países ou organizações com grau de proteção adequado (art. 33, I), conforme avaliação da ANPD; ou</Li>
              <Li>Consentimento específico do titular, quando necessário (art. 33, VIII).</Li>
            </ul>
          </section>

          {/* 6. RETENÇÃO */}
          <section>
            <H2 n="6">Período de Retenção e Eliminação</H2>
            <p>Os dados são conservados pelo tempo necessário às finalidades e obrigações legais (art. 16 da LGPD):</p>
            <div className="mt-4 space-y-2">
              {[
                ['Dados de cadastro e uso',         'Enquanto a conta estiver ativa + 5 anos após encerramento (CC, art. 206, §5º, I)'],
                ['Logs de conexão e acesso',        '6 meses (Marco Civil, art. 15) + extensão por determinação judicial'],
                ['Dados de pagamento / NFs',        '5 anos após emissão (CTN, art. 195)'],
                ['Trilhas de auditoria',            '5 anos (compliance e prevenção de fraudes)'],
                ['Dados para marketing',            'Até a revogação do consentimento'],
                ['Dados de menores (acidentais)',   'Eliminados imediatamente após identificação'],
              ].map(([type, period]) => (
                <div key={type} className="grid grid-cols-[1fr_1.5fr] gap-4 rounded-lg border border-white/8 bg-white/[0.02] p-3 font-mono text-xs">
                  <span className="text-foreground">{type}</span>
                  <span className="text-ash">{period}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 7. DIREITOS DO TITULAR */}
          <section>
            <H2 n="7">Direitos do Titular (arts. 17 a 22 da LGPD)</H2>
            <ul className="space-y-3">
              {[
                ['Confirmação e acesso (art. 18, I e II)', 'Confirmar existência de tratamento e obter cópia dos dados mantidos sobre você.'],
                ['Correção (art. 18, III)', 'Corrigir dados incompletos, inexatos ou desatualizados.'],
                ['Anonimização, bloqueio ou eliminação (art. 18, IV)', 'Solicitar tratamento de dados desnecessários, excessivos ou em desconformidade com a LGPD.'],
                ['Portabilidade (art. 18, V)', 'Receber seus dados em formato estruturado e interoperável.'],
                ['Eliminação após revogação (art. 18, VI)', 'Eliminar dados tratados com base em consentimento, salvo exceções legais.'],
                ['Informação sobre compartilhamento (art. 18, VII)', 'Saber com quem compartilhamos seus dados.'],
                ['Revogação do consentimento (art. 18, IX)', 'Revogar o consentimento a qualquer momento, sem prejuízo da licitude do tratamento anterior.'],
                ['Oposição (art. 18, §2º)', 'Opor-se ao tratamento baseado em legítimo interesse.'],
                ['Petição à ANPD (art. 18, §1º)', 'Apresentar reclamação à Autoridade Nacional de Proteção de Dados.'],
              ].map(([right, desc]) => (
                <li key={right} className="flex gap-3">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-copper" />
                  <span><strong className="text-foreground">{right}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl border border-copper/20 bg-copper/5 p-5">
              <p className="font-display text-xs font-semibold text-copper">Como exercer seus direitos</p>
              <p className="mt-2 text-xs">
                Envie solicitação para{' '}
                <a href={`mailto:${email}`} className="text-copper hover:underline">{email}</a>{' '}
                com assunto{' '}
                <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[10px]">
                  [LGPD] Direito: [tipo]
                </code>
                . Responderemos em até <strong>15 (quinze) dias úteis</strong>, prorrogável por igual
                período mediante justificativa (art. 19, §3º da LGPD).
              </p>
            </div>
          </section>

          {/* 8. SEGURANÇA */}
          <section>
            <H2 n="8">Segurança dos Dados</H2>
            <p>Adotamos medidas técnicas e organizacionais adequadas (art. 46 da LGPD):</p>
            <ul className="mt-3 space-y-2">
              {[
                'Criptografia em trânsito (TLS 1.2+) e em repouso para dados sensíveis;',
                'Senhas armazenadas com hash bcrypt (fator de custo ajustável);',
                'Autenticação multifator (2FA/TOTP) disponível para todos os usuários;',
                'Controle de acesso baseado em funções (RBAC) com privilégio mínimo;',
                'Trilha de auditoria imutável de todas as ações sensíveis;',
                'Revisões periódicas de segurança e testes de penetração;',
                'Plano de resposta a incidentes e gestão de vulnerabilidades.',
              ].map((item) => <Li key={item}>{item}</Li>)}
            </ul>
            <p className="mt-4">
              Em caso de incidente com risco ou dano relevante aos titulares, a DevTechs
              notificará a ANPD e os titulares afetados em prazo razoável (art. 48 da LGPD).
            </p>
          </section>

          {/* 9. COOKIES */}
          <section>
            <H2 n="9">Cookies e Tecnologias de Rastreamento</H2>
            <div className="space-y-3">
              {[
                { type: 'Estritamente necessários', base: 'Execução de contrato / Legítimo interesse', desc: 'Sessão de autenticação, tokens CSRF. Não podem ser desativados — a plataforma não funciona sem eles.' },
                { type: 'Analíticos (desativados por padrão)', base: 'Consentimento (art. 7º, I)', desc: 'Usados para entender o uso da plataforma. Ativados somente com consentimento explícito.' },
                { type: 'Marketing (desativados por padrão)', base: 'Consentimento (art. 7º, I)', desc: 'A DevTechs não exibe publicidade de terceiros. Cookies de marketing somente para campanhas próprias com consentimento.' },
              ].map(({ type, base, desc }) => (
                <div key={type} className="rounded-lg border border-white/8 bg-white/[0.02] p-4 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground">{type}</p>
                    <span className="shrink-0 rounded border border-copper/20 bg-copper/10 px-1.5 py-0.5 font-mono text-[9px] text-copper">{base}</span>
                  </div>
                  <p className="mt-1 text-ash">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 10. MENORES */}
          <section>
            <H2 n="10">Proteção de Crianças e Adolescentes</H2>
            <p>
              A plataforma é destinada exclusivamente a pessoas com{' '}
              <strong className="text-foreground">18 (dezoito) anos ou mais</strong>. Não coletamos
              dados de menores intencionalmente. Dados de menores identificados serão eliminados
              imediatamente (arts. 14 e 18 da LGPD). Pais ou responsáveis devem contatar o DPO em{' '}
              <a href={`mailto:${email}`} className="text-copper hover:underline">{email}</a>.
            </p>
          </section>

          {/* 11. ALTERAÇÕES */}
          <section>
            <H2 n="11">Alterações nesta Política</H2>
            <p>
              Alterações relevantes serão comunicadas com{' '}
              <strong className="text-foreground">antecedência mínima de 30 (trinta) dias</strong>{' '}
              por e-mail ou aviso na plataforma. O uso continuado após a vigência implica ciência e,
              quando exigido, novo consentimento.
            </p>
          </section>

          {/* 12. CONTATO */}
          <section>
            <H2 n="12">Contato e Canais de Atendimento</H2>
            <dl className="mt-4 space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-5 font-mono text-xs">
              <Row label="DPO / Encarregado"  value={email} />
              <Row label="Suporte geral"       value="suporte@devtechs.io" />
              <Row label="Portal do titular"   value={website} />
              <Row label="ANPD"                value="gov.br/anpd" />
            </dl>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-white/8 pt-8 text-center">
          <p className="font-mono text-xs text-ash/50">
            {name} · CNPJ {cnpj} · Política de Privacidade v{VERSION} · {UPDATED}
          </p>
          <div className="mt-4 flex justify-center gap-6 font-body text-xs">
            <Link href="/termos"  className="text-ash hover:text-copper transition-colors">Termos de Uso</Link>
            <Link href="/contato" className="text-ash hover:text-copper transition-colors">Contato</Link>
            <Link href="/"        className="text-ash hover:text-copper transition-colors">Início</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAddress(c: CompanySettings | null): string {
  if (!c) return '[Endereço não cadastrado]';
  const parts = [
    c.street && c.number ? `${c.street}, ${c.number}` : c.street,
    c.complement,
    c.neighborhood,
    c.city && c.state ? `${c.city}/${c.state}` : c.city,
    c.zip,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : '[Endereço não cadastrado]';
}

function H2({ n, children }: { n: string; children: React.ReactNode }): JSX.Element {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-display text-base font-semibold text-foreground">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-copper/15 font-mono text-[11px] text-copper">
        {n}
      </span>
      {children}
    </h2>
  );
}

function Li({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex gap-3">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ash/40" />
      <span>{children}</span>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ash/50">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: [string, string, string][] }): JSX.Element {
  return (
    <div className="mt-5">
      <p className="mb-2 font-mono text-xs font-semibold text-copper/80">{title}</p>
      <div className="overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full font-body text-xs">
          <thead className="border-b border-white/8 bg-white/[0.03]">
            <tr>
              {['Dado', 'Finalidade', 'Base Legal (LGPD)'].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ash/50">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([dado, fin, base], i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2 font-mono text-foreground">{dado}</td>
                <td className="px-4 py-2 text-ash">{fin}</td>
                <td className="px-4 py-2 text-ash/70">{base}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
