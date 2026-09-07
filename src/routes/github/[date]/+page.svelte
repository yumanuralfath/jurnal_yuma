<script lang="ts">
	import { goto } from '$app/navigation';
	import { humanDateLabel } from '$lib/dateUtils';
	import { renderMarkdown } from '$lib/markdownRender';
	import { Tabs } from 'bits-ui';

	let { data } = $props();

	let view = $state<'rendered' | 'raw'>('rendered');
	let copying = $state(false);
	let msg = $state('');

	const dateLabel = $derived(humanDateLabel(data.date));
	const rendered = $derived(renderMarkdown(data.raw));
	const priorityItems = $derived(data.parsed.priority_items ?? []);

	async function copyToLocalEditor() {
		copying = true;
		msg = '';
		try {
			// Prefill lewat sessionStorage — DB belum disentuh sampai user klik Simpan.
			sessionStorage.setItem(
				`github-prefill:${data.date}`,
				JSON.stringify({
					weather: data.parsed.weather ?? '',
					note_content: data.parsed.note_content ?? '',
					priority_items: data.parsed.priority_items ?? [],
					day_name: data.parsed.day_name ?? '',
					tags: data.parsed.tags ?? ['Daily'],
					created_at: data.parsed.created_at ?? data.date,
					fromGithub: true
				})
			);
			await goto(`/notes/${data.date}?prefill=github`);
		} catch (e) {
			msg = e instanceof Error ? e.message : 'Gagal membuka editor';
		} finally {
			copying = false;
		}
	}
</script>

<div class="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
	<a href="/github" class="inline-flex text-sm text-stone-500 transition hover:text-stone-800"
		>&larr; Daftar GitHub</a
	>

	<header class="space-y-2">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<p class="text-xs tracking-wide text-stone-500 uppercase">Versi GitHub (read-only)</p>
				<h1 class="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{dateLabel}</h1>
				<p class="mt-1 text-sm text-stone-500">{data.parsed.weather || '—'}</p>
			</div>
			<span class="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200">
				Tidak menulis DB
			</span>
		</div>
		<p class="font-mono text-[11px] break-all text-stone-400">{data.path}</p>
		{#if data.localExists}
			<p class="text-xs text-stone-500">
				Ada juga salinan lokal
				{#if data.localSyncStatus === 'dirty'}
					(ada perubahan lokal belum di-push).
				{:else if data.localSyncStatus === 'synced'}
					(sudah synced).
				{:else}
					(draft lokal).
				{/if}
			</p>
		{:else}
			<p class="text-xs text-stone-500">Belum ada di database lokal.</p>
		{/if}
	</header>

	<div class="flex flex-wrap gap-2">
		<button
			onclick={copyToLocalEditor}
			disabled={copying}
			class="rounded-lg bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
		>
			{copying ? 'Membuka…' : data.localExists ? 'Muat ke editor lokal' : 'Buka di editor lokal'}
		</button>
		{#if data.localExists}
			<a
				href="/notes/{data.date}"
				class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-stone-50"
			>
				Buka lokal tanpa ubah
			</a>
		{/if}
	</div>
	<p class="text-xs text-stone-500">
		"Muat ke editor" hanya mengisi form di browser. Database baru berubah setelah kamu tekan
		<strong>Simpan</strong> atau <strong>Push ke GitHub</strong>.
	</p>
	{#if msg}
		<p class="text-sm text-red-600">{msg}</p>
	{/if}

	{#if priorityItems.length > 0}
		<section class="space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold text-stone-800">Priority</h2>
			<ul class="space-y-2">
				{#each priorityItems as item, i (`${i}-${item.text}`)}
					<li class="flex items-start gap-3 text-sm">
						<span
							class="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border {item.done
								? 'border-teal-700 bg-teal-700 text-white'
								: 'border-stone-300'}"
						>
							{#if item.done}✓{/if}
						</span>
						<span class:line-through={item.done} class:text-stone-400={item.done}>{item.text}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
		<Tabs.Root bind:value={view} class="space-y-4">
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-sm font-semibold text-stone-800">Isi file</h2>
				<Tabs.List class="inline-grid grid-cols-2 gap-1 rounded-lg bg-stone-200/70 p-1 text-xs font-medium text-stone-600">
					<Tabs.Trigger
						value="rendered"
						class="rounded-md px-3 py-1 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
					>
						View
					</Tabs.Trigger>
					<Tabs.Trigger
						value="raw"
						class="rounded-md px-3 py-1 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
					>
						Raw MD
					</Tabs.Trigger>
				</Tabs.List>
			</div>
			<Tabs.Content value="rendered" class="outline-none">
				<div class="prose-note">{@html rendered}</div>
			</Tabs.Content>
			<Tabs.Content value="raw" class="outline-none">
				<pre
					class="overflow-x-auto rounded-lg bg-stone-900 p-4 text-xs leading-relaxed whitespace-pre-wrap text-stone-100">{data.raw}</pre>
			</Tabs.Content>
		</Tabs.Root>
	</section>
</div>
