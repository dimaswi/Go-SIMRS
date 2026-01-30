package migrations

import (
	"starter/backend/models"

	"gorm.io/gorm"
)

// SeedRooms seeds Room, RoomUnit, Bed, and Schedule data
func SeedRooms(db *gorm.DB) error {
	// ==========================================
	// ROOMS - Rawat Jalan (Poliklinik)
	// ==========================================
	roomsRawatJalan := []models.Room{
		{
			Code: "POLI-001", Name: "Poli Umum", QueueCode: "A",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Umum untuk pemeriksaan kesehatan umum",
		},
		{
			Code: "POLI-002", Name: "Poli Anak", QueueCode: "B",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Anak untuk pasien usia 0-18 tahun",
		},
		{
			Code: "POLI-003", Name: "Poli Penyakit Dalam", QueueCode: "C",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Penyakit Dalam",
		},
		{
			Code: "POLI-004", Name: "Poli Gigi", QueueCode: "D",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Gigi dan Mulut",
		},
		{
			Code: "POLI-005", Name: "Poli Mata", QueueCode: "E",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Mata",
		},
		{
			Code: "POLI-006", Name: "Poli Kebidanan", QueueCode: "F",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Kebidanan dan Kandungan",
		},
		{
			Code: "POLI-007", Name: "Poli Bedah", QueueCode: "G",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Bedah Umum",
		},
		{
			Code: "POLI-008", Name: "Poli THT", QueueCode: "H",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Telinga Hidung Tenggorokan",
		},
		{
			Code: "POLI-009", Name: "Poli Kulit & Kelamin", QueueCode: "I",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Kulit dan Kelamin",
		},
		{
			Code: "POLI-010", Name: "Poli Jantung", QueueCode: "J",
			ServiceType: "rawat_jalan", RoomType: "poliklinik",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Poliklinik Jantung dan Pembuluh Darah",
		},
	}

	// ==========================================
	// ROOMS - Gawat Darurat
	// ==========================================
	roomsGawatDarurat := []models.Room{
		{
			Code: "UGD-001", Name: "Unit Gawat Darurat", QueueCode: "U",
			ServiceType: "gawat_darurat", RoomType: "ugd",
			HasBed: true, HasSchedule: false, IsActive: true,
			Description: "Unit Gawat Darurat 24 Jam",
		},
	}

	// ==========================================
	// ROOMS - Rawat Inap
	// ==========================================
	roomsRawatInap := []models.Room{
		{
			Code: "RI-VIP-001", Name: "Ruang VIP Melati", QueueCode: "",
			ServiceType: "rawat_inap", RoomType: "rawat_inap", RoomClass: "vip",
			HasBed: true, HasSchedule: false, IsActive: true, TariffPerDay: 1500000,
			Description: "Ruang rawat inap VIP dengan fasilitas lengkap",
			Facilities:  "AC, TV, Kulkas, Sofa Bed, Kamar Mandi Dalam, WiFi",
		},
		{
			Code: "RI-K1-001", Name: "Ruang Kelas 1 Mawar", QueueCode: "",
			ServiceType: "rawat_inap", RoomType: "rawat_inap", RoomClass: "kelas_1",
			HasBed: true, HasSchedule: false, IsActive: true, TariffPerDay: 750000,
			Description: "Ruang rawat inap Kelas 1",
			Facilities:  "AC, TV, Kamar Mandi Dalam",
		},
		{
			Code: "RI-K2-001", Name: "Ruang Kelas 2 Anggrek", QueueCode: "",
			ServiceType: "rawat_inap", RoomType: "rawat_inap", RoomClass: "kelas_2",
			HasBed: true, HasSchedule: false, IsActive: true, TariffPerDay: 450000,
			Description: "Ruang rawat inap Kelas 2",
			Facilities:  "Kipas Angin, Kamar Mandi Dalam",
		},
		{
			Code: "RI-K3-001", Name: "Ruang Kelas 3 Dahlia", QueueCode: "",
			ServiceType: "rawat_inap", RoomType: "rawat_inap", RoomClass: "kelas_3",
			HasBed: true, HasSchedule: false, IsActive: true, TariffPerDay: 250000,
			Description: "Ruang rawat inap Kelas 3",
			Facilities:  "Kipas Angin, Kamar Mandi Bersama",
		},
		{
			Code: "RI-ICU-001", Name: "ICU", QueueCode: "",
			ServiceType: "rawat_inap", RoomType: "icu", RoomClass: "intensif",
			HasBed: true, HasSchedule: false, IsActive: true, TariffPerDay: 3000000,
			Description: "Intensive Care Unit",
			Facilities:  "Ventilator, Monitor, Bed Elektrik",
		},
		{
			Code: "RI-NICU-001", Name: "NICU", QueueCode: "",
			ServiceType: "rawat_inap", RoomType: "nicu", RoomClass: "intensif",
			HasBed: true, HasSchedule: false, IsActive: true, TariffPerDay: 2500000,
			Description: "Neonatal Intensive Care Unit",
			Facilities:  "Inkubator, Warmer, Monitor Neonatal",
		},
		{
			Code: "RI-PICU-001", Name: "PICU", QueueCode: "",
			ServiceType: "rawat_inap", RoomType: "picu", RoomClass: "intensif",
			HasBed: true, HasSchedule: false, IsActive: true, TariffPerDay: 2500000,
			Description: "Pediatric Intensive Care Unit",
			Facilities:  "Ventilator Pediatrik, Monitor",
		},
		{
			Code: "RI-ISO-001", Name: "Ruang Isolasi", QueueCode: "",
			ServiceType: "rawat_inap", RoomType: "isolasi", RoomClass: "isolasi",
			HasBed: true, HasSchedule: false, IsActive: true, TariffPerDay: 1000000,
			Description: "Ruang Isolasi untuk penyakit menular",
			Facilities:  "Negative Pressure, AC, Kamar Mandi Dalam",
		},
	}

	// ==========================================
	// ROOMS - Penunjang
	// ==========================================
	roomsPenunjang := []models.Room{
		{
			Code: "LAB-001", Name: "Laboratorium", QueueCode: "L",
			ServiceType: "penunjang_medis", RoomType: "laboratorium",
			HasBed: false, HasSchedule: false, IsActive: true,
			Description: "Laboratorium Klinik",
		},
		{
			Code: "RAD-001", Name: "Radiologi", QueueCode: "R",
			ServiceType: "penunjang_medis", RoomType: "radiologi",
			HasBed: false, HasSchedule: false, IsActive: true,
			Description: "Unit Radiologi (Rontgen, USG, CT-Scan)",
		},
		{
			Code: "FARM-001", Name: "Farmasi", QueueCode: "P",
			ServiceType: "farmasi", RoomType: "farmasi",
			HasBed: false, HasSchedule: false, IsActive: true,
			Description: "Apotek / Instalasi Farmasi",
		},
		{
			Code: "OK-001", Name: "Kamar Operasi", QueueCode: "OK",
			ServiceType: "penunjang_medis", RoomType: "ok",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Kamar Operasi (OK)",
		},
		{
			Code: "VK-001", Name: "Kamar Bersalin", QueueCode: "",
			ServiceType: "penunjang_medis", RoomType: "kamar_bersalin",
			HasBed: true, HasSchedule: false, IsActive: true,
			Description: "Kamar Bersalin (VK)",
		},
		{
			Code: "HD-001", Name: "Hemodialisa", QueueCode: "",
			ServiceType: "penunjang_medis", RoomType: "hemodialisa",
			HasBed: true, HasSchedule: true, IsActive: true,
			Description: "Unit Hemodialisa / Cuci Darah",
		},
		{
			Code: "REHAB-001", Name: "Rehabilitasi Medik", QueueCode: "",
			ServiceType: "penunjang_medis", RoomType: "rehabilitasi",
			HasBed: false, HasSchedule: true, IsActive: true,
			Description: "Unit Rehabilitasi Medik / Fisioterapi",
		},
	}

	// ==========================================
	// ROOMS - Administrasi
	// ==========================================
	roomsAdministrasi := []models.Room{
		{
			Code: "ADM-001", Name: "Pendaftaran", QueueCode: "",
			ServiceType: "administrasi", RoomType: "pendaftaran",
			HasBed: false, HasSchedule: false, IsActive: true,
			Description: "Loket Pendaftaran Pasien",
		},
		{
			Code: "ADM-002", Name: "Kasir", QueueCode: "",
			ServiceType: "administrasi", RoomType: "kasir",
			HasBed: false, HasSchedule: false, IsActive: true,
			Description: "Loket Kasir / Pembayaran",
		},
		{
			Code: "ADM-003", Name: "Rekam Medis", QueueCode: "",
			ServiceType: "administrasi", RoomType: "rekam_medis",
			HasBed: false, HasSchedule: false, IsActive: true,
			Description: "Unit Rekam Medis",
		},
	}

	// Combine all rooms
	allRooms := append(roomsRawatJalan, roomsGawatDarurat...)
	allRooms = append(allRooms, roomsRawatInap...)
	allRooms = append(allRooms, roomsPenunjang...)
	allRooms = append(allRooms, roomsAdministrasi...)

	var roomMap = make(map[string]uint)
	for _, room := range allRooms {
		var existing models.Room
		result := db.Where("code = ?", room.Code).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&room).Error; err != nil {
				return err
			}
			roomMap[room.Code] = room.ID
		} else {
			roomMap[room.Code] = existing.ID
		}
	}

	// ==========================================
	// ROOM UNITS & BEDS - for rooms with beds
	// ==========================================
	roomUnitsData := []struct {
		RoomCode string
		Units    []struct {
			Code     string
			Name     string
			Floor    int
			Capacity int
			Beds     []string // Bed numbers
		}
	}{
		// UGD
		{
			RoomCode: "UGD-001",
			Units: []struct {
				Code     string
				Name     string
				Floor    int
				Capacity int
				Beds     []string
			}{
				{Code: "UGD-T1", Name: "Triase", Floor: 1, Capacity: 2, Beds: []string{"T1", "T2"}},
				{Code: "UGD-R1", Name: "Resusitasi", Floor: 1, Capacity: 2, Beds: []string{"R1", "R2"}},
				{Code: "UGD-O1", Name: "Observasi", Floor: 1, Capacity: 4, Beds: []string{"O1", "O2", "O3", "O4"}},
			},
		},
		// VIP
		{
			RoomCode: "RI-VIP-001",
			Units: []struct {
				Code     string
				Name     string
				Floor    int
				Capacity int
				Beds     []string
			}{
				{Code: "VIP-101", Name: "Kamar VIP 101", Floor: 1, Capacity: 1, Beds: []string{"A"}},
				{Code: "VIP-102", Name: "Kamar VIP 102", Floor: 1, Capacity: 1, Beds: []string{"A"}},
				{Code: "VIP-103", Name: "Kamar VIP 103", Floor: 1, Capacity: 1, Beds: []string{"A"}},
				{Code: "VIP-201", Name: "Kamar VIP 201", Floor: 2, Capacity: 1, Beds: []string{"A"}},
				{Code: "VIP-202", Name: "Kamar VIP 202", Floor: 2, Capacity: 1, Beds: []string{"A"}},
			},
		},
		// Kelas 1
		{
			RoomCode: "RI-K1-001",
			Units: []struct {
				Code     string
				Name     string
				Floor    int
				Capacity int
				Beds     []string
			}{
				{Code: "K1-101", Name: "Kamar 101", Floor: 1, Capacity: 2, Beds: []string{"A", "B"}},
				{Code: "K1-102", Name: "Kamar 102", Floor: 1, Capacity: 2, Beds: []string{"A", "B"}},
				{Code: "K1-103", Name: "Kamar 103", Floor: 1, Capacity: 2, Beds: []string{"A", "B"}},
			},
		},
		// Kelas 2
		{
			RoomCode: "RI-K2-001",
			Units: []struct {
				Code     string
				Name     string
				Floor    int
				Capacity int
				Beds     []string
			}{
				{Code: "K2-101", Name: "Kamar 101", Floor: 1, Capacity: 4, Beds: []string{"A", "B", "C", "D"}},
				{Code: "K2-102", Name: "Kamar 102", Floor: 1, Capacity: 4, Beds: []string{"A", "B", "C", "D"}},
			},
		},
		// Kelas 3
		{
			RoomCode: "RI-K3-001",
			Units: []struct {
				Code     string
				Name     string
				Floor    int
				Capacity int
				Beds     []string
			}{
				{Code: "K3-101", Name: "Kamar 101", Floor: 1, Capacity: 6, Beds: []string{"1", "2", "3", "4", "5", "6"}},
				{Code: "K3-102", Name: "Kamar 102", Floor: 1, Capacity: 6, Beds: []string{"1", "2", "3", "4", "5", "6"}},
			},
		},
		// ICU
		{
			RoomCode: "RI-ICU-001",
			Units: []struct {
				Code     string
				Name     string
				Floor    int
				Capacity int
				Beds     []string
			}{
				{Code: "ICU-01", Name: "ICU Bed 1", Floor: 1, Capacity: 1, Beds: []string{"1"}},
				{Code: "ICU-02", Name: "ICU Bed 2", Floor: 1, Capacity: 1, Beds: []string{"1"}},
				{Code: "ICU-03", Name: "ICU Bed 3", Floor: 1, Capacity: 1, Beds: []string{"1"}},
				{Code: "ICU-04", Name: "ICU Bed 4", Floor: 1, Capacity: 1, Beds: []string{"1"}},
			},
		},
		// Isolasi
		{
			RoomCode: "RI-ISO-001",
			Units: []struct {
				Code     string
				Name     string
				Floor    int
				Capacity int
				Beds     []string
			}{
				{Code: "ISO-01", Name: "Kamar Isolasi 1", Floor: 1, Capacity: 1, Beds: []string{"A"}},
				{Code: "ISO-02", Name: "Kamar Isolasi 2", Floor: 1, Capacity: 1, Beds: []string{"A"}},
			},
		},
	}

	for _, roomData := range roomUnitsData {
		roomID := roomMap[roomData.RoomCode]
		if roomID == 0 {
			continue
		}

		for _, unitData := range roomData.Units {
			var existingUnit models.RoomUnit
			result := db.Where("room_id = ? AND code = ?", roomID, unitData.Code).First(&existingUnit)
			if result.Error == gorm.ErrRecordNotFound {
				unit := models.RoomUnit{
					RoomID:   roomID,
					Code:     unitData.Code,
					Name:     unitData.Name,
					Floor:    unitData.Floor,
					Capacity: unitData.Capacity,
					IsActive: true,
				}
				if err := db.Create(&unit).Error; err != nil {
					return err
				}

				// Create beds
				for _, bedNum := range unitData.Beds {
					bed := models.Bed{
						RoomUnitID: unit.ID,
						BedNumber:  bedNum,
						BedType:    "standar",
						Status:     "available",
					}
					if err := db.Create(&bed).Error; err != nil {
						return err
					}
				}
			}
		}
	}

	// ==========================================
	// SCHEDULES - for rooms with schedules (Poliklinik)
	// ==========================================
	scheduleData := []struct {
		RoomCode   string
		DayOfWeek  int
		StartTime  string
		EndTime    string
		MaxPatient int
	}{
		// Poli Umum - Senin s/d Sabtu
		{"POLI-001", 1, "08:00", "12:00", 30},
		{"POLI-001", 1, "13:00", "16:00", 20},
		{"POLI-001", 2, "08:00", "12:00", 30},
		{"POLI-001", 2, "13:00", "16:00", 20},
		{"POLI-001", 3, "08:00", "12:00", 30},
		{"POLI-001", 3, "13:00", "16:00", 20},
		{"POLI-001", 4, "08:00", "12:00", 30},
		{"POLI-001", 4, "13:00", "16:00", 20},
		{"POLI-001", 5, "08:00", "12:00", 30},
		{"POLI-001", 5, "13:00", "16:00", 20},
		{"POLI-001", 6, "08:00", "12:00", 20},
		// Poli Anak - Senin s/d Jumat
		{"POLI-002", 1, "08:00", "12:00", 25},
		{"POLI-002", 2, "08:00", "12:00", 25},
		{"POLI-002", 3, "08:00", "12:00", 25},
		{"POLI-002", 4, "08:00", "12:00", 25},
		{"POLI-002", 5, "08:00", "12:00", 25},
		// Poli Penyakit Dalam - Senin, Rabu, Jumat
		{"POLI-003", 1, "09:00", "13:00", 20},
		{"POLI-003", 3, "09:00", "13:00", 20},
		{"POLI-003", 5, "09:00", "13:00", 20},
		// Poli Gigi - Setiap hari kerja
		{"POLI-004", 1, "08:00", "14:00", 15},
		{"POLI-004", 2, "08:00", "14:00", 15},
		{"POLI-004", 3, "08:00", "14:00", 15},
		{"POLI-004", 4, "08:00", "14:00", 15},
		{"POLI-004", 5, "08:00", "14:00", 15},
	}

	for _, s := range scheduleData {
		roomID := roomMap[s.RoomCode]
		if roomID == 0 {
			continue
		}

		var existing models.Schedule
		result := db.Where("room_id = ? AND day_of_week = ? AND start_time = ?", roomID, s.DayOfWeek, s.StartTime).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			schedule := models.Schedule{
				RoomID:      roomID,
				DayOfWeek:   s.DayOfWeek,
				StartTime:   s.StartTime,
				EndTime:     s.EndTime,
				MaxPatients: s.MaxPatient,
				IsActive:    true,
			}
			if err := db.Create(&schedule).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
