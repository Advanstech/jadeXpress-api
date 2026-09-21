import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows: cols } = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='audit_logs'`);
console.log('audit_logs cols:', cols.map(c=>c.column_name).join(','));
const { rows } = await client.query(
  `SELECT * FROM audit_logs WHERE created_at BETWEEN '2026-09-21T15:40:00Z' AND '2026-09-21T16:00:00Z' ORDER BY created_at LIMIT 30`);
console.log(JSON.stringify(rows, null, 1).slice(0, 4000));
await client.end();
