1. GET PESERTA BY NOMOR KARTU BPJS : https://apijkn-dev.bpjs-kesehatan.go.id/vclaim-rest-dev/Peserta/nokartu/{parameter 1}/tglSEP/{parameter 2}
Fungsi : Pencarian data peserta BPJS Kesehatan
Method : GET
Format : Json
Content-Type: application/json; charset=utf-8
Parameter 1 : Nomor Kartu
Parameter 2 : Tanggal Pelayanan/SEP - format : yyyy-MM-dd
Response :
{
   "metaData":{
      "code":"200",
      "message":"OK"
   },
   "response":{
      "peserta":{
         "cob":{
            "nmAsuransi":null,
            "noAsuransi":null,
            "tglTAT":null,
            "tglTMT":null
         },
         "hakKelas":{
            "keterangan":"KELAS I",
            "kode":"1"
         },
         "informasi":{
            "dinsos":null,
            "noSKTM":null,
            "prolanisPRB":null
         },
         "jenisPeserta":{
            "keterangan":"PEGAWAI SWASTA",
            "kode":"13"
         },
         "mr":{
            "noMR":null,
            "noTelepon":null
         },
         "nama":"TRI M",
         "nik":"3319022010810007",
         "noKartu":"0011336526592",
         "pisa":"1",
         "provUmum":{
            "kdProvider":"0138U020",
            "nmProvider":"KPRJ PALA MEDIKA"
         },
         "sex":"L",
         "statusPeserta":{
            "keterangan":"AKTIF",
            "kode":"0"
         },
         "tglCetakKartu":"2016-02-12",
         "tglLahir":"1981-10-10",
         "tglTAT":"2014-12-31",
         "tglTMT":"2008-10-01",
         "umur":{
            "umurSaatPelayanan":"35 tahun ,1 bulan ,11 hari",
            "umurSekarang":"35 tahun ,2 bulan ,10 hari"
         }
      }
   }
}

2. GET PESERTA BY NIK : https://apijkn-dev.bpjs-kesehatan.go.id/vclaim-rest-dev/Peserta/nik/{parameter 1}/tglSEP/{parameter 2}
Fungsi : Pencarian data peserta berdasarkan NIK Kependudukan
Method : GET
Format : Json
Content-Type: application/json; charset=utf-8
Parameter 1 : NIK KTP
Parameter 2 : Tanggal Pelayanan/SEP - format : yyyy-MM-dd
Response :
{
   "metaData":{
      "code":"200",
      "message":"OK"
   },
   "response":{
      "peserta":{
         "cob":{
            "nmAsuransi":null,
            "noAsuransi":null,
            "tglTAT":null,
            "tglTMT":null
         },
         "hakKelas":{
            "keterangan":"KELAS I",
            "kode":"1"
         },
         "informasi":{
            "dinsos":null,
            "noSKTM":null,
            "prolanisPRB":null
         },
         "jenisPeserta":{
            "keterangan":"PEGAWAI SWASTA",
            "kode":"13"
         },
         "mr":{
            "noMR":null,
            "noTelepon":null
         },
         "nama":"TRI M",
         "nik":"3319022010810007",
         "noKartu":"0011336526592",
         "pisa":"1",
         "provUmum":{
            "kdProvider":"0138U020",
            "nmProvider":"KPRJ PALA MEDIKA"
         },
         "sex":"L",
         "statusPeserta":{
            "keterangan":"AKTIF",
            "kode":"0"
         },
         "tglCetakKartu":"2016-02-12",
         "tglLahir":"1981-10-10",
         "tglTAT":"2014-12-31",
         "tglTMT":"2008-10-01",
         "umur":{
            "umurSaatPelayanan":"35 tahun ,1 bulan ,11 hari",
            "umurSekarang":"35 tahun ,2 bulan ,10 hari"
         }
      }
   }
}

