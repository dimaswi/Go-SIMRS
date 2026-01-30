package handlers

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"starter/backend/database"
	"starter/backend/models"
	"starter/backend/services/bpjs"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// getEncryptionKey returns a 32-byte key for AES-256
func getEncryptionKey() []byte {
	key := os.Getenv("BPJS_ENCRYPTION_KEY")
	if key == "" {
		key = "simrs-bpjs-default-encryption-key-32b"
	}
	// Ensure 32 bytes for AES-256
	hash := sha256.Sum256([]byte(key))
	return hash[:]
}

// encryptValue encrypts a string using AES-256-GCM
func encryptValue(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	block, err := aes.NewCipher(getEncryptionKey())
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptValue decrypts a string using AES-256-GCM
func decryptValue(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(getEncryptionKey())
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, cipherData := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, cipherData, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// maskSecret returns a masked version of secret value
func maskSecret(value string) string {
	if len(value) <= 4 {
		return "****"
	}
	return value[:2] + strings.Repeat("*", len(value)-4) + value[len(value)-2:]
}

// GetBPJSConfig returns all BPJS configuration
func GetBPJSConfig(c *gin.Context) {
	var configs []models.IntegrationConfig
	if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJS).Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil konfigurasi BPJS"})
		return
	}

	// Get config definitions for metadata
	configDefs := make(map[string]models.IntegrationConfigKey)
	for _, def := range models.BPJSConfigKeys {
		configDefs[def.Key] = def
	}

	// Convert to map for easier frontend consumption
	configMap := make(map[string]interface{})
	for _, config := range configs {
		value := config.Value
		def := configDefs[config.Key]

		// Decrypt if encrypted
		if config.IsEncrypted && value != "" {
			decrypted, err := decryptValue(value)
			if err == nil {
				value = decrypted
			}
		}

		// Mask secret values
		if config.IsSecret && value != "" {
			configMap["bpjs_"+config.Key] = gin.H{
				"value":        maskSecret(value),
				"has_value":    true,
				"description":  def.Description,
				"is_secret":    true,
				"is_encrypted": config.IsEncrypted,
			}
		} else {
			configMap["bpjs_"+config.Key] = gin.H{
				"value":        value,
				"has_value":    value != "",
				"description":  def.Description,
				"is_secret":    false,
				"is_encrypted": config.IsEncrypted,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": configMap})
}

// UpdateBPJSConfig updates BPJS configuration
func UpdateBPJSConfig(c *gin.Context) {
	var input map[string]string
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find config definitions
	configDefs := make(map[string]models.IntegrationConfigKey)
	for _, def := range models.BPJSConfigKeys {
		configDefs[def.Key] = def
	}

	// Update or create each config
	for key, value := range input {
		// Remove bpjs_ prefix if present
		actualKey := strings.TrimPrefix(key, "bpjs_")
		def, exists := configDefs[actualKey]
		if !exists {
			continue // Skip unknown keys
		}

		var config models.IntegrationConfig
		result := database.DB.Where("integration = ? AND key = ?", models.IntegrationTypeBPJS, actualKey).First(&config)

		// Encrypt if needed
		valueToSave := value
		if def.IsEncrypted && value != "" {
			encrypted, err := encryptValue(value)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengenkripsi nilai"})
				return
			}
			valueToSave = encrypted
		}

		if result.Error != nil {
			// Create new config
			config = models.IntegrationConfig{
				Integration: models.IntegrationTypeBPJS,
				Key:         actualKey,
				Value:       valueToSave,
				IsEncrypted: def.IsEncrypted,
				IsSecret:    def.IsSecret,
			}
			if err := database.DB.Create(&config).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan konfigurasi"})
				return
			}
		} else {
			// Update existing config
			config.Value = valueToSave
			if err := database.DB.Save(&config).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate konfigurasi"})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi BPJS berhasil disimpan"})
}

// InitBPJSConfig initializes default BPJS configuration
func InitBPJSConfig(c *gin.Context) {
	for _, def := range models.BPJSConfigKeys {
		var existing models.IntegrationConfig
		result := database.DB.Where("integration = ? AND key = ?", models.IntegrationTypeBPJS, def.Key).First(&existing)
		if result.Error != nil {
			// Create if not exists
			newConfig := models.IntegrationConfig{
				Integration: models.IntegrationTypeBPJS,
				Key:         def.Key,
				Value:       def.Default,
				IsEncrypted: def.IsEncrypted,
				IsSecret:    def.IsSecret,
			}
			database.DB.Create(&newConfig)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi BPJS berhasil diinisialisasi"})
}

// GetBPJSSyncLogs returns recent sync logs for BPJS integration
func GetBPJSSyncLogs(c *gin.Context) {
	var logs []models.IntegrationSyncLog

	// Get limit parameter
	limitStr := c.DefaultQuery("limit", "100")
	limit := 100
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	query := database.DB.Where("integration = ?", models.IntegrationTypeBPJS).
		Order("created_at DESC").Limit(limit)

	// Filter by status if provided
	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by date if provided
	date := c.Query("date")
	if date != "" {
		query = query.Where("DATE(request_at) = ?", date)
	}

	// Filter by endpoint if provided
	endpoint := c.Query("endpoint")
	if endpoint != "" {
		query = query.Where("endpoint LIKE ?", "%"+endpoint+"%")
	}

	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil log"})
		return
	}

	// Mask sensitive data in logs
	for i := range logs {
		// Mask request body if contains sensitive data
		if strings.Contains(logs[i].RequestBody, "secret") || strings.Contains(logs[i].RequestBody, "key") {
			logs[i].RequestBody = "[MASKED]"
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// GetBPJSSyncStats returns sync statistics for BPJS integration
func GetBPJSSyncStats(c *gin.Context) {
	type Stats struct {
		TotalRequests   int64   `json:"total_requests"`
		SuccessRequests int64   `json:"success_requests"`
		FailedRequests  int64   `json:"failed_requests"`
		AvgDurationMs   float64 `json:"avg_duration_ms"`
	}

	var stats Stats

	// Get today's stats for BPJS integration
	today := time.Now().Format("2006-01-02")

	database.DB.Model(&models.IntegrationSyncLog{}).
		Where("integration = ? AND DATE(request_at) = ?", models.IntegrationTypeBPJS, today).
		Count(&stats.TotalRequests)

	database.DB.Model(&models.IntegrationSyncLog{}).
		Where("integration = ? AND DATE(request_at) = ? AND status = ?", models.IntegrationTypeBPJS, today, "success").
		Count(&stats.SuccessRequests)

	database.DB.Model(&models.IntegrationSyncLog{}).
		Where("integration = ? AND DATE(request_at) = ? AND status = ?", models.IntegrationTypeBPJS, today, "failed").
		Count(&stats.FailedRequests)

	var avgDuration struct {
		Avg float64
	}
	database.DB.Model(&models.IntegrationSyncLog{}).
		Where("integration = ? AND DATE(request_at) = ?", models.IntegrationTypeBPJS, today).
		Select("COALESCE(AVG(duration_ms), 0) as avg").
		Scan(&avgDuration)
	stats.AvgDurationMs = avgDuration.Avg

	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// === POLI MAPPING ===

// GetBPJSPoliMappings returns all poli mappings
func GetBPJSPoliMappings(c *gin.Context) {
	var mappings []models.BPJSPoliMapping

	query := database.DB.Preload("Room").Preload("DoctorMappings").Preload("DoctorMappings.Employee")

	// Filter by room if provided
	roomID := c.Query("room_id")
	if roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	// Filter by active status
	isActive := c.Query("is_active")
	if isActive == "true" {
		query = query.Where("is_active = ?", true)
	}

	if err := query.Find(&mappings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil mapping poli"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": mappings})
}

// CreateBPJSPoliMapping creates a new poli mapping
func CreateBPJSPoliMapping(c *gin.Context) {
	var input models.BPJSPoliMapping
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate room exists
	var room models.Room
	if err := database.DB.First(&room, input.RoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	// Check if mapping already exists for this room
	var existing models.BPJSPoliMapping
	if err := database.DB.Where("room_id = ?", input.RoomID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mapping untuk ruangan ini sudah ada"})
		return
	}

	// Set room info
	input.RoomCode = room.Code
	input.RoomName = room.Name

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat mapping"})
		return
	}

	database.DB.Preload("Room").First(&input, input.ID)
	c.JSON(http.StatusCreated, gin.H{"data": input})
}

// UpdateBPJSPoliMapping updates a poli mapping
func UpdateBPJSPoliMapping(c *gin.Context) {
	id := c.Param("id")

	var mapping models.BPJSPoliMapping
	if err := database.DB.First(&mapping, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan"})
		return
	}

	var input struct {
		KodePoliBPJS string `json:"kode_poli_bpjs"`
		NamaPoliBPJS string `json:"nama_poli_bpjs"`
		IsActive     *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.KodePoliBPJS != "" {
		mapping.KodePoliBPJS = input.KodePoliBPJS
	}
	if input.NamaPoliBPJS != "" {
		mapping.NamaPoliBPJS = input.NamaPoliBPJS
	}
	if input.IsActive != nil {
		mapping.IsActive = *input.IsActive
	}

	if err := database.DB.Save(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate mapping"})
		return
	}

	database.DB.Preload("Room").Preload("DoctorMappings").Preload("DoctorMappings.Employee").First(&mapping, mapping.ID)
	c.JSON(http.StatusOK, gin.H{"data": mapping})
}

// DeleteBPJSPoliMapping deletes a poli mapping
func DeleteBPJSPoliMapping(c *gin.Context) {
	id := c.Param("id")

	var mapping models.BPJSPoliMapping
	if err := database.DB.First(&mapping, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus mapping"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Mapping berhasil dihapus"})
}

// ======================================
// BPJS DOCTOR MAPPING
// ======================================

// GetBPJSDoctorMappings returns all doctor mappings
// GET /api/bpjs/mapping/dokter
func GetBPJSDoctorMappings(c *gin.Context) {
	var mappings []models.BPJSDoctorMapping

	query := database.DB.Preload("PoliMapping").Preload("PoliMapping.Room").Preload("Employee").Preload("DoctorSchedule")

	// Filter by poli mapping if provided
	poliMappingID := c.Query("poli_mapping_id")
	if poliMappingID != "" {
		query = query.Where("poli_mapping_id = ?", poliMappingID)
	}

	// Filter by employee if provided
	employeeID := c.Query("employee_id")
	if employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}

	// Filter by active status
	isActive := c.Query("is_active")
	if isActive == "true" {
		query = query.Where("is_active = ?", true)
	}

	if err := query.Find(&mappings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil mapping dokter"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": mappings})
}

// CreateBPJSDoctorMapping creates a new doctor mapping
// POST /api/bpjs/mapping/dokter
func CreateBPJSDoctorMapping(c *gin.Context) {
	var input models.BPJSDoctorMapping
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate poli mapping exists
	var poliMapping models.BPJSPoliMapping
	if err := database.DB.First(&poliMapping, input.PoliMappingID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poli mapping tidak ditemukan"})
		return
	}

	// Validate employee exists and is a doctor
	var employee models.Employee
	if err := database.DB.First(&employee, input.EmployeeID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Karyawan tidak ditemukan"})
		return
	}
	input.EmployeeName = employee.NamaLengkap

	// Validate doctor schedule if provided
	if input.DoctorScheduleID != 0 {
		var schedule models.DoctorSchedule
		if err := database.DB.First(&schedule, input.DoctorScheduleID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jadwal dokter tidak ditemukan"})
			return
		}
	}

	// Check duplicate: same poli + employee + kode dokter
	var existing models.BPJSDoctorMapping
	if err := database.DB.Where("poli_mapping_id = ? AND employee_id = ? AND kode_dokter_bpjs = ?",
		input.PoliMappingID, input.EmployeeID, input.KodeDokterBPJS).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mapping dokter dengan kode BPJS yang sama sudah ada"})
		return
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat mapping dokter"})
		return
	}

	database.DB.Preload("PoliMapping").Preload("PoliMapping.Room").Preload("Employee").First(&input, input.ID)
	c.JSON(http.StatusCreated, gin.H{"data": input})
}

// UpdateBPJSDoctorMapping updates a doctor mapping
// PUT /api/bpjs/mapping/dokter/:id
func UpdateBPJSDoctorMapping(c *gin.Context) {
	id := c.Param("id")

	var mapping models.BPJSDoctorMapping
	if err := database.DB.First(&mapping, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mapping dokter tidak ditemukan"})
		return
	}

	var input struct {
		KodeDokterBPJS string `json:"kode_dokter_bpjs"`
		NamaDokterBPJS string `json:"nama_dokter_bpjs"`
		JadwalHari     string `json:"jadwal_hari"`
		JamPraktek     string `json:"jam_praktek"`
		KuotaJKN       *int   `json:"kuota_jkn"`
		KuotaNonJKN    *int   `json:"kuota_non_jkn"`
		IsActive       *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.KodeDokterBPJS != "" {
		mapping.KodeDokterBPJS = input.KodeDokterBPJS
	}
	if input.NamaDokterBPJS != "" {
		mapping.NamaDokterBPJS = input.NamaDokterBPJS
	}
	if input.JadwalHari != "" {
		mapping.JadwalHari = input.JadwalHari
	}
	if input.JamPraktek != "" {
		mapping.JamPraktek = input.JamPraktek
	}
	if input.KuotaJKN != nil {
		mapping.KuotaJKN = *input.KuotaJKN
	}
	if input.KuotaNonJKN != nil {
		mapping.KuotaNonJKN = *input.KuotaNonJKN
	}
	if input.IsActive != nil {
		mapping.IsActive = *input.IsActive
	}

	if err := database.DB.Save(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate mapping dokter"})
		return
	}

	database.DB.Preload("PoliMapping").Preload("PoliMapping.Room").Preload("Employee").First(&mapping, mapping.ID)
	c.JSON(http.StatusOK, gin.H{"data": mapping})
}

// DeleteBPJSDoctorMapping deletes a doctor mapping
// DELETE /api/bpjs/mapping/dokter/:id
func DeleteBPJSDoctorMapping(c *gin.Context) {
	id := c.Param("id")

	var mapping models.BPJSDoctorMapping
	if err := database.DB.First(&mapping, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mapping dokter tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus mapping dokter"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Mapping dokter berhasil dihapus"})
}

// SyncBPJSDoctorFromReferensi sinkronisasi data dokter dari referensi BPJS ke mapping
// POST /api/bpjs/mapping/dokter/sync
func SyncBPJSDoctorFromReferensi(c *gin.Context) {
	client, err := bpjs.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal inisialisasi BPJS client: " + err.Error()})
		return
	}

	// Get all active poli mappings
	var poliMappings []models.BPJSPoliMapping
	if err := database.DB.Where("is_active = ?", true).Find(&poliMappings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil poli mapping"})
		return
	}

	results := make(map[string]interface{})
	for _, poli := range poliMappings {
		// Get jadwal dokter from BPJS for today
		tanggal := time.Now().Format("2006-01-02")
		jadwals, err := client.GetJadwalDokter(poli.KodePoliBPJS, tanggal)
		if err != nil {
			results[poli.KodePoliBPJS] = gin.H{
				"error": err.Error(),
			}
			continue
		}
		results[poli.KodePoliBPJS] = gin.H{
			"nama_poli":    poli.NamaPoliBPJS,
			"jadwal_count": len(jadwals),
			"jadwals":      jadwals,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Sync referensi selesai",
		"data":    results,
	})
}

// Helper for signature generation (exported for testing)
func GenerateBPJSSignature(consID, secretKey, timestamp string) string {
	data := consID + "&" + timestamp
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// DebugBPJSSignature menampilkan detail signature generation untuk debugging
// GET /api/bpjs/debug-signature
func DebugBPJSSignature(c *gin.Context) {
	// Get BPJS config
	var configs []models.IntegrationConfig
	if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJS).Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil konfigurasi BPJS"})
		return
	}

	configMap := make(map[string]string)
	for _, cfg := range configs {
		value := cfg.Value
		// Decrypt if encrypted
		if cfg.IsEncrypted && value != "" {
			decrypted, err := decryptValue(value)
			if err == nil {
				value = decrypted
			}
		}
		configMap[cfg.Key] = value
	}

	consID := configMap["cons_id"]
	secretKey := configMap["secret_key"]
	userKey := configMap["user_key"]

	// Generate timestamp (Unix timestamp in seconds)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	// Data untuk signature: cons_id&timestamp
	signatureData := consID + "&" + timestamp

	// Generate HMAC-SHA256
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(signatureData))
	signatureBytes := h.Sum(nil)
	signature := base64.StdEncoding.EncodeToString(signatureBytes)

	// Determine environment dan base URL
	environment := configMap["environment"]
	if environment == "" {
		environment = "development"
	}

	var baseURL string
	if environment == "production" {
		baseURL = configMap["base_url_prod"]
	} else {
		baseURL = configMap["base_url_dev"]
	}

	if baseURL != "" && !strings.Contains(baseURL, "/antreanrs") {
		if environment == "production" {
			baseURL = baseURL + "/antreanrs"
		} else {
			baseURL = baseURL + "/antreanrs_dev"
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"debug_info": gin.H{
			"cons_id":          consID,
			"secret_key":       maskSecret(secretKey),
			"secret_key_len":   len(secretKey),
			"user_key":         maskSecret(userKey),
			"timestamp":        timestamp,
			"signature_data":   signatureData,
			"signature":        signature,
			"signature_hex":    hex.EncodeToString(signatureBytes),
			"environment":      environment,
			"base_url":         baseURL,
			"sample_full_url":  baseURL + "/ref/poli",
		},
		"headers_to_use": gin.H{
			"X-cons-id":    consID,
			"X-timestamp":  timestamp,
			"X-signature":  signature,
			"user_key":     userKey,
			"Content-Type": "application/json",
		},
		"test_url":       baseURL + "/ref/poli",
		"test_cons_id":   consID,
		"test_timestamp": timestamp,
		"test_signature": signature,
		"test_user_key":  userKey,
	})
}

