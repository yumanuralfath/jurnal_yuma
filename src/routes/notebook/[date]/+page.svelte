<script lang="ts">
	import { goto } from '$app/navigation';
	import { humanDateLabel, isoFromDate } from '$lib/dateUtils';
	import { renderMarkdown } from '$lib/markdownRender';
	import { syncStatusLabel, type SyncStatus } from '$lib/syncStatus';
	import { Dialog } from 'bits-ui';

	let { data } = $props();

	let datePickerOpen = $state(false);
	let copied = $state(false);

	let viewYear = $state(2026);
	let viewMonth = $state(0); // 0-indexed (0 = Jan, 11 = Des)
	let lastNoteDate = $state('');

	$effect.pre(() => {
		if (data.note?.date && data.note.date !== lastNoteDate) {
			lastNoteDate = data.note.date;
			const [y, m] = data.note.date.split('-').map(Number);
			viewYear = y;
			viewMonth = m - 1;
		}
	});

	const MONTH_NAMES_ID = [
		'Januari',
		'Februari',
		'Maret',
		'April',
		'Mei',
		'Juni',
		'Juli',
		'Agustus',
		'September',
		'Oktober',
		'November',
		'Desember'
	];
	const DAY_NAMES_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

	const noteDatesSet = $derived(new Set(data.dates));
	const currentMonthPrefix = $derived(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`);
	const viewMonthLabel = $derived(`${MONTH_NAMES_ID[viewMonth]} ${viewYear}`);
	const notesInViewedMonth = $derived(
		data.dates.filter((d) => d.startsWith(currentMonthPrefix)).length
	);
	const todayIso = isoFromDate(new Date());

	type CalendarCell = {
		iso: string;
		dayNumber: number;
		isCurrentMonth: boolean;
		hasNote: boolean;
		isCurrentNote: boolean;
		isToday: boolean;
	};

	const calendarDays = $derived.by<CalendarCell[]>(() => {
		const days: CalendarCell[] = [];
		const firstDayDate = new Date(viewYear, viewMonth, 1);
		// Senin = 0 ... Minggu = 6
		const startDayOfWeek = (firstDayDate.getDay() + 6) % 7;

		const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
		const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
		const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;

		// Hari padding dari bulan sebelumnya
		for (let i = startDayOfWeek - 1; i >= 0; i--) {
			const dayNum = daysInPrevMonth - i;
			const iso = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
			days.push({
				iso,
				dayNumber: dayNum,
				isCurrentMonth: false,
				hasNote: noteDatesSet.has(iso),
				isCurrentNote: iso === data.note.date,
				isToday: iso === todayIso
			});
		}

		// Hari-hari pada bulan yang sedang dilihat
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
			const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
			days.push({
				iso,
				dayNumber: dayNum,
				isCurrentMonth: true,
				hasNote: noteDatesSet.has(iso),
				isCurrentNote: iso === data.note.date,
				isToday: iso === todayIso
			});
		}

		// Hari padding dari bulan berikutnya untuk melengkapi baris kalender
		const remaining = (7 - (days.length % 7)) % 7;
		const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
		const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;

		for (let dayNum = 1; dayNum <= remaining; dayNum++) {
			const iso = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
			days.push({
				iso,
				dayNumber: dayNum,
				isCurrentMonth: false,
				hasNote: noteDatesSet.has(iso),
				isCurrentNote: iso === data.note.date,
				isToday: iso === todayIso
			});
		}

		return days;
	});

	function prevMonth() {
		if (viewMonth === 0) {
			viewYear -= 1;
			viewMonth = 11;
		} else {
			viewMonth -= 1;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewYear += 1;
			viewMonth = 0;
		} else {
			viewMonth += 1;
		}
	}

	function goToCurrentNoteMonth() {
		const [y, m] = data.note.date.split('-').map(Number);
		viewYear = y;
		viewMonth = m - 1;
	}

	const dateLabel = $derived(humanDateLabel(data.note.date));
	const rendered = $derived(renderMarkdown(data.note.note_content));
	const progress = $derived(data.total === 0 ? 0 : ((data.index + 1) / data.total) * 100);
	const excerptWeather = $derived(data.note.weather || '—');

	function badgeClass(s: SyncStatus) {
		switch (s) {
			case 'synced':
				return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
			case 'dirty':
				return 'bg-amber-50 text-amber-900 ring-amber-200';
			case 'never':
				return 'bg-stone-100 text-stone-600 ring-stone-200';
		}
	}

	function goRandom() {
		const pool = data.dates.filter((d) => d !== data.note.date);
		const pick = (pool.length ? pool : data.dates)[
			Math.floor(Math.random() * (pool.length || data.dates.length))
		];
		goto(`/notebook/${pick}?mode=random`);
	}

	function goToDate(d: string) {
		datePickerOpen = false;
		goto(`/notebook/${d}`);
	}

	async function copyPublicLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => (copied = false), 2500);
		} catch {
			copied = false;
		}
	}

	function onKey(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowLeft' && data.prevDate) goto(`/notebook/${data.prevDate}`);
		if (e.key === 'ArrowRight' && data.nextDate) goto(`/notebook/${data.nextDate}`);
		if (e.key === 'r' || e.key === 'R') goRandom();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="mx-auto max-w-3xl px-4 py-6 pb-16 sm:px-6 sm:py-8">
	<!-- Top Navigation Bar -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			{#if data.authed}
				<a
					href="/"
					class="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-stone-50 active:scale-95"
				>
					&larr; <span class="hidden sm:inline">Beranda Admin</span><span class="sm:hidden"
						>Admin</span
					>
				</a>
			{:else}
				<div class="flex items-center gap-2">
					<span
						class="flex size-7 items-center justify-center rounded-lg bg-teal-800 text-white shadow-xs"
					>
						📖
					</span>
					<span class="text-sm font-bold text-stone-800">Buku Catatan Yuma</span>
					<span
						class="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 ring-1 ring-teal-200"
					>
						Publik
					</span>
				</div>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<!-- Dialog Pemilih Tanggal Catatan (Kalender) -->
			<Dialog.Root bind:open={datePickerOpen}>
				<Dialog.Trigger
					class="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-stone-50 active:scale-95"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="size-3.5 text-teal-800"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
						<line x1="16" x2="16" y1="2" y2="6" />
						<line x1="8" x2="8" y1="2" y2="6" />
						<line x1="3" x2="21" y1="10" y2="10" />
					</svg>
					<span>Kalender ({data.total})</span>
				</Dialog.Trigger>

				<Dialog.Portal>
					<Dialog.Overlay class="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-xs" />
					<Dialog.Content
						class="fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[min(95vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl outline-none sm:p-6"
					>
						<div class="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
							<div>
								<Dialog.Title class="flex items-center gap-2 text-base font-bold text-stone-900">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="size-4 text-teal-800"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
										<line x1="16" x2="16" y1="2" y2="6" />
										<line x1="8" x2="8" y1="2" y2="6" />
										<line x1="3" x2="21" y1="10" y2="10" />
									</svg>
									<span>Kalender Catatan</span>
								</Dialog.Title>
								<Dialog.Description class="mt-0.5 text-xs text-stone-500">
									Pilih tanggal untuk membaca catatan. Tanggal berikon menandakan ada catatan
									harian.
								</Dialog.Description>
							</div>
							<Dialog.Close
								class="rounded-lg p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
							>
								✕
							</Dialog.Close>
						</div>

						<!-- Quick Navigation Presets -->
						<div class="mt-3.5 flex flex-wrap items-center justify-between gap-1.5 text-xs">
							<div class="flex flex-wrap gap-1.5">
								<button
									type="button"
									onclick={() => goToDate(data.dates[data.dates.length - 1])}
									class="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
									title="Buka catatan paling baru"
								>
									Terbaru ({data.dates[data.dates.length - 1].slice(5)})
								</button>
								<button
									type="button"
									onclick={() => goToDate(data.dates[0])}
									class="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
									title="Buka catatan pertama"
								>
									Terlama ({data.dates[0].slice(5)})
								</button>
								<button
									type="button"
									onclick={goToCurrentNoteMonth}
									class="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 font-medium text-teal-800 transition hover:bg-teal-100 active:scale-95"
									title="Kembali ke bulan catatan saat ini"
								>
									Bulan Catatan
								</button>
							</div>
							<button
								type="button"
								onclick={() => {
									datePickerOpen = false;
									goRandom();
								}}
								class="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 font-medium text-stone-700 transition hover:bg-stone-100 active:scale-95"
								title="Buka catatan acak"
							>
								🎲 Acak
							</button>
						</div>

						<!-- Month Header Controls -->
						<div
							class="mt-4 flex items-center justify-between gap-2 rounded-xl border border-stone-200/80 bg-stone-50 p-2"
						>
							<button
								type="button"
								onclick={prevMonth}
								class="inline-flex size-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-2xs transition hover:bg-stone-100 active:scale-95"
								title="Bulan sebelumnya"
								aria-label="Bulan sebelumnya"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="size-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="15 18 9 12 15 6" />
								</svg>
							</button>

							<div class="flex items-center gap-1.5">
								<select
									aria-label="Pilih Bulan Catatan"
									value={currentMonthPrefix}
									onchange={(e) => {
										const [y, m] = e.currentTarget.value.split('-').map(Number);
										viewYear = y;
										viewMonth = m - 1;
									}}
									class="cursor-pointer rounded-lg border border-stone-300 bg-white py-1 pr-7 pl-2.5 text-xs font-bold text-stone-800 shadow-2xs focus:border-teal-600 focus:ring-1 focus:ring-teal-600 focus:outline-none sm:text-sm"
								>
									{#each data.availableMonths as m}
										{@const [mY, mM] = m.yearMonth.split('-').map(Number)}
										<option value={m.yearMonth}>
											{MONTH_NAMES_ID[mM - 1]}
											{mY} ({m.dates.length} catatan)
										</option>
									{/each}
									{#if !data.availableMonths.some((m) => m.yearMonth === currentMonthPrefix)}
										<option value={currentMonthPrefix} disabled selected>
											{viewMonthLabel} (0 catatan)
										</option>
									{/if}
								</select>
							</div>

							<button
								type="button"
								onclick={nextMonth}
								class="inline-flex size-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-2xs transition hover:bg-stone-100 active:scale-95"
								title="Bulan berikutnya"
								aria-label="Bulan berikutnya"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="size-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="9 18 15 12 9 6" />
								</svg>
							</button>
						</div>

						<!-- Monthly summary bar -->
						<div class="mt-2.5 flex items-center justify-between px-1 text-xs text-stone-500">
							<span class="font-medium text-stone-700">{viewMonthLabel}</span>
							<span
								class="text-[11px] {notesInViewedMonth > 0
									? 'font-semibold text-teal-800'
									: 'text-stone-400'}"
							>
								{notesInViewedMonth} catatan tersedia
							</span>
						</div>

						<!-- Day of week column headers -->
						<div
							class="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold tracking-wider text-stone-500 uppercase"
						>
							{#each DAY_NAMES_ID as dName}
								<div class="py-1">{dName}</div>
							{/each}
						</div>

						<!-- Calendar Grid -->
						<div class="mt-1 grid grid-cols-7 gap-1">
							{#each calendarDays as cell (cell.iso)}
								<button
									type="button"
									disabled={!cell.hasNote}
									onclick={() => goToDate(cell.iso)}
									title={cell.isCurrentNote
										? `Sedang dibuka: ${cell.iso}`
										: cell.hasNote
											? `Catatan ada: ${cell.iso} (klik untuk baca)`
											: `Tidak ada catatan (${cell.iso})`}
									aria-label={cell.isCurrentNote
										? `Sedang dibuka: tanggal ${cell.dayNumber}`
										: cell.hasNote
											? `Catatan tersedia tanggal ${cell.dayNumber}`
											: `Tidak ada catatan tanggal ${cell.dayNumber}`}
									class="relative flex min-h-12 flex-col items-center justify-between rounded-xl p-1 text-center transition sm:min-h-13 {cell.isCurrentNote
										? 'z-10 border-2 border-teal-700 bg-teal-800 font-bold text-white shadow-xs ring-2 ring-teal-600/30'
										: cell.hasNote
											? cell.isCurrentMonth
												? 'cursor-pointer border border-teal-200 bg-teal-50/80 font-semibold text-stone-800 hover:border-teal-400 hover:bg-teal-100 hover:shadow-2xs active:scale-95'
												: 'cursor-pointer border border-teal-100 bg-teal-50/30 text-stone-600 opacity-70 hover:bg-teal-50 active:scale-95'
											: cell.isCurrentMonth
												? 'cursor-not-allowed border border-stone-100 bg-stone-50/30 text-stone-400 opacity-40'
												: 'cursor-not-allowed border border-transparent bg-transparent text-stone-300 opacity-20'}"
								>
									<!-- Today indicator dot -->
									{#if cell.isToday}
										<span
											class="absolute top-1 right-1 size-1.5 rounded-full {cell.isCurrentNote
												? 'bg-amber-300'
												: 'bg-amber-500'}"
											title="Hari Ini"
										></span>
									{/if}

									<!-- Day Number -->
									<span
										class="text-xs leading-tight sm:text-sm {cell.isCurrentNote
											? 'font-bold'
											: cell.hasNote
												? 'font-semibold'
												: 'font-normal'}"
									>
										{cell.dayNumber}
									</span>

									<!-- Status Icon: Ada Catatan vs Tidak Ada Catatan -->
									<div class="my-0.5 flex items-center justify-center">
										{#if cell.hasNote}
											<!-- Icon Ada Catatan: Document with lines -->
											<span
												class="inline-flex size-4 items-center justify-center rounded-sm {cell.isCurrentNote
													? 'text-white'
													: 'text-teal-700'}"
												title="Ada catatan"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="size-3.5"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2.2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
													<polyline points="14 2 14 8 20 8" />
													<line x1="16" x2="8" y1="13" y2="13" />
													<line x1="16" x2="8" y1="17" y2="17" />
												</svg>
											</span>
										{:else}
											<!-- Icon Tidak Ada Catatan: Faint dash -->
											<span
												class="inline-flex size-4 items-center justify-center text-stone-300"
												title="Tidak ada catatan"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="size-3"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<line x1="5" y1="12" x2="19" y2="12" />
												</svg>
											</span>
										{/if}
									</div>
								</button>
							{/each}
						</div>

						<!-- Legend and Stats Footer -->
						<div
							class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs text-stone-500"
						>
							<div class="flex flex-wrap items-center gap-2.5 text-[11px]">
								<div class="flex items-center gap-1.5" title="Ada catatan yang dapat dibaca">
									<span
										class="flex size-4 items-center justify-center rounded-md border border-teal-200 bg-teal-50"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="size-2.5 text-teal-700"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
											<polyline points="14 2 14 8 20 8" />
											<line x1="16" x2="8" y1="13" y2="13" />
										</svg>
									</span>
									<span>Ada catatan</span>
								</div>
								<div class="flex items-center gap-1.5" title="Belum ada catatan pada tanggal ini">
									<span
										class="flex size-4 items-center justify-center rounded-md border border-stone-200 bg-stone-50"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="size-2.5 text-stone-400"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<line x1="5" y1="12" x2="19" y2="12" />
										</svg>
									</span>
									<span>Tidak ada</span>
								</div>
								<div class="flex items-center gap-1.5" title="Catatan yang saat ini sedang dibuka">
									<span
										class="flex size-4 items-center justify-center rounded-md border border-teal-700 bg-teal-800 text-[9px] font-bold text-white"
									>
										✓
									</span>
									<span>Sedang dibuka</span>
								</div>
							</div>

							<span class="text-[11px] font-medium text-stone-400">
								Total {data.total} catatan
							</span>
						</div>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>

			<button
				onclick={copyPublicLink}
				aria-label={copied ? 'Tautan tersalin' : 'Bagikan catatan'}
				title={copied ? 'Tautan tersalin!' : 'Salin tautan catatan ini'}
				class="group rounded-xl border border-stone-300 bg-white p-2 text-stone-600 shadow-xs transition hover:bg-stone-50 hover:text-stone-900 active:scale-95"
			>
				{#if copied}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="size-4 text-emerald-600"
					>
						<path d="m5 12 4 4L19 6" />
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="size-4 transition-transform duration-300 group-hover:-translate-y-0.5"
					>
						<circle cx="18" cy="5" r="3" />
						<circle cx="6" cy="12" r="3" />
						<circle cx="18" cy="19" r="3" />
						<path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
					</svg>
				{/if}
			</button>

			<button
				onclick={goRandom}
				aria-label="Acak"
				title="Acak"
				class="group rounded-xl border border-stone-300 bg-white p-2 text-stone-700 shadow-xs transition hover:bg-stone-50 active:scale-95 {data.mode ===
				'random'
					? 'border-stone-900 bg-stone-900 text-black'
					: ''}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="size-5 transition-transform duration-500 group-hover:rotate-180"
					aria-hidden="true"
				>
					<rect x="3" y="3" width="18" height="18" rx="4" />
					<circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
					<circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
					<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
					<circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
					<circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Shell Buku Catatan -->
	<div
		class="notebook-shell relative overflow-hidden rounded-2xl border border-stone-300/80 bg-[#f7f3ea] shadow-[0_20px_50px_-28px_rgb(28_25_23/0.45)]"
	>
		<div
			class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-stone-400/25 to-transparent"
			aria-hidden="true"
		></div>
		<div
			class="absolute top-0 right-0 left-8 h-1.5 bg-[repeating-linear-gradient(90deg,#d6d3d1_0_8px,transparent_8px_16px)] opacity-50"
		></div>

		<div class="space-y-6 px-6 py-8 sm:px-10 sm:py-10">
			<!-- Header Catatan -->
			<header class="space-y-3 border-b border-stone-300/70 pb-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p
							class="font-[Georgia,Times,serif] text-xs tracking-[0.18em] text-stone-500 uppercase"
						>
							Buku Catatan
						</p>
						<h1
							class="mt-1 font-[Georgia,Times,serif] text-2xl leading-tight text-stone-900 sm:text-3xl"
						>
							{dateLabel}
						</h1>
						<p class="mt-2 text-xs text-stone-600 sm:text-sm">{excerptWeather}</p>
					</div>

					{#if data.authed}
						<span
							class="rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 {badgeClass(
								data.syncStatus
							)}"
						>
							{syncStatusLabel(data.syncStatus)}
						</span>
					{/if}
				</div>

				<!-- Progress Indicator -->
				<div class="space-y-1.5 pt-2">
					<div class="flex justify-between text-[11px] text-stone-500">
						<span>Halaman {data.index + 1} dari {data.total} catatan</span>
						<span>{Math.round(progress)}%</span>
					</div>
					<div class="h-1.5 overflow-hidden rounded-full bg-stone-300/70">
						<div
							class="h-full rounded-full bg-teal-800/80 transition-all"
							style="width: {progress}%"
						></div>
					</div>
				</div>
			</header>

			<!-- Priority Section jika ada -->
			{#if data.note.priority_items.length > 0}
				<section class="space-y-2 rounded-xl border border-stone-300/40 bg-white/40 p-4">
					<h2 class="font-[Georgia,Times,serif] text-base font-semibold text-stone-800">
						⚡ Prioritas
					</h2>
					<ul class="space-y-1.5">
						{#each data.note.priority_items as item, i (`${i}-${item.text}`)}
							<li class="flex items-start gap-2.5 text-sm text-stone-700">
								<span class="mt-0.5 text-xs font-semibold">{item.done ? '☑' : '☐'}</span>
								<span class:line-through={item.done} class:text-stone-400={item.done}
									>{item.text}</span
								>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<!-- Konten Utama Catatan -->
			<section class="min-h-56">
				{#if data.note.note_content.trim()}
					<div
						class="prose-note font-[Georgia,Times,serif] text-[1.05rem] leading-8 text-stone-800"
					>
						{@html rendered}
					</div>
				{:else}
					<p class="py-12 text-center text-sm text-stone-500 italic">
						Halaman catatan ini masih kosong.
					</p>
				{/if}
			</section>

			<!-- Footer Navigasi Halaman -->
			<footer
				class="flex flex-wrap items-center justify-between gap-2 border-t border-stone-300/70 pt-5"
			>
				<div class="flex items-center gap-2">
					{#if data.prevDate}
						<a
							href="/notebook/{data.prevDate}"
							class="rounded-xl border border-stone-400/60 bg-white/80 px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-white active:scale-95"
						>
							&larr; Sebelumnya
						</a>
					{:else}
						<span class="rounded-xl border border-transparent px-3.5 py-2 text-xs text-stone-400">
							&larr; Awal
						</span>
					{/if}

					{#if data.nextDate}
						<a
							href="/notebook/{data.nextDate}"
							class="rounded-xl border border-stone-400/60 bg-white/80 px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-white active:scale-95"
						>
							Berikutnya &rarr;
						</a>
					{:else}
						<span class="rounded-xl border border-transparent px-3.5 py-2 text-xs text-stone-400">
							Terbaru &rarr;
						</span>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<!-- redundant ui -->
					<!-- <button -->
					<!-- 	onclick={() => (datePickerOpen = true)} -->
					<!-- 	class="rounded-xl border border-stone-400/60 bg-white/80 px-3 py-2 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-white" -->
					<!-- > -->
					<!-- 	Kalender Tanggal -->
					<!-- </button> -->

					{#if data.authed}
						<a
							href="/notes/{data.note.date}"
							class="rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 active:scale-95"
						>
							Edit
						</a>
					{/if}
				</div>
			</footer>

			<p class="text-center text-[11px] text-stone-400 sm:text-left">
				Gunakan tombol panah keyboard ← → untuk berpindah halaman, atau tekan R untuk catatan acak.
			</p>
		</div>
	</div>
</div>
