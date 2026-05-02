import type { Metadata } from 'next';
import Link from 'next/link';

import { getPublicCompanySettings } from '@/lib/auth-admin-api';
import type { CompanySettings } from '@/lib/auth-admin-api';
import { LegalNavbar } from '@/components/landing/legal-navbar';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description:
    'Termos de Uso da DevTechs — condições gerais de contratação, direitos e obrigações das partes, uso aceitável da plataforma e responsabilidades.',
  robots: { index: true, follow: true },
};

const UPDATED = '02 de maio de 2025';
const VERSION = '1.0';

export default async function TermosPage(): Promise<JSX.Element> {
  const company = await getPublicCompanySettings();

  const name    = company?.name  ?? 'DevTechs Tecnologia Ltda.';
  const cnpj    = company?.cnpj  ?? '[CNPJ não cadastrado]';
  const email   = company?.email ?? 'contato@devtechs.io';
  const city    = company?.city  ?? null;
  const state   = company?.state ?? null;
  const address = formatAddress(company);

  const foro = city && state ? `Comarca de ${city}/${state}` : 'Comarca da sede da Prestadora';

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
            {'// legal / termos'}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Termos de Uso
          </h1>
          <p className="mt-3 font-body text-sm text-ash">
            Última atualização: <strong className="text-foreground">{UPDATED}</strong> · Versão{' '}
            {VERSION}
          </p>
          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 font-body text-xs text-amber-300/80">
            Ao criar uma conta ou utilizar qualquer funcionalidade da Plataforma DevTechs, o
            Usuário declara ter lido, compreendido e concordado integralmente com estes Termos de
            Uso, com a{' '}
            <Link href="/privacidade" className="text-copper hover:underline">
              Política de Privacidade
            </Link>{' '}
            e com os demais documentos normativos aqui referenciados, nos termos dos arts. 3º e 4º
            do <strong>Código de Defesa do Consumidor (Lei nº 8.078/1990)</strong> e do{' '}
            <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong>.
          </div>
        </div>

        <div className="space-y-12 font-body text-sm leading-relaxed text-ash">

          {/* 1. PARTES */}
          <section>
            <H2 n="1">Partes e Objeto</H2>
            <p>Estes Termos de Uso regulam a relação jurídica entre:</p>
            <dl className="mt-4 space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-5 font-mono text-xs">
              <Row label="Prestadora / Plataforma" value={`${name} — CNPJ ${cnpj}`} />
              <Row label="Endereço"                value={address} />
              <Row label="Contato"                 value={email} />
              <Row label="Usuário"                 value="Pessoa física (≥ 18 anos) ou jurídica que acessa a Plataforma" />
            </dl>
            <p className="mt-4">
              O objeto destes Termos é a disponibilização da{' '}
              <strong className="text-foreground">Plataforma DevTechs</strong> — conjunto de módulos
              de software acessados via navegador web (SaaS), compreendendo, entre outros: gestão de
              projetos, recursos humanos, financeiro, DevOps, licenças, suporte e portal do cliente
              (<strong className="text-foreground">&quot;Plataforma&quot;</strong>).
            </p>
          </section>

          {/* 2. ELEGIBILIDADE */}
          <section>
            <H2 n="2">Elegibilidade e Criação de Conta</H2>
            <ul className="space-y-3">
              <Li>
                O uso da Plataforma é permitido apenas a pessoas com{' '}
                <strong className="text-foreground">18 (dezoito) anos ou mais</strong> ou a pessoas
                jurídicas devidamente constituídas.
              </Li>
              <Li>
                O Usuário deve fornecer informações verídicas, exatas e atualizadas no cadastro. O
                fornecimento de informações falsas configura infração contratual e pode ensejar
                responsabilidade civil e penal.
              </Li>
              <Li>
                Cada Usuário é responsável pela confidencialidade de suas credenciais de acesso
                (login e senha). A Prestadora não se responsabiliza por acessos não autorizados
                decorrentes de negligência do Usuário na guarda de suas credenciais.
              </Li>
              <Li>
                O Usuário deve comunicar imediatamente a Prestadora, pelo e-mail{' '}
                <a href={`mailto:${email}`} className="text-copper hover:underline">
                  {email}
                </a>
                , qualquer suspeita de acesso não autorizado à sua conta.
              </Li>
              <Li>
                A Prestadora reserva-se o direito de recusar ou cancelar cadastros, a seu exclusivo
                critério, em caso de violação destes Termos ou de condutas prejudiciais à plataforma
                ou a terceiros.
              </Li>
            </ul>
          </section>

          {/* 3. PLANOS E PAGAMENTOS */}
          <section>
            <H2 n="3">Planos, Preços e Pagamentos</H2>

            <p className="mb-4">
              A Plataforma pode ser contratada nos planos descritos em{' '}
              <Link href="/#planos" className="text-copper hover:underline">
                /#planos
              </Link>
              , cujas condições integram estes Termos por referência.
            </p>

            <SubH>3.1 Assinatura (Recorrente)</SubH>
            <ul className="mt-2 space-y-2">
              <Li>
                As assinaturas são cobradas com{' '}
                <strong className="text-foreground">antecedência</strong>, no início de cada ciclo
                (mensal ou anual). O valor é debitado automaticamente no meio de pagamento
                cadastrado.
              </Li>
              <Li>
                O cancelamento da assinatura pode ser realizado pelo próprio Usuário no painel da
                conta (<strong>/perfil/faturas</strong>) a qualquer momento. O acesso permanece
                disponível até o fim do período já pago, sem reembolso proporcional, salvo nos
                casos do art. 49 do CDC (arrependimento — 7 dias a contar da contratação à
                distância).
              </Li>
              <Li>
                Em caso de inadimplência, a Prestadora pode suspender o acesso após notificação com
                3 (três) dias de antecedência e, persistindo o inadimplemento por 30 (trinta) dias,
                pode rescindir o contrato e eliminar os dados conforme a Política de Privacidade.
              </Li>
            </ul>

            <SubH>3.2 Reajuste de Preços</SubH>
            <ul className="mt-2 space-y-2">
              <Li>
                Os preços podem ser reajustados anualmente pelo IPCA-E ou por variação de custos
                operacionais devidamente justificada, mediante comunicação com{' '}
                <strong className="text-foreground">30 (trinta) dias de antecedência</strong> por
                e-mail.
              </Li>
              <Li>
                O Usuário que não concordar com o reajuste pode cancelar a assinatura sem ônus até
                a data de início da vigência do novo valor.
              </Li>
            </ul>

            <SubH>3.3 Disputas de Cobrança</SubH>
            <p className="mt-2">
              Contestações de cobrança devem ser enviadas para{' '}
              <a href={`mailto:${email}`} className="text-copper hover:underline">
                {email}
              </a>{' '}
              em até <strong className="text-foreground">30 (trinta) dias</strong> após a cobrança
              questionada. Estornos via operadora de cartão sem contato prévio com a Prestadora
              podem ensejar suspensão imediata do acesso.
            </p>
          </section>

          {/* 4. DIREITO DE ARREPENDIMENTO */}
          <section>
            <H2 n="4">Direito de Arrependimento (CDC, art. 49)</H2>
            <p>
              Nas contratações realizadas à distância (internet), o Usuário consumidor pessoa física
              tem o direito de desistir da contratação no prazo de{' '}
              <strong className="text-foreground">7 (sete) dias corridos</strong> a contar da data
              de contratação ou do primeiro acesso, o que ocorrer por último, sem qualquer ônus.
            </p>
            <p className="mt-3">
              Para exercer o direito de arrependimento, envie e-mail para{' '}
              <a href={`mailto:${email}`} className="text-copper hover:underline">
                {email}
              </a>{' '}
              com o assunto{' '}
              <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[10px]">
                [ARREPENDIMENTO] — [seu e-mail de cadastro]
              </code>
              . O reembolso integral será processado em até{' '}
              <strong className="text-foreground">10 (dez) dias úteis</strong> pelo mesmo meio de
              pagamento original.
            </p>
            <p className="mt-3 text-xs text-ash/60">
              O direito de arrependimento não se aplica a serviços já integralmente executados com o
              consentimento expresso do Usuário antes do término do prazo (CDC, art. 49, parágrafo
              único).
            </p>
          </section>

          {/* 5. PROPRIEDADE INTELECTUAL */}
          <section>
            <H2 n="5">Propriedade Intelectual</H2>

            <SubH>5.1 Plataforma e Conteúdo da Prestadora</SubH>
            <p className="mt-2">
              Todo o conteúdo da Plataforma — incluindo código-fonte, interfaces, logotipos, marcas,
              textos, imagens, arquiteturas de software e documentação — é de titularidade exclusiva
              da Prestadora ou está licenciado a ela, protegido pela{' '}
              <strong className="text-foreground">Lei nº 9.610/1998 (Lei de Direitos Autorais)</strong>
              , pela{' '}
              <strong className="text-foreground">Lei nº 9.279/1996 (Propriedade Industrial)</strong>{' '}
              e pela{' '}
              <strong className="text-foreground">Lei nº 9.609/1998 (Software)</strong>.
            </p>
            <p className="mt-2">
              Fica concedida ao Usuário uma licença{' '}
              <strong className="text-foreground">
                não exclusiva, intransferível, revogável e limitada
              </strong>{' '}
              para acessar e usar a Plataforma exclusivamente para fins internos e conforme estes
              Termos. Nenhuma disposição implica cessão de direitos.
            </p>

            <SubH>5.2 Conteúdo do Usuário</SubH>
            <p className="mt-2">
              O Usuário mantém todos os direitos sobre os dados e conteúdos que inserir na Plataforma
              (<strong className="text-foreground">&quot;Conteúdo do Usuário&quot;</strong>). Ao inserir
              conteúdo, o Usuário concede à Prestadora uma licença limitada, não exclusiva e
              revogável, apenas para prestar os serviços contratados.
            </p>
            <p className="mt-2">
              O Usuário declara e garante que possui todos os direitos necessários sobre o Conteúdo
              inserido e que tal inserção não viola direitos de terceiros.
            </p>
          </section>

          {/* 6. USO ACEITÁVEL */}
          <section>
            <H2 n="6">Uso Aceitável e Condutas Proibidas</H2>
            <p>
              O Usuário compromete-se a utilizar a Plataforma exclusivamente para fins lícitos. São
              expressamente proibidas, entre outras condutas:
            </p>
            <ul className="mt-4 space-y-2">
              {[
                'Violar qualquer lei ou regulamento aplicável, incluindo a LGPD, o Marco Civil da Internet, o CDC e o CP;',
                'Realizar engenharia reversa, descompilar, desmontar ou tentar extrair o código-fonte da Plataforma;',
                'Acessar ou tentar acessar contas, sistemas ou dados de terceiros sem autorização;',
                'Publicar, transmitir ou armazenar malware, vírus, worms, trojans ou qualquer código malicioso;',
                'Realizar ataques de negação de serviço (DoS/DDoS), port scanning ou qualquer teste de penetração não autorizado;',
                'Usar scrapers, bots, spiders ou qualquer automação não autorizada para acessar a Plataforma;',
                'Revender, sublicenciar ou comercializar o acesso à Plataforma sem autorização expressa e escrita da Prestadora;',
                'Inserir conteúdo ilegal, difamatório, discriminatório, pornográfico ou que viole direitos de terceiros;',
                'Tentar burlar quaisquer mecanismos de autenticação, controle de acesso ou segurança da Plataforma;',
                'Utilizar a Plataforma para envio de spam, comunicações não solicitadas ou atividades de phishing.',
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400/60" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              O descumprimento das condutas acima pode ensejar a suspensão ou encerramento imediato
              da conta, sem prejuízo de medidas judiciais cabíveis, inclusive ação de indenização
              por danos causados à Prestadora ou a terceiros.
            </p>
          </section>

          {/* 7. DISPONIBILIDADE */}
          <section>
            <H2 n="7">Disponibilidade do Serviço (SLA)</H2>
            <p>
              A Prestadora envidará esforços razoáveis para manter a Plataforma disponível{' '}
              <strong className="text-foreground">
                24 (vinte e quatro) horas por dia, 7 (sete) dias por semana
              </strong>
              , com uptime-alvo de{' '}
              <strong className="text-foreground">99,5% ao mês</strong> (excluídas manutenções
              programadas).
            </p>
            <ul className="mt-3 space-y-2">
              <Li>
                <strong className="text-foreground">Manutenções programadas</strong> serão
                comunicadas com antecedência mínima de 48 (quarenta e oito) horas por e-mail e/ou
                painel de status, preferencialmente em horários de baixo uso.
              </Li>
              <Li>
                <strong className="text-foreground">Manutenções emergenciais</strong> (incidentes
                críticos de segurança ou falhas graves) podem ser realizadas sem aviso prévio, com
                comunicação imediata após o início da intervenção.
              </Li>
              <Li>
                A Prestadora não garante disponibilidade ininterrupta e não se responsabiliza por
                indisponibilidades decorrentes de caso fortuito ou força maior, falhas de
                infraestrutura de terceiros (ex.: provedores de cloud, ISPs) ou atos do próprio
                Usuário.
              </Li>
            </ul>
          </section>

          {/* 8. LIMITAÇÃO DE RESPONSABILIDADE */}
          <section>
            <H2 n="8">Limitação de Responsabilidade</H2>

            <SubH>8.1 Excludentes</SubH>
            <p className="mt-2">
              Na máxima extensão permitida pela legislação aplicável, a Prestadora não será
              responsável por:
            </p>
            <ul className="mt-3 space-y-2">
              <Li>Danos indiretos, incidentais, especiais, punitivos ou consequentes;</Li>
              <Li>Perda de lucros, receitas, dados ou oportunidades de negócio;</Li>
              <Li>
                Danos decorrentes do uso indevido da Plataforma pelo Usuário ou por terceiros com
                suas credenciais;
              </Li>
              <Li>Conteúdo inserido pelo Usuário ou por terceiros na Plataforma;</Li>
              <Li>Falhas ou interrupções de serviços de terceiros integrados à Plataforma.</Li>
            </ul>

            <SubH>8.2 Teto de Responsabilidade</SubH>
            <p className="mt-2">
              A responsabilidade total e agregada da Prestadora perante o Usuário, por qualquer
              causa, será limitada ao{' '}
              <strong className="text-foreground">
                valor pago pelo Usuário nos 3 (três) meses imediatamente anteriores ao evento
                gerador do dano
              </strong>
              , desde que referido valor seja positivo e não nulo.
            </p>

            <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/8 p-4 text-xs text-amber-300/80">
              <strong>Atenção (consumidores):</strong> As limitações acima não se aplicam na
              extensão em que conflitem com normas cogentes de proteção ao consumidor (CDC, Lei
              nº 8.078/1990), especialmente às hipóteses de dano material ou moral decorrente de
              vício ou defeito do produto/serviço (arts. 12 e 14 do CDC).
            </p>
          </section>

          {/* 9. PRIVACIDADE */}
          <section>
            <H2 n="9">Privacidade e Proteção de Dados</H2>
            <p>
              O tratamento de dados pessoais realizado no âmbito destes Termos é regido pela{' '}
              <Link href="/privacidade" className="text-copper hover:underline">
                Política de Privacidade
              </Link>
              , que integra estes Termos como documento vinculante. O Usuário declara estar ciente
              de seus direitos enquanto titular de dados pessoais na forma da{' '}
              <strong className="text-foreground">Lei nº 13.709/2018 (LGPD)</strong>.
            </p>
          </section>

          {/* 10. SUSPENSÃO E ENCERRAMENTO */}
          <section>
            <H2 n="10">Suspensão e Encerramento de Conta</H2>

            <SubH>10.1 Pelo Usuário</SubH>
            <p className="mt-2">
              O Usuário pode encerrar sua conta a qualquer momento acessando{' '}
              <strong>/perfil/configuracoes</strong> ou enviando solicitação para{' '}
              <a href={`mailto:${email}`} className="text-copper hover:underline">
                {email}
              </a>
              . O encerramento não cancela obrigações financeiras pendentes.
            </p>

            <SubH>10.2 Pela Prestadora</SubH>
            <p className="mt-2">
              A Prestadora pode suspender ou encerrar o acesso do Usuário, com ou sem aviso prévio,
              nos seguintes casos:
            </p>
            <ul className="mt-2 space-y-2">
              <Li>Violação destes Termos ou da Política de Privacidade;</Li>
              <Li>Inadimplência superior a 30 (trinta) dias;</Li>
              <Li>Uso ilícito, fraudulento ou abusivo da Plataforma;</Li>
              <Li>Determinação de autoridade competente;</Li>
              <Li>Encerramento das atividades da Prestadora (com aviso prévio de 60 dias).</Li>
            </ul>

            <SubH>10.3 Efeitos do Encerramento</SubH>
            <p className="mt-2">
              Após o encerramento, o acesso à Plataforma é revogado imediatamente. Os dados do
              Usuário serão retidos pelo prazo estabelecido na Política de Privacidade e então
              eliminados, salvo obrigação legal de conservação. O Usuário pode solicitar exportação
              de seus dados antes do encerramento.
            </p>
          </section>

          {/* 11. MODIFICAÇÕES */}
          <section>
            <H2 n="11">Modificações nos Termos</H2>
            <p>
              A Prestadora reserva-se o direito de modificar estes Termos a qualquer momento. Nas
              modificações que impactem direitos ou obrigações relevantes do Usuário, a comunicação
              será feita com{' '}
              <strong className="text-foreground">antecedência mínima de 30 (trinta) dias</strong>{' '}
              por e-mail e/ou aviso na Plataforma.
            </p>
            <p className="mt-3">
              Caso o Usuário não concorde com as modificações, poderá cancelar sua conta antes da
              data de vigência dos novos Termos sem qualquer ônus proporcional ao período não
              utilizado. O uso continuado após a vigência implica aceite tácito das alterações.
            </p>
          </section>

          {/* 12. INTEGRAÇÕES E TERCEIROS */}
          <section>
            <H2 n="12">Serviços de Terceiros e Integrações</H2>
            <p>
              A Plataforma pode integrar-se a serviços de terceiros (ex.: Stripe, Mercado Pago,
              Google OAuth, GitHub). O uso desses serviços está sujeito aos termos e políticas de
              privacidade próprios de cada terceiro. A Prestadora não se responsabiliza pelo
              funcionamento, disponibilidade ou práticas de privacidade de serviços terceiros.
            </p>
          </section>

          {/* 13. LEI APLICÁVEL E FORO */}
          <section>
            <H2 n="13">Lei Aplicável, Foro e Resolução de Conflitos</H2>

            <SubH>13.1 Lei Aplicável</SubH>
            <p className="mt-2">
              Estes Termos são regidos exclusivamente pelas leis da{' '}
              <strong className="text-foreground">República Federativa do Brasil</strong>, com
              especial atenção ao Código Civil (Lei nº 10.406/2002), ao Código de Defesa do
              Consumidor (Lei nº 8.078/1990), ao Marco Civil da Internet (Lei nº 12.965/2014) e à
              LGPD (Lei nº 13.709/2018).
            </p>

            <SubH>13.2 Resolução Amigável</SubH>
            <p className="mt-2">
              Antes de qualquer medida judicial, as partes comprometem-se a buscar solução amigável
              no prazo de{' '}
              <strong className="text-foreground">15 (quinze) dias úteis</strong> a contar da
              notificação formal do conflito.
            </p>

            <SubH>13.3 Foro</SubH>
            <p className="mt-2">
              Não solucionado amigavelmente, fica eleito o foro da{' '}
              <strong className="text-foreground">{foro}</strong> para dirimir quaisquer
              controvérsias, com renúncia expressa a qualquer outro, por mais privilegiado que seja,
              exceto para Usuários consumidores que, nos termos do art. 101, I do CDC, podem optar
              pelo foro de seu domicílio.
            </p>

            <SubH>13.4 Arbitragem (relações B2B)</SubH>
            <p className="mt-2">
              Para relações entre pessoas jurídicas (B2B) com valor em discussão superior a R$
              50.000,00 (cinquenta mil reais), as partes podem optar pela arbitragem, nos termos da
              Lei nº 9.307/1996, mediante acordo escrito firmado após o surgimento do litígio.
            </p>
          </section>

          {/* 14. DISPOSIÇÕES GERAIS */}
          <section>
            <H2 n="14">Disposições Gerais</H2>
            <ul className="space-y-3">
              <Li>
                <strong className="text-foreground">Integralidade:</strong> Estes Termos, a Política
                de Privacidade e eventuais contratos de serviços específicos constituem o acordo
                integral entre as partes, substituindo quaisquer entendimentos anteriores.
              </Li>
              <Li>
                <strong className="text-foreground">Independência das cláusulas:</strong> A
                invalidade ou inexequibilidade de qualquer cláusula não afeta as demais, que
                permanecem em pleno vigor.
              </Li>
              <Li>
                <strong className="text-foreground">Renúncia:</strong> A omissão da Prestadora em
                exercer qualquer direito previsto nestes Termos não constituirá renúncia, novação ou
                precedente.
              </Li>
              <Li>
                <strong className="text-foreground">Cessão:</strong> O Usuário não pode ceder,
                transferir ou sublicenciar seus direitos decorrentes destes Termos sem o
                consentimento prévio e escrito da Prestadora. A Prestadora pode ceder seus direitos
                em caso de reorganização societária, desde que os direitos do Usuário sejam
                preservados.
              </Li>
              <Li>
                <strong className="text-foreground">Comunicações:</strong> Notificações e
                comunicações oficiais devem ser enviadas por e-mail, valendo como prova o acuse de
                recebimento eletrônico.
              </Li>
            </ul>
          </section>

          {/* 15. CONTATO */}
          <section>
            <H2 n="15">Canais de Atendimento</H2>
            <dl className="mt-4 space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-5 font-mono text-xs">
              <Row label="Suporte técnico"        value="suporte@devtechs.io" />
              <Row label="Financeiro / cobrança"  value="financeiro@devtechs.io" />
              <Row label="Cancelamento"           value="cancelamento@devtechs.io" />
              <Row label="Segurança / incidentes" value="seguranca@devtechs.io" />
              <Row label="Privacidade / LGPD (DPO)" value="privacidade@devtechs.io" />
              <Row label="Jurídico"               value="juridico@devtechs.io" />
              <Row label="Consumidor.gov"         value="A Prestadora está cadastrada no consumidor.gov.br" />
            </dl>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-white/8 pt-8 text-center">
          <p className="font-mono text-xs text-ash/50">
            {name} · CNPJ {cnpj} · Termos de Uso v{VERSION} · {UPDATED}
          </p>
          <div className="mt-4 flex justify-center gap-6 font-body text-xs">
            <Link href="/privacidade" className="text-ash transition-colors hover:text-copper">
              Política de Privacidade
            </Link>
            <Link href="/contato" className="text-ash transition-colors hover:text-copper">
              Contato
            </Link>
            <Link href="/" className="text-ash transition-colors hover:text-copper">
              Início
            </Link>
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

function SubH({ children }: { children: React.ReactNode }): JSX.Element {
  return <h3 className="mb-1 mt-4 font-semibold text-foreground/80">{children}</h3>;
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
