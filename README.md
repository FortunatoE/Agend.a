# Agend.a

Plataforma interna para distribuir e acompanhar atividades de equipe.

## Recursos

- Visão geral por área
- Kanban persistente
- Calendário de prazos
- Rotinas recorrentes
- Relatórios por área
- Tema claro e escuro
- Controle de acesso por usuário e permissões
- Checklists, comentários, histórico e anexos privados
- Calendário anual, mensal, semanal e diário
- PostgreSQL no Neon, conectado à Vercel

## Áreas

- Administrativo
- Logística · Defensivo
- Logística · Adubo
- Planejamento

## Desenvolvimento

```bash
npm install
vercel dev
```

Defina `DATABASE_URL` no ambiente. Em produção, a integração Neon da Vercel fornece essa variável automaticamente.

## Work OS — versão em desenvolvimento

- Workspaces e quadros criados por administradores.
- Campos dinâmicos: texto, número, data, checkbox e status.
- Registros com valores tipados persistidos em PostgreSQL JSONB.
- Visualizações tabela, Kanban (primeiro campo status) e resumo numérico.
- Atividades legadas continuam no módulo Quadro, com suas APIs e histórico.
- A API /api/workspaces utiliza a autenticação e permissões globais existentes. Todos os usuários autenticados compartilham os ambientes; ainda não há isolamento por organização ou quadro.
- As tabelas novas são criadas de forma aditiva; não há migração automática das atividades para quadros dinâmicos.

### Validação antes de publicar

Use um banco de teste separado. Verifique login, criação de workspace/quadro/campos, edição e exclusão conforme permissões, recarga com persistência, Kanban e resumo, tema escuro, mobile, tarefas antigas, anexos e recorrências. Não execute o preview contra o banco de produção sem autorização. Automações configuráveis, relacionamentos, formulários e workflows ainda não implementados.
