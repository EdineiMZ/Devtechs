# Política Interna de Resposta a Incidentes de Segurança e Privacidade

**Empresa:** SZDevs  
**Versão:** 1.0  
**Data de vigência:** 03/05/2026  
**Próxima revisão:** 03/05/2027  
**Responsável:** Encarregado de Dados (DPO) — privacidade@szdevs.com  
**Base legal:** LGPD art. 48; Resolução CD/ANPD nº 15/2024

---

## 1. Objetivo

Estabelecer um procedimento claro, rastreável e acionável para que a SZDevs detecte, contenha, avalie, notifique e aprenda com qualquer incidente de segurança que possa afetar dados pessoais sob sua responsabilidade — cumprindo as obrigações do art. 48 da LGPD e da Resolução CD/ANPD nº 15/2024.

---

## 2. Escopo

Aplica-se a **todos os colaboradores, prestadores de serviço e sistemas** que tratam dados pessoais em nome da SZDevs, incluindo:

- Plataforma web (szdevs.com) e seus microsserviços
- Infraestrutura de nuvem / VPS
- E-mails corporativos e canais de comunicação internos
- Repositórios de código que contenham dados reais ou credenciais
- Operadores terceirizados (subprocessadores) que tratem dados em nosso nome

---

## 3. Definições

| Termo | Definição |
|-------|-----------|
| **Incidente de segurança** | Qualquer evento que comprometa confidencialidade, integridade ou disponibilidade de dados pessoais — acidental ou intencional |
| **Violação de dados pessoais** | Subconjunto do anterior: acesso não autorizado, destruição, perda, alteração ou divulgação de dados pessoais (LGPD art. 46) |
| **Titular** | Pessoa natural a quem os dados pessoais se referem |
| **ANPD** | Autoridade Nacional de Proteção de Dados |
| **DPO** | Encarregado de Dados — ponto focal desta política |
| **Equipe de Resposta** | DPO + responsável técnico (CTO/dev-lead) + responsável jurídico (se contratado) |
| **RTO** | Recovery Time Objective — tempo máximo aceitável de indisponibilidade |

---

## 4. Classificação de Incidentes

Cada incidente recebe um nível de criticidade na abertura do chamado interno. O nível determina os prazos e quem aciona.

### Nível 1 — Baixo (sem impacto externo confirmado)
- Tentativa de acesso não autorizado bloqueada (ex.: brute-force contida pelo rate-limiter)
- Exposição interna de log com dados pessoais acessada apenas por colaborador autorizado
- Credencial interna expirada e rotacionada sem vazamento confirmado

**Ação:** Registro no log de incidentes. Sem notificação externa. Revisão na próxima sprint.

### Nível 2 — Moderado (risco potencial para titulares)
- Credencial de produção exposta em repositório, mesmo por curto período
- Backup acessível publicamente por período limitado (< 24 h)
- Falha de controle de acesso que permitiu a um usuário ver dados de outro (escopo restrito)

**Ação:** Contenção imediata. DPO avalia necessidade de comunicação à ANPD. Investigação completa em 48 h.

### Nível 3 — Alto (impacto real ou provável sobre titulares)
- Vazamento confirmado de dados pessoais (e-mail, nome, telefone, etc.) para terceiros não autorizados
- Acesso não autorizado a banco de dados de produção
- Ransomware ou destruição de dados com backup comprometido
- Falha de autenticação que expôs dados de múltiplos usuários

**Ação:** Protocolo completo abaixo. Notificação à ANPD obrigatória. Comunicação aos titulares avaliada.

### Nível 4 — Crítico (dano grave confirmado)
- Vazamento em massa (> 1.000 titulares ou dados sensíveis de qualquer quantidade)
- Dados de saúde, financeiros ou de menores expostos
- Comprometimento total da infraestrutura

**Ação:** Protocolo completo + acionamento jurídico imediato + comunicação pública se necessário.

---

## 5. Procedimento de Resposta — Passo a Passo

