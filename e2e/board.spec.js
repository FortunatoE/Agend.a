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
