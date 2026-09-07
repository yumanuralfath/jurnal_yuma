// Semua util di sini bekerja dengan komponen tanggal LOKAL (bukan UTC) supaya
// tidak geser sehari akibat timezone, karena kita hanya peduli Y-M-D.

export function dateFromISO(iso: string) {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function isoFromDate(date: Date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function addDays(iso: string, delta: number) {
	const d = dateFromISO(iso);
	d.setDate(d.getDate() + delta);
	return isoFromDate(d);
}

export function dayOfYear(date: Date) {
	const start = new Date(date.getFullYear(), 0, 1);
	return Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;
}

export function isoWeekNumber(date: Date) {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = (d.getUTCDay() + 6) % 7; // Senin=0 ... Minggu=6
	d.setUTCDate(d.getUTCDate() - dayNum + 3); // geser ke Kamis terdekat
	const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
	const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
	firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
	return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

export function monthNameFull(date: Date) {
	return date.toLocaleDateString('en-US', { month: 'long' });
}

export function dayNameFull(date: Date) {
	return date.toLocaleDateString('en-US', { weekday: 'long' });
}

// "04.09.26.247" — DD.MM.YY.hari-ke-berapa-dalam-tahun (tanpa padding di angka terakhir)
export function dailyFilenameStem(iso: string) {
	const date = dateFromISO(iso);
	const dd = String(date.getDate()).padStart(2, '0');
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const yy = String(date.getFullYear()).slice(-2);
	return `${dd}.${mm}.${yy}.${dayOfYear(date)}`;
}

// "Yuma Note/Daily/2026/September/04.09.26.247.md"
export function dailyGithubPath(iso: string, baseDir: string) {
	const date = dateFromISO(iso);
	const base = baseDir.replace(/\/$/, '');
	return `${base}/${date.getFullYear()}/${monthNameFull(date)}/${dailyFilenameStem(iso)}.md`;
}

// "Friday, 04 Sep 2026"
export function humanDateLabel(iso: string) {
	const date = dateFromISO(iso);
	return date.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

// "17:46" waktu lokal saat ini
export function nowTimeLabel() {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "2026-09-04T17:46" untuk field `updated` di frontmatter
export function nowLocalIsoMinute() {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
