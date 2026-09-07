import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { listAllNoteDates } from '$lib/server/db';

export const load: PageServerLoad = async ({ url }) => {
	const dates = await listAllNoteDates('asc');
	if (dates.length === 0) {
		return { dates: [], empty: true as const };
	}

	const mode = url.searchParams.get('mode');
	if (mode === 'random') {
		const pick = dates[Math.floor(Math.random() * dates.length)];
		redirect(303, `/notebook/${pick}?mode=random`);
	}

	const latest = dates[dates.length - 1];
	redirect(303, `/notebook/${latest}`);
};
