1. RUJUKAN BERDASARKAN NOMOR KARTU :
Response :
    {
       "metaData": {
          "code": "200",
          "message": "OK"
       },
       "response": {
          "rujukan": {
             "diagnosa": {
                "kode": "N40",
                "nama": "Hyperplasia of prostate"
             },
             "keluhan": "kencing tidak puas",
             "noKunjungan": "030107010217Y001465",
             "pelayanan": {
                "kode": "2",
                "nama": "Rawat Jalan"
             },
             "peserta": {
                "cob": {
                   "nmAsuransi": null,
                   "noAsuransi": null,
                   "tglTAT": null,
                   "tglTMT": null
                },
                "hakKelas": {
                   "keterangan": "KELAS I",
                   "kode": "1"
                },
                "informasi": {
                   "dinsos": null,
                   "noSKTM": null,
                   "prolanisPRB": null
                },
                "jenisPeserta": {
                   "keterangan": "PENERIMA PENSIUN PNS",
                   "kode": "15"
                },
                "mr": {
                   "noMR": "298036",
                   "noTelepon": null
                },
                "nama": "MUSDIWAR,BA",
                "nik": null,
                "noKartu": "0000416382632",
                "pisa": "2",
                "provUmum": {
                   "kdProvider": "03010701",
                   "nmProvider": "SITEBA"
                },
                "sex": "L",
                "statusPeserta": {
                   "keterangan": "AKTIF",
                   "kode": "0"
                },
                "tglCetakKartu": "2017-11-13",
                "tglLahir": "1938-08-31",
                "tglTAT": "2038-08-31",
                "tglTMT": "1996-08-20",
                "umur": {
                   "umurSaatPelayanan": "78 tahun ,6 bulan ,6 hari",
                   "umurSekarang": "79 tahun ,3 bulan ,18 hari"
                }
             },
             "poliRujukan": {
                "kode": "URO",
                "nama": "UROLOGI"
             },
             "provPerujuk": {
                "kode": "03010701",
                "nama": "SITEBA"
             },
             "tglKunjungan": "2017-02-25"
          }
       }
    }

2. EDIT SEP : /SEP/2.0/update
Request :
{
     "request": {
        "t_sep": {
                "noSep": "0301R0110521V000037",
                "klsRawat":{
                                "klsRawatHak":"3",
                                "klsRawatNaik":"",
                                "pembiayaan":"",
                                "penanggungJawab":""
                              },
                "noMR": "00469120",
                "catatan": "",
                "diagAwal": "E10",
                "poli": {
                        "tujuan": "IGD",
                        "eksekutif": "0"
                },
                "cob": {
                        "cob": "0"
                },
                "katarak": {
                        "katarak": "0"
                },
                "jaminan": {
                        "lakaLantas": "0",
                        "penjamin": {
                                "tglKejadian": "",
                                "keterangan": "",
                                "suplesi": {
                                        "suplesi": "0",
                                        "noSepSuplesi": "",
                                        "lokasiLaka": {
                                                "kdPropinsi": "",
                                                "kdKabupaten": "",
                                                "kdKecamatan": ""
                                        }
                                }
                        }
                },
                "dpjpLayan":"46",
                "noTelp": "08522038363",
                "user": "Cobaws"
        }
      }
}
Response : 
{
          "metaData": {
            "code": "200",
            "message": "Sukses"
          },
          "response": "1101R0070420V000017"
        }

3. DELETE SEP : /SEP/2.0/delete
Request : 
{
       "request": {
          "t_sep": {
             "noSep": "0301R0011017V000007",
             "user": "Coba Ws"
          }
       }
    }

Response : 
{
            metaData: 
                {
                code: "200"
                message: "OK"
                }
            response: "0301R0011017V000007"
        }

4. SPRI : /RencanaKontrol/InsertSPRI
Request :
         {
            "request":
                {
                    "noKartu":"0001116500714", -> dari data pasien
                    "kodeDokter":"31537", -> cari dengan modal search
                    "poliKontrol":"BED", -> cari dengan modal search
                    "tglRencanaKontrol":"2021-04-13",
                    "user":"sss"
                }
        }

