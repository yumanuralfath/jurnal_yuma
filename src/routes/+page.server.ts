import type { PageServerLoad } from './$types';
import { getNotesCounts, listAvailableMonths, listMonthNotesSummary } from '$lib/server/db';
import { dateFromISO, isoFromDate, monthNameFull } from '$lib/dateUtils';
import { getSyncStatus } from '$lib/syncStatus';

export const load: PageServerLoad = async ({ url }) => {
	const today = isoFromDate(new Date());
	const currentMonth = today.slice(0, 7); // "YYYY-MM"

	const availableMonths = await listAvailableMonths();

	// Default ke bulan ini jika ada catatan atau belum ada pilihan, atau gunakan bulan yang diminta
	const requestedMonth = url.searchParams.get('month');
	let selectedMonth = requestedMonth || currentMonth;

	// Jika bulan yang diminta tidak ada dan tidak ada catatan bulan ini, pakai bulan terbaru yang tersedia
	if (!requestedMonth && !availableMonths.includes(selectedMonth) && availableMonths.length > 0) {
		selectedMonth = availableMonths[0];
	}

	const notesRaw = await listMonthNotesSummary(selectedMonth);
	const notes = notesRaw.map((n) => ({
		...n,
		syncStatus: getSyncStatus(n)
	}));

	const counts = await getNotesCounts();

	// Navigasi bulan (availableMonths diurutkan DESC: e.g. [2026-09, 2026-08, ...])
	const monthIdx = availableMonths.indexOf(selectedMonth);
	const prevMonth = monthIdx >= 0 && monthIdx < availableMonths.length - 1 ? availableMonths[monthIdx + 1] : null;
	const nextMonth = monthIdx > 0 ? availableMonths[monthIdx - 1] : null;

	const d = dateFromISO(`${selectedMonth}-01`);
	const monthLabel = `${monthNameFull(d)} ${d.getFullYear()}`;

	return {
		selectedMonth,
		monthLabel,
		isCurrentMonth: selectedMonth === currentMonth,
		notes,
		availableMonths,
		prevMonth,
		nextMonth,
		counts,
		today
	};
};
