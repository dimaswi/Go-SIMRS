package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"time"

	"github.com/gin-gonic/gin"
)

// PublicGetSettings returns app name and logo for public pages
func PublicGetSettings(c *gin.Context) {
	var settings []models.Setting
	if err := database.DB.Where("key IN ?", []string{"app_name", "app_logo"}).Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch settings"})
		return
	}

	settingsMap := make(map[string]string)
	for _, setting := range settings {
		settingsMap[setting.Key] = setting.Value
	}

	c.JSON(http.StatusOK, gin.H{"data": settingsMap})
}

// PublicGetSchedules returns available schedules for polyclinics
func PublicGetSchedules(c *gin.Context) {
	dateStr := c.Query("date")
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid. Gunakan YYYY-MM-DD"})
		return
	}

	// For simplicity, we just fetch schedules where day of week matches
	dayOfWeek := int(date.Weekday())
	// In Go, Sunday=0, Monday=1, etc. Our models might use 1=Monday, 7=Sunday
	var dbDay int
	if dayOfWeek == 0 {
		dbDay = 7
	} else {
		dbDay = dayOfWeek
	}

	var schedules []models.DoctorSchedule
	if err := database.DB.Preload("Employee").Preload("Room").
		Where("day_of_week = ? AND is_active = ?", dbDay, true).
		Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil jadwal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": schedules})
}

// PublicCheckNIK checks if a patient exists by NIK
func PublicCheckNIK(c *gin.Context) {
	nik := c.Query("nik")
	if nik == "" || len(nik) != 16 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIK harus 16 digit"})
		return
	}

	var patient models.Patient
	if err := database.DB.Where("nik = ?", nik).First(&patient).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "not_found"})
		return
	}

	// Mask the name
	name := patient.NamaLengkap
	maskedName := maskName(name)

	c.JSON(http.StatusOK, gin.H{
		"message": "found",
		"data": map[string]interface{}{
			"id":           patient.ID,
			"nama_lengkap": maskedName,
			"no_rm":        patient.NoRM, // Usually we don't expose NoRM to public but sometimes they need to verify
		},
	})
}

func maskName(name string) string {
	if len(name) <= 2 {
		return name + "***"
	}
	return name[:2] + "***"
}

type PublicQueueInput struct {
	IsNewPatient bool   `json:"is_new_patient"`
	NIK          string `json:"nik" binding:"required"`
	NamaLengkap  string `json:"nama_lengkap"` // required if new patient
	NoHP         string `json:"no_hp"`        // required if new patient
	TanggalLahir string `json:"tanggal_lahir"`
	RoomID       uint   `json:"room_id" binding:"required"`
	DoctorID     uint   `json:"doctor_id" binding:"required"`
	BookingDate  string `json:"booking_date" binding:"required"`
}

// PublicRegisterQueue handles public online queue registration
func PublicRegisterQueue(c *gin.Context) {
	var input PublicQueueInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.DB.Begin()

	var patient models.Patient
	if input.IsNewPatient {
		// Create new patient
		if input.NamaLengkap == "" || input.NoHP == "" || input.TanggalLahir == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien baru tidak lengkap (Nama, No HP, Tanggal Lahir wajib diisi)"})
			return
		}

		tglLahir, err := time.Parse("2006-01-02", input.TanggalLahir)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal lahir tidak valid (YYYY-MM-DD)"})
			return
		}

		patient = models.Patient{
			NIK:                input.NIK,
			NamaLengkap:        input.NamaLengkap,
			NoHP:               input.NoHP,
			TanggalLahir:       &models.DateOnly{Time: tglLahir},
			RegistrationSource: "online",
			Status:             "Aktif",
			JenisJaminan:       "Umum",
		}

		if err := tx.Create(&patient).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data pasien baru"})
			return
		}
	} else {
		// Find existing patient
		if err := tx.Where("nik = ?", input.NIK).First(&patient).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusNotFound, gin.H{"error": "Pasien dengan NIK tersebut tidak ditemukan"})
			return
		}
	}

	bookingDate, err := time.Parse("2006-01-02", input.BookingDate)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal booking tidak valid (YYYY-MM-DD)"})
		return
	}

	// Validate room and doctor exist
	var room models.Room
	if err := tx.First(&room, input.RoomID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poli tidak ditemukan"})
		return
	}

	var doctor models.Employee
	if err := tx.First(&doctor, input.DoctorID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter tidak ditemukan"})
		return
	}

	// Check if patient already registered for this date
	var existingRegCount int64
	if err := tx.Model(&models.Registration{}).
		Where("patient_id = ? AND DATE(scheduled_date) = ? AND status != 'cancelled'", patient.ID, bookingDate.Format("2006-01-02")).
		Count(&existingRegCount).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengecek antrian pasien"})
		return
	}

	if existingRegCount > 0 {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien dengan NIK tersebut sudah mengambil antrian pada tanggal ini"})
		return
	}

	// Generate registration number ([QueueCode]-YYYYMMDD-XXX)
	todayStr := time.Now().Format("20060102")
	queueCode := room.QueueCode
	if queueCode == "" {
		queueCode = "Q" // Default fallback
	}
	prefix := fmt.Sprintf("%s-%s", queueCode, todayStr)
	
	var count int64
	tx.Model(&models.Registration{}).Where("registration_number LIKE ?", prefix+"%").Count(&count)
	regNumber := fmt.Sprintf("%s-%03d", prefix, count+1)

	// Create registration
	registration := models.Registration{
		RegistrationNumber: regNumber,
		RegistrationDate:   time.Now(),
		RegistrationType:   "outpatient",
		PatientID:          patient.ID,
		DestinationRoomID:  input.RoomID,
		DoctorID:           &input.DoctorID,
		PaymentMethod:      "cash",
		Status:             "scheduled", // Scheduled because it's online booking
		ScheduledDate:      &bookingDate,
		Notes:              "Pendaftaran Online via Web",
	}

	if err := tx.Create(&registration).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data pendaftaran"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit pendaftaran"})
		return
	}

	// Reload with associations for response
	database.DB.Preload("Patient").Preload("DestinationRoom").Preload("Doctor").First(&registration, registration.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Pendaftaran berhasil",
		"data":    registration,
	})
}