// Helper to get decryption key string (for response decryption)
func getBPJSDecryptionKey(consID, secretKey, timestamp string) string {
	combined := consID + secretKey + timestamp
	hash := sha256.Sum256([]byte(combined))
	return hex.EncodeToString(hash[:])[:32]
}

// TestBPJSRaw langsung hit BPJS dan return raw response untuk debugging
// GET /api/bpjs/test-raw
func TestBPJSRaw(c *gin.Context) {
	// Get BPJS config
	var configs []models.IntegrationConfig
	if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJS).Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil konfigurasi BPJS"})
		return
	}

	configMap := make(map[string]string)
	for _, cfg := range configs {
		value := cfg.Value
		if cfg.IsEncrypted && value != "" {
			decrypted, err := decryptValue(value)
			if err == nil {
				value = decrypted
			}
		}
		configMap[cfg.Key] = value
	}

	consID := configMap["cons_id"]
	secretKey := configMap["secret_key"]
	userKey := configMap["user_key"]

	environment := configMap["environment"]
	if environment == "" {
		environment = "development"
	}

	var baseURL string
	if environment == "production" {
		baseURL = configMap["base_url_prod"]
	} else {
		baseURL = configMap["base_url_dev"]
	}

	if baseURL != "" && !strings.Contains(baseURL, "/antreanrs") {
		if environment == "production" {
			baseURL = baseURL + "/antreanrs"
		} else {
			baseURL = baseURL + "/antreanrs_dev"
		}
	}

	// Generate timestamp UTC (detik sejak epoch) dan signature
	// PENTING: Harus UTC, bukan waktu lokal
	timestamp := strconv.FormatInt(time.Now().UTC().Unix(), 10)
	signatureData := consID + "&" + timestamp
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(signatureData))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))

	// Build request
	fullURL := baseURL + "/ref/poli"
	req, _ := http.NewRequest("GET", fullURL, nil)
	req.Header.Set("X-cons-id", consID)
	req.Header.Set("X-timestamp", timestamp)
	req.Header.Set("X-signature", signature)
	req.Header.Set("user_key", userKey)

	// Execute
	client := &http.Client{Timeout: 30 * time.Second}
	startTime := time.Now()
	resp, err := client.Do(req)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":  false,
			"error":    err.Error(),
			"duration": duration,
			"request": gin.H{
				"url":       fullURL,
				"timestamp": timestamp,
				"signature": signature,
			},
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	c.JSON(http.StatusOK, gin.H{
		"success":     resp.StatusCode == 200,
		"status_code": resp.StatusCode,
		"duration":    duration,
		"body":        string(body),
		"request": gin.H{
			"url":            fullURL,
			"cons_id":        consID,
			"timestamp":      timestamp,
			"signature_data": signatureData,
			"signature":      signature,
			"user_key":       userKey,
			"secret_key_len": len(secretKey),
			"secret_key_raw": secretKey, // TEMPORARY - hapus setelah debug
		},
	})
}