Response : 
         {
            "metaData": {
                "code": "200",
                "message": "Ok"
            },
            "response": {
                "noSPRI": "0301R0110421K000002",
                "tglRencanaKontrol": "2021-04-20",
                "namaDokter": "Dr.Yahya Marpaung,SpB, FINACS",
                "noKartu": "0001116500714",
                "nama": "M AMRU",
                "kelamin": "Laki-Laki",
                "tglLahir": "1997-12-16",
                "namaDiagnosa": null
            }
        }

5. CARI RENCANA KONTROL UNTUK SPRI : /RencanaKontrol/nosep/{nomorSEP} [GET]
Response :
{
        "metaData": {
            "code": "200",
            "message": "Sukses"
           },
        "response": {
            "noSep": "0301R0010819V006059",
            "tglSep": "2019-10-17",
            "jnsPelayanan": "Rawat Jalan",
            "poli": "HDL - HEMODIALISA",
            "diagnosa": "Z49.1 - Extracorporeal dialysis",
            "peserta": {
            "noKartu": "0000018965349",
            "nama": "RASBEN",
            "tglLahir": "1957-11-10",
            "kelamin": "L",
            "hakKelas": "-"
        },
        "provUmum": {
            "kdProvider": "03100202",
            "nmProvider": "KAMPUNG TELENG"
        },
        "provPerujuk": {
            "kdProviderPerujuk": "03100202",
            "nmProviderPerujuk": "KAMPUNG TELENG",
            "asalRujukan": "1",
            "noRujukan": "031002020619P000413",
            "tglRujukan": "2019-10-17"
            }
        }
    }

6. SURAT KONTROL : /RencanaKontrol/v2/Insert [POST]
Request : 
         {
            "request": {
                "noSEP":"{nomor SEP}",
                "kodeDokter":"{kode dokter}",
                "poliKontrol":"{kode poli}",
                "tglRencanaKontrol":"{Rawat Jalan: diisi tanggal rencana kontrol, format: yyyy-MM-dd. Rawat Inap: diisi tanggal SPRI, format: yyyy-MM-dd}",
                "user":"{user pembuat rencana kontrol}",
                "formPRB": {
                  "kdStatusPRB": "{kode penyakit PRB}", //(01. Diabetes Melitus,02. Hipertensi, 03. Asma, 04. Penyakit Jantung, 05. PPOK, 06. Skizofrenia, 07. Stroke, 08. Epilepsi, 09. SLE)
                  "data": {
                 /* Jika kdStatusPRB 01 */   "HBA1C": {diisi null atau angka}, /* 0.1 sd 15 */
                 /* Jika kdStatusPRB 01/07 */   "GDP": {diisi null atau angka}, /* 10 sd 500 */
                 /* Jika kdStatusPRB 01 */   "GD2JPP": {diisi null atau angka}, /* 10 sd 500 */
                 /* Jika kdStatusPRB 01/02 */   "eGFR": {diisi null atau angka}, /* 5 sd 150 */
                 /* Jika kdStatusPRB 01/07 */    "TD_Sistolik": {diisi null atau angka}, /* 20 sd 200 */
                 /* Jika kdStatusPRB 01/07 */   "TD_Diastolik": {diisi null atau angka}, /* 20 sd 200 */
                 /* Jika kdStatusPRB 01/07 */   "LDL": {diisi null atau angka}, /* 20 sd 500 */
                 /* Jika kdStatusPRB 02/04 */   "Rata_TD_Sistolik": {diisi null atau angka}, /* 20 sd 200 */
                 /* Jika kdStatusPRB 02/04 */   "Rata_TD_Diastolik": {diisi null atau angka}, /* 20 sd 200 */
                 /* Jika kdStatusPRB 02 */   "JantungKoroner": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 02 */   "Stroke": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 02 */   "VaskularPerifer": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 02/04 */   "Aritmia": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 02 */   "AtrialFibrilasi": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 04 */   "NadiIstirahat": {diisi null atau angka}, /* 20 sd 200 */
                 /* Jika kdStatusPRB 04 */   "SesakNapas3Bulan": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 04 */   "NyeriDada3Bulan": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 04 */   "SesakNapasAktivitas": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 04 */   "NyeriDadaAktivitas": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 03 */   "Terkontrol": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 03 */   "Gejala2xMinggu": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 03 */   "BangunMalam": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 03 */   "KeterbatasanFisik": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 03 */   "FungsiParu": {diisi null atau angka}, /* 0 sd 100 */
                 /* Jika kdStatusPRB 05 */   "SkorMMRC": {diisi null atau angka}, /* 0 sd 40 */
                 /* Jika kdStatusPRB 05 */   "Eksaserbasi1Tahun": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 05 */   "MampuAktivitas": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 08 */   "Epileptik6Bulan": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 08 */   "EfekSampingOAB": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 08 */   "HamilMenyusui": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 06 */   "Remisi": {diisi null atau angka}, /* 0 sd 100 */
                 /* Jika kdStatusPRB 06 */   "TerapiRumatan": {diisi null atau angka}, /* 0 atau 1 */
                 /* Jika kdStatusPRB 06 */   "Usia": {diisi null atau angka}, /* 1 sd 100 */
                 /* Jika kdStatusPRB 07 */   "AsamUrat": {diisi null atau angka}, /* 0.1 sd 20 */
                 /* Jika kdStatusPRB 09 */   "RemisiSLE": {diisi null atau angka}, /* 0 sd 100 */
                 /* Jika kdStatusPRB 09 */   "Hamil": {diisi null atau angka} /* 0 atau 1 */
                  }
                }
            }
        }
