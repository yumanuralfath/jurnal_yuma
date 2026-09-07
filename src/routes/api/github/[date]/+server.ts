import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFile, pathForDate } from '$lib/server/github';
import { parseDailyMarkdown } from '$lib/server/markdown';

/** Read-only: ambil isi satu note dari GitHub. Tidak menulis ke DB. */
export const GET: RequestHandler = async ({ params }) => {
	const date = params.date!;
	try {
		const path = pathForDate(date);
		const remote = await getFile(path);
		if (!remote) {
			return json({ error: 'File tidak ada di GitHub', path }, { status: 404 });
		}
		const parsed = parseDailyMarkdown(remote.content);
		return json({
			ok: true,
			path: remote.path,
			sha: remote.sha,
			raw: remote.content,
			parsed
		});
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Gagal ambil dari GitHub' }, { status: 500 });
	}
};
