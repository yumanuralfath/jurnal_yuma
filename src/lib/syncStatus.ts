export type SyncStatus = 'never' | 'synced' | 'dirty';

export type SyncFields = {
	synced_at: string | null;
	github_sha: string | null;
};

/** Status sync lokal vs GitHub. */
export function getSyncStatus(note: SyncFields): SyncStatus {
	if (note.synced_at) return 'synced';
	if (note.github_sha) return 'dirty';
	return 'never';
}

export function syncStatusLabel(status: SyncStatus): string {
	switch (status) {
		case 'synced':
			return 'Sudah di GitHub';
		case 'dirty':
			return 'Ada perubahan lokal';
		case 'never':
			return 'Belum di-push';
	}
}

export function syncStatusShort(status: SyncStatus): string {
	switch (status) {
		case 'synced':
			return 'synced';
		case 'dirty':
			return 'belum push';
		case 'never':
			return 'draft';
	}
}