Response :
      {
            "metaData": {
                "code": "200",
                "message": "Ok"
            },
            "response": {
                "noSuratKontrol": "0301R0110520K000013",
                "tglRencanaKontrol": "2020-05-15",
                "namaDokter": "Dr. John Wick",
                "noKartu": "0001328186441",
                "nama": "ARIS",
                "kelamin": "Laki-laki",
                "tglLahir": "1947-12-31",
                "namaDiagnosa": "I60 - Subarachnoid haemorrhage",
                "formPRB": {
                    "kdStatusPRB": "07",
                    "data": {
                        "HBA1C": null,
                        "GDP": 78,
                        "GD2JPP": null,
                        "eGFR": null,
                        "TD_Sistolik": 90,
                        "TD_Diastolik": 90,
                        "LDL": 20,
                        "Rata_TD_Sistolik": null,
                        "Rata_TD_Diastolik": null,
                        "JantungKoroner": null,
                        "Stroke": null,
                        "VaskularPerifer": null,
                        "Aritmia": null,
                        "AtrialFibrilasi": null,
                        "SesakNapas3Bulan": null,
                        "NyeriDada3Bulan": null,
                        "Terkontrol": null,
                        "Gejala2xMinggu": null,
                        "BangunMalam": null,
                        "KeterbatasanFisik": null,
                        "FungsiParu": null,
                        "SkorMMRC": null,
                        "Eksaserbasi1Tahun": null,
                        "MampuAktivitas": null,
                        "Epileptik6Bulan": null,
                        "EfekSampingOAB": null,
                        "HamilMenyusui": null,
                        "Remisi": null,
                        "TerapiRumatan": null,
                        "Usia": null,
                        "AsamUrat": 0.1,
                        "RemisiSLE": null,
                        "Hamil": null,
                        "NadiIstirahat": null,
                        "SesakNapasAktivitas": null,
                        "NyeriDadaAktivitas": null
                    }
                }
            }
        }