```
[DETECÇÃO] → [REGISTRO] → [CONTENÇÃO] → [AVALIAÇÃO] → [NOTIFICAÇÃO] → [RECUPERAÇÃO] → [PÓS-INCIDENTE]
      T+0h          T+1h         T+4h          T+24h          T+72h*           variável         T+30 dias

* prazo da ANPD para comunicação preliminar (Res. CD/ANPD nº 15/2024)
```

---

### Fase 1 — Detecção e Registro (T+0 a T+1h)

**Quem detecta:** Qualquer colaborador, sistema de monitoramento, cliente, terceiro.

**O que fazer imediatamente:**

1. **Não apagar evidências.** Não reiniciar servidores, não excluir logs, não alterar arquivos comprometidos antes da análise.
2. **Abrir chamado interno** no canal `#incidentes-segurança` (Slack/e-mail interno) com:
   - Data e hora da descoberta
   - Descrição do que foi observado
   - Sistema(s) afetado(s)
   - Fonte da descoberta (monitoramento automático, relato de usuário, análise manual)
3. **Acionar o DPO** diretamente: privacidade@szdevs.com ou WhatsApp corporativo.
4. **Atribuir número de incidente:** formato `INC-YYYY-NNN` (ex.: `INC-2026-001`)

**Registro mínimo que deve existir para cada incidente (mesmo Nível 1):**

```
INC-YYYY-NNN
- Data/hora de abertura:
- Data/hora de detecção:
- Detectado por:
- Sistemas afetados:
- Dados pessoais envolvidos (tipos, volumes estimados):
- Nível de criticidade inicial:
- Ações imediatas tomadas:
- Status: [Aberto | Em análise | Contido | Encerrado]
```

---

### Fase 2 — Contenção Imediata (T+1h a T+4h)

**Objetivo:** Parar o sangramento. Não necessariamente restaurar o serviço — isso vem depois.

Ações conforme o tipo de incidente:

| Tipo | Ação de contenção |
|------|-------------------|
| Credencial vazada | Revogar imediatamente via painel (Redis, BD, OAuth, API keys). Invalidar todas as sessões ativas do sistema afetado. |
| Acesso não autorizado ativo | Bloquear IP/usuário. Derrubar sessão. Isolar serviço se necessário. |
| Exposição de dados em repositório | Remover o commit (git filter-branch / BFG). Tornar o repositório privado temporariamente. Rotar a credencial exposta. |
| Banco de dados comprometido | Isolar instância da rede pública. Revogar acessos. Preservar snapshot para análise forense. |
| Ransomware | Desligar o sistema da rede. NÃO pagar resgate. Contatar especialista forense. |

**Checklist de contenção:**

- [ ] Acesso não autorizado encerrado?
- [ ] Credenciais comprometidas revogadas?
- [ ] Logs e evidências preservados (snapshot, dump, print)?
- [ ] Sistemas em estado seguro (mesmo que degradado)?
- [ ] Equipe de resposta comunicada?

---

### Fase 3 — Avaliação de Impacto (T+4h a T+24h)

O DPO conduz a avaliação com o responsável técnico. Responder objetivamente:

**3.1 — Quais dados foram afetados?**
- Tipo de dado: nome, e-mail, telefone, senha (hash), dados de pagamento, documentos, dados sensíveis?
- Volume: quantos registros / quantos titulares distintos?
- Período de exposição: de quando a quando?

**3.2 — Quem teve acesso indevido?**
- Agente interno (colaborador, ex-colaborador)?
- Agente externo (atacante, scraper)?
- Acesso confirmado ou apenas possível?

**3.3 — Qual o risco real para os titulares?**

Usar a matriz abaixo. A resposta final orienta a obrigação de notificar.

| | Probabilidade baixa | Probabilidade alta |
|---|---|---|
| **Impacto baixo** | Nível 1 — registrar | Nível 2 — avaliar comunicação |
| **Impacto alto** | Nível 2 — avaliar comunicação | Nível 3/4 — notificar |

**Impacto considerado alto quando:** risco de discriminação, dano financeiro, roubo de identidade, dano reputacional, exposição de dado sensível (saúde, origem racial, biometria, dado de criança/adolescente).

