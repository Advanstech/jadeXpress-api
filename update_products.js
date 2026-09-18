const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_KnSeukC09rLO@ep-wispy-sunset-avsjdgd4-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });
async function main() {
  await client.connect();
  const res1 = await client.query("UPDATE product SET image_url = '/products/ogx-smoothing-coconut-coffee-scrub.png' WHERE id = '3fb7a5b1-f9a1-4cb0-be79-d79a4ce2eb71';");
  console.log("Updated OGX", res1.rowCount);
}
main().catch(console.error).finally(() => client.end());
