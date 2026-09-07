import type { PageServerLoad } from './$types';
import { listRecentNotes } from '$lib/server/db';
import { dateFromISO, isoFromDate, monthNameFull } from '$lib/dateUtils';
import { getSyncStatus } from '$lib/syncStatus';

export const load: PageServerLoad = async () => {
	const notes = await listRecentNotes(200);
	const grouped = new Map<string, typeof notes>();

	for (const note of notes) {
		const d = dateFromISO(note.date);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		const list = grouped.get(key) ?? [];
		list.push(note);
		grouped.set(key, list);
	}

	const sections = [...grouped.entries()].map(([key, items]) => {
		const d = dateFromISO(`${key}-01`);
		return {
			key,
			label: `${monthNameFull(d)} ${d.getFullYear()}`,
			notes: items.map((n) => ({
				...n,
				syncStatus: getSyncStatus(n)
			}))
		};
	});

	const counts = {
		total: notes.length,
		synced: notes.filter((n) => getSyncStatus(n) === 'synced').length,
		dirty: notes.filter((n) => getSyncStatus(n) === 'dirty').length,
		never: notes.filter((n) => getSyncStatus(n) === 'never').length
	};

	return { sections, counts, today: isoFromDate(new Date()) };
};
