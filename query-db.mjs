import { Pool } from '@neondatabase/serverless';

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_KnSeukC09rLO@ep-wispy-sunset-avsjdgd4-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });
  
  try {
    const suppliers = await pool.query('SELECT id, name FROM supplier;');
    console.log("Suppliers:");
    console.table(suppliers.rows);

    const products = await pool.query('SELECT count(*) FROM product;');
    console.log("Total Products:", products.rows[0].count);
    
    const jdzProducts = await pool.query(`SELECT count(*) FROM product p JOIN supplier s ON p.primary_supplier_id = s.id WHERE s.name = 'Jadexpress Dzorwulu';`);
    console.log("Products for Jadexpress Dzorwulu:", jdzProducts.rows[0].count);

  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

main();