// ======================================
// BPJS ANTRIAN ONLINE - REFERENSI
// ======================================

// GetBPJSReferensiPoli mengambil daftar poli dari BPJS
// GET /api/bpjs/referensi/poli
func GetBPJSReferensiPoli(c *gin.Context) {
	client, err := bpjs.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal inisialisasi BPJS client: " + err.Error()})
		return
	}

	polis, err := client.GetReferensiPoli()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data poli: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data poli berhasil diambil",
		"count":   len(polis),
		"data":    polis,
	})
}

// GetBPJSReferensiDokter mengambil daftar dokter dari BPJS
// GET /api/bpjs/referensi/dokter
func GetBPJSReferensiDokter(c *gin.Context) {
	client, err := bpjs.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal inisialisasi BPJS client: " + err.Error()})
		return
	}

	dokters, err := client.GetReferensiDokter()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data dokter: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data dokter berhasil diambil",
		"count":   len(dokters),
		"data":    dokters,
	})
}

// GetBPJSJadwalDokter mengambil jadwal dokter berdasarkan poli dan tanggal
// GET /api/bpjs/referensi/jadwal-dokter?kode_poli=ANA&tanggal=2026-01-21
func GetBPJSJadwalDokter(c *gin.Context) {
	kodePoli := c.Query("kode_poli")
	tanggal := c.Query("tanggal")

	if kodePoli == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter kode_poli wajib diisi"})
		return
	}

	// Default tanggal hari ini jika tidak diisi
	if tanggal == "" {
		tanggal = time.Now().Format("2006-01-02")
	}

	client, err := bpjs.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal inisialisasi BPJS client: " + err.Error()})
		return
	}

	jadwals, err := client.GetJadwalDokter(kodePoli, tanggal)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil jadwal dokter: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Jadwal dokter berhasil diambil",
		"kode_poli": kodePoli,
		"tanggal":   tanggal,
		"count":     len(jadwals),
		"data":      jadwals,
	})
}

