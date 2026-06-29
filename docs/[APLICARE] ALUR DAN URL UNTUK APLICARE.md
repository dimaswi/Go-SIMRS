# Referensi Kamar [GET] {Base URL}/aplicaresws/rest/ref/kelas
Response :
{"metadata":
    {
        "code":1,
        "message":"OK",
        "totalitems":16
    },
    "response":
        {
            "list":
                [
                    {"kodekelas":"NON","namakelas":"-"},
                    {"kodekelas":"VVP","namakelas":"VVIP"}
                ]
        }
}

# Update Ketersediaan Tempat Tidur [POST] {Base URL}/aplicaresws/rest/bed/update/{kodeppk}
Request :
{ 
    "kodekelas":"VIP", 
    "koderuang":"RG01", 
    "namaruang":"Ruang Anggrek VIP", 
    "kapasitas":"20", 
    "tersedia":"10",
    "tersediapria":"0", 
    "tersediawanita":"0", 
    "tersediapriawanita":"0"
}

Note : 
1. kodekelas: kode kelas ruang rawat sesuai dengan mapping BPJS Kesehatan
2. koderuang: kode ruangan Rumah Sakit
3. namaruang: nama ruang rawat Rumah Sakit
4. kapasitas: Kapasitas ruang Rumah Sakit
5. tersedia: Jumlah tempat tidur yang kosong / dapat ditempati pasien baru

* Untuk Rumah Sakit yang ingin mencantumkan informasi ketersediaan tempat tidur untuk pasien laki – laki, perempuan, laki – laki atau perempuan

6. tersediapria : Jumlah tempat tidur yang kosong / dapat ditempati pasien baru laki – laki
7. Tersediawanita : Jumlah tempat tidur yang kosong / dapat ditempati pasien baru perempuan
8. tersediapriawanita : Jumlah tempat tidur yang kosong / dapat ditempati pasien baru laki – laki atau perempuan

# Ruang Baru [POST] {Base URL}/aplicaresws/rest/bed/create/{kodeppk}
Request :
{ 
    "kodekelas":"VIP", 
    "koderuang":"RG01", 
    "namaruang":"Ruang Anggrek VIP", 
    "kapasitas":"20", 
    "tersedia":"10",
    "tersediapria":"0", 
    "tersediawanita":"0", 
    "tersediapriawanita":"0"
}

Note :
1. kodekelas: kode kelas ruang rawat sesuai dengan mapping BPJS Kesehatan
2. koderuang: kode ruangan Rumah Sakit
3. namaruang: nama ruang rawat Rumah Sakit
4. kapasitas: Kapasitas ruang Rumah Sakit
5. tersedia: Jumlah tempat tidur yang kosong / dapat ditempati pasien baru

* Untuk Rumah Sakit yang ingin mencantumkan informasi ketersediaan tempat tidur untuk pasien laki – laki, perempuan, laki – laki atau perempuan

6. tersediapria : Jumlah tempat tidur yang kosong / dapat ditempati pasien baru laki – laki
7. Tersediawanita : Jumlah tempat tidur yang kosong / dapat ditempati pasien baru perempuan
8. tersediapriawanita : Jumlah tempat tidur yang kosong / dapat ditempati pasien baru laki – laki atau perempuan

# Ketersediaan Kamar RS [GET] {Base URL}/aplicaresws/rest/bed/read/{kodeppk}/{start}/{limit}
Note : Start dan limit berfungsi untuk paging, jika Rumah Sakit ingin menampilkan data dari baris pertama sampai baris kesepuluh maka start = 1 dan limit = 1, nilai start dimulai dari 1

# Hapus Ruangan [POST] {Base URL}/aplicaresws/rest/bed/delete/{kodeppk}
Request : 
{ 
    "kodekelas":"VIP", 
    "koderuang":"RG01"
}


# Alur yang saya inginkan
1. Karena pada SIMRS ini sudah ada ruangan jadi buatkan page untuk di navigasi untuk Applicare 
2. Untuk assign ruangan jadi kita gunakan API Ruang Baru
3. Untuk kode kelas pada ruang baru pastikan mengambil data dari referensi kamar
4. Setiap pasien pulang ataupun masuk tolong buatkan update ketersediaan tempat tidur
5. Untuk button hapus pastikan ada dipojok kanan atas pada tiap show untuk applicare
6. Untuk ketersediaan kamar pastikan bisa dilihat di tiap row index applicare ya 

