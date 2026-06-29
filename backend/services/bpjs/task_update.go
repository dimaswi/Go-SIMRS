package bpjs

import (
	"fmt"
	"math/rand"
	"regexp"
	"starter/backend/database"
	"starter/backend/models"
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
	_, _, err = client.Request("POST", endpoint, reqBody)
	if err != nil {
		errStr := err.Error()
		code := 0
		msg := errStr
		if idx := extractBPJSErrorCode(errStr); idx > 0 {
			code = idx
			msg = extractBPJSErrorMessage(errStr)
		}

		// Code 208 = task sudah ada di BPJS, treat as success
		// Ini terjadi ketika BPJS sudah terima tapi lokal belum terupdate
		if code == 208 {
			fmt.Printf("[BPJS SendTaskManual] Task %d untuk %s: code 208 (sudah ada), treated as success\n", taskID, kodeBooking)
			return true, 200, msg
		}

		database.DB.Model(&models.BPJSQueue{}).Where("kode_booking = ?", kodeBooking).Updates(map[string]interface{}{
			"sync_status":  "failed",
			"sync_error":   fmt.Sprintf("[Task %d] %s", taskID, msg),
			"last_sync_at": time.Now(),
		})

		return false, code, msg
	}

	// client.Request returns nil error only when metadata.code == 200
	return true, 200, "Berhasil"
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
	_, _, err = client.Request("POST", endpoint, reqBody)
	if err != nil {
		errStr := err.Error()
		code := extractBPJSErrorCode(errStr)

		// Code 208 = task sudah ada di BPJS, treat as success dan update DB
		if code == 208 {
			fmt.Printf("[BPJS Task %d] Code 208 (sudah ada) untuk %s - update database\n", taskID, kodeBooking)
			logTaskUpdate(kodeBooking, taskID, waktu, 200)
			return nil
		}

		fmt.Printf("[BPJS Task %d] GAGAL untuk %s: %s - TIDAK update database\n", taskID, kodeBooking, errStr)

		UpdateSyncError(kodeBooking, taskID, errStr)

		return fmt.Errorf("gagal update task ke BPJS: %w", err)
	}

	// client.Request returns nil error only when metadata.code == 200
	// SUKSES - update database
	fmt.Printf("[BPJS Task %d] SUKSES untuk %s\n", taskID, kodeBooking)
	logTaskUpdate(kodeBooking, taskID, waktu, 200)
	return nil
}

// UpdateSyncError manages appending or updating specific task errors in sync_error field
func UpdateSyncError(kodeBooking string, taskID int, errMsg string) {
	var queue models.BPJSQueue
	if err := database.DB.Select("sync_error").Where("kode_booking = ?", kodeBooking).First(&queue).Error; err != nil {
		return
	}

	newTaskErr := fmt.Sprintf("[Task %d] %s", taskID, errMsg)
	
	// If it already contains an error for this task, we want to replace it, otherwise append
	// (Simple approach: just append it if not too long, or reconstruct)
	finalErr := newTaskErr
	if queue.SyncError != "" {
		importRegexp := regexp.MustCompile(fmt.Sprintf(`(?m)^\[Task %d\].*?$`, taskID))
		if importRegexp.MatchString(queue.SyncError) {
			finalErr = importRegexp.ReplaceAllString(queue.SyncError, newTaskErr)
		} else {
			finalErr = queue.SyncError + "\n" + newTaskErr
		}
	}

	// Safety truncation
	if len(finalErr) > 2000 {
		finalErr = finalErr[len(finalErr)-2000:]
	}

	database.DB.Model(&models.BPJSQueue{}).Where("kode_booking = ?", kodeBooking).Updates(map[string]interface{}{
		"sync_status":  "failed",
		"sync_error":   finalErr,
		"last_sync_at": time.Now(),
	})
}

// UpdateTaskAsync updates task asynchronously (fire and forget)
func UpdateTaskAsync(kodeBooking string, taskID int, waktu time.Time, additionalData map[string]interface{}) {
	go func() {
		if err := UpdateTask(kodeBooking, taskID, waktu, additionalData); err != nil {
			fmt.Printf("BPJS Task Update Error [%s][Task %d]: %v\n", kodeBooking, taskID, err)
		}
	}()
}

