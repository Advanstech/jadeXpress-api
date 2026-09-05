import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function mergeSuppliers() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get all suppliers matching "STEBED"
    const { rows: suppliers } = await client.query(
      `SELECT id, name, created_at FROM supplier WHERE name ILIKE '%STEBED%' ORDER BY created_at ASC`
    );

    if (suppliers.length < 2) {
      console.log('No duplicates found.');
      return;
    }

    const primarySupplier = suppliers[0];
    const duplicateIds = suppliers.slice(1).map(s => s.id);
    console.log(`Primary Supplier: ${primarySupplier.id} - ${primarySupplier.name}`);
    console.log(`Duplicates to merge: ${duplicateIds.join(', ')}`);

    const idsParams = duplicateIds.map((_, i) => `$${i + 2}`).join(',');
    const args = [primarySupplier.id, ...duplicateIds];

    // 2. Update relations
    await client.query(`UPDATE purchase SET supplier_id = $1 WHERE supplier_id IN (${idsParams})`, args).catch(e => console.log('purchase err', e.message));
    await client.query(`UPDATE invoice SET supplier_id = $1 WHERE supplier_id IN (${idsParams})`, args).catch(e => console.log('invoice err', e.message));
    await client.query(`UPDATE _store_suppliers SET supplier_id = $1 WHERE supplier_id IN (${idsParams})`, args).catch(e => console.log('_store_suppliers err', e.message));
    await client.query(`UPDATE stock_batch SET supplier_id = $1 WHERE supplier_id IN (${idsParams})`, args).catch(e => console.log('stock_batch err', e.message));
    await client.query(`UPDATE product SET primary_supplier_id = $1 WHERE primary_supplier_id IN (${idsParams})`, args).catch(e => console.log('product err', e.message));

    // 3. Delete the duplicates
    const dupArgs = [...duplicateIds];
    const dupParams = duplicateIds.map((_, i) => `$${i + 1}`).join(',');
    await client.query(`DELETE FROM supplier WHERE id IN (${dupParams})`, dupArgs);

    await client.query('COMMIT');
    console.log('Successfully merged suppliers!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error merging suppliers:', error);
  } finally {
    client.release();
    pool.end();
  }
}

mergeSuppliers();
