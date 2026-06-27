## Descrição
<!-- O que esta PR implementa ou corrige? -->

## Issue relacionada
<!-- Ex: Closes SZD-123 -->

---

## Checklist de deliverables reais (obrigatório)

> **Política verify-before-sign-off** (SZD-803): toda PR deve provar que os deliverables prometidos existem no código antes de ser merged. O incidente SZD-737 (`cf2bdf8`) é o caso-referência: PR descrita como "backend implementado" que só adicionou páginas de frontend; a rota nunca existiu.

### Backend
- [ ] As rotas declaradas no PR description existem no controller (`git grep "POST /auth/..."`)
- [ ] Os serviços/métodos referenciados existem nos arquivos de serviço
- [ ] Testes unitários e/ou de integração cobrem o caminho feliz
- [ ] Build passa localmente (`pnpm build`)
- [ ] Typecheck passa (`pnpm typecheck`)

### Frontend
- [ ] As páginas/componentes adicionados estão conectados à rota/API real (não a um mock ou URL hardcoded)
- [ ] A chamada HTTP usa o baseURL correto para o ambiente

### Geral
- [ ] Nenhuma variável de ambiente nova sem entrada correspondente em `.env.example`
- [ ] Nenhuma credencial ou secret em texto plano
- [ ] O CI está verde antes do merge request

---

## Evidência de teste
<!-- Screenshot, curl output, log de teste ou link de pipeline -->