// ensureSequentialTime memastikan waktu task selalu lebih besar dari task sebelumnya.
// BPJS mensyaratkan timestamp harus urut: T1 < T2 < T3 < T4 < T5 < T6 < T7.
// Jika waktu yang diberikan <= task sebelumnya, bump ke previousTask + 1 menit.
func ensureSequentialTime(queue *models.BPJSQueue, taskID int, waktu time.Time) time.Time {
	var prevTime *time.Time

	switch taskID {
	case 2:
		prevTime = queue.Task1At
	case 3:
		prevTime = queue.Task2At
	case 4:
		prevTime = queue.Task3At
	case 5:
		prevTime = queue.Task4At
	case 6:
		prevTime = queue.Task5At
	case 7:
		prevTime = queue.Task6At
	}

	if prevTime != nil && !waktu.After(*prevTime) {
		adjusted := prevTime.Add(1 * time.Minute)
		fmt.Printf("[BPJS Task %d] Waktu %s <= task sebelumnya %s, adjusted ke %s\n",
			taskID, waktu.Format("15:04:05"), prevTime.Format("15:04:05"), adjusted.Format("15:04:05"))
		return adjusted
	}

	// BPJS requires tasks to be on the same date as TanggalPeriksa.
	// If the user forgot to update task on the same day (e.g. discharging next morning),
	// we clamp the time to TanggalPeriksa 23:59:00, or prevTime + 15 mins.
	if waktu.Year() != queue.TanggalPeriksa.Year() || waktu.Month() != queue.TanggalPeriksa.Month() || waktu.Day() != queue.TanggalPeriksa.Day() {
		// Default to 15 mins after prevTime if prevTime exists and is on TanggalPeriksa
		if prevTime != nil && prevTime.Year() == queue.TanggalPeriksa.Year() && prevTime.Month() == queue.TanggalPeriksa.Month() && prevTime.Day() == queue.TanggalPeriksa.Day() {
			adjusted := prevTime.Add(15 * time.Minute)
			// Ensure it doesn't spill over to the next day
			if adjusted.Day() != queue.TanggalPeriksa.Day() {
				adjusted = time.Date(queue.TanggalPeriksa.Year(), queue.TanggalPeriksa.Month(), queue.TanggalPeriksa.Day(), 23, 59, 0, 0, queue.TanggalPeriksa.Location())
			}
			fmt.Printf("[BPJS Task %d] Waktu beda hari dengan TanggalPeriksa, adjusted ke prevTime+15m: %s\n", taskID, adjusted.Format("2006-01-02 15:04:05"))
			return adjusted
		} else {
			// Fallback: 23:55:00 on TanggalPeriksa
			adjusted := time.Date(queue.TanggalPeriksa.Year(), queue.TanggalPeriksa.Month(), queue.TanggalPeriksa.Day(), 23, 55, 0, 0, queue.TanggalPeriksa.Location())
			fmt.Printf("[BPJS Task %d] Waktu beda hari, fallback adjusted ke 23:55:00: %s\n", taskID, adjusted.Format("2006-01-02 15:04:05"))
			return adjusted
		}
	}

	return waktu
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
		adjusted := ensureSequentialTime(&bpjsQueue, 4, taskTime)
		UpdateTaskAsync(bpjsQueue.KodeBooking, 4, adjusted, nil)

	case models.RoomQueueStatusServing:
		// Pasien mulai dilayani -> tidak ada task khusus
		// Task 5 di-trigger saat selesai

	case models.RoomQueueStatusCompleted:
		// Selesai periksa -> Task 5
		adjusted := ensureSequentialTime(&bpjsQueue, 5, taskTime)

		// Kirim Task 5, lalu auto-chain Task 6 & 7 (tetap lanjut walaupun Task 5 gagal)
		go func() {
			err := UpdateTask(bpjsQueue.KodeBooking, 5, adjusted, nil)
			if err != nil {
				fmt.Printf("BPJS Task Update Error [%s][Task 5]: %v (tetap lanjut ke Task 6 & 7)\n", bpjsQueue.KodeBooking, err)
			}

			// Auto-chain Task 6 & 7 — selalu dicoba walaupun Task 5 error
			AutoChainFarmasiTasks(bpjsQueue.KodeBooking, adjusted)
		}()
	}
}

