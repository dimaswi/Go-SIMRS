package migrations

import (
	"starter/backend/models"

	"gorm.io/gorm"
)

// SeedProcedures seeds Procedure and ProcedureTariff data
func SeedProcedures(db *gorm.DB) error {
	// ==========================================
	// PROCEDURES - Tindakan Medis
	// ==========================================
	procedures := []models.Procedure{
		// =====================================
		// PEMERIKSAAN UMUM
		// =====================================
		{
			Code: "TDK-001", Name: "Konsultasi Dokter Umum",
			Description:   "Pemeriksaan dan konsultasi dengan dokter umum",
			ProcedureType: "medical", ProcedureGroup: "konsultasi", Specialty: "umum",
			Duration: 15, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "TDK-002", Name: "Konsultasi Dokter Spesialis",
			Description:   "Pemeriksaan dan konsultasi dengan dokter spesialis",
			ProcedureType: "medical", ProcedureGroup: "konsultasi", Specialty: "spesialis",
			Duration: 20, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "TDK-003", Name: "Pemeriksaan Kesehatan Umum (MCU)",
			Description:   "Medical Check Up lengkap",
			ProcedureType: "medical", ProcedureGroup: "pemeriksaan", Specialty: "umum",
			Duration: 60, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},

		// =====================================
		// TINDAKAN UGD
		// =====================================
		{
			Code: "UGD-001", Name: "Triase UGD",
			Description:   "Pemeriksaan triase di Unit Gawat Darurat",
			ProcedureType: "medical", ProcedureGroup: "triase", Specialty: "ugd",
			Duration: 10, RequiresAnesthesia: false, IsEmergency: true, IsSurgical: false,
			ServiceType: "gawat_darurat", IsActive: true,
		},
		{
			Code: "UGD-002", Name: "Resusitasi Jantung Paru (RJP)",
			Description:   "Tindakan resusitasi jantung paru darurat",
			ProcedureType: "medical", ProcedureGroup: "resusitasi", Specialty: "ugd",
			Duration: 30, RequiresAnesthesia: false, IsEmergency: true, IsSurgical: false,
			ServiceType: "gawat_darurat", IsActive: true,
		},
		{
			Code: "UGD-003", Name: "Pemasangan Infus",
			Description:   "Pemasangan jalur intravena",
			ProcedureType: "medical", ProcedureGroup: "tindakan_keperawatan", Specialty: "ugd",
			Duration: 10, RequiresAnesthesia: false, IsEmergency: true, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "UGD-004", Name: "Nebulizer",
			Description:   "Terapi inhalasi dengan nebulizer",
			ProcedureType: "medical", ProcedureGroup: "tindakan_keperawatan", Specialty: "paru",
			Duration: 15, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "UGD-005", Name: "Jahit Luka Ringan",
			Description:   "Penjahitan luka ringan (< 5 cm)",
			ProcedureType: "medical", ProcedureGroup: "bedah_minor", Specialty: "bedah",
			Duration: 20, RequiresAnesthesia: true, AnesthesiaType: "lokal", IsEmergency: true, IsSurgical: true,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "UGD-006", Name: "Jahit Luka Sedang",
			Description:   "Penjahitan luka sedang (5-10 cm)",
			ProcedureType: "medical", ProcedureGroup: "bedah_minor", Specialty: "bedah",
			Duration: 30, RequiresAnesthesia: true, AnesthesiaType: "lokal", IsEmergency: true, IsSurgical: true,
			ServiceType: "all", IsActive: true,
		},

		// =====================================
		// TINDAKAN BEDAH
		// =====================================
		{
			Code: "BDH-001", Name: "Operasi Caesar",
			Description:   "Sectio Caesarea / Operasi Caesar",
			ProcedureType: "medical", ProcedureGroup: "bedah_mayor", Specialty: "obsgin",
			ICD9CMCode: "74.0", Duration: 90, RequiresAnesthesia: true, AnesthesiaType: "spinal",
			IsEmergency: false, IsSurgical: true, ServiceType: "rawat_inap", IsActive: true,
		},
		{
			Code: "BDH-002", Name: "Appendektomi",
			Description:   "Operasi pengangkatan usus buntu",
			ProcedureType: "medical", ProcedureGroup: "bedah_mayor", Specialty: "bedah",
			ICD9CMCode: "47.09", Duration: 60, RequiresAnesthesia: true, AnesthesiaType: "general",
			IsEmergency: true, IsSurgical: true, ServiceType: "rawat_inap", IsActive: true,
		},
		{
			Code: "BDH-003", Name: "Herniotomi",
			Description:   "Operasi hernia / turun berok",
			ProcedureType: "medical", ProcedureGroup: "bedah_mayor", Specialty: "bedah",
			ICD9CMCode: "53.0", Duration: 60, RequiresAnesthesia: true, AnesthesiaType: "spinal",
			IsEmergency: false, IsSurgical: true, ServiceType: "rawat_inap", IsActive: true,
		},
		{
			Code: "BDH-004", Name: "Sirkumsisi",
			Description:   "Sunat / Khitan",
			ProcedureType: "medical", ProcedureGroup: "bedah_minor", Specialty: "bedah",
			Duration: 30, RequiresAnesthesia: true, AnesthesiaType: "lokal",
			IsEmergency: false, IsSurgical: true, ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "BDH-005", Name: "Insisi Abses",
			Description:   "Pembedahan dan drainase abses",
			ProcedureType: "medical", ProcedureGroup: "bedah_minor", Specialty: "bedah",
			Duration: 20, RequiresAnesthesia: true, AnesthesiaType: "lokal",
			IsEmergency: false, IsSurgical: true, ServiceType: "all", IsActive: true,
		},

		// =====================================
		// KEBIDANAN
		// =====================================
		{
			Code: "KBD-001", Name: "Persalinan Normal",
			Description:   "Persalinan pervaginam normal",
			ProcedureType: "medical", ProcedureGroup: "persalinan", Specialty: "obsgin",
			Duration: 120, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_inap", IsActive: true,
		},
		{
			Code: "KBD-002", Name: "USG Kehamilan 2D",
			Description:   "Pemeriksaan USG kandungan 2 dimensi",
			ProcedureType: "radiology", ProcedureGroup: "usg", Specialty: "obsgin",
			Duration: 15, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "KBD-003", Name: "USG Kehamilan 4D",
			Description:   "Pemeriksaan USG kandungan 4 dimensi",
			ProcedureType: "radiology", ProcedureGroup: "usg", Specialty: "obsgin",
			Duration: 20, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "KBD-004", Name: "Kuret",
			Description:   "Kuretase / Dilatasi dan Kuretase",
			ProcedureType: "medical", ProcedureGroup: "bedah_minor", Specialty: "obsgin",
			ICD9CMCode: "69.02", Duration: 30, RequiresAnesthesia: true, AnesthesiaType: "sedasi",
			IsEmergency: false, IsSurgical: true, ServiceType: "rawat_inap", IsActive: true,
		},

		// =====================================
		// GIGI
		// =====================================
		{
			Code: "GIG-001", Name: "Konsultasi Gigi",
			Description:   "Pemeriksaan dan konsultasi dokter gigi",
			ProcedureType: "medical", ProcedureGroup: "konsultasi", Specialty: "gigi",
			Duration: 15, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "GIG-002", Name: "Cabut Gigi",
			Description:   "Ekstraksi gigi biasa",
			ProcedureType: "medical", ProcedureGroup: "bedah_minor", Specialty: "gigi",
			Duration: 20, RequiresAnesthesia: true, AnesthesiaType: "lokal",
			IsEmergency: false, IsSurgical: true, ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "GIG-003", Name: "Tambal Gigi",
			Description:   "Penambalan gigi dengan komposit",
			ProcedureType: "medical", ProcedureGroup: "restorasi", Specialty: "gigi",
			Duration: 30, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "GIG-004", Name: "Scaling / Pembersihan Karang Gigi",
			Description:   "Pembersihan karang gigi dengan ultrasonik",
			ProcedureType: "medical", ProcedureGroup: "perawatan", Specialty: "gigi",
			Duration: 30, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "GIG-005", Name: "Odontektomi",
			Description:   "Pencabutan gigi impaksi/geraham bungsu",
			ProcedureType: "medical", ProcedureGroup: "bedah_minor", Specialty: "gigi",
			Duration: 45, RequiresAnesthesia: true, AnesthesiaType: "lokal",
			IsEmergency: false, IsSurgical: true, ServiceType: "rawat_jalan", IsActive: true,
		},

		// =====================================
		// LABORATORIUM
		// =====================================
		{
			Code: "LAB-001", Name: "Pemeriksaan Darah Lengkap",
			Description:   "Complete Blood Count (CBC) / Darah Rutin",
			ProcedureType: "laboratory", ProcedureGroup: "hematologi", Specialty: "laboratorium",
			Duration: 5, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "LAB-002", Name: "Gula Darah Sewaktu",
			Description:   "Pemeriksaan kadar gula darah sewaktu",
			ProcedureType: "laboratory", ProcedureGroup: "kimia_klinik", Specialty: "laboratorium",
			Duration: 5, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "LAB-003", Name: "Gula Darah Puasa",
			Description:   "Pemeriksaan kadar gula darah puasa",
			ProcedureType: "laboratory", ProcedureGroup: "kimia_klinik", Specialty: "laboratorium",
			Duration: 5, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "LAB-004", Name: "Profil Lipid",
			Description:   "Pemeriksaan kolesterol total, HDL, LDL, trigliserida",
			ProcedureType: "laboratory", ProcedureGroup: "kimia_klinik", Specialty: "laboratorium",
			Duration: 5, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "LAB-005", Name: "Fungsi Hati (SGOT/SGPT)",
			Description:   "Pemeriksaan enzim hati SGOT dan SGPT",
			ProcedureType: "laboratory", ProcedureGroup: "kimia_klinik", Specialty: "laboratorium",
			Duration: 5, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "LAB-006", Name: "Fungsi Ginjal (Ureum/Kreatinin)",
			Description:   "Pemeriksaan ureum dan kreatinin",
			ProcedureType: "laboratory", ProcedureGroup: "kimia_klinik", Specialty: "laboratorium",
			Duration: 5, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "LAB-007", Name: "Urinalisa",
			Description:   "Pemeriksaan urine lengkap",
			ProcedureType: "laboratory", ProcedureGroup: "urinalisa", Specialty: "laboratorium",
			Duration: 5, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "LAB-008", Name: "HbA1c",
			Description:   "Pemeriksaan hemoglobin terglikasi untuk monitoring diabetes",
			ProcedureType: "laboratory", ProcedureGroup: "kimia_klinik", Specialty: "laboratorium",
			Duration: 5, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "LAB-009", Name: "Asam Urat",
			Description:   "Pemeriksaan kadar asam urat",
			ProcedureType: "laboratory", ProcedureGroup: "kimia_klinik", Specialty: "laboratorium",
			Duration: 5, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "LAB-010", Name: "Golongan Darah + Rhesus",
			Description:   "Pemeriksaan golongan darah dan rhesus",
			ProcedureType: "laboratory", ProcedureGroup: "hematologi", Specialty: "laboratorium",
			Duration: 10, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},

		// =====================================
		// RADIOLOGI
		// =====================================
		{
			Code: "RAD-001", Name: "Rontgen Thorax",
			Description:   "Foto rontgen dada PA/AP",
			ProcedureType: "radiology", ProcedureGroup: "rontgen", Specialty: "radiologi",
			Duration: 10, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "RAD-002", Name: "Rontgen Kepala",
			Description:   "Foto rontgen kepala / skull",
			ProcedureType: "radiology", ProcedureGroup: "rontgen", Specialty: "radiologi",
			Duration: 10, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "RAD-003", Name: "Rontgen Extremitas",
			Description:   "Foto rontgen tangan/kaki",
			ProcedureType: "radiology", ProcedureGroup: "rontgen", Specialty: "radiologi",
			Duration: 10, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "RAD-004", Name: "USG Abdomen",
			Description:   "Ultrasonografi abdomen lengkap",
			ProcedureType: "radiology", ProcedureGroup: "usg", Specialty: "radiologi",
			Duration: 20, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "RAD-005", Name: "CT-Scan Kepala",
			Description:   "CT-Scan kepala tanpa kontras",
			ProcedureType: "radiology", ProcedureGroup: "ct_scan", Specialty: "radiologi",
			Duration: 30, RequiresAnesthesia: false, IsEmergency: true, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "RAD-006", Name: "CT-Scan Kepala dengan Kontras",
			Description:   "CT-Scan kepala dengan kontras",
			ProcedureType: "radiology", ProcedureGroup: "ct_scan", Specialty: "radiologi",
			Duration: 45, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "RAD-007", Name: "MRI Kepala",
			Description:   "Magnetic Resonance Imaging kepala",
			ProcedureType: "radiology", ProcedureGroup: "mri", Specialty: "radiologi",
			Duration: 45, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "RAD-008", Name: "EKG",
			Description:   "Elektrokardiografi / Rekam jantung",
			ProcedureType: "radiology", ProcedureGroup: "kardiologi", Specialty: "jantung",
			Duration: 15, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},
		{
			Code: "RAD-009", Name: "Echocardiography",
			Description:   "USG Jantung",
			ProcedureType: "radiology", ProcedureGroup: "kardiologi", Specialty: "jantung",
			Duration: 30, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "all", IsActive: true,
		},

		// =====================================
		// FISIOTERAPI / REHABILITASI
		// =====================================
		{
			Code: "FIS-001", Name: "Fisioterapi - Sesi Awal",
			Description:   "Sesi awal fisioterapi dan asesmen",
			ProcedureType: "medical", ProcedureGroup: "rehabilitasi", Specialty: "fisioterapi",
			Duration: 45, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},
		{
			Code: "FIS-002", Name: "Fisioterapi - Sesi Lanjutan",
			Description:   "Sesi lanjutan fisioterapi",
			ProcedureType: "medical", ProcedureGroup: "rehabilitasi", Specialty: "fisioterapi",
			Duration: 30, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},

		// =====================================
		// HEMODIALISA
		// =====================================
		{
			Code: "HD-001", Name: "Hemodialisa",
			Description:   "Cuci darah / Hemodialisis",
			ProcedureType: "medical", ProcedureGroup: "dialisis", Specialty: "penyakit_dalam",
			Duration: 240, RequiresAnesthesia: false, IsEmergency: false, IsSurgical: false,
			ServiceType: "rawat_jalan", IsActive: true,
		},
	}

	var procedureMap = make(map[string]uint)
	for _, proc := range procedures {
		var existing models.Procedure
		result := db.Where("code = ?", proc.Code).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&proc).Error; err != nil {
				return err
			}
			procedureMap[proc.Code] = proc.ID
		} else {
			procedureMap[proc.Code] = existing.ID
		}
	}

	// ==========================================
	// PROCEDURE TARIFFS
	// ==========================================
	// Define tariff data structure
	type TariffData struct {
		PatientClass   string
		Administrasi   float64
		Sarana         float64
		BHP            float64
		DokterOperator float64
		DokterAnastesi float64
		DokterLainnya  float64
		PenataAnastesi float64
		Paramedis      float64
		NonMedis       float64
	}

	// Tariff templates per procedure type
	tariffTemplates := map[string][]TariffData{
		// Konsultasi Dokter Umum
		"TDK-001": {
			{PatientClass: "non_kelas", Administrasi: 5000, Sarana: 10000, DokterOperator: 50000, Paramedis: 5000},
			{PatientClass: "kelas_3", Administrasi: 5000, Sarana: 15000, DokterOperator: 75000, Paramedis: 7500},
			{PatientClass: "kelas_2", Administrasi: 7500, Sarana: 20000, DokterOperator: 100000, Paramedis: 10000},
			{PatientClass: "kelas_1", Administrasi: 10000, Sarana: 30000, DokterOperator: 125000, Paramedis: 12500},
			{PatientClass: "vip", Administrasi: 15000, Sarana: 50000, DokterOperator: 175000, Paramedis: 17500},
		},
		// Konsultasi Spesialis
		"TDK-002": {
			{PatientClass: "non_kelas", Administrasi: 5000, Sarana: 15000, DokterOperator: 100000, Paramedis: 7500},
			{PatientClass: "kelas_3", Administrasi: 7500, Sarana: 20000, DokterOperator: 150000, Paramedis: 10000},
			{PatientClass: "kelas_2", Administrasi: 10000, Sarana: 30000, DokterOperator: 200000, Paramedis: 15000},
			{PatientClass: "kelas_1", Administrasi: 15000, Sarana: 50000, DokterOperator: 250000, Paramedis: 20000},
			{PatientClass: "vip", Administrasi: 20000, Sarana: 75000, DokterOperator: 350000, Paramedis: 25000},
		},
		// Jahit Luka Ringan
		"UGD-005": {
			{PatientClass: "non_kelas", Administrasi: 5000, Sarana: 25000, BHP: 50000, DokterOperator: 100000, Paramedis: 15000},
			{PatientClass: "kelas_3", Administrasi: 7500, Sarana: 35000, BHP: 60000, DokterOperator: 125000, Paramedis: 20000},
			{PatientClass: "kelas_2", Administrasi: 10000, Sarana: 50000, BHP: 75000, DokterOperator: 150000, Paramedis: 25000},
			{PatientClass: "kelas_1", Administrasi: 15000, Sarana: 75000, BHP: 100000, DokterOperator: 200000, Paramedis: 35000},
			{PatientClass: "vip", Administrasi: 20000, Sarana: 100000, BHP: 125000, DokterOperator: 275000, Paramedis: 50000},
		},
		// Operasi Caesar
		"BDH-001": {
			{PatientClass: "kelas_3", Administrasi: 50000, Sarana: 500000, BHP: 1000000, DokterOperator: 3000000, DokterAnastesi: 750000, PenataAnastesi: 200000, Paramedis: 300000, NonMedis: 100000},
			{PatientClass: "kelas_2", Administrasi: 75000, Sarana: 750000, BHP: 1250000, DokterOperator: 4000000, DokterAnastesi: 1000000, PenataAnastesi: 250000, Paramedis: 400000, NonMedis: 125000},
			{PatientClass: "kelas_1", Administrasi: 100000, Sarana: 1000000, BHP: 1500000, DokterOperator: 5000000, DokterAnastesi: 1250000, PenataAnastesi: 300000, Paramedis: 500000, NonMedis: 150000},
			{PatientClass: "vip", Administrasi: 150000, Sarana: 1500000, BHP: 2000000, DokterOperator: 7500000, DokterAnastesi: 1750000, PenataAnastesi: 400000, Paramedis: 750000, NonMedis: 200000},
		},
		// Appendektomi
		"BDH-002": {
			{PatientClass: "kelas_3", Administrasi: 50000, Sarana: 400000, BHP: 750000, DokterOperator: 2500000, DokterAnastesi: 600000, PenataAnastesi: 150000, Paramedis: 250000, NonMedis: 75000},
			{PatientClass: "kelas_2", Administrasi: 75000, Sarana: 600000, BHP: 1000000, DokterOperator: 3500000, DokterAnastesi: 800000, PenataAnastesi: 200000, Paramedis: 350000, NonMedis: 100000},
			{PatientClass: "kelas_1", Administrasi: 100000, Sarana: 800000, BHP: 1250000, DokterOperator: 4500000, DokterAnastesi: 1000000, PenataAnastesi: 250000, Paramedis: 450000, NonMedis: 125000},
			{PatientClass: "vip", Administrasi: 150000, Sarana: 1200000, BHP: 1750000, DokterOperator: 6500000, DokterAnastesi: 1500000, PenataAnastesi: 350000, Paramedis: 650000, NonMedis: 175000},
		},
		// Darah Lengkap
		"LAB-001": {
			{PatientClass: "non_kelas", Administrasi: 2500, Sarana: 15000, BHP: 25000, Paramedis: 7500},
			{PatientClass: "kelas_3", Administrasi: 3500, Sarana: 20000, BHP: 30000, Paramedis: 10000},
			{PatientClass: "kelas_2", Administrasi: 5000, Sarana: 25000, BHP: 35000, Paramedis: 12500},
			{PatientClass: "kelas_1", Administrasi: 7500, Sarana: 30000, BHP: 45000, Paramedis: 17500},
			{PatientClass: "vip", Administrasi: 10000, Sarana: 40000, BHP: 60000, Paramedis: 25000},
		},
		// Rontgen Thorax
		"RAD-001": {
			{PatientClass: "non_kelas", Administrasi: 5000, Sarana: 30000, BHP: 15000, DokterOperator: 50000, Paramedis: 10000},
			{PatientClass: "kelas_3", Administrasi: 7500, Sarana: 40000, BHP: 20000, DokterOperator: 75000, Paramedis: 12500},
			{PatientClass: "kelas_2", Administrasi: 10000, Sarana: 50000, BHP: 25000, DokterOperator: 100000, Paramedis: 15000},
			{PatientClass: "kelas_1", Administrasi: 15000, Sarana: 75000, BHP: 35000, DokterOperator: 150000, Paramedis: 20000},
			{PatientClass: "vip", Administrasi: 20000, Sarana: 100000, BHP: 50000, DokterOperator: 200000, Paramedis: 30000},
		},
		// CT-Scan Kepala
		"RAD-005": {
			{PatientClass: "non_kelas", Administrasi: 25000, Sarana: 250000, BHP: 100000, DokterOperator: 300000, Paramedis: 50000},
			{PatientClass: "kelas_3", Administrasi: 35000, Sarana: 350000, BHP: 125000, DokterOperator: 400000, Paramedis: 65000},
			{PatientClass: "kelas_2", Administrasi: 50000, Sarana: 450000, BHP: 150000, DokterOperator: 500000, Paramedis: 80000},
			{PatientClass: "kelas_1", Administrasi: 75000, Sarana: 600000, BHP: 200000, DokterOperator: 700000, Paramedis: 100000},
			{PatientClass: "vip", Administrasi: 100000, Sarana: 800000, BHP: 275000, DokterOperator: 1000000, Paramedis: 150000},
		},
		// Hemodialisa
		"HD-001": {
			{PatientClass: "non_kelas", Administrasi: 25000, Sarana: 200000, BHP: 300000, DokterOperator: 150000, Paramedis: 75000},
			{PatientClass: "kelas_3", Administrasi: 35000, Sarana: 275000, BHP: 350000, DokterOperator: 200000, Paramedis: 100000},
			{PatientClass: "kelas_2", Administrasi: 50000, Sarana: 350000, BHP: 425000, DokterOperator: 275000, Paramedis: 125000},
			{PatientClass: "kelas_1", Administrasi: 75000, Sarana: 450000, BHP: 500000, DokterOperator: 350000, Paramedis: 150000},
			{PatientClass: "vip", Administrasi: 100000, Sarana: 600000, BHP: 650000, DokterOperator: 500000, Paramedis: 200000},
		},
	}

	// Create tariffs for each procedure
	for procCode, tariffs := range tariffTemplates {
		procID := procedureMap[procCode]
		if procID == 0 {
			continue
		}

		for _, t := range tariffs {
			var existing models.ProcedureTariff
			result := db.Where("procedure_id = ? AND patient_class = ?", procID, t.PatientClass).First(&existing)
			if result.Error == gorm.ErrRecordNotFound {
				tariff := models.ProcedureTariff{
					ProcedureID:    procID,
					PatientClass:   t.PatientClass,
					Administrasi:   t.Administrasi,
					Sarana:         t.Sarana,
					BHP:            t.BHP,
					DokterOperator: t.DokterOperator,
					DokterAnastesi: t.DokterAnastesi,
					DokterLainnya:  t.DokterLainnya,
					PenataAnastesi: t.PenataAnastesi,
					Paramedis:      t.Paramedis,
					NonMedis:       t.NonMedis,
				}
				if err := db.Create(&tariff).Error; err != nil {
					return err
				}
			}
		}
	}

	return nil
}
