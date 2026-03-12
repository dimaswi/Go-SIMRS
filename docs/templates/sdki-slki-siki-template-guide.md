# Template SDKI-SLKI-SIKI

## File yang disediakan
- `sdki-slki-siki-template.csv`: format cepat untuk input via Excel.
- `sdki-slki-siki-template.json`: format terstruktur untuk integrasi sistem.

## Aturan isi CSV
- Satu baris mewakili satu diagnosis SDKI.
- Jika item lebih dari satu pada kolom relasi, gunakan pemisah ` | `.
- Gunakan format kode + label untuk SLKI/SIKI, contoh: `SLKI-001: Kontrol Nyeri`.

## Kolom CSV
1. `sdki_code`
2. `sdki_label`
3. `definisi`
4. `fisiologis`
5. `situasional`
6. `subjektif_mayor`
7. `objektif_mayor`
8. `subjektif_minor`
9. `objektif_minor`
10. `kondisi_klinis_terkait`
11. `slki_luaran_utama`
12. `slki_luaran_tambahan`
13. `siki_intervensi_utama`
14. `siki_intervensi_pendukung`
15. `catatan`

## Saran workflow
1. Tim klinis isi dan validasi di CSV/Excel.
2. Setelah final, konversi ke JSON sesuai template.
3. JSON dipakai untuk fitur dropdown SDKI dan auto-populate SLKI/SIKI.
