<script lang="ts">
	import { humanDateLabel } from '$lib/dateUtils';

	let { data } = $props();
</script>

<div class="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
	<header class="space-y-3">
		<a href="/" class="inline-flex text-sm text-stone-500 transition hover:text-stone-800">&larr; Kembali</a>
		<div>
			<p class="text-sm tracking-wide text-stone-500 uppercase">Read-only</p>
			<h1 class="mt-1 text-2xl font-semibold tracking-tight text-stone-900">Lihat GitHub</h1>
			<p class="mt-2 text-sm text-stone-600">
				Isi di bawah diambil dari repo Obsidian-Note. Melihat di sini
				<strong class="font-medium text-stone-800">tidak mengubah database</strong>. DB hanya berubah
				saat kamu Simpan atau Push ke GitHub dari editor lokal.
			</p>
		</div>
		<div class="flex flex-wrap gap-2 text-xs">
			<span class="rounded-full bg-white px-2.5 py-1 ring-1 ring-stone-200">{data.total} file di GitHub</span>
			<span class="rounded-full bg-sky-50 px-2.5 py-1 text-sky-800 ring-1 ring-sky-200"
				>{data.onlyRemote} belum ada di DB lokal</span
			>
		</div>
	</header>

	{#if data.sections.length === 0}
		<div
			class="rounded-xl border border-dashed border-stone-300 bg-white/60 px-4 py-10 text-center text-sm text-stone-500"
		>
			Tidak ada file daily di GitHub.
		</div>
	{:else}
		<div class="space-y-6">
			{#each data.sections as section (section.key)}
				<section class="space-y-2">
					<h2 class="text-xs font-semibold tracking-wider text-stone-500 uppercase">{section.label}</h2>
					<ul class="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
						{#each section.notes as note (note.date)}
							<li class="border-b border-stone-100 last:border-b-0">
								<a
									href="/github/{note.date}"
									class="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-stone-50"
								>
									<div class="min-w-0">
										<p class="truncate text-sm font-medium text-stone-900">{humanDateLabel(note.date)}</p>
										<p class="truncate font-mono text-[11px] text-stone-400">{note.path}</p>
									</div>
									<span
										class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 {note.inLocal
											? 'bg-stone-100 text-stone-600 ring-stone-200'
											: 'bg-sky-50 text-sky-800 ring-sky-200'}"
									>
										{note.inLocal ? 'ada di lokal' : 'hanya di GitHub'}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</div>
