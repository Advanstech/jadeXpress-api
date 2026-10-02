import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_KnSeukC09rLO@ep-wispy-sunset-avsjdgd4-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require"
  });

  await client.connect();

  const ingredients = "Vitamin D3 (as Cholecalciferol) 125 mcg (5000 IU)\nVitamin K2 (as Menaquinone-7) 100 mcg\n\nOther Ingredients: Rice flour, cellulose capsule, magnesium stearate (vegetable source).";
  const usage = "Take one (1) capsule daily, preferably with a meal, or as directed by your healthcare provider. For best results, take with a meal containing healthy fats to enhance absorption.";

  const result = await client.query(`
    UPDATE "product"
    SET "ingredients" = $1, "usage_instructions" = $2
    WHERE "slug" = $3
  `, [ingredients, usage, '21st-vit-d3-k2-120-s-cap-2']);

  console.log('Updated rows:', result.rowCount);
  await client.end();
}

main().catch(console.error);
