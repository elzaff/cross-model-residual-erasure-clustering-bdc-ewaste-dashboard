# Backend SENTRA (Modal)

API yang dipanggil app untuk menempatkan foto e-waste ke salah satu dari 16 cluster (pipeline CMRE yang sama dengan paper).
Folder ini tidak ikut tersaji di website (lihat `.vercelignore` di root repo).

## Konfigurasi

| Yang diatur | Letak |
|---|---|
| Domain yang boleh memanggil API (CORS) | `ORIGINS` di `modal_pilah.py`, baris 18 |
| URL API yang dipanggil app | konstanta `API` di `app.js`, baris 7. Bisa ditimpa sementara lewat URL: `?api=https://...` |

Menambah domain baru: tambahkan ke `ORIGINS` (versi dengan dan tanpa `www` dihitung berbeda), lalu deploy ulang.
Selama belum di-deploy, app di domain itu menampilkan "AI offline".

## Deploy

Butuh akses ke workspace Modal pemilik (undangan lewat modal.com) dan Modal Secret `huggingface-secret` berisi `HF_TOKEN`.
Token tidak pernah disimpan di repo.

```bash
MODAL_PROFILE=yaraxoaraal modal deploy backend/modal_pilah.py
```

Deploy tidak menyalakan GPU. GPU (satu L4) baru menyala saat foto dikirim dan mati sendiri setelah 3 menit tanpa request
(`scaledown_window=180`, `max_containers=1`).

## Endpoint

`GET /health`, `POST /predict` (foto), `POST /discover` (cluster ulang barang "perlu dicek"), `POST /feedback`,
`GET /feedback/summary`.

`artifacts.npz` berisi proyeksi CMRE, PCA-32, 16 centroid, dan threshold OOD hasil `build_artifacts.py` di repo riset utama.
