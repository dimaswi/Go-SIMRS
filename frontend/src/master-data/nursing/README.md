# Master Data SDKI-SLKI-SIKI

Master data utama untuk dipakai pada form Asuhan Keperawatan disimpan di:
- `sdki-slki-siki.master.json`

## Cara menambah data baru
1. Salin isi `sdki-slki-siki.empty-item.json`.
2. Isi seluruh field diagnosis baru.
3. Tempel objek baru ke array `items` pada `sdki-slki-siki.master.json`.
4. Update `last_updated` di root file.

## Aturan pengisian
- Gunakan kode SDKI asli pada `sdki.code`.
- Isi `slki.luaran_utama` dan `siki.intervensi_utama` minimal 1 item.
- Jika tidak ada data pada suatu bagian, isi array kosong `[]`.
- Pertahankan struktur key agar kompatibel saat integrasi form.

## Catatan
- Tahap ini hanya master data.
- Integrasi ke UI/form dilakukan pada tahap berikutnya.
