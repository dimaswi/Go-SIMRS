# REQUEST

```json
{
	"metadata": {
		"method": "get_claim_data"
	},
	"data": {
		"nomor_sep": "0001R0016120666662"
	}
}
```

# RESPONSE

```json
{
	"metadata": {
		"code": 200,
		"message": "Ok"
	},
	"response": {
		"data": {
			"kode_rs": "0000000",
			"kelas_rs": "A",
			"kelas_rawat": 3,
			"kode_tarif": "AP",
			"jenis_rawat": 1,
			"tgl_masuk": "22/08/2025",
			"tgl_pulang": "25/08/2025",
			"cara_masuk": "gp",
			"tgl_lahir": "31/01/1992",
			"berat_lahir": "0",
			"gender": 2,
			"discharge_status": "1",
			"diagnosa": "O82.9",
			"procedure": "81.51",
			"diagnosa_inagrouper": "S71.0",
			"procedure_inagrouper": "81.51",
			"adl_sub_acute": 0,
			"adl_chronic": 0,
			"tarif_rs": {
				"prosedur_non_bedah": 300000,
				"prosedur_bedah": 20000000,
				"konsultasi": 300000,
				"tenaga_ahli": 200000,
				"keperawatan": 80000,
				"penunjang": 1000000,
				"radiologi": 500000,
				"laboratorium": 600000,
				"pelayanan_darah": 150000,
				"rehabilitasi": 100000,
				"kamar": 6000000,
				"rawat_intensif": 2500000,
				"obat": 100000,
				"obat_kronis": 1000000,
				"obat_kemoterapi": 5000000,
				"alkes": 500000,
				"bmhp": 400000,
				"sewa_alat": 210000
			},
			"sistole": "110",
			"diastole": "60",
			"los": "4",
			"icu_indikator": 0,
			"icu_los": "0",
			"ventilator_hour": "0",
			"upgrade_class_ind": "0",
			"upgrade_class_class": "",
			"upgrade_class_los": "0",
			"add_payment_pct": "0.0",
			"add_payment_amt": "0",
			"upgrade_class_payor": null,
			"nama_pasien": "TEST PASIEN",
			"nomor_rm": "R002188",
			"umur_tahun": 33,
			"umur_hari": "12257",
			"tarif_poli_eks": "0",
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
			"nama_dokter": "DR. BUDI SANTOSO, SP.A",
			"nomor_sep": "000R000TEST",
			"nomor_kartu": "0001234999",
			"payor_id": "3",
			"payor_nm": "JKN",
			"coder_nm": "INACBG",
			"coder_nik": "00001",
			"patient_id": "1",
			"admission_id": "1",
			"hospital_admission_id": "1",
			"grouping_count": "5",
			"grouper": {
				"response_inacbg": {
					"cbg": {
						"code": "-",
						"description": "ERROR: NO CBG ASSIGN"
					},
					"kelas": "kelas_3",
					"inacbg_version": "5.10.5.202510071053",
					"status_cd": "normal"
				},
				"response_idrg": {
					"mdc_number": "33",
					"mdc_description": "Injuries, Poisonings and Toxic Effects of Drugs",
					"drg_code": "3303110",
					"drg_description": "Other OR Procedures for Injuries w/ No CC",
					"script_version": "1.0.29",
					"logic_version": "0.2.1747.202510161025",
					"cost_weight": "1.34",
					"sub_acute_weight": "0.00",
					"chronic_weight": "0.00",
					"total_cost_weight": "1.34",
					"nbr": "8037060",
					"status_cd": "final"
				}
			},
			"kemenkes_dc_status_cd": "unsent",
			"kemenkes_dc_sent_dttm": "-",
			"bpjs_dc_status_cd": "unsent",
			"bpjs_dc_sent_dttm": "-",
			"klaim_status_cd": "normal",
			"bpjs_klaim_status_cd": "-",
			"bpjs_klaim_status_nm": "-"
		}
	}
}
```


