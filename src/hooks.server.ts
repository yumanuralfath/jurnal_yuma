import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, verifySessionToken } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));
	const token = event.cookies.get(SESSION_COOKIE_NAME);
	const authed = verifySessionToken(token);

	event.locals.authed = authed;

	if (!authed && !isPublic) {
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
	}
	if (authed && event.url.pathname === '/login') {
		throw redirect(303, '/');
	}

	return resolve(event);
};
