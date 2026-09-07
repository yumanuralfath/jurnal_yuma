import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listRemoteNotes } from '$lib/server/github';

/** Read-only: daftar file daily di GitHub. Tidak menulis ke DB. */
export const GET: RequestHandler = async () => {
	try {
		const notes = await listRemoteNotes();
		return json({ ok: true, notes, total: notes.length });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Gagal list GitHub' }, { status: 500 });
	}
};
