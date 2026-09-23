import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const cloudName = env.CLOUDINARY_CLOUD_NAME;
		const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET || 'Obsidian';

		if (!cloudName) {
			return json({ error: 'Cloudinary belum dikonfigurasi di server (.env)' }, { status: 500 });
		}

		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || !(file instanceof Blob)) {
			return json({ error: 'Tidak ada file gambar yang diunggah' }, { status: 400 });
		}

		const cldForm = new FormData();
		cldForm.append('file', file);
		cldForm.append('upload_preset', uploadPreset);

		const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
			method: 'POST',
			body: cldForm
		});

		const data = await res.json();
		if (!res.ok) {
			return json({ error: data.error?.message ?? 'Gagal upload ke Cloudinary' }, { status: res.status });
		}

		return json({
			ok: true,
			url: data.secure_url || data.url,
			public_id: data.public_id,
			width: data.width,
			height: data.height,
			format: data.format
		});
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Gagal memproses upload gambar' }, { status: 500 });
	}
};
