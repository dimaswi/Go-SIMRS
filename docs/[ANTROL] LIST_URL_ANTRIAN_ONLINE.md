# Referensi Poli :[GET] {BASE URL}/{Service Name}/ref/poli (Ambil semua data poli)
## Response :
{
    "metadata": {
        "code": 1,
        "message": "OK"
    },
    "response": {
        "list": [
            {
                "nmpoli": "AKUPUNTUR MEDIK",
                "nmsubspesialis": "AKUPUNTUR MEDIK",
                "kdsubspesialis": "AKP",
                "kdpoli": "AKP"
            },
            {
                "nmpoli": "ANAK",
                "nmsubspesialis": "ANAK ALERGI IMUNOLOGI",
                "kdsubspesialis": "027",
                "kdpoli": "ANA"
            }
        ]
    }
}  

# Referensi Dokter :[GET] {BASE URL}/{Service Name}/ref/dokter (Ambil semua data dokter)
## Response :
{
    "metadata": {
        "code": 1,
        "message": "OK"
    },
    "response": {
        "list": [
            {
                "namadokter": "drg. Kusumawati Sukadi, Sp.BM",
                "kodedokter": 700
            },
            {
                "namadokter": "Dr. Dr. Noer Rachma, Sp.KFR",
                "kodedokter": 854
            }
        ]
    }
}

# Referensi Jadwal Dokter : [GET] {BASE URL}/{Service Name}/jadwaldokter/kodepoli/{Parameter1}/tanggal/{Parameter2} (Ambil Jadwal Dokter Spesifik) Parameter1 = Kode Poli BPJS/Kode Ruangan Parameter2 = Tanggal dengan format 2021-08-07
## Response : 
{
    "response": {
        "list": [{
                "kodesubspesialis": "ANA",
                "hari": 4,
                "kapasitaspasien": 54,
                "libur": 0,
                "namahari": "KAMIS",
                "jadwal": "08:00 - 12:00",
                "namasubspesialis": "ANAK",
                "namadokter": "DR. OKTORA WAHYU WIJAYANTO, SP.A",
                "kodepoli": "ANA",
                "namapoli": "Anak",
                "kodedokter": 33690
            }, {
                "kodesubspesialis": "ANA",
                "hari": 4,
                "kapasitaspasien": 20,
                "libur": 0,
                "namahari": "KAMIS",
                "jadwal": "13:00 - 17:00",
                "namasubspesialis": "ANAK",
                "namadokter": "DR. OKTORA WAHYU WIJAYANTO, SP.A",
                "kodepoli": "ANA",
                "namapoli": "Anak",
                "kodedokter": 33690
            }
        ]
    },
    "metadata": {
        "message": "Ok",
        "code": 200
    }
}
     
# Referensi Poli Finger : [GET] {BASE URL}/{Service Name}/ref/poli/fp [SKIP]
## Response :
{
    "response": {
        "list": [{
            "kodesubspesialis": "027",
            "namasubspesialis": "Anak Alergi Imunologi",
            "kodepoli": "ANA",
            "namapoli": "ANAK"
            }
        ]
    },
    "metadata": {
        "message": "Ok",
        "code": 1
    }
}  

# Referensi Pasien Finger Print : [GET] {BASE URL}/{Service Name}/ref/pasien/fp/identitas/{nik/noka}/noidentitas/{noidentitas} [SKIP]
## Response :
{
    "response": {
        "nomorkartu": "0000000000031",
        "nik": "6748373747440003",
        "tgllahir": "2000-04-02",
        "daftarfp": 1
    },
    "metadata": {
        "message": "Ok",
        "code": 1
    }
}                   
      
# Update Jadwal Dokter : [POST] {BASE URL}/{Service Name}/jadwaldokter/updatejadwaldokter
## Request Body :
{
   "kodepoli": "{kode poli BPJS}",
   "kodesubspesialis": "{kode subspesialis BPJS}",
   "kodedokter": {kode dokter BPJS},
   "jadwal": [
      {
         "hari": "{1 (senin), 2 (selasa), 3 (rabu), 4 (kamis), 5 (jumat), 6 (sabtu), 7 (minggu), 8 (hari libur nasional)}",
         "buka": "{waktu}",
         "tutup": "{waktu}"
      },
      {
         "hari": "{1 (senin), 2 (selasa), 3 (rabu), 4 (kamis), 5 (jumat), 6 (sabtu), 7 (minggu), 8 (hari libur nasional)}",
         "buka": "{waktu}",
         "tutup": "{waktu}"
      }
   ]
}                        
## Response :
{
   "metadata": {
      "message": "Ok",
      "code": 200
   }
}