3. INSERT SEP : https://apijkn-dev.bpjs-kesehatan.go.id/vclaim-rest-dev/SEP/2.0/insert
Fungsi : Insert SEP versi 2.0
Method : POST
Format : Json
Content-Type: Application/x-www-form-urlencoded
Request : 
{
    "request":{
        "t_sep":{
                "noKartu":"{nokartu BPJS}",
                "tglSep":"{tanggal penerbitan sep format yyyy-mm-dd}",
                "ppkPelayanan":"{kode faskes pemberi pelayanan}",
                "jnsPelayanan":"{jenis pelayanan = 1. r.inap 2. r.jalan}",
                "klsRawat":{
                "klsRawatHak":"{sesuai kelas rawat peserta, 1. Kelas 1, 2. Kelas 2, 3. Kelas 3}",
                "klsRawatNaik":"{diisi jika naik kelas rawat, 1. VVIP, 2. VIP, 3. Kelas 1, 4. Kelas 2, 5. Kelas 3, 6. ICCU, 7ICU, 8. Diatas Kelas 1}",
                "pembiayaan":"{1. Pribadi, 2. Pemberi Kerja, 3. Asuransi Kesehatan Tambahan. diisi jika naik kelas rawat}",
                "penanggungJawab":"{Contoh: jika pembiayaan 1 maka penanggungJawab=Pribadi. diisi jika naik kelas rawat}"
            },
            "noMR":"{nomor medical record RS}",
            "rujukan":{
                "asalRujukan":"{asal rujukan ->1.Faskes 1, 2. Faskes 2(RS)}",
                "tglRujukan":"{tanggal rujukan format: yyyy-mm-dd}",
                "noRujukan":"{nomor rujukan}",
                "ppkRujukan":"{kode faskes rujukam -> baca di referensi faskes}"
            },
            "catatan":"{catatan peserta}",
            "diagAwal":"{diagnosa awal ICD10 -> baca di referensi diagnosa}",
            "poli":{
                "tujuan":"{kode poli -> baca di referensi poli}",
                "eksekutif":"{poli eksekutif -> 0. Tidak 1.Ya}""
                },
            "cob":{
                "cob":"{cob -> 0.Tidak 1. Ya}"
                },
            "katarak":{
            "katarak":"{katarak --> 0.Tidak 1.Ya}"
            },
            "jaminan":{
                "lakaLantas":" 0 : Bukan Kecelakaan lalu lintas [BKLL], 1 : KLL dan bukan kecelakaan Kerja [BKK], 2 : KLL daKK, 3 : KK",
                "noLP":"{No. LP}",
                "penjamin":{
                    "tglKejadian":"{tanggal kejadian KLL format: yyyy-mm-dd}",
                    "keterangan":"{Keterangan Kejadian KLL}",
                    "suplesi":{
                        "suplesi":"{Suplesi --> 0.Tidak 1. Ya}",
                        "noSepSuplesi":"{No.SEP yang Jika Terdapat Suplesi}",
                        "lokasiLaka":{
                            "kdPropinsi":"{Kode Propinsi}",
                            "kdKabupaten":"{Kode Kabupaten}",
                            "kdKecamatan":"{Kode Kecamatan}"
                        }
                    }
                }
            },
            "tujuanKunj":{"0": Normal, 
                        "1": Prosedur, 
                        "2": Konsul Dokter},
            "flagProcedure":{"0": Prosedur Tidak Berkelanjutan, 
                            "1": Prosedur dan Terapi Berkelanjutan} ==> diisi "" jika tujuanKunj = "0",
            "kdPenunjang":{"1": Radioterapi, 
                        "2": Kemoterapi, 
                        "3": Rehabilitasi Medik, 
                        "4": Rehabilitasi Psikososial, 
                        "5": Transfusi Darah, 
                        "6": Pelayanan Gigi, 
                        "7": Laboratorium, 
                        "8": USG, 
                        "9": Farmasi, 
                        "10": Lain-Lain, 
                        "11": MRI, 
                        "12": HEMODIALISA} ==> diisi "" jika tujuanKunj = "0",
            "assesmentPel":{"1": Poli spesialis tidak tersedia pada hari sebelumnya, 
                            "2": Jam Poli telah berakhir pada hari sebelumnya, 
                            "3": Dokter Spesialis yang dimaksud tidak praktek pada hari sebelumnya, 
                            "4": Atas Instruksi RS} ==> diisi jika tujuanKunj = "2" atau "0" (politujuan beda dengan polrujukan dan hari beda),
                            "5": Tujuan Kontrol,
            "skdp":{
            "noSurat":"{Nomor Surat Kontrol}",
            "kodeDPJP":"{kode dokter DPJP --> baca di referensi dokter DPJP}"
            },
            "dpjpLayan":"000002", (tidak diisi jika jnsPelayanan = "1" (RANAP)),
            "noTelp":"{nomor telepon}",
            "user":"{user pembuat SEP}"
        }
    }
}
Response :
        {
           "metaData":{
              "code":"200",
              "message":"OK"
           },
           "response":{
              "peserta":{
                 "cob":{
                    "nmAsuransi":null,
                    "noAsuransi":null,
                    "tglTAT":null,
                    "tglTMT":null
                 },
                 "hakKelas":{
                    "keterangan":"KELAS I",
                    "kode":"1"
                 },
                 "informasi":{
                    "dinsos":null,
                    "noSKTM":null,
                    "prolanisPRB":null
                 },
                 "jenisPeserta":{
                    "keterangan":"PEGAWAI SWASTA",
                    "kode":"13"
                 },
                 "mr":{
                    "noMR":null,
                    "noTelepon":null
                 },
                 "nama":"TRI M",
                 "nik":"3319022010810007",
                 "noKartu":"0011336526592",
                 "pisa":"1",
                 "provUmum":{
                    "kdProvider":"0138U020",
                    "nmProvider":"KPRJ PALA MEDIKA"
                 },
                 "sex":"L",
                 "statusPeserta":{
                    "keterangan":"AKTIF",
                    "kode":"0"
                 },
                 "tglCetakKartu":"2016-02-12",
                 "tglLahir":"1981-10-10",
                 "tglTAT":"2014-12-31",
                 "tglTMT":"2008-10-01",
                 "umur":{
                    "umurSaatPelayanan":"35 tahun ,1 bulan ,11 hari",
                    "umurSekarang":"35 tahun ,2 bulan ,10 hari"
                 }
              }
           }
        }

2. FASKES [GET]
URL : {Base URL}/{Service Name}/referensi/faskes/{Parameter 1}/{Parameter 2}Parameter 1 : nama atau kode faskes
Parameter 2 : Jenis Faskes (1. Faskes 1, 2. Faskes 2/RS)
Response : 
{
  "metaData": {
    "code": "200",
    "message": "Sukses"
  },
  "response": {
    "faskes": [
      {
        "kode": "00161001",
        "nama": "PUSKESMAS SANGIRAN - KAB. SIMEULUE"
      },
      {
        "kode": "00161002",
        "nama": "PUSKESMAS SIMEULUE - KAB. SIMEULUE"
      }
    ]
  }
}