import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '$lib/server/auth';

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData();
    const password = String(form.get('password') ?? '');

    const ok = await verifyPassword(password);
    if (!ok) {
      return fail(401, { error: 'Password salah' });
    }

    cookies.set(SESSION_COOKIE_NAME, createSessionToken(), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: SESSION_MAX_AGE_SECONDS
    });

    const redirectTo = url.searchParams.get('redirectTo') || '/';
    throw redirect(303, redirectTo);
  }
};
