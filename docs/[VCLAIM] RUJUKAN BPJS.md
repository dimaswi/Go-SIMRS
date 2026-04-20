# URL, REQUEST, DAN RESPONSE UNTUK RUJUKAN

## URL : IKUT VCLAIM

## [POST] INSERT RUJUKAN V1 : {BASE URL}/{Service Name}/Rujukan/insert
Request :
```
{
    "request": {
        "t_rujukan": {
            "noSep": "{nomor sep}",
            "tglRujukan": "{tanggal rujukan format : yyyy-mm-dd}",
            "ppkDirujuk": "{faskes dirujuk -> data di referensi faskes}",
            "jnsPelayanan": "{jenis pelayanan -> 1.R.Inap 2.R.Jalan}",
            "catatan": "{catatan rujukan}",
            "diagRujukan": "{kode diagnosa rujukan -> data di referensi diagnosa}",
            "tipeRujukan": "{tipe rujukan -> 0.penuh, 1.Partial 2.rujuk balik}",
            "poliRujukan": "{kode poli rujukan -> data di referensi poli}",
            "user": "{user pemakai}"
        }
    }
}                  
     
```
Response :
```
{
  "metaData": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "rujukan": {
      "AsalRujukan": {
        "kode": "0301R001",
        "nama": "RSUP DR M JAMIL PADANG"
      },
      "diagnosa": {
        "kode": "A00.1",
        "nama": "A00.1 - Cholera due to Vibrio cholerae 01, biovar eltor"
      },
      "noRujukan": "0301R0011117B001126",
      "peserta": {
        "asuransi": "-",
        "hakKelas": null,
        "jnsPeserta": "PNS PUSAT",
        "kelamin": "Laki-Laki",
        "nama": "ZIYADUL",
        "noKartu": "0000000110156",
        "noMr": "123456",
        "tglLahir": "2008-02-05"
      },
      "poliTujuan": {
        "kode": "INT",
        "nama": "Poli Penyakit Dalam"
      },
      "tglRujukan": "2017-11-08",
      "tujuanRujukan": {
        "kode": "0301R002",
        "nama": "RS JIWA ULU GADUT"
      }
    }
  }
}
```

Catatan : untuk tipe rujukan 1 maka response adalah null

## [PUT] UPDATE RUJUKAN V1 : {BASE URL}/{Service Name}/Rujukan/update

Request :
```
{
  "request": {
    "t_rujukan": {
      "noRujukan": "{nomor rujukan}",
      "ppkDirujuk": "{faskes dirujuk -> data di referensi faskes}",
      "tipe": "{tipe rujukan -> 0.penuh, 1.Partial 2.rujuk balik}",
      "jnsPelayanan": "{jenis pelayanan -> 1.R.Inap 2.R.Jalan}",
      "catatan": "{catatan rujukan}",
      "diagRujukan": "{kode diagnosa rujukan -> data di referensi diagnosa}",
      "tipeRujukan": "{tipe rujukan -> 0.penuh, 1.Partial 2.rujuk balik}",
      "poliRujukan": "{kode poli rujukan -> data di referensi poli}",
      "user": "{user pemakai}"
    }
  }
}
```

Response :
```
{
  "metaData": {
    "code": "200",
    "message": "OK"
  },
  "response": 0301R0011117B000014
}
```

## [POST] INSERT RUJUKAN V2 : {BASE URL}/{Service Name}/Rujukan/2.0/insert
Request :
```
{
  "request": {
    "t_rujukan": {
      "noSep": "{nomor sep}",
      "tglRujukan": "{tanggal rujukan, format : yyyy-MM-dd}",
      "tglRencanaKunjungan": "{tanggal rencana kunjungan, format : yyyy-MM-dd}",
      "ppkDirujuk": "{kode faskes, 8 digit}",
      "jnsPelayanan": "{1-> rawat inap, 2-> rawat jalan}",
      "catatan": "{catatan}",
      "diagRujukan": "{kode diagnosa}",
      "tipeRujukan": "{0->Penuh, 1->Partial, 2->balik PRB}",
      "poliRujukan": "{kosong untuk tipe rujukan 2, harus diisi jika 0 atau 1}",
      "user": "{user ws}"
    }
  }
}
```

