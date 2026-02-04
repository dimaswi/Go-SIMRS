package bpjs

import (
	"encoding/json"
	"fmt"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
	"time"
)

// TaskUpdateRequest represents the request body for updating task to BPJS
type TaskUpdateRequest struct {
	KodeBooking string `json:"kodebooking"`
	TaskID      int    `json:"taskid"`
	WaktuRS     int64  `json:"waktu"`                 // Milliseconds since epoch
	JenisResep  string `json:"jenisresep,omitempty"`  // For task 6 only
	WaktuTunggu int    `json:"waktutunggu,omitempty"` // For task 6 only (in seconds)
	WaktuLayan  int    `json:"waktulayan,omitempty"`  // For task 6 only (in seconds)
}

// TaskUpdateResponse represents the response from BPJS task update
type TaskUpdateResponse struct {
	Metadata struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"metadata"`
	Response interface{} `json:"response"`
}

// SendTaskManual sends task update to BPJS and returns response details (for manual sending)
// Returns: success bool, metadata code int, message string
// waktuMs is the timestamp in milliseconds when the event occurred
func SendTaskManual(kodeBooking string, taskID int, waktuMs int64) (bool, int, string) {
	client, err := NewClient()
	if err != nil {
		return false, 0, "Gagal inisialisasi BPJS client: " + err.Error()
	}

	// Build request body - send as struct, client.Request will marshal it
	reqBody := TaskUpdateRequest{
		KodeBooking: kodeBooking,
		TaskID:      taskID,
		WaktuRS:     waktuMs,
	}

	// Make request to BPJS
	endpoint := "/antrean/updatewaktu"
	response, statusCode, err := client.Request("POST", endpoint, reqBody)

	// If error but we got response, try to parse it for the code
	if err != nil {
		// Extract code from error message if possible (format: "BPJS error [201]: message")
		errStr := err.Error()
		if strings.Contains(errStr, "BPJS error [") {
			// Parse code from error
			var code int
			var msg string
			fmt.Sscanf(errStr, "BPJS error [%d]: %s", &code, &msg)
			if code > 0 {
				// Get full message after the code
				idx := strings.Index(errStr, "]: ")
				if idx > 0 {
					msg = errStr[idx+3:]
				}
				return false, code, msg
			}
		}
		return false, statusCode, "Gagal request ke BPJS: " + err.Error()
	}

	// Parse response
	var result TaskUpdateResponse
	if err := json.Unmarshal(response, &result); err != nil {
		return false, statusCode, "Gagal parse response: " + err.Error()
	}

	// Check metadata.code - 200 = success, others = failed
	if result.Metadata.Code == 200 {
		return true, result.Metadata.Code, result.Metadata.Message
	}

	return false, result.Metadata.Code, result.Metadata.Message
}

// UpdateTask sends task update to BPJS Antrian Online
// Task IDs:
// 1 = Mulai tunggu admisi (ambil antrean pendaftaran)
// 2 = Dipanggil admisi (selesai tunggu admisi)
// 3 = Mulai tunggu poli (selesai pendaftaran / check-in MJKN)
// 4 = Dipanggil dokter
// 5 = Selesai periksa
// 6 = Mulai tunggu farmasi
// 7 = Selesai farmasi (serah obat)
func UpdateTask(kodeBooking string, taskID int, waktu time.Time, additionalData map[string]interface{}) error {
	client, err := NewClient()
	if err != nil {
		return fmt.Errorf("gagal inisialisasi BPJS client: %w", err)
	}

	// Build request body
	reqBody := TaskUpdateRequest{
		KodeBooking: kodeBooking,
		TaskID:      taskID,
		WaktuRS:     waktu.UnixMilli(),
	}

	// Add additional data for task 6 (farmasi)
	if taskID == 6 {
		if jenisResep, ok := additionalData["jenis_resep"].(string); ok {
			reqBody.JenisResep = jenisResep
		}
		if waktuTunggu, ok := additionalData["waktu_tunggu"].(int); ok {
			reqBody.WaktuTunggu = waktuTunggu
		}
		if waktuLayan, ok := additionalData["waktu_layan"].(int); ok {
			reqBody.WaktuLayan = waktuLayan
		}
	}

	// Debug log request body
	fmt.Printf("BPJS Task Update Request [%s][Task %d]: kodebooking=%s, waktu=%d\n", kodeBooking, taskID, kodeBooking, reqBody.WaktuRS)

	// Make request to BPJS - pass struct directly, client.Request will marshal it
	endpoint := "/antrean/updatewaktu"
	response, _, err := client.Request("POST", endpoint, reqBody)
	if err != nil {
		// GAGAL - JANGAN update database
		fmt.Printf("[BPJS Task %d] GAGAL untuk %s: %s - TIDAK update database\n", taskID, kodeBooking, err.Error())
		return fmt.Errorf("gagal update task ke BPJS: %w", err)
	}

	// Debug log response
	fmt.Printf("BPJS Task Update Response [%s][Task %d]: %s\n", kodeBooking, taskID, string(response))

	// Parse response
	var result TaskUpdateResponse
	if err := json.Unmarshal(response, &result); err != nil {
		// GAGAL parse - JANGAN update database
		fmt.Printf("[BPJS Task %d] GAGAL parse untuk %s: %s - TIDAK update database\n", taskID, kodeBooking, err.Error())
		return fmt.Errorf("gagal parse response BPJS: %w", err)
	}

	// CEK METADATA.CODE - HANYA 200 YANG SUKSES
	if result.Metadata.Code != 200 {
		// metadata.code BUKAN 200 - JANGAN update database
		fmt.Printf("[BPJS Task %d] GAGAL untuk %s: metadata.code=%d, msg=%s - TIDAK update database\n", taskID, kodeBooking, result.Metadata.Code, result.Metadata.Message)
		return fmt.Errorf("BPJS error: %s", result.Metadata.Message)
	}

	// SUKSES - metadata.code == 200, BARU update database
	logTaskUpdate(kodeBooking, taskID, waktu, result.Metadata.Code)
	return nil
}

// UpdateTaskAsync updates task asynchronously (fire and forget)
func UpdateTaskAsync(kodeBooking string, taskID int, waktu time.Time, additionalData map[string]interface{}) {
	go func() {
		if err := UpdateTask(kodeBooking, taskID, waktu, additionalData); err != nil {
			fmt.Printf("BPJS Task Update Error [%s][Task %d]: %v\n", kodeBooking, taskID, err)
		}
	}()
}

// logTaskUpdate logs task update to database
// HANYA dipanggil jika metadata.code == 200
func logTaskUpdate(kodeBooking string, taskID int, waktu time.Time, metadataCode int) {
	// DOUBLE CHECK - hanya proses jika metadata.code == 200
	if metadataCode != 200 {
		fmt.Printf("[BPJS Task %d] logTaskUpdate dipanggil dengan code %d (bukan 200) - DIABAIKAN\n", taskID, metadataCode)
		return
	}

	var queue models.BPJSQueue
	if err := database.DB.Where("kode_booking = ?", kodeBooking).First(&queue).Error; err != nil {
		return
	}

	// Update task time field
	switch taskID {
	case 1:
		queue.Task1At = &waktu
	case 2:
		queue.Task2At = &waktu
	case 3:
		queue.Task3At = &waktu
	case 4:
		queue.Task4At = &waktu
	case 5:
		queue.Task5At = &waktu
	case 6:
		queue.Task6At = &waktu
	case 7:
		queue.Task7At = &waktu
	}

	// Update sync status
	queue.SyncStatus = "synced"
	now := time.Now()
	queue.LastSyncAt = &now

	database.DB.Save(&queue)
	fmt.Printf("[BPJS Task %d] SUKSES (metadata.code=200) untuk %s - database diupdate\n", taskID, kodeBooking)
}

// UpdateBPJSQueueFromRoomQueueStatus updates BPJS task based on RoomQueue status change
func UpdateBPJSQueueFromRoomQueueStatus(roomQueueID uint, newStatus string, waktu *time.Time) {
	// Find BPJSQueue linked to this RoomQueue
	var bpjsQueue models.BPJSQueue
	if err := database.DB.Where("room_queue_id = ?", roomQueueID).First(&bpjsQueue).Error; err != nil {
		// No BPJS queue linked, skip (pasien bukan MJKN)
		return
	}

	taskTime := time.Now()
	if waktu != nil {
		taskTime = *waktu
	}

	switch newStatus {
	case models.RoomQueueStatusCalled:
		// Pasien dipanggil dokter -> Task 4
		UpdateTaskAsync(bpjsQueue.KodeBooking, 4, taskTime, nil)

	case models.RoomQueueStatusServing:
		// Pasien mulai dilayani -> tidak ada task khusus
		// Task 5 di-trigger saat selesai

	case models.RoomQueueStatusCompleted:
		// Selesai periksa -> Task 5
		UpdateTaskAsync(bpjsQueue.KodeBooking, 5, taskTime, nil)
	}
}

// UpdateBPJSQueueForFarmasi updates BPJS task 6 and 7 for pharmacy
func UpdateBPJSQueueForFarmasi(kodeBooking string, jenisResep string, waktuMulai time.Time) {
	// Task 6 - Mulai tunggu farmasi
	UpdateTaskAsync(kodeBooking, 6, waktuMulai, map[string]interface{}{
		"jenis_resep":  jenisResep,
		"waktu_tunggu": 0,
		"waktu_layan":  0,
	})

	// Task 7 - Serah obat (5 menit setelah task 6 sesuai dokumen)
	go func() {
		time.Sleep(5 * time.Minute)
		UpdateTaskAsync(kodeBooking, 7, time.Now(), nil)
	}()
}

// TriggerFarmasiTask triggers BPJS task 6 & 7 when medicine is delivered
// Called from medicine order handler
func TriggerFarmasiTask(visitID uint, deliveredAt time.Time) {
	// Find BPJSQueue linked to this Visit
	var bpjsQueue models.BPJSQueue
	if err := database.DB.Where("visit_id = ?", visitID).First(&bpjsQueue).Error; err != nil {
		// No BPJS queue linked (pasien bukan MJKN), skip
		return
	}

	// Check if already processed (prevent duplicate)
	if bpjsQueue.Task6At != nil {
		return
	}

	// Determine jenis resep (racikan/non-racikan)
	// For simplicity, we use "non racikan" as default
	jenisResep := "non racikan"

	// Update Task 6 & 7
	UpdateBPJSQueueForFarmasi(bpjsQueue.KodeBooking, jenisResep, deliveredAt)
}
