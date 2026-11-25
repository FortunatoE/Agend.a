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

### Evolução dos quadros

Grupos persistentes por quadro, atribuição de registros a grupos validada no servidor, calendário por campo de data (lista de eventos agrupada por data), dashboard com contagem, conclusão, distribuição por status e soma de campos numéricos. Os dados existentes permanecem sem grupo até serem classificados. Testar também movimentação entre grupos e rejeição de grupo de outro quadro.

### Relacionamentos e campos calculados

- Relacionamento: seleção de até 200 registros do quadro de destino, com validação na API.
- Lookup: espelha o nome ou um campo básico dos registros vinculados.
- Rollup: contagem de registros, soma, média, mínimo ou máximo de campos numéricos relacionados.
- Fórmula: operações +, -, * e / entre dois campos numéricos básicos do mesmo quadro; sem avaliação de código arbitrário. Divisão por zero e dados ausentes resultam em valor vazio.
- Valores calculados são derivados no servidor ao carregar os quadros e não são editáveis. Ainda não há fórmulas encadeadas ou editor de expressões livres.
- Relações são armazenadas como IDs em JSONB; registros excluídos ou fora do quadro são ignorados no cálculo e na exibição, sem limpeza física automática dos IDs. Permissões globais continuam vigentes; isolamento granular deve anteceder uso multi-tenant.
- Migração aditiva: `work_fields.config` e ampliação da restrição de tipos. Validar em banco separado antes do merge.
- Testes unitários: `npm test` (Node.js). Testar também criação/edição no navegador, recarga, relações inválidas e atualização de valores após editar o quadro de destino.
