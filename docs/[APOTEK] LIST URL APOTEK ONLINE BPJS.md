## [GET] REFERENSI DPHO : {Base URL}/{Service Name}/referensi/dpho
Response :
{
    "response": {
        "list": [
            {
                "kodeobat": "11250805294",
                "namaobat": "Levotiroksin 150 SK tab 150 mcg",
                "prb": "False",
                "kronis": "True",
                "kemo": "False",
                "harga": "1550",
                "restriksi": "Null",
                "generik": "Levotiroksin",
                "aktif": null,
                "sedia": "150",
                "stok": "100"
            },
            {
                "kodeobat": "11250805295",
                "namaobat": "Okskarbazepin 300 SK tab 300 mg",
                "prb": "True",
                "kronis": "True",
                "kemo": "False",
                "harga": "5028",
                "restriksi": "Null",
                "generik": "Okskarbazepin",
                "aktif": null,
                "sedia": "300",
                "stok": null
            }
        ]
    },
    "metaData": {
        "code": "200",
        "message": "OK"
    }
}

## [GET] REFERENSI POLI : {Base URL}/{Service Name}/referensi/poli/{Parameter}
Parameter : Kode atau Nama Poli

Response : 
{
    "response": {
        "poli": [
            {
                "kode": "ICU",
                "nama": "Intensive Care Unit"
            },
            {
                "kode": "INT",
                "nama": "Poli Penyakit Dalam"
            },
            {
                "kode": "IVP",
                "nama": "Intravena Pydografi"
            }
        ]
    },
    "metaData": {
        "code": "200",
        "message": "OK"
    }
}

## [GET] FASILITAS KESEHATAN : {Base URL}/{Service Name}/referensi/ppk/{Parameter 1}/{Parameter 2}
Parameter 1 : Jenis Faskes (1. Faskes 1, 2. Faskes 2/RS)

Parameter 2 : nama faskes

Response : 
{
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
    },
    "metaData": {
        "code": "200",
        "message": "OK"
    }
}

## [GET] SETTING APOTEK : {Base URL}/{Service Name}/referensi/settingppk/read/{Parameter}
Parameter : Kode Apotek

Response : 
{
    "response": {
        "kode": "0112A017",
        "namaapoteker": "masapo",
        "namakepala": "maskep",
        "jabatankepala": "Kepala Apotek",
        "nipkepala": "34567",
        "siup": "1112233",
        "alamat": "Jl. Kebayoran Lama No. 34 K",
        "kota": "jakarta selatan",
        "namaverifikator": "masver",
        "nppverifikator": "12345",
        "namapetugasapotek": "maspet",
        "nippetugasapotek": "23456",
        "checkstock": "False"
    },
    "metaData": {
        "code": "200",
        "message": "OK"
    }
}

## [GET] SPESIALISTIK : {Base URL}/{Service Name}/referensi/spesialistik

Response : 
{
    "response": {
        "list": [
            {
                "kode": "11",
                "nama": "Spesialis Anestesiologi dan Reanimasi"
            },
            {
                "kode": "27",
                "nama": "Spesialis Forensik"
            },
            {
                "kode": "28",
                "nama": "Spesialis Onkologi"
            }
        ]
    },
    "metaData": {
        "code": "200",
        "message": "OK"
    }
}

## [GET] OBAT : {Base URL}/{Service Name}/referensi/obat/{Parameter 1}/{Parameter 2}/{Parameter 3}
Parameter 1 : Kode Jenis Obat

Parameter 2 : Tgl Resep

Parameter 3 : Filter Pencarian

Response :
{
    "response": {
        "list": [
            {
                "kode": "13210404174",
                "nama": "Amlodipin 5 Temp tab 5 mg",
                "harga": "75"
            },
            {
                "kode": "13210404294",
                "nama": "Amlodipin 10 Temp tab 10 mg",
                "harga": "99"
            }
        ]
    },
    "metaData": {
        "code": "200",
        "message": "OK"
    }
}

## [POST] INSERT OBAT NON RACIKAN : {Base URL}/{Service Name}/obatnonracikan/v3/insert
Request :
{
    "NOSJP": "0112A01704190000001",
    "NORESEP": "01236",
    "KDOBT": "123456",
    "NMOBAT": "IVAN",
    "SIGNA1OBT": 1,
    "SIGNA2OBT": 1,
    "JMLOBT": 1,
    "JHO": 1,
    "CatKhsObt": "TES"
}

Response :
{
    "response": null,
    "metaData": {
        "code": 200,
        "message": "Ok"
    }
}

