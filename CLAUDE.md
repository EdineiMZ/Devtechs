# SZDevs — Instruções para Claude

## Checklist obrigatório para qualquer tarefa com alterações de infraestrutura ou autenticação

### Validação de chaves de encriptação

Antes de finalizar qualquer tarefa que envolva:
- Alterações no `docker-compose.yml` ou arquivos `.env`
- Rebuild/restart do `auth-service`
- Rotação de variáveis de ambiente (especialmente `ENCRYPTION_KEY`)
- Migrações de banco de dados que afetem colunas encriptadas (`twoFactorSecret`, etc.)

**Execute sempre esta validação:**

1. Confirmar que `ENCRYPTION_KEY` é idêntica em todos os arquivos `.env`:
   ```bash
   grep "ENCRYPTION_KEY" /opt/szdevs/.env /opt/szdevs/infra/.env
   ```

2. Verificar que o `auth-service` em execução usa a mesma chave:
   ```bash
   docker exec SZDevs-auth-service env | grep ENCRYPTION_KEY
   ```

3. Se houver usuários com 2FA ativo, testar que o secret ainda descriptografa:
   ```bash
   docker exec SZDevs-postgres psql -U szdevs -d szdevs \
     -c "SELECT id, email, left(\"twoFactorSecret\", 30) FROM users WHERE \"twoFactorEnabled\" = true;"
   ```

**Contexto:** Em maio/2026 o `infra/.env` ficou com uma `ENCRYPTION_KEY` diferente do `.env` raiz.
Isso causou falha silenciosa no 2FA — o secret foi encriptado com a chave do `infra/.env`
mas o container rodava com a chave do `.env` raiz. A chave canônica é sempre a do `.env` raiz.

### Aliases DNS no Docker

Ao adicionar `ipv4_address` + `container_name: SZDevs-*` a um serviço no `docker-compose.yml`,
adicionar também `aliases` na config de rede, senão o DNS interno não resolve pelo nome do serviço:

```yaml
networks:
  SZDevs:
    ipv4_address: 172.16.1.X
    aliases:
      - nome-do-servico
```

Após alterar aliases, verificar conectividade:
```bash
docker exec SZDevs-web nslookup auth-service
docker exec SZDevs-web wget -qO- http://auth-service:3001/health
```

### Timezone dos logs

Os containers rodam em UTC. O servidor está em BRT (UTC-3).
Logs mostrando `12:xx` = `09:xx` horário de Brasília. Isso é normal e esperado.
