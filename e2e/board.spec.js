'use strict';
const {test,expect}=require('@playwright/test');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','dist');
let server,origin;
test.beforeAll(async()=>{server=http.createServer((req,res)=>{
 const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname.slice(1));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css'};
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data)});
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve))});
test('board navigation, filters, pagination, selection and Kanban',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const user={id:1,name:'Teste',username:'teste',is_admin:false,can_create:true,can_edit:true,can_delete:false};
 const data={workspaces:[{id:1,name:'Operações'}],boards:[{id:1,workspace_id:1,name:'Controle'}],fields:[{id:1,board_id:1,name:'Status',type:'status',config:{}},{id:2,board_id:1,name:'Responsável',type:'text',config:{}}],groups:[{id:1,board_id:1,name:'Pendências'}],items:Array.from({length:32},(_,i)=>({id:i+1,board_id:1,title:'Registro '+(i+1),group_id:1,values:{1:i===0?'Concluído':'A fazer',2:i===0?'João':'Ana'}})),permissions:{1:'editor'},forms:[]};
 await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;let json=p==='/api/auth'?{user}:p==='/api/tasks'?[]:p==='/api/notifications'?{notifications:[]}:p==='/api/workspaces'?data:[];await route.fulfill({json})});
 await page.goto(origin);await page.locator('[data-view="workspaces"]').click();
 const board=page.locator('#workspaces');await expect(board.getByRole('heading',{name:'Controle',exact:true})).toBeVisible();
 await expect(board.getByText('32 registros · Página 1 de 2')).toBeVisible();
 await expect(board.locator('tbody tr')).toHaveCount(25);
 await board.getByRole('button',{name:'Próxima',exact:true}).click();
 await expect(board.locator('tbody tr')).toHaveCount(7);
 await board.getByRole('searchbox',{name:'Buscar registros e valores'}).fill('joao');
 await expect(board.locator('tbody tr')).toHaveCount(1);
 await board.getByRole('checkbox',{name:'Selecionar Registro 1',exact:true}).check();
 await expect(board.getByText('1 selecionado(s)')).toBeVisible();
 await board.getByRole('button',{name:'Kanban',exact:true}).click();
 await expect(board.locator('.card[draggable="true"]')).toHaveCount(1);
 await expect(board.getByRole('button',{name:'Acesso e auditoria'})).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('product experience: icon names, dashboard drill-down, search, dialog keyboard and mobile navigation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const user={id:1,name:'Teste',username:'teste',is_admin:false,can_create:true,can_edit:true,can_delete:false};
 const tasks=[
 {id:1,title:'Conferência de estoque',area:'Planejamento',assignee:'João',assignee_id:1,status:'todo',due_date:'2020-01-01T00:00:00.000Z',priority:'alta',progress:0,recurrence:'não se repete',description:'Verificar estoque'},
 {id:2,title:'Revisão futura',area:'Planejamento',assignee:'João',assignee_id:1,status:'andamento',due_date:'2099-01-01',priority:'normal',progress:50,recurrence:'não se repete',description:'Revisar relatório'}];
 await page.route('**/api/**',async route=>{
 const p=new URL(route.request().url()).pathname;
 const json=p==='/api/auth'?{user}:p==='/api/tasks'?tasks:p==='/api/notifications'?{notifications:[]}:p==='/api/team'?[{id:1,name:'João'},{id:2,name:'Ana'}]:p==='/api/workspaces'?{workspaces:[{id:1,name:'Equipe'}],boards:[{id:1,workspace_id:1,name:'Planejamento mensal'}],fields:[],items:[],groups:[],permissions:{1:'editor'},forms:[]}:p==='/api/task-detail'?{checklist:[],comments:[],attachments:[],history:[]}:[];
 await route.fulfill({json});
 });
 await page.goto(origin);await page.locator('[data-view="overview"]').click();
 await expect(page.locator('#overview .ui-kpi')).toHaveCount(4);
 await expect(page.getByRole('button',{name:'Notificações',exact:true})).toBeVisible();
 await expect(page.locator('#notifications svg')).toHaveCount(1);
 await page.getByRole('button',{name:/Atrasadas/}).click();
 await expect(page.locator('#workRows tbody tr')).toHaveCount(1);
 await expect(page.locator('#workRows')).toContainText('Conferência de estoque');
 await page.getByRole('button',{name:'Limpar filtro',exact:true}).click();
 await expect(page.locator('#workRows tbody tr')).toHaveCount(2);
 await page.getByRole('button',{name:'Busca global',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await dialog.getByRole('searchbox').fill('conferencia');
 await expect(dialog.getByRole('button',{name:/Conferência de estoque/})).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Busca global',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Conferência de estoque',exact:true}).click();
 await expect(page.locator('#modal.ui-drawer')).toBeVisible();
 await expect(page.getByRole('dialog')).toContainText('Responsável');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Recolher menu',exact:true}).click();
 await expect(page.locator('#app')).toHaveClass(/ui-collapsed/);
 await page.getByRole('button',{name:'Expandir menu',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Relatórios',exact:true}).click();
 await expect(page.locator('#reports')).toContainText('João');
 await expect(page.locator('#reports')).not.toContainText('Colaborador 1');
 expect(errors).toEqual([]);
});

test('team calendar is admin-only and personal activity screens hide other users',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let admin=false;
 const today=new Date(),month=today.toISOString().slice(0,7),due=month+'-01';
 const tasks=[{id:1,title:'Minha tarefa',area:'Planejamento',assignee:'João',assignee_id:2,due_date:due,status:'todo',priority:'normal',progress:0,recurrence:'não se repete',description:'Nota pessoal'},{id:2,title:'Tarefa alheia',area:'Planejamento',assignee:'Ana',assignee_id:3,due_date:due,status:'concluída',priority:'normal',progress:100,recurrence:'semanal',description:'Nota da equipe'}];
 await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;
 const user={id:2,name:'João',username:'joao',is_admin:admin,can_create:true,can_edit:true,can_delete:false};
 await route.fulfill({json:p==='/api/auth'?{user}:p==='/api/tasks'?tasks:p==='/api/team'?[{id:2,name:'João'},{id:3,name:'Ana'}]:p==='/api/notifications'?{notifications:[]}:[]})});
 await page.goto(origin);await page.locator('[data-view="overview"]').click();await expect(page.locator('#overview .ui-kpi').first()).toContainText('1');
 await page.locator('[data-view="calendar"]').click();await expect(page.getByRole('button',{name:'Equipe · mensal',exact:true})).toHaveCount(0);
 await expect(page.locator('#calendar')).not.toContainText('Tarefa alheia');
 admin=true;await page.reload();await page.locator('[data-view="overview"]').click();await expect(page.locator('#overview .ui-kpi').first()).toContainText('2');
 await page.locator('[data-view="calendar"]').click();const cal=page.locator('#calendar');
 await expect(cal.getByRole('heading',{name:'Acompanhamento da equipe'})).toBeVisible();
 await expect(cal.locator('.team-cal-table tbody tr')).toHaveCount(2);
 await cal.getByLabel('Responsável',{exact:true}).selectOption('3');await expect(cal.locator('.team-cal-table tbody tr')).toHaveCount(1);await expect(cal.locator('.team-cal-table')).toContainText('Tarefa alheia');
 await cal.getByRole('searchbox',{name:'Buscar atividade'}).fill('inexistente');await expect(cal.locator('.team-cal-table tbody tr')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('weekly dashboard, creator edit rules and communication acknowledgements',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const user={id:2,name:'João',username:'joao',is_admin:false,can_create:true,can_edit:true,can_delete:true};
 const now=new Date(),due=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const common={area:'Planejamento',assignee:'João',assignee_id:2,due_date:due,status:'todo',priority:'normal',progress:0,recurrence:'semanal',recurrence_config:{weekdays:[1,3]},description:''};
 const tasks=[{...common,id:1,title:'Atribuída pelo administrador',created_by:1},{...common,id:2,title:'Criada por mim',created_by:2},{...common,id:3,title:'Atividade de terceiro',assignee_id:3,created_by:3}];
 const message={id:1,title:'Conferir estoque',kind:'lembrete',message:null,created_at:new Date().toISOString(),seen_at:null,done_at:null};let patches=[];
 await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;let json=[];
 if(p==='/api/auth')json={user};else if(p==='/api/tasks')json=tasks;else if(p==='/api/team')json=[{id:2,name:'João'},{id:3,name:'Ana'}];else if(p==='/api/notifications')json={notifications:[]};else if(p==='/api/task-detail')json={checklist:[],comments:[],attachments:[],history:[]};
 else if(p==='/api/communication'){if(route.request().method()==='PATCH'){const d=route.request().postDataJSON();patches.push(d.action);message.seen_at=message.seen_at||new Date().toISOString();message.message='Conferir o saldo físico';if(d.action==='done')message.done_at=new Date().toISOString();json={seen_at:message.seen_at,done_at:message.done_at}}else json={received:[message],sent:[],notes:[],areas:['Planejamento'],members:[{user_id:2,area:'Planejamento'}]}}
 await route.fulfill({json})});
 await page.goto(origin);await page.locator('[data-view="overview"]').click();const week=page.locator('.overview-week-table');
 await expect(week.locator('tbody tr')).toHaveCount(2);await expect(week.locator('thead th')).toHaveCount(11);await expect(week).not.toContainText('Atividade de terceiro');
 await week.getByRole('button',{name:'Atribuída pelo administrador',exact:true}).click();let d=page.getByRole('dialog');await expect(d.getByText(/dados protegidos/)).toBeVisible();await expect(d.getByRole('button',{name:'Editar atividade',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 await week.getByRole('button',{name:'Criada por mim',exact:true}).click();await d.getByRole('button',{name:'Editar atividade',exact:true}).click();
 await expect(d.getByRole('heading',{name:'Editar atividade'})).toBeVisible();await expect(d.getByRole('checkbox',{name:'Seg',exact:true})).toBeChecked();await expect(d.getByRole('checkbox',{name:'Qua',exact:true})).toBeChecked();await d.locator('#recurrence').selectOption('mensal');await expect(d.getByLabel('Dia do mês',{exact:true})).toBeVisible();await d.locator('#recurrence').selectOption('anual');await expect(d.getByLabel('Mês',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await page.locator('[data-view="communication"]').click();const comm=page.locator('#communication');await expect(comm.getByRole('button',{name:'Abrir comunicado'})).toBeVisible();await expect(comm).not.toContainText('Conferir o saldo físico');await comm.getByRole('button',{name:'Abrir comunicado'}).click();await expect(comm).toContainText('Conferir o saldo físico');await comm.getByRole('button',{name:'Feito',exact:true}).click();await expect(comm.getByRole('button',{name:'Feito',exact:true})).toHaveCount(0);await expect(comm).toContainText('Visualizado:');expect(patches).toEqual(['seen','done']);expect(errors).toEqual([]);
});

test('Meu dia is personal even for admins, completes tasks, and Kanban labels do not overlap',async({page})=>{
 const user={id:2,name:'João',username:'joao',is_admin:true,can_create:true,can_edit:true,can_delete:true},errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value])),today=parts.year+'-'+parts.month+'-'+parts.day;
 const common={area:'Planejamento',assignee:'João',assignee_id:2,status:'todo',priority:'alta',progress:0,recurrence:'semanal',description:'Descrição de teste'};
 const tasks=[{...common,id:1,title:'Minha atividade hoje',due_date:today},{...common,id:2,title:'Minha pendência',due_date:'2020-01-01'},{...common,id:3,title:'Atividade de outra pessoa',assignee_id:3,assignee:'Ana',due_date:today}];
 const received=[{id:1,title:'Meu recado',kind:'recado',seen_at:null,done_at:null}];
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());let json=[];
 if(url.pathname==='/api/auth')json={user};else if(url.pathname==='/api/tasks'){if(url.searchParams.has('areas'))json=[{id:1,name:'Planejamento'}];else if(route.request().method()==='PATCH'){const p=route.request().postDataJSON(),t=tasks.find(t=>t.id===p.id);t.status=p.status;t.completed_at=new Date().toISOString();json=t}else json=tasks}
 else if(url.pathname==='/api/notifications')json={notifications:[]};else if(url.pathname==='/api/communication')json={received};else if(url.pathname==='/api/team')json=[user];
 await route.fulfill({json})});
 await page.goto(origin);const day=page.locator('#myday');
 await expect(day).toBeVisible();await expect(day).toContainText('Minha atividade hoje');await expect(day).toContainText('Minha pendência');await expect(day).toContainText('Meu recado');await expect(day).not.toContainText('Atividade de outra pessoa');
 await day.locator('.day-task').filter({hasText:'Minha atividade hoje'}).getByRole('button',{name:'Concluir',exact:true}).click();
 await expect(day.locator('.day-task').filter({hasText:'Minha atividade hoje'})).toContainText('Concluída às');
 await page.locator('[data-view="kanban"]').click();const card=page.locator('[data-task-id="2"]');
 await expect(card.locator('.tk-overdue')).toBeVisible();await expect(card.locator('.tk-recurrence')).toBeVisible();
 const bounds=await card.evaluate(el=>{const a=el.querySelector('.meta').getBoundingClientRect(),b=el.querySelector('.tk-badges').getBoundingClientRect(),c=el.querySelector('select').getBoundingClientRect();return {meta:a.bottom,badges:b.top,bottom:b.bottom,select:c.top}});
 expect(bounds.badges).toBeGreaterThanOrEqual(bounds.meta);expect(bounds.select).toBeGreaterThanOrEqual(bounds.bottom);
 await page.setViewportSize({width:390,height:844});await expect(card.locator('.tk-overdue')).toBeVisible();
 expect(errors).toEqual([]);
});
test('administrative board menu edits, archives, restores and requires typed deletion',async({page})=>{
 const user={id:1,name:'Admin',is_admin:true,can_create:true,can_edit:true,can_delete:true};
 const board={id:1,workspace_id:1,name:'Quadro teste',description:''};let archived=false,deleted=false;
 const requests=[];
 await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;let json=[];
 if(p==='/api/auth')json={user};else if(p==='/api/notifications')json={notifications:[]};else if(p==='/api/communication')json={received:[]};
 else if(p==='/api/workspaces'){if(route.request().method()==='GET')json={workspaces:[{id:1,name:'Equipe'}],boards:archived||deleted?[]:[board],archivedBoards:archived&&!deleted?[board]:[],fields:[],groups:[],items:[],permissions:{1:'manager'},forms:[]};
 else {const d=route.request().postDataJSON();requests.push(d);if(d.mode==='archive')archived=true;else if(d.mode==='restore')archived=false;else if(route.request().method()==='DELETE')deleted=true;else Object.assign(board,{name:d.name,description:d.description});json={ok:true}}}
 await route.fulfill({json})});
 page.on('dialog',d=>d.accept());await page.goto(origin);await page.locator('[data-view="workspaces"]').click();const host=page.locator('#workspaces');
 await host.getByRole('button',{name:'Editar quadro',exact:true}).last().click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Nome do quadro').fill('Novo quadro');await dialog.getByLabel('Descrição').fill('Descrição nova');await dialog.getByRole('button',{name:'Salvar quadro'}).click();
 await expect(host.getByRole('heading',{name:'Novo quadro',exact:true})).toBeVisible();
 await host.getByLabel('Ações do quadro Novo quadro').click();await host.getByRole('button',{name:'Arquivar quadro',exact:true}).click();await expect(host.getByRole('heading',{name:'Quadros arquivados'})).toBeVisible();
 await host.getByLabel('Ações do quadro Novo quadro').click();await host.getByRole('button',{name:'Restaurar quadro'}).click();await expect(host.getByRole('heading',{name:'Novo quadro',exact:true})).toBeVisible();
 await host.getByLabel('Ações do quadro Novo quadro').click();await host.getByRole('button',{name:'Arquivar quadro',exact:true}).click();await expect(host.getByRole('heading',{name:'Quadros arquivados'})).toBeVisible();
 await host.getByLabel('Ações do quadro Novo quadro').click();await host.getByRole('button',{name:'Excluir quadro',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Excluir definitivamente'})).toBeDisabled();await dialog.getByLabel('Digite o nome exato do quadro').fill('Novo quadro');await dialog.getByRole('button',{name:'Excluir definitivamente'}).click();
 await expect(host.getByRole('heading',{name:'Quadros arquivados'})).toHaveCount(0);expect(requests.at(-1).confirmation).toBe('Novo quadro');
});
