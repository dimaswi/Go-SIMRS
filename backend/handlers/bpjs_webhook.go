package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	bpjsService "starter/backend/services/bpjs"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ================================================
// BPJS ANTRIAN ONLINE - WEBHOOK ENDPOINTS
// Endpoint yang dipanggil oleh BPJS ke sistem RS
// ================================================

// BPJSWebhookToken stores active tokens for BPJS authentication
var bpjsWebhookTokens = make(map[string]time.Time)
var bpjsWebhookUsernames = make(map[string]string) // token -> username

// Response wrapper untuk BPJS
type BPJSWebhookResponse struct {
	Response interface{} `json:"response,omitempty"`
	Metadata struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"metadata"`
}

func newBPJSResponse(code int, message string, response interface{}) BPJSWebhookResponse {
	resp := BPJSWebhookResponse{}
	resp.Metadata.Code = code
	resp.Metadata.Message = message
	resp.Response = response
	return resp
}

// ================================================
// 1. TOKEN - Generate token untuk BPJS
// GET /bpjs-webhook/token
// ================================================
func BPJSWebhookGetToken(c *gin.Context) {
	// Validate credentials from header
	username := c.GetHeader("x-username")
	password := c.GetHeader("x-password")

	if username == "" || password == "" {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Username atau password tidak boleh kosong", nil))
		return
	}

	// Get configured credentials from database
	var configs []models.IntegrationConfig
	database.DB.Where("integration = ?", models.IntegrationTypeBPJSAntrian).Find(&configs)

	configMap := make(map[string]string)
	for _, cfg := range configs {
		configMap[cfg.Key] = cfg.Value
	}

	// Validate credentials - first try webhook config, then fallback to SIMRS user
	expectedUser := configMap["webhook_username"]
	expectedPass := configMap["webhook_password"]

	authenticated := false

	// Method 1: Check webhook config
	if expectedUser != "" && expectedPass != "" {
		if username == expectedUser && password == expectedPass {
			authenticated = true
		}
	}

	// Method 2: Fallback to SIMRS user authentication
	if !authenticated {
		var user models.User
		if err := database.DB.Where("username = ? AND is_active = ?", username, true).First(&user).Error; err == nil {
			// Verify password using model method
			if user.CheckPassword(password) {
				authenticated = true
			}
		}
	}

	if !authenticated {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Username atau password salah", nil))
		return
	}

	// Generate token
	tokenBytes := make([]byte, 32)
	rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	// Store token with expiry (24 hours) along with username
	bpjsWebhookTokens[token] = time.Now().Add(24 * time.Hour)
	bpjsWebhookUsernames[token] = username

	// Cleanup old tokens
	for t, exp := range bpjsWebhookTokens {
		if time.Now().After(exp) {
			delete(bpjsWebhookTokens, t)
			delete(bpjsWebhookUsernames, t)
		}
	}

	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
		"token": token,
	}))
}

// ValidateBPJSWebhookToken middleware untuk validasi token
func ValidateBPJSWebhookToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("x-token")
		username := c.GetHeader("x-username")

		if token == "" {
			c.JSON(http.StatusOK, newBPJSResponse(201, "Token tidak ditemukan", nil))
			c.Abort()
			return
		}

		// Check token validity
		expiry, exists := bpjsWebhookTokens[token]
		if !exists || time.Now().After(expiry) {
			c.JSON(http.StatusOK, newBPJSResponse(201, "Token tidak valid atau sudah expired", nil))
			c.Abort()
			return
		}

		// Validate username matches the one used to generate token
		storedUsername, hasUsername := bpjsWebhookUsernames[token]
		if hasUsername && storedUsername != username {
			c.JSON(http.StatusOK, newBPJSResponse(201, "Username tidak valid", nil))
			c.Abort()
			return
		}

		c.Next()
	}
}

// ================================================
// 2. STATUS ANTREAN - Status antrean per poli
// POST /bpjs-webhook/antrean/status
// ================================================
type StatusAntreanRequest struct {
	KodePoli       string `json:"kodepoli"`
	KodeDokter     int    `json:"kodedokter"`
	TanggalPeriksa string `json:"tanggalperiksa"`
	JamPraktek     string `json:"jampraktek"`
}

func BPJSWebhookStatusAntrean(c *gin.Context) {
	var req StatusAntreanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid: "+err.Error(), nil))
		return
	}

	// Parse tanggal
	tanggal, err := time.Parse("2006-01-02", req.TanggalPeriksa)
	if err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format tanggal tidak valid", nil))
		return
	}

	// Cari poli mapping
	var poliMapping models.BPJSPoliMapping
	if err := database.DB.Where("kode_poli_bpjs = ? AND is_active = ?", req.KodePoli, true).First(&poliMapping).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Poli tidak ditemukan", nil))
		return
	}

	// Cari dokter mapping
	var dokterMapping models.BPJSDoctorMapping
	if err := database.DB.Where("poli_mapping_id = ? AND kode_dokter_bpjs = ? AND is_active = ?",
		poliMapping.ID, fmt.Sprintf("%d", req.KodeDokter), true).First(&dokterMapping).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Dokter tidak ditemukan di poli ini", nil))
		return
	}

	// Hitung total antrean hari ini
	var totalAntrean int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("kode_poli = ? AND kode_dokter = ? AND DATE(tanggal_periksa) = ? AND status != ?",
			req.KodePoli, fmt.Sprintf("%d", req.KodeDokter), tanggal.Format("2006-01-02"), "batal").
		Count(&totalAntrean)

	// Hitung sisa antrean (yang belum dilayani)
	var sisaAntrean int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("kode_poli = ? AND kode_dokter = ? AND DATE(tanggal_periksa) = ? AND status IN ?",
			req.KodePoli, fmt.Sprintf("%d", req.KodeDokter), tanggal.Format("2006-01-02"),
			[]string{"booking", "checkin", "dipanggil"}).
		Count(&sisaAntrean)

	// Cari antrean yang sedang dipanggil
	var currentQueue models.BPJSQueue
	antreanPanggil := ""
	if err := database.DB.Where("kode_poli = ? AND kode_dokter = ? AND DATE(tanggal_periksa) = ? AND status = ?",
		req.KodePoli, fmt.Sprintf("%d", req.KodeDokter), tanggal.Format("2006-01-02"), "dipanggil").
		First(&currentQueue).Error; err == nil {
		antreanPanggil = currentQueue.NomorAntrean
	}

	// Kuota dari mapping
	kuotaJKN := dokterMapping.KuotaJKN
	kuotaNonJKN := dokterMapping.KuotaNonJKN
	if kuotaJKN == 0 {
		kuotaJKN = 30 // default
	}
	if kuotaNonJKN == 0 {
		kuotaNonJKN = 10 // default
	}

	// Hitung sisa kuota
	var jknCount, nonJknCount int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("kode_poli = ? AND kode_dokter = ? AND DATE(tanggal_periksa) = ? AND jenis_pasien = ? AND status != ?",
			req.KodePoli, fmt.Sprintf("%d", req.KodeDokter), tanggal.Format("2006-01-02"), "JKN", "batal").
		Count(&jknCount)
	database.DB.Model(&models.BPJSQueue{}).
		Where("kode_poli = ? AND kode_dokter = ? AND DATE(tanggal_periksa) = ? AND jenis_pasien = ? AND status != ?",
			req.KodePoli, fmt.Sprintf("%d", req.KodeDokter), tanggal.Format("2006-01-02"), "NON-JKN", "batal").
		Count(&nonJknCount)

	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
		"namapoli":        poliMapping.NamaPoliBPJS,
		"namadokter":      dokterMapping.NamaDokterBPJS,
		"totalantrean":    totalAntrean,
		"sisaantrean":     sisaAntrean,
		"antreanpanggil":  antreanPanggil,
		"sisakuotajkn":    kuotaJKN - int(jknCount),
		"kuotajkn":        kuotaJKN,
		"sisakuotanonjkn": kuotaNonJKN - int(nonJknCount),
		"kuotanonjkn":     kuotaNonJKN,
		"keterangan":      "",
	}))
}

// ================================================
// 3. AMBIL ANTREAN - Pasien ambil nomor antrean
// POST /bpjs-webhook/antrean/ambil
// Sesuai alur MJKN: langsung buat Registration, Visit, dan RoomQueue (reserved)
// ================================================
type AmbilAntreanRequest struct {
	NomorKartu     string `json:"nomorkartu"`
	NIK            string `json:"nik"`
	NoHP           string `json:"nohp"`
	KodePoli       string `json:"kodepoli"`
	NoRM           string `json:"norm"`
	TanggalPeriksa string `json:"tanggalperiksa"`
	KodeDokter     int    `json:"kodedokter"`
	JamPraktek     string `json:"jampraktek"`
	JenisKunjungan int    `json:"jeniskunjungan"` // 1=Rujukan FKTP, 2=Rujukan Internal, 3=Kontrol, 4=Rujukan Antar RS
	NomorReferensi string `json:"nomorreferensi"` // Nomor rujukan/kontrol
}

func BPJSWebhookAmbilAntrean(c *gin.Context) {
	var req AmbilAntreanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid: "+err.Error(), nil))
		return
	}

	// Validasi field wajib dari BPJS
	if req.NomorKartu == "" {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Nomor kartu BPJS wajib diisi", nil))
		return
	}
	if req.NIK == "" {
		c.JSON(http.StatusOK, newBPJSResponse(201, "NIK wajib diisi", nil))
		return
	}
	if req.KodePoli == "" {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Kode poli wajib diisi", nil))
		return
	}
	if req.TanggalPeriksa == "" {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Tanggal periksa wajib diisi", nil))
		return
	}
	if req.KodeDokter == 0 {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Kode dokter wajib diisi", nil))
		return
	}
	if req.JamPraktek == "" {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Jam praktek wajib diisi", nil))
		return
	}

	// Parse tanggal
	tanggal, err := time.Parse("2006-01-02", req.TanggalPeriksa)
	if err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format tanggal tidak valid", nil))
		return
	}

	// Cari poli mapping
	var poliMapping models.BPJSPoliMapping
	if err := database.DB.Preload("Room").Where("kode_poli_bpjs = ? AND is_active = ?", req.KodePoli, true).First(&poliMapping).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Poli tidak ditemukan", nil))
		return
	}

	// Cari dokter mapping
	var dokterMapping models.BPJSDoctorMapping
	if err := database.DB.Where("poli_mapping_id = ? AND kode_dokter_bpjs = ? AND is_active = ?",
		poliMapping.ID, fmt.Sprintf("%d", req.KodeDokter), true).First(&dokterMapping).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Dokter tidak ditemukan di poli ini", nil))
		return
	}

	// Cek duplikat booking
	var existingQueue models.BPJSQueue
	if err := database.DB.Where("no_kartu = ? AND DATE(tanggal_periksa) = ? AND kode_poli = ? AND status != ?",
		req.NomorKartu, tanggal.Format("2006-01-02"), req.KodePoli, "batal").
		First(&existingQueue).Error; err == nil {
		// Sudah ada booking, return data yang ada
		c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
			"nomorantrean":     existingQueue.NomorAntrean,
			"angkaantrean":     existingQueue.AngkaAntrean,
			"kodebooking":      existingQueue.KodeBooking,
			"norm":             existingQueue.NoRM,
			"namapoli":         existingQueue.NamaPoli,
			"namadokter":       existingQueue.NamaDokter,
			"estimasidilayani": existingQueue.EstimasiDilayani,
			"keterangan":       "Anda sudah memiliki booking",
		}))
		return
	}

	// Cari pasien berdasarkan NIK atau nomor kartu BPJS
	var patient models.Patient
	patientFound := false

	// Cari berdasarkan NIK
	if req.NIK != "" {
		if err := database.DB.Where("nik = ?", req.NIK).First(&patient).Error; err == nil {
			patientFound = true
		}
	}

	// Jika tidak ketemu, cari berdasarkan nomor BPJS
	if !patientFound && req.NomorKartu != "" {
		if err := database.DB.Where("no_bpjs = ?", req.NomorKartu).First(&patient).Error; err == nil {
			patientFound = true
		}
	}

	// Jika pasien tidak ditemukan, return code 202 (pasien baru)
	if !patientFound {
		c.JSON(http.StatusOK, newBPJSResponse(202, "Pasien belum terdaftar di sistem RS", nil))
		return
	}

	// Kuota dari mapping
	kuotaJKN := dokterMapping.KuotaJKN
	kuotaNonJKN := dokterMapping.KuotaNonJKN
	if kuotaJKN == 0 {
		kuotaJKN = 30
	}
	if kuotaNonJKN == 0 {
		kuotaNonJKN = 10
	}

	// Cek kuota
	var jknCount int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("kode_poli = ? AND kode_dokter = ? AND DATE(tanggal_periksa) = ? AND jenis_pasien = ? AND status != ?",
			req.KodePoli, fmt.Sprintf("%d", req.KodeDokter), tanggal.Format("2006-01-02"), "JKN", "batal").
		Count(&jknCount)

	if int(jknCount) >= kuotaJKN {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Kuota JKN untuk dokter ini sudah habis", nil))
		return
	}

	// Start transaction untuk create semua data sekaligus
	tx := database.DB.Begin()

	// 1. Generate kode booking
	kodeBooking := generateKodeBooking(tanggal, req.KodePoli)

	// 2. Generate nomor antrean SIMRS (sama dengan on-site)
	room := poliMapping.Room
	if room == nil {
		var roomData models.Room
		if err := tx.First(&roomData, poliMapping.RoomID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusOK, newBPJSResponse(201, "Room tidak ditemukan", nil))
			return
		}
		room = &roomData
	}

	queueCode := room.QueueCode
	if queueCode == "" {
		queueCode = "A"
	}

	// Hitung nomor antrian dari RoomQueue (bukan BPJSQueue) agar sama dengan on-site
	var lastRoomQueue models.RoomQueue
	var queueNum int
	if err := tx.Where("room_id = ? AND queue_date = ?", poliMapping.RoomID, tanggal).
		Order("queue_number DESC").First(&lastRoomQueue).Error; err != nil {
		queueNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastRoomQueue.QueueNumber, queueCode+"%d", &lastNum)
		queueNum = lastNum + 1
	}
	nomorAntrean := fmt.Sprintf("%s%03d", queueCode, queueNum)
	angkaAntrean := queueNum

	// 3. Estimasi dilayani
	jamPraktekParts := strings.Split(req.JamPraktek, "-")
	jamMulai := "08:00"
	if len(jamPraktekParts) > 0 {
		jamMulai = jamPraktekParts[0]
	}
	startTime, _ := time.Parse("15:04", jamMulai)
	estimasiTime := time.Date(tanggal.Year(), tanggal.Month(), tanggal.Day(),
		startTime.Hour(), startTime.Minute(), 0, 0, time.Local)
	estimasiTime = estimasiTime.Add(time.Duration((angkaAntrean-1)*15) * time.Minute)
	estimasiDilayani := estimasiTime.UnixMilli()

	// 4. Buat Registration (status: scheduled untuk MJKN)
	regNumber := generateRegistrationNumberForBPJS(tanggal)
	var visitCount int64
	tx.Model(&models.Registration{}).Where("patient_id = ?", patient.ID).Count(&visitCount)

	// Cari atau buat user sistem BPJS untuk RegisteredByID
	var bpjsUser models.User
	if err := tx.Where("username = ?", "BPJS").First(&bpjsUser).Error; err != nil {
		// Cari atau buat role sistem
		var systemRole models.Role
		if err := tx.Where("name = ?", "System").First(&systemRole).Error; err != nil {
			systemRole = models.Role{
				Name:        "System",
				Description: "Akun sistem otomatis",
			}
			if err := tx.Create(&systemRole).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membuat role sistem: "+err.Error(), nil))
				return
			}
		}

		// Buat user sistem BPJS
		bpjsUser = models.User{
			Username: "BPJS",
			FullName: "Sistem BPJS/MJKN",
			Email:    "bpjs@system.local",
			Password: "-", // Tidak bisa login
			IsActive: false,
			RoleID:   systemRole.ID,
		}
		if err := tx.Create(&bpjsUser).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membuat user sistem BPJS: "+err.Error(), nil))
			return
		}
	}

	registration := models.Registration{
		RegistrationNumber: regNumber,
		RegistrationDate:   tanggal,
		RegistrationType:   "outpatient",
		PatientID:          patient.ID,
		DestinationRoomID:  poliMapping.RoomID,
		DoctorID:           &dokterMapping.EmployeeID,
		PaymentMethod:      "bpjs",
		BPJSNumber:         req.NomorKartu,
		Complaint:          "",
		Status:             models.RegistrationStatusScheduled, // Scheduled untuk MJKN
		Notes:              fmt.Sprintf("Booking MJKN: %s", kodeBooking),
		VisitNumber:        int(visitCount + 1),
		ScheduledDate:      &tanggal,
		RegisteredByID:     bpjsUser.ID,
	}

	if err := tx.Create(&registration).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membuat pendaftaran: "+err.Error(), nil))
		return
	}

	// 5. Buat Visit (status: scheduled untuk MJKN)
	visitNumber := generateVisitNumberForBPJS(tanggal)
	visit := models.Visit{
		VisitNumber:    visitNumber,
		RegistrationID: registration.ID,
		RoomID:         poliMapping.RoomID,
		DoctorID:       &dokterMapping.EmployeeID,
		VisitType:      models.VisitTypeOutpatient,
		VisitPurpose:   "Pemeriksaan via MJKN",
		Status:         models.VisitStatusScheduled, // Scheduled untuk MJKN
		Complaint:      "",
		Notes:          fmt.Sprintf("Booking MJKN: %s", kodeBooking),
	}

	if err := tx.Create(&visit).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membuat kunjungan: "+err.Error(), nil))
		return
	}

	// 6. Buat RoomQueue (status: reserved untuk MJKN - belum aktif di layar)
	roomQueue := models.RoomQueue{
		QueueNumber:       nomorAntrean,
		QueueCode:         queueCode,
		QueueDate:         tanggal,
		VisitID:           visit.ID,
		RoomID:            poliMapping.RoomID,
		Priority:          models.RoomQueuePriorityNormal,
		Status:            models.RoomQueueStatusReserved, // Reserved untuk MJKN
		EstimatedWaitTime: (angkaAntrean - 1) * 15,
		Notes:             fmt.Sprintf("MJKN Booking: %s", kodeBooking),
	}

	if err := tx.Create(&roomQueue).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membuat antrian: "+err.Error(), nil))
		return
	}

	// 7. Buat BPJSQueue dan link ke Registration, Visit, RoomQueue
	bpjsQueue := models.BPJSQueue{
		KodeBooking:      kodeBooking,
		NomorAntrean:     nomorAntrean,
		AngkaAntrean:     angkaAntrean,
		TanggalPeriksa:   tanggal,
		JamPraktek:       req.JamPraktek,
		KodePoli:         req.KodePoli,
		NamaPoli:         poliMapping.NamaPoliBPJS,
		KodeDokter:       fmt.Sprintf("%d", req.KodeDokter),
		NamaDokter:       dokterMapping.NamaDokterBPJS,
		JenisPasien:      "JKN",
		NoKartu:          req.NomorKartu,
		NIK:              req.NIK,
		NoHP:             req.NoHP,
		NoRM:             patient.NoRM,
		NamaPasien:       patient.NamaLengkap,
		JenisKunjungan:   req.JenisKunjungan,
		NomorReferensi:   req.NomorReferensi,
		EstimasiDilayani: estimasiDilayani,
		Status:           "booking",
		PatientID:        &patient.ID,
		PoliMappingID:    &poliMapping.ID,
		DoctorMappingID:  &dokterMapping.ID,
		RoomID:           &poliMapping.RoomID,
		RegistrationID:   &registration.ID,
		VisitID:          &visit.ID,
		RoomQueueID:      &roomQueue.ID,
	}

	if err := tx.Create(&bpjsQueue).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal menyimpan antrean BPJS: "+err.Error(), nil))
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal commit transaksi: "+err.Error(), nil))
		return
	}

	// Hitung sisa kuota
	var nonJknCount int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("kode_poli = ? AND kode_dokter = ? AND DATE(tanggal_periksa) = ? AND jenis_pasien = ? AND status != ?",
			req.KodePoli, fmt.Sprintf("%d", req.KodeDokter), tanggal.Format("2006-01-02"), "NON-JKN", "batal").
		Count(&nonJknCount)

	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
		"nomorantrean":     nomorAntrean,
		"angkaantrean":     angkaAntrean,
		"kodebooking":      kodeBooking,
		"norm":             patient.NoRM,
		"namapoli":         poliMapping.NamaPoliBPJS,
		"namadokter":       dokterMapping.NamaDokterBPJS,
		"estimasidilayani": estimasiDilayani,
		"sisakuotajkn":     kuotaJKN - int(jknCount) - 1,
		"kuotajkn":         kuotaJKN,
		"sisakuotanonjkn":  kuotaNonJKN - int(nonJknCount),
		"kuotanonjkn":      kuotaNonJKN,
		"keterangan":       "Peserta harap datang ke loket pendaftaran untuk check-in",
	}))
}

// ================================================
// 4. SISA ANTREAN - Cek sisa antrean
// POST /bpjs-webhook/antrean/sisa
// ================================================
type SisaAntreanRequest struct {
	KodeBooking string `json:"kodebooking"`
}

func BPJSWebhookSisaAntrean(c *gin.Context) {
	var req SisaAntreanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid", nil))
		return
	}

	// Cari antrean berdasarkan kode booking
	var queue models.BPJSQueue
	if err := database.DB.Where("kode_booking = ?", req.KodeBooking).First(&queue).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Kode booking tidak ditemukan", nil))
		return
	}

	// Hitung sisa antrean
	var sisaAntrean int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("kode_poli = ? AND DATE(tanggal_periksa) = ? AND angka_antrean < ? AND status IN ?",
			queue.KodePoli, queue.TanggalPeriksa.Format("2006-01-02"), queue.AngkaAntrean,
			[]string{"checkin", "dipanggil"}).
		Count(&sisaAntrean)

	// Cari antrean yang sedang dipanggil
	var currentQueue models.BPJSQueue
	antreanPanggil := ""
	if err := database.DB.Where("kode_poli = ? AND DATE(tanggal_periksa) = ? AND status = ?",
		queue.KodePoli, queue.TanggalPeriksa.Format("2006-01-02"), "dipanggil").
		First(&currentQueue).Error; err == nil {
		antreanPanggil = currentQueue.NomorAntrean
	}

	// Waktu tunggu dalam detik (15 menit per pasien)
	waktuTunggu := int(sisaAntrean) * 15 * 60

	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
		"nomorantrean":   queue.NomorAntrean,
		"namapoli":       queue.NamaPoli,
		"namadokter":     queue.NamaDokter,
		"sisaantrean":    sisaAntrean,
		"antreanpanggil": antreanPanggil,
		"waktutunggu":    waktuTunggu,
		"keterangan":     "",
	}))
}

// ================================================
// 5. BATAL ANTREAN - Batalkan antrean
// POST /bpjs-webhook/antrean/batal
// Sesuai alur MJKN: Batalkan juga Registration, Visit, dan RoomQueue
// ================================================
type BatalAntreanRequest struct {
	KodeBooking string `json:"kodebooking"`
	Keterangan  string `json:"keterangan"`
}

func BPJSWebhookBatalAntrean(c *gin.Context) {
	var req BatalAntreanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid", nil))
		return
	}

	// Cari antrean berdasarkan kode booking
	var queue models.BPJSQueue
	if err := database.DB.Where("kode_booking = ?", req.KodeBooking).First(&queue).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Kode booking tidak ditemukan", nil))
		return
	}

	// Validasi status - tidak bisa batal jika sudah checkin atau selesai
	if queue.Status == "checkin" || queue.Status == "dipanggil" || queue.Status == "dilayani" || queue.Status == "selesai" {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Antrean tidak dapat dibatalkan karena pasien sudah hadir", nil))
		return
	}

	now := time.Now()

	// Start transaction
	tx := database.DB.Begin()

	// 1. Update BPJSQueue status
	queue.Status = "batal"
	queue.Keterangan = req.Keterangan
	queue.WaktuBatal = &now

	if err := tx.Save(&queue).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membatalkan antrean", nil))
		return
	}

	// 2. Update Registration status ke cancelled
	if queue.RegistrationID != nil {
		if err := tx.Model(&models.Registration{}).Where("id = ?", *queue.RegistrationID).
			Updates(map[string]interface{}{
				"status":     models.RegistrationStatusCancelled,
				"notes":      fmt.Sprintf("Dibatalkan via MJKN: %s", req.Keterangan),
				"updated_at": now,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membatalkan pendaftaran", nil))
			return
		}
	}

	// 3. Update Visit status ke cancelled
	if queue.VisitID != nil {
		if err := tx.Model(&models.Visit{}).Where("id = ?", *queue.VisitID).
			Updates(map[string]interface{}{
				"status":     models.VisitStatusCancelled,
				"notes":      fmt.Sprintf("Dibatalkan via MJKN: %s", req.Keterangan),
				"updated_at": now,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membatalkan kunjungan", nil))
			return
		}
	}

	// 4. Update RoomQueue status ke cancelled
	if queue.RoomQueueID != nil {
		if err := tx.Model(&models.RoomQueue{}).Where("id = ?", *queue.RoomQueueID).
			Updates(map[string]interface{}{
				"status":     models.RoomQueueStatusCancelled,
				"notes":      fmt.Sprintf("Dibatalkan via MJKN: %s", req.Keterangan),
				"updated_at": now,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membatalkan antrian", nil))
			return
		}
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal commit transaksi: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", nil))
}

// ================================================
// 6. CHECK-IN - Konfirmasi kehadiran pasien
// POST /bpjs-webhook/antrean/checkin
// Sesuai alur MJKN: Aktivasi Registration, Visit, RoomQueue dan trigger Task 3
// ================================================
type CheckInRequest struct {
	KodeBooking string `json:"kodebooking"`
	Waktu       int64  `json:"waktu"` // Milliseconds
}

func BPJSWebhookCheckIn(c *gin.Context) {
	var req CheckInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid", nil))
		return
	}

	// Cari antrean berdasarkan kode booking dengan relasi
	var queue models.BPJSQueue
	if err := database.DB.Where("kode_booking = ?", req.KodeBooking).First(&queue).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Kode booking tidak ditemukan", nil))
		return
	}

	// Validasi status
	if queue.Status == "batal" {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Antrean sudah dibatalkan", nil))
		return
	}
	if queue.Status == "selesai" {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Antrean sudah selesai dilayani", nil))
		return
	}
	if queue.Status == "checkin" {
		c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", nil))
		return
	}

	waktuCheckin := time.UnixMilli(req.Waktu)
	if req.Waktu == 0 {
		waktuCheckin = time.Now()
	}

	// Start transaction
	tx := database.DB.Begin()

	// 1. Update BPJSQueue status
	queue.Status = "checkin"
	queue.WaktuCheckin = &waktuCheckin
	queue.Task3At = &waktuCheckin // Task 3: Tunggu di poli

	if err := tx.Save(&queue).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal update status checkin", nil))
		return
	}

	// 2. Update Registration status dari scheduled ke in_queue
	if queue.RegistrationID != nil {
		if err := tx.Model(&models.Registration{}).Where("id = ?", *queue.RegistrationID).
			Updates(map[string]interface{}{
				"status":     models.RegistrationStatusInQueue,
				"updated_at": waktuCheckin,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal update status pendaftaran", nil))
			return
		}
	}

	// 3. Update Visit status dari scheduled ke in_queue
	if queue.VisitID != nil {
		if err := tx.Model(&models.Visit{}).Where("id = ?", *queue.VisitID).
			Updates(map[string]interface{}{
				"status":     models.VisitStatusInQueue,
				"updated_at": waktuCheckin,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal update status kunjungan", nil))
			return
		}
	}

	// 4. Update RoomQueue status dari reserved ke waiting (aktivasi di layar antrian)
	if queue.RoomQueueID != nil {
		if err := tx.Model(&models.RoomQueue{}).Where("id = ?", *queue.RoomQueueID).
			Updates(map[string]interface{}{
				"status":      models.RoomQueueStatusWaiting,
				"called_time": nil, // Belum dipanggil
				"updated_at":  waktuCheckin,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal update status antrian", nil))
			return
		}
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal commit transaksi: "+err.Error(), nil))
		return
	}

	// 5. Trigger Task 3 ke BPJS secara async
	// Task 3: Menunggu di Poli
	go func() {
		bpjsService.UpdateTaskAsync(queue.KodeBooking, 3, waktuCheckin, nil)
	}()

	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", nil))
}

// ================================================
// 7. INFO PASIEN BARU - Data pasien baru
// POST /bpjs-webhook/antrean/pasien-baru
// ================================================
type PasienBaruRequest struct {
	NomorKartu   string `json:"nomorkartu"`
	NIK          string `json:"nik"`
	NomorKK      string `json:"nomorkk"`
	Nama         string `json:"nama"`
	JenisKelamin string `json:"jeniskelamin"` // L/P
	TanggalLahir string `json:"tanggallahir"`
	NoHP         string `json:"nohp"`
	Alamat       string `json:"alamat"`
	KodeProp     string `json:"kodeprop"`
	NamaProp     string `json:"namaprop"`
	KodeDati2    string `json:"kodedati2"`
	NamaDati2    string `json:"namadati2"`
	KodeKec      string `json:"kodekec"`
	NamaKec      string `json:"namakec"`
	KodeKel      string `json:"kodekel"`
	NamaKel      string `json:"namakel"`
	RW           string `json:"rw"`
	RT           string `json:"rt"`
}

func BPJSWebhookPasienBaru(c *gin.Context) {
	var req PasienBaruRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid", nil))
		return
	}

	// Cek apakah pasien sudah ada berdasarkan NIK
	var existingPatient models.Patient
	if err := database.DB.Where("nik = ?", req.NIK).First(&existingPatient).Error; err == nil {
		// Pasien sudah ada, return no RM yang ada
		c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
			"norm": existingPatient.NoRM,
		}))
		return
	}

	// Parse tanggal lahir
	tglLahir, err := time.Parse("2006-01-02", req.TanggalLahir)
	var tanggalLahirPtr *models.DateOnly
	if err == nil {
		dateOnly := models.DateOnly{Time: tglLahir}
		tanggalLahirPtr = &dateOnly
	}

	// Generate No RM baru
	noRM := generateNoRM()

	// Convert jenis kelamin to Gender type
	var jenisKelamin models.Gender
	if req.JenisKelamin == "P" {
		jenisKelamin = models.GenderFemale
	} else {
		jenisKelamin = models.GenderMale
	}

	// Build full address
	alamatLengkap := req.Alamat
	if req.RT != "" {
		alamatLengkap += " RT " + req.RT
	}
	if req.RW != "" {
		alamatLengkap += " RW " + req.RW
	}

	// Buat pasien baru dengan field yang ada di Patient model
	patient := models.Patient{
		NoRM:         noRM,
		NIK:          req.NIK,
		NoBPJS:       req.NomorKartu,
		NamaLengkap:  req.Nama,
		JenisKelamin: jenisKelamin,
		TanggalLahir: tanggalLahirPtr,
		NoHP:         req.NoHP,
		AlamatKTP:    alamatLengkap,
		RTKTP:        req.RT,
		RWKTP:        req.RW,
		KelurahanKTP: req.NamaKel,
		KecamatanKTP: req.NamaKec,
		KotaKTP:      req.NamaDati2,
		ProvinsiKTP:  req.NamaProp,
		JenisJaminan: models.InsuranceTypeBPJS,
		Status:       models.PatientStatusActive,
	}

	if err := database.DB.Create(&patient).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal membuat pasien baru: "+err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, newBPJSResponse(200, "Harap datang ke admisi untuk melengkapi data rekam medis", gin.H{
		"norm": noRM,
	}))
}

// ================================================
// 8. JADWAL OPERASI RS
// POST /bpjs-webhook/operasi/rs
// ================================================
type JadwalOperasiRSRequest struct {
	TanggalAwal  string `json:"tanggalawal"`
	TanggalAkhir string `json:"tanggalakhir"`
}

func BPJSWebhookJadwalOperasiRS(c *gin.Context) {
	var req JadwalOperasiRSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid", nil))
		return
	}

	// TODO: Implement jadwal operasi dari data SIMRS
	// Untuk saat ini return list kosong
	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
		"list": []interface{}{},
	}))
}

// ================================================
// 9. JADWAL OPERASI PASIEN
// POST /bpjs-webhook/operasi/pasien
// ================================================
type JadwalOperasiPasienRequest struct {
	NoPeserta string `json:"nopeserta"`
}

func BPJSWebhookJadwalOperasiPasien(c *gin.Context) {
	var req JadwalOperasiPasienRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid", nil))
		return
	}

	// TODO: Implement jadwal operasi pasien dari data SIMRS
	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
		"list": []interface{}{},
	}))
}

// ================================================
// 10. AMBIL ANTREAN FARMASI
// POST /bpjs-webhook/farmasi/antrean
// ================================================
type AntreanFarmasiRequest struct {
	KodeBooking string `json:"kodebooking"`
}

func BPJSWebhookAmbilAntreanFarmasi(c *gin.Context) {
	var req AntreanFarmasiRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid", nil))
		return
	}

	// Cari antrean poliklinik berdasarkan kode booking
	var queue models.BPJSQueue
	if err := database.DB.Where("kode_booking = ?", req.KodeBooking).First(&queue).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Kode booking tidak ditemukan", nil))
		return
	}

	// Generate nomor antrean farmasi
	var lastFarmasiQueue int
	database.DB.Model(&models.BPJSQueue{}).
		Where("DATE(tanggal_periksa) = ? AND nomor_antrean_farmasi > 0", queue.TanggalPeriksa.Format("2006-01-02")).
		Select("COALESCE(MAX(nomor_antrean_farmasi), 0)").
		Scan(&lastFarmasiQueue)

	nomorAntreanFarmasi := lastFarmasiQueue + 1
	queue.NomorAntreanFarmasi = nomorAntreanFarmasi

	// Determine jenis resep (placeholder - should come from prescription data)
	jenisResep := "Non Racikan"

	if err := database.DB.Save(&queue).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Gagal mengambil antrean farmasi", nil))
		return
	}

	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
		"jenisresep":   jenisResep,
		"nomorantrean": nomorAntreanFarmasi,
		"keterangan":   "",
	}))
}

// ================================================
// 11. STATUS ANTREAN FARMASI
// POST /bpjs-webhook/farmasi/status
// ================================================
func BPJSWebhookStatusAntreanFarmasi(c *gin.Context) {
	var req AntreanFarmasiRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Format request tidak valid", nil))
		return
	}

	// Cari antrean berdasarkan kode booking
	var queue models.BPJSQueue
	if err := database.DB.Where("kode_booking = ?", req.KodeBooking).First(&queue).Error; err != nil {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Kode booking tidak ditemukan", nil))
		return
	}

	if queue.NomorAntreanFarmasi == 0 {
		c.JSON(http.StatusOK, newBPJSResponse(201, "Pasien belum mengambil antrean farmasi", nil))
		return
	}

	// Hitung total dan sisa antrean farmasi
	var totalAntrean, sisaAntrean int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("DATE(tanggal_periksa) = ? AND nomor_antrean_farmasi > 0", queue.TanggalPeriksa.Format("2006-01-02")).
		Count(&totalAntrean)

	database.DB.Model(&models.BPJSQueue{}).
		Where("DATE(tanggal_periksa) = ? AND nomor_antrean_farmasi > 0 AND nomor_antrean_farmasi < ? AND status_farmasi != ?",
			queue.TanggalPeriksa.Format("2006-01-02"), queue.NomorAntreanFarmasi, "selesai").
		Count(&sisaAntrean)

	// Cari antrean yang sedang dipanggil
	var currentQueue models.BPJSQueue
	antreanPanggil := 0
	if err := database.DB.Where("DATE(tanggal_periksa) = ? AND status_farmasi = ?",
		queue.TanggalPeriksa.Format("2006-01-02"), "dipanggil").
		Order("nomor_antrean_farmasi ASC").First(&currentQueue).Error; err == nil {
		antreanPanggil = currentQueue.NomorAntreanFarmasi
	}

	c.JSON(http.StatusOK, newBPJSResponse(200, "Ok", gin.H{
		"jenisresep":     "Non Racikan",
		"totalantrean":   totalAntrean,
		"sisaantrean":    sisaAntrean,
		"antreanpanggil": antreanPanggil,
		"keterangan":     "",
	}))
}

// ================================================
// HELPER FUNCTIONS
// ================================================

func generateKodeBooking(tanggal time.Time, kodePoli string) string {
	// Format: DDMMYYYYPPP001
	dateStr := tanggal.Format("02012006")

	// Cari nomor urut terakhir hari ini
	var count int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("DATE(tanggal_periksa) = ?", tanggal.Format("2006-01-02")).
		Count(&count)

	return fmt.Sprintf("%s%s%03d", dateStr, kodePoli, count+1)
}

func generateRegistrationNumberForBPJS(tanggal time.Time) string {
	// Format: REG{YYMMDD}{seq}
	dateStr := tanggal.Format("060102")

	var count int64
	database.DB.Model(&models.Registration{}).
		Where("DATE(registration_date) = ?", tanggal.Format("2006-01-02")).
		Count(&count)

	return fmt.Sprintf("REG%s%04d", dateStr, count+1)
}

func generateVisitNumberForBPJS(tanggal time.Time) string {
	// Format: VIS{YYMMDD}{seq}
	dateStr := tanggal.Format("060102")

	var count int64
	database.DB.Model(&models.Visit{}).
		Where("DATE(created_at) = ?", tanggal.Format("2006-01-02")).
		Count(&count)

	return fmt.Sprintf("VIS%s%04d", dateStr, count+1)
}

func generateNoRM() string {
	// Format: YYMMDD + 4 digit sequence
	now := time.Now()
	dateStr := now.Format("060102")

	// Cari nomor urut terakhir hari ini
	var count int64
	database.DB.Model(&models.Patient{}).
		Where("DATE(created_at) = ?", now.Format("2006-01-02")).
		Count(&count)

	return fmt.Sprintf("%s%04d", dateStr, count+1)
}
