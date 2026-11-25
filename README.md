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

Use um banco de teste separado. Verifique login, criação de workspace/quadro/campos, edição e exclusão conforme permissões, recarga com persistência, Kanban e resumo, tema escuro, mobile, tarefas antigas, anexos e recorrências. Não execute o preview contra o banco de produção sem autorização. Acesso público a formulários ainda não implementado.

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

### Motor de automações v1

Administradores podem criar, pausar, ativar e excluir regras na aba Automações de cada Board. Gatilhos: criação de registro ou mudança de campo editável. Condição opcional: status igual a um valor (somente mudança). Ações: alterar status, mover para grupo, criar registro no mesmo quadro ou notificar usuário ativo. O administrador autoriza a execução das ações por alterações realizadas por usuários com as permissões existentes; não há novas permissões granulares. Regras são avaliadas pelo snapshot da mudança original, em ordem de ID; alterações automáticas não disparam outras regras. Se várias regras alterarem o mesmo campo, prevalece a última. O trigger PostgreSQL registra sucesso/falha na mesma transação, isolando falhas de cada ação. Histórico recente: últimos 200 registros globalmente, visível a administradores. Não há fila, retry, cron, e-mail, webhook ou múltiplas ações por regra. A exclusão preserva o histórico da regra.

Antes da publicação, valide em PostgreSQL de teste: instalação do trigger e constraints; criação, alteração sem mudança real, status condicional, pausa, falha isolada, ausência de cascata, exclusão e histórico, notificação e acesso não-admin. O preview não deve usar o banco de produção. As tabelas e o trigger são criados na primeira chamada autenticada a /api/workspaces.

### Workflow Builder v1

Na aba Workflows, administradores criam fluxos por quadro com gatilho de criação ou alteração de campo editável. O editor permite até 10 etapas ordenadas, incluindo ações e decisões de status com caminhos Sim/Não (até 5 ações por caminho, 20 ações no total). Ações: alterar status, mover grupo, criar registro no próprio quadro e notificar usuário ativo. A condição lê o estado atual do registro, incluindo efeitos de etapas anteriores. Os gatilhos usam a mudança original; o trigger de automações simples roda antes do trigger de workflows, por ordem alfabética do PostgreSQL. Cada fluxo roda em uma subtransação: qualquer falha reverte todas as suas ações, preservando a alteração original e os demais fluxos. Alterações automáticas não disparam outros fluxos nem automações. Histórico preservado ao excluir o fluxo; últimos 200 registros globalmente para administradores. Não há espera, aprovação humana persistente, agendamento, editor de grafo livre, edição de fluxos publicados ou integração externa nesta versão.

Valide em banco de teste: instalação do trigger, execução ordenada, caminhos Sim/Não, pausa, falha após etapa bem-sucedida (rollback inclusive de notificações), ausência de recursão e coexistência com automações simples. Verifique também permissões, histórico e interface. A criação das tabelas e do trigger ocorre na primeira chamada autenticada de /api/workspaces.

### Form Builder v1

Administradores criam formulários por quadro, selecionam até 30 campos básicos e definem quais são obrigatórios, descrição e grupo de destino. O título do registro é obrigatório; texto, número, data, status e resposta Sim/Não são suportados. Campos calculados e relacionamentos não são aceitos nesta versão. Usuários autenticados com permissão de criação respondem pela aba Formulários ou por link interno `?form=ID`. Administradores podem pausar e reativar formulários; não há edição de definições publicadas nem acesso anônimo. A API valida a configuração, tipos, campos obrigatórios e grupo; um único comando SQL cria o registro e guarda o protocolo, autor e respostas originais. A chave UUID por usuário/formulário protege reenvios do mesmo formulário aberto (não deduplica respostas independentes). A criação de registro dispara os gatilhos de criação existentes; condições de workflows podem usar os valores enviados. Gatilhos de alteração não disparam no envio inicial. A resposta original permanece no histórico mesmo que o registro seja alterado ou excluído. Histórico administrativo: últimos 200 envios globalmente. A autorização ainda é global, não por formulário ou quadro.

Validar em banco de teste: criação, pausa, links após login, permissão de criação, tipos inválidos, zero/falso obrigatórios, envio repetido/concomitante, atomicidade e integração com triggers de automação e workflow. Não usar o banco de produção para testes.

### Advanced Visualization Engine v1

- Calendário mensal em grade de 42 dias, com navegação, retorno ao mês atual e seleção do campo de data.
- Gantt: seleção de início e fim (inclusive), duração em dias corridos, exclusão de períodos inválidos e avisos de conflito de predecessores por campo de relacionamento com o mesmo Board. Não há bloqueio, edição por arraste, caminho crítico ou reprogramação automática; filtros podem ocultar predecessores.
- Carga de trabalho: agrupa pelo texto do responsável, com contagem ou esforço numérico, capacidade uniforme e opção de excluir concluídos. Esforço ausente ou inválido é contado à parte e tratado como zero. Não há cadastro de capacidade individual, disponibilidade temporal ou campo pessoa vinculado ao cadastro de usuários.
- Dashboard configurável: até 20 KPIs de múltiplos Boards (total, concluídos, percentual, soma, média, mínimo e máximo). Busca filtra somente os indicadores do Board atual. O resumo automático permanece disponível em aba própria.
- Preferências de campo e widgets são armazenadas por usuário e Board no localStorage do navegador, não sincronizadas no servidor; todos os dados respeitam a autorização global existente. Sem alteração no schema PostgreSQL.

