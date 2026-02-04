package bpjs

import (
	"encoding/json"
	"fmt"
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

// AddAntreanResponse represents the response from BPJS add antrean
type AddAntreanResponse struct {
	Metadata struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"metadata"`
	Response interface{} `json:"response"`
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

	// Parse kode dokter to int
	kodeDokter := 0
	fmt.Sscanf(queue.KodeDokter, "%d", &kodeDokter)

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

	// Build request
	reqBody := AddAntreanRequest{
		KodeBooking:      queue.KodeBooking,
		JenisPasien:      jenisPasien,
		NomorKartu:       queue.NoKartu,
		NIK:              queue.NIK,
		NoHP:             queue.NoHP,
		KodePoli:         queue.KodePoli,
		NamaPoli:         queue.NamaPoli,
		PasienBaru:       pasienBaru,
		NoRM:             queue.NoRM,
		TanggalPeriksa:   queue.TanggalPeriksa.Format("2006-01-02"), // Format: YYYY-MM-DD
		KodeDokter:       kodeDokter,
		NamaDokter:       queue.NamaDokter,
		JamPraktek:       queue.JamPraktek,
		JenisKunjungan:   queue.JenisKunjungan,
		NomorReferensi:   queue.NomorReferensi,
		NomorAntrean:     queue.NomorAntrean,
		AngkaAntrean:     queue.AngkaAntrean,
		EstimasiDilayani: queue.EstimasiDilayani,
		SisaKuotaJKN:     10, // Default values
		KuotaJKN:         20,
		SisaKuotaNonJKN:  10,
		KuotaNonJKN:      20,
		Keterangan:       queue.Keterangan,
	}

	// Debug log
	reqJSON, _ := json.Marshal(reqBody)
	reqJSONStr := string(reqJSON)
	fmt.Printf("[BPJS AddAntrean] Request: %s\n", reqJSONStr)

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

		// Update queue struct with error (tidak save ke DB, biar caller yang save)
		queue.AddAntreanCode = code
		queue.AddAntreanMsg = msg
		queue.SyncStatus = "failed"
		queue.SyncError = msg

		return false, code, msg
	}

	// Parse response
	var result AddAntreanResponse
	if err := json.Unmarshal(response, &result); err != nil {
		queue.AddAntreanCode = 0
		queue.AddAntreanMsg = "gagal parse response: " + err.Error()
		queue.SyncStatus = "failed"
		queue.SyncError = queue.AddAntreanMsg

		return false, 0, queue.AddAntreanMsg
	}

	// Update queue struct with response
	queue.AddAntreanCode = result.Metadata.Code
	queue.AddAntreanMsg = result.Metadata.Message

	// Check if success (code 200)
	if result.Metadata.Code != 200 {
		queue.SyncStatus = "failed"
		queue.SyncError = result.Metadata.Message

		return false, result.Metadata.Code, result.Metadata.Message
	}

	// Success
	queue.SyncStatus = "synced"
	queue.SyncError = ""

	fmt.Printf("[BPJS AddAntrean] Success for kode_booking: %s\n", queue.KodeBooking)

	return true, 200, result.Metadata.Message
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
