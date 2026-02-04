# Alur On-Site Khusus Pasien dengan Pembayaran BPJS
## Pasien Lama
1. Pasien ambil antrian kiosk dan cek apakah pasien sudah pernah terdaftar 
2. Dapat nomor antrian pendaftaran dan hit task_id 1 bpjs 
3. Petugas pendaftaran memanggil dan memproses pasien tersebut akan trigger task_id 2 bpjs
4. Petugas mendaftarkan ke poli tujuan akan mendapatkan nomor antrian poli dan trigger task_id 3 bpjs
5. Petugas poli memanggil dan menerima pasien akan trigger task_id 4 bpjs
6. Petugas poli melakukan final/memulangkan pasien akan trigger task_id 5 bpjs
7. Petugas farmasi memberikan obat akan mengisi task_id 6 dan task_id 7 bpjs dengan jarak waktu flat di 5 menit 

## Pasien Baru
1. kita skip untuk kiosk dan antrian pendaftaran karena akan langsung dimulai dari task_id 3
2. Petugas melakukan pendaftaran ke poli dan pasien menerima antrian poli akan trigger task_id 3 
3. Petugas poli memanggil dan menerima pasien akan trigger task_id 4 bpjs
4. Petugas poli melakukan final/memulangkan pasien akan trigger task_id 5 bpjs
5. Petugas farmasi memberikan obat akan mengisi task_id 6 dan task_id 7 bpjs dengan jarak waktu flat di 5 menit

# Alur MJKN Khusus Pasien dengan Pembayaran BPJS
1. Pasien mengambil nomor antrian dari mobile JKN 
2. Pasien datang check-in dan akan mentrigger task_id 3
4. Petugas poli memanggil dan menerima pasien akan trigger task_id 4 bpjs
5. Petugas poli melakukan final/memulangkan pasien akan trigger task_id 5 bpjs
6. Petugas farmasi memberikan obat akan mengisi task_id 6 dan task_id 7 bpjs dengan jarak waktu flat di 5 menit


# Catatan Untuk MJKN 
1. Pasien akan generate id registrasi dan id kunjungan secara langsung dari MJKN tetapi id kunjungan akan di non-aktifkan dahulu dari antrian sampai pasien MJKN datang dan checkin di petugas pendaftaran 
2. Nomor antrian yang dikirim ke MJKN sama dengan nomor antrian onsite sesuai ruangan
3. Berikan badge tersendiri bagi pasien MJKN 
[Updated]
4. Nomor antrian MJKN sama, akan urut juga termasuk pasien On-Site akan mendapatkan nomor antrian setelah pasien MJKN jika daftar setelah pasien MJKN. untuk nomor antrian tetap seperti biasanya tidak ada nomor khusus untuk pasien MJKN  