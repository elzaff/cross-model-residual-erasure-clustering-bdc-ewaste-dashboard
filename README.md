# Dashboard: Cross-Model Residual Erasure untuk Pengelompokan Sampah Elektronik tanpa Label yang Tahan Bias Sumber Foto

**Buka dashboard:** [https://elzaff.github.io/cross-model-residual-erasure-clustering-bdc-ewaste-dashboard/](https://elzaff.github.io/cross-model-residual-erasure-clustering-bdc-ewaste-dashboard/) · repositori utama (kode, hasil, reproduksi): [https://github.com/elzaff/cross-model-residual-erasure-clustering-bdc-ewaste](https://github.com/elzaff/cross-model-residual-erasure-clustering-bdc-ewaste)

Dashboard presentasi hasil karya ilmiah **BDC Satria Data 2026** (tim SD2026040000100): 16 kelompok e-waste yang ditemukan
tanpa label dari 3.792 foto BDC. Lima halaman:

- **Peta**: kartu foto uji dari dataset lain masuk ke peta t-SNE. Slider sebelum/sesudah CMRE bisa diputar, dijeda, dan digeser. Panel hasil memberi tiga alasan: pusat kelompok terdekat, lima foto BDC termirip, dan cek barang asing.
- **Coba sendiri**: 452 foto uji, termasuk yang ditandai sebagai barang asing.
- **16 kelompok**: galeri, penanganan, dan kestabilan tiap kelompok, lalu alasan K = 16 dipertahankan dibanding K = 17.
- **Cara kerja CMRE**: delapan langkah animasi yang mengikuti dua foto mouse, ditutup peta data asli.
- **Analisis**: alur, data, bukti, sumber, dan istilah.

`data.js` dibuat oleh `code/make_dashboard_data.py`, sedangkan `demo.js` serta folder `assets/t` dan `assets/c` dibuat oleh
`code/make_dashboard_demo.py` (repositori utama). Foto yang terdeteksi memuat wajah tidak diberi thumbnail.

## Membuka

```bash
python -m http.server 8765
```

Buka `http://localhost:8765`. Halaman harus dibuka lewat server (bukan langsung dari file) karena memuat `data.js`.
Untuk GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.

Kode, metodologi, dan cara reproduksi: https://github.com/elzaff/cross-model-residual-erasure-clustering-bdc-ewaste

## Tim

| | |
|---|---|
| Kode kelompok / registrasi | SD2026040000100 |
| Cabang lomba | Big Data Challenge (BDC), Satria Data 2026 |

| No | Nama | Peran |
|---|---|---|
| 1 | Berliana Sarlita Rahajeng | Anggota |
| 2 | Fazle Mawla Wahyuhanda | Ketua |
| 3 | Muhammad Fatih Al Fawwaz | Anggota |

## Lisensi

Kode halaman: MIT. Foto contoh di `assets/` berasal dari set data publik yang dicantumkan di bagian Sumber pada halaman dan
tetap mengikuti lisensi aslinya; foto BDC adalah milik panitia BDC Satria Data 2026.
