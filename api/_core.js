const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const seed = [
  ['Validar rota de entrega','Confirmar logística e janela de recebimento.','Logística · Adubo','Colaborador 1','2026-11-24','alta','semanal','todo',0],
  ['Atualizar planilha de compras','Lançar as cotações recebidas pela manhã.','Administrativo','Colaborador 2','2026-11-24','normal','diária','todo',0],
  ['Inspeção do estoque de defensivos','Registrar saldo físico e divergências.','Logística · Defensivo','Colaborador 3','2026-11-25','média','semanal','andamento',45],
  ['Preparar cronograma de safra','Revisar dependências do planejamento.','Planejamento','Colaborador 4','2026-11-28','normal','mensal','andamento',60],
  ['Conferir notas fiscais','Documentos de entrada da semana.','Administrativo','Colaborador 2','2026-11-22','alta','não se repete','revisão',85],
  ['Inventário semanal','Rotina recorrente registrada.','Logística · Adubo','Colaborador 1','2026-11-21','normal','semanal','concluída',100]
];

const database = () => neon(process.env.DATABASE_URL);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function verifyPassword(password, user) {
  const candidate = crypto.scryptSync(password, user.password_salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(user.password_hash, 'hex'));
}
function body(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => { const i=v.indexOf('='); return [v.slice(0,i).trim(), decodeURIComponent(v.slice(i+1))]; })); }
function publicUser(user) {
  if (!user) return null;
  return { id:user.id, username:user.username, name:user.name, is_admin:user.is_admin, can_create:user.can_create, can_edit:user.can_edit, can_delete:user.can_delete };
}
function allowed(user, action) { return user?.is_admin || Boolean(user?.[`can_${action}`]); }

async function bootstrap(sql) {
  await sql`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', area TEXT NOT NULL,
    assignee TEXT NOT NULL, due_date DATE, priority TEXT NOT NULL DEFAULT 'normal',
    recurrence TEXT NOT NULL DEFAULT 'não se repete', status TEXT NOT NULL DEFAULT 'todo',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS generated_from INTEGER UNIQUE REFERENCES tasks(id) ON DELETE SET NULL`;
  await sql`CREATE TABLE IF NOT EXISTS app_users (
    id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE, can_create BOOLEAN NOT NULL DEFAULT TRUE,
    can_edit BOOLEAN NOT NULL DEFAULT TRUE, can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_sessions (
    token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS task_activity (
    id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL, detail TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL, message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS task_checklist (
    id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label TEXT NOT NULL, done BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS task_attachments (
    id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    filename TEXT NOT NULL, pathname TEXT NOT NULL, content_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const taskCount = await sql.query('SELECT count(*)::int AS total FROM tasks');
  if (!taskCount[0].total) for (const row of seed) await sql.query('INSERT INTO tasks (title,description,area,assignee,due_date,priority,recurrence,status,progress) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', row);
  const users = await sql.query('SELECT count(*)::int AS total FROM app_users');
  if (!users[0].total && process.env.ADMIN_INITIAL_PASSWORD) {
    const p = passwordHash(process.env.ADMIN_INITIAL_PASSWORD);
    await sql.query('INSERT INTO app_users (username,name,password_salt,password_hash,is_admin,can_create,can_edit,can_delete) VALUES ($1,$2,$3,$4,true,true,true,true)', ['emmanuel.fortunato','Emmanuel Fortunato',p.salt,p.hash]);
  }
}
async function session(req, sql = database()) {
  await bootstrap(sql); const token = cookies(req).agenda_session;
  if (!token) return { sql, user:null };
  const rows = await sql.query('SELECT u.* FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.active=true', [digest(token)]);
  return { sql, user:rows[0] || null };
}
async function activity(sql, taskId, userId, detail) {
  await sql.query('INSERT INTO task_activity (task_id,user_id,detail) VALUES ($1,$2,$3)', [taskId,userId,detail]);
}
function unauth(res) { return res.status(401).json({ error:'Faça login para continuar.' }); }
function forbidden(res) { return res.status(403).json({ error:'Seu perfil não tem esta permissão.' }); }
module.exports = { database, bootstrap, body, digest, passwordHash, verifyPassword, publicUser, session, allowed, activity, unauth, forbidden };