**3.4 — Existe obrigação de notificar?**

| Situação | Obrigação |
|----------|-----------|
| Risco ou dano relevante confirmado | Notificar ANPD **e** titulares (LGPD art. 48) |
| Risco potencial, impacto incerto | Notificar ANPD, avaliar titulares caso a caso |
| Risco mínimo, sem acesso externo confirmado | Registrar internamente. ANPD: facultativo mas recomendado. |

---

### Fase 4 — Notificação (até T+72h para preliminar à ANPD)

#### 4.1 — Notificação à ANPD

**Prazo:** 72 horas a partir da constatação do incidente (Resolução CD/ANPD nº 15/2024, art. 5º).  
**Canal:** Portal gov.br/anpd → "Comunicação de Incidente de Segurança" (autenticação via gov.br).  
**Responsável:** DPO.

Informações obrigatórias na notificação (LGPD art. 48, §2º):

```
a) Natureza dos dados pessoais afetados
b) Informações sobre os titulares envolvidos (quantidade, categorias)
c) Medidas técnicas e de segurança utilizadas para proteger os dados
d) Riscos relacionados ao incidente
e) Motivos de eventual demora na comunicação
f) Medidas adotadas ou a adotar para reverter ou mitigar os efeitos
```

> **Nota:** A notificação inicial pode ser **preliminar** — incompleta se a investigação ainda estiver em curso. A ANPD aceita complementações. É melhor notificar dentro do prazo com informações parciais do que notificar fora do prazo com informações completas.

Se a investigação ainda estiver em andamento às 72h, declarar isso explicitamente na notificação e comprometer-se com prazo para complementação (em geral 30 dias).

#### 4.2 — Comunicação aos Titulares

**Quando obrigatório:** Quando o incidente puder acarretar risco ou dano relevante aos titulares (LGPD art. 48, caput).

**Canal preferencial:** E-mail direto ao endereço cadastrado do titular.  
**Alternativa se e-mail inoperante:** Comunicado no painel do usuário + banner no site + comunicado à imprensa (para Nível 4).

**Template de comunicação ao titular:**

```
Assunto: [SZDevs] Aviso importante sobre sua conta

Prezado(a) [Nome],

Identificamos um incidente de segurança em [data] que pode ter afetado 
dados vinculados à sua conta na plataforma SZDevs.

O que aconteceu:
[Descrição clara, sem jargão técnico]

Quais dados foram afetados:
[Tipos de dados — ex.: nome, e-mail. Nunca detalhar o que não foi afetado
de forma que pareça confirmar outros vazamentos]

O que já fizemos:
[Medidas de contenção já aplicadas]

O que você deve fazer:
[Ações recomendadas ao titular — ex.: trocar senha, monitorar extratos]

Se tiver dúvidas:
Entre em contato com nosso DPO: privacidade@szdevs.com
Referência do incidente: INC-YYYY-NNN

Atenciosamente,
Equipe SZDevs
```

**O que NÃO fazer na comunicação:**
- Minimizar o incidente ("apenas alguns dados")
- Usar jargão técnico que confunda o titular
- Pedir senha ou dados adicionais na comunicação (parece phishing)
- Enviar de endereço diferente do habitual (também parece phishing)

#### 4.3 — Comunicação Interna

Independente do nível, comunicar à liderança interna:
- Resumo executivo do incidente (uma página)
- Impacto nos negócios
- Ações em curso
- Prazo estimado de resolução

---

### Fase 5 — Erradicação e Recuperação

**Objetivo:** Eliminar a causa raiz e restaurar a operação normal com segurança reforçada.

Checklist:

- [ ] Causa raiz identificada e documentada
- [ ] Vulnerabilidade corrigida (patch, configuração, controle de acesso)
- [ ] Credenciais rotacionadas (todas as afetadas e as que possam ter sido expostas indiretamente)
- [ ] Logs de auditoria revisados para identificar todo o escopo do acesso indevido
- [ ] Backup íntegro verificado antes de restaurar
- [ ] Testes de regressão de segurança executados antes de recolocar em produção
- [ ] Monitoramento intensificado por 30 dias após a recuperação

