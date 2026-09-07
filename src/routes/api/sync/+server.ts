import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteByDate, upsertDailyNote } from '$lib/server/db';
import { getFile, listRemoteNotes } from '$lib/server/github';
import { parseDailyMarkdown } from '$lib/server/markdown';

/**
 * Sync aman GitHub → Turso:
 * - Import note yang BELUM ada di DB
 * - Otomatis perbaiki note yang di DB isinya KOSONG tapi di GitHub ada isinya
 * - Mendukung mode force sync (?force=1) jika ingin sinkronisasi ulang semua
 * - Note yang sudah ada dan punya isi lokal tidak ditimpa
 */
export const POST: RequestHandler = async ({ url, request }) => {
	try {
		let force = url.searchParams.get('force') === '1' || url.searchParams.get('force') === 'true';
		try {
			const body = await request.json().catch(() => ({}));
			if (body?.force) force = true;
		} catch {
			// ignore empty body
		}

		const files = await listRemoteNotes();
		let imported = 0;
		let repaired = 0;
		let skippedExisting = 0;
		let skippedInvalid = 0;

		for (const file of files) {
			const existing = await getNoteByDate(file.date);
			const hasEmptyContent = existing && (!existing.note_content || existing.note_content.trim() === '');

			if (existing && !force && !hasEmptyContent) {
				skippedExisting++;
				continue;
			}

			const remote = await getFile(file.path);
			if (!remote) {
				skippedInvalid++;
				continue;
			}

			const parsed = parseDailyMarkdown(remote.content);
			await upsertDailyNote(
				{
					date: file.date,
					day_name: parsed.day_name ?? existing?.day_name ?? '',
					weather: parsed.weather ?? existing?.weather ?? '',
					tags: parsed.tags ?? existing?.tags ?? ['Daily'],
					priority_items: parsed.priority_items ?? existing?.priority_items ?? [],
					note_content: parsed.note_content ?? '',
					created_at: parsed.created_at ?? existing?.created_at ?? file.date,
					updated_at: parsed.updated_at ?? existing?.updated_at ?? new Date().toISOString(),
					github_path: file.path,
					github_sha: file.sha
				},
				{ fromGithub: true }
			);

			if (existing) {
				repaired++;
			} else {
				imported++;
			}
		}

		return json({
			ok: true,
			imported,
			repaired,
			skippedExisting,
			skippedInvalid,
			total: files.length
		});
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Gagal sync' }, { status: 500 });
	}
};