## [POST] INSERT OBAT RACIKAN : {Base URL}/{Service Name}/obatracikan/v3/insert
Request : 
{
    "NOSJP": "0112A01704190000001",
    "NORESEP": "01236",
    "JNSROBT": "R.01",
    "KDOBT": "012131",
    "NMOBAT": "OBAT SOA 1",
    "SIGNA1OBT": 1,
    "SIGNA2OBT": 1,
    "PERMINTAAN": 1,
    "JMLOBT": 1,
    "JHO": 1,
    "CatKhsObt": "RACIKAN 1"
}

Response :
{
    "response": null,
    "metaData": {
        "code": 200,
        "message": "Ok"
    }
}

## [POST] UPDATE STOK OBAT : {Base URL}/{Service Name}/UpdateStokObat/updatestok
Request : 
{
    "KDOBAT": "11250805294",
    "STOK": 100
}

Response : 
{
    "response": null,
    "metaData": {
        "code": "200",
        "message": "Stok obat berhasil diperbarui"
    }
}

## [DELETE] HAPUS PELAYANAN OBAT : {Base URL}/{Service Name}/pelayanan/obat/hapus/
Request :
{
    "nosepapotek": "1801A00104190000001",
    "noresep": "12345",
    "kodeobat": "25180404057",
    "tipeobat": "N"
}

Response : 
{
    "response": "Data berhasil dihapus.",
    "metaData": {
        "code": "200",
        "message": "Ok"
    }
}

## [GET] DAFTAR PELAYANAN OBAT : {Base URL}/{Service Name}/obat/daftar/{Parameter 1}
Parameter 1 : Nomor Kunjungan/SEP

Response : 
{
    "response": {
        "detailsep": {
            "noSepApotek": "1801A00104190000001",
            "noSepAsal": "1801R0010419V000001",
            "noresep": "12345",
            "nokartu": "0000000000044",
            "nmpst": "AGUSMA",
            "kdjnsobat": "1",
            "nmjnsobat": "Obat PRB",
            "tglpelayanan": "2019-04-04",
            "listobat": {
                "kodeobat": "25180404057",
                "namaobat": "Amlodipin 10 Plab tab 10 mg",
                "tipeobat": "N",
                "signa1": "1.00",
                "signa2": "1.00",
                "hari": "23.00",
                "permintaan": null,
                "jumlah": "23.00",
                "harga": "2797"
            }
        },
        "metaData": {
            "code": "200",
            "message": "Ok"
        }
    }
}

## [GET] RIWAYAT PELAYANAN OBAT : {Base URL}/{Service Name}/riwayatobat/{parameter 1}/{parameter 2}/{parameter 3}
Parameter 1 : Tgl Awal

Parameter 2 : Tgl Akhir

Parameter 3 : NoKartu

Response : 
{
    "response": {
        "list": {
            "nokartu": "0000000000044",
            "namapeserta": "AGUSMA",
            "tgllhr": "1973-11-03",
            "history": [
                {
                    "nosjp": "1101A00309180000002",
                    "tglpelayanan": "2018-09-13",
                    "noresep": "00001",
                    "kodeobat": "12180400002",
                    "namaobat": "Akarbose 50 Dexa tab 50 mg",
                    "jmlobat": "46.00"
                },
                {
                    "nosjp": "1101A00309180000003",
                    "tglpelayanan": "2018-09-16",
                    "noresep": "00002",
                    "kodeobat": "12180401313",
                    "namaobat": "Triheksilfenidil 2 Mers tab 2 mg",
                    "jmlobat": "60.00"
                }
            ]
        }
    },
    "metaData": {
        "code": "200",
        "message": "Ok"
    }
}

## [POST] SIMPAN RESEP : {Base URL}/{Service Name}/sjpresep/v3/insert
Request :
{
    "TGLSJP": "2021-08-05 18:13:11",
    "REFASALSJP": "1202R0010318V000092",
    "POLIRSP": "IPD",
    "KDJNSOBAT": "3", (1. Obat PRB, 2. Obat Kronis Blm Stabil, 3. Obat Kemoterapi)
    "NORESEP": "12346", 
    "IDUSERSJP": "USR-01",
    "TGLRSP": "2021-08-05 00:00:00", 
    "TGLPELRSP": "2021-08-05 00:00:00",
    "KdDokter": "0",
    "iterasi":"0" (0. Non Iterasi, 1. Iterasi)
}