// UpdateBPJSJadwalDokter mengirim update jadwal dokter ke BPJS
// POST /api/bpjs/referensi/jadwal-dokter
func UpdateBPJSJadwalDokter(c *gin.Context) {
	var req bpjs.UpdateJadwalDokterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request body tidak valid: " + err.Error()})
		return
	}

	if req.KodePoli == "" || req.KodeDokter == 0 || len(req.Jadwal) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kode_poli, kode_dokter, dan jadwal wajib diisi"})
		return
	}

	client, err := bpjs.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal inisialisasi BPJS client: " + err.Error()})
		return
	}

	if err := client.UpdateJadwalDokter(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update jadwal dokter: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Jadwal dokter berhasil diupdate",
	})
}

// TestBPJSConnection menguji koneksi ke BPJS dengan mengambil referensi poli
// GET /api/bpjs/test-connection
func TestBPJSConnection(c *gin.Context) {
	client, err := bpjs.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Gagal inisialisasi BPJS client: " + err.Error(),
		})
		return
	}

	// Test dengan ambil referensi poli
	startTime := time.Now()
	polis, err := client.GetReferensiPoli()
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":  false,
			"error":    "Gagal koneksi ke BPJS: " + err.Error(),
			"duration": duration,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"message":    "Koneksi ke BPJS berhasil",
		"duration":   duration,
		"poli_count": len(polis),
	})
}

