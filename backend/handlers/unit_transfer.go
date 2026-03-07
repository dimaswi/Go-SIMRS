package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"time"

	"github.com/gin-gonic/gin"
)

// ===========================================================================
// UNIT TRANSFER HANDLERS - Mutasi Unit (Pindah Ruangan untuk Rawat Jalan/UGD)
// ===========================================================================

// GetUnitTransfers returns all unit transfer records for a visit
func GetUnitTransfers(c *gin.Context) {
	visitID := c.Param("id")

	// Verify visit exists
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Only for rawat_jalan and gawat_darurat
	if visit.Room == nil || (visit.Room.ServiceType != "rawat_jalan" && visit.Room.ServiceType != "gawat_darurat") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mutasi unit hanya tersedia untuk rawat jalan dan UGD"})
		return
	}

	var transfers []models.UnitTransfer
	if err := database.DB.
		Where("visit_id = ?", visitID).
		Preload("FromRoom").
		Preload("FromDoctor").
		Preload("ToRoom").
		Preload("ToDoctor").
		Preload("CreatedBy").
		Order("transfer_date DESC").
		Find(&transfers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mutasi unit"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": transfers})
}

// CreateUnitTransfer creates a new unit transfer (mutasi unit)
func CreateUnitTransfer(c *gin.Context) {
	visitID := c.Param("id")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		ToRoomID       uint   `json:"to_room_id" binding:"required"`
		ToDoctorID     *uint  `json:"to_doctor_id"`
		TransferReason string `json:"transfer_reason"`
		Notes          string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get visit with current room and doctor
	var visit models.Visit
	if err := database.DB.
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Verify it's rawat_jalan or gawat_darurat
	if visit.Room == nil || (visit.Room.ServiceType != "rawat_jalan" && visit.Room.ServiceType != "gawat_darurat") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mutasi unit hanya tersedia untuk rawat jalan dan UGD"})
		return
	}

	// Verify visit is still active
	if visit.Status != "in_progress" && visit.Status != "waiting" && visit.Status != "in_queue" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mutasi hanya bisa dilakukan untuk kunjungan aktif"})
		return
	}

	// Verify target room exists and is appropriate service type
	var targetRoom models.Room
	if err := database.DB.First(&targetRoom, input.ToRoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan tujuan tidak ditemukan"})
		return
	}

	// Target room must be rawat_jalan or gawat_darurat (allow cross-service transfer between the two)
	if targetRoom.ServiceType != "rawat_jalan" && targetRoom.ServiceType != "gawat_darurat" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Ruangan tujuan harus bertipe Rawat Jalan atau UGD",
		})
		return
	}

	// Cannot transfer to the same room
	if input.ToRoomID == visit.RoomID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan tujuan sama dengan ruangan saat ini"})
		return
	}

	// Verify target doctor exists (if provided)
	if input.ToDoctorID != nil && *input.ToDoctorID > 0 {
		var doctor models.Employee
		if err := database.DB.First(&doctor, *input.ToDoctorID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter tujuan tidak ditemukan"})
			return
		}
	}

	// Start transaction
	tx := database.DB.Begin()

	// Create transfer record
	now := time.Now()
	transfer := models.UnitTransfer{
		VisitID:        visit.ID,
		FromRoomID:     visit.RoomID,
		FromDoctorID:   visit.DoctorID,
		ToRoomID:       input.ToRoomID,
		ToDoctorID:     input.ToDoctorID,
		TransferDate:   now,
		TransferReason: input.TransferReason,
		Notes:          input.Notes,
		CreatedByID:    &userID,
	}

	if err := tx.Create(&transfer).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat catatan mutasi unit"})
		return
	}

	// Update visit with new room and doctor
	updates := map[string]interface{}{
		"room_id": input.ToRoomID,
	}
	if input.ToDoctorID != nil && *input.ToDoctorID > 0 {
		updates["doctor_id"] = *input.ToDoctorID
	}

	// Always sync visit_type with the target room's service type
	switch targetRoom.ServiceType {
	case "rawat_jalan":
		updates["visit_type"] = models.VisitTypeOutpatient
	case "gawat_darurat":
		updates["visit_type"] = models.VisitTypeEmergency
	}

	if err := tx.Model(&models.Visit{}).Where("id = ?", visit.ID).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update kunjungan"})
		return
	}

	// Update room queue: update existing queue to point to new room
	tx.Model(&models.RoomQueue{}).
		Where("visit_id = ?", visit.ID).
		Updates(map[string]interface{}{
			"room_id": input.ToRoomID,
			"status":  "waiting",
		})

	tx.Commit()

	// Reload transfer with relations
	database.DB.
		Preload("FromRoom").
		Preload("FromDoctor").
		Preload("ToRoom").
		Preload("ToDoctor").
		Preload("CreatedBy").
		First(&transfer, transfer.ID)

	// Send notifications
	if NotifService != nil {
		var visitWithPatient models.Visit
		database.DB.Preload("Registration.Patient").First(&visitWithPatient, visit.ID)
		patientName := ""
		if visitWithPatient.Registration != nil && visitWithPatient.Registration.Patient != nil {
			patientName = visitWithPatient.Registration.Patient.NamaLengkap
		}

		fromRoomName := ""
		if transfer.FromRoom != nil {
			fromRoomName = transfer.FromRoom.Name
		}
		toRoomName := ""
		if transfer.ToRoom != nil {
			toRoomName = transfer.ToRoom.Name
		}

		// Notify previous room
		go NotifService.NotifyRoomUsers(
			transfer.FromRoomID,
			models.NotificationTypeBedTransfer,
			"Pasien Pindah Unit",
			fmt.Sprintf("Pasien %s telah dipindahkan dari %s ke %s", patientName, fromRoomName, toRoomName),
			map[string]interface{}{
				"visit_id":      visit.ID,
				"transfer_id":   transfer.ID,
				"patient_name":  patientName,
				"from_room":     fromRoomName,
				"to_room":       toRoomName,
				"transfer_type": "out",
			},
		)

		// Notify target room
		go NotifService.NotifyRoomUsers(
			input.ToRoomID,
			models.NotificationTypeBedTransfer,
			"Pasien Mutasi Masuk",
			fmt.Sprintf("Pasien %s telah masuk ke %s dari %s", patientName, toRoomName, fromRoomName),
			map[string]interface{}{
				"visit_id":      visit.ID,
				"transfer_id":   transfer.ID,
				"patient_name":  patientName,
				"from_room":     fromRoomName,
				"to_room":       toRoomName,
				"transfer_type": "in",
			},
		)
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    transfer,
		"message": "Mutasi unit berhasil",
	})
}