# Tambah Antrean : [POST] {BASE URL}/{Service Name}/antrean/add
## Request Body :
{
   "kodebooking": "{kodebooking yang dibuat unik}",
   "jenispasien": "{JKN / NON JKN}",
   "nomorkartu": "{noka pasien BPJS,diisi kosong jika NON JKN}",
   "nik": "{nik pasien}",
   "nohp": "{no hp pasien}",
   "kodepoli": "{memakai kode subspesialis BPJS}",
   "namapoli": "{nama poli}",
   "pasienbaru": {1(Ya),0(Tidak)},
   "norm": "{no rekam medis pasien}",
   "tanggalperiksa": "{tanggal periksa}",
   "kodedokter": {kode dokter BPJS},
   "namadokter": "{nama dokter}",
   "jampraktek": "{jam praktek dokter}",
   "jeniskunjungan": {1 (Rujukan FKTP), 2 (Rujukan Internal), 3 (Kontrol), 4 (Rujukan Antar RS)},
   "nomorreferensi": "{norujukan/kontrol pasien JKN,diisi kosong jika NON JKN}",
   "nomorantrean": "{nomor antrean pasien}",
   "angkaantrean": {angka antrean},
   "estimasidilayani": {waktu estimasi dilayani dalam miliseconds},
   "sisakuotajkn": {sisa kuota JKN},
   "kuotajkn": {kuota JKN},
   "sisakuotanonjkn": {sisa kuota non JKN},
   "kuotanonjkn": {kuota non JKN},
   "keterangan": "{informasi untuk pasien}"
}                        
## Response :
{
   "metadata": {
      "message": "Ok",
      "code": 200
   }
}

# Tambah Antrean Farmasi : [POST] {BASE URL}/{Service Name}/antrean/farmasi/add
## Request Body :
{
    "kodebooking": "16032021A001",
    "jenisresep": "racikan" ---> (racikan / non racikan),
    "nomorantrean": 1,
    "keterangan": ""
}
## Response :
{
    "metadata": {
        "message": "Ok",
        "code": 200
    }
}

# Update Waktu Antran/Task Id : [POST] {BASE URL}/{Service Name}/antrean/updatewaktu
## Request Body :
{
   "kodebooking": "16032021A001",
   "taskid": 1,
   "waktu": 1616559330000,
   "jenisresep": "Tidak ada/Racikan/Non racikan" ---> khusus yang sudah implementasi antrean farmasi
}
## Response Body :
{
   "metadata": {
      "message": "Ok",
      "code": 200
   }
}
## Catatan :
- Alur Task Id Pasien Baru: 1-2-3-4-5 (apabila ada obat tambah 6-7)
- Alur Task Id Pasien Lama: 3-4-5 (apabila ada obat tambah 6-7)
- Sisa antrean berkurang pada task 5
- Pemanggilan antrean poli pasien muncul pada task 4
- Cek in/mulai waktu tunggu untuk pasien baru mulai pada task 1
- Cek in/mulai waktu tunggu untuk pasien lama mulai pada task 3
- Agar terdapat validasi pada sistem RS agar alur pengiriman Task Id berurutan dari awal, dan waktu Task Id yang kecil lebih dulu daripada Task Id yang besar (misal task Id 1=08.00, task Id 2= 08.05)
- jenisresep : Tidak ada/Racikan/Non racikan (jenisresep khusus untuk rs yang sudah implementasi antrean farmasi. Jika belum/tidak kolom jenisresep dapat dihilangkan)

# Batal Antrean : [POST] {BASE URL}/{Service Name}/antrean/batal
## Request Body : 
{
   "kodebooking": "16032021A001",
   "keterangan": "Terjadi perubahan jadwal dokter, silahkan daftar kembali"
}
## Response :
{
   "metadata": {
      "message": "Ok",
      "code": 200
   }
}

