<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<div class="flex min-h-screen items-center justify-center px-4">
	<form
		method="POST"
		use:enhance
		class="w-full max-w-sm space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
	>
		<div>
			<p class="text-xs tracking-wide text-stone-500 uppercase">Journal Yuma</p>
			<h1 class="mt-1 text-lg font-semibold text-stone-900">Masuk</h1>
		</div>
		<input
			type="password"
			name="password"
			placeholder="Password"
			autofocus
			class="w-full rounded-lg border-stone-300 px-3 py-2 shadow-sm focus:border-teal-600 focus:ring-teal-600"
		/>
		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}
		<button class="w-full rounded-lg bg-teal-800 py-2 text-sm font-medium text-white hover:bg-teal-700">
			Masuk
		</button>
	</form>
</div>
