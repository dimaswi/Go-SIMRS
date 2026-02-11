package bpjs

import (
	"encoding/json"
	"fmt"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
	"time"
)

// AddAntreanRequest represents the request body for adding queue to BPJS
type AddAntreanRequest struct {
	KodeBooking      string `json:"kodebooking"`
	JenisPasien      string `json:"jenispasien"` // JKN / NON JKN
	NomorKartu       string `json:"nomorkartu"`  // Nomor kartu BPJS, kosong jika NON JKN
	NIK              string `json:"nik"`
	NoHP             string `json:"nohp"`
	KodePoli         string `json:"kodepoli"` // Kode subspesialis BPJS
	NamaPoli         string `json:"namapoli"`
	PasienBaru       int    `json:"pasienbaru"` // 1 = Ya, 0 = Tidak
	NoRM             string `json:"norm"`
	TanggalPeriksa   string `json:"tanggalperiksa"` // Format: 2021-08-07
	KodeDokter       int    `json:"kodedokter"`
	NamaDokter       string `json:"namadokter"`
	JamPraktek       string `json:"jampraktek"`     // Format: 08:00-12:00
	JenisKunjungan   int    `json:"jeniskunjungan"` // 1=Rujukan FKTP, 2=Rujukan Internal, 3=Kontrol, 4=Rujukan Antar RS
	NomorReferensi   string `json:"nomorreferensi"` // No rujukan/kontrol, kosong jika NON JKN
	NomorAntrean     string `json:"nomorantrean"`
	AngkaAntrean     int    `json:"angkaantrean"`
	EstimasiDilayani int64  `json:"estimasidilayani"` // Milliseconds
	SisaKuotaJKN     int    `json:"sisakuotajkn"`
	KuotaJKN         int    `json:"kuotajkn"`
	SisaKuotaNonJKN  int    `json:"sisakuotanonjkn"`
	KuotaNonJKN      int    `json:"kuotanonjkn"`
	Keterangan       string `json:"keterangan"`
}