---

### Fase 6 — Pós-Incidente e Lições Aprendidas (até T+30 dias)

**Obrigatório para Nível 2, 3 e 4.**

Produzir um **Relatório de Pós-Incidente** contendo:

1. **Linha do tempo completa** — da origem ao encerramento
2. **Análise de causa raiz** — o que de fato causou o incidente (não apenas o sintoma)
3. **Falhas de controle identificadas** — o que deveria ter impedido e não impediu
4. **Impacto real** — titulares afetados, dados comprometidos, custo estimado
5. **Ações corretivas** — com responsável e prazo para cada item
6. **Ações preventivas** — mudanças de processo/tecnologia para evitar recorrência
7. **Atualização desta política** — se o incidente revelou lacuna no procedimento

O relatório é **confidencial**, fica arquivado no repositório interno (`docs/legal/incidentes/`) e é compartilhado com a ANPD se solicitado.

---

## 6. Quadro Resumo de Prazos

| Marco | Prazo | Responsável |
|-------|-------|-------------|
| Abrir chamado interno | Imediato (até 1h após detecção) | Quem detectou |
| Acionar DPO | Imediato (até 1h) | Quem detectou |
| Contenção inicial | Até 4h | Responsável técnico |
| Avaliação de impacto | Até 24h | DPO + responsável técnico |
| Notificação preliminar à ANPD (Nível 3/4) | Até 72h | DPO |
| Comunicação aos titulares (Nível 3/4) | Junto com ou logo após ANPD | DPO |
| Relatório complementar à ANPD | Até 30 dias | DPO |
| Relatório de pós-incidente interno | Até 30 dias | DPO + responsável técnico |
| Próxima revisão desta política | Anual ou após incidente Nível 3/4 | DPO |

---

## 7. Contatos de Emergência

| Papel | Contato |
|-------|---------|
| DPO / Encarregado de Dados | privacidade@szdevs.com |
| Responsável técnico (CTO/dev-lead) | [preencher] |
| ANPD — Portal de incidentes | gov.br/anpd |
| ANPD — Contato geral | anpd.gov.br/contato |
| Provedor de hospedagem (VPS) | [preencher com contato de suporte do provedor] |
| Especialista jurídico externo | [preencher quando contratado] |

---

## 8. Registro de Incidentes

Todo incidente, independente de nível, deve ser registrado no arquivo:

```
docs/legal/incidentes/INC-YYYY-NNN.md
```

O arquivo segue o template da Fase 1. O registro de incidentes serve como evidência de conformidade perante a ANPD e deve ser mantido por **no mínimo 5 anos** (analogia ao Marco Civil art. 15, dado que a LGPD não especifica prazo para este tipo de registro).

---

## 9. Treinamento e Conscientização

- Todo colaborador novo recebe esta política na integração e assina ciência
- Revisão anual com toda a equipe (pode ser assíncrona, via leitura + confirmação)
- Após incidente Nível 3/4: simulação de resposta a incidente (tabletop exercise) em até 60 dias

---

## 10. Relação com Outros Documentos

| Documento | Relação |
|-----------|---------|
| Política de Privacidade (publicada no site) | Menciona obrigação de notificação — este documento é o procedimento que a cumpre |
| Política de Segurança da Informação | Define controles preventivos; este documento define a resposta quando os controles falham |
| DPA / Contratos com Operadores | Operadores têm obrigação contratual de nos notificar em até 24h após detectar incidente |
| Registro de Atividades de Tratamento (ROPA) | Consultado durante a avaliação para identificar quais dados estão em cada sistema |

---

## 11. Histórico de Revisões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 03/05/2026 | DPO | Versão inicial |

---

> **Confidencial — Uso interno.** Este documento não deve ser publicado integralmente, mas pode ser referenciado na Política de Privacidade e apresentado à ANPD mediante solicitação.