// AutoChainFarmasiTasks otomatis kirim Task 6 dan Task 7 setelah Task 5 di-attempt.
// Task 6 = baseTime + random 0-2 menit
// Task 7 = task6Time + random 5-10 menit
// Selalu dicoba walaupun Task 5 gagal — BPJS mungkin sudah punya Task 5 dari sebelumnya.
func AutoChainFarmasiTasks(kodeBooking string, task5Time time.Time) {
	var queue models.BPJSQueue
	if err := database.DB.Where("kode_booking = ?", kodeBooking).First(&queue).Error; err != nil {
		return
	}

	if queue.VisitID == nil {
		return
	}

	// Cek apakah ada order resep dibawa pulang
	var orderCount int64
	database.DB.Model(&models.MedicineOrder{}).
		Where("source_visit_id = ? AND fulfillment_type = ?", *queue.VisitID, models.FulfillmentTypeTakeHome).
		Count(&orderCount)

	if orderCount == 0 {
		fmt.Printf("[BPJS AutoChain] Skip Task 6 & 7 untuk %s (Tidak ada order farmasi dibawa pulang)\n", kodeBooking)
		return
	}

	// Gunakan task5_at dari DB jika ada, fallback ke parameter
	baseTime := task5Time
	if queue.Task5At != nil {
		baseTime = *queue.Task5At
	}

	// ---- Task 6: baseTime + random 0-2 menit ----
	task6Time := baseTime // fallback
	if queue.Task6At == nil {
		offset6 := time.Duration(rand.Intn(121)) * time.Second // 0-120 detik
		task6Time = baseTime.Add(offset6)

		fmt.Printf("[BPJS AutoChain] Kirim Task 6 untuk %s (base + %v)\n", kodeBooking, offset6)
		err := UpdateTask(kodeBooking, 6, task6Time, map[string]interface{}{
			"jenis_resep":  "non racikan",
			"waktu_tunggu": 0,
			"waktu_layan":  0,
		})
		if err != nil {
			fmt.Printf("BPJS Task Update Error [%s][Task 6]: %v (tetap lanjut ke Task 7)\n", kodeBooking, err)
		}
	} else {
		task6Time = *queue.Task6At
	}

	// Reload untuk dapat task6_at terbaru
	if err := database.DB.Where("kode_booking = ?", kodeBooking).First(&queue).Error; err != nil {
		return
	}
	if queue.Task6At != nil {
		task6Time = *queue.Task6At
	}

	// ---- Task 7: task6Time + random 5-10 menit ----
	if queue.Task7At == nil {
		offset7 := time.Duration(300+rand.Intn(301)) * time.Second // 300-600 detik (5-10 menit)
		task7Time := task6Time.Add(offset7)

		fmt.Printf("[BPJS AutoChain] Kirim Task 7 untuk %s (T6 + %v)\n", kodeBooking, offset7)
		err := UpdateTask(kodeBooking, 7, task7Time, nil)
		if err != nil {
			fmt.Printf("BPJS Task Update Error [%s][Task 7]: %v\n", kodeBooking, err)
		}
	}
}

// TriggerTask5FromVisit triggers BPJS Task 5 when a visit is completed directly
// (without going through room queue status change).
func TriggerTask5FromVisit(visitID uint, completedAt time.Time) {
	var bpjsQueue models.BPJSQueue
	if err := database.DB.Where("visit_id = ?", visitID).First(&bpjsQueue).Error; err != nil {
		return // bukan pasien MJKN
	}

	if bpjsQueue.Task5At != nil {
		fmt.Printf("[BPJS Task 5] Sudah terkirim untuk visit %d, skip\n", visitID)
		return
	}

	adjusted := ensureSequentialTime(&bpjsQueue, 5, completedAt)
	err := UpdateTask(bpjsQueue.KodeBooking, 5, adjusted, nil)
	if err != nil {
		fmt.Printf("BPJS Task Update Error [%s][Task 5 from Visit]: %v (tetap lanjut ke Task 6 & 7)\n", bpjsQueue.KodeBooking, err)
	}

	// Auto-chain Task 6 & 7 — selalu dicoba walaupun Task 5 error
	AutoChainFarmasiTasks(bpjsQueue.KodeBooking, adjusted)
}
