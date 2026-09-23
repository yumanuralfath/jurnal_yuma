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

marked.use({
	renderer: {
		html({ text }) {
			return escapeHtml(text);
		}
	}
});

export function renderMarkdown(src: string): string {
	return marked.parse(src || '', { async: false }) as string;
}
