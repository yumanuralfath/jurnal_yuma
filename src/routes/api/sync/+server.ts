import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { noteExists, upsertDailyNote } from '$lib/server/db';
import { getFile, listRemoteNotes } from '$lib/server/github';
import { parseDailyMarkdown } from '$lib/server/markdown';

/**
 * Sync aman GitHub → Turso:
 * - Import note yang BELUM ada di DB
 * - Note yang sudah ada (synced / dirty / draft) TIDAK ditimpa
 * - Edit lokal tetap dirty sampai Push
 */
export const POST: RequestHandler = async () => {
	try {
		const files = await listRemoteNotes();
		let imported = 0;
		let skippedExisting = 0;
		let skippedInvalid = 0;

		for (const file of files) {
			if (await noteExists(file.date)) {
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
					day_name: parsed.day_name ?? '',
					weather: parsed.weather ?? '',
					tags: parsed.tags ?? ['Daily'],
					priority_items: parsed.priority_items ?? [],
					note_content: parsed.note_content ?? '',
					created_at: parsed.created_at ?? file.date,
					updated_at: parsed.updated_at ?? new Date().toISOString(),
					github_path: file.path,
					github_sha: file.sha
				},
				{ fromGithub: true }
			);
			imported++;
		}

		return json({
			ok: true,
			imported,
			skippedExisting,
			skippedInvalid,
			total: files.length
		});
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Gagal sync' }, { status: 500 });
	}
};
