import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getNoteByDate, listAllNoteDates } from '$lib/server/db';
import { getSyncStatus } from '$lib/syncStatus';
import { dateFromISO, monthNameFull } from '$lib/dateUtils';

export const load: PageServerLoad = async ({ params, url, locals }) => {
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

	// Group dates by month (DESC)
	const monthMap = new Map<string, string[]>();
	for (const d of [...dates].reverse()) {
		const ym = d.slice(0, 7);
		const list = monthMap.get(ym) ?? [];
		list.push(d);
		monthMap.set(ym, list);
	}
	const availableMonths = [...monthMap.entries()].map(([ym, monthDates]) => {
		const dt = dateFromISO(`${ym}-01`);
		return {
			yearMonth: ym,
			label: `${monthNameFull(dt)} ${dt.getFullYear()}`,
			dates: monthDates
		};
	});

	return {
		note,
		syncStatus: getSyncStatus(note),
		dates,
		index: idx,
		total: dates.length,
		prevDate,
		nextDate,
		mode,
		authed: !!locals.authed,
		availableMonths
	};
};
