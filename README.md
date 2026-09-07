# journal-yuma

App pengganti "buka Obsidian → commit → push" manual. Tulis note langsung di web,
tersimpan di **Turso** (biar cepat & bisa dibuka di HP), lalu **push ke GitHub**
dengan satu tombol supaya pipeline deploy web kamu yang sudah ada tetap jalan seperti biasa.

## Cara pakai

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Buat database Turso**
   ```bash
   turso db create journal-yuma
   turso db show journal-yuma --url
   turso db tokens create journal-yuma
   ```
   Masukkan hasilnya ke `.env` sebagai `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN`.

3. **Buat GitHub token**
   Buat fine-grained PAT di https://github.com/settings/tokens dengan akses
   `Contents: Read and write` khusus ke repo notes kamu. Isi `GITHUB_TOKEN`,
   `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_NOTES_DIR` di `.env`.

4. **Set password app**
   ```bash
   node -e "console.log(require('bcryptjs').hashSync('password-kamu', 10))"
   ```
   Simpan hasilnya di `.env` sebagai `APP_PASSWORD_HASH`.
   Generate juga `SESSION_SECRET` dengan `openssl rand -hex 32`.

5. **Copy `.env.example` ke `.env`** dan isi semua nilainya.

6. **Inisialisasi tabel di Turso**
   ```bash
   npm run db:init
   ```

7. **Jalankan**
   ```bash
   npm run dev
   ```

## Alur kerja

- **Sync ke Turso** → impor semua daily dari GitHub yang **belum ada** di DB.
  Note yang sudah tersimpan (termasuk yang diubah lokal) **tidak ditimpa**.
- **Buku Catatan** → baca dari Turso (urut tanggal atau acak), tanpa hit GitHub API.
- **Simpan** → tulis perubahan ke Turso, status jadi "Ada perubahan lokal" (perlu push).
- **Push ke GitHub** → simpan ke DB + commit file `.md` ke repo, status kembali synced.
- **Lihat GitHub** → opsional, read-only bandingkan dengan remote.

## Yang masih perlu kamu sesuaikan

- Format frontmatter & body sudah diselaraskan dengan file di
  `Yuma Note/Daily` (repo Obsidian-Note). Completion block hanya ditulis
  kalau ada priority items.
- Deploy ke Vercel: set semua env var di atas di dashboard Vercel juga.