Response :
```
{
  "metaData": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "rujukan": {
      "AsalRujukan": {
        "kode": "0301R001d",
        "nama": "RSUP DR M JAMIL PADANG"
      },
      "diagnosa": {
        "kode": "A15",
        "nama": "A15 - Respiratory tuberculosis, bacteriologically and histologically confirmed"
      },
      "noRujukan": "0301R0010321B000012",
      "peserta": {
        "asuransi": "-",
        "hakKelas": null,
        "jnsPeserta": "PBI (APBD)",
        "kelamin": "Laki-Laki",
        "nama": "FADLAN LISMI AZIZ",
        "noKartu": "0001329783085",
        "noMr": "00754610",
        "tglLahir": "2006-02-20"
      },
      "poliTujuan": {
        "kode": "",
        "nama": ""
      },
      "tglBerlakuKunjungan": "2021-06-16",
      "tglRencanaKunjungan": "2021-03-19",
      "tglRujukan": "2021-03-18",
      "tujuanRujukan": {
        "kode": "03010402",
        "nama": "PEGAMBIRAN"
      }
    }
  }
}
```

## [PUT] UPDATE RUJUKAN V2 : {BASE URL}/{Service Name}/Rujukan/2.0/Update
Request : 
```
{
  "request": {
    "t_rujukan": {
      "noRujukan": "{nomor rujukan}",
      "tglRujukan": "{tanggal rujukan, format : yyyy-MM-dd}",
      "tglRencanaKunjungan": "{tanggal rencana kunjungan, format : yyyy-MM-dd}",
      "ppkDirujuk": "{kode faskes, 8 digit}",
      "jnsPelayanan": "{1-> rawat inap, 2-> rawat jalan}",
      "catatan": "{catatan}",
      "diagRujukan": "{kode diagnosa}",
      "tipeRujukan": "{0->Penuh, 1->Partial, 2->balik PRB}",
      "poliRujukan": "{kosong untuk tipe rujukan 2, harus diisi jika 0 atau 1}",
      "user": "{user ws}"
    }
  }
}
```

Response : 
```
{
    "metaData": {
        "code": "200",
        "message": "OK"
    },
    "response": "0301R0011117B000014" 
}
```

## [DELETE] DELETE RUJUKAN V1 DAN V2 : {BASE URL}/{Service Name}/Rujukan/delete
Request :
```
{
  "request": {
    "t_rujukan": {
      "noRujukan": "0301R0011117B000015",
      "user": "Coba Ws"
    }
  }
}
```

Response :
```
{
  "metaData": {
    "code": "200",
    "message": "OK"
  },
  "response": 0301R0011117B000014
}
```

## [GET] LIST SPESIALITSTIK RUJUKAN : {BASE URL}/{Service Name}/Rujukan/ListSpesialistik/PPKRujukan/{parameter 1}/TglRujukan/{parameter 2}
Parameter 1: Kode PPK Rujukan : 8 digit

Parameter 2: Tanggal rujukan format : yyyy-MM-dd

Response :
```
{
  "metaData": {
    "code": "200",
    "message": "Ok"
  },
  "response": {
    "list": [
      {
        "kodeSpesialis": "005",
        "namaSpesialis": "Gastroenterologi-Hepatologi ",
        "kapasitas": "0",
        "jumlahRujukan": "0",
        "persentase": "0,00"
      },
      {
        "kodeSpesialis": "006",
        "namaSpesialis": "Geriatri ",
        "kapasitas": "0",
        "jumlahRujukan": "0",
        "persentase": "0,00"
      },
      {
        "kodeSpesialis": "007",
        "namaSpesialis": "Ginjal-Hipertensi ",
        "kapasitas": "0",
        "jumlahRujukan": "0",
        "persentase": "0,00"
      },
      {
        "kodeSpesialis": "008",
        "namaSpesialis": "Hematologi - Onkologi Medik ",
        "kapasitas": "0",
        "jumlahRujukan": "0",
        "persentase": "0,00"
      },
      {
        "kodeSpesialis": "010",
        "namaSpesialis": "Endokrin-Metabolik-Diabetes",
        "kapasitas": "0",
        "jumlahRujukan": "0",
        "persentase": "0,00"
      },
      {
        "kodeSpesialis": "017",
        "namaSpesialis": "Bedah Onkologi ",
        "kapasitas": "0",
        "jumlahRujukan": "0",
        "persentase": "0,00"
      },
      {
        "kodeSpesialis": "018",
        "namaSpesialis": "Bedah Digestif ",
        "kapasitas": "0",
        "jumlahRujukan": "0",
        "persentase": "0,00"
      },
      {
        "kodeSpesialis": "020",
        "namaSpesialis": "fetomaternal",
        "kapasitas": "0",
        "jumlahRujukan": "0",
        "persentase": "0,00"
      },
      {
        "kodeSpesialis": "021",
        "namaSpesialis": "onkologi ginekologi",
        "kapasitas": "0",
        "jumlahRujukan": "0",
        "persentase": "0,00"
      }
    ]
  }
}
```

