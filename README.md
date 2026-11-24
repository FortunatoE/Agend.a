# Agend.a

Plataforma interna para distribuir e acompanhar atividades de equipe.

## Recursos

- Visão geral por área
- Kanban persistente
- Calendário de prazos
- Rotinas recorrentes
- Relatórios por área
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
