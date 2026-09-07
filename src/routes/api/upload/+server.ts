import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const cloudName = env.CLOUDINARY_CLOUD_NAME;
		const apiKey = env.CLOUDINARY_API_KEY;
		const apiSecret = env.CLOUDINARY_API_SECRET;
		const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET;

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

		const timestamp = Math.round(Date.now() / 1000);

		if (apiSecret && apiKey) {
			// Upload terotentikasi dengan signed signature
			const str = `timestamp=${timestamp}${apiSecret}`;
			const signature = crypto.createHash('sha1').update(str).digest('hex');
			cldForm.append('api_key', apiKey);
			cldForm.append('timestamp', String(timestamp));
			cldForm.append('signature', signature);
		} else if (uploadPreset) {
			cldForm.append('upload_preset', uploadPreset);
		}

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
