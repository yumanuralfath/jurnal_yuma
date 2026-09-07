import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteByDate, listNotesInMonth, setGithubSha } from '$lib/server/db';
import { getFile, pathForDate, putFile } from '$lib/server/github';
import { buildDailyMarkdown } from '$lib/server/markdown';
import { dateFromISO } from '$lib/dateUtils';

function monthlyAveragePct(notes: Awaited<ReturnType<typeof listNotesInMonth>>) {
	const withItems = notes.filter((n) => n.priority_items.length > 0);
	if (withItems.length === 0) return 0;
	const total = withItems.reduce((sum, n) => {
		const done = n.priority_items.filter((i) => i.done).length;
		return sum + (done / n.priority_items.length) * 100;
	}, 0);
	return total / withItems.length;
}

export const POST: RequestHandler = async ({ params, request }) => {
	const date = params.date!;
	const note = await getNoteByDate(date);
	if (!note) return json({ error: 'Note tidak ditemukan' }, { status: 404 });

	let prevStem: string | undefined;
	let nextStem: string | undefined;
	try {
		const body = await request.json().catch(() => ({}));
		if (body?.prevStem) prevStem = String(body.prevStem).trim();
		if (body?.nextStem) nextStem = String(body.nextStem).trim();
	} catch {
		// ignore
	}

	const path = pathForDate(date);
	const d = dateFromISO(date);
	const monthNotes = await listNotesInMonth(d.getFullYear(), d.getMonth() + 1);
	const monthlyAvgPct = monthlyAveragePct(monthNotes);

	const md = buildDailyMarkdown(note, { monthlyAvgPct, prevStem, nextStem });

	try {
		// cek sha terbaru di GitHub dulu untuk menghindari overwrite konflik
		const remote = await getFile(path);
		const shaToUse = remote?.sha ?? note.github_sha ?? undefined;

		const result = await putFile(path, md, `chore: update daily note ${date}`, shaToUse);
		await setGithubSha(date, result.sha, path);

		return json({ ok: true, path, sha: result.sha });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Gagal push ke GitHub';
		const status = message.startsWith('CONFLICT') ? 409 : 500;
		return json({ error: message }, { status });
	}
};