# Ambil List Waktu Berdasarkan Kode Booking : [POST] {BASE URL}/{Service Name}/antrean/getlisttask
## Request Body :
{
   "kodebooking": "Y03-20#1617068533"
}
## Response :
{
   "response": {
      "list": [
         {
            "wakturs": "16-03-2021 11:32:49 WIB",
            "waktu": "24-03-2021 12:55:23 WIB",
            "taskname": "mulai waktu tunggu admisi",
            "taskid": 1,
            "kodebooking": "Y03-20#1617068533"
         }
      ]
   },
   "metadata": {
      "code": 200,
      "message": "OK"
   }
}

# Dashboard Per Tanggal : [GET] {Base URL}/{Service Name}/dashboard/waktutunggu/tanggal/{Parameter1 = tanggal format 2021-04-16}/waktu/{Parameter2 = diisi rs atau server}
## Response :
{
   "metadata": {
      "code": 200,
      "message": "OK"
   },
   "response": {
      "list": [
         {
            "kdppk": "1311R002",
            "waktu_task1": 0,
            "avg_waktu_task4": 0,
            "jumlah_antrean": 1,
            "avg_waktu_task3": 0,
            "namapoli": "BEDAH",
            "avg_waktu_task6": 0,
            "avg_waktu_task5": 0,
            "nmppk": "RSU AISYIYAH",
            "avg_waktu_task2": 0,
            "avg_waktu_task1": 0,
            "kodepoli": "BED",
            "waktu_task5": 0,
            "waktu_task4": 0,
            "waktu_task3": 0,
            "insertdate": 1627873951000,
            "tanggal": "2021-04-16",
            "waktu_task2": 0,
            "waktu_task6": 0
         }
      ]
   }
} 
## Catatan :
1. Waktu Task 1 = Waktu tunggu admisi dalam detik
2. Waktu Task 2 = Waktu layan admisi dalam detik
3. Waktu Task 3 = Waktu tunggu poli dalam detik
4. Waktu Task 4 = Waktu layan poli dalam detik
5. Waktu Task 5 = Waktu tunggu farmasi dalam detik
6. Waktu Task 6 = Waktu layan farmasi dalam detik
7. Insertdate = Waktu pengambilan data, timestamp dalam milisecond
8. Waktu server adalah data waktu (task 1-6) yang dicatat oleh server BPJS Kesehatan setelah RS mengimkan data, sedangkan waktu rs adalah data waktu (task 1-6) yang dikirimkan oleh RS

# Dashboard Per Bulan : [GET] {Base URL}/{Service Name}/dashboard/waktutunggu/bulan/{Parameter1 = bulan = 01}/tahun/{Parameter2 = tahun = 2021}/waktu/{Parameter3 = rs atau server}
## Response :
{
   "metadata": {
      "code": 200,
      "message": "OK"
   },
   "response": {
      "list": [
         {
            "kdppk": "1311R002",
            "waktu_task1": 0,
            "avg_waktu_task4": 0,
            "jumlah_antrean": 1,
            "avg_waktu_task3": 0,
            "namapoli": "BEDAH",
            "avg_waktu_task6": 0,
            "avg_waktu_task5": 0,
            "nmppk": "RSU AISYIYAH",
            "avg_waktu_task2": 0,
            "avg_waktu_task1": 0,
            "kodepoli": "BED",
            "waktu_task5": 0,
            "waktu_task4": 0,
            "waktu_task3": 0,
            "insertdate": 1627873951000,
            "tanggal": "2021-04-16",
            "waktu_task2": 0,
            "waktu_task6": 0
         }
      ]
   }
}                    
## Catatan :
1. Waktu Task 1 = Waktu tunggu admisi dalam detik
2. Waktu Task 2 = Waktu layan admisi dalam detik
3. Waktu Task 3 = Waktu tunggu poli dalam detik
4. Waktu Task 4 = Waktu layan poli dalam detik
5. Waktu Task 5 = Waktu tunggu farmasi dalam detik
6. Waktu Task 6 = Waktu layan farmasi dalam detik
7. Insertdate = Waktu pengambilan data, timestamp dalam milisecond
8. Waktu server adalah data waktu (task 1-6) yang dicatat oleh server BPJS Kesehatan setelah RS mengimkan data, sedangkan waktu rs adalah data waktu (task 1-6) yang dikirimkan oleh RS