// AddAntrean registers a queue to BPJS Antrian Online
// This must be called before any task updates
// Returns: success bool, code int, message string
// PENTING: Fungsi ini TIDAK menyimpan ke database, caller harus save sendiri
// untuk menghindari deadlock jika dipanggil dalam transaction
func AddAntrean(queue *models.BPJSQueue) (bool, int, string) {
	client, err := NewClient()
	if err != nil {
		return false, 0, "Gagal inisialisasi BPJS client: " + err.Error()
	}

	// PRIORITAS: Gunakan dokter dari Surat Kontrol karena kode dokter di sana valid di BPJS
	kodeDokter := 0
	namaDokter := ""

	// 1. Coba ambil dari Surat Kontrol terlebih dahulu (sumber paling akurat)
	var noSuratKontrolForLookup string
	if queue.RegistrationID != nil {
		// Cari registration untuk mendapatkan source_visit_id
		var reg models.Registration
		if err := database.DB.First(&reg, *queue.RegistrationID).Error; err == nil && reg.SourceVisitID != nil {
			var sk models.SuratKontrol
			if err := database.DB.Where("visit_id = ? AND status = ?", *reg.SourceVisitID, "active").First(&sk).Error; err == nil {
				noSuratKontrolForLookup = sk.NoSuratKontrol
				if sk.KodeDokter != "" {
					fmt.Sscanf(sk.KodeDokter, "%d", &kodeDokter)
					namaDokter = sk.NamaDokter
					fmt.Printf("[BPJS AddAntrean] Dokter dari Surat Kontrol: %d - %s\n", kodeDokter, namaDokter)
				}

				// Jika namaDokter kosong di DB tapi kodeDokter ada → fetch dari VClaim Detail
				if namaDokter == "" && kodeDokter > 0 && sk.NoSuratKontrol != "" {
					fmt.Printf("[BPJS AddAntrean] NamaDokter kosong di DB, fetch VClaim Detail SK: %s\n", sk.NoSuratKontrol)
					vclaimClient, vErr := NewVClaimClient()
					if vErr == nil {
						detail, dErr := vclaimClient.GetSuratKontrolDetail(sk.NoSuratKontrol)
						if dErr == nil && detail != nil && detail.NamaDokter != "" {
							namaDokter = detail.NamaDokter
							fmt.Printf("[BPJS AddAntrean] NamaDokter resolved dari VClaim: %s\n", namaDokter)
							// Update DB surat_kontrol supaya tidak kosong lagi
							database.DB.Model(&sk).Update("nama_dokter", namaDokter)
						}
					}
				}
			}
		}
	}

	// 2. Fallback kodeDokter ke data dari BPJSQueue
	if kodeDokter == 0 {
		fmt.Sscanf(queue.KodeDokter, "%d", &kodeDokter)
		namaDokter = queue.NamaDokter
		fmt.Printf("[BPJS AddAntrean] Fallback kodeDokter ke BPJSQueue: %d - %s\n", kodeDokter, namaDokter)
	}

	// 3. Fallback namaDokter — jika kodeDokter ada tapi namaDokter masih kosong
	if kodeDokter != 0 && namaDokter == "" {
		// Coba dari BPJSQueue
		if queue.NamaDokter != "" {
			namaDokter = queue.NamaDokter
			fmt.Printf("[BPJS AddAntrean] Fallback namaDokter dari BPJSQueue: %s\n", namaDokter)
		}
		// Coba dari DoctorMapping
		if namaDokter == "" && queue.DoctorMappingID != nil {
			var dm models.BPJSDoctorMapping
			if err := database.DB.First(&dm, *queue.DoctorMappingID).Error; err == nil {
				namaDokter = dm.NamaDokterBPJS
				fmt.Printf("[BPJS AddAntrean] Fallback namaDokter dari DoctorMapping: %s\n", namaDokter)
			}
		}
		// Coba dari VClaim Detail Surat Kontrol (jika ada nomor SK)
		if namaDokter == "" {
			refNo := noSuratKontrolForLookup
			if refNo == "" {
				refNo = queue.NomorReferensi
			}
			if refNo != "" {
				fmt.Printf("[BPJS AddAntrean] Fallback namaDokter dari VClaim Detail SK: %s\n", refNo)
				vclaimClient, vErr := NewVClaimClient()
				if vErr == nil {
					detail, dErr := vclaimClient.GetSuratKontrolDetail(refNo)
					if dErr == nil && detail != nil && detail.NamaDokter != "" {
						namaDokter = detail.NamaDokter
						fmt.Printf("[BPJS AddAntrean] NamaDokter resolved (VClaim fallback): %s\n", namaDokter)
					}
				}
			}
		}
		// Coba dari employee (nama lengkap dokter)
		if namaDokter == "" {
			var reg models.Registration
			if queue.RegistrationID != nil {
				if err := database.DB.First(&reg, *queue.RegistrationID).Error; err == nil && reg.DoctorID != nil {
					var emp models.Employee
					if err := database.DB.First(&emp, *reg.DoctorID).Error; err == nil {
						namaDokter = emp.NamaLengkap
						fmt.Printf("[BPJS AddAntrean] Fallback namaDokter dari Employee: %s\n", namaDokter)
					}
				}
			}
		}
		if namaDokter == "" {
			fmt.Printf("[BPJS AddAntrean] WARNING: namaDokter masih kosong untuk kodeDokter=%d\n", kodeDokter)
		}
	}

	// Determine jenis pasien
	jenisPasien := "JKN"
	if queue.JenisPasien == "NON JKN" || queue.JenisPasien == "UMUM" {
		jenisPasien = "NON JKN"
	}

	// Determine pasien baru (0 = lama, 1 = baru)
	pasienBaru := 0
	if queue.JenisKunjungan == 1 || queue.JenisKunjungan == 4 { // Rujukan FKTP atau Rujukan Antar RS
		pasienBaru = 1
	}

	// Compute kuota from BPJSDoctorMapping dynamically
	kuotaJKN := 30
	kuotaNonJKN := 10
	var dokterMapping models.BPJSDoctorMapping
	if queue.DoctorMappingID != nil {
		if err := database.DB.First(&dokterMapping, *queue.DoctorMappingID).Error; err == nil {
			if dokterMapping.KuotaJKN > 0 {
				kuotaJKN = dokterMapping.KuotaJKN
			}
			if dokterMapping.KuotaNonJKN > 0 {
				kuotaNonJKN = dokterMapping.KuotaNonJKN
			}
		}
	}

	// Hitung sisa kuota aktual
	var jknCount, nonJknCount int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("kode_poli = ? AND kode_dokter = ? AND DATE(tanggal_periksa) = ? AND jenis_pasien = ? AND status != ?",
			queue.KodePoli, queue.KodeDokter, queue.TanggalPeriksa.Format("2006-01-02"), "JKN", "batal").
		Count(&jknCount)
	database.DB.Model(&models.BPJSQueue{}).
		Where("kode_poli = ? AND kode_dokter = ? AND DATE(tanggal_periksa) = ? AND jenis_pasien = ? AND status != ?",
			queue.KodePoli, queue.KodeDokter, queue.TanggalPeriksa.Format("2006-01-02"), "NON JKN", "batal").
		Count(&nonJknCount)

	sisaKuotaJKN := kuotaJKN - int(jknCount)
	if sisaKuotaJKN < 0 {
		sisaKuotaJKN = 0
	}
	sisaKuotaNonJKN := kuotaNonJKN - int(nonJknCount)
	if sisaKuotaNonJKN < 0 {
		sisaKuotaNonJKN = 0
	}

	// Handle NoHP kosong - berikan default
	noHP := queue.NoHP
	if noHP == "" {
		noHP = "000000000000"
	}

	// Build request
	reqBody := AddAntreanRequest{
		KodeBooking:      queue.KodeBooking,
		JenisPasien:      jenisPasien,
		NomorKartu:       queue.NoKartu,
		NIK:              queue.NIK,
		NoHP:             noHP,
		KodePoli:         queue.KodePoli,
		NamaPoli:         queue.NamaPoli,
		PasienBaru:       pasienBaru,
		NoRM:             queue.NoRM,
		TanggalPeriksa:   queue.TanggalPeriksa.Format("2006-01-02"),
		KodeDokter:       kodeDokter,
		NamaDokter:       namaDokter,
		JamPraktek:       queue.JamPraktek,
		JenisKunjungan:   queue.JenisKunjungan,
		NomorReferensi:   queue.NomorReferensi,
		NomorAntrean:     queue.NomorAntrean,
		AngkaAntrean:     queue.AngkaAntrean,
		EstimasiDilayani: queue.EstimasiDilayani,
		SisaKuotaJKN:     sisaKuotaJKN,
		KuotaJKN:         kuotaJKN,
		SisaKuotaNonJKN:  sisaKuotaNonJKN,
		KuotaNonJKN:      kuotaNonJKN,
		Keterangan:       queue.Keterangan,
	}

	// Debug log (masking sensitive data)
	fmt.Printf("[BPJS AddAntrean] Sending request for kode_booking=%s, kodepoli=%s, kodedokter=%d\n", reqBody.KodeBooking, reqBody.KodePoli, reqBody.KodeDokter)

	// Mark as sent (update struct only, tidak save ke DB)
	queue.AddAntreanSent = true
	now := time.Now()
	queue.LastSyncAt = &now

	// Make request to BPJS
	// client.Request sudah log ke integration_sync_logs dengan full request body
	endpoint := "/antrean/add"
	response, _, err := client.Request("POST", endpoint, reqBody)
	if err != nil {
		// Extract code from error if possible
		errStr := err.Error()
		code := 0
		msg := errStr
		if idx := extractBPJSErrorCode(errStr); idx > 0 {
			code = idx
			msg = extractBPJSErrorMessage(errStr)
		}

		// Code 208 = duplikasi kode booking = antrean sudah terdaftar, treat as success
		if code == 208 {
			queue.AddAntreanCode = 200 // Normalize to 200
			queue.AddAntreanMsg = msg
			queue.SyncStatus = "synced"
			queue.SyncError = ""
			fmt.Printf("[BPJS AddAntrean] Treated 208 as success for kode_booking: %s\n", queue.KodeBooking)
			return true, 200, msg
		}

		// Update queue struct with error (tidak save ke DB, biar caller yang save)
		queue.AddAntreanCode = code
		queue.AddAntreanMsg = msg
		queue.SyncStatus = "failed"
		queue.SyncError = msg

		return false, code, msg
	}

	// Parse response - client.Request already validates metadata.code=200
	// Response body for add is usually null, but try to parse if present
	_ = response // Response body not needed for success case

	// Update queue struct with success
	queue.AddAntreanCode = 200
	queue.AddAntreanMsg = "Berhasil"
	queue.SyncStatus = "synced"
	queue.SyncError = ""

	fmt.Printf("[BPJS AddAntrean] Success for kode_booking: %s\n", queue.KodeBooking)

	return true, 200, "Berhasil"
}

