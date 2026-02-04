1. Token 
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Membuat token
Method : GET
Format : Json
Header :
        x-username: {user akses}
        x-password: {password akses}
Response : 
{
    "response": {
        "token": "1231242353534645645"
    },
    "metadata": {
        "message": "Ok",
        "code": 200
    }
} 
Catatan: User dan password yang diberikan ke BPJS Kesehatan untuk mengakses WS yang dibuat oleh RS.

2. Status Antrean
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Menampilkan status antrean per poli (digunakan untuk perencanaan kedatangan pasien)
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request : 
{
   "kodepoli": "ANA",
   "kodedokter": 12346,
   "tanggalperiksa": "2020-01-28",
   "jampraktek": "08:00-16:00"
}
Response :                                         
{
   "response": {
      "namapoli": "Anak",
      "namadokter": "Dr. Hendra",
      "totalantrean": 25,
      "sisaantrean": 4,
      "antreanpanggil": "A-21",
      "sisakuotajkn": 5,
      "kuotajkn": 30,
      "sisakuotanonjkn": 5,
      "kuotanonjkn": 30,
      "keterangan": ""
   },
   "metadata": {
      "message": "Ok",
      "code": 200
   }
}
Catatan:
    Metadata code:
    200: Sukses
    201: Gagal
    Selain metadata code 200, agar message pada metadata diisi sesuai dengan kondisi di lapangan

3. Ambil Antrean
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Mengambil antrean
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request :
{
    "nomorkartu": "00012345678",
    "nik": "3212345678987654",
    "nohp": "085635228888",
    "kodepoli": "ANA",
    "norm": "123345",
    "tanggalperiksa": "2021-01-28",
    "kodedokter": 12345,
    "jampraktek": "08:00-16:00",
    "jeniskunjungan": 1,
    "nomorreferensi": "0001R0040116A000001"
}
Response : 
{
   "response": {
      "nomorantrean": "A-12",
      "angkaantrean": 12,
      "kodebooking": "16032021A001",
      "norm": "123345",
      "namapoli": "Anak",
      "namadokter": "Dr. Hendra",
      "estimasidilayani": 1615869169000,
      "sisakuotajkn": 5,
      "kuotajkn": 30,
      "sisakuotanonjkn": 5,
      "kuotanonjkn": 30,
      "keterangan": "Peserta harap 60 menit lebih awal guna pencatatan administrasi."
   },
   "metadata": {
      "message": "Ok",
      "code": 200
   }
}
Catatan:
    estimasidilayani : format dalam milisecond
    Metadata code:
    200: Sukses
    201: Gagal
    202: Pasien Baru
    Ketika RS merespon code 202, mobile JKN akan mengirimkan data pasien baru (hit WS Info Pasien Baru).

4. Sisa Antrean
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Melihat sisa antrean di hari H pelayanan
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request :
{
    "kodebooking": "{kodebooking yang unik yang diambil dari WS Ambil Antrean}"
}
Response :
{
   "response": {
      "nomorantrean": "A20",
      "namapoli": "Anak",
      "namadokter": "Dr. Hendra",
      "sisaantrean": 12,
      "antreanpanggil": "A-8",
      "waktutunggu": 9000,
      "keterangan": ""
   },
   "metadata": {
      "message": "Ok",
      "code": 200
   }
}
Catatan:
    - Format waktu dalam detik dengan formula: SPM * (sisa antrean-1)
    - Metadata code:
    200: Sukses
    201: Gagal
    Selain metadata code 200, agar message pada metadata diisi sesuai dengan kondisi di lapangan
  
5. Batal Antrean
URL : {BASE URL}/antrean/batal
Fungsi : Membatalkan antrean pasien
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request :
{
   "kodebooking": "16032021A001",
   "keterangan": "Ada kebutuhan mendadak"
}
Response : 
{
   "metadata": {
      "message": "Ok",
      "code": 200
   }
}
Catatan:
    - Format waktu dalam detik dengan formula: SPM * (sisa antrean-1)
    - Metadata code:
    200: Sukses
    201: Gagal
    Selain metadata code 200, agar message pada metadata diisi sesuai dengan kondisi di lapangan

6. Check-In
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Memastikan pasien sudah datang di RS
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request : 
{
    "kodebooking": "16032021A001",
    "waktu": 1616559330000
}
Response :
{
   "metadata": {
      "code": 200,
      "message": "OK"
   }
}
Catatan:
    Metadata code:
    200: Sukses
    201: Gagal
    Selain metadata code 200, agar message pada metadata diisi sesuai dengan kondisi di lapangan.