# Antran Per Tanggal : [GET] {BASE URL}/{Service Name}/antrean/pendaftaran/tanggal/{tanggal = 2021-02-16}
## Response :
{
    "response": {
        "list": [
            {
                "kodebooking": "ABC0000001",
                "tanggal": "2021-03-24",
                "kodepoli": "INT",
                "kodedokter": 1234,
                "jampraktek": "08:00-17:00",
                "nik": "2749494383830001",
                "nokapst": "0000000000013",
                "nohp": "081234567890",
                "norekammedis": "654321",
                "jeniskunjungan": 1,
                "nomorreferensi": "1029R0021221K000012",
                "sumberdata": "Mobile JKN",
                "ispeserta": 1,
                "noantrean": "INT-0001",
                "estimasidilayani": 1669278161000,
                "createdtime": 1669278161000,
                "status": "Selesai dilayani"
            }
        ]
    },
    "metadata": {
        "code": 200,
        "message": "OK"
    }
}

# Antrean Per Kode Booking : [GET] {BASE URL}/{Service Name}/antrean/pendaftaran/kodebooking/{kodebooking}
## Response :
{
    "response": {
        "list": [
            {
                "kodebooking": "ABC0000001",
                "tanggal": "2021-03-24",
                "kodepoli": "INT",
                "kodedokter": 1234,
                "jampraktek": "08:00-17:00",
                "nik": "2749494383830001",
                "nokapst": "0000000000013",
                "nohp": "081234567890",
                "norekammedis": "654321",
                "jeniskunjungan": 1,
                "nomorreferensi": "1029R0021221K000012",
                "sumberdata": "Mobile JKN",
                "ispeserta": 1,
                "noantrean": "INT-0001",
                "estimasidilayani": 1669278161000,
                "createdtime": 1669278161000,
                "status": "Selesai dilayani"
            }
        ]
    },
    "metadata": {
        "code": 200,
        "message": "OK"
    }
}
  
# Antrean Belum Dilayani : [GET] {BASE URL}/{Service Name}/antrean/pendaftaran/aktif
## Response :                                   
{
    "response": {
        "list": [
            {
                "kodebooking": "ABC0000001",
                "tanggal": "2021-03-24",
                "kodepoli": "INT",
                "kodedokter": 1234,
                "jampraktek": "08:00-17:00",
                "nik": "2749494383830001",
                "nokapst": "0000000000013",
                "nohp": "081234567890",
                "norekammedis": "654321",
                "jeniskunjungan": 1,
                "nomorreferensi": "1029R0021221K000012",
                "sumberdata": "Mobile JKN",
                "ispeserta": 1,
                "noantrean": "INT-0001",
                "estimasidilayani": 1669278161000,
                "createdtime": 1669278161000,
                "status": "Selesai dilayani"
            }
        ]
    },
    "metadata": {
        "code": 200,
        "message": "OK"
    }
}

# Antrean Belum Dilayani Per Poli Per Dokter Per Hari Per Jam Praktek : [GET] {BASE URL}/{Service Name}/antrean/pendaftaran/kodepoli/{kodepoli}/kodedokter/{kodedokter}/hari/{hari}/jampraktek/{jampraktek} [SKIP]
## Response : 
{
    "response": {
        "list": [
            {
                "kodebooking": "ABC0000001",
                "tanggal": "2021-03-24",
                "kodepoli": "INT",
                "kodedokter": 1234,
                "jampraktek": "08:00-17:00",
                "nik": "2749494383830001",
                "nokapst": "0000000000013",
                "nohp": "081234567890",
                "norekammedis": "654321",
                "jeniskunjungan": 1,
                "nomorreferensi": "1029R0021221K000012",
                "sumberdata": "Mobile JKN",
                "ispeserta": 1,
                "noantrean": "INT-0001",
                "estimasidilayani": 1669278161000,
                "createdtime": 1669278161000,
                "status": "Selesai dilayani"
            }
        ]
    },
    "metadata": {
        "code": 200,
        "message": "OK"
    }
}
