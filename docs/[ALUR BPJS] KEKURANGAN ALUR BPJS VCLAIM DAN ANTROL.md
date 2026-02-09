# Alur untuk Virtual Claim dan juga Antrian Online

## Alur yang sudah
1. Pasien datang ke UGD lalu meminta rawat inap (done)
2. Perawat input surat SPRI  (done)
3. SPRI tergenerate dan bagian pendaftaran akan membuatkan SEP dari SPRI tadi (done)
4. Pasien rawat inap pulang dan perawat akan membuatkan surat kontrol dari SEP rawat inap tadi (done) -> server akan generate jadwal kontrol juga (done)

## Alur yang belum

### Skenario jika pasien dari mobile JKN 
5. Aplikasi mobile JKN hit API rs untuk ambil kode booking -> lalu server akan generate kodebooking yang akan dikembalikan ke mobile JKN
6. Petugas pendaftaran melakukan checkin untuk pasien datang lalu aktifkan antrian poli + add antrean untuk antrian online + kirim task id 3
7. Petugas poli memanggil dan melakukan tindakan akan mengirim task id 4
8. Petugas poli selesai akan mengirim task id 5
9. Jika ada resep ketika ruangan apotek memanggil pasien akan mengirim task id 6
10. Jika resep sudah selesai akan mengirim task id 7

### Skenario jika pasien langsung On-Site tanpa mobile JKN