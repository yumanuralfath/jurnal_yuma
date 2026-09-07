import {
	addDays,
	dailyFilenameStem,
	dateFromISO,
	humanDateLabel,
	isoWeekNumber,
	monthNameFull
} from '../dateUtils';
import type { PriorityItem } from '../types';

export type { PriorityItem };

export type DailyNote = {
	date: string; // YYYY-MM-DD
	day_name: string;
	weather: string;
	tags: string[];
	priority_items: PriorityItem[];
	note_content: string;
	created_at: string; // YYYY-MM-DD (tanggal pembuatan pertama)
	updated_at: string; // "2026-09-04T17:46"
};

function completion(items: PriorityItem[]) {
	const total = items.length;
	const done = items.filter((i) => i.done).length;
	const pct = total === 0 ? 0 : (done / total) * 100;
	return { total, done, pct };
}

function progressBar(pct: number, slots = 10) {
	const filled = Math.round((pct / 100) * slots);
	return '█'.repeat(filled) + '░'.repeat(Math.max(0, slots - filled));
}

/**
 * Format mengikuti file di repo Obsidian-Note / Yuma Note/Daily:
 * frontmatter → Priority (opsional) → Note → footer navigasi → completion (hanya jika ada priority)
 */
export function buildDailyMarkdown(note: DailyNote, opts: { monthlyAvgPct?: number } = {}) {
	const prevIso = addDays(note.date, -1);
	const nextIso = addDays(note.date, 1);
	const date = dateFromISO(note.date);
	const week = isoWeekNumber(date);
	const { total, done, pct } = completion(note.priority_items);
	const hasPriority = note.priority_items.length > 0;

	const frontmatter = [
		'---',
		`created: ${note.created_at}`,
		`day: ${note.day_name}`,
		`weather: ${note.weather}`,
		'tags:',
		...note.tags.map((t) => `  - ${t}`),
		`updated: ${note.updated_at}`,
		'---'
	].join('\n');

	const priorityBlock = hasPriority
		? ['# ⚡ Priority', '', ...note.priority_items.map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}`), ''].join(
				'\n'
			)
		: '';

	const noteBlock = ['# 📝 Note', '', note.note_content.trim(), ''].join('\n');

	const timeLabel = note.updated_at.includes('T') ? (note.updated_at.split('T')[1] ?? '') : '';
	const footer = [
		'---',
		`⬅️ [[${dailyFilenameStem(prevIso)}]]  |  📅 ${humanDateLabel(note.date)}  |  [[${dailyFilenameStem(nextIso)}]] ➡️`,
		'',
		`*Dibuat: ${timeLabel} | Week ${String(week).padStart(2, '0')}*`,
		''
	].join('\n');

	const parts = [frontmatter, priorityBlock, noteBlock, footer];

	if (hasPriority) {
		parts.push(
			[
				'<!-- DAILY_COMPLETION_START -->',
				'### ✅ Daily Completion',
				`**${pct.toFixed(1)}%** (${done}/${total})`,
				'<!-- DAILY_COMPLETION_END -->'
			].join('\n')
		);

		if (opts.monthlyAvgPct !== undefined) {
			parts.push(
				[
					'<!-- MONTHLY_COMPLETION_START -->',
					`### 📊 Monthly Completion (${date.getFullYear()} ${monthNameFull(date)})`,
					`${progressBar(opts.monthlyAvgPct)} **${opts.monthlyAvgPct.toFixed(1)}%**`,
					'<!-- MONTHLY_COMPLETION_END -->',
					''
				].join('\n')
			);
		}
	}

	return parts.filter(Boolean).join('\n\n');
}

/** Parse best-effort isi file GitHub/Obsidian — hanya untuk tampilan / salin ke editor, bukan auto-write DB. */
export function parseDailyMarkdown(md: string): Partial<DailyNote> {
	const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	const fm = fmMatch?.[1] ?? '';

	const get = (key: string) => fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.trim();

	const tagsBlock = fm.match(/tags:\r?\n((?:\s+-\s.*\r?\n?)+)/);
	const tags = tagsBlock
		? tagsBlock[1]
				.split(/\r?\n/)
				.map((l) => l.replace(/^\s*-\s*/, '').trim())
				.filter(Boolean)
		: ['Daily'];

	const priorityMatch = md.match(/# ⚡ Priority\r?\n\r?\n([\s\S]*?)(?:\r?\n# |\r?\n---)/);
	const priority_items: PriorityItem[] = priorityMatch
		? priorityMatch[1]
				.split(/\r?\n/)
				.map((line) => line.match(/^- \[( |x|X)\]\s*(.*)$/))
				.filter((m): m is RegExpMatchArray => !!m)
				.map((m) => ({ done: m[1].toLowerCase() === 'x', text: m[2].trim() }))
		: [];

	const noteMatch = md.match(/# 📝 Note\r?\n\r?\n([\s\S]*?)(?:\r?\n\r?\n---|\r?\n---)/);
	const note_content = noteMatch?.[1]?.trim() ?? '';

	return {
		day_name: get('day'),
		weather: get('weather'),
		tags,
		priority_items,
		note_content,
		created_at: get('created'),
		updated_at: get('updated')
	};
}

/** "Yuma Note/Daily/2026/September/04.09.26.247.md" → "2026-09-04" */
export function dateFromGithubPath(path: string): string | null {
	const filename = path.split('/').pop() ?? '';
	const m = filename.match(/^(\d{2})\.(\d{2})\.(\d{2})\.\d+\.md$/);
	if (!m) return null;
	const [, dd, mm, yy] = m;
	return `20${yy}-${mm}-${dd}`;
}
