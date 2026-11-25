'use strict';
// Workspace restrictions are a gate; board restrictions can only narrow access.
// Global mutation flags remain a ceiling. Admins always retain access.
const levels={none:0,viewer:1,editor:2,manager:3};
function roleFor(user,workspace,board,workspaceGrant,boardGrant){
 if(!user||!workspace||!board||board.workspace_id!==workspace.id)return 'none';
 if(user.is_admin)return 'manager';
 const w=workspaceGrant|| (workspace.restricted?'none':'manager');
 const b=boardGrant|| (board.restricted?'none':'manager');
 const level=Math.min(levels[w]??0,levels[b]??0);
 return Object.keys(levels).find(k=>levels[k]===level)||'none';
}
function canBoard(user,role,action){
 if(!user||!levels[role])return false;
 if(user.is_admin)return true;
 if(action==='read'||action==='comment')return true;
 if(action==='create'||action==='edit')return levels[role]>=2&&Boolean(user['can_'+action]);
 if(action==='delete')return levels[role]>=3&&Boolean(user.can_delete);
 return false;
}
function redactRestrictedFields(fields,items,visibleIds){
 const blocked=new Set(fields.filter(f=>f.type==='relation'&&!visibleIds.has(f.config?.target_board_id)).map(f=>f.id));
 for(const f of fields)if(['lookup','rollup'].includes(f.type)&&blocked.has(f.config?.relation_field_id))blocked.add(f.id);
 return {fields:fields.map(f=>blocked.has(f.id)?{...f,config:{restricted:true}}:f),items:items.map(i=>{
 const values={...i.values};for(const f of fields)if(f.board_id===i.board_id&&blocked.has(f.id))delete values[f.id];
 return {...i,values};
 }),blocked};
}
module.exports={roleFor,canBoard,redactRestrictedFields};
