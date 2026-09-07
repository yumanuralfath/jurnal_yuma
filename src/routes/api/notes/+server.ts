import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { upsertDailyNote } from '$lib/server/db';
import { nowLocalIsoMinute } from '$lib/dateUtils';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { date, weather, note_content, priority_items, created_at, day_name, tags } = body;

	if (!date || typeof date !== 'string') {
		return json({ error: 'date wajib diisi (format YYYY-MM-DD)' }, { status: 400 });
	}

	await upsertDailyNote({
		date,
		day_name: day_name ?? '',
		weather: weather ?? '',
		tags: Array.isArray(tags) && tags.length > 0 ? tags : ['Daily'],
		priority_items: Array.isArray(priority_items) ? priority_items : [],
		note_content: note_content ?? '',
		created_at: created_at ?? date,
		updated_at: nowLocalIsoMinute()
	});

	return json({ ok: true });
};
