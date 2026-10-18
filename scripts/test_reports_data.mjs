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

async function testReports() {
  console.log('--- Testing Reports Endpoints & DB Data ---');
  
  // 1. Get staff profile for an active manager or owner
  const managers = await sql`
    SELECT id, first_name, last_name, email, role, store_id, is_active, pin_hash 
    FROM staff_profile 
    WHERE is_active = true AND role IN ('owner', 'manager', 'root', 'super_admin') 
    LIMIT 5
  `;
  console.log('Active Managers found:', managers.map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name}`, role: m.role, storeId: m.store_id, active: m.is_active })));

  // 2. Check sales count and stores
  const salesByStore = await sql`
    SELECT store_id, count(*)::int as count, sum(total_pesewas)::bigint as total_pesewas
    FROM sale
    GROUP BY store_id
  `;
  console.log('Sales by store in DB:', salesByStore);

  // 3. Check stores in DB
  const stores = await sql`SELECT id, name, code FROM store`;
  console.log('Stores in DB:', stores);

  import('node:crypto').then(async (crypto) => {
    function signJwt(payload, secret) {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
      return `${header}.${body}.${signature}`;
    }

    const token = signJwt({
      sub: managers[0].id,
      email: managers[0].email,
      role: managers[0].role,
      storeId: managers[0].store_id || stores[0].id
    }, process.env.JWT_SECRET);

    console.log('Generated token for role:', managers[0].role);

    const from = new Date(Date.now() - 30 * 86400000).toISOString();
    const to = new Date().toISOString();

    const endpoints = [
      `/reporting/summary?from=${from}&to=${to}`,
      `/reporting/by-day?from=${from}&to=${to}`,
      `/reporting/top-products?from=${from}&to=${to}&limit=10`,
      `/reporting/by-cashier?from=${from}&to=${to}`,
      `/reporting/by-category?from=${from}&to=${to}`,
      `/reporting/heatmap?from=${from}&to=${to}`,
      `/stock-intelligence/expiry-risk`,
      `/accounting/pl?from=${from}&to=${to}`,
      `/expenses/summary?from=${from}&to=${to}`,
      `/suppliers/purchase-orders/store?page=1&limit=100`,
      `/customers`,
      `/customers/lapsed?days=60`
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(`http://localhost:3001/api/v1${ep}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const payload = data?.data ?? data;
        console.log(`[${res.status}] GET ${ep} ->`, Array.isArray(payload) ? `Array length ${payload.length}` : typeof payload);
        if (res.status !== 200) {
          console.log(`   ERROR payload:`, data);
        } else if (ep.includes('summary')) {
          console.log(`   DATA:`, payload);
        }
      } catch (err) {
        console.error(`   EXCEPTION GET ${ep}:`, err.message);
      }
    }
  });
}

testReports().catch(console.error);