Testar navegação mensal, períodos longos, datas inválidas, avisos de dependência, sobrecarga, troca de Boards, persistência local, tema escuro e layout móvel. Os cálculos puros estão em dist/analytics-core.js e possuem testes em test/advanced-views.test.js.

### Governance & Collaboration v1

- Workspace e Board podem ser compartilhados ou restritos. Os compartilhados mantêm o acesso anterior; os restritos exigem membro explícito. A regra efetiva é o menor nível entre workspace e Board: Leitor, Editor, Gestor. Administradores mantêm acesso; permissões globais de criação/edição/exclusão continuam sendo um teto. Remover um perfil explícito em um escopo compartilhado restaura o padrão, não revoga acesso. Somente administradores alteram membros e visibilidade.
- A API filtra Boards, campos, itens, grupos e formulários antes de entregar os dados e calcular Lookup/Rollup. Metadados e valores de relações para Boards inacessíveis são ocultados; escritas de relações também exigem acesso ao destino. A autorização de mutações é verificada novamente no SQL para a função de acesso ao Board. Não é RLS/multi-tenant; atividades legadas continuam com suas permissões globais e a revogação concorrente deve ser validada em integração.
- Comentários por registro dinâmico, disponíveis para leitores com acesso. Menção opcional notifica um usuário autorizado; a notificação não contém título, conteúdo ou link sensível. Notificações de workflows/automações passam a exigir acesso do destinatário e usam texto genérico; mensagens dinâmicas antigas são sanitizadas na migração. Regras configuradas por administradores continuam executando dentro do próprio Board.
- Auditoria administrativa de criação, edição, exclusão de registros, comentários e mudanças de visibilidade/membros, com autor quando originado pelas APIs, timestamp, ID e indicador automático. Não é histórico completo de valores nem trilha de todas as configurações; registros anteriores não são retroativamente auditados. Histórico recente limitado a 200 eventos globais; comentários a 100 por registro.
- Entidades: work_workspace_members, work_board_members, work_audit, work_comments. Migração aditiva e upgrade dos triggers de automação/workflow. Escopos existentes e novos iniciam compartilhados para compatibilidade. Configurar restrições antes de inserir dados confidenciais. Grupos de usuários, anexos nos Boards dinâmicos, isolamento por organização e feed central completo continuam pendentes.

Validação obrigatória em PostgreSQL separado: matriz leitor/editor/gestor/admin, revogação em ambos os escopos, acesso por ID direto, formulário por link, relações entre Boards restritos, notificações após revogação, auditoria de mutações e rollback, concorrência e compatibilidade de triggers. Não usar banco de produção. Os testes puros não validam a função SQL de acesso nem a migração.

### Integration Engine v1 — CSV e homologação

A aba Importar / Exportar permite que usuários com leitura exportem um CSV UTF-8 com BOM e separador ponto e vírgula, compatível com Excel. O arquivo contém título, grupo e campos autorizados (incluindo resultados calculados); relações exportam títulos visíveis. Strings com prefixos potencialmente interpretáveis como fórmulas são neutralizadas com apóstrofo. A exportação não inclui campos relacionados restritos, comentários ou histórico. Limite de 10 mil registros e 3,5 MB de CSV. Valores numéricos usam ponto decimal no arquivo; ao abrir no Excel, selecione a configuração regional adequada.

Usuários com criação podem importar CSV/TSV (salvar planilha Excel como CSV UTF-8). Selecione delimitador, título, campos e grupo de destino, valide a prévia e confirme. São aceitos até 200 registros, 100 colunas e 500 mil caracteres por lote, campos de texto, número, data, Sim/Não e status. Datas DD/MM/AAAA ou ISO, números sem separador de milhares. Linhas em branco são ignoradas. Erros bloqueiam todo o lote; a prévia exibe até 10 registros e 100 erros. A importação só cria registros, não modifica nem deduplica registros existentes. A chave UUID evita repetição do mesmo lote enviado; alterar mapeamento ou abrir outra sessão cria uma nova importação. O lote e seus registros são gravados na mesma instrução SQL. Gatilhos de criação existentes executam por registro; podem gerar registros adicionais. O histórico mostra os últimos 50 lotes (administradores veem todos do Board, demais usuários apenas os próprios). Acesso revalidado na API. Arquivos .xlsx, API com chaves, webhooks, e-mail e Microsoft 365 ainda não estão disponíveis.

Homologação: workflow GitHub Actions `Work OS validation` configura Node 22 e PostgreSQL 16 descartável e executa `npm test` e verificação de sintaxe. O teste `test/postgres-integration.test.js` usa as migrações reais dos módulos e uma estrutura mínima de tabelas de teste, verifica permissões, importação, reenvio, auditoria, triggers e rollback. Ele exige `AGEND_TEST_DATABASE_URL` apontando exclusivamente para `localhost`/`127.0.0.1` e banco `agend_test`, com dependência pg instalada; sem variável, é ignorado. Não representa teste end-to-end do servidor Vercel ou do navegador. Validar separadamente UI, autenticação, revogação concorrente, importação e exportação em ambiente de preview com banco isolado.
