// Jalankan sekali: node scripts/init-db.js
// Pastikan .env sudah berisi TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN
import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
	url: process.env.TURSO_DATABASE_URL,
	authToken: process.env.TURSO_AUTH_TOKEN
});

await db.execute(`
	CREATE TABLE IF NOT EXISTS daily_notes (
		date TEXT PRIMARY KEY,
		day_name TEXT NOT NULL DEFAULT '',
		weather TEXT NOT NULL DEFAULT '',
		tags TEXT NOT NULL DEFAULT '["Daily"]',
		priority_items TEXT NOT NULL DEFAULT '[]',
		note_content TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		github_path TEXT,
		github_sha TEXT,
		synced_at TEXT
	)
`);

console.log('Schema daily_notes siap di Turso.');
process.exit(0);
