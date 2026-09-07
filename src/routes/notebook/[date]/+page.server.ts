import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getNoteByDate, listAllNoteDates } from '$lib/server/db';
import { getSyncStatus } from '$lib/syncStatus';

export const load: PageServerLoad = async ({ params, url }) => {
	const dates = await listAllNoteDates('asc');
	if (dates.length === 0) error(404, 'Belum ada catatan di database');

	const date = params.date;
	const idx = dates.indexOf(date);
	if (idx < 0) error(404, 'Catatan tidak ditemukan di database');

	const note = await getNoteByDate(date);
	if (!note) error(404, 'Catatan tidak ditemukan');

	const prevDate = idx > 0 ? dates[idx - 1] : null;
	const nextDate = idx < dates.length - 1 ? dates[idx + 1] : null;
	const mode = url.searchParams.get('mode') === 'random' ? 'random' : 'order';

	return {
		note,
		syncStatus: getSyncStatus(note),
		dates,
		index: idx,
		total: dates.length,
		prevDate,
		nextDate,
		mode
	};
};
