# set_claim_data
{
  "metadata": {
    "method": "set_claim_data",
    "nomor_sep": "0001R0016120507422"
  },
  "data": {
    "nomor_sep": "0001R0016120507422",
    "nomor_kartu": "233333",
    "tgl_masuk": "2023-01-25 12:55:00",
    "tgl_pulang": "2023-01-31 09:55:00",
    "cara_masuk": "gp",
    "jenis_rawat": "1",
    "kelas_rawat": "1",
    "adl_sub_acute": "15",
    "adl_chronic": "12",
    "icu_indikator": "1",
    "icu_los": "2",
    "ventilator_hour": "5",
    "ventilator": {
      "use_ind": "1",
      "start_dttm": "2023-01-26 12:55:00",
      "stop_dttm": "2023-02-26 17:50:00"
    },
    "upgrade_class_ind": "1",
    "upgrade_class_class": "vip",
    "upgrade_class_los": "5",
    "upgrade_class_payor": "peserta",
    "add_payment_pct": "35",
    "birth_weight": "0",
    "sistole": 120,
    "diastole": 70,
    "discharge_status": "1",
    "tarif_rs": {
      "prosedur_non_bedah": "300000",
      "prosedur_bedah": "20000000",
      "konsultasi": "300000",
      "tenaga_ahli": "200000",
      "keperawatan": "80000",
      "penunjang": "1000000",
      "radiologi": "500000",
      "laboratorium": "600000",
      "pelayanan_darah": "150000",
      "rehabilitasi": "100000",
      "kamar": "6000000",
      "rawat_intensif": "2500000",
      "obat": "100000",
      "obat_kronis": "1000000",
      "obat_kemoterapi": "5000000",
      "alkes": "500000",
      "bmhp": "400000",
      "sewa_alat": "210000"
    },
    "nomor_kartu_t": "nik",
    "bayi_lahir_status_cd": 1,
    "dializer_single_use": 0,
    "kantong_darah": 1,
    "alteplase_ind": 0,
    "apgar": {
      "menit_1": {
        "appearance": 1,
        "pulse": 2,
        "grimace": 1,
        "activity": 1,
        "respiration": 1
      },
      "menit_5": {
        "appearance": 2,
        "pulse": 2,
        "grimace": 2,
        "activity": 2,
        "respiration": 2
      }
    },
    "persalinan": {
      "usia_kehamilan": "22",
      "gravida": "2",
      "partus": "4",
      "abortus": "2",
      "onset_kontraksi": "induksi",
      "delivery": [
        {
          "delivery_sequence": "1",
          "delivery_method": "vaginal",
          "delivery_dttm": "2023-01-21 17:01:33",
          "letak_janin": "kepala",
          "kondisi": "livebirth",
          "use_manual": "1",
          "use_forcep": "0",
          "use_vacuum": "1",
          "shk_spesimen_ambil": "ya",
          "shk_lokasi": "tumit",
          "shk_spesimen_dttm": "2023-11-21 18:11:33"
        },
        {
          "delivery_sequence": "2",
          "delivery_method": "vaginal",
          "delivery_dttm": "2023-01-21 17:03:49",
          "letak_janin": "lintang",
          "kondisi": "livebirth",
          "use_manual": "1",
          "use_forcep": "0",
          "use_vacuum": "0",
          "shk_spesimen_ambil": "tidak",
          "shk_alasan": "akses-sulit"
        }
      ]
    },
    "tarif_poli_eks": "100000",
    "nama_dokter": "RUDY, DR",
    "kode_tarif": "AP",
    "payor_id": "3",
    "payor_cd": "JKN",
    "cob_cd": "0001",
    "coder_nik": "123123123123"
  }
}

