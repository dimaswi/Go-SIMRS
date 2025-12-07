package migrations

import (
	"starter/backend/models"

	"gorm.io/gorm"
)

// SeedMasterData seeds the initial master data
func SeedMasterData(db *gorm.DB) error {
	masterData := []models.MasterData{
		// Gender
		{Category: models.CategoryGender, Code: "L", Name: "Laki-laki", SortOrder: 1, IsActive: true},
		{Category: models.CategoryGender, Code: "P", Name: "Perempuan", SortOrder: 2, IsActive: true},

		// Religion
		{Category: models.CategoryReligion, Code: "islam", Name: "Islam", SortOrder: 1, IsActive: true},
		{Category: models.CategoryReligion, Code: "kristen", Name: "Kristen", SortOrder: 2, IsActive: true},
		{Category: models.CategoryReligion, Code: "katolik", Name: "Katolik", SortOrder: 3, IsActive: true},
		{Category: models.CategoryReligion, Code: "hindu", Name: "Hindu", SortOrder: 4, IsActive: true},
		{Category: models.CategoryReligion, Code: "buddha", Name: "Buddha", SortOrder: 5, IsActive: true},
		{Category: models.CategoryReligion, Code: "konghucu", Name: "Konghucu", SortOrder: 6, IsActive: true},

		// Marital Status
		{Category: models.CategoryMaritalStatus, Code: "belum_menikah", Name: "Belum Menikah", SortOrder: 1, IsActive: true},
		{Category: models.CategoryMaritalStatus, Code: "menikah", Name: "Menikah", SortOrder: 2, IsActive: true},
		{Category: models.CategoryMaritalStatus, Code: "cerai_hidup", Name: "Cerai Hidup", SortOrder: 3, IsActive: true},
		{Category: models.CategoryMaritalStatus, Code: "cerai_mati", Name: "Cerai Mati", SortOrder: 4, IsActive: true},

		// Education Level
		{Category: models.CategoryEducationLevel, Code: "sd", Name: "SD", SortOrder: 1, IsActive: true},
		{Category: models.CategoryEducationLevel, Code: "smp", Name: "SMP", SortOrder: 2, IsActive: true},
		{Category: models.CategoryEducationLevel, Code: "sma", Name: "SMA/SMK", SortOrder: 3, IsActive: true},
		{Category: models.CategoryEducationLevel, Code: "d1", Name: "D1", SortOrder: 4, IsActive: true},
		{Category: models.CategoryEducationLevel, Code: "d2", Name: "D2", SortOrder: 5, IsActive: true},
		{Category: models.CategoryEducationLevel, Code: "d3", Name: "D3", SortOrder: 6, IsActive: true},
		{Category: models.CategoryEducationLevel, Code: "d4_s1", Name: "D4/S1", SortOrder: 7, IsActive: true},
		{Category: models.CategoryEducationLevel, Code: "s2", Name: "S2", SortOrder: 8, IsActive: true},
		{Category: models.CategoryEducationLevel, Code: "s3", Name: "S3", SortOrder: 9, IsActive: true},

		// Employee Type (Tipe Karyawan)
		{Category: models.CategoryEmployeeType, Code: "dokter", Name: "Dokter", SortOrder: 1, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "perawat", Name: "Perawat", SortOrder: 2, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "bidan", Name: "Bidan", SortOrder: 3, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "apoteker", Name: "Apoteker", SortOrder: 4, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "asisten_apoteker", Name: "Asisten Apoteker", SortOrder: 5, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "radiografer", Name: "Radiografer", SortOrder: 6, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "analis_kesehatan", Name: "Analis Kesehatan", SortOrder: 7, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "nutrisionis", Name: "Nutrisionis", SortOrder: 8, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "administrasi", Name: "Administrasi", SortOrder: 9, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "keuangan", Name: "Keuangan", SortOrder: 10, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "it", Name: "IT", SortOrder: 11, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "keamanan", Name: "Keamanan", SortOrder: 12, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "kebersihan", Name: "Kebersihan", SortOrder: 13, IsActive: true},
		{Category: models.CategoryEmployeeType, Code: "lainnya", Name: "Lainnya", SortOrder: 99, IsActive: true},

		// Employment Status (Status Kepegawaian)
		{Category: models.CategoryEmploymentStatus, Code: "pns", Name: "PNS", SortOrder: 1, IsActive: true},
		{Category: models.CategoryEmploymentStatus, Code: "pppk", Name: "PPPK", SortOrder: 2, IsActive: true},
		{Category: models.CategoryEmploymentStatus, Code: "tetap", Name: "Tetap", SortOrder: 3, IsActive: true},
		{Category: models.CategoryEmploymentStatus, Code: "kontrak", Name: "Kontrak", SortOrder: 4, IsActive: true},
		{Category: models.CategoryEmploymentStatus, Code: "honorer", Name: "Honorer", SortOrder: 5, IsActive: true},
		{Category: models.CategoryEmploymentStatus, Code: "magang", Name: "Magang", SortOrder: 6, IsActive: true},

		// Blood Type
		{Category: models.CategoryBloodType, Code: "a", Name: "A", SortOrder: 1, IsActive: true},
		{Category: models.CategoryBloodType, Code: "b", Name: "B", SortOrder: 2, IsActive: true},
		{Category: models.CategoryBloodType, Code: "ab", Name: "AB", SortOrder: 3, IsActive: true},
		{Category: models.CategoryBloodType, Code: "o", Name: "O", SortOrder: 4, IsActive: true},
		{Category: models.CategoryBloodType, Code: "unknown", Name: "Tidak Diketahui", SortOrder: 5, IsActive: true},

		// Rhesus Type
		{Category: models.CategoryRhesusType, Code: "positif", Name: "Positif", SortOrder: 1, IsActive: true},
		{Category: models.CategoryRhesusType, Code: "negatif", Name: "Negatif", SortOrder: 2, IsActive: true},
		{Category: models.CategoryRhesusType, Code: "unknown", Name: "Tidak Diketahui", SortOrder: 3, IsActive: true},

		// Insurance Type (Jenis Jaminan)
		{Category: models.CategoryInsuranceType, Code: "umum", Name: "Umum", SortOrder: 1, IsActive: true, IsDefault: true},
		{Category: models.CategoryInsuranceType, Code: "bpjs", Name: "BPJS", SortOrder: 2, IsActive: true},
		{Category: models.CategoryInsuranceType, Code: "jkn", Name: "JKN", SortOrder: 3, IsActive: true},
		{Category: models.CategoryInsuranceType, Code: "asuransi_swasta", Name: "Asuransi Swasta", SortOrder: 4, IsActive: true},
		{Category: models.CategoryInsuranceType, Code: "lainnya", Name: "Lainnya", SortOrder: 99, IsActive: true},

		// Insurance Company (Perusahaan Asuransi)
		{Category: models.CategoryInsuranceCompany, Code: "allianz", Name: "Allianz Life Indonesia", SortOrder: 1, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "prudential", Name: "Prudential Indonesia", SortOrder: 2, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "axa_mandiri", Name: "AXA Mandiri", SortOrder: 3, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "manulife", Name: "Manulife Indonesia", SortOrder: 4, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "bni_life", Name: "BNI Life Insurance", SortOrder: 5, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "bri_life", Name: "BRI Life", SortOrder: 6, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "sequis", Name: "Sequis Life", SortOrder: 7, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "commonwealth", Name: "Commonwealth Life", SortOrder: 8, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "cigna", Name: "Cigna", SortOrder: 9, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "fwd", Name: "FWD Insurance", SortOrder: 10, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "great_eastern", Name: "Great Eastern Life Indonesia", SortOrder: 11, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "sun_life", Name: "Sun Life Financial Indonesia", SortOrder: 12, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "astra_life", Name: "Asuransi Astra", SortOrder: 13, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "jasa_raharja", Name: "Jasa Raharja", SortOrder: 14, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "inhealth", Name: "InHealth", SortOrder: 15, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "admedika", Name: "Admedika", SortOrder: 16, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "smarthealth", Name: "SmartHealth", SortOrder: 17, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "lippo_insurance", Name: "Lippo Insurance", SortOrder: 18, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "sinarmas", Name: "Asuransi Sinarmas", SortOrder: 19, IsActive: true},
		{Category: models.CategoryInsuranceCompany, Code: "lainnya", Name: "Lainnya", SortOrder: 99, IsActive: true},

		// BPJS Class (Kelas BPJS)
		{Category: models.CategoryBPJSClass, Code: "kelas_1", Name: "Kelas 1", SortOrder: 1, IsActive: true},
		{Category: models.CategoryBPJSClass, Code: "kelas_2", Name: "Kelas 2", SortOrder: 2, IsActive: true},
		{Category: models.CategoryBPJSClass, Code: "kelas_3", Name: "Kelas 3", SortOrder: 3, IsActive: true},
		{Category: models.CategoryBPJSClass, Code: "vip", Name: "VIP", SortOrder: 4, IsActive: true},
		{Category: models.CategoryBPJSClass, Code: "vvip", Name: "VVIP", SortOrder: 5, IsActive: true},
		{Category: models.CategoryBPJSClass, Code: "lainnya", Name: "Lainnya", SortOrder: 99, IsActive: true},

		// Relationship (for emergency contact)
		{Category: models.CategoryRelationship, Code: "orang_tua", Name: "Orang Tua", SortOrder: 1, IsActive: true},
		{Category: models.CategoryRelationship, Code: "suami", Name: "Suami", SortOrder: 2, IsActive: true},
		{Category: models.CategoryRelationship, Code: "istri", Name: "Istri", SortOrder: 3, IsActive: true},
		{Category: models.CategoryRelationship, Code: "anak", Name: "Anak", SortOrder: 4, IsActive: true},
		{Category: models.CategoryRelationship, Code: "saudara", Name: "Saudara", SortOrder: 5, IsActive: true},
		{Category: models.CategoryRelationship, Code: "lainnya", Name: "Lainnya", SortOrder: 99, IsActive: true},

		// Occupation (Pekerjaan) - sesuai standar BPS
		{Category: models.CategoryOccupation, Code: "tidak_bekerja", Name: "Tidak/Belum Bekerja", SortOrder: 1, IsActive: true},
		{Category: models.CategoryOccupation, Code: "pns", Name: "PNS", SortOrder: 2, IsActive: true},
		{Category: models.CategoryOccupation, Code: "tni", Name: "TNI", SortOrder: 3, IsActive: true},
		{Category: models.CategoryOccupation, Code: "polri", Name: "POLRI", SortOrder: 4, IsActive: true},
		{Category: models.CategoryOccupation, Code: "bumn", Name: "Pegawai BUMN", SortOrder: 5, IsActive: true},
		{Category: models.CategoryOccupation, Code: "swasta", Name: "Pegawai Swasta", SortOrder: 6, IsActive: true},
		{Category: models.CategoryOccupation, Code: "wiraswasta", Name: "Wiraswasta", SortOrder: 7, IsActive: true},
		{Category: models.CategoryOccupation, Code: "petani", Name: "Petani/Pekebun", SortOrder: 8, IsActive: true},
		{Category: models.CategoryOccupation, Code: "nelayan", Name: "Nelayan", SortOrder: 9, IsActive: true},
		{Category: models.CategoryOccupation, Code: "buruh", Name: "Buruh", SortOrder: 10, IsActive: true},
		{Category: models.CategoryOccupation, Code: "pedagang", Name: "Pedagang", SortOrder: 11, IsActive: true},
		{Category: models.CategoryOccupation, Code: "ibu_rumah_tangga", Name: "Ibu Rumah Tangga", SortOrder: 12, IsActive: true},
		{Category: models.CategoryOccupation, Code: "pelajar", Name: "Pelajar/Mahasiswa", SortOrder: 13, IsActive: true},
		{Category: models.CategoryOccupation, Code: "pensiunan", Name: "Pensiunan", SortOrder: 14, IsActive: true},
		{Category: models.CategoryOccupation, Code: "dokter", Name: "Dokter", SortOrder: 15, IsActive: true},
		{Category: models.CategoryOccupation, Code: "guru", Name: "Guru/Dosen", SortOrder: 16, IsActive: true},
		{Category: models.CategoryOccupation, Code: "pengacara", Name: "Pengacara", SortOrder: 17, IsActive: true},
		{Category: models.CategoryOccupation, Code: "akuntan", Name: "Akuntan", SortOrder: 18, IsActive: true},
		{Category: models.CategoryOccupation, Code: "lainnya", Name: "Lainnya", SortOrder: 99, IsActive: true},

		// Bank
		{Category: models.CategoryBank, Code: "bri", Name: "Bank BRI", SortOrder: 1, IsActive: true},
		{Category: models.CategoryBank, Code: "bni", Name: "Bank BNI", SortOrder: 2, IsActive: true},
		{Category: models.CategoryBank, Code: "mandiri", Name: "Bank Mandiri", SortOrder: 3, IsActive: true},
		{Category: models.CategoryBank, Code: "bca", Name: "Bank BCA", SortOrder: 4, IsActive: true},
		{Category: models.CategoryBank, Code: "btn", Name: "Bank BTN", SortOrder: 5, IsActive: true},
		{Category: models.CategoryBank, Code: "bsi", Name: "Bank Syariah Indonesia", SortOrder: 6, IsActive: true},
		{Category: models.CategoryBank, Code: "permata", Name: "Bank Permata", SortOrder: 7, IsActive: true},
		{Category: models.CategoryBank, Code: "cimb", Name: "Bank CIMB Niaga", SortOrder: 8, IsActive: true},
		{Category: models.CategoryBank, Code: "danamon", Name: "Bank Danamon", SortOrder: 9, IsActive: true},
		{Category: models.CategoryBank, Code: "mega", Name: "Bank Mega", SortOrder: 10, IsActive: true},
		{Category: models.CategoryBank, Code: "lainnya", Name: "Lainnya", SortOrder: 99, IsActive: true},

		// Service Type (Jenis Layanan Ruangan)
		{Category: models.CategoryServiceType, Code: "rawat_jalan", Name: "Rawat Jalan", Description: "Layanan rawat jalan seperti poliklinik", SortOrder: 1, IsActive: true},
		{Category: models.CategoryServiceType, Code: "rawat_inap", Name: "Rawat Inap", Description: "Layanan rawat inap dengan tempat tidur", SortOrder: 2, IsActive: true},
		{Category: models.CategoryServiceType, Code: "gawat_darurat", Name: "Gawat Darurat", Description: "Layanan gawat darurat/emergency", SortOrder: 3, IsActive: true},
		{Category: models.CategoryServiceType, Code: "penunjang_medis", Name: "Penunjang Medis", Description: "Layanan penunjang seperti laboratorium, radiologi", SortOrder: 4, IsActive: true},
		{Category: models.CategoryServiceType, Code: "farmasi", Name: "Farmasi", Description: "Layanan farmasi dan apotek", SortOrder: 5, IsActive: true},
		{Category: models.CategoryServiceType, Code: "administrasi", Name: "Administrasi", Description: "Layanan administrasi dan pendaftaran", SortOrder: 6, IsActive: true},
		{Category: models.CategoryServiceType, Code: "lainnya", Name: "Lainnya", Description: "Layanan lainnya", SortOrder: 99, IsActive: true},

		// Room Type (Tipe Ruangan) - Dikelompokkan berdasarkan Service Type
		// Rawat Inap
		{Category: models.CategoryRoomType, Code: "rawat_inap", Name: "Rawat Inap Umum", SortOrder: 1, IsActive: true},
		{Category: models.CategoryRoomType, Code: "icu", Name: "ICU (Intensive Care Unit)", SortOrder: 2, IsActive: true},
		{Category: models.CategoryRoomType, Code: "iccu", Name: "ICCU (Intensive Cardiac Care Unit)", SortOrder: 3, IsActive: true},
		{Category: models.CategoryRoomType, Code: "nicu", Name: "NICU (Neonatal Intensive Care Unit)", SortOrder: 4, IsActive: true},
		{Category: models.CategoryRoomType, Code: "picu", Name: "PICU (Pediatric Intensive Care Unit)", SortOrder: 5, IsActive: true},
		{Category: models.CategoryRoomType, Code: "hcu", Name: "HCU (High Care Unit)", SortOrder: 6, IsActive: true},
		{Category: models.CategoryRoomType, Code: "isolasi", Name: "Ruang Isolasi", SortOrder: 7, IsActive: true},
		{Category: models.CategoryRoomType, Code: "vk", Name: "VK (Ruang Bersalin)", SortOrder: 8, IsActive: true},
		{Category: models.CategoryRoomType, Code: "perinatologi", Name: "Perinatologi", SortOrder: 9, IsActive: true},
		// Rawat Jalan
		{Category: models.CategoryRoomType, Code: "poliklinik_umum", Name: "Poliklinik Umum", SortOrder: 20, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_spesialis", Name: "Poliklinik Spesialis", SortOrder: 21, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_gigi", Name: "Poliklinik Gigi", SortOrder: 22, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_mata", Name: "Poliklinik Mata", SortOrder: 23, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_anak", Name: "Poliklinik Anak", SortOrder: 24, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_kandungan", Name: "Poliklinik Kandungan", SortOrder: 25, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_bedah", Name: "Poliklinik Bedah", SortOrder: 26, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_penyakit_dalam", Name: "Poliklinik Penyakit Dalam", SortOrder: 27, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_syaraf", Name: "Poliklinik Syaraf", SortOrder: 28, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_jantung", Name: "Poliklinik Jantung", SortOrder: 29, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_kulit", Name: "Poliklinik Kulit & Kelamin", SortOrder: 30, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_tht", Name: "Poliklinik THT", SortOrder: 31, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_jiwa", Name: "Poliklinik Jiwa", SortOrder: 32, IsActive: true},
		{Category: models.CategoryRoomType, Code: "poliklinik_rehabilitasi", Name: "Poliklinik Rehabilitasi Medik", SortOrder: 33, IsActive: true},
		// Gawat Darurat
		{Category: models.CategoryRoomType, Code: "ugd", Name: "UGD (Unit Gawat Darurat)", SortOrder: 40, IsActive: true},
		{Category: models.CategoryRoomType, Code: "ok", Name: "OK (Ruang Operasi)", SortOrder: 41, IsActive: true},
		{Category: models.CategoryRoomType, Code: "one_day_care", Name: "One Day Care", SortOrder: 42, IsActive: true},
		// Penunjang Medis
		{Category: models.CategoryRoomType, Code: "laboratorium", Name: "Laboratorium", SortOrder: 50, IsActive: true},
		{Category: models.CategoryRoomType, Code: "laboratorium_pk", Name: "Laboratorium Patologi Klinik", SortOrder: 51, IsActive: true},
		{Category: models.CategoryRoomType, Code: "laboratorium_pa", Name: "Laboratorium Patologi Anatomi", SortOrder: 52, IsActive: true},
		{Category: models.CategoryRoomType, Code: "radiologi", Name: "Radiologi", SortOrder: 53, IsActive: true},
		{Category: models.CategoryRoomType, Code: "ct_scan", Name: "CT Scan", SortOrder: 54, IsActive: true},
		{Category: models.CategoryRoomType, Code: "mri", Name: "MRI", SortOrder: 55, IsActive: true},
		{Category: models.CategoryRoomType, Code: "usg", Name: "USG", SortOrder: 56, IsActive: true},
		{Category: models.CategoryRoomType, Code: "hemodialisa", Name: "Hemodialisa", SortOrder: 57, IsActive: true},
		{Category: models.CategoryRoomType, Code: "fisioterapi", Name: "Fisioterapi", SortOrder: 58, IsActive: true},
		{Category: models.CategoryRoomType, Code: "gizi", Name: "Instalasi Gizi", SortOrder: 59, IsActive: true},
		{Category: models.CategoryRoomType, Code: "cssd", Name: "CSSD (Central Sterile Supply Department)", SortOrder: 60, IsActive: true},
		// Farmasi
		{Category: models.CategoryRoomType, Code: "depo_farmasi", Name: "Depo Farmasi", Description: "Pusat penyimpanan dan distribusi obat & barang medis", SortOrder: 69, IsActive: true},
		{Category: models.CategoryRoomType, Code: "farmasi_rawat_jalan", Name: "Farmasi Rawat Jalan", SortOrder: 70, IsActive: true},
		{Category: models.CategoryRoomType, Code: "farmasi_rawat_inap", Name: "Farmasi Rawat Inap", SortOrder: 71, IsActive: true},
		{Category: models.CategoryRoomType, Code: "farmasi_ugd", Name: "Farmasi UGD", SortOrder: 72, IsActive: true},
		{Category: models.CategoryRoomType, Code: "gudang_farmasi", Name: "Gudang Farmasi", SortOrder: 73, IsActive: true},
		// Administrasi
		{Category: models.CategoryRoomType, Code: "pendaftaran", Name: "Ruang Pendaftaran", SortOrder: 80, IsActive: true},
		{Category: models.CategoryRoomType, Code: "kasir", Name: "Kasir", SortOrder: 81, IsActive: true},
		{Category: models.CategoryRoomType, Code: "rekam_medis", Name: "Rekam Medis", SortOrder: 82, IsActive: true},
		{Category: models.CategoryRoomType, Code: "ruang_tunggu", Name: "Ruang Tunggu", SortOrder: 83, IsActive: true},
		// Lainnya
		{Category: models.CategoryRoomType, Code: "kamar_jenazah", Name: "Kamar Jenazah", SortOrder: 90, IsActive: true},
		{Category: models.CategoryRoomType, Code: "ruang_pertemuan", Name: "Ruang Pertemuan", SortOrder: 91, IsActive: true},
		{Category: models.CategoryRoomType, Code: "lainnya", Name: "Lainnya", SortOrder: 99, IsActive: true},

		// Room Class (Kelas Ruangan)
		{Category: models.CategoryRoomClass, Code: "vvip", Name: "VVIP", SortOrder: 1, IsActive: true},
		{Category: models.CategoryRoomClass, Code: "vip", Name: "VIP", SortOrder: 2, IsActive: true},
		{Category: models.CategoryRoomClass, Code: "kelas_1", Name: "Kelas I", SortOrder: 3, IsActive: true},
		{Category: models.CategoryRoomClass, Code: "kelas_2", Name: "Kelas II", SortOrder: 4, IsActive: true},
		{Category: models.CategoryRoomClass, Code: "kelas_3", Name: "Kelas III", SortOrder: 5, IsActive: true},
		{Category: models.CategoryRoomClass, Code: "non_kelas", Name: "Non Kelas", SortOrder: 6, IsActive: true},

		// Bed Type (Tipe Tempat Tidur)
		{Category: models.CategoryBedType, Code: "standar", Name: "Standar", SortOrder: 1, IsActive: true},
		{Category: models.CategoryBedType, Code: "elektrik", Name: "Elektrik", SortOrder: 2, IsActive: true},
		{Category: models.CategoryBedType, Code: "icu_bed", Name: "ICU Bed", SortOrder: 3, IsActive: true},
		{Category: models.CategoryBedType, Code: "pediatrik", Name: "Pediatrik", SortOrder: 4, IsActive: true},
		{Category: models.CategoryBedType, Code: "neonatal", Name: "Neonatal/Inkubator", SortOrder: 5, IsActive: true},
		{Category: models.CategoryBedType, Code: "bersalin", Name: "Bersalin", SortOrder: 6, IsActive: true},
		{Category: models.CategoryBedType, Code: "bariatrik", Name: "Bariatrik", SortOrder: 7, IsActive: true},
		{Category: models.CategoryBedType, Code: "stretcher", Name: "Stretcher/Brankar", SortOrder: 8, IsActive: true},

		// Bed Status (Status Tempat Tidur)
		{Category: models.CategoryBedStatus, Code: "available", Name: "Tersedia", SortOrder: 1, IsActive: true},
		{Category: models.CategoryBedStatus, Code: "occupied", Name: "Terisi", SortOrder: 2, IsActive: true},
		{Category: models.CategoryBedStatus, Code: "reserved", Name: "Dipesan", SortOrder: 3, IsActive: true},
		{Category: models.CategoryBedStatus, Code: "maintenance", Name: "Maintenance", SortOrder: 4, IsActive: true},
		{Category: models.CategoryBedStatus, Code: "cleaning", Name: "Dibersihkan", SortOrder: 5, IsActive: true},
		{Category: models.CategoryBedStatus, Code: "out_of_service", Name: "Tidak Aktif", SortOrder: 6, IsActive: true},

		// Room Staff Role (Peran Staff Ruangan)
		{Category: models.CategoryRoomStaffRole, Code: "kepala_ruangan", Name: "Kepala Ruangan", SortOrder: 1, IsActive: true},
		{Category: models.CategoryRoomStaffRole, Code: "perawat_pelaksana", Name: "Perawat Pelaksana", SortOrder: 2, IsActive: true},
		{Category: models.CategoryRoomStaffRole, Code: "dokter_penanggung_jawab", Name: "Dokter Penanggung Jawab", SortOrder: 3, IsActive: true},
		{Category: models.CategoryRoomStaffRole, Code: "asisten_perawat", Name: "Asisten Perawat", SortOrder: 4, IsActive: true},
		{Category: models.CategoryRoomStaffRole, Code: "administrasi", Name: "Administrasi", SortOrder: 5, IsActive: true},
		{Category: models.CategoryRoomStaffRole, Code: "cleaning_service", Name: "Cleaning Service", SortOrder: 6, IsActive: true},

		// Jenis Tindakan (Procedure Type)
		{Category: models.CategoryProcedureType, Code: "medical", Name: "Tindakan Medis", Description: "Tindakan medis umum seperti bedah, konsultasi, dll", SortOrder: 1, IsActive: true},
		{Category: models.CategoryProcedureType, Code: "radiology", Name: "Radiologi", Description: "Pemeriksaan radiologi seperti X-Ray, CT Scan, MRI, USG", SortOrder: 2, IsActive: true},
		{Category: models.CategoryProcedureType, Code: "laboratory", Name: "Laboratorium", Description: "Pemeriksaan laboratorium seperti darah, urine, dll", SortOrder: 3, IsActive: true},

		// Jenis Layanan Tindakan
		{Category: models.CategoryProcedureServiceType, Code: "all", Name: "Semua Layanan", SortOrder: 1, IsActive: true},
		{Category: models.CategoryProcedureServiceType, Code: "rawat_jalan", Name: "Rawat Jalan", SortOrder: 2, IsActive: true},
		{Category: models.CategoryProcedureServiceType, Code: "rawat_inap", Name: "Rawat Inap", SortOrder: 3, IsActive: true},
		{Category: models.CategoryProcedureServiceType, Code: "penunjang", Name: "Penunjang", SortOrder: 4, IsActive: true},
		{Category: models.CategoryProcedureServiceType, Code: "igd", Name: "IGD", SortOrder: 5, IsActive: true},

		// Kelompok Tindakan
		{Category: models.CategoryProcedureGroup, Code: "bedah", Name: "Bedah", SortOrder: 1, IsActive: true},
		{Category: models.CategoryProcedureGroup, Code: "non_bedah", Name: "Non Bedah", SortOrder: 2, IsActive: true},
		{Category: models.CategoryProcedureGroup, Code: "diagnostik", Name: "Diagnostik", SortOrder: 3, IsActive: true},
		{Category: models.CategoryProcedureGroup, Code: "rehabilitasi", Name: "Rehabilitasi", SortOrder: 4, IsActive: true},
		{Category: models.CategoryProcedureGroup, Code: "konsultasi", Name: "Konsultasi", SortOrder: 5, IsActive: true},
		{Category: models.CategoryProcedureGroup, Code: "tindakan_medis", Name: "Tindakan Medis", SortOrder: 6, IsActive: true},
		{Category: models.CategoryProcedureGroup, Code: "penunjang", Name: "Penunjang", SortOrder: 7, IsActive: true},
		{Category: models.CategoryProcedureGroup, Code: "laboratorium", Name: "Laboratorium", SortOrder: 8, IsActive: true},
		{Category: models.CategoryProcedureGroup, Code: "radiologi", Name: "Radiologi", SortOrder: 9, IsActive: true},

		// Spesialisasi Tindakan
		{Category: models.CategoryProcedureSpecialty, Code: "umum", Name: "Umum", SortOrder: 1, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "bedah_umum", Name: "Bedah Umum", SortOrder: 2, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "bedah_orthopedi", Name: "Bedah Orthopedi", SortOrder: 3, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "bedah_saraf", Name: "Bedah Saraf", SortOrder: 4, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "bedah_plastik", Name: "Bedah Plastik", SortOrder: 5, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "bedah_toraks", Name: "Bedah Toraks", SortOrder: 6, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "bedah_digestif", Name: "Bedah Digestif", SortOrder: 7, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "bedah_urologi", Name: "Bedah Urologi", SortOrder: 8, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "bedah_anak", Name: "Bedah Anak", SortOrder: 9, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "anak", Name: "Anak", SortOrder: 10, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "kandungan", Name: "Kandungan (Obgyn)", SortOrder: 11, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "penyakit_dalam", Name: "Penyakit Dalam", SortOrder: 12, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "jantung", Name: "Jantung & Pembuluh Darah", SortOrder: 13, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "saraf", Name: "Saraf (Neurologi)", SortOrder: 14, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "mata", Name: "Mata", SortOrder: 15, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "tht", Name: "THT", SortOrder: 16, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "kulit", Name: "Kulit & Kelamin", SortOrder: 17, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "gigi", Name: "Gigi & Mulut", SortOrder: 18, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "paru", Name: "Paru (Pulmonologi)", SortOrder: 19, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "jiwa", Name: "Jiwa (Psikiatri)", SortOrder: 20, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "rehabilitasi_medik", Name: "Rehabilitasi Medik", SortOrder: 21, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "anestesi", Name: "Anestesi", SortOrder: 22, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "patologi_klinik", Name: "Patologi Klinik", SortOrder: 23, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "patologi_anatomi", Name: "Patologi Anatomi", SortOrder: 24, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "radiologi", Name: "Radiologi", SortOrder: 25, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "gizi_klinik", Name: "Gizi Klinik", SortOrder: 26, IsActive: true},
		{Category: models.CategoryProcedureSpecialty, Code: "geriatri", Name: "Geriatri", SortOrder: 27, IsActive: true},

		// Kelas Pasien
		{Category: models.CategoryPatientClass, Code: "non_kelas", Name: "Non Kelas", SortOrder: 1, IsActive: true},
		{Category: models.CategoryPatientClass, Code: "kelas_3", Name: "Kelas III", SortOrder: 2, IsActive: true},
		{Category: models.CategoryPatientClass, Code: "kelas_2", Name: "Kelas II", SortOrder: 3, IsActive: true},
		{Category: models.CategoryPatientClass, Code: "kelas_1", Name: "Kelas I", SortOrder: 4, IsActive: true},
		{Category: models.CategoryPatientClass, Code: "vip", Name: "VIP", SortOrder: 5, IsActive: true},
		{Category: models.CategoryPatientClass, Code: "vvip", Name: "VVIP", SortOrder: 6, IsActive: true},
		{Category: models.CategoryPatientClass, Code: "hcu", Name: "HCU", SortOrder: 7, IsActive: true},
		{Category: models.CategoryPatientClass, Code: "intensif", Name: "Intensif (ICU/NICU/PICU)", SortOrder: 8, IsActive: true},
		{Category: models.CategoryPatientClass, Code: "isolasi", Name: "Isolasi", SortOrder: 9, IsActive: true},

		// Jenis Anestesi
		{Category: models.CategoryAnesthesiaType, Code: "none", Name: "Tanpa Anestesi", SortOrder: 1, IsActive: true},
		{Category: models.CategoryAnesthesiaType, Code: "local", Name: "Anestesi Lokal", SortOrder: 2, IsActive: true},
		{Category: models.CategoryAnesthesiaType, Code: "regional", Name: "Anestesi Regional", SortOrder: 3, IsActive: true},
		{Category: models.CategoryAnesthesiaType, Code: "general", Name: "Anestesi Umum (General)", SortOrder: 4, IsActive: true},
		{Category: models.CategoryAnesthesiaType, Code: "sedation", Name: "Sedasi", SortOrder: 5, IsActive: true},
		{Category: models.CategoryAnesthesiaType, Code: "spinal", Name: "Anestesi Spinal", SortOrder: 6, IsActive: true},
		{Category: models.CategoryAnesthesiaType, Code: "epidural", Name: "Anestesi Epidural", SortOrder: 7, IsActive: true},

		// ==================== INVENTORY MANAGEMENT ====================

		// Kategori Inventaris
		{Category: models.CategoryInventoryCategory, Code: "medical", Name: "Alat Medis", Description: "Peralatan medis seperti stetoskop, tensimeter, dll", SortOrder: 1, IsActive: true},
		{Category: models.CategoryInventoryCategory, Code: "non_medical", Name: "Alat Non-Medis", Description: "Peralatan non-medis seperti komputer, printer, dll", SortOrder: 2, IsActive: true},
		{Category: models.CategoryInventoryCategory, Code: "consumable", Name: "Bahan Habis Pakai", Description: "Bahan habis pakai seperti sarung tangan, kapas, dll", SortOrder: 3, IsActive: true},
		{Category: models.CategoryInventoryCategory, Code: "equipment", Name: "Peralatan", Description: "Peralatan besar seperti mesin USG, X-Ray, dll", SortOrder: 4, IsActive: true},
		{Category: models.CategoryInventoryCategory, Code: "furniture", Name: "Furniture", Description: "Mebel seperti meja, kursi, lemari, dll", SortOrder: 5, IsActive: true},
		{Category: models.CategoryInventoryCategory, Code: "electronic", Name: "Elektronik", Description: "Peralatan elektronik seperti AC, lampu, dll", SortOrder: 6, IsActive: true},
		{Category: models.CategoryInventoryCategory, Code: "infrastructure", Name: "Infrastruktur", Description: "Infrastruktur seperti genset, lift, dll", SortOrder: 7, IsActive: true},
		{Category: models.CategoryInventoryCategory, Code: "linen", Name: "Linen", Description: "Linen seperti sprei, selimut, handuk, dll", SortOrder: 8, IsActive: true},
		{Category: models.CategoryInventoryCategory, Code: "other", Name: "Lainnya", Description: "Kategori lainnya", SortOrder: 99, IsActive: true},

		// Kondisi Inventaris
		{Category: models.CategoryInventoryCondition, Code: "new", Name: "Baru", Description: "Barang baru belum digunakan", SortOrder: 1, IsActive: true},
		{Category: models.CategoryInventoryCondition, Code: "good", Name: "Baik", Description: "Kondisi baik dan berfungsi normal", SortOrder: 2, IsActive: true},
		{Category: models.CategoryInventoryCondition, Code: "fair", Name: "Cukup", Description: "Kondisi cukup, masih bisa digunakan", SortOrder: 3, IsActive: true},
		{Category: models.CategoryInventoryCondition, Code: "damaged", Name: "Rusak Ringan", Description: "Rusak ringan, perlu perbaikan", SortOrder: 4, IsActive: true},
		{Category: models.CategoryInventoryCondition, Code: "broken", Name: "Rusak Berat", Description: "Rusak berat, tidak bisa digunakan", SortOrder: 5, IsActive: true},
		{Category: models.CategoryInventoryCondition, Code: "disposed", Name: "Dihapuskan", Description: "Sudah dihapuskan dari inventaris", SortOrder: 6, IsActive: true},

		// Status Inventaris
		{Category: models.CategoryInventoryStatus, Code: "available", Name: "Tersedia", Description: "Barang tersedia dan siap digunakan", SortOrder: 1, IsActive: true},
		{Category: models.CategoryInventoryStatus, Code: "in_use", Name: "Sedang Digunakan", Description: "Barang sedang digunakan", SortOrder: 2, IsActive: true},
		{Category: models.CategoryInventoryStatus, Code: "maintenance", Name: "Dalam Perawatan", Description: "Barang dalam perawatan/perbaikan", SortOrder: 3, IsActive: true},
		{Category: models.CategoryInventoryStatus, Code: "reserved", Name: "Direservasi", Description: "Barang sudah dipesan/direservasi", SortOrder: 4, IsActive: true},
		{Category: models.CategoryInventoryStatus, Code: "disposed", Name: "Dihapuskan", Description: "Barang sudah dihapuskan", SortOrder: 5, IsActive: true},

		// Satuan Inventaris
		{Category: models.CategoryInventoryUnit, Code: "pcs", Name: "Pcs", Description: "Pieces/Buah", SortOrder: 1, IsActive: true},
		{Category: models.CategoryInventoryUnit, Code: "unit", Name: "Unit", Description: "Unit", SortOrder: 2, IsActive: true},
		{Category: models.CategoryInventoryUnit, Code: "set", Name: "Set", Description: "Set", SortOrder: 3, IsActive: true},
		{Category: models.CategoryInventoryUnit, Code: "box", Name: "Box", Description: "Box/Kotak", SortOrder: 4, IsActive: true},
		{Category: models.CategoryInventoryUnit, Code: "pack", Name: "Pack", Description: "Pack/Paket", SortOrder: 5, IsActive: true},
		{Category: models.CategoryInventoryUnit, Code: "roll", Name: "Roll", Description: "Roll/Gulungan", SortOrder: 6, IsActive: true},
		{Category: models.CategoryInventoryUnit, Code: "lembar", Name: "Lembar", Description: "Lembar", SortOrder: 7, IsActive: true},
		{Category: models.CategoryInventoryUnit, Code: "pasang", Name: "Pasang", Description: "Pasang", SortOrder: 8, IsActive: true},
		{Category: models.CategoryInventoryUnit, Code: "lusin", Name: "Lusin", Description: "Lusin (12 pcs)", SortOrder: 9, IsActive: true},
		{Category: models.CategoryInventoryUnit, Code: "rim", Name: "Rim", Description: "Rim (500 lembar)", SortOrder: 10, IsActive: true},

		// ==================== MEDICINE/PHARMACY MANAGEMENT ====================

		// Kategori Obat
		{Category: models.CategoryMedicineCategory, Code: "generic", Name: "Obat Generik", Description: "Obat dengan nama zat aktif/INN", SortOrder: 1, IsActive: true},
		{Category: models.CategoryMedicineCategory, Code: "patent", Name: "Obat Paten", Description: "Obat dengan nama dagang/merk", SortOrder: 2, IsActive: true},
		{Category: models.CategoryMedicineCategory, Code: "herbal", Name: "Obat Herbal", Description: "Obat berbahan herbal terstandar", SortOrder: 3, IsActive: true},
		{Category: models.CategoryMedicineCategory, Code: "traditional", Name: "Obat Tradisional", Description: "Obat tradisional/jamu", SortOrder: 4, IsActive: true},
		{Category: models.CategoryMedicineCategory, Code: "biological", Name: "Obat Biologis", Description: "Produk biologi seperti vaksin, serum", SortOrder: 5, IsActive: true},
		{Category: models.CategoryMedicineCategory, Code: "other", Name: "Lainnya", Description: "Kategori obat lainnya", SortOrder: 99, IsActive: true},

		// Jenis/Golongan Obat
		{Category: models.CategoryMedicineType, Code: "otc", Name: "Obat Bebas (OTC)", Description: "Obat bebas, logo lingkaran hijau", SortOrder: 1, IsActive: true},
		{Category: models.CategoryMedicineType, Code: "limited", Name: "Obat Bebas Terbatas", Description: "Obat bebas terbatas, logo lingkaran biru", SortOrder: 2, IsActive: true},
		{Category: models.CategoryMedicineType, Code: "hard", Name: "Obat Keras", Description: "Obat keras, logo lingkaran merah dengan huruf K", SortOrder: 3, IsActive: true},
		{Category: models.CategoryMedicineType, Code: "narcotic", Name: "Narkotika", Description: "Golongan narkotika", SortOrder: 4, IsActive: true},
		{Category: models.CategoryMedicineType, Code: "psychotrope", Name: "Psikotropika", Description: "Golongan psikotropika", SortOrder: 5, IsActive: true},

		// Bentuk Sediaan Obat
		{Category: models.CategoryMedicineForm, Code: "tablet", Name: "Tablet", Description: "Sediaan padat berbentuk tablet", SortOrder: 1, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "capsule", Name: "Kapsul", Description: "Sediaan padat dalam kapsul", SortOrder: 2, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "syrup", Name: "Sirup", Description: "Sediaan cair/sirup", SortOrder: 3, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "suspension", Name: "Suspensi", Description: "Sediaan suspensi", SortOrder: 4, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "emulsion", Name: "Emulsi", Description: "Sediaan emulsi", SortOrder: 5, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "injection", Name: "Injeksi", Description: "Sediaan injeksi/suntik", SortOrder: 6, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "infusion", Name: "Infus", Description: "Sediaan infus", SortOrder: 7, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "cream", Name: "Krim", Description: "Sediaan topikal krim", SortOrder: 8, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "ointment", Name: "Salep", Description: "Sediaan topikal salep", SortOrder: 9, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "gel", Name: "Gel", Description: "Sediaan topikal gel", SortOrder: 10, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "lotion", Name: "Losion", Description: "Sediaan topikal losion", SortOrder: 11, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "drops", Name: "Tetes", Description: "Sediaan tetes (mata, telinga, hidung)", SortOrder: 12, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "powder", Name: "Serbuk", Description: "Sediaan serbuk", SortOrder: 13, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "suppository", Name: "Supositoria", Description: "Sediaan supositoria (rektal/vaginal)", SortOrder: 14, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "inhaler", Name: "Inhaler", Description: "Sediaan inhalasi", SortOrder: 15, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "patch", Name: "Patch/Koyo", Description: "Sediaan transdermal patch", SortOrder: 16, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "spray", Name: "Spray", Description: "Sediaan spray/semprot", SortOrder: 17, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "granule", Name: "Granul", Description: "Sediaan granul", SortOrder: 18, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "effervescent", Name: "Effervescent", Description: "Tablet effervescent", SortOrder: 19, IsActive: true},
		{Category: models.CategoryMedicineForm, Code: "other", Name: "Lainnya", Description: "Bentuk sediaan lainnya", SortOrder: 99, IsActive: true},

		// Satuan Obat
		{Category: models.CategoryMedicineUnit, Code: "tablet", Name: "Tablet", Description: "Satuan tablet", SortOrder: 1, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "kapsul", Name: "Kapsul", Description: "Satuan kapsul", SortOrder: 2, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "ampul", Name: "Ampul", Description: "Satuan ampul", SortOrder: 3, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "vial", Name: "Vial", Description: "Satuan vial", SortOrder: 4, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "botol", Name: "Botol", Description: "Satuan botol", SortOrder: 5, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "tube", Name: "Tube", Description: "Satuan tube", SortOrder: 6, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "sachet", Name: "Sachet", Description: "Satuan sachet", SortOrder: 7, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "strip", Name: "Strip", Description: "Satuan strip", SortOrder: 8, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "box", Name: "Box", Description: "Satuan box", SortOrder: 9, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "pcs", Name: "Pcs", Description: "Satuan pieces", SortOrder: 10, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "ml", Name: "ml", Description: "Mililiter", SortOrder: 11, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "gram", Name: "Gram", Description: "Gram", SortOrder: 12, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "fls", Name: "Fls", Description: "Satuan flakon", SortOrder: 13, IsActive: true},
		{Category: models.CategoryMedicineUnit, Code: "supp", Name: "Supp", Description: "Satuan supositoria", SortOrder: 14, IsActive: true},

		// ==================== MEDICAL RECORD (SATUSEHAT COMPLIANT) ====================

		// Moda Kedatangan (Arrival Mode)
		{Category: models.CategoryArrivalMode, Code: "ambulans", Name: "Ambulans", Description: "Datang menggunakan ambulans", SortOrder: 1, IsActive: true},
		{Category: models.CategoryArrivalMode, Code: "ambulans_119", Name: "Ambulans 119", Description: "Datang menggunakan ambulans 119", SortOrder: 2, IsActive: true},
		{Category: models.CategoryArrivalMode, Code: "kendaraan_pribadi", Name: "Kendaraan Pribadi", Description: "Datang menggunakan kendaraan pribadi", SortOrder: 3, IsActive: true},
		{Category: models.CategoryArrivalMode, Code: "kendaraan_umum", Name: "Kendaraan Umum", Description: "Datang menggunakan kendaraan umum", SortOrder: 4, IsActive: true},
		{Category: models.CategoryArrivalMode, Code: "jalan_kaki", Name: "Jalan Kaki", Description: "Datang dengan berjalan kaki", SortOrder: 5, IsActive: true},
		{Category: models.CategoryArrivalMode, Code: "polisi", Name: "Polisi", Description: "Diantar oleh polisi", SortOrder: 6, IsActive: true},
		{Category: models.CategoryArrivalMode, Code: "rujukan", Name: "Rujukan", Description: "Dirujuk dari faskes lain", SortOrder: 7, IsActive: true},
		{Category: models.CategoryArrivalMode, Code: "lainnya", Name: "Lainnya", Description: "Moda kedatangan lainnya", SortOrder: 99, IsActive: true},

		// Level Triase (ESI - Emergency Severity Index)
		{Category: models.CategoryTriageLevel, Code: "0", Name: "Level 0 - DOA", Description: "Dead on Arrival - Meninggal saat tiba", SortOrder: 0, IsActive: true},
		{Category: models.CategoryTriageLevel, Code: "1", Name: "Level 1 - Resusitasi", Description: "Mengancam jiwa, membutuhkan resusitasi segera", SortOrder: 1, IsActive: true},
		{Category: models.CategoryTriageLevel, Code: "2", Name: "Level 2 - Emergent", Description: "Berpotensi mengancam jiwa, membutuhkan tindakan segera", SortOrder: 2, IsActive: true},
		{Category: models.CategoryTriageLevel, Code: "3", Name: "Level 3 - Urgent", Description: "Membutuhkan pemeriksaan dan penanganan mendesak", SortOrder: 3, IsActive: true},
		{Category: models.CategoryTriageLevel, Code: "4", Name: "Level 4 - Less Urgent", Description: "Membutuhkan pemeriksaan, dapat menunggu", SortOrder: 4, IsActive: true},
		{Category: models.CategoryTriageLevel, Code: "5", Name: "Level 5 - Non-Urgent", Description: "Tidak mendesak, dapat ditangani di poliklinik", SortOrder: 5, IsActive: true},

		// Tingkat Kesadaran (Consciousness Level)
		{Category: models.CategoryConsciousnessLevel, Code: "composmentis", Name: "Composmentis", Description: "Sadar penuh", SortOrder: 1, IsActive: true},
		{Category: models.CategoryConsciousnessLevel, Code: "apatis", Name: "Apatis", Description: "Acuh tak acuh terhadap lingkungan", SortOrder: 2, IsActive: true},
		{Category: models.CategoryConsciousnessLevel, Code: "somnolen", Name: "Somnolen", Description: "Mengantuk, dapat dibangunkan dengan rangsangan", SortOrder: 3, IsActive: true},
		{Category: models.CategoryConsciousnessLevel, Code: "sopor", Name: "Sopor", Description: "Tidur dalam, sulit dibangunkan", SortOrder: 4, IsActive: true},
		{Category: models.CategoryConsciousnessLevel, Code: "koma", Name: "Koma", Description: "Tidak sadar, tidak ada respons", SortOrder: 5, IsActive: true},

		// Status Jalan Napas (Airway Status)
		{Category: models.CategoryAirwayStatus, Code: "bebas", Name: "Bebas", Description: "Jalan napas bebas/paten", SortOrder: 1, IsActive: true},
		{Category: models.CategoryAirwayStatus, Code: "tersumbat_parsial", Name: "Tersumbat Parsial", Description: "Jalan napas tersumbat sebagian", SortOrder: 2, IsActive: true},
		{Category: models.CategoryAirwayStatus, Code: "tersumbat_total", Name: "Tersumbat Total", Description: "Jalan napas tersumbat total", SortOrder: 3, IsActive: true},
		{Category: models.CategoryAirwayStatus, Code: "dengan_alat", Name: "Dengan Alat Bantu", Description: "Menggunakan alat bantu napas (OPA/NPA/ETT)", SortOrder: 4, IsActive: true},

		// Status Pernapasan (Breathing Status)
		{Category: models.CategoryBreathingStatus, Code: "spontan", Name: "Spontan", Description: "Bernapas spontan normal", SortOrder: 1, IsActive: true},
		{Category: models.CategoryBreathingStatus, Code: "sesak_ringan", Name: "Sesak Ringan", Description: "Sesak napas ringan", SortOrder: 2, IsActive: true},
		{Category: models.CategoryBreathingStatus, Code: "sesak_sedang", Name: "Sesak Sedang", Description: "Sesak napas sedang", SortOrder: 3, IsActive: true},
		{Category: models.CategoryBreathingStatus, Code: "sesak_berat", Name: "Sesak Berat", Description: "Sesak napas berat", SortOrder: 4, IsActive: true},
		{Category: models.CategoryBreathingStatus, Code: "apneu", Name: "Apneu", Description: "Tidak bernapas", SortOrder: 5, IsActive: true},
		{Category: models.CategoryBreathingStatus, Code: "dengan_bantuan", Name: "Dengan Bantuan", Description: "Menggunakan alat bantu napas", SortOrder: 6, IsActive: true},

		// Status Sirkulasi (Circulation Status)
		{Category: models.CategoryCirculationStatus, Code: "baik", Name: "Baik", Description: "Sirkulasi baik dan stabil", SortOrder: 1, IsActive: true},
		{Category: models.CategoryCirculationStatus, Code: "terganggu", Name: "Terganggu", Description: "Sirkulasi terganggu", SortOrder: 2, IsActive: true},
		{Category: models.CategoryCirculationStatus, Code: "syok", Name: "Syok", Description: "Dalam kondisi syok", SortOrder: 3, IsActive: true},
		{Category: models.CategoryCirculationStatus, Code: "henti_jantung", Name: "Henti Jantung", Description: "Cardiac arrest", SortOrder: 4, IsActive: true},

		// Status Akral (Akral Status)
		{Category: models.CategoryAkralStatus, Code: "hangat", Name: "Hangat", Description: "Akral teraba hangat", SortOrder: 1, IsActive: true},
		{Category: models.CategoryAkralStatus, Code: "dingin", Name: "Dingin", Description: "Akral teraba dingin", SortOrder: 2, IsActive: true},
		{Category: models.CategoryAkralStatus, Code: "basah", Name: "Basah", Description: "Akral teraba basah/berkeringat", SortOrder: 3, IsActive: true},
		{Category: models.CategoryAkralStatus, Code: "kering", Name: "Kering", Description: "Akral teraba kering", SortOrder: 4, IsActive: true},
		{Category: models.CategoryAkralStatus, Code: "sianosis", Name: "Sianosis", Description: "Akral tampak kebiruan", SortOrder: 5, IsActive: true},

		// Capillary Refill Time (CRT)
		{Category: models.CategoryCRTStatus, Code: "<2detik", Name: "< 2 detik (Normal)", Description: "CRT normal, kurang dari 2 detik", SortOrder: 1, IsActive: true},
		{Category: models.CategoryCRTStatus, Code: "2-3detik", Name: "2-3 detik", Description: "CRT sedikit memanjang", SortOrder: 2, IsActive: true},
		{Category: models.CategoryCRTStatus, Code: ">3detik", Name: "> 3 detik (Memanjang)", Description: "CRT memanjang, lebih dari 3 detik", SortOrder: 3, IsActive: true},

		// Status Pupil
		{Category: models.CategoryPupilStatus, Code: "isokor", Name: "Isokor", Description: "Pupil simetris, ukuran normal", SortOrder: 1, IsActive: true},
		{Category: models.CategoryPupilStatus, Code: "miosis", Name: "Miosis", Description: "Pupil mengecil", SortOrder: 2, IsActive: true},
		{Category: models.CategoryPupilStatus, Code: "midriasis", Name: "Midriasis", Description: "Pupil melebar", SortOrder: 3, IsActive: true},
		{Category: models.CategoryPupilStatus, Code: "anisokor", Name: "Anisokor", Description: "Pupil tidak simetris", SortOrder: 4, IsActive: true},
		{Category: models.CategoryPupilStatus, Code: "tidak_reaktif", Name: "Tidak Reaktif", Description: "Pupil tidak bereaksi terhadap cahaya", SortOrder: 5, IsActive: true},

		// Status Klinis Diagnosis (FHIR Clinical Status)
		{Category: models.CategoryClinicalStatus, Code: "active", Name: "Aktif", Description: "Kondisi sedang berlangsung", SortOrder: 1, IsActive: true},
		{Category: models.CategoryClinicalStatus, Code: "recurrence", Name: "Rekurensi", Description: "Kondisi kambuh setelah sebelumnya sembuh", SortOrder: 2, IsActive: true},
		{Category: models.CategoryClinicalStatus, Code: "relapse", Name: "Relaps", Description: "Kondisi memburuk setelah perbaikan", SortOrder: 3, IsActive: true},
		{Category: models.CategoryClinicalStatus, Code: "inactive", Name: "Inaktif", Description: "Kondisi tidak aktif", SortOrder: 4, IsActive: true},
		{Category: models.CategoryClinicalStatus, Code: "remission", Name: "Remisi", Description: "Kondisi dalam remisi", SortOrder: 5, IsActive: true},
		{Category: models.CategoryClinicalStatus, Code: "resolved", Name: "Sembuh", Description: "Kondisi telah sembuh", SortOrder: 6, IsActive: true},

		// Status Verifikasi Diagnosis (FHIR Verification Status)
		{Category: models.CategoryVerificationStatus, Code: "unconfirmed", Name: "Belum Terkonfirmasi", Description: "Diagnosis belum terkonfirmasi", SortOrder: 1, IsActive: true},
		{Category: models.CategoryVerificationStatus, Code: "provisional", Name: "Provisional", Description: "Diagnosis sementara", SortOrder: 2, IsActive: true},
		{Category: models.CategoryVerificationStatus, Code: "differential", Name: "Diferensial", Description: "Diagnosis banding", SortOrder: 3, IsActive: true},
		{Category: models.CategoryVerificationStatus, Code: "confirmed", Name: "Terkonfirmasi", Description: "Diagnosis terkonfirmasi", SortOrder: 4, IsActive: true},
		{Category: models.CategoryVerificationStatus, Code: "refuted", Name: "Ditolak", Description: "Diagnosis dibatalkan", SortOrder: 5, IsActive: true},

		// Tingkat Keparahan (Severity Level)
		{Category: models.CategorySeverityLevel, Code: "mild", Name: "Ringan", Description: "Tingkat keparahan ringan", SortOrder: 1, IsActive: true},
		{Category: models.CategorySeverityLevel, Code: "moderate", Name: "Sedang", Description: "Tingkat keparahan sedang", SortOrder: 2, IsActive: true},
		{Category: models.CategorySeverityLevel, Code: "severe", Name: "Berat", Description: "Tingkat keparahan berat", SortOrder: 3, IsActive: true},

		// Jenis Disposisi/Pemulangan (Disposition Type)
		{Category: models.CategoryDispositionType, Code: "pulang", Name: "Pulang", Description: "Pasien pulang dalam keadaan baik", SortOrder: 1, IsActive: true},
		{Category: models.CategoryDispositionType, Code: "rawat_inap", Name: "Rawat Inap", Description: "Pasien memerlukan rawat inap", SortOrder: 2, IsActive: true},
		{Category: models.CategoryDispositionType, Code: "rujuk", Name: "Rujuk", Description: "Pasien dirujuk ke fasilitas lain", SortOrder: 3, IsActive: true},
		{Category: models.CategoryDispositionType, Code: "meninggal", Name: "Meninggal", Description: "Pasien meninggal dunia", SortOrder: 4, IsActive: true},
		{Category: models.CategoryDispositionType, Code: "aps", Name: "APS (Atas Permintaan Sendiri)", Description: "Pasien pulang paksa", SortOrder: 5, IsActive: true},
		{Category: models.CategoryDispositionType, Code: "dod", Name: "DOD (Dead on Departure)", Description: "Meninggal saat tiba di UGD", SortOrder: 6, IsActive: true},
		{Category: models.CategoryDispositionType, Code: "doa", Name: "DOA (Dead on Arrival)", Description: "Meninggal sebelum tiba", SortOrder: 7, IsActive: true},

		// Status Keluar Pasien (Discharge Status)
		{Category: models.CategoryDischargeStatus, Code: "sembuh", Name: "Sembuh", Description: "Pasien keluar dalam keadaan sembuh", SortOrder: 1, IsActive: true},
		{Category: models.CategoryDischargeStatus, Code: "membaik", Name: "Membaik", Description: "Kondisi pasien membaik", SortOrder: 2, IsActive: true},
		{Category: models.CategoryDischargeStatus, Code: "belum_sembuh", Name: "Belum Sembuh", Description: "Pasien keluar namun belum sembuh", SortOrder: 3, IsActive: true},
		{Category: models.CategoryDischargeStatus, Code: "meninggal", Name: "Meninggal", Description: "Pasien meninggal dunia", SortOrder: 4, IsActive: true},
		{Category: models.CategoryDischargeStatus, Code: "kabur", Name: "Kabur", Description: "Pasien kabur/melarikan diri", SortOrder: 5, IsActive: true},
		{Category: models.CategoryDischargeStatus, Code: "pindah_rs", Name: "Pindah RS", Description: "Pindah ke rumah sakit lain", SortOrder: 6, IsActive: true},
		{Category: models.CategoryDischargeStatus, Code: "dirujuk", Name: "Dirujuk", Description: "Dirujuk ke fasilitas kesehatan lain", SortOrder: 7, IsActive: true},

		// Kondisi Keluar Pasien (Discharge Condition)
		{Category: models.CategoryDischargeCondition, Code: "baik", Name: "Baik", Description: "Kondisi baik saat keluar", SortOrder: 1, IsActive: true},
		{Category: models.CategoryDischargeCondition, Code: "cukup", Name: "Cukup", Description: "Kondisi cukup baik", SortOrder: 2, IsActive: true},
		{Category: models.CategoryDischargeCondition, Code: "lemah", Name: "Lemah", Description: "Kondisi lemah", SortOrder: 3, IsActive: true},
		{Category: models.CategoryDischargeCondition, Code: "kritis", Name: "Kritis", Description: "Kondisi kritis", SortOrder: 4, IsActive: true},
		{Category: models.CategoryDischargeCondition, Code: "meninggal", Name: "Meninggal", Description: "Meninggal dunia", SortOrder: 5, IsActive: true},
		{Category: models.CategoryDischargeCondition, Code: "tidak_sadar", Name: "Tidak Sadar", Description: "Dalam keadaan tidak sadar", SortOrder: 6, IsActive: true},
		{Category: models.CategoryDischargeCondition, Code: "stabil", Name: "Stabil", Description: "Kondisi stabil", SortOrder: 7, IsActive: true},
	}

	// Insert each master data if it doesn't exist (based on category + code)
	for _, data := range masterData {
		var existing models.MasterData
		result := db.Where("category = ? AND code = ?", data.Category, data.Code).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&data).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