7. SURAT PENCARIAN SURAT KONTROL BY NOMOR KARTU 
Request : 
{
	"response": {
		"noSuratKontrol": "0301R0111125K000002",
		"tglRencanaKontrol": "2025-11-25",
		"tglTerbit": "2025-11-18",
		"jnsKontrol": "2",
		"poliTujuan": "BED",
		"namaPoliTujuan": "BEDAH",
		"kodeDokter": "31348",
		"namaDokter": "CIiNatXXAXSkrIrPId,ManFs.SDDMe",
		"flagKontrol": "False",
		"kodeDokterPembuat": "31348",
		"namaDokterPembuat": "CIiNatXXAXSkrIrPId,ManFs.SDDMe",
		"namaJnsKontrol": "Kontrol",
		"sep": {
			"noSep": "0301R0110725V000006",
			"tglSep": "2025-07-30",
			"jnsPelayanan": "Rawat Jalan",
			"poli": "BED - BEDAH",
			"diagnosa": "E10 - Insulin-dependent diabetes mellitus",
			"peserta": {
				"noKartu": "0002482505324",
				"nama": "ARMSTIOFIALR",
				"tglLahir": "1983-09-07",
				"kelamin": "P",
				"hakKelas": "-"
			},
			"provUmum": {
				"kdProvider": "10210901",
				"nmProvider": "KERTASEMAYA"
			},
			"provPerujuk": {
				"kdProviderPerujuk": "0050B107",
				"nmProviderPerujuk": "Klinik Sehat Gajah Mada",
				"asalRujukan": "1",
				"noRujukan": "0050B1070924P000001",
				"tglRujukan": "2025-10-01"
			}
		},
		"formPRB": {
			"kdStatusPRB": null,
			"data": {
				"HBA1C": null,
				"GDP": null,
				"GD2JPP": null,
				"eGFR": null,
				"TD_Sistolik": null,
				"TD_Diastolik": null,
				"LDL": null,
				"Rata_TD_Sistolik": null,
				"Rata_TD_Diastolik": null,
				"JantungKoroner": null,
				"Stroke": null,
				"VaskularPerifer": null,
				"Aritmia": null,
				"AtrialFibrilasi": null,
				"SesakNapas3Bulan": null,
				"NyeriDada3Bulan": null,
				"Terkontrol": null,
				"Gejala2xMinggu": null,
				"BangunMalam": null,
				"KeterbatasanFisik": null,
				"FungsiParu": null,
				"SkorMMRC": null,
				"Eksaserbasi1Tahun": null,
				"MampuAktivitas": null,
				"Epileptik6Bulan": null,
				"EfekSampingOAB": null,
				"HamilMenyusui": null,
				"Remisi": null,
				"TerapiRumatan": null,
				"Usia": null,
				"AsamUrat": null,
				"RemisiSLE": null,
				"Hamil": null,
				"NadiIstirahat": null,
				"SesakNapasAktivitas": null,
				"NyeriDadaAktivitas": null
			}
		}
	},
	"metaData": {
		"code": "200",
		"message": "Sukses"
	}
}
    
Catatan: 
Ketika pembuatan SPRI atau jenis kontrol 1 tidak ada referensi nomor SEP asalnya, jadi field response SEP kosong atau null. 
Sedangkan jika pembuatan surat kontrol atau jenis kontrol 2, akan terisi field response SEP karena terdapat referensi nomor SEP asal ketika pembuatan surat kontrol tersebut.

8. GET DATA BPJS BY NIK : {BASE URL}/{Service Name}/Peserta/nik/{parameter 1}/tglSEP/{parameter 2}
Fungsi : Pencarian data peserta berdasarkan NIK Kependudukan
Method : GET
Format : Json
Content-Type: application/json; charset=utf-8
Parameter 1 : NIK KTP
Parameter 2 : Tanggal Pelayanan/SEP - format : yyyy-MM-dd
Response : 
{
  "metaData": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "peserta": {
      "cob": {
        "nmAsuransi": null,
        "noAsuransi": null,
        "tglTAT": null,
        "tglTMT": null
      },
      "hakKelas": {
        "keterangan": "KELAS I",
        "kode": "1"
      },
      "informasi": {
        "dinsos": null,
        "noSKTM": null,
        "prolanisPRB": null
      },
      "jenisPeserta": {
        "keterangan": "PEGAWAI SWASTA",
        "kode": "13"
      },
      "mr": {
        "noMR": null,
        "noTelepon": null
      },
      "nama": "TRI M",
      "nik": "3319022010810007",
      "noKartu": "0011336526592",
      "pisa": "1",
      "provUmum": {
        "kdProvider": "0138U020",
        "nmProvider": "KPRJ PALA MEDIKA"
      },
      "sex": "L",
      "statusPeserta": {
        "keterangan": "AKTIF",
        "kode": "0"
      },
      "tglCetakKartu": "2016-02-12",
      "tglLahir": "1981-10-10",
      "tglTAT": "2014-12-31",
      "tglTMT": "2008-10-01",
      "umur": {
        "umurSaatPelayanan": "35 tahun ,1 bulan ,11 hari",
        "umurSekarang": "35 tahun ,2 bulan ,10 hari"
      }
    }
  }
}

9. UPDATE RENCANA KONTROL :   {BASE URL}/{Service Name}/RencanaKontrol/Update
Fungsi : Update tanggal rencana kontrol
Method : PUT
Format : Json
Content-Type: Application/x-www-form-urlencoded
Request :  
         {
            "request": {
                "noSuratKontrol":"{nomor surat kontrol}",
                "noSEP":"{nomor SEP}",
                "kodeDokter":"{kode dokter}",
                "poliKontrol":"{kode poli}",
                "tglRencanaKontrol":"{tanggal rencana kontrol, format: yyyy-MM-dd}",
                "user":"{user pembuat rencana kontrol}"
            }
        }
Response :
        {
            "metaData": {
                "code": "200",
                "message": "Ok"
            },
            "response": {
                "noSuratKontrol": "0301R0110520K000013",
                "tglRencanaKontrol": "2020-05-15",
                "namaDokter": "Dr. John Wick",
                "noKartu": "0001328186441",
                "nama": "ARIS",
                "kelamin": "Laki-laki",
                "tglLahir": "1947-12-31"
            }
        }

10. UPDATE RENCANA KONTROL V2 : {BASE URL}/{Service Name}/RencanaKontrol/v2/Update
Fungsi : Updaterencana kontrol jika dari pembuatan kontrol ada PRB nya
Method : PUT
Format : Json
Content-Type: Application/x-www-form-urlencoded
Request :
{
   "request":{
      "noSuratKontrol":"{nomor surat kontrol}",
      "noSEP":"{nomor SEP}",
      "kodeDokter":"{kode dokter}",
      "poliKontrol":"{kode poli}",
      "tglRencanaKontrol":"{tanggal rencana kontrol, format: yyyy-MM-dd}",
      "user":"{user pembuat rencana kontrol}",
      "formPRB":{
         "kdStatusPRB":"{kode penyakit PRB}",
         //(01. Diabetes Melitus,
         02. Hipertensi,
         03. Asma,
         04. Penyakit Jantung,
         05. PPOK,
         06. Skizofrenia,
         07. Stroke,
         08. Epilepsi,
         09. SLE)"data":{
            /* 01 */"HBA1C":{
               "diisi null atau angka"
            },
            /* 0.1 sd 15 */
                 /* 01/07 */"GDP":{
               "diisi null atau angka"
            },
            /* 10 sd 500 */
                 /* 01 */"GD2JPP":{
               "diisi null atau angka"
            },
            /* 10 sd 500 */
                 /* 01/02 */"eGFR":{
               "diisi null atau angka"
            },
            /* 5 sd 150 */
                 /* 01/07 */"TD_Sistolik":{
               "diisi null atau angka"
            },
            /* 20 sd 200 */
                 /* 01/07 */"TD_Diastolik":{
               "diisi null atau angka"
            },
            /* 20 sd 200 */
                 /* 01/07 */"LDL":{
               "diisi null atau angka"
            },
            /* 20 sd 500 */
                 /* 02/04 */"Rata_TD_Sistolik":{
               "diisi null atau angka"
            },
            /* 20 sd 200 */
                 /* 02/04 */"Rata_TD_Diastolik":{
               "diisi null atau angka"
            },
            /* 20 sd 200 */
                 /* 02 */"JantungKoroner":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 02 */"Stroke":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 02 */"VaskularPerifer":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 02/04 */"Aritmia":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 02 */"AtrialFibrilasi":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 04 */"NadiIstirahat":{
               "diisi null atau angka"
            },
            /* 20 sd 200 */
                 /* 04 */"SesakNapas3Bulan":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 04 */"NyeriDada3Bulan":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 04 */"SesakNapasAktivitas":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 04 */"NyeriDadaAktivitas":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 03 */"Terkontrol":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 03 */"Gejala2xMinggu":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 03 */"BangunMalam":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 03 */"KeterbatasanFisik":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 03 */"FungsiParu":{
               "diisi null atau angka"
            },
            /* 0 sd 100 */
                 /* 05 */"SkorMMRC":{
               "diisi null atau angka"
            },
            /* 0 sd 40 */
                 /* 05 */"Eksaserbasi1Tahun":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 05 */"MampuAktivitas":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 08 */"Epileptik6Bulan":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 08 */"EfekSampingOAB":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 08 */"HamilMenyusui":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 06 */"Remisi":{
               "diisi null atau angka"
            },
            /* 0 sd 100 */
                 /* 06 */"TerapiRumatan":{
               "diisi null atau angka"
            },
            /* 0 atau 1 */
                 /* 06 */"Usia":{
               "diisi null atau angka"
            },
            /* 1 sd 100 */
                 /* 07 */"AsamUrat":{
               "diisi null atau angka"
            },
            /* 0.1 sd 20 */
                 /* 09 */"RemisiSLE":{
               "diisi null atau angka"
            },
            /* 0 sd 100 */
                 /* 09 */"Hamil":{
               "diisi null atau angka"
            }/* 0 atau 1 */
         }
      }
   }
}
Response :
{
   "metaData":{
      "code":"200",
      "message":"Ok"
   },
   "response":{
      "noSuratKontrol":"0301R0110520K000013",
      "tglRencanaKontrol":"2020-05-15",
      "namaDokter":"Dr. John Wick",
      "noKartu":"0001328186441",
      "nama":"ARIS",
      "kelamin":"Laki-laki",
      "tglLahir":"1947-12-31",
      "namaDiagnosa":"I60 - Subarachnoid haemorrhage",
      "formPRB":{
         "kdStatusPRB":"07",
         "data":{
            "HBA1C":null,
            "GDP":78,
            "GD2JPP":null,
            "eGFR":null,
            "TD_Sistolik":90,
            "TD_Diastolik":90,
            "LDL":20,
            "Rata_TD_Sistolik":null,
            "Rata_TD_Diastolik":null,
            "JantungKoroner":null,
            "Stroke":null,
            "VaskularPerifer":null,
            "Aritmia":null,
            "AtrialFibrilasi":null,
            "SesakNapas3Bulan":null,
            "NyeriDada3Bulan":null,
            "Terkontrol":null,
            "Gejala2xMinggu":null,
            "BangunMalam":null,
            "KeterbatasanFisik":null,
            "FungsiParu":null,
            "SkorMMRC":null,
            "Eksaserbasi1Tahun":null,
            "MampuAktivitas":null,
            "Epileptik6Bulan":null,
            "EfekSampingOAB":null,
            "HamilMenyusui":null,
            "Remisi":null,
            "TerapiRumatan":null,
            "Usia":null,
            "AsamUrat":0.1,
            "RemisiSLE":null,
            "Hamil":null,
            "NadiIstirahat":null,
            "SesakNapasAktivitas":null,
            "NyeriDadaAktivitas":null
         }
      }
   }
}
11. CARI NOMOR SURAT KONTROL : {BASE URL}/{Service Name}/RencanaKontrol/noSuratKontrol/{parameter}
Fungsi : Mengambil data kontrol 
Method : GET
Content-Type: Application/x-www-form-urlencoded
Parameter: Nomor Surat Kontrol Peserta
Response :
{
   "response":{
      "noSuratKontrol":"0301R0111125K000002",
      "tglRencanaKontrol":"2025-11-25",
      "tglTerbit":"2025-11-18",
      "jnsKontrol":"2",
      "poliTujuan":"BED",
      "namaPoliTujuan":"BEDAH",
      "kodeDokter":"31348",
      "namaDokter":"CIiNatXXAXSkrIrPId,ManFs.SDDMe",
      "flagKontrol":"False",
      "kodeDokterPembuat":"31348",
      "namaDokterPembuat":"CIiNatXXAXSkrIrPId,ManFs.SDDMe",
      "namaJnsKontrol":"Kontrol",
      "sep":{
         "noSep":"0301R0110725V000006",
         "tglSep":"2025-07-30",
         "jnsPelayanan":"Rawat Jalan",
         "poli":"BED - BEDAH",
         "diagnosa":"E10 - Insulin-dependent diabetes mellitus",
         "peserta":{
            "noKartu":"0002482505324",
            "nama":"ARMSTIOFIALR",
            "tglLahir":"1983-09-07",
            "kelamin":"P",
            "hakKelas":"-"
         },
         "provUmum":{
            "kdProvider":"10210901",
            "nmProvider":"KERTASEMAYA"
         },
         "provPerujuk":{
            "kdProviderPerujuk":"0050B107",
            "nmProviderPerujuk":"Klinik Sehat Gajah Mada",
            "asalRujukan":"1",
            "noRujukan":"0050B1070924P000001",
            "tglRujukan":"2025-10-01"
         }
      },
      "formPRB":{
         "kdStatusPRB":null,
         "data":{
            "HBA1C":null,
            "GDP":null,
            "GD2JPP":null,
            "eGFR":null,
            "TD_Sistolik":null,
            "TD_Diastolik":null,
            "LDL":null,
            "Rata_TD_Sistolik":null,
            "Rata_TD_Diastolik":null,
            "JantungKoroner":null,
            "Stroke":null,
            "VaskularPerifer":null,
            "Aritmia":null,
            "AtrialFibrilasi":null,
            "SesakNapas3Bulan":null,
            "NyeriDada3Bulan":null,
            "Terkontrol":null,
            "Gejala2xMinggu":null,
            "BangunMalam":null,
            "KeterbatasanFisik":null,
            "FungsiParu":null,
            "SkorMMRC":null,
            "Eksaserbasi1Tahun":null,
            "MampuAktivitas":null,
            "Epileptik6Bulan":null,
            "EfekSampingOAB":null,
            "HamilMenyusui":null,
            "Remisi":null,
            "TerapiRumatan":null,
            "Usia":null,
            "AsamUrat":null,
            "RemisiSLE":null,
            "Hamil":null,
            "NadiIstirahat":null,
            "SesakNapasAktivitas":null,
            "NyeriDadaAktivitas":null
         }
      }
   },
   "metaData":{
      "code":"200",
      "message":"Sukses"
   }
}
Catatan : Ketika pembuatan SPRI atau jenis kontrol 1 tidak ada referensi nomor SEP asalnya, jadi field response SEP kosong atau null. 
Sedangkan jika pembuatan surat kontrol atau jenis kontrol 2, akan terisi field response SEP karena terdapat referensi nomor SEP asal ketika pembuatan surat kontrol tersebut.