7. Info Pasien Baru (Cek kesesuaian dengan master pasien)
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Informasi identitas pasien baru yang belum punya rekam medis (tidak ada norm di Aplikasi VClaim)
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request : 
{
   "nomorkartu": "00012345678",
   "nik": "3212345678987654",
   "nomorkk": "3212345678987654",
   "nama": "sumarsono",
   "jeniskelamin": "L",
   "tanggallahir": "1985-03-01",
   "nohp": "085635228888",
   "alamat": "alamat yang muncul merupakan alamat lengkap",
   "kodeprop": "11",
   "namaprop": "Jawa Barat",
   "kodedati2": "0120",
   "namadati2": "Kab. Bandung",
   "kodekec": "1319",
   "namakec": "Soreang",
   "kodekel": "D2105",
   "namakel": "Cingcin",
   "rw": "001",
   "rt": "013"
}
Response : 
{
   "response": {
      "norm": "123456"
   },
   "metadata": {
      "message": "Harap datang ke admisi untuk melengkapi data rekam medis",
      "code": 200
   }
}
Catatan:
    Metadata code:
    200: Sukses
    201: Gagal
    Selain metadata code 200, agar message pada metadata diisi sesuai dengan kondisi di lapangan.

8. Jadwal Operasi RS
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Informasi jadwal operasi di rumah sakit
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request : 
{
    "tanggalawal": "2019-12-11",
    "tanggalakhir": "2019-12-13"
}
Response :
{
    "response": {
        "list" : [{
             "kodebooking": "123456ZXC",
             "tanggaloperasi": "2019-12-11",
             "jenistindakan": "operasi gigi",
             "kodepoli": "001",
             "namapoli": "Poli Bedah Mulut",
             "terlaksana": 1,
             "nopeserta": "0000000924782",
             "lastupdate": 1577417743000 
        },
        {
             "kodebooking": "67890QWE",
             "tanggaloperasi": "2019-12-11",
             "jenistindakan": "operasi mulut",
             "kodepoli": "001",
             "namapoli": "Poli Bedah Mulut",
             "terlaksana": 0,
             "nopeserta": "",
             "lastupdate": 1577417743000
        }]
    },
    "metadata": {
        "message": "Ok",
        "code": 200
    }
}
Catatan:
    - Kode poli memakai kode subspesialis BPJS
    - Metadata code:
    200: Sukses
    201: Gagal
    Selain metadata code 200, agar message pada metadata diisi sesuai dengan kondisi di lapangan.

9. Jadwal Operasi Pasien
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Informasi jadwal operasi per pasien
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request :                                   
{
    "nopeserta": "0000000000123"
}
Response :
{
    "response": {
        "list" : [{
             "kodebooking": "123456ZXC",
             "tanggaloperasi": "2019-12-11",
             "jenistindakan": "operasi gigi",
             "kodepoli": "001",
             "namapoli": "Poli Bedah Mulut",
             "terlaksana": 0 
        }]
    },
    "metadata": {
        "message": "Ok",
        "code": 200
    }
}
Catatan:
    - Kode poli memakai kode subspesialis BPJS
    - Metadata code:
    200: Sukses
    201: Gagal
    Selain metadata code 200, agar message pada metadata diisi sesuai dengan kondisi di lapangan

10. Ambil Antrean Farmasi
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Mengambil antrean farmasi
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request : 
{
    "kodebooking": "00012345678"
}
Response :
{
    "response": {
        "jenisresep": "Racikan/Non Racikan",
        "nomorantrean": 1,
        "keterangan": ""
    },
    "metadata": {
        "message": "Ok",
        "code": 200
    }
}
Catatan :
kodebooking dari ambil antrean


11. Status Antrean Farmasi
URL : RS mengirimkan url masing-masing ws yang sudah dibuat untuk diakses oleh sistem BPJS
Fungsi : Mengetahui status antrean farmasi
Method : POST
Format : Json
Header :
        x-token: {token}
        x-username: {user akses}
Request :                           
{
    "kodebooking": "00012345678"
}
Response : 
{
    "response": {
        "jenisresep": "Racikan/Non Racikan",
        "totalantrean": 10,
        "sisaantrean": 8,
        "antreanpanggil": 2,
        "keterangan": ""
    },
    "metadata": {
        "message": "Ok",
        "code": 200
    }
}
Catatan :
kodebooking dari ambil antrean