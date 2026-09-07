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
export function buildDailyMarkdown(
	note: DailyNote,
	opts: { monthlyAvgPct?: number; prevStem?: string; nextStem?: string } = {}
) {
	const prevIso = addDays(note.date, -1);
	const nextIso = addDays(note.date, 1);
	const prevStem = opts.prevStem || dailyFilenameStem(prevIso);
	const nextStem = opts.nextStem || dailyFilenameStem(nextIso);
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
		`⬅️ [[${prevStem}]]  |  📅 ${humanDateLabel(note.date)}  |  [[${nextStem}]] ➡️`,
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

const MONTHS_MAP: Record<string, string> = {
	jan: '01',
	feb: '02',
	mar: '03',
	apr: '04',
	may: '05',
	jun: '06',
	jul: '07',
	aug: '08',
	sep: '09',
	oct: '10',
	nov: '11',
	dec: '12'
};

/** Parse best-effort isi file GitHub/Obsidian — toleran terhadap variasi baris baru, format judul, dan footer */
export function parseDailyMarkdown(md: string): Partial<DailyNote> {
	let body = md;
	let fm = '';
	const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (fmMatch) {
		fm = fmMatch[1];
		body = md.slice(fmMatch[0].length);
	}

	const get = (key: string) => fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.trim();

	const tagsBlock = fm.match(/tags:\r?\n((?:\s+-\s.*\r?\n?)+)/);
	const tags = tagsBlock
		? tagsBlock[1]
				.split(/\r?\n/)
				.map((l) => l.replace(/^\s*-\s*/, '').trim())
				.filter(Boolean)
		: ['Daily'];

	// Potong footer (navigasi atau komentar completion)
	let contentWithoutFooter = body;
	const footerRegex =
		/(?:\r?\n---\r?\n(?:\s*⬅️|\s*\[\[|\s*📅|\*Dibuat:))|<!-- DAILY_COMPLETION_START -->|<!-- MONTHLY_COMPLETION_START -->/;
	const footerMatch = contentWithoutFooter.match(footerRegex);
	if (footerMatch && footerMatch.index !== undefined) {
		contentWithoutFooter = contentWithoutFooter.slice(0, footerMatch.index);
	}

	const extractPriorities = (text: string): PriorityItem[] =>
		text
			.split(/\r?\n/)
			.map((line) => line.match(/^- \[( |x|X)\]\s*(.*)$/))
			.filter((m): m is RegExpMatchArray => !!m)
			.map((m) => ({ done: m[1].toLowerCase() === 'x', text: m[2].trim() }));

	let priority_items: PriorityItem[] = [];
	let note_content = '';

	const priorityHeaderRegex = /(?:^|\r?\n)#{1,6}\s*(?:⚡\s*)?(?:Priority|Prioritas)[^\r\n]*/i;
	const pMatch = contentWithoutFooter.match(priorityHeaderRegex);

	const noteHeaderRegex = /(?:^|\r?\n)#{1,6}\s*(?:📝\s*)?(?:Note|Catatan)[^\r\n]*/i;
	const nMatch = contentWithoutFooter.match(noteHeaderRegex);

	if (pMatch && nMatch) {
		const pIdx = (pMatch.index ?? 0) + pMatch[0].length;
		const nIdx = nMatch.index ?? 0;
		if (pIdx <= nIdx) {
			const pText = contentWithoutFooter.slice(pIdx, nIdx);
			priority_items = extractPriorities(pText);
			note_content = contentWithoutFooter.slice(nIdx + nMatch[0].length).trim();
		} else {
			const nText = contentWithoutFooter.slice(nIdx + nMatch[0].length, pMatch.index);
			note_content = nText.trim();
			const pText = contentWithoutFooter.slice((pMatch.index ?? 0) + pMatch[0].length);
			priority_items = extractPriorities(pText);
		}
	} else if (pMatch) {
		const pIdx = (pMatch.index ?? 0) + pMatch[0].length;
		const pText = contentWithoutFooter.slice(pIdx);
		priority_items = extractPriorities(pText);
		const remaining = pText.replace(/^\s*- \[(?: |x|X)\][^\r\n]*/gm, '').trim();
		if (remaining) note_content = remaining;
	} else if (nMatch) {
		note_content = contentWithoutFooter.slice((nMatch.index ?? 0) + nMatch[0].length).trim();
	} else {
		note_content = contentWithoutFooter.trim();
	}

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

/**
 * Mendukung beberapa format path/filename Obsidian:
 * 1. "Yuma Note/Daily/2026/September/04.09.26.247.md" → "2026-09-04"
 * 2. "2026-09-04.md" → "2026-09-04"
 * 3. "Dec 10, 2025.md" → "2025-12-10"
 * 4. "Yuma Note/Daily/2025/October/18th - Obsidian.md" → "2025-10-18"
 */
export function dateFromGithubPath(path: string): string | null {
	const filename = path.split('/').pop() ?? '';
	// Format: DD.MM.YY.N.md
	const m1 = filename.match(/^(\d{2})\.(\d{2})\.(\d{2})\.\d+\.md$/);
	if (m1) {
		const [, dd, mm, yy] = m1;
		return `20${yy}-${mm}-${dd}`;
	}
	// Format: YYYY-MM-DD.md
	const m2 = filename.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/);
	if (m2) {
		return `${m2[1]}-${m2[2]}-${m2[3]}`;
	}
	// Format: Dec 10, 2025.md or Dec 9, 2025.md
	const m3 = filename.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),\s+(\d{4})\.md$/);
	if (m3) {
		const monKey = m3[1].slice(0, 3).toLowerCase();
		const mm = MONTHS_MAP[monKey];
		if (mm) {
			const dd = m3[2].padStart(2, '0');
			return `${m3[3]}-${mm}-${dd}`;
		}
	}
	// Format: path YYYY/Month/DDth ...
	const m4 = path.match(/(\d{4})\/([a-zA-Z]+)\/(\d{1,2})(?:st|nd|rd|th)?\b.*\.md$/);
	if (m4) {
		const year = m4[1];
		const monKey = m4[2].slice(0, 3).toLowerCase();
		const mm = MONTHS_MAP[monKey];
		if (mm) {
			const dd = m4[3].padStart(2, '0');
			return `${year}-${mm}-${dd}`;
		}
	}
	return null;
}