# TOLONG UPDATE CARA PENGGUNAAN APPLICARE DIBAWAH SINI!

---

## Cara Penggunaan Aplicare di SIMRS

### 1. Konfigurasi
- Buka menu **Integrasi > Konfigurasi** di SIMRS
- Pada bagian **BPJS Aplicare**, isi:
  - `cons_id` — Consumer ID BPJS
  - `secret_key` — Secret Key BPJS
  - `user_key` — User Key BPJS
  - `kode_ppk` — Kode Faskes RS
  - `environment` — `development` atau `production`
  - `base_url_dev` / `base_url_prod` — URL BPJS sesuai environment
- Jika belum diisi, Aplicare akan otomatis fallback ke config VClaim → Antrian

### 2. Navigasi
- Buka menu **BPJS > Aplicare** di sidebar
- Halaman menampilkan daftar ruangan yang sudah terdaftar di BPJS Aplicare

### 3. Mendaftarkan Ruangan Baru
- Klik tombol **"Daftarkan Ruangan"** di pojok kanan atas
- Pilih ruangan rawat inap SIMRS dari dropdown (hanya ruangan yang `has_bed = true`)
- Kode kelas BPJS di-mapping otomatis dari `room_class` SIMRS:
  - `vvip` → `VVP`, `vip` → `VIP`, `kelas_1` → `KL1`, `kelas_2` → `KL2`, `kelas_3` → `KL3`, `icu` → `ICU`
- Data kapasitas dan ketersediaan tempat tidur diambil langsung dari SIMRS
- Klik **"Daftarkan"** untuk mengirim ke BPJS via API `bed/create`

### 4. Melihat Ketersediaan
- Setiap baris ruangan menampilkan:
  - Nama ruangan, kode ruangan, kelas
  - **Kapasitas** — total tempat tidur
  - **Tersedia** — jumlah tempat tidur kosong
  - **Terisi** — jumlah tempat tidur yang digunakan
  - **Okupansi** — persentase penggunaan
  - Rincian per gender (jika tersedia)

### 5. Sinkronisasi Manual
- Klik tombol **refresh (↻)** pada baris ruangan untuk sinkronkan data ketersediaan dari SIMRS ke BPJS
- Ini memanggil API `bed/update` dengan data terkini dari database SIMRS

### 6. Update Otomatis
- Setiap kali pasien **masuk rawat inap** (admisi) → ketersediaan tempat tidur otomatis dikirim ke BPJS
- Setiap kali pasien **pulang** (disposisi) → ketersediaan tempat tidur otomatis dikirim ke BPJS
- Update dilakukan secara asinkron (background) sehingga tidak memperlambat proses utama
- Hook terpasang di:
  - `ProcessAdmissionRequest` — saat bed menjadi `occupied`
  - `SaveDisposition` — saat bed menjadi `available`
  - `createInpatientVisit` — saat pasien rawat inap dari UGD/Poli

### 7. Menghapus Ruangan
- Klik tombol **hapus (🗑)** di pojok kanan atas pada baris ruangan
- Konfirmasi penghapusan → ruangan dihapus dari BPJS Aplicare via API `bed/delete`
- Penghapusan di Aplicare tidak mempengaruhi data ruangan di SIMRS

### 8. Referensi Kelas
- Di bagian atas halaman, ditampilkan semua kode kelas kamar yang berlaku di BPJS
- Data ini diambil dari API `ref/kelas` saat halaman pertama kali dibuka

### API Endpoints Backend

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/bpjs/aplicare/ref-kelas` | Referensi kelas kamar |
| GET | `/api/bpjs/aplicare/bed?start=1&limit=100` | Baca ketersediaan dari BPJS |
| GET | `/api/bpjs/aplicare/rooms` | Daftar ruangan SIMRS (has_bed) |
| POST | `/api/bpjs/aplicare/bed/create` | Daftarkan ruangan ke Aplicare |
| POST | `/api/bpjs/aplicare/bed/update` | Update ketersediaan tempat tidur |
| POST | `/api/bpjs/aplicare/bed/delete` | Hapus ruangan dari Aplicare |

### Catatan
- Semua API log tercatat di **BPJS > Log API** dengan integration type `bpjs-aplicare`
- Auth menggunakan HMAC-SHA256 signature yang sama dengan VClaim/I-Care
- Service path: `{base_url}/aplicaresws/rest/...`