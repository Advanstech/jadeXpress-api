import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const poId = '41ba53d1-7575-498a-902f-34805c1e9add';
const { rows: prods } = await client.query(`
  SELECT p.id, p.name, p.status, p.created_at, p.updated_at, p.created_by_purchase_order_id,
         si.quantity_on_hand, si.updated_at AS si_updated, si.last_movement_at
  FROM purchase_item pi
  JOIN product p ON p.id = pi.product_id
  LEFT JOIN stock_item si ON si.product_id = p.id AND si.store_id = $2
  WHERE pi.purchase_order_id = $1
  ORDER BY si.updated_at LIMIT 8`, [poId, '6b876c00-664c-4472-bf3d-db7ec7f51d6c']);
console.log(JSON.stringify(prods, null, 1));
await client.end();
