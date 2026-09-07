import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, verifySessionToken } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login', '/notebook', '/public', '/buku', '/read'];

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	// Redirect alias publik ke /notebook
	if (pathname === '/public' || pathname === '/buku' || pathname === '/read') {
		throw redirect(303, '/notebook');
	}

	const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
	const token = event.cookies.get(SESSION_COOKIE_NAME);
	const authed = verifySessionToken(token);

	event.locals.authed = authed;

	if (!authed && !isPublic) {
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(pathname)}`);
	}
	if (authed && pathname === '/login') {
		throw redirect(303, '/');
	}

	return resolve(event);
};
