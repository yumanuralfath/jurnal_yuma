import { marked } from 'marked';

marked.setOptions({
	gfm: true,
	breaks: true
});

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function isVideoUrl(url: string): boolean {
	try {
		const path = new URL(url, 'https://journal-yuma.local').pathname.toLowerCase();
		return /\.(mp4|webm|mov)$/.test(path);
	} catch {
		return false;
	}
}

marked.use({
	renderer: {
		html({ text }) {
			return escapeHtml(text);
		},
		link({ href, title, text }) {
			if (!isVideoUrl(href)) return false;
			const safeUrl = escapeHtml(href);
			const label = escapeHtml(text);
			const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
			return `<video controls preload="metadata" class="note-video"${titleAttr} aria-label="${label}"><source src="${safeUrl}">Browser tidak mendukung pemutaran video.</video>`;
		}
	}
});

export function renderMarkdown(src: string): string {
	return marked.parse(src || '', { async: false }) as string;
}
