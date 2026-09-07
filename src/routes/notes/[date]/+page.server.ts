import type { PageServerLoad } from './$types';
import { getNoteByDate, listAllNoteDates } from '$lib/server/db';
import { fetchWeatherString } from '$lib/server/weather';
import { addDays, dailyFilenameStem, dateFromISO, dayNameFull, isoFromDate, nowLocalIsoMinute } from '$lib/dateUtils';
import { getSyncStatus } from '$lib/syncStatus';

export const load: PageServerLoad = async ({ params }) => {
	const date = params.date;
	const today = isoFromDate(new Date());
	const isToday = date === today;
	const isPast = date < today;

	const prevDate = addDays(date, -1);
	const nextDate = addDays(date, 1);
	const defaultPrevStem = dailyFilenameStem(prevDate);
	const defaultNextStem = dailyFilenameStem(nextDate);

	const existing = await getNoteByDate(date);
	const allDates = await listAllNoteDates('asc');

	if (existing) {
		return {
			note: existing,
			isNew: false,
			isToday,
			isPast,
			prevDate,
			nextDate,
			defaultPrevStem,
			defaultNextStem,
			syncStatus: getSyncStatus(existing),
			hasPrevInDb: allDates.includes(prevDate),
			hasNextInDb: allDates.includes(nextDate)
		};
	}

	// Note baru -> auto-fetch cuaca jika hari ini, atau prefill kosong jika hari lampau
	let weather = '';
	if (isToday) {
		try {
			weather = await fetchWeatherString();
		} catch {
			weather = '';
		}
	}

	const d = dateFromISO(date);

	const note = {
		date,
		day_name: dayNameFull(d),
		weather,
		tags: ['Daily'],
		priority_items: [] as { text: string; done: boolean }[],
		note_content: '',
		created_at: isoFromDate(d),
		updated_at: nowLocalIsoMinute(),
		github_path: null,
		github_sha: null,
		synced_at: null
	};

	return {
		note,
		isNew: true,
		isToday,
		isPast,
		prevDate,
		nextDate,
		defaultPrevStem,
		defaultNextStem,
		syncStatus: getSyncStatus(note),
		hasPrevInDb: allDates.includes(prevDate),
		hasNextInDb: allDates.includes(nextDate)
	};
};
