import { createClient } from '@libsql/client';
import { env } from '$env/dynamic/private';
import type { PriorityItem } from '../types';

export const db = createClient({
	url: env.TURSO_DATABASE_URL!,
	authToken: env.TURSO_AUTH_TOKEN
});

export async function initSchema() {
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
}

export type DailyNoteRow = {
	date: string;
	day_name: string;
	weather: string;
	tags: string;
	priority_items: string;
	note_content: string;
	created_at: string;
	updated_at: string;
	github_path: string | null;
	github_sha: string | null;
	synced_at: string | null;
};

export function parseRow(row: DailyNoteRow) {
	return {
		...row,
		tags: JSON.parse(row.tags) as string[],
		priority_items: JSON.parse(row.priority_items) as PriorityItem[]
	};
}

export async function listRecentNotes(limit = 30) {
	const res = await db.execute({
		sql: 'SELECT * FROM daily_notes ORDER BY date DESC LIMIT ?',
		args: [limit]
	});
	return (res.rows as unknown as DailyNoteRow[]).map(parseRow);
}

export async function listAllNotes(order: 'asc' | 'desc' = 'asc') {
	const res = await db.execute({
		sql: `SELECT * FROM daily_notes ORDER BY date ${order === 'asc' ? 'ASC' : 'DESC'}`
	});
	return (res.rows as unknown as DailyNoteRow[]).map(parseRow);
}

export async function listAllNoteDates(order: 'asc' | 'desc' = 'asc') {
	const res = await db.execute({
		sql: `SELECT date FROM daily_notes ORDER BY date ${order === 'asc' ? 'ASC' : 'DESC'}`
	});
	return (res.rows as unknown as Array<{ date: string }>).map((r) => r.date);
}

export async function getNoteByDate(date: string) {
	const res = await db.execute({ sql: 'SELECT * FROM daily_notes WHERE date = ?', args: [date] });
	const row = res.rows[0] as unknown as DailyNoteRow | undefined;
	return row ? parseRow(row) : null;
}

export async function noteExists(date: string) {
	const res = await db.execute({
		sql: 'SELECT 1 AS ok FROM daily_notes WHERE date = ? LIMIT 1',
		args: [date]
	});
	return res.rows.length > 0;
}

export async function listNotesInMonth(year: number, month1to12: number) {
	const prefix = `${year}-${String(month1to12).padStart(2, '0')}`;
	const res = await db.execute({
		sql: 'SELECT * FROM daily_notes WHERE date LIKE ? ORDER BY date ASC',
		args: [`${prefix}%`]
	});
	return (res.rows as unknown as DailyNoteRow[]).map(parseRow);
}

export async function upsertDailyNote(
	note: {
		date: string;
		day_name: string;
		weather: string;
		tags: string[];
		priority_items: PriorityItem[];
		note_content: string;
		created_at: string;
		updated_at: string;
		github_path?: string | null;
		github_sha?: string | null;
	},
	opts: { fromGithub?: boolean } = {}
) {
	const syncedAt = opts.fromGithub ? new Date().toISOString() : null;

	await db.execute({
		sql: `
			INSERT INTO daily_notes
				(date, day_name, weather, tags, priority_items, note_content, created_at, updated_at, github_path, github_sha, synced_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(date) DO UPDATE SET
				day_name = excluded.day_name,
				weather = excluded.weather,
				tags = excluded.tags,
				priority_items = excluded.priority_items,
				note_content = excluded.note_content,
				updated_at = excluded.updated_at,
				github_path = COALESCE(excluded.github_path, daily_notes.github_path),
				github_sha = COALESCE(excluded.github_sha, daily_notes.github_sha),
				synced_at = CASE
					WHEN ? = 1 THEN excluded.synced_at
					ELSE NULL
				END
		`,
		args: [
			note.date,
			note.day_name,
			note.weather,
			JSON.stringify(note.tags),
			JSON.stringify(note.priority_items),
			note.note_content,
			note.created_at,
			note.updated_at,
			note.github_path ?? null,
			note.github_sha ?? null,
			syncedAt,
			opts.fromGithub ? 1 : 0
		]
	});
}

export async function setGithubSha(date: string, sha: string, githubPath: string) {
	await db.execute({
		sql: `UPDATE daily_notes SET github_sha = ?, github_path = ?, synced_at = ? WHERE date = ?`,
		args: [sha, githubPath, new Date().toISOString(), date]
	});
}

export async function deleteNoteByDate(date: string) {
	await db.execute({ sql: 'DELETE FROM daily_notes WHERE date = ?', args: [date] });
}