### AMBIL DATA RUJUKAN BERDASARKAN NOMOR KARTU DAN NOMOR NIK
{BASE URL}/{Service Name}/Rujukan/RS/List/Peserta/{parameter}

Parameter : Nomor kartu

RESPONSE :
{
  "metaData": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "rujukan": [
      {
        "diagnosa": {
          "kode": "I21.9",
          "nama": "Acute myocardial infarction, unspecified"
        },
        "keluhan": "",
        "noKunjungan": "0304R0050217A000079",
        "pelayanan": {
          "kode": "1",
          "nama": "Rawat Inap"
        },
        "peserta": {
          "cob": {
            "nmAsuransi": null,
            "noAsuransi": null,
            "tglTAT": null,
            "tglTMT": null
          },
          "hakKelas": {
            "keterangan": "KELAS III",
            "kode": "3"
          },
          "informasi": {
            "dinsos": null,
            "noSKTM": null,
            "prolanisPRB": null
          },
          "jenisPeserta": {
            "keterangan": "PBI (APBN)",
            "kode": "21"
          },
          "mr": {
            "noMR": "971430",
            "noTelepon": null
          },
          "nama": "MUHAMMAD JUSAR",
          "nik": "1106081301530001",
          "noKartu": "0105986780439",
          "pisa": "1",
          "provUmum": {
            "kdProvider": "03050301",
            "nmProvider": "BASO"
          },
          "sex": "L",
          "statusPeserta": {
            "keterangan": "AKTIF",
            "kode": "0"
          },
          "tglCetakKartu": "2017-11-13",
          "tglLahir": "1953-07-01",
          "tglTAT": "2053-07-01",
          "tglTMT": "2013-01-01",
          "umur": {
            "umurSaatPelayanan": "63 tahun ,7 bulan ,23 hari",
            "umurSekarang": "64 tahun ,4 bulan ,12 hari"
          }
        },
        "poliRujukan": {
          "kode": "",
          "nama": ""
        },
        "provPerujuk": {
          "kode": "0304R005",
          "nama": "RSI IBNU SINA"
        },
        "tglKunjungan": "2017-02-24"
      }
    ]
  }
}


