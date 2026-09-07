import type { PageServerLoad } from './$types';
import { listRemoteNotes } from '$lib/server/github';
import { listRecentNotes } from '$lib/server/db';
import { dateFromISO, monthNameFull } from '$lib/dateUtils';

export const load: PageServerLoad = async () => {
	const [remote, local] = await Promise.all([listRemoteNotes(), listRecentNotes(500)]);
	const localDates = new Set(local.map((n) => n.date));

	const grouped = new Map<
		string,
		Array<{ date: string; path: string; sha: string; inLocal: boolean }>
	>();

	for (const note of remote) {
		const d = dateFromISO(note.date);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		const list = grouped.get(key) ?? [];
		list.push({ ...note, inLocal: localDates.has(note.date) });
		grouped.set(key, list);
	}

	const sections = [...grouped.entries()].map(([key, notes]) => {
		const d = dateFromISO(`${key}-01`);
		return {
			key,
			label: `${monthNameFull(d)} ${d.getFullYear()}`,
			notes
		};
	});

	return {
		sections,
		total: remote.length,
		onlyRemote: remote.filter((n) => !localDates.has(n.date)).length
	};
};