// Helper to extract BPJS error code from error string
func extractBPJSErrorCode(errStr string) int {
	if idx := strings.Index(errStr, "BPJS error ["); idx >= 0 {
		var code int
		fmt.Sscanf(errStr[idx:], "BPJS error [%d]", &code)
		return code
	}
	return 0
}

// Helper to extract BPJS error message
func extractBPJSErrorMessage(errStr string) string {
	if idx := strings.Index(errStr, "]: "); idx >= 0 {
		return errStr[idx+3:]
	}
	return errStr
}

// AddAntreanAsync adds queue to BPJS asynchronously
func AddAntreanAsync(queue *models.BPJSQueue) {
	go func() {
		success, code, msg := AddAntrean(queue)
		if !success {
			fmt.Printf("[BPJS AddAntrean Error] %s: code=%d, msg=%s\n", queue.KodeBooking, code, msg)
		}
	}()
}

// BatalAntreanRequest represents the request body for cancelling queue at BPJS
type BatalAntreanRequest struct {
	KodeBooking string `json:"kodebooking"`
	Keterangan  string `json:"keterangan"`
}

// BatalAntrean sends cancellation to BPJS Antrian Online
// POST /antrean/batal
// Returns: success bool, code int, message string
// Note: client.Request already validates metadata.code and returns error for non-200
func BatalAntrean(kodeBooking string, keterangan string) (bool, int, string) {
	client, err := NewClient()
	if err != nil {
		return false, 0, "Gagal inisialisasi BPJS client: " + err.Error()
	}

	reqBody := BatalAntreanRequest{
		KodeBooking: kodeBooking,
		Keterangan:  keterangan,
	}

	fmt.Printf("[BPJS BatalAntrean] Request: kodebooking=%s, keterangan=%s\n", kodeBooking, keterangan)

	endpoint := "/antrean/batal"
	_, _, err = client.Request("POST", endpoint, reqBody)
	if err != nil {
		errStr := err.Error()
		if idx := extractBPJSErrorCode(errStr); idx > 0 {
			return false, idx, extractBPJSErrorMessage(errStr)
		}
		return false, 0, errStr
	}

	// client.Request returns nil error only when metadata.code == 200
	// Response body for batal is null, no need to parse
	fmt.Printf("[BPJS BatalAntrean] Success for kode_booking: %s\n", kodeBooking)
	return true, 200, "Berhasil"
}