## [GET] LIST SARANA : {BASE URL}/{Service Name}/Rujukan/ListSarana/PPKRujukan/{parameter 1}
Parameter 1: Kode PPK Rujukan : 8 digit

Response : 
```
{
    "metaData": {
        "code": "200",
        "message": "Ok"
    },
    "response": {
        "list": [
                    {
                        "kodeSarana": "1",
                        "namaSarana": "Rekam Medik"
                    },
                    {
                        "kodeSarana": "2",
                        "namaSarana": "Laboratorium"
                    },
                    {
                        "kodeSarana": "3",
                        "namaSarana": "Radiologi"
                    },
                    {
                        "kodeSarana": "4",
                        "namaSarana": "CT Scan"
                    },
                    {
                        "kodeSarana": "12",
                        "namaSarana": "CT Scan Kepala leher"
                    },
                    {
                        "kodeSarana": "5",
                        "namaSarana": "MRI/Magnetic Resonance Imaging"
                    },
                    {
                        "kodeSarana": "25",
                        "namaSarana": "Venografi"
                    },
                    {
                        "kodeSarana": "6",
                        "namaSarana": "Hemodialisa"
                    },
                    {
                        "kodeSarana": "7",
                        "namaSarana": "Farmasi"
                    },
                    {
                        "kodeSarana": "8",
                        "namaSarana": "Pelayanan Darah"
                    },
                    {
                        "kodeSarana": "10",
                        "namaSarana": "Pemulasaran Jenasah"
                    },
                    {
                        "kodeSarana": "13",
                        "namaSarana": "MRI Kepala leher"
                    },
                    {
                        "kodeSarana": "15",
                        "namaSarana": "USG (Doppler) daerah leher "
                    },
                    {
                        "kodeSarana": "58",
                        "namaSarana": "BNO IVP"
                    },
                    {
                        "kodeSarana": "9",
                        "namaSarana": "Ambulan"
                    },
                    {
                        "kodeSarana": "11",
                        "namaSarana": "Radiografi konvensional"
                    },
                    {
                        "kodeSarana": "14",
                        "namaSarana": "Dakriosistografi (kelenjar air mata)"
                    },
                ]
        }
    }
```

## [POST] INSERT RUJUKAN KHUSUS : {BASE URL}/{Service Name}/Rujukan/Khusus/insert

Request :
```
{
  "noRujukan": "{norujukan}",
  "diagnosa": [
    {
      "kode": "{primer/sekunder};{kodediagnosa}"
    }
  ],
  "procedure": [
    {
      "kode": "{kodeprocedure}"
    }
  ],
  "user": "{user ws}"
}
```

Response : 
```
{
  "metaData": {
    "code": "200",
    "message": "Sukses"
  },
  "response": {
    "rujukan": {
      "norujukan": "0301U0331019P003283",
      "nokapst": "0000016553957",
      "nmpst": "MUZNI MUKHTAR",
      "diagppk": "Z49.1",
      "tglrujukan_awal": "2021-06-20",
      "tglrujukan_berakhir": "2021-09-17"
    }
  }
}
```

## [DELETE] DELETE RUJUKAN KHUSUS : {BASE URL}/{Service Name}/Rujukan/Khusus/delete

Request :
```
{
  "request": {
    "t_rujukan": {
      "idRujukan": "{id rujukan}",
      "noRujukan": "{nomor rujukan}",
      "user": "{user ws}"
    }
  }
}
```

Response :
```
{
  "metaData": {
    "code": "200",
    "message": "OK"
  },
  "response": "98865"
}
```