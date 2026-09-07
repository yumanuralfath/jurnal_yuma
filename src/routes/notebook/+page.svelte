<script lang="ts">
	let { data } = $props();
</script>

<div class="mx-auto max-w-lg px-4 py-16 text-center">
	<p class="text-sm tracking-wide text-stone-500 uppercase">Buku Catatan</p>
	<h1 class="mt-2 text-2xl font-semibold text-stone-900">Belum ada catatan</h1>
	<p class="mt-3 text-sm text-stone-600">
		{#if data.empty}
			Sync dulu dari GitHub ke Turso, atau buat note hari ini.
		{/if}
	</p>
	<div class="mt-6 flex flex-wrap justify-center gap-2">
		<a
			href="/"
			class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-stone-50"
		>
			Beranda
		</a>
		<a
			href="/notes/{new Date().toISOString().slice(0, 10)}"
			class="rounded-lg bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
		>
			Buat note hari ini
		</a>
	</div>
</div>