// PendaftaranAntreanItem represents a single antrean item from BPJS
type PendaftaranAntreanItem struct {
	KodeBooking      string          `json:"kodebooking"`
	Tanggal          string          `json:"tanggal"`
	KodePoli         string          `json:"kodepoli"`
	KodeDokter       int             `json:"kodedokter"`
	JamPraktek       string          `json:"jampraktek"`
	NIK              string          `json:"nik"`
	NoKAPST          string          `json:"nokapst"`
	NoHP             string          `json:"nohp"`
	NoRekamMedis     string          `json:"norekammedis"`
	JenisKunjungan   int             `json:"jeniskunjungan"`
	NomorReferensi   string          `json:"nomorreferensi"`
	SumberData       string          `json:"sumberdata"`
	IsPeserta        json.RawMessage `json:"ispeserta"`
	NoAntrean        string          `json:"noantrean"`
	EstimasiDilayani int64           `json:"estimasidilayani"`
	CreatedTime      int64           `json:"createdtime"`
	Status           string          `json:"status"`
}

// GetPendaftaranAntrean fetches registered queue list from BPJS by date
// GET /antrean/pendaftaran/tanggal/{tanggal}
// Note: client.Request already handles metadata check + decryption, returns raw response content
func GetPendaftaranAntrean(tanggal string) ([]PendaftaranAntreanItem, error) {
	client, err := NewClient()
	if err != nil {
		return nil, fmt.Errorf("gagal inisialisasi BPJS client: %w", err)
	}

	endpoint := fmt.Sprintf("/antrean/pendaftaran/tanggal/%s", tanggal)
	response, _, err := client.Request("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("request gagal: %w", err)
	}

	var items []PendaftaranAntreanItem
	if err := json.Unmarshal(response, &items); err != nil {
		return nil, fmt.Errorf("gagal parse response: %w", err)
	}

	return items, nil
}

