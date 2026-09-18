import { Pool } from '@neondatabase/serverless';

async function restoreItems() {
  const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_KnSeukC09rLO@ep-wispy-sunset-avsjdgd4-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });
  const client = await pool.connect();
  
  try {
    const poId = '49b6c679-49ed-4388-863c-dfca4a439ac9';
    
    // Get products
    const p1 = 'c621b398-d488-403e-ba13-efe1b2574cd6'; // NeoCell
    const p2 = '8dc09c6b-8e7e-4249-a08c-4af63ff61b08'; // Olay
    const p3 = 'a1003803-c536-4396-9917-130a6d9e8493'; // Magnesium

    console.log("Inserting purchase items...");

    await client.query(`
      INSERT INTO purchase_item (purchase_order_id, product_id, quantity_ordered, quantity_received, unit_cost_pesewas, total_cost_pesewas)
      VALUES 
      ($1, $2, 50, 50, 30000, 1500000),
      ($1, $3, 50, 50, 30356, 1517800),
      ($1, $4, 40, 40, 37501, 1500040)
    `, [poId, p1, p2, p3]);

    console.log("Successfully restored invoice line items!");

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

restoreItems();
