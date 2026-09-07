import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

const SESSION_COOKIE = 'journal_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 hari

export async function verifyPassword(password: string) {
  if (!env.APP_PASSWORD_HASH) throw new Error('APP_PASSWORD_HASH belum di-set di .env');
  console.log('password:', password)
  console.log("hash:", env.APP_PASSWORD_HASH)
  return bcrypt.compare(password, env.APP_PASSWORD_HASH);
}

function sign(value: string) {
  return crypto.createHmac('sha256', env.SESSION_SECRET!).update(value).digest('hex');
}

export function createSessionToken() {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${expires}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null) {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  const valid =
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid) return false;
  return Number(payload) > Date.now();
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
