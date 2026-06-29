package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"starter/backend/database"
	"starter/backend/models"
	bpjsService "starter/backend/services/bpjs"
)

// CheckInBySuratKontrolInput berisi no_surat_kontrol untuk check-in via QR SKDP
type CheckInBySuratKontrolInput struct {
	NoSuratKontrol string `json:"no_surat_kontrol" binding:"required"`
}

// CheckInBySuratKontrol melakukan check-in berdasarkan nomor surat kontrol BPJS (SKDP)
// yang digunakan saat pasien scan QR code di anjungan mandiri.
//
// Alur:
//  1. Cari SuratKontrol berdasarkan no_surat_kontrol
//  2. Cari ScheduledRegistration yang terhubung (via SourceVisit.ID -> SuratKontrol.VisitID)
//  3. Jika ditemukan, lakukan check-in via CheckInScheduledRegistration logic
//  4. Jika registrasi hari ini belum ada, buat baru lalu check-in
//
// POST /api/registrations/checkin-by-surat-kontrol
func CheckInBySuratKontrol(c *gin.Context) {
	var input CheckInBySuratKontrolInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no_surat_kontrol wajib diisi"})
		return
	}

	noSK := strings.TrimSpace(input.NoSuratKontrol)

	// 1. Cari SuratKontrol
	var sk models.SuratKontrol
	if err := database.DB.
		Preload("Patient").
		Preload("Visit").
		Where("no_surat_kontrol = ?", noSK).
		First(&sk).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Surat Kontrol dengan nomor '%s' tidak ditemukan", noSK)})
		return
	}

	// 2. Validasi status Surat Kontrol
	if sk.Status == "used" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Surat Kontrol '%s' sudah pernah digunakan untuk check-in", noSK),
		})
		return
	}
	if sk.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Surat Kontrol '%s' sudah dibatalkan", noSK),
		})
		return
	}

	// 3. Cari ScheduledRegistration yang terkait dengan SuratKontrol ini
	//    SuratKontrol.VisitID = kunjungan asal (sebelum kontrol)
	//    ScheduledRegistration.SourceVisitID = kunjungan asal
	var reg models.Registration
	var regFound bool

	if sk.VisitID != nil {
		err := database.DB.
			Preload("Visit").
			Preload("Visit.RoomQueue").
			Preload("Patient").
			Preload("DestinationRoom").
			Where("source_visit_id = ? AND is_follow_up = ?", *sk.VisitID, true).
			Where("status IN ?", []string{
				models.RegistrationStatusScheduled,
				models.RegistrationStatusNoShow,
			}).
			Order("scheduled_date ASC").
			First(&reg).Error

		if err == nil {
			regFound = true
		}
	}

	if !regFound {
		// Juga cari via registration_id yang langsung tersimpan di SuratKontrol
		if sk.RegistrationID != nil {
			err := database.DB.
				Preload("Visit").
				Preload("Visit.RoomQueue").
				Preload("Patient").
				Preload("DestinationRoom").
				Where("id = ? AND status IN ?", *sk.RegistrationID, []string{
					models.RegistrationStatusScheduled,
					models.RegistrationStatusNoShow,
					models.RegistrationStatusRegistered,
				}).
				First(&reg).Error
			if err == nil {
				regFound = true
			}
		}
	}

	if !regFound {
		// Tidak ada registrasi terjadwal yang aktif
		// Beri info lengkap agar frontend bisa menampilkan detail untuk konfirmasi
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Tidak ada jadwal kontrol aktif yang ditemukan untuk surat kontrol ini",
			"surat_kontrol": gin.H{
				"no_surat_kontrol":    sk.NoSuratKontrol,
				"nama":                sk.Nama,
				"tgl_rencana_kontrol": sk.TglRencanaKontrol,
				"poli":                sk.NamaPoli,
				"dokter":              sk.NamaDokter,
				"diagnosa":            sk.NamaDiagnosa,
				"status":              sk.Status,
			},
			"hint": "Jadwal kontrol mungkin sudah tidak aktif atau tanggal tidak sesuai hari ini",
		})
		return
	}

	// 4. Validasi tanggal - hanya bisa check-in di hari H
	if reg.ScheduledDate != nil {
		now := time.Now()
		sd := *reg.ScheduledDate
		if sd.Year() != now.Year() || sd.Month() != now.Month() || sd.Day() != now.Day() {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf(
					"Jadwal kontrol adalah %s, check-in hanya bisa dilakukan pada hari H",
					sd.Format("02-01-2006"),
				),
				"scheduled_date": sd.Format("2006-01-02"),
			})
			return
		}
	}

	// 5. Validasi status tidak duplikat
	if reg.Status == models.RegistrationStatusInQueue {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien sudah dalam antrian"})
		return
	}
	if reg.Status == models.RegistrationStatusInProgress {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien sedang dilayani"})
		return
	}
	if reg.Status == models.RegistrationStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan sudah selesai"})
		return
	}

	// 6. Get current user (bisa dari sistem/kiosk, bisa pakai system user jika tidak ada)
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terautentikasi"})
		return
	}
	userIDUint := userID.(uint)

	// 7. Proses check-in (sama seperti CheckInScheduledRegistration)
	tx := database.DB.Begin()

	now := time.Now()
	reg.Status = models.RegistrationStatusInQueue
	reg.CheckedInAt = &now
	reg.CheckedInByID = &userIDUint

	if err := tx.Save(&reg).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal melakukan check-in"})
		return
	}

	var roomQueue *models.RoomQueue

	if reg.Visit != nil {
		// Update existing visit
		reg.Visit.CheckInTime = &now
		reg.Visit.Status = models.VisitStatusInQueue
		if err := tx.Save(reg.Visit).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui kunjungan"})
			return
		}

		if reg.Visit.RoomQueue != nil {
			reg.Visit.RoomQueue.Status = models.RoomQueueStatusWaiting
			reg.Visit.RoomQueue.Notes = "Check-in via QR Surat Kontrol"
			if err := tx.Save(reg.Visit.RoomQueue).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengaktifkan antrian"})
				return
			}
			roomQueue = reg.Visit.RoomQueue
		} else {
			queueNumber, err := generateRoomQueueNumber(tx, reg.DestinationRoomID, now)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat nomor antrian"})
				return
			}
			rq := models.RoomQueue{
				RoomID:      reg.DestinationRoomID,
				QueueNumber: queueNumber,
				QueueDate:   now,
				VisitID:     reg.Visit.ID,
				Status:      models.RoomQueueStatusWaiting,
				Notes:       "Check-in via QR Surat Kontrol",
			}
			if err := tx.Create(&rq).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat antrian poli"})
				return
			}
			roomQueue = &rq
		}
	} else {
		// Buat Visit dan RoomQueue baru
		todayStr := now.Format("20060102")
		var lastVisit models.Visit
		var visitNum int
		if err := tx.Unscoped().Where("visit_number LIKE ?", "VIS"+todayStr+"%").
			Order("visit_number DESC").First(&lastVisit).Error; err != nil {
			visitNum = 1
		} else {
			fmt.Sscanf(lastVisit.VisitNumber, "VIS"+todayStr+"%d", &visitNum)
			visitNum++
		}
		visitNumber := fmt.Sprintf("VIS%s%04d", todayStr, visitNum)

		visit := models.Visit{
			VisitNumber:    visitNumber,
			RegistrationID: reg.ID,
			RoomID:         reg.DestinationRoomID,
			DoctorID:       reg.DoctorID,
			VisitType:      "outpatient",
			VisitPurpose:   "Check-in via QR Surat Kontrol",
			Status:         models.VisitStatusInQueue,
			CheckInTime:    &now,
		}
		if err := tx.Create(&visit).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kunjungan"})
			return
		}

		queueNumber, err := generateRoomQueueNumber(tx, reg.DestinationRoomID, now)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat nomor antrian"})
			return
		}
		rq := models.RoomQueue{
			RoomID:      reg.DestinationRoomID,
			QueueNumber: queueNumber,
			QueueDate:   now,
			VisitID:     visit.ID,
			Status:      models.RoomQueueStatusWaiting,
			Notes:       "Check-in via QR Surat Kontrol",
		}
		if err := tx.Create(&rq).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat antrian poli"})
			return
		}
		visit.RoomQueue = &rq
		reg.Visit = &visit
		roomQueue = &rq
	}

	// 8. Tandai Surat Kontrol sebagai 'used'
	if err := tx.Model(&sk).Update("status", "used").Error; err != nil {
		// Non-fatal, log saja
		fmt.Printf("[CheckInBySuratKontrol] Gagal update status SK: %v\n", err)
	}

	// Update SEP dengan visit_id jika ada SEP untuk registration ini
	if reg.SEPNumber != "" && reg.Visit != nil {
		tx.Model(&models.SEP{}).
			Where("registration_id = ? OR no_sep = ?", reg.ID, reg.SEPNumber).
			Update("visit_id", reg.Visit.ID)
	}

	tx.Commit()

	// Untuk BPJS: Update BPJSQueue status dan kirim Task 3
	if strings.EqualFold(reg.PaymentMethod, "bpjs") {
		go func() {
			var bpjsQueue models.BPJSQueue
			if err := database.DB.Where("registration_id = ?", reg.ID).First(&bpjsQueue).Error; err == nil {
				bpjsQueue.Status = "checkin"
				bpjsQueue.WaktuCheckin = &now
				bpjsQueue.Task3At = &now
				if reg.Visit != nil {
					bpjsQueue.VisitID = &reg.Visit.ID
					if reg.Visit.RoomQueue != nil {
						bpjsQueue.RoomQueueID = &reg.Visit.RoomQueue.ID
					}
				}
				database.DB.Save(&bpjsQueue)

				if bpjsQueue.AddAntreanCode == 200 {
					bpjsService.UpdateTaskAsync(bpjsQueue.KodeBooking, 3, now, nil)
					fmt.Printf("[BPJS Check-in] Task 3 dikirim untuk kode_booking: %s\n", bpjsQueue.KodeBooking)
				} else if bpjsQueue.AddAntreanCode == 0 || bpjsQueue.SyncStatus == "failed" {
					// AddAntrean belum pernah dikirim atau gagal, retry
					addSuccess, addCode, addMsg := bpjsService.AddAntrean(&bpjsQueue)
					syncNow := time.Now()
					bpjsQueue.AddAntreanSent = true
					bpjsQueue.AddAntreanCode = addCode
					bpjsQueue.AddAntreanMsg = addMsg
					bpjsQueue.LastSyncAt = &syncNow
					if addSuccess {
						bpjsQueue.SyncStatus = "synced"
						bpjsQueue.SyncError = ""
						database.DB.Save(&bpjsQueue)
						bpjsService.UpdateTaskAsync(bpjsQueue.KodeBooking, 3, now, nil)
					} else {
						bpjsQueue.SyncStatus = "failed"
						bpjsQueue.SyncError = addMsg
						database.DB.Save(&bpjsQueue)
					}
					fmt.Printf("[BPJS Check-in] AddAntrean retry: success=%v, code=%d, msg=%s\n", addSuccess, addCode, addMsg)
				}
			}
		}()
	}

	// Reload with associations
	database.DB.
		Preload("Patient").
		Preload("DestinationRoom").
		Preload("Doctor").
		Preload("Visit").
		Preload("Visit.RoomQueue").
		Preload("CheckedInBy").
		First(&reg, reg.ID)

	queueNumber := ""
	if roomQueue != nil {
		queueNumber = roomQueue.QueueNumber
	}

	c.JSON(http.StatusOK, gin.H{
		"data":               reg,
		"queue_number":       queueNumber,
		"surat_kontrol":      sk.NoSuratKontrol,
		"requires_admission": !reg.Patient.IsFinal,
		"message":            fmt.Sprintf("Check-in berhasil via QR Surat Kontrol. Nomor antrian: %s", queueNumber),
	})
}