# KONDISI set_claim_data
1. tgl_masuk : Tanggal masuk pasien untuk episode perawatan yang diklaim
2. tgl_pulang : Tanggal pulang
3. cara_masuk : gp = Rujukan FKTP, hosp-trans = Rujukan FKRTL, mp = Rujukan Spesialis, outp = Dari Rawat Jalan, inp = Dari Rawat Inap, emd = Dari Rawat Darurat, born = Lahir di RS, nursing = Rujukan Panti Jompo, psych = Rujukan dari RS Jiwa, rehab = Rujukan Fasilitas Rehab, other = Lain-lain
4. jenis_rawat : 1 = rawat inap, 2 = rawat jalan
5. kelas_rawat : 3 = Kelas 3, 2 = Kelas 2, 1 = Kelas 11
6. adl_sub_acute : ADL = Activities of Daily Living Score untuk pasien sub acute, nilainya 12 s/d 60
7. adl_chronic : Activities of Daily Living Score untuk pasien chronic nilainya 12 s/d 60
8. icu_indicator : Jika pasien masuk ICU selama dalam episode perawatan maka diisi "1" (satu). Jika tidak ada perawatan ICU maka diisi "0" (nol).
9. icu_los : Jumlah hari rawat di ICU
10. ventilator_hour : Jumlah jam pemakaian ventilator jika di ICU Tambahan element ventilator: use_ind: 1 = ada pemakaian, 0 = tidak ada pemakaian start_dttm: waktu mulai, format yyyy-mm-dd hh:mm:ss stop_dttm: waktu selesai, format yyyy-mm-dd hh:mm:ss Tambahan element ventilator ini tidak menghilangkan element ventilator_hour sebelumnya untuk backward compatibility
upgrade_class_ind, upgrade_class_class, upgrade_class_los, dan add_payment_pct dijelaskan sebagai berikut: Untuk naik kelas, gunakan parameter upgrade_class_ind = "1" (satu) jika ada naik kelas, dan "0" (nol) jika tidak ada naik kelas. Untuk kenaikan kelas yang dituju gunakan parameter upgrade_class_class:
kelas_1 = naik ke kelas 1
kelas_2 = naik ke kelas 2
vip = naik ke kelas vip
vvip = naik ke kelas vvip (tidak berlaku semenjak 24 Januari 2024. Merujuk pada KMK 3 2023) Untuk lama hari rawat yang naik kelas gunakan parameter upgrade_class_los, diisi dalam format integer lama hari rawat yang naik kelas. Parameter add_payment_pct adalah koefisien tambahan biaya khusus jika pasien naik ke kelas VIP (diatas Kelas 1). Parameter upgrade_class_payor diisi dengan "peserta" atau "pemberi_kerja" atau "asuransi_tambahan". Untuk penggunaan parameter upgrade_class_ind, upgrade_class_class, upgrade_class_los dan add_payment_pct, upgrade_class_payor harus disertakan 5 parameter tersebut secara bersamaan. Parameter payor_id dan payor_cd dapat diperoleh pada aplikasi E-Klaim, dari group Pengaturan dan Pemeliharaan, menu Setup, Jaminan. Parameter payor_id diisi dengan Payplan ID, sedangkan parameter payor_cd diisi dengan Code, seperti tersebut dibawah ini: Parameter payor_id ini menjadi mandatory sejak versi 5.4.11. Khusus untuk coder_nik sifatnya mandatory. Dan untuk NIK yang disertakan haruslah sudah terdaftar sebagai NIK pada user (Personnel Registration) di Aplikasi E-Klaim. Jika NIK tersebut tidak terdaftar maka proses update akan gagal. Parameter selain yang tercantum pada metadata dan parameter mandatory (coder_nik) adalah sifatnya opsional, yaitu jika disertakan maka akan mengubah (update, replace) namun jika tidak disertakan maka artinya tidak ada perubahan. Hal ini untuk memberikan kemungkinan bagi SIMRS untuk mengirim data secara bertahap menyesuaikan alur data yang sesuai alur kerja di rumah
sakit. Untuk penandaan kelas pasien rawat jalan (Kelas Regular dan Kelas Eksekutif), maka nilai kelas_rawat adalah:
3 = regular
1 = eksekutif
List untuk payor sebagai berikut :
00003	JKN	JKN
00078	JAMINAN KK/PAK	JKKPAK
00077	JAMINAN PEMULIHAN KESEHATAN PRIORITAS	JPKP
00076	JAMPERSAL	JPS
00071	JAMINAN COVID-19	COVID-19
00072	JAMINAN KIPI	KIPI
00073	JAMINAN BAYI BARU LAHIR	BBL
00074	JAMINAN PERPANJANGAN MASA RAWAT	PMR
00075	JAMINAN CO-INSIDENSE	CO-INS
11. discharge_status : Cara pulang didefinisikan sebagai berikut:
1 = Atas persetujuan dokter
2 = Dirujuk
3 = Atas permintaan sendiri
4 = Meninggal
5 = Lain-lain
12. sistole & diastole: Tekanan darah, dalam mmHg
dializer_single_use: Khusus untuk hemodialisa(CBG: N-3-15-0), diisi:
"1" = single use
"0" = multiple use
13. apgar: Terdiri dari dua bagian yaitu menit pertama (menit_1) dan menit kelima (menit_5), yang masing-masing bagian memiliki element: appearance, pulse, grimace, activity dan respiration. Untuk setiap element diisi nilai antara 0,1, atau 2. Parameter ini akan selalu disimpan terlepas dari kondisi detail klaim yang diberikan namun hanya akan diperhitungkan ketika kondisi terpenuhi, yaitu pasien dengan umur kurang dari sama dengan 1 hari
14. persalinan: Parameter ini akan selalu disimpan terlepas dari kondisi detail klaim yang diberikan namun hanya akan diperhitungkan ketika kondisi terpenuhi, yaitu pasien pada rawat inap dengan diagnosa persalinan
15. usia_kehamilan: diisi angka dalam minggu
16. gravida: jumlah kehamilan, diisi angka
17. partus: jumlah kelahiran, diisi angka
18. abortus: jumlah keguguran, diisi angka
19. onset_kontraksi: diisi pilihan: spontan, induksi, non_spontan_non_induksi
20. delivery: berupa array object sebagai berikut:
    - delivery_sequence: urutan kelahiran (jika lahir lebih dari satu bayi dalam satu kali perawatan), diisi angka dimulai dari 1
    - delivery_method: diisi pilihan: vaginal, atau sc
    - delivery_dttm: waktu kelahiran, format yyyy-mm-dd hh:mm:ss
    - letak_janin: letak janin, diisi pilihan: kepala, sungsang,
    - lintang kondisi: kondisi bayi waktu lahir, pilihan: livebirth, stillbirth
    - use_manual: lahir dengan bantuan manual, diisi 0 = tidak, 1 = ya
    - use_forcep: penggunaan forcep, diisi 0 = tidak, 1 = ya
    - use_vacuum: penggunaan vacuum, diisi 0 = tidak, 1 = ya
    - shk_spesimen_ambil: diisi "ya", "tidak"
    - shk_lokasi: diisi "tumit", "vena"
    - shk_alasan: diisi "tidak-dapat", "akses-sulit"
    - shk_spesimen_dttm: waktu pengambilan, format yyyy-mm-dd hh:mm:ss
    kantong_darah: Diisi dengan jumlah kantong darah yang diberikan
