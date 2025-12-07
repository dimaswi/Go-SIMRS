package migrations

import (
	"starter/backend/models"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SeedCoreData seeds essential core data: Roles, Users, Counters, Employees, Patients
func SeedCoreData(db *gorm.DB) error {
	// ==========================================
	// ROLES
	// ==========================================
	roles := []models.Role{
		{Name: "Super Admin", Description: "Akses penuh ke semua fitur sistem"},
		{Name: "Admin", Description: "Administrator sistem rumah sakit"},
		{Name: "Dokter", Description: "Dokter umum dan spesialis"},
		{Name: "Perawat", Description: "Tenaga perawat"},
		{Name: "Bidan", Description: "Tenaga bidan"},
		{Name: "Apoteker", Description: "Apoteker dan asisten apoteker"},
		{Name: "Laboratorium", Description: "Analis laboratorium"},
		{Name: "Radiologi", Description: "Radiografer"},
		{Name: "Pendaftaran", Description: "Petugas pendaftaran pasien"},
		{Name: "Kasir", Description: "Petugas kasir/keuangan"},
		{Name: "Rekam Medis", Description: "Petugas rekam medis"},
		{Name: "Manajemen", Description: "Manajemen rumah sakit"},
	}

	var roleMap = make(map[string]uint)
	for _, role := range roles {
		var existing models.Role
		result := db.Where("name = ?", role.Name).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&role).Error; err != nil {
				return err
			}
			roleMap[role.Name] = role.ID
		} else {
			roleMap[role.Name] = existing.ID
		}
	}

	// ==========================================
	// COUNTERS (Loket)
	// ==========================================
	counters := []models.Counter{
		{Name: "Loket Pendaftaran 1", Code: "L1", Description: "Loket pendaftaran umum", IsActive: true, DisplayOrder: 1, Location: "Lantai 1 - Lobby Utama"},
		{Name: "Loket Pendaftaran 2", Code: "L2", Description: "Loket pendaftaran umum", IsActive: true, DisplayOrder: 2, Location: "Lantai 1 - Lobby Utama"},
		{Name: "Loket Pendaftaran 3", Code: "L3", Description: "Loket pendaftaran umum", IsActive: true, DisplayOrder: 3, Location: "Lantai 1 - Lobby Utama"},
		{Name: "Loket BPJS", Code: "LB", Description: "Loket khusus BPJS", IsActive: true, DisplayOrder: 4, Location: "Lantai 1 - Lobby Utama"},
		{Name: "Loket VIP", Code: "LV", Description: "Loket pendaftaran VIP", IsActive: true, DisplayOrder: 5, Location: "Lantai 1 - Area VIP"},
		{Name: "Kasir 1", Code: "K1", Description: "Loket pembayaran", IsActive: true, DisplayOrder: 6, Location: "Lantai 1 - Lobby Utama"},
		{Name: "Kasir 2", Code: "K2", Description: "Loket pembayaran", IsActive: true, DisplayOrder: 7, Location: "Lantai 1 - Lobby Utama"},
		{Name: "Farmasi", Code: "F1", Description: "Loket pengambilan obat", IsActive: true, DisplayOrder: 8, Location: "Lantai 1 - Apotek"},
	}

	for _, counter := range counters {
		var existing models.Counter
		result := db.Where("code = ?", counter.Code).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&counter).Error; err != nil {
				return err
			}
		}
	}

	// ==========================================
	// EMPLOYEES (Sample Data)
	// ==========================================
	birthDate1 := time.Date(1980, 5, 15, 0, 0, 0, 0, time.UTC)
	birthDate2 := time.Date(1985, 8, 20, 0, 0, 0, 0, time.UTC)
	birthDate3 := time.Date(1990, 3, 10, 0, 0, 0, 0, time.UTC)
	birthDate4 := time.Date(1988, 12, 5, 0, 0, 0, 0, time.UTC)
	birthDate5 := time.Date(1992, 7, 25, 0, 0, 0, 0, time.UTC)
	joinDate := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)

	employees := []models.Employee{
		// Dokter Umum
		{
			NIK: "3201010505800001", NIP: "199005152020011001",
			NamaLengkap: "dr. Ahmad Sudirman", TempatLahir: "Jakarta", TanggalLahir: &birthDate1,
			JenisKelamin: models.GenderMale, Agama: "islam", StatusPerkawinan: "menikah",
			Alamat: "Jl. Merdeka No. 10", Kota: "Jakarta", Provinsi: "DKI Jakarta",
			NoHP: "081234567001", Email: "ahmad.sudirman@rs.com",
			TipeKaryawan: models.EmployeeTypeDokter, StatusKepegawaian: models.EmploymentStatusPNS,
			TanggalMasuk: &joinDate, Departemen: "Poliklinik", Jabatan: "Dokter Umum",
			NoSTR: "STR-001-2020", Spesialisasi: "Umum",
			PendidikanTerakhir: "S1", NamaInstitusi: "FK Universitas Indonesia", TahunLulus: 2005,
		},
		// Dokter Spesialis Anak
		{
			NIK: "3201010808850002", NIP: "198508202020012001",
			NamaLengkap: "dr. Siti Nurhaliza, Sp.A", TempatLahir: "Bandung", TanggalLahir: &birthDate2,
			JenisKelamin: models.GenderFemale, Agama: "islam", StatusPerkawinan: "menikah",
			Alamat: "Jl. Asia Afrika No. 20", Kota: "Bandung", Provinsi: "Jawa Barat",
			NoHP: "081234567002", Email: "siti.nurhaliza@rs.com",
			TipeKaryawan: models.EmployeeTypeDokter, StatusKepegawaian: models.EmploymentStatusPNS,
			TanggalMasuk: &joinDate, Departemen: "Poliklinik", Jabatan: "Dokter Spesialis Anak",
			NoSTR: "STR-002-2020", Spesialisasi: "Anak",
			PendidikanTerakhir: "Spesialis", NamaInstitusi: "FK Universitas Padjadjaran", TahunLulus: 2012,
		},
		// Dokter Spesialis Penyakit Dalam
		{
			NIK: "3201011003900003", NIP: "199003102020011001",
			NamaLengkap: "dr. Budi Santoso, Sp.PD", TempatLahir: "Surabaya", TanggalLahir: &birthDate3,
			JenisKelamin: models.GenderMale, Agama: "kristen", StatusPerkawinan: "menikah",
			Alamat: "Jl. Pemuda No. 30", Kota: "Surabaya", Provinsi: "Jawa Timur",
			NoHP: "081234567003", Email: "budi.santoso@rs.com",
			TipeKaryawan: models.EmployeeTypeDokter, StatusKepegawaian: models.EmploymentStatusPNS,
			TanggalMasuk: &joinDate, Departemen: "Poliklinik", Jabatan: "Dokter Spesialis Penyakit Dalam",
			NoSTR: "STR-003-2020", Spesialisasi: "Penyakit Dalam",
			PendidikanTerakhir: "Spesialis", NamaInstitusi: "FK Universitas Airlangga", TahunLulus: 2018,
		},
		// Dokter Gigi
		{
			NIK: "3201010512880004", NIP: "198812052020012001",
			NamaLengkap: "drg. Dewi Lestari", TempatLahir: "Yogyakarta", TanggalLahir: &birthDate4,
			JenisKelamin: models.GenderFemale, Agama: "katolik", StatusPerkawinan: "belum_menikah",
			Alamat: "Jl. Malioboro No. 40", Kota: "Yogyakarta", Provinsi: "DI Yogyakarta",
			NoHP: "081234567004", Email: "dewi.lestari@rs.com",
			TipeKaryawan: models.EmployeeTypeDokter, StatusKepegawaian: models.EmploymentStatusPNS,
			TanggalMasuk: &joinDate, Departemen: "Poliklinik Gigi", Jabatan: "Dokter Gigi",
			NoSTR: "STR-004-2020", Spesialisasi: "Gigi",
			PendidikanTerakhir: "S1", NamaInstitusi: "FKG Universitas Gadjah Mada", TahunLulus: 2012,
		},
		// Perawat
		{
			NIK: "3201012507920005", NIP: "199207252020012001",
			NamaLengkap: "Ns. Ratna Sari, S.Kep", TempatLahir: "Semarang", TanggalLahir: &birthDate5,
			JenisKelamin: models.GenderFemale, Agama: "islam", StatusPerkawinan: "menikah",
			Alamat: "Jl. Pandanaran No. 50", Kota: "Semarang", Provinsi: "Jawa Tengah",
			NoHP: "081234567005", Email: "ratna.sari@rs.com",
			TipeKaryawan: models.EmployeeTypePerawat, StatusKepegawaian: models.EmploymentStatusPNS,
			TanggalMasuk: &joinDate, Departemen: "Keperawatan", Jabatan: "Perawat Pelaksana",
			NoSTR:              "STR-P-001-2020",
			PendidikanTerakhir: "S1", NamaInstitusi: "FIK Universitas Diponegoro", TahunLulus: 2014,
		},
		// Perawat UGD
		{
			NIK:         "3201011503910006",
			NamaLengkap: "Ns. Andi Wijaya, S.Kep", TempatLahir: "Makassar", TanggalLahir: &birthDate3,
			JenisKelamin: models.GenderMale, Agama: "islam", StatusPerkawinan: "menikah",
			Alamat: "Jl. Urip Sumoharjo No. 60", Kota: "Makassar", Provinsi: "Sulawesi Selatan",
			NoHP: "081234567006", Email: "andi.wijaya@rs.com",
			TipeKaryawan: models.EmployeeTypePerawat, StatusKepegawaian: models.EmploymentStatusKontrak,
			TanggalMasuk: &joinDate, Departemen: "UGD", Jabatan: "Perawat UGD",
			NoSTR:              "STR-P-002-2020",
			PendidikanTerakhir: "S1", NamaInstitusi: "FIK Universitas Hasanuddin", TahunLulus: 2015,
		},
		// Bidan
		{
			NIK:         "3201012008930007",
			NamaLengkap: "Bd. Rina Marlina, A.Md.Keb", TempatLahir: "Cirebon", TanggalLahir: &birthDate5,
			JenisKelamin: models.GenderFemale, Agama: "islam", StatusPerkawinan: "menikah",
			Alamat: "Jl. Siliwangi No. 70", Kota: "Cirebon", Provinsi: "Jawa Barat",
			NoHP: "081234567007", Email: "rina.marlina@rs.com",
			TipeKaryawan: models.EmployeeTypeBidan, StatusKepegawaian: models.EmploymentStatusKontrak,
			TanggalMasuk: &joinDate, Departemen: "Kebidanan", Jabatan: "Bidan Pelaksana",
			NoSTR:              "STR-B-001-2020",
			PendidikanTerakhir: "D3", NamaInstitusi: "Akademi Kebidanan Cirebon", TahunLulus: 2015,
		},
		// Apoteker
		{
			NIK:         "3201011205870008",
			NamaLengkap: "Apt. Hendra Gunawan, S.Farm", TempatLahir: "Medan", TanggalLahir: &birthDate4,
			JenisKelamin: models.GenderMale, Agama: "buddha", StatusPerkawinan: "menikah",
			Alamat: "Jl. Diponegoro No. 80", Kota: "Medan", Provinsi: "Sumatera Utara",
			NoHP: "081234567008", Email: "hendra.gunawan@rs.com",
			TipeKaryawan: models.EmployeeTypeApoteker, StatusKepegawaian: models.EmploymentStatusPNS,
			TanggalMasuk: &joinDate, Departemen: "Farmasi", Jabatan: "Apoteker",
			NoSTR:              "STRA-001-2020",
			PendidikanTerakhir: "Profesi Apoteker", NamaInstitusi: "FF Universitas Sumatera Utara", TahunLulus: 2011,
		},
		// Analis Lab
		{
			NIK:         "3201010108890009",
			NamaLengkap: "Dian Permata, A.Md.AK", TempatLahir: "Palembang", TanggalLahir: &birthDate2,
			JenisKelamin: models.GenderFemale, Agama: "islam", StatusPerkawinan: "belum_menikah",
			Alamat: "Jl. Jenderal Sudirman No. 90", Kota: "Palembang", Provinsi: "Sumatera Selatan",
			NoHP: "081234567009", Email: "dian.permata@rs.com",
			TipeKaryawan: models.EmployeeTypeAnalis, StatusKepegawaian: models.EmploymentStatusKontrak,
			TanggalMasuk: &joinDate, Departemen: "Laboratorium", Jabatan: "Analis Kesehatan",
			NoSTR:              "STR-AK-001-2020",
			PendidikanTerakhir: "D3", NamaInstitusi: "Akademi Analis Kesehatan Palembang", TahunLulus: 2013,
		},
		// Radiografer
		{
			NIK:         "3201011506900010",
			NamaLengkap: "Irfan Hakim, A.Md.Rad", TempatLahir: "Denpasar", TanggalLahir: &birthDate3,
			JenisKelamin: models.GenderMale, Agama: "hindu", StatusPerkawinan: "menikah",
			Alamat: "Jl. Sunset Road No. 100", Kota: "Denpasar", Provinsi: "Bali",
			NoHP: "081234567010", Email: "irfan.hakim@rs.com",
			TipeKaryawan: models.EmployeeTypeRadiografer, StatusKepegawaian: models.EmploymentStatusKontrak,
			TanggalMasuk: &joinDate, Departemen: "Radiologi", Jabatan: "Radiografer",
			NoSTR:              "STR-R-001-2020",
			PendidikanTerakhir: "D3", NamaInstitusi: "Akademi Radiologi Denpasar", TahunLulus: 2014,
		},
		// Administrasi
		{
			NIK:         "3201012201950011",
			NamaLengkap: "Lisa Permatasari", TempatLahir: "Bogor", TanggalLahir: &birthDate5,
			JenisKelamin: models.GenderFemale, Agama: "islam", StatusPerkawinan: "belum_menikah",
			Alamat: "Jl. Pajajaran No. 110", Kota: "Bogor", Provinsi: "Jawa Barat",
			NoHP: "081234567011", Email: "lisa.permatasari@rs.com",
			TipeKaryawan: models.EmployeeTypeAdministrasi, StatusKepegawaian: models.EmploymentStatusKontrak,
			TanggalMasuk: &joinDate, Departemen: "Administrasi", Jabatan: "Staff Pendaftaran",
			PendidikanTerakhir: "SMA", NamaInstitusi: "SMAN 1 Bogor", TahunLulus: 2013,
		},
		// IT
		{
			NIK:         "3201011008920012",
			NamaLengkap: "Rizky Pratama, S.Kom", TempatLahir: "Tangerang", TanggalLahir: &birthDate3,
			JenisKelamin: models.GenderMale, Agama: "islam", StatusPerkawinan: "menikah",
			Alamat: "Jl. Raya Serpong No. 120", Kota: "Tangerang", Provinsi: "Banten",
			NoHP: "081234567012", Email: "rizky.pratama@rs.com",
			TipeKaryawan: models.EmployeeTypeIT, StatusKepegawaian: models.EmploymentStatusKontrak,
			TanggalMasuk: &joinDate, Departemen: "IT", Jabatan: "System Administrator",
			PendidikanTerakhir: "S1", NamaInstitusi: "Universitas Bina Nusantara", TahunLulus: 2016,
		},
	}

	var employeeMap = make(map[string]uint)
	for _, emp := range employees {
		var existing models.Employee
		result := db.Where("nik = ?", emp.NIK).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&emp).Error; err != nil {
				return err
			}
			employeeMap[emp.NamaLengkap] = emp.ID
		} else {
			employeeMap[emp.NamaLengkap] = existing.ID
		}
	}

	// ==========================================
	// USERS (Default Admin & Sample Users)
	// ==========================================
	// Get first employee ID for admin link
	var adminEmployeeID *uint
	if id, ok := employeeMap["Rizky Pratama, S.Kom"]; ok {
		adminEmployeeID = &id
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), 14)

	users := []struct {
		Email      string
		Username   string
		Password   string
		FullName   string
		RoleName   string
		EmployeeID *uint
	}{
		{"admin@simrs.com", "admin", string(hashedPassword), "Administrator", "Super Admin", adminEmployeeID},
		{"dokter@simrs.com", "dokter", string(hashedPassword), "dr. Ahmad Sudirman", "Dokter", nil},
		{"perawat@simrs.com", "perawat", string(hashedPassword), "Ns. Ratna Sari, S.Kep", "Perawat", nil},
		{"pendaftaran@simrs.com", "pendaftaran", string(hashedPassword), "Lisa Permatasari", "Pendaftaran", nil},
		{"kasir@simrs.com", "kasir", string(hashedPassword), "Kasir RS", "Kasir", nil},
		{"apoteker@simrs.com", "apoteker", string(hashedPassword), "Apt. Hendra Gunawan, S.Farm", "Apoteker", nil},
		{"lab@simrs.com", "lab", string(hashedPassword), "Dian Permata, A.Md.AK", "Laboratorium", nil},
	}

	for _, u := range users {
		var existing models.User
		result := db.Where("username = ?", u.Username).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			roleID := roleMap[u.RoleName]
			if roleID == 0 {
				roleID = roleMap["Admin"] // fallback
			}
			user := models.User{
				Email:      u.Email,
				Username:   u.Username,
				Password:   u.Password,
				FullName:   u.FullName,
				RoleID:     roleID,
				EmployeeID: u.EmployeeID,
				IsActive:   true,
			}
			if err := db.Create(&user).Error; err != nil {
				return err
			}
		}
	}

	// ==========================================
	// PATIENTS (Sample Data)
	// ==========================================
	patientDOB1 := models.DateOnly{Time: time.Date(1985, 3, 15, 0, 0, 0, 0, time.UTC)}
	patientDOB2 := models.DateOnly{Time: time.Date(1990, 7, 20, 0, 0, 0, 0, time.UTC)}
	patientDOB3 := models.DateOnly{Time: time.Date(1978, 11, 5, 0, 0, 0, 0, time.UTC)}
	patientDOB4 := models.DateOnly{Time: time.Date(2015, 2, 10, 0, 0, 0, 0, time.UTC)}
	patientDOB5 := models.DateOnly{Time: time.Date(1965, 9, 25, 0, 0, 0, 0, time.UTC)}

	patients := []models.Patient{
		{
			NoRM: "RM-000001", NIK: "3201011503850001",
			NamaLengkap: "Agus Setiawan", TempatLahir: "Jakarta", TanggalLahir: &patientDOB1,
			JenisKelamin: models.GenderMale, GolonganDarah: models.BloodTypeA, Rhesus: models.RhesusPositive,
			Agama: "islam", StatusPerkawinan: "menikah", Pekerjaan: "Karyawan Swasta",
			AlamatKTP: "Jl. Kebon Jeruk No. 10", KelurahanKTP: "Kebon Jeruk", KecamatanKTP: "Kebon Jeruk",
			KotaKTP: "Jakarta Barat", ProvinsiKTP: "DKI Jakarta", KodePosKTP: "11530",
			NoHP: "081200000001", Email: "agus.setiawan@email.com",
			Status: models.PatientStatusActive,
		},
		{
			NoRM: "RM-000002", NIK: "3201012007900002",
			NamaLengkap: "Siti Rahayu", TempatLahir: "Bandung", TanggalLahir: &patientDOB2,
			JenisKelamin: models.GenderFemale, GolonganDarah: models.BloodTypeB, Rhesus: models.RhesusPositive,
			Agama: "islam", StatusPerkawinan: "belum_menikah", Pekerjaan: "Guru",
			AlamatKTP: "Jl. Dago No. 20", KelurahanKTP: "Dago", KecamatanKTP: "Coblong",
			KotaKTP: "Bandung", ProvinsiKTP: "Jawa Barat", KodePosKTP: "40135",
			NoHP: "081200000002", Email: "siti.rahayu@email.com",
			Status: models.PatientStatusActive,
		},
		{
			NoRM: "RM-000003", NIK: "3201010511780003",
			NamaLengkap: "Bambang Sutrisno", TempatLahir: "Surabaya", TanggalLahir: &patientDOB3,
			JenisKelamin: models.GenderMale, GolonganDarah: models.BloodTypeO, Rhesus: models.RhesusPositive,
			Agama: "kristen", StatusPerkawinan: "menikah", Pekerjaan: "Wiraswasta",
			AlamatKTP: "Jl. Tunjungan No. 30", KelurahanKTP: "Genteng", KecamatanKTP: "Genteng",
			KotaKTP: "Surabaya", ProvinsiKTP: "Jawa Timur", KodePosKTP: "60275",
			NoHP: "081200000003", Email: "bambang.sutrisno@email.com",
			JenisJaminan: models.InsuranceTypeBPJS, NoBPJS: "0001234567890",
			Status: models.PatientStatusActive,
		},
		{
			NoRM: "RM-000004", NIK: "3201011002150004",
			NamaLengkap: "Andi Pratama", NamaPanggilan: "Andi", TempatLahir: "Yogyakarta", TanggalLahir: &patientDOB4,
			JenisKelamin: models.GenderMale, GolonganDarah: models.BloodTypeAB, Rhesus: models.RhesusPositive,
			Agama: "islam", StatusPerkawinan: "belum_menikah", Pekerjaan: "Pelajar",
			AlamatKTP: "Jl. Malioboro No. 40", KelurahanKTP: "Gedongtengen", KecamatanKTP: "Gedongtengen",
			KotaKTP: "Yogyakarta", ProvinsiKTP: "DI Yogyakarta", KodePosKTP: "55272",
			NoHP:                "081200000004",
			NamaPenanggungJawab: "Yudi Pratama", HubunganPenanggungJawab: "Ayah", TeleponPenanggungJawab: "081200000044",
			Status: models.PatientStatusActive,
		},
		{
			NoRM: "RM-000005", NIK: "3201012509650005",
			NamaLengkap: "Sumiati", TempatLahir: "Semarang", TanggalLahir: &patientDOB5,
			JenisKelamin: models.GenderFemale, GolonganDarah: models.BloodTypeA, Rhesus: models.RhesusNegative,
			Agama: "islam", StatusPerkawinan: "menikah", Pekerjaan: "Ibu Rumah Tangga",
			AlamatKTP: "Jl. Pandanaran No. 50", KelurahanKTP: "Pekunden", KecamatanKTP: "Semarang Tengah",
			KotaKTP: "Semarang", ProvinsiKTP: "Jawa Tengah", KodePosKTP: "50134",
			NoHP:         "081200000005",
			JenisJaminan: models.InsuranceTypeBPJS, NoBPJS: "0001234567891", KelasBPJS: "1",
			AlergiObat: "Penisilin",
			Status:     models.PatientStatusActive,
		},
	}

	for _, patient := range patients {
		var existing models.Patient
		result := db.Where("no_rm = ? OR nik = ?", patient.NoRM, patient.NIK).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&patient).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