// GetPendaftaranByKodeBooking fetches specific pendaftaran antrean by kode booking
// GET /antrean/pendaftaran/kodebooking/{kodebooking}
func GetPendaftaranByKodeBooking(kodeBooking string) ([]PendaftaranAntreanItem, error) {
	client, err := NewClient()
	if err != nil {
		return nil, fmt.Errorf("gagal inisialisasi BPJS client: %w", err)
	}

	endpoint := fmt.Sprintf("/antrean/pendaftaran/kodebooking/%s", kodeBooking)
	response, _, err := client.Request("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("request gagal: %w", err)
	}

	var items []PendaftaranAntreanItem
	if err := json.Unmarshal(response, &items); err != nil {
		return nil, fmt.Errorf("gagal parse response: %w", err)
	}

	return items, nil
}

// ListTaskItem represents a task item from BPJS getlisttask
type ListTaskItem struct {
	WaktuRS     string `json:"wakturs"`
	Waktu       string `json:"waktu"`
	TaskName    string `json:"taskname"`
	TaskID      int    `json:"taskid"`
	KodeBooking string `json:"kodebooking"`
}

// GetListTask fetches task list from BPJS for a kode booking
// POST /antrean/getlisttask
func GetListTask(kodeBooking string) ([]ListTaskItem, error) {
	client, err := NewClient()
	if err != nil {
		return nil, fmt.Errorf("gagal inisialisasi BPJS client: %w", err)
	}

	reqBody := map[string]string{
		"kodebooking": kodeBooking,
	}

	endpoint := "/antrean/getlisttask"
	response, _, err := client.Request("POST", endpoint, reqBody)
	if err != nil {
		return nil, fmt.Errorf("request gagal: %w", err)
	}

	// Response can be an array or an object with "list" key
	var items []ListTaskItem
	if err := json.Unmarshal(response, &items); err == nil {
		return items, nil
	}

	var obj struct {
		List []ListTaskItem `json:"list"`
	}
	if err := json.Unmarshal(response, &obj); err != nil {
		return nil, fmt.Errorf("gagal parse response: %w", err)
	}

	return obj.List, nil
}
