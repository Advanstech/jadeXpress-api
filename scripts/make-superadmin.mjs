import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  const targetEmail = 'hanson.pepra@gmail.com';
  console.log(`Checking account for: ${targetEmail}`);

  // 1. Check customer
  const customerRows = await sql`SELECT * FROM customer WHERE LOWER(email) = LOWER(${targetEmail}) LIMIT 1`;
  const customer = customerRows[0];
  console.log('Customer found:', customer ? { id: customer.id, name: `${customer.first_name} ${customer.last_name}`, email: customer.email } : 'None');

  // 2. Get default active store
  const storeRows = await sql`SELECT * FROM store WHERE status = 'active' LIMIT 1`;
  const store = storeRows[0] || (await sql`SELECT * FROM store LIMIT 1`)[0];
  console.log('Default Store:', store ? { id: store.id, name: store.name, code: store.code } : 'None');

  if (!store) {
    console.error('No active store found to assign staff profile');
    return;
  }

  // 3. Check existing staff profile
  const staffRows = await sql`SELECT * FROM staff_profile WHERE LOWER(email) = LOWER(${targetEmail}) LIMIT 1`;
  const existingStaff = staffRows[0];

  if (existingStaff) {
    console.log('Updating existing staff profile to role: owner');
    await sql`
      UPDATE staff_profile 
      SET role = 'owner',
          store_id = ${store.id},
          is_active = true,
          password_hash = COALESCE(${customer?.password_hash}, password_hash),
          updated_at = NOW()
      WHERE id = ${existingStaff.id}
    `;
    console.log('✅ Staff profile updated to Super Admin (owner)');
  } else {
    console.log('Creating new staff profile with role: owner');
    const pwdHash = customer?.password_hash || '$2b$12$eXamplePinHashForDefault1234567890123456789012';
    const newStaffRows = await sql`
      INSERT INTO staff_profile (
        store_id,
        first_name,
        last_name,
        email,
        phone,
        role,
        pin_hash,
        password_hash,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        ${store.id},
        ${customer?.first_name || 'Hanson'},
        ${customer?.last_name || 'Peprah'},
        ${targetEmail},
        ${customer?.phone || '+233200000000'},
        'owner',
        ${pwdHash},
        ${pwdHash},
        true,
        NOW(),
        NOW()
      ) RETURNING id, first_name, last_name, email, role
    `;
    console.log('✅ Staff profile created as Super Admin (owner):', newStaffRows[0]);
  }
}

run().catch(console.error);
