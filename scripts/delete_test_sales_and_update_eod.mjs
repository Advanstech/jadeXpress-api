import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('--- Starting test sales deletion & EOD/Accounting/Inventory update ---');

  const testSaleIds = [
    '648435fe-5399-4f4a-ae1f-cea92131f8af', // Hanson, JX-20261015-37169C5364 (1010.00 GHS, card)
    '543b7e5b-4d20-41f9-881c-684823167660', // Hanson, JX-20261015-8A0302ED81 (220.00 GHS, split)
    '0e7bd38b-323a-48ea-b350-5e55add7367d', // Munzurat, JX-20261015-EC9855338D (240.00 GHS, momo)
    '96e65c32-2f6b-4d79-9c47-a4d97aab72e6', // Munzurat, JX-20261015-79CC80BB8A (3325.00 GHS, card)
  ];

  const storeId = '6b876c00-664c-4472-bf3d-db7ec7f51d6c';
  const hansonId = 'a93fd673-069c-4097-a45c-03ce79f38525';
  const munzuratId = '3b1bea0f-28f4-4882-83e6-16c1c43eec5f';

  // 1. Verify existence of the sales
  const salesFound = await sql`
    SELECT id, receipt_number, total_pesewas, tender_type, cashier_id 
    FROM sale 
    WHERE id = ANY(${testSaleIds})
  `;
  console.log(`Found ${salesFound.length} test sales to delete:`);
  console.table(salesFound);

  if (salesFound.length === 0) {
    console.log('No test sales found. They might have already been deleted.');
    return;
  }

  // 2. Quantity adjustments to restore stock
  const stockRestorations = [
    { productId: '937e11b6-76ce-4dd8-b40b-997bde2c4053', qty: 2, name: "NOW EVENING PRIMROSE OIL 1000MG 90'S: SGLS" },
    { productId: '82d0b2f0-95c5-4433-a8ee-19fe93ccce96', qty: 1, name: 'Sulfur 8 Treatment Cream (200ml)' },
    { productId: 'b204cb32-f528-4696-a780-5d3d60069583', qty: 1, name: "21ST CRANBERRY PLUS PROBIOTIC 60'S: TAB" },
    { productId: '082ddd20-4505-4969-8bd1-620105ac1181', qty: 30, name: 'Liquid I.V Electrolyte Drink' },
    { productId: 'c7d0999a-fedf-470a-b1bb-d659509d9bf5', qty: 1, name: "MaryRuth's Liquid Morning Multivitamin Broad Spectrum Raspberry (650ml)" },
    { productId: '722712f7-21c0-4c0b-95cb-53220238ade6', qty: 1, name: 'Orgain Organic Protein + Superfoods (2.7lb)' },
    { productId: '203a1b0d-8d98-4e76-a275-5048a504d166', qty: 1, name: 'Lemme Debloat Daily Digestive Gummies (60 Gummies)' },
    { productId: 'a4c8508d-1f27-4312-9684-19379f49a712', qty: 1, name: "Palmer's Cocoa Butter Formula Tahitian Vanilla Moisture Drenching Body Oil (192 ml)" },
    { productId: '7a57fa5a-7b1a-416c-861f-0cab7dfe04fa', qty: 1, name: "21ST HERBAL SLIMMING TEA 24'S: TEABAG::" },
    { productId: 'aeab25cd-6e1a-4407-91a7-9d79c09cdf84', qty: 1, name: 'Dove Advanced Care Original 72h Anti-Perspirant (150ml)' },
    { productId: '68951d23-8d04-42bd-90af-13cdb4ca5fe0', qty: 1, name: 'Eos Cashmere Body Mist All' },
  ];

  console.log('\n--- Restoring Stock Levels ---');
  for (const item of stockRestorations) {
    const [updated] = await sql`
      UPDATE stock_item 
      SET quantity_on_hand = quantity_on_hand + ${item.qty},
          last_movement_at = NOW(),
          updated_at = NOW()
      WHERE store_id = ${storeId} AND product_id = ${item.productId}
      RETURNING id, product_id, quantity_on_hand
    `;
    console.log(`Restored ${item.name}: +${item.qty} => New Qty: ${updated.quantity_on_hand}`);
  }

  // 3. Remove dependent records
  console.log('\n--- Deleting Dependent Records ---');

  // 3a. Refund items & requests for Hanson's rejected test refund
  const refundReqs = await sql`
    SELECT id FROM refund_request WHERE sale_id = ANY(${testSaleIds})
  `;
  const refundIds = refundReqs.map(r => r.id);
  if (refundIds.length > 0) {
    const delRefundItems = await sql`DELETE FROM refund_item WHERE refund_request_id = ANY(${refundIds})`;
    console.log(`Deleted ${delRefundItems.length ?? 'all'} refund_item records for test refunds`);
    const delRefundReqs = await sql`DELETE FROM refund_request WHERE id = ANY(${refundIds})`;
    console.log(`Deleted ${delRefundReqs.length ?? 'all'} refund_request records`);
  }

  // 3b. Stock movements
  const delMovements = await sql`
    DELETE FROM stock_movement 
    WHERE reference_type = 'sale' AND reference_id = ANY(${testSaleIds})
  `;
  console.log(`Deleted stock_movement records for test sales`);

  // 3c. Ledger entries (Accounting / Financing revenue credits)
  const delLedgers = await sql`
    DELETE FROM ledger_entry 
    WHERE reference_type = 'sale' AND reference_id = ANY(${testSaleIds})
  `;
  console.log(`Deleted ledger_entry records for test sales`);

  // 3d. Audit logs
  await sql`
    DELETE FROM audit_log 
    WHERE entity_type = 'sale' AND entity_id = ANY(${testSaleIds})
  `;
  if (refundIds.length > 0) {
    await sql`
      DELETE FROM audit_log 
      WHERE entity_type = 'refund' AND entity_id = ANY(${refundIds})
    `;
  }
  console.log(`Deleted audit_log records for test sales & refunds`);

  // 3e. Payments
  await sql`
    DELETE FROM payment 
    WHERE sale_id = ANY(${testSaleIds})
  `;
  console.log(`Deleted payment records for test sales`);

  // 3f. Sale items
  await sql`
    DELETE FROM sale_item 
    WHERE sale_id = ANY(${testSaleIds})
  `;
  console.log(`Deleted sale_item records for test sales`);

  // 3g. Sales
  await sql`
    DELETE FROM sale 
    WHERE id = ANY(${testSaleIds})
  `;
  console.log(`Deleted sale records for the 4 test sales`);

  // 4. Update Munzurat's Shift
  console.log('\n--- Updating Munzurat Shift ---');
  const [updatedMunzuratShift] = await sql`
    UPDATE eod_shift 
    SET system_total = 0,
        system_sale_count = 0,
        system_cash_total = 0,
        system_momo_total = 0,
        system_card_total = 0,
        system_refund_total = 0,
        physical_cash_count = 0,
        momo_confirmed = 0,
        cash_variance = 0,
        momo_variance = 0,
        variance_notes = NULL,
        status = 'completed',
        updated_at = NOW()
    WHERE store_id = ${storeId} 
      AND staff_id = ${munzuratId} 
      AND business_date = '2026-10-15'
    RETURNING id, staff_id, status, system_total, system_sale_count, cash_variance, momo_variance
  `;
  console.log('Munzurat Shift Updated:', updatedMunzuratShift);

  // 5. Update Hanson's Shift
  console.log('\n--- Updating Hanson Shift ---');
  const [updatedHansonShift] = await sql`
    UPDATE eod_shift 
    SET system_total = 0,
        system_sale_count = 0,
        system_cash_total = 0,
        system_momo_total = 0,
        system_card_total = 0,
        system_refund_total = 0,
        physical_cash_count = 0,
        momo_confirmed = 0,
        cash_variance = 0,
        momo_variance = 0,
        variance_notes = NULL,
        status = 'completed',
        closed_by_id = ${hansonId},
        closed_at = NOW(),
        approved_by_id = ${hansonId},
        approved_at = NOW(),
        updated_at = NOW()
    WHERE store_id = ${storeId} 
      AND staff_id = ${hansonId} 
      AND business_date = '2026-10-15'
    RETURNING id, staff_id, status, system_total, system_sale_count, cash_variance, momo_variance
  `;
  console.log('Hanson Shift Updated:', updatedHansonShift);

  // 6. Update Store-level EOD Record for 2026-10-15
  console.log('\n--- Updating Store-level EOD Record ---');
  // Hannah's legitimate sales today sum to:
  // 27000 + 65000 + 77000 + 129000 = 298000 (all Cash)
  // Refund: 29000 (Cash)
  // Expected Cash = 298000 - 29000 = 269000
  // Physical count = 0
  // Cash variance = 0 - 269000 = -269000
  // MoMo total = 0, MoMo variance = 0
  // Card total = 0
  const [updatedEodRecord] = await sql`
    UPDATE eod_record 
    SET system_cash_total = 298000,
        system_momo_total = 0,
        system_card_total = 0,
        system_total = 298000,
        system_sale_count = 4,
        system_refund_total = 29000,
        system_expense_total = 0,
        cash_variance = -269000,
        momo_variance = 0,
        updated_at = NOW()
    WHERE store_id = ${storeId} 
      AND business_date = '2026-10-15'
    RETURNING id, business_date, status, system_total, system_sale_count, system_cash_total, 
              system_momo_total, system_card_total, cash_variance, momo_variance
  `;
  console.log('Store EOD Record Updated:', updatedEodRecord);

  console.log('\n=== Cleanup and Updates Completed Successfully ===');
}

main().catch((err) => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
