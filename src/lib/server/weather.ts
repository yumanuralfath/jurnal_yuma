import { env } from '$env/dynamic/private';

// Peta kode cuaca WMO -> emoji + deskripsi ala bahasa Indonesia santai.
// Kalau mau ubah gaya bahasanya, tinggal edit di sini.
const WEATHER_CODE_MAP: Record<number, { emoji: string; desc: string }> = {
	0: { emoji: '☀️', desc: 'langit cerah' },
	1: { emoji: '🌤️', desc: 'cerah sedikit berawan' },
	2: { emoji: '⛅', desc: 'cerah berawan' },
	3: { emoji: '☁️', desc: 'awan mendung' },
	45: { emoji: '🌫️', desc: 'berkabut' },
	48: { emoji: '🌫️', desc: 'kabut beku' },
	51: { emoji: '🌦️', desc: 'gerimis ringan' },
	53: { emoji: '🌦️', desc: 'gerimis' },
	55: { emoji: '🌦️', desc: 'gerimis lebat' },
	61: { emoji: '🌧️', desc: 'hujan ringan' },
	63: { emoji: '🌧️', desc: 'hujan' },
	65: { emoji: '🌧️', desc: 'hujan lebat' },
	80: { emoji: '🌧️', desc: 'hujan lokal' },
	81: { emoji: '🌧️', desc: 'hujan lokal deras' },
	82: { emoji: '⛈️', desc: 'hujan sangat deras' },
	95: { emoji: '⛈️', desc: 'badai petir' },
	96: { emoji: '⛈️', desc: 'badai petir dengan hujan es' },
	99: { emoji: '⛈️', desc: 'badai petir hebat' }
};

export async function fetchWeatherString(): Promise<string> {
	const lat = env.WEATHER_LAT ?? '0.5333';
	const lon = env.WEATHER_LON ?? '101.45'; // default: Pekanbaru, Riau

	try {
		const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Open-Meteo gagal: ${res.status}`);
		const data = await res.json();
		const temp = Math.round(data.current_weather.temperature);
		const code = data.current_weather.weathercode as number;
		const info = WEATHER_CODE_MAP[code] ?? { emoji: '☁️', desc: 'berawan' };
		return `${info.emoji} ${temp}°C - ${info.desc}`;
	} catch {
		// kalau API cuaca down, jangan sampai bikin gagal buat note — fallback kosong, bisa diisi manual
		return '';
	}
}