21. kepada pasien. Parameter ini digunakan berdampingan dengan parameter pelayanan_darah pada tarif_rs.
dimunculkan ketika :
    - Kode CBGnya adalah N-3-15-0,
    - Terdapat diagnosa Beta thalassaemia (D56.1) atau
    - Terdapat diagnosa Leukimia (C91* - C95*).
Ketentuan lebih lanjut merujuk kepada Permenkes RI No. 3 Tahun 2023, Pasal 45 ayat 1, “Pelayanan kantong darah sebagaimana dimaksud dalam Pasal 36 ayat (1) huruf h diberikan untuk thalassemia mayor, hemodialisa, dan kanker (leukemia) yang membutuhkan pelayanan darah pada rawat jalan.“
22. alteplase_ind: Diisi 1 jika ada pemberian alteplase, 0 jika tidak. pilihan alteplase hanya dimunculkan ketika kode CBG adalah G-4-14-* KECEDERAAN PEMBULUH DARAH OTAK DENGAN INFARK, semua level, baik RINGAN, SEDANG, dan BERAT.
23. tarif_rs : Untuk parameter tarif_rs disediakan parameter breakdown seperti tersebut pada json diatas. Nilai tarif_rs sendiri akan dihitung berdasarkan jumlah dari breakdown tersebut yaitu: prosedur_non_bedah, prosedur_bedah, konsultasi, tenaga_ahli, keperawatan, penunjang, radiologi, laboratorium, pelayanan_darah, rehabilitasi, kamar, rawat_intensif, obat, obat_kronis, obat_kemoterapi, alkes, , bmhp, dan sewa_alat. Masing-masing diisi dengan nilai integer. Untuk definisi operasional parameter tersebut silakan merujuk pada petunjuk teknis Aplikasi E-Klaim.
24. nomor_kartu_t : Untuk tambahan khusus pasien Jaminan COVID-19, parameter ini membedakan nilai yang tersebut di dalam parameter nomor_kartu. Isinya dengan pilihan:
    - nik = untuk Nomor Induk Kependudukan
    - kitas = untuk KITAS/KITAP.
    - KITAS : Kartu Ijin Tinggal Terbatas
    - KITAP : Kartu Ijin Tinggal Tetap
    - paspor = untuk Nomor Passport, jika WNA.
    - kartu_jkn = untuk Nomor Kartu Peserta JKN (BPJS)
    - kk = untuk nomor pada Kartu Keluarga
    - unhcr = untuk nomor pada dokumen dari UNHCR
    - kelurahan = untuk nomor pada dokumen dari kelurahan
    - dinsos = untuk nomor pada dokumen dari Dinas Sosial
    - dinkes = untuk nomor pada dokumen dari Dinas Kesehatan
    - sjp = untuk nomor Surat Jaminan Perawatan (SJP)
    - klaim_ibu = mandatori untuk jaminan bayi baru lahir.
    - lainnya = untuk nomor identitas lainnya yang dapat dipertanggungjawabkan oleh rumah sakit dan lembaga yang berwenang lainnya
