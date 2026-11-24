const { neon } = require('@neondatabase/serverless');
const seed = [
  ['Validar rota de entrega', 'Confirmar logística e janela de recebimento.', 'Logística · Adubo', 'Colaborador 1', '2026-11-24', 'alta', 'semanal', 'todo', 0],
  ['Atualizar planilha de compras', 'Lançar as cotações recebidas pela manhã.', 'Administrativo', 'Colaborador 2', '2026-11-24', 'normal', 'diária', 'todo', 0],
  ['Inspeção do estoque de defensivos', 'Registrar saldo físico e divergências.', 'Logística · Defensivo', 'Colaborador 3', '2026-11-25', 'média', 'semanal', 'andamento', 45],
  ['Preparar cronograma de safra', 'Revisar dependências do planejamento.', 'Planejamento', 'Colaborador 4', '2026-11-28', 'normal', 'mensal', 'andamento', 60],
  ['Conferir notas fiscais', 'Documentos de entrada da semana.', 'Administrativo', 'Colaborador 2', '2026-11-22', 'alta', 'não se repete', 'revisão', 85],
  ['Inventário semanal', 'Rotina recorrente registrada.', 'Logística · Adubo', 'Colaborador 1', '2026-11-21', 'normal', 'semanal', 'concluída', 100]
];
async function bootstrap(sql) {
  await sql`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', area TEXT NOT NULL,
    assignee TEXT NOT NULL, due_date DATE, priority TEXT NOT NULL DEFAULT 'normal',
    recurrence TEXT NOT NULL DEFAULT 'não se repete', status TEXT NOT NULL DEFAULT 'todo',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const existing = await sql.query('SELECT count(*)::int AS total FROM tasks');
  if (existing[0].total === 0) for (const t of seed)
    await sql.query('INSERT INTO tasks (title,description,area,assignee,due_date,priority,recurrence,status,progress) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', t);
}
module.exports = async (req, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL); await bootstrap(sql);
    if (req.method === 'GET') return res.status(200).json(await sql.query('SELECT * FROM tasks ORDER BY due_date ASC NULLS LAST,id DESC'));
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (req.method === 'POST') {
      const {title,description='',area,assignee,due_date,priority='normal',recurrence='não se repete'} = body;
      if (!title || !area || !assignee || !due_date) return res.status(400).json({error:'Título, área, responsável e prazo são obrigatórios.'});
      const rows = await sql.query('INSERT INTO tasks (title,description,area,assignee,due_date,priority,recurrence) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',[title,description,area,assignee,due_date,priority,recurrence]);
      return res.status(201).json(rows[0]);
    }
    if (req.method === 'PATCH') {
      const {id,status,progress} = body; if (!id) return res.status(400).json({error:'Atividade inválida.'});
      const p = status === 'concluída' ? 100 : Math.max(0,Math.min(100,Number(progress ?? 0)));
      const rows = await sql.query('UPDATE tasks SET status=COALESCE($1,status),progress=$2 WHERE id=$3 RETURNING *',[status,p,id]);
      return res.status(200).json(rows[0]);
    }
    res.setHeader('Allow','GET, POST, PATCH'); return res.status(405).end();
  } catch (error) { console.error(error); return res.status(500).json({error:'Não foi possível acessar as atividades.'}); }
};