Response :
{
  "response": {
    "noSep_Kunjungan": "1202R0010318V000092",
    "noKartu": "0000648450639",
    "nama": "SITI NAFISAH",
    "faskesAsal": "1202A002",
    "noApotik": "1202A00208210000001",
    "noResep": "12346",
    "tglResep": "2021-08-05",
    "kdJnsObat": "3",
    "byTagRsp": "0",
    "byVerRsp": "0",
    "tglEntry": "2021-08-05"
  },
  "metaData": {
    "code": "200",
    "message": "BERHASIL SIMPAN RESEP DENGAN NOSJP: 1202A00208210000001 No SEP RS sudah dilakukan iterasi sebanyak 1"
  }
}

## [DELETE] HAPUS RESEP : {Base URL}/{Service Name}/hapusresep
Request :
{
    "nosjp": "1202A00201210000032",
    "refasalsjp": "1202R0010121V000325",
    "noresep": "0SI44"
}

Response :
{
    "metaData": {
        "code": "200",
        "message": "OK"
    },
    "response": null
}

## [POST] DAFTAR RESEP : {Base URL}/{Service Name}/daftarresep
Request :
{
    "kdppk": "0112A017",
    "KdJnsObat": "0",
    "JnsTgl": "TGLPELSJP", format -> TGLPELSJP,TGLRSP
    "TglMulai": "2019-03-01 08:49:45",
    "TglAkhir": "2019-03-31 06:18:33"
} 

Response :
{
  "metaData": {
    "code": "200",
    "message": "Ok."
  },
  "response": {
    "resep": {
      "NORESEP": "01236",
      "NOAPOTIK": "0112A01704190000001",
      "NOSEP_KUNJUNGAN": "0112R0340418V004961",
      "NOKARTU": "0002338679259",
      "NAMA": "SITI SULASTRI",
      "TGLENTRY": "2019-04-02 11:13:33.000+07:00",
      "TGLRESEP": "2019-03-19 00:00:00.000+07:00",
      "TGLPELRSP": "2019-03-26 00:00:00.000+07:00",
      "BYTAGRSP": "0.00",
      "BYVERRSP": "0.00",
      "KDJNSOBAT": "2",
      "FASKESASAL": "0112R034"
    }
  }
}

## [GET] CARI DATA KUNJUNGAN BERDASARKAN SEP : {Base URL}/{Service Name}/sep/{Parameter 1}
Parameter 1 : Nomor Kunjungan/SEP : 19 digit

Response :
{
    "response": {
        "noSep": "1202R0010318V000092",
        "faskesasalresep": "1202R001",
        "nmfaskesasalresep": "RSUP DR. SARDJITO",
        "nokartu": "0000648450639",
        "namapeserta": "SITI NAFISAH",
        "jnskelamin": "P",
        "tgllhr": "1990-10-01",
        "pisat": "4",
        "kdjenispeserta": "21",
        "nmjenispeserta": "PBI (APBN)",
        "kodebu": "00000021",
        "namabu": "PBI (APBN)",
        "tglsep": "2021-08-01",
        "tglplgsep": "2021-08-01",
        "jnspelayanan": "RJTL",
        "nmdiag": "Supervision of normal first pregnancy",
        "poli": "OBGYN",
        "flagprb": "0",
        "namaprb": "",
        "kodedokter": "",
        "namadokter": null
    },
    "metaData": {
        "code": "200",
        "message": "OK"
    }
}

## [GET] DATA KLAIM : {Base URL}/{Service Name}/monitoring/klaim/{parameter 1}/{parameter 2}/{parameter 3}/{parameter 4}
Parameter 1 : Bulan

Parameter 2 : Tahun

Parameter 3 : Jenis Obat (0. Semua 1. Obat PRB 2. Obat Kronis Blm Stabil 3. Obat Kemoterapi)

Parameter 4 : Status (1. Belum diverifikasi 2. Sudah Verifikasi)

Response :
{
    "response": {
        "rekap": {
            "jumlahdata": "2",
            "totalbiayapengajuan": "35646930",
            "totalbiayasetuju": "0",
            "listsep": [
                {
                    "nosepapotek": "1801A00104190000002",
                    "nosepaasal": "1801R0010419V000001",
                    "nokartu": "0000000000044",
                    "namapeserta": "AGUSMA",
                    "noresep": "00001",
                    "jnsobat": "Obat Kemoterapi",
                    "tglpelayanan": "2019-04-04",
                    "biayapengajuan": "35646930",
                    "biayasetuju": "0"
                },
                {
                    "nosepapotek": "1801A00104190000003",
                    "nosepaasal": "1801R0010419V000001",
                    "nokartu": "0000000000044",
                    "namapeserta": "AGUSMA",
                    "noresep": "00002",
                    "jnsobat": "Obat Kemoterapi",
                    "tglpelayanan": "2019-04-04",
                    "biayapengajuan": "0",
                    "biayasetuju": "0"
                }
            ]
        },
        "metaData": {
            "code": "200",
            "message": "Ok"
        }
    }
}

