import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchWeatherString } from '$lib/server/weather';

export const GET: RequestHandler = async () => {
	const weather = await fetchWeatherString();
	return json({ weather });
};
