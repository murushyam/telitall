import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/telitall';

async function runMigrations() {
  console.log('⚡ Starting database migrations against:', databaseUrl.split('@')[1] || databaseUrl);
  const sql = postgres(databaseUrl, { max: 1 });

  // Create migrations tracker table
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const applied = await sql`
      SELECT 1 FROM schema_migrations WHERE version = ${file}
    `;

    if (applied.length === 0) {
      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      await sql.unsafe(sqlContent);
      await sql`
        INSERT INTO schema_migrations (version) VALUES (${file})
      `;
      console.log(`✅ Applied ${file}`);
    } else {
      console.log(`⏩ Skipping ${file} (already applied)`);
    }
  }

  console.log('🎉 All migrations applied successfully!');
  await sql.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
