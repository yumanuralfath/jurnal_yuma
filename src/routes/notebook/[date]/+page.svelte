<script lang="ts">
	import { goto } from '$app/navigation';
	import { humanDateLabel, isoFromDate } from '$lib/dateUtils';
	import { renderMarkdown } from '$lib/markdownRender';
	import { syncStatusLabel, type SyncStatus } from '$lib/syncStatus';
	import { Dialog } from 'bits-ui';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

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
				return 'bg-[#e8efec] text-[#2f5148] ring-[#c9dbd4]';
			case 'dirty':
				return 'bg-[#f7edd9] text-[#8a6a2c] ring-[#eaddb6]';
			case 'never':
				return 'bg-[#f1ede3] text-[#8a8272] ring-[#e4dcc9]';
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

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,340..560;1,9..144,400..500&family=Inter:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<svelte:window onkeydown={onKey} />

<div
	class="mx-auto max-w-2xl px-4 py-6 pb-16 font-[Inter,ui-sans-serif,system-ui,sans-serif] sm:px-6 sm:py-10"
>
	<!-- Top Navigation Bar -->
	<div class="mb-7 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2.5">
			{#if data.authed}
				<a
					href="/"
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[#6f6656] transition hover:bg-[#efe7d8] hover:text-[#2a241c]"
				>
					&larr; <span class="hidden sm:inline">Beranda Admin</span><span class="sm:hidden"
						>Admin</span
					>
				</a>
			{:else}
				<div class="flex items-center gap-2">
					<span
						class="font-[Fraunces,Georgia,serif] text-[15px] leading-none text-[#3f6e64] italic"
						aria-hidden="true"
					>
						✦
					</span>
					<span class="text-sm font-medium text-[#2a241c]">Buku Catatan Yuma</span>
				</div>
			{/if}
		</div>

		<!-- Unified toolbar -->
		<div
			class="flex items-center gap-0.5 rounded-full border border-[#e4dcc9] bg-[#fdfbf6] p-1 shadow-[0_1px_2px_rgb(28_25_23/0.04)]"
		>
			<Dialog.Root bind:open={datePickerOpen}>
				<Dialog.Trigger
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[#4a453b] transition hover:bg-[#efe7d8]"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="size-3.5 text-[#3f6e64]"
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
					<span>{data.total}</span>
				</Dialog.Trigger>

				<Dialog.Portal>
					<Dialog.Overlay class="fixed inset-0 z-40 bg-[#2a241c]/40 backdrop-blur-[2px]" />
					<Dialog.Content
						class="fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[min(95vw,29rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#e4dcc9] bg-[#fdfbf6] p-5 shadow-[0_24px_60px_-24px_rgb(28_25_23/0.35)] outline-none sm:p-6"
					>
						<div class="flex items-start justify-between gap-3 border-b border-[#e9e1d1] pb-3">
							<div>
								<Dialog.Title
									class="flex items-center gap-2 font-[Fraunces,Georgia,serif] text-lg text-[#2a241c]"
								>
									Kalender Catatan
								</Dialog.Title>
								<Dialog.Description class="mt-0.5 text-xs text-[#8a8272]">
									Pilih tanggal untuk membaca catatan.
								</Dialog.Description>
							</div>
							<Dialog.Close
								class="rounded-full p-1.5 text-[#8a8272] transition hover:bg-[#efe7d8] hover:text-[#2a241c]"
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
									class="rounded-full bg-[#f1ede3] px-2.5 py-1 font-medium text-[#4a453b] transition hover:bg-[#e9e1d1]"
									title="Buka catatan paling baru"
								>
									Terbaru
								</button>
								<button
									type="button"
									onclick={() => goToDate(data.dates[0])}
									class="rounded-full bg-[#f1ede3] px-2.5 py-1 font-medium text-[#4a453b] transition hover:bg-[#e9e1d1]"
									title="Buka catatan pertama"
								>
									Terlama
								</button>
								<button
									type="button"
									onclick={goToCurrentNoteMonth}
									class="rounded-full bg-[#e8efec] px-2.5 py-1 font-medium text-[#2f5148] transition hover:bg-[#dbe8e3]"
									title="Kembali ke bulan catatan saat ini"
								>
									Bulan ini
								</button>
							</div>
							<button
								type="button"
								onclick={() => {
									datePickerOpen = false;
									goRandom();
								}}
								class="rounded-full bg-[#f1ede3] px-2.5 py-1 font-medium text-[#4a453b] transition hover:bg-[#e9e1d1]"
								title="Buka catatan acak"
							>
								Acak
							</button>
						</div>

						<!-- Month Header Controls -->
						<div class="mt-4 flex items-center justify-between gap-2 px-0.5">
							<button
								type="button"
								onclick={prevMonth}
								class="inline-flex size-8 items-center justify-center rounded-full text-[#4a453b] transition hover:bg-[#efe7d8]"
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

							<select
								aria-label="Pilih Bulan Catatan"
								value={currentMonthPrefix}
								onchange={(e) => {
									const [y, m] = e.currentTarget.value.split('-').map(Number);
									viewYear = y;
									viewMonth = m - 1;
								}}
								class="cursor-pointer rounded-full border border-[#e4dcc9] bg-white px-3 py-1.5 text-center text-xs font-semibold text-[#2a241c] focus:border-[#3f6e64] focus:ring-1 focus:ring-[#3f6e64] focus:outline-none sm:text-sm"
							>
								{#each data.availableMonths as m}
									{@const [mY, mM] = m.yearMonth.split('-').map(Number)}
									<option value={m.yearMonth}>
										{MONTH_NAMES_ID[mM - 1]}
										{mY} ({m.dates.length})
									</option>
								{/each}
								{#if !data.availableMonths.some((m) => m.yearMonth === currentMonthPrefix)}
									<option value={currentMonthPrefix} disabled selected>
										{viewMonthLabel} (0)
									</option>
								{/if}
							</select>

							<button
								type="button"
								onclick={nextMonth}
								class="inline-flex size-8 items-center justify-center rounded-full text-[#4a453b] transition hover:bg-[#efe7d8]"
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
						<div class="mt-2.5 flex items-center justify-between px-1 text-xs text-[#8a8272]">
							<span class="font-medium text-[#4a453b]">{viewMonthLabel}</span>
							<span class={notesInViewedMonth > 0 ? 'font-semibold text-[#2f5148]' : ''}>
								{notesInViewedMonth} catatan
							</span>
						</div>

						<!-- Day of week column headers -->
						<div
							class="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[#8a8272]"
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
									class="relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-center transition sm:min-h-12 {cell.isCurrentNote
										? 'bg-[#3f6e64] font-semibold text-white shadow-[0_2px_8px_-2px_rgb(63_110_100/0.5)]'
										: cell.hasNote
											? cell.isCurrentMonth
												? 'cursor-pointer bg-[#e8efec] font-medium text-[#2f5148] hover:bg-[#dbe8e3] active:scale-95'
												: 'cursor-pointer bg-[#e8efec]/40 text-[#2f5148]/60 hover:bg-[#e8efec]/70'
											: cell.isCurrentMonth
												? 'cursor-default text-[#c7bfad]'
												: 'cursor-default text-[#e4dcc9]'}"
								>
									{#if cell.isToday}
										<span
											class="absolute top-1 right-1.5 size-1 rounded-full {cell.isCurrentNote
												? 'bg-[#e8c98f]'
												: 'bg-[#b08d57]'}"
											title="Hari Ini"
										></span>
									{/if}
									<span class="text-xs leading-none sm:text-sm">{cell.dayNumber}</span>
									{#if cell.hasNote}
										<span
											class="size-1 rounded-full {cell.isCurrentNote ? 'bg-white' : 'bg-[#3f6e64]'}"
										></span>
									{/if}
								</button>
							{/each}
						</div>

						<!-- Footer -->
						<div
							class="mt-4 flex items-center justify-between border-t border-[#e9e1d1] pt-3 text-[11px] text-[#8a8272]"
						>
							<span>Berisi catatan · kosong tanpa titik</span>
							<span class="font-medium">{data.total} catatan total</span>
						</div>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>

			<span class="h-4 w-px bg-[#e4dcc9]" aria-hidden="true"></span>

			<button
				onclick={copyPublicLink}
				aria-label={copied ? 'Tautan tersalin' : 'Bagikan catatan'}
				title={copied ? 'Tautan tersalin!' : 'Salin tautan catatan ini'}
				class="inline-flex size-8 items-center justify-center rounded-full text-[#4a453b] transition hover:bg-[#efe7d8]"
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
						class="size-4 text-[#2f5148]"
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
						class="size-4"
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
				class="group inline-flex size-8 items-center justify-center rounded-full text-[#4a453b] transition hover:bg-[#efe7d8] {data.mode ===
				'random'
					? 'bg-[#3f6e64] text-white hover:bg-[#365e55]'
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
					class="size-4 transition-transform duration-500 group-hover:rotate-180"
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
		class="notebook-shell relative overflow-hidden rounded-[1.4rem] border border-[#e4dcc9] bg-[#faf6ee] shadow-[0_30px_70px_-40px_rgb(28_25_23/0.5)]"
	>
		<div
			class="pointer-events-none absolute inset-y-0 left-0 w-px bg-[#3f6e64]/25"
			aria-hidden="true"
		></div>

		<div class="space-y-7 px-6 py-9 sm:px-11 sm:py-12">
			<!-- Header + Priority + Content: animate together on page change -->
			{#key data.note.date}
				<div
					in:fly={{ y: 14, duration: 420, delay: 110, easing: cubicOut }}
					out:fly={{ y: -10, duration: 200, easing: cubicOut }}
					class="space-y-7"
				>
					<!-- Header Catatan -->
					<header class="space-y-4 border-b border-[#e9e1d1] pb-6">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h1
									class="font-[Fraunces,Georgia,serif] text-[2rem] leading-[1.1] text-[#2a241c] italic sm:text-[2.4rem]"
								>
									{dateLabel}
								</h1>
								<p class="mt-2 text-sm text-[#6f6656]">{excerptWeather}</p>
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
						<div class="space-y-1.5">
							<div class="flex justify-between text-[11px] text-[#8a8272]">
								<span>Halaman {data.index + 1} dari {data.total}</span>
								<span>{Math.round(progress)}%</span>
							</div>
							<div class="h-1 overflow-hidden rounded-full bg-[#e9e1d1]">
								<div
									class="h-full rounded-full bg-[#3f6e64] transition-[width] duration-500 ease-out"
									style="width: {progress}%"
								></div>
							</div>
						</div>
					</header>

					<!-- Priority Section jika ada -->
					{#if data.note.priority_items.length > 0}
						<section class="space-y-2.5">
							<h2 class="font-[Fraunces,Georgia,serif] text-base text-[#2a241c] italic">
								Prioritas hari ini
							</h2>
							<ul class="space-y-1.5">
								{#each data.note.priority_items as item, i (`${i}-${item.text}`)}
									<li class="flex items-start gap-2.5 text-sm text-[#3f382c]">
										<span class="mt-0.5 text-xs {item.done ? 'text-[#3f6e64]' : 'text-[#b7ac96]'}"
											>{item.done ? '☑' : '☐'}</span
										>
										<span class:line-through={item.done} class:text-[#b7ac96]={item.done}
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
								class="prose-note font-[Fraunces,Georgia,serif] text-[1.08rem] leading-8 text-[#3a3327]"
							>
								{@html rendered}
							</div>
						{:else}
							<p class="py-14 text-center text-sm text-[#a89e8a] italic">
								Halaman catatan ini masih kosong.
							</p>
						{/if}
					</section>
				</div>
			{/key}

			<!-- Footer Navigasi Halaman -->
			<footer
				class="flex flex-wrap items-center justify-between gap-2 border-t border-[#e9e1d1] pt-6"
			>
				<div class="flex items-center gap-4 text-xs font-medium">
					{#if data.prevDate}
						<a href="/notebook/{data.prevDate}" class="notebook-link text-[#4a453b]">
							&larr; Sebelumnya
						</a>
					{:else}
						<span class="text-[#c7bfad]">&larr; Awal</span>
					{/if}

					{#if data.nextDate}
						<a href="/notebook/{data.nextDate}" class="notebook-link text-[#4a453b]">
							Berikutnya &rarr;
						</a>
					{:else}
						<span class="text-[#c7bfad]">Terbaru &rarr;</span>
					{/if}
				</div>

				{#if data.authed}
					<a
						href="/notes/{data.note.date}"
						class="rounded-full bg-[#3f6e64] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#365e55] active:scale-95"
					>
						Edit
					</a>
				{/if}
			</footer>

			<p class="text-center text-[11px] text-[#a89e8a] sm:text-left">
				← → untuk berpindah halaman &nbsp;·&nbsp; R untuk catatan acak
			</p>
		</div>
	</div>
</div>

<style>
	.notebook-link {
		position: relative;
		padding-bottom: 2px;
	}
	.notebook-link::after {
		content: '';
		position: absolute;
		left: 0;
		right: 100%;
		bottom: 0;
		height: 1px;
		background: #3f6e64;
		transition: right 0.25s ease-out;
	}
	.notebook-link:hover::after {
		right: 0;
	}

	.prose-note :global(p) {
		margin: 0 0 1.1em;
	}
	.prose-note :global(p:last-child) {
		margin-bottom: 0;
	}
	.prose-note :global(a) {
		color: #3f6e64;
		text-underline-offset: 3px;
	}
	.prose-note :global(strong) {
		color: #2a241c;
	}
	.prose-note :global(ul),
	.prose-note :global(ol) {
		padding-left: 1.3em;
		margin: 0 0 1.1em;
	}
	.prose-note :global(blockquote) {
		border-left: 2px solid #3f6e64;
		margin: 1.2em 0;
		padding-left: 1em;
		font-style: italic;
		color: #6f6656;
	}

	@media (prefers-reduced-motion: reduce) {
		.notebook-link::after {
			transition: none;
		}
	}
</style>
