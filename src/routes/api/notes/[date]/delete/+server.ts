import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteNoteByDate, getNoteByDate } from '$lib/server/db';
import { deleteFile } from '$lib/server/github';

export const POST: RequestHandler = async ({ params }) => {
	const date = params.date!;
	const note = await getNoteByDate(date);
	if (note?.github_path && note.github_sha) {
		try {
			await deleteFile(note.github_path, note.github_sha, `chore: delete daily note ${date}`);
		} catch {
			// kalau gagal hapus di GitHub (misal sha sudah beda), tetap lanjut hapus di DB
		}
	}
	await deleteNoteByDate(date);
	return json({ ok: true });
};