25. ayi_lahir_status_cd : Diisi hanya jika payor_id = 73 (Jaminan Bayi Baru Lahir) dengan nilai acuan sebagai berikut:
    - Tanpa Kelainan
    - Dengan Kelainan
26. kode_tarif : Kode tarif adalah kelas tarif INA-CBG berdasarkan kelas rumah sakit dan kepemilikannya. Kode dan penjelasan sebagai berikut:
    - AP = TARIF RS KELAS A PEMERINTAH
    - AS = TARIF RS KELAS A SWASTA
    - BP = TARIF RS KELAS B PEMERINTAH
    - BS = TARIF RS KELAS B SWASTA
    - CP = TARIF RS KELAS C PEMERINTAH
    - CS = TARIF RS KELAS C SWASTA
    - DP = TARIF RS KELAS D PEMERINTAH
    - DS = TARIF RS KELAS D SWASTA
    - RSCM = TARIF RSUPN CIPTO MANGUNKUSUMO
    - RSJP = TARIF RSJPD HARAPAN KITA
    - RSD = TARIF RS KANKER DHARMAIS
    - RSAB = TARIF RSAB HARAPAN KITA
27. cob_cd : Adalah jika klaim ini adalah klaim dengan Coordination of Benefit. Untuk cob_cd, dapat dilihat pada pengaturan, menu COB. Untuk tidak memilih (menghapus) cob_cd dari klaim silakan parameter tersebut diisi dengan kode "#".