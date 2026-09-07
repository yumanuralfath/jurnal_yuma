import type { PageServerLoad } from './$types';
import { getNoteByDate } from '$lib/server/db';
import { fetchWeatherString } from '$lib/server/weather';
import { dateFromISO, dayNameFull, isoFromDate, nowLocalIsoMinute } from '$lib/dateUtils';
import { getSyncStatus } from '$lib/syncStatus';

export const load: PageServerLoad = async ({ params }) => {
	const date = params.date;
	const existing = await getNoteByDate(date);
	if (existing) {
		return { note: existing, isNew: false, syncStatus: getSyncStatus(existing) };
	}

	// Note baru -> auto-fetch cuaca sekarang & prefill field dasar
	const weather = await fetchWeatherString();
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
		syncStatus: getSyncStatus(note)
	};
};
