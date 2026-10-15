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
  console.log('--- Restoring Legitimate Sale JX-20261015-79CC80BB8A ---');

  const saleId = '96e65c32-2f6b-4d79-9c47-a4d97aab72e6';
  const receiptNumber = 'JX-20261015-79CC80BB8A';
  const storeId = '6b876c00-664c-4472-bf3d-db7ec7f51d6c';
  const munzuratId = '3b1bea0f-28f4-4882-83e6-16c1c43eec5f';
  const munzuratShiftId = '3f64b48d-ee2d-4a2d-a693-a8806bed7852';
  const createdAt = '2026-10-15T14:53:15.183Z';
  const totalPesewas = 332500;

  // 1. Re-insert Sale
  const clientId = 'f891b920-8e11-4fa2-9599-4c125191de77';
  const [restoredSale] = await sql`
    INSERT INTO sale (
      id,
      client_id,
      receipt_number,
      store_id,
      cashier_id,
      customer_id,
      shift_id,
      status,
      payment_status,
      subtotal_pesewas,
      discount_amount_pesewas,
      vat_amount_pesewas,
      nhil_amount_pesewas,
      getfund_amount_pesewas,
      total_pesewas,
      tendered_pesewas,
      change_pesewas,
      tender_type,
      tender_breakdown,
      momo_reference,
      card_reference,
      loyalty_points_earned,
      loyalty_points_redeemed,
      loyalty_redeem_value_pesewas,
      receipt_printed,
      created_offline,
      synced_at,
      completed_at,
      created_at,
      updated_at
    ) VALUES (
      ${saleId},
      ${clientId},
      ${receiptNumber},
      ${storeId},
      ${munzuratId},
      NULL,
      NULL,
      'completed',
      'paid',
      ${totalPesewas},
      0,
      0,
      0,
      0,
      ${totalPesewas},
      ${totalPesewas},
      0,
      'card',
      '[]'::jsonb,
      NULL,
      NULL,
      0,
      0,
      0,
      FALSE,
      FALSE,
      ${createdAt},
      ${createdAt},
      ${createdAt},
      ${createdAt}
    )
    ON CONFLICT (id) DO UPDATE 
    SET status = 'completed', payment_status = 'paid'
    RETURNING id, receipt_number, total_pesewas, cashier_id, status
  `;
  console.log('Restored Sale:', restoredSale);

  // 2. Re-insert Sale Items
  const items = [
    {
      productId: '082ddd20-4505-4969-8bd1-620105ac1181',
      quantity: 30,
      unitPricePesewas: 2000,
      lineTotalPesewas: 60000,
      name: 'Liquid I.V Electrolyte Drink',
      costPrice: 1333,
      qtyBefore: 480,
      qtyAfter: 450
    },
    {
      productId: 'c7d0999a-fedf-470a-b1bb-d659509d9bf5',
      quantity: 1,
      unitPricePesewas: 65000,
      lineTotalPesewas: 65000,
      name: "MaryRuth's Liquid Morning Multivitamin Broad Spectrum Raspberry (650ml)",
      costPrice: 45000,
      qtyBefore: 8,
      qtyAfter: 7
    },
    {
      productId: '722712f7-21c0-4c0b-95cb-53220238ade6',
      quantity: 1,
      unitPricePesewas: 79000,
      lineTotalPesewas: 79000,
      name: 'Orgain Organic Protein + Superfoods (2.7lb)',
      costPrice: 50000,
      qtyBefore: 107,
      qtyAfter: 106
    },
    {
      productId: '203a1b0d-8d98-4e76-a275-5048a504d166',
      quantity: 1,
      unitPricePesewas: 58000,
      lineTotalPesewas: 58000,
      name: 'Lemme Debloat Daily Digestive Gummies (60 Gummies)',
      costPrice: 35000,
      qtyBefore: 9,
      qtyAfter: 8
    },
    {
      productId: 'a4c8508d-1f27-4312-9684-19379f49a712',
      quantity: 1,
      unitPricePesewas: 26000,
      lineTotalPesewas: 26000,
      name: "Palmer's Cocoa Butter Formula Tahitian Vanilla Moisture Drenching Body Oil (192 ml)",
      costPrice: 18500,
      qtyBefore: 24,
      qtyAfter: 23
    },
    {
      productId: '7a57fa5a-7b1a-416c-861f-0cab7dfe04fa',
      quantity: 1,
      unitPricePesewas: 12000,
      lineTotalPesewas: 12000,
      name: "21ST HERBAL SLIMMING TEA 24'S: TEABAG::",
      costPrice: 8400,
      qtyBefore: 21,
      qtyAfter: 20
    },
    {
      productId: 'aeab25cd-6e1a-4407-91a7-9d79c09cdf84',
      quantity: 1,
      unitPricePesewas: 4500,
      lineTotalPesewas: 4500,
      name: 'Dove Advanced Care Original 72h Anti-Perspirant (150ml)',
      costPrice: 3600,
      qtyBefore: 141,
      qtyAfter: 140
    },
    {
      productId: '68951d23-8d04-42bd-90af-13cdb4ca5fe0',
      quantity: 1,
      unitPricePesewas: 28000,
      lineTotalPesewas: 28000,
      name: 'Eos Cashmere Body Mist All',
      costPrice: 23000,
      qtyBefore: 6,
      qtyAfter: 5
    }
  ];

  for (const item of items) {
    await sql`
      INSERT INTO sale_item (
        sale_id,
        product_id,
        batch_id,
        quantity,
        unit_price_pesewas,
        discount_amount_pesewas,
        line_total_pesewas,
        product_name_snapshot,
        product_sku_snapshot,
        created_at
      ) VALUES (
        ${saleId},
        ${item.productId},
        NULL,
        ${item.quantity},
        ${item.unitPricePesewas},
        0,
        ${item.lineTotalPesewas},
        ${item.name},
        'N/A',
        ${createdAt}
      )
    `;

    // Decrement stock in stock_item to reflect customer purchase
    await sql`
      UPDATE stock_item
      SET quantity_on_hand = quantity_on_hand - ${item.quantity},
          last_movement_at = ${createdAt},
          updated_at = NOW()
      WHERE store_id = ${storeId} AND product_id = ${item.productId}
    `;

    // Re-insert stock movement
    await sql`
      INSERT INTO stock_movement (
        product_id,
        store_id,
        batch_id,
        type,
        quantity_change,
        quantity_before,
        quantity_after,
        cost_price_pesewas,
        reference_type,
        reference_id,
        performed_by_id,
        notes,
        created_at
      ) VALUES (
        ${item.productId},
        ${storeId},
        NULL,
        'sale_out',
        ${-item.quantity},
        ${item.qtyBefore},
        ${item.qtyAfter},
        ${item.costPrice},
        'sale',
        ${saleId},
        ${munzuratId},
        NULL,
        ${createdAt}
      )
    `;
    console.log(`Re-inserted item & updated inventory for: ${item.name} (-${item.quantity})`);
  }

  // 3. Re-insert Payment
  await sql`
    INSERT INTO payment (
      sale_id,
      store_id,
      method,
      amount_pesewas,
      reference,
      status,
      created_at
    ) VALUES (
      ${saleId},
      ${storeId},
      'card',
      ${totalPesewas},
      NULL,
      'paid',
      ${createdAt}
    )
  `;
  console.log('Payment record inserted');

  // 4. Re-insert Ledger Entry (Accounting / Revenue)
  await sql`
    INSERT INTO ledger_entry (
      id,
      store_id,
      entry_type,
      category,
      amount_pesewas,
      vat_amount_pesewas,
      nhil_amount_pesewas,
      getfund_amount_pesewas,
      description,
      reference_type,
      reference_id,
      performed_by_id,
      entry_date,
      created_at
    ) VALUES (
      '9f6de667-b918-41d3-913f-f0e4e907f67e',
      ${storeId},
      'credit',
      'revenue',
      ${totalPesewas},
      0,
      0,
      0,
      ${'Sale ' + receiptNumber},
      'sale',
      ${saleId},
      ${munzuratId},
      ${createdAt},
      ${createdAt}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  console.log('Ledger revenue entry restored');

  // 5. Re-insert Audit Log
  await sql`
    INSERT INTO audit_log (
      staff_id,
      store_id,
      action,
      entity_type,
      entity_id,
      new_data,
      created_at
    ) VALUES (
      ${munzuratId},
      ${storeId},
      'SALE_COMPLETED',
      'sale',
      ${saleId},
      ${JSON.stringify({ totalPesewas, receiptNumber })}::jsonb,
      ${createdAt}
    )
  `;
  console.log('Audit log entry created');

  // 6. Update Munzurat's Shift
  // Legitimate sales for Munzurat today: 1 sale (Card: 332,500 pesewas)
  // Expected cash: 0, counted: 0 -> variance 0
  // Expected momo: 0, confirmed: 0 -> variance 0
  const [updatedMunzuratShift] = await sql`
    UPDATE eod_shift 
    SET system_total = ${totalPesewas},
        system_sale_count = 1,
        system_cash_total = 0,
        system_momo_total = 0,
        system_card_total = ${totalPesewas},
        system_refund_total = 0,
        physical_cash_count = 0,
        momo_confirmed = 0,
        cash_variance = 0,
        momo_variance = 0,
        variance_notes = NULL,
        status = 'completed',
        closed_by_id = ${munzuratId},
        closed_at = ${createdAt},
        approved_by_id = ${'3e5a1fa7-8489-4364-a0aa-71bdb46cb759'},
        approved_at = NOW(),
        updated_at = NOW()
    WHERE store_id = ${storeId} 
      AND staff_id = ${munzuratId} 
      AND business_date = '2026-10-15'
    RETURNING id, staff_id, status, system_total, system_sale_count, system_card_total, cash_variance, momo_variance
  `;
  console.log("Munzurat's Shift Updated with Legitimate Sale:", updatedMunzuratShift);

  // 7. Update Store-level EOD Record
  // Total sales today: 4 (Hannah) + 1 (Munzurat) = 5 sales
  // Cash: 298,000 (Hannah)
  // Card: 332,500 (Munzurat)
  // Total: 630,500 pesewas (GH₵ 6,305.00)
  // Refund: 29,000 pesewas
  // Cash variance: 0 - (298000 - 29000) = -269,000 pesewas
  // MoMo variance: 0
  const [updatedEodRecord] = await sql`
    UPDATE eod_record 
    SET system_cash_total = 298000,
        system_momo_total = 0,
        system_card_total = ${totalPesewas},
        system_total = ${298000 + totalPesewas},
        system_sale_count = 5,
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

  console.log('\n=== Restoration Completed Successfully ===');
}

main().catch((err) => {
  console.error('Error during restoration:', err);
  process.exit(1);
});