### CARI SEP BERDASARKAN NOMOR RUJUKAN
{BASE URL}/{Service Name}/Rujukan/lastsep/norujukan/{parameter}
Method : GET
Format : Json
Content-Type: Application/x-www-form-urlencoded
Parameter: Nomor Rujukan
Response :
{
  "metaData": {
    "code": "200",
    "message": "Sukses"
  },
  "response": {
    "noSep": "0301R0010323V000039",
    "tglSep": "2023-03-30",
    "jnsPelayanan": "Rawat Jalan",
    "kelasRawat": "Kelas 3",
    "diagnosa": "Respiratory tuberculosis, bacteriologically and histologically confirmed",
    "noRujukan": "0050B1070223P000004",
    "poli": "PENYAKIT DALAM",
    "poliEksekutif": "0",
    "catatan": "testinsert RJ",
    "penjamin": null,
    "kdStatusKecelakaan": "0",
    "nmstatusKecelakaan": "Bukan Kecelakaan",
    "lokasiKejadian": {
      "kdKab": null,
      "kdKec": null,
      "kdProp": null,
      "ketKejadian": null,
      "lokasi": null,
      "tglKejadian": null
    },
    "dpjp": {
      "kdDPJP": "34050",
      "nmDPJP": "tapS,XXXryoShR..PaBDd"
    },
    "peserta": {
      "asuransi": null,
      "hakKelas": "Kelas 3",
      "jnsPeserta": "PBI (APBN)",
      "kelamin": "P",
      "nama": "ARSTNUU",
      "noKartu": "0002802875185",
      "noMr": "MR5185",
      "tglLahir": "1944-02-24"
    },
    "klsRawat": {
      "klsRawatHak": "3",
      "klsRawatNaik": null,
      "pembiayaan": null,
      "penanggungJawab": null
    },
    "kontrol": {
      "kdDokter": "34050",
      "nmDokter": "tapS,XXXryoShR..PaBDd",
      "noSurat": "0301R0010323K000008"
    },
    "cob": "0",
    "katarak": "0",
    "tujuanKunj": {
      "kode": "2",
      "nama": "Konsul Dokter"
    },
    "flagProcedure": {
      "kode": "0",
      "nama": "Prosedur tidak berkelanjutan"
    },
    "kdPenunjang": {
      "kode": "0",
      "nama": ""
    },
    "assestmenPel": {
      "kode": "1",
      "nama": "Poli spesialis tidak tersedia pada hari sebelumnya"
    },
    "eSEP": "True"
  }
}