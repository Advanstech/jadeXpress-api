const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_KnSeukC09rLO@ep-wispy-sunset-avsjdgd4-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });
async function main() {
  await client.connect();
  const res = await client.query("SELECT id, name FROM product WHERE name ILIKE '%Ogx Smoothing%';");
  console.log(res.rows[0].id);
}
main().catch(console.error).finally(() => client.end());