## [GET] REKAP PESERTA PRB : {BASE URL}/{Service Name}/Prb/rekappeserta/tahun/{parameter 1}/bulan/{parameter 2}
Parameter 1 : Tahun

Parameter 2 : Bulan

Response :
{
    "response": {
        "list": [
            {
                "No": 1,
                "NamaPeserta": "ZA*****",
                "NomorKaPst": "0002078775922",
                "Alamat": ", KELURAHAN, KECAMATAN, KABUPATEN",
                "TglSRB": "07/02/2025 00:00:00",
                "Diagnosa": "K30",
                "Obat": "Analog Insulin Long Acting inj 100 UI/ml, flexpen 3 ml",
                "DPJP": "Tenaga Medis 11230",
                "AsalFaskes": "RSU SERENAPITA"
            },
            {
                "No": 2,
                "NamaPeserta": "ZA*****",
                "NomorKaPst": "0002078775922",
                "Alamat": ", KELURAHAN, KECAMATAN, KABUPATEN",
                "TglSRB": "07/02/2025 00:00:00",
                "Diagnosa": "K30",
                "Obat": "Analog Insulin Long Acting inj 100 UI/ml, flexpen 3 ml",
                "DPJP": "Tenaga Medis 11230",
                "AsalFaskes": "RSU SERENAPITA"
            },
            {
                "No": 3,
                "NamaPeserta": "MUHAMMAD AKBAR",
                "NomorKaPst": "0002043779758",
                "Alamat": "PERUM. GRAHA METRO SERANG BLOK C2 NO.11",
                "TglSRB": "11/02/2025 00:00:00",
                "Diagnosa": "I12",
                "Obat": "Amiodaron tab 200 mg",
                "DPJP": "Tenaga Medis 216825",
                "AsalFaskes": "RS MITRA JAMBI"
            },
            {
                "No": 4,
                "NamaPeserta": "MUHAMMAD AKBAR",
                "NomorKaPst": "0002043779758",
                "Alamat": "PERUM. GRAHA METRO SERANG BLOK C2 NO.11",
                "TglSRB": "11/02/2025 00:00:00",
                "Diagnosa": "I12",
                "Obat": "Amiodaron tab 200 mg",
                "DPJP": "Tenaga Medis 216825",
                "AsalFaskes": "RS MITRA JAMBI"
            },
            {
                "No": 5,
                "NamaPeserta": "IKMAL MAULANA",
                "NomorKaPst": "0002035117001",
                "Alamat": "RANOKETANG ATAS JG III",
                "TglSRB": "12/02/2025 00:00:00",
                "Diagnosa": "N20.0",
                "Obat": "Vitamin B1 (Thiamin HCl) tab 50 mg",
                "DPJP": "Tenaga Medis 30921",
                "AsalFaskes": "RSU GUNUNG MARIA TOMOHON"
            },
            {
                "No": 6,
                "NamaPeserta": "IKMAL MAULANA",
                "NomorKaPst": "0002035117001",
                "Alamat": "RANOKETANG ATAS JG III",
                "TglSRB": "12/02/2025 00:00:00",
                "Diagnosa": "N20.0",
                "Obat": "Vitamin B1 (Thiamin HCl) tab 50 mg",
                "DPJP": "Tenaga Medis 30921",
                "AsalFaskes": "RSU GUNUNG MARIA TOMOHON"
            },
            {
                "No": 7,
                "NamaPeserta": "ELI YUSNITA LUBIS",
                "NomorKaPst": "0002032127111",
                "Alamat": "Surabaya",
                "TglSRB": "13/02/2025 00:00:00",
                "Diagnosa": "A05",
                "Obat": "Amiodaron tab 200 mg",
                "DPJP": "Tenaga Medis 536",
                "AsalFaskes": "RSKIA MAHKOTA BUNDA"
            },
            {
                "No": 8,
                "NamaPeserta": "ELI YUSNITA LUBIS",
                "NomorKaPst": "0002032127111",
                "Alamat": "Surabaya",
                "TglSRB": "13/02/2025 00:00:00",
                "Diagnosa": "A05",
                "Obat": "Amiodaron tab 200 mg",
                "DPJP": "Tenaga Medis 536",
                "AsalFaskes": "RSKIA MAHKOTA BUNDA"
            },
            {
                "No": 9,
                "NamaPeserta": "IKMAL MAULANA",
                "NomorKaPst": "0002035117001",
                "Alamat": "Jln. Medan Merdekah",
                "TglSRB": "17/02/2025 00:00:00",
                "Diagnosa": "N20.0",
                "Obat": "Clozapine tab 100 mg",
                "DPJP": "Tenaga Medis 30921",
                "AsalFaskes": "RSU GUNUNG MARIA TOMOHON"
            },
            {
                "No": 10,
                "NamaPeserta": "IKMAL MAULANA",
                "NomorKaPst": "0002035117001",
                "Alamat": "Jln. Medan Merdekah",
                "TglSRB": "17/02/2025 00:00:00",
                "Diagnosa": "N20.0",
                "Obat": "Clozapine tab 100 mg",
                "DPJP": "Tenaga Medis 30921",
                "AsalFaskes": "RSU GUNUNG MARIA TOMOHON"
            },
            {
                "No": 11,
                "NamaPeserta": "jalmono",
                "NomorKaPst": "0002053500557",
                "Alamat": "test alamaty\n",
                "TglSRB": "17/02/2025 00:00:00",
                "Diagnosa": "N17",
                "Obat": "Glimepirid tab 1 mg, Amitriptilin tab sal 25 mg, Vitamin B1 (Thiamin HCl) tab 50 mg, Vitamin B6 (Piridoksin HCl) tab 10 mg",
                "DPJP": "Tenaga Medis 15739",
                "AsalFaskes": "RSU GUNUNG MARIA TOMOHON"
            },
            {
                "No": 12,
                "NamaPeserta": "jalmono",
                "NomorKaPst": "0002053500557",
                "Alamat": "test alamaty\n",
                "TglSRB": "17/02/2025 00:00:00",
                "Diagnosa": "N17",
                "Obat": "Glimepirid tab 1 mg, Amitriptilin tab sal 25 mg, Vitamin B1 (Thiamin HCl) tab 50 mg, Vitamin B6 (Piridoksin HCl) tab 10 mg",
                "DPJP": "Tenaga Medis 15739",
                "AsalFaskes": "RSU GUNUNG MARIA TOMOHON"
            },
            {
                "No": 13,
                "NamaPeserta": "JUDIANTO KURNIAWAN",
                "NomorKaPst": "0002039292933",
                "Alamat": "KP BULAKAN RT.06/03 BITUNG JAYA CIKUPA",
                "TglSRB": "19/02/2025 00:00:00",
                "Diagnosa": "I12",
                "Obat": "Amlodipin tab 5 mg",
                "DPJP": "Tenaga Medis 216825",
                "AsalFaskes": "RS MITRA JAMBI"
            },
            {
                "No": 14,
                "NamaPeserta": "JUDIANTO KURNIAWAN",
                "NomorKaPst": "0002039292933",
                "Alamat": "KP BULAKAN RT.06/03 BITUNG JAYA CIKUPA",
                "TglSRB": "19/02/2025 00:00:00",
                "Diagnosa": "I12",
                "Obat": "Amlodipin tab 5 mg",
                "DPJP": "Tenaga Medis 216825",
                "AsalFaskes": "RS MITRA JAMBI"
            },
            {
                "No": 15,
                "NamaPeserta": "NURMA M. ALI",
                "NomorKaPst": "0002048356967",
                "Alamat": "KP. TEGAL",
                "TglSRB": "19/02/2025 00:00:00",
                "Diagnosa": "I12",
                "Obat": "Amlodipin tab 10 mg, Metformin tab 500 mg",
                "DPJP": "Tenaga Medis 216825",
                "AsalFaskes": "RS MITRA JAMBI"
            },
            {
                "No": 16,
                "NamaPeserta": "NURMA M. ALI",
                "NomorKaPst": "0002048356967",
                "Alamat": "KP. TEGAL",
                "TglSRB": "19/02/2025 00:00:00",
                "Diagnosa": "I12",
                "Obat": "Amlodipin tab 10 mg, Metformin tab 500 mg",
                "DPJP": "Tenaga Medis 216825",
                "AsalFaskes": "RS MITRA JAMBI"
            }
        ]
    },
    "metaData": {
        "code": "200",
        "message": "OK"
    }
}
