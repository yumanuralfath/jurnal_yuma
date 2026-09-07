import { env } from '$env/dynamic/private';
import { dailyGithubPath } from '../dateUtils';
import { dateFromGithubPath } from './markdown';

const API = 'https://api.github.com';

function headers() {
	return {
		Authorization: `Bearer ${env.GITHUB_TOKEN}`,
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};
}

function repoBase() {
	return `${API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
}

function encodeRepoPath(path: string) {
	return path
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

/** GITHUB_NOTES_DIR diarahkan ke "Yuma Note/Daily" */
export function pathForDate(date: string) {
	return dailyGithubPath(date, env.GITHUB_NOTES_DIR ?? 'Yuma Note/Daily');
}

export async function getFile(path: string) {
	const url = `${repoBase()}/contents/${encodeRepoPath(path)}?ref=${env.GITHUB_BRANCH ?? 'main'}`;
	const res = await fetch(url, { headers: headers() });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`GitHub getFile gagal: ${res.status} ${await res.text()}`);
	const data = await res.json();
	const content = Buffer.from(data.content, 'base64').toString('utf-8');
	return { content, sha: data.sha as string, path: data.path as string };
}

export async function putFile(path: string, content: string, message: string, sha?: string | null) {
	const url = `${repoBase()}/contents/${encodeRepoPath(path)}`;
	const res = await fetch(url, {
		method: 'PUT',
		headers: { ...headers(), 'Content-Type': 'application/json' },
		body: JSON.stringify({
			message,
			content: Buffer.from(content, 'utf-8').toString('base64'),
			sha: sha ?? undefined,
			branch: env.GITHUB_BRANCH ?? 'main'
		})
	});
	if (res.status === 409) {
		throw new Error('CONFLICT: file di GitHub sudah berubah. Lihat versi GitHub dulu, lalu push ulang.');
	}
	if (!res.ok) throw new Error(`GitHub putFile gagal: ${res.status} ${await res.text()}`);
	const data = await res.json();
	return { sha: data.content.sha as string };
}

export async function deleteFile(path: string, sha: string, message: string) {
	const url = `${repoBase()}/contents/${encodeRepoPath(path)}`;
	const res = await fetch(url, {
		method: 'DELETE',
		headers: { ...headers(), 'Content-Type': 'application/json' },
		body: JSON.stringify({ message, sha, branch: env.GITHUB_BRANCH ?? 'main' })
	});
	if (!res.ok) throw new Error(`GitHub deleteFile gagal: ${res.status} ${await res.text()}`);
}

export type RemoteNoteMeta = {
	date: string;
	path: string;
	sha: string;
};

/** List semua daily note di GitHub (read-only, tidak menyentuh DB). */
export async function listRemoteNotes(): Promise<RemoteNoteMeta[]> {
	const dir = (env.GITHUB_NOTES_DIR ?? 'Yuma Note/Daily').replace(/\/$/, '');
	const url = `${repoBase()}/git/trees/${env.GITHUB_BRANCH ?? 'main'}?recursive=1`;
	const res = await fetch(url, { headers: headers() });
	if (!res.ok) throw new Error(`GitHub listNoteFiles gagal: ${res.status} ${await res.text()}`);
	const data = await res.json();

	const notes: RemoteNoteMeta[] = [];
	for (const item of data.tree as Array<{ path: string; sha: string; type: string }>) {
		if (item.type !== 'blob' || !item.path.endsWith('.md')) continue;
		if (dir && !item.path.startsWith(dir + '/')) continue;
		const date = dateFromGithubPath(item.path);
		if (!date) continue;
		notes.push({ date, path: item.path, sha: item.sha });
	}

	notes.sort((a, b) => b.date.localeCompare(a.date));
	return notes;
}

/** @deprecated pakai listRemoteNotes */
export async function listNoteFiles() {
	return listRemoteNotes();
}