// BPJSAPITesterRequest adalah request body untuk API tester
type BPJSAPITesterRequest struct {
	Method      string `json:"method"`
	Endpoint    string `json:"endpoint"`
	Body        string `json:"body"`
	Environment string `json:"environment"`
}

// BPJSAPITesterResponse adalah response dari API tester
type BPJSAPITesterResponse struct {
	Success  bool                      `json:"success"`
	Request  BPJSAPITesterRequestInfo  `json:"request"`
	Response BPJSAPITesterResponseInfo `json:"response"`
	Error    string                    `json:"error,omitempty"`
	Config   BPJSAPITesterConfig       `json:"config"`
}

type BPJSAPITesterRequestInfo struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

type BPJSAPITesterResponseInfo struct {
	StatusCode int                 `json:"status_code"`
	Headers    map[string][]string `json:"headers"`
	Body       string              `json:"body"`
	DurationMs int64               `json:"duration_ms"`
}

type BPJSAPITesterConfig struct {
	Environment string `json:"environment"`
	BaseURL     string `json:"base_url"`
	ConsID      string `json:"cons_id"`
}

// BPJSAPITester mengirim request ke BPJS API dan mengembalikan detail lengkap
// POST /api/bpjs/api-test
func BPJSAPITester(c *gin.Context) {
	var input BPJSAPITesterRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get BPJS config
	var configs []models.IntegrationConfig
	if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJS).Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil konfigurasi BPJS"})
		return
	}

	configMap := make(map[string]string)
	for _, cfg := range configs {
		configMap[cfg.Key] = cfg.Value
	}

	// Determine environment - use from input if provided, otherwise from config
	environment := input.Environment
	if environment == "" {
		environment = configMap["environment"]
	}
	if environment == "" {
		environment = "development"
	}

	// Pilih base URL sesuai environment
	var baseURL string
	if environment == "production" {
		baseURL = configMap["base_url_prod"]
	} else {
		baseURL = configMap["base_url_dev"]
	}

	// Append service name jika belum ada
	if baseURL != "" && !strings.Contains(baseURL, "/antreanrs") {
		if environment == "production" {
			baseURL = baseURL + "/antreanrs"
		} else {
			baseURL = baseURL + "/antreanrs_dev"
		}
	}

	consID := configMap["cons_id"]
	secretKey := configMap["secret_key"]
	userKey := configMap["user_key"]

	// Generate timestamp dan signature
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	data := consID + "&" + timestamp
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(data))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))

	// Build full URL
	fullURL := baseURL + input.Endpoint

	// Prepare headers
	headers := map[string]string{
		"X-cons-id":    consID,
		"X-timestamp":  timestamp,
		"X-signature":  signature,
		"user_key":     userKey,
		"Content-Type": "application/json",
	}

	// Create HTTP request
	var reqBody io.Reader
	if input.Body != "" {
		reqBody = strings.NewReader(input.Body)
	}

	method := input.Method
	if method == "" {
		method = "GET"
	}

	req, err := http.NewRequest(method, fullURL, reqBody)
	if err != nil {
		c.JSON(http.StatusInternalServerError, BPJSAPITesterResponse{
			Success: false,
			Error:   "Gagal membuat request: " + err.Error(),
			Config: BPJSAPITesterConfig{
				Environment: environment,
				BaseURL:     baseURL,
				ConsID:      consID,
			},
		})
		return
	}

	// Set headers
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	// Execute request
	httpClient := &http.Client{Timeout: 30 * time.Second}
	startTime := time.Now()
	resp, err := httpClient.Do(req)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		c.JSON(http.StatusOK, BPJSAPITesterResponse{
			Success: false,
			Request: BPJSAPITesterRequestInfo{
				Method:  method,
				URL:     fullURL,
				Headers: headers,
				Body:    input.Body,
			},
			Response: BPJSAPITesterResponseInfo{
				StatusCode: 0,
				DurationMs: duration,
			},
			Error: "Request error: " + err.Error(),
			Config: BPJSAPITesterConfig{
				Environment: environment,
				BaseURL:     baseURL,
				ConsID:      consID,
			},
		})
		return
	}
	defer resp.Body.Close()

	// Read response body
	respBody, _ := io.ReadAll(resp.Body)

	// Get response headers
	respHeaders := make(map[string][]string)
	for k, v := range resp.Header {
		respHeaders[k] = v
	}

	// Build response
	result := BPJSAPITesterResponse{
		Success: resp.StatusCode >= 200 && resp.StatusCode < 300,
		Request: BPJSAPITesterRequestInfo{
			Method:  method,
			URL:     fullURL,
			Headers: headers,
			Body:    input.Body,
		},
		Response: BPJSAPITesterResponseInfo{
			StatusCode: resp.StatusCode,
			Headers:    respHeaders,
			Body:       string(respBody),
			DurationMs: duration,
		},
		Config: BPJSAPITesterConfig{
			Environment: environment,
			BaseURL:     baseURL,
			ConsID:      consID,
		},
	}

	if resp.StatusCode >= 400 {
		result.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}

	c.JSON(http.StatusOK, result)
}