```json
{
  "metadata": {
    "code": 200,
    "message": "Ok"
  },
  "response": {
    "data": {
      "kode_rs": "K3522001",
      "kelas_rs": "D",
      "kelas_rawat": 3,
      "kode_tarif": "DS",
      "jenis_rawat": 1,
      "tgl_masuk": "17/03/2026",
      "tgl_pulang": "17/03/2026",
      "cara_masuk": "hosp-trans",
      "tgl_lahir": "10/02/2015",
      "berat_lahir": "0",
      "gender": 1,
      "discharge_status": 1,
      "diagnosa": "S72.0",
      "procedure": "81.51",
      "diagnosa_inagrouper": "S71.0#A00.1",
      "procedure_inagrouper": "81.52#88.38#86.22+2#86.22#90.090",
      "adl_sub_acute": 0,
      "adl_chronic": 0,
      "tarif_rs": {
        "prosedur_non_bedah": 0,
        "prosedur_bedah": 0,
        "konsultasi": 0,
        "tenaga_ahli": 0,
        "keperawatan": 0,
        "penunjang": 0,
        "radiologi": 0,
        "laboratorium": 0,
        "pelayanan_darah": 0,
        "rehabilitasi": 0,
        "kamar": 0,
        "rawat_intensif": 0,
        "obat": 0,
        "obat_kronis": 0,
        "obat_kemoterapi": 0,
        "alkes": 0,
        "bmhp": 0,
        "sewa_alat": 0
      },
      "sistole": "0",
      "diastole": "0",
      "los": "1",
      "icu_indikator": 0,
      "icu_los": "0",
      "ventilator_hour": "0",
      "ventilator": {
        "use_ind": "0",
        "start_dttm": "0000-00-00 00:00:00",
        "stop_dttm": "0000-00-00 00:00:00"
      },
      "upgrade_class_ind": "0",
      "upgrade_class_class": "",
      "upgrade_class_los": "0",
      "add_payment_pct": "0.0",
      "add_payment_amt": "0",
      "upgrade_class_payor": null,
      "nama_pasien": "ANDI PRATAMA",
      "nomor_rm": "0000011",
      "umur_tahun": 11,
      "umur_hari": "4053",
      "tarif_poli_eks": "0",
      "dializer_single_use": "0",
      "alteplase_ind": "0",
      "kantong_darah": "0",
      "nama_dokter": "DR. GAGAK ISMANOE",
      "nomor_sep": "0202S0010226V000013",
      "nomor_kartu": "0002038783623",
      "payor_id": "3",
      "payor_nm": "JKN",
      "coder_nm": "INACBG",
      "coder_nik": "00001",
      "patient_id": "1",
      "admission_id": "5",
      "hospital_admission_id": "6",
      "grouping_count": "5",
      "grouper": {
        "response_inacbg": {
          "cbg": {
            "code": "M-1-04-I",
            "description": "PROSEDUR PADA SENDI TUNGKAI BAWAH (RINGAN)"
          },
          "base_tariff": "8285700",
          "tariff": "8285700",
          "special_cmg": [
            {
              "code": "YY-01-II",
              "description": "HIP REPLACEMENT / KNEE REPLACEMENT",
              "tariff": 0,
              "type": "Special Procedure"
            },
            {
              "code": "RR-04-III-Hip",
              "description": "HIP IMPLANT",
              "tariff": 0,
              "type": "Special Prosthesis"
            }
          ],
          "kelas": "kelas_3",
          "inacbg_version": "5.10.6.202601010630.dev",
          "status_cd": "final"
        },
        "response_idrg": {
          "mdc_number": "31",
          "mdc_description": "Multiple Significant Trauma",
          "drg_code": "3103119",
          "drg_description": "Multiple Significant Trauma w/ Multiple Wound Debridement",
          "script_version": "1.0.30",
          "logic_version": "0.2.1778.202512041107",
          "cost_weight": "5.60",
          "sub_acute_weight": "0.00",
          "chronic_weight": "0.00",
          "total_cost_weight": "5.6",
          "nbr": "8037060",
          "status_cd": "final"
        }
      },
      "kemenkes_dc_status_cd": "unsent",
      "kemenkes_dc_sent_dttm": "-",
      "bpjs_dc_status_cd": "unsent",
      "bpjs_dc_sent_dttm": "-",
      "klaim_status_cd": "normal",
      "bpjs_klaim_status_cd": "-",
      "bpjs_klaim_status_nm": "-"
    }
  }
}
```

