import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const maxImageSize = 15 * 1024 * 1024;
const maxVideoSize = 100 * 1024 * 1024;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

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
			return json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });
		}

		const isImage = allowedImageTypes.has(file.type);
		const isVideo = allowedVideoTypes.has(file.type);
		if (!isImage && !isVideo) {
			return json({ error: 'Format harus JPG, PNG, WebP, MP4, WebM, atau MOV' }, { status: 400 });
		}

		const maxSize = isVideo ? maxVideoSize : maxImageSize;
		if (file.size > maxSize) {
			return json(
				{ error: isVideo ? 'Ukuran video maksimal 100 MB' : 'Ukuran gambar maksimal 15 MB' },
				{ status: 413 }
			);
		}

		const cldForm = new FormData();
		cldForm.append('file', file);
		cldForm.append('upload_preset', uploadPreset);

		const resourceType = isVideo ? 'video' : 'image';
		const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
			method: 'POST',
			body: cldForm
		});

		const data = await res.json();
		if (!res.ok) {
			return json(
				{ error: data.error?.message ?? 'Gagal upload ke Cloudinary' },
				{ status: res.status }
			);
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
		return json(
			{ error: e instanceof Error ? e.message : 'Gagal memproses upload media' },
			{ status: 500 }
		);
	}
};
