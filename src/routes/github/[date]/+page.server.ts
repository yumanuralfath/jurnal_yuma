import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getFile, pathForDate } from '$lib/server/github';
import { parseDailyMarkdown } from '$lib/server/markdown';
import { getNoteByDate } from '$lib/server/db';
import { getSyncStatus } from '$lib/syncStatus';

export const load: PageServerLoad = async ({ params }) => {
	const date = params.date;
	const path = pathForDate(date);
	const remote = await getFile(path);
	if (!remote) error(404, 'Note tidak ditemukan di GitHub');

	const parsed = parseDailyMarkdown(remote.content);
	const local = await getNoteByDate(date);

	return {
		date,
		path: remote.path,
		sha: remote.sha,
		raw: remote.content,
		parsed,
		localExists: !!local,
		localSyncStatus: local ? getSyncStatus(local) : null
	};
};
