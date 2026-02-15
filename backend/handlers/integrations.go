package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"starter/backend/services/bpjs"
	eklaimSvcPkg "starter/backend/services/eklaim"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// IntegrationConfigResponse represents config for frontend
type IntegrationConfigResponse struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
	HasValue    bool   `json:"has_value"`
	IsSecret    bool   `json:"is_secret"`
}

// GetIntegrationConfig returns configuration for a specific integration
func GetIntegrationConfig(c *gin.Context) {
	integrationType := c.Param("type")
	if integrationType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Integration type required"})
		return
	}

	var configs []models.IntegrationConfig
	if err := database.DB.Where("integration = ?", integrationType).Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch config"})
		return
	}

	// Convert to map for easier frontend consumption
	result := make(map[string]IntegrationConfigResponse)
	for _, cfg := range configs {
		value := cfg.Value // Langsung ambil nilai TANPA dekripsi
		hasValue := value != ""

		result[cfg.Key] = IntegrationConfigResponse{
			Key:         cfg.Key,
			Value:       value,
			Description: cfg.Description,
			HasValue:    hasValue,
			IsSecret:    cfg.IsSecret,
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// UpdateIntegrationConfig updates configuration for a specific integration
func UpdateIntegrationConfig(c *gin.Context) {
	integrationType := c.Param("type")
	if integrationType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Integration type required"})
		return
	}

	var input map[string]string
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get existing configs to check if they need encryption
	var existingConfigs []models.IntegrationConfig
	database.DB.Where("integration = ?", integrationType).Find(&existingConfigs)

	configMap := make(map[string]models.IntegrationConfig)
	for _, cfg := range existingConfigs {
		configMap[cfg.Key] = cfg
	}

	// Update each config - TANPA ENKRIPSI, simpan plain text
	for key, value := range input {
		_, exists := configMap[key]

		if exists {
			// Update existing
			database.DB.Model(&models.IntegrationConfig{}).
				Where("integration = ? AND key = ?", integrationType, key).
				Update("value", value)
		} else {
			// Create new - TANPA enkripsi
			isSecret := isSecretKey(key)

			newCfg := models.IntegrationConfig{
				Integration: models.IntegrationType(integrationType),
				Key:         key,
				Value:       value,
				Description: "",
				IsEncrypted: false,
				IsSecret:    isSecret,
			}
			database.DB.Create(&newCfg)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Configuration updated successfully"})
}

// isSecretKey checks if a key should be treated as secret
func isSecretKey(key string) bool {
	secretKeys := []string{"secret", "key", "password", "token", "credential"}
	for _, sk := range secretKeys {
		if contains(key, sk) {
			return true
		}
	}
	return false
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// InitIntegrationConfig initializes default config for an integration
func InitIntegrationConfig(c *gin.Context) {
	integrationType := c.Param("type")
	if integrationType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Integration type required"})
		return
	}

	configKeys := models.GetIntegrationConfigKeys(models.IntegrationType(integrationType))
	if configKeys == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown integration type"})
		return
	}

	for _, cfg := range configKeys {
		var existing models.IntegrationConfig
		result := database.DB.Where("integration = ? AND key = ?", integrationType, cfg.Key).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			newCfg := models.IntegrationConfig{
				Integration: cfg.Integration,
				Key:         cfg.Key,
				Value:       cfg.Default,
				Description: cfg.Description,
				IsEncrypted: cfg.IsEncrypted,
				IsSecret:    cfg.IsSecret,
			}
			database.DB.Create(&newCfg)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Configuration initialized"})
}

// TestIntegrationConnection tests connection to an external system
func TestIntegrationConnection(c *gin.Context) {
	integrationType := c.Param("type")
	if integrationType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Integration type required"})
		return
	}

	startTime := time.Now()
	integrationTypeEnum := models.IntegrationType(integrationType)

	// Check if it's a BPJS type
	if models.IsBPJSType(integrationTypeEnum) {
		testBPJSConnectionForType(c, startTime, integrationTypeEnum)
		return
	}

	switch integrationTypeEnum {
	case models.IntegrationTypeSatuSehat:
		testSatuSehatConnection(c, startTime)
	case models.IntegrationTypeEKlaim:
		testEKlaimConnection(c, startTime)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Unknown integration type",
		})
	}
}

func testBPJSConnectionForType(c *gin.Context, startTime time.Time, integrationType models.IntegrationType) {
	// For VClaim, use the VClaim client and /referensi/propinsi endpoint
	if integrationType == models.IntegrationTypeBPJSVClaim {
		testVClaimConnection(c, startTime)
		return
	}

	// Get config values for specific BPJS service type
	var configs []models.IntegrationConfig
	database.DB.Where("integration = ?", integrationType).Find(&configs)

	configMap := make(map[string]string)
	for _, cfg := range configs {
		// Langsung ambil nilai TANPA dekripsi
		configMap[cfg.Key] = cfg.Value
	}

	// Check required fields
	consID := configMap["cons_id"]
	secretKey := configMap["secret_key"]
	userKey := configMap["user_key"]
	environment := configMap["environment"]

	serviceName := models.GetBPJSServiceName(integrationType)

	if consID == "" || secretKey == "" || userKey == "" {
		c.JSON(http.StatusOK, gin.H{
			"success":     false,
			"error":       "Kredensial " + serviceName + " belum lengkap. Silakan isi Consumer ID, Secret Key, dan User Key.",
			"environment": environment,
		})
		return
	}

	// Get base URL based on environment
	baseURL := configMap["base_url_dev"]
	if environment == "production" {
		baseURL = configMap["base_url_prod"]
	}

	// Backward compatibility: jika base URL tidak include service name, tambahkan otomatis
	if baseURL != "" && !strings.Contains(baseURL, "/antreanrs") {
		if environment == "production" {
			baseURL = baseURL + "/antreanrs"
		} else {
			baseURL = baseURL + "/antreanrs_dev"
		}
	}

	fmt.Printf("[BPJS Test %s] Environment=%s, BaseURL=%s\n", serviceName, environment, baseURL)

	// Generate timestamp for signature
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	// Create signature (consID + secretKey + timestamp)
	signatureData := consID + "&" + timestamp

	// Create HMAC-SHA256 signature
	signature := createHMACSHA256(signatureData, secretKey)

	// Make test request to BPJS API (referensi poli endpoint as simple test)
	client := &http.Client{Timeout: 30 * time.Second}
	testURL := baseURL + "/ref/poli"

	req, err := http.NewRequest("GET", testURL, nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":     false,
			"error":       "Gagal membuat request: " + err.Error(),
			"environment": environment,
		})
		return
	}

	// Set headers
	req.Header.Set("X-cons-id", consID)
	req.Header.Set("X-timestamp", timestamp)
	req.Header.Set("X-signature", signature)
	req.Header.Set("user_key", userKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	duration := time.Since(startTime)

	// Log the request
	logEntry := models.IntegrationSyncLog{
		Integration: integrationType,
		Endpoint:    testURL,
		Method:      "GET",
		RequestBody: "",
		Status:      "success",
		RequestAt:   startTime,
		DurationMs:  int(duration.Milliseconds()),
	}

	if err != nil {
		logEntry.Status = "failed"
		logEntry.ErrorMessage = err.Error()
		database.DB.Create(&logEntry)

		c.JSON(http.StatusOK, gin.H{
			"success":       false,
			"error":         "Gagal terhubung ke server BPJS: " + err.Error(),
			"environment":   environment,
			"response_time": duration.String(),
		})
		return
	}
	defer resp.Body.Close()

	now := time.Now()
	logEntry.ResponseAt = &now
	logEntry.ResponseCode = resp.StatusCode

	if resp.StatusCode == 200 {
		logEntry.Status = "success"
		database.DB.Create(&logEntry)

		c.JSON(http.StatusOK, gin.H{
			"success":       true,
			"message":       "Koneksi ke BPJS " + serviceName + " berhasil!",
			"environment":   environment,
			"response_time": duration.String(),
		})
	} else {
		logEntry.Status = "failed"
		logEntry.ErrorMessage = "HTTP " + strconv.Itoa(resp.StatusCode)
		database.DB.Create(&logEntry)

		c.JSON(http.StatusOK, gin.H{
			"success":       false,
			"error":         "Server BPJS mengembalikan status: " + strconv.Itoa(resp.StatusCode),
			"environment":   environment,
			"response_time": duration.String(),
		})
	}
}

// testVClaimConnection tests VClaim connectivity using /referensi/propinsi endpoint
func testVClaimConnection(c *gin.Context, startTime time.Time) {
	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Gagal membuat VClaim client: " + err.Error(),
		})
		return
	}

	propinsi, err := client.GetReferensiPropinsi()
	duration := time.Since(startTime)

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":       false,
			"error":         "Gagal terhubung ke VClaim: " + err.Error(),
			"response_time": duration.String(),
			"test_endpoint": "/referensi/propinsi",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"message":        fmt.Sprintf("Koneksi ke BPJS VClaim berhasil! Ditemukan %d propinsi.", len(propinsi)),
		"response_time":  duration.String(),
		"test_endpoint":  "/referensi/propinsi",
		"propinsi_count": len(propinsi),
	})
}

func testBPJSConnection(c *gin.Context, startTime time.Time) {
	// Legacy function - uses shared BPJS config
	testBPJSConnectionForType(c, startTime, models.IntegrationTypeBPJS)
}

func testSatuSehatConnection(c *gin.Context, startTime time.Time) {
	// Use the dedicated SatuSehat test function
	TestSatuSehatConnection(c)
}

func testEKlaimConnection(c *gin.Context, startTime time.Time) {
	eklaimSvc := getEKlaimService()
	if eklaimSvc == nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Gagal membuat E-Klaim client. Periksa konfigurasi.",
		})
		return
	}

	err := eklaimSvc.Ping()
	duration := time.Since(startTime)

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":       false,
			"error":         "Gagal terhubung ke server E-Klaim: " + err.Error(),
			"base_url":      eklaimSvc.BaseURL,
			"response_time": duration.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"message":       "Koneksi ke server E-Klaim berhasil!",
		"base_url":      eklaimSvc.BaseURL,
		"response_time": duration.String(),
	})
}

// getEKlaimService creates an E-Klaim client from integration configs
func getEKlaimService() *eklaimSvcPkg.Client {
	client, err := eklaimSvcPkg.NewClient()
	if err != nil {
		return nil
	}
	return client
}

// createHMACSHA256 creates HMAC-SHA256 signature
func createHMACSHA256(data, key string) string {
	h := hmac.New(sha256.New, []byte(key))
	h.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// GetIntegrationLogs returns sync logs for an integration
func GetIntegrationLogs(c *gin.Context) {
	integrationType := c.Param("type")

	var logs []models.IntegrationSyncLog
	query := database.DB.Order("created_at DESC").Limit(100)

	if integrationType != "" {
		query = query.Where("integration = ?", integrationType)
	}

	// Filter by today by default
	today := time.Now().Truncate(24 * time.Hour)
	query = query.Where("request_at >= ?", today)

	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// GetIntegrationStats returns statistics for integration sync
func GetIntegrationStats(c *gin.Context) {
	integrationType := c.Param("type")

	today := time.Now().Truncate(24 * time.Hour)

	var totalRequests, successRequests, failedRequests int64
	var avgDuration float64

	baseQuery := database.DB.Model(&models.IntegrationSyncLog{}).Where("request_at >= ?", today)

	if integrationType != "" {
		baseQuery = baseQuery.Where("integration = ?", integrationType)
	}

	baseQuery.Count(&totalRequests)
	baseQuery.Where("status = ?", "success").Count(&successRequests)
	baseQuery.Where("status = ?", "failed").Count(&failedRequests)

	var avgResult struct {
		AvgDuration float64
	}
	database.DB.Model(&models.IntegrationSyncLog{}).
		Select("AVG(duration_ms) as avg_duration").
		Where("request_at >= ?", today).
		Where("integration = ?", integrationType).
		Scan(&avgResult)
	avgDuration = avgResult.AvgDuration

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"total_requests":   totalRequests,
			"success_requests": successRequests,
			"failed_requests":  failedRequests,
			"avg_duration_ms":  avgDuration,
		},
	})
}

// GetAllIntegrations returns list of available integrations with their status
func GetAllIntegrations(c *gin.Context) {
	integrations := []gin.H{
		{
			"id":          "bpjs-antrian",
			"name":        "Antrian Online",
			"description": "Sistem antrian online JKN Mobile",
			"category":    "BPJS",
			"available":   true,
		},
		{
			"id":          "bpjs-vclaim",
			"name":        "VClaim",
			"description": "Verifikasi klaim & SEP BPJS",
			"category":    "BPJS",
			"available":   true,
		},
		{
			"id":          "bpjs-icare",
			"name":        "I-Care",
			"description": "Integrasi data primer BPJS",
			"category":    "BPJS",
			"available":   true,
		},
		{
			"id":          "bpjs-apotek",
			"name":        "Apotek Online",
			"description": "Sistem apotek online BPJS",
			"category":    "BPJS",
			"available":   true,
		},
		{
			"id":          "bpjs-rme",
			"name":        "RME BPJS",
			"description": "Rekam Medis Elektronik BPJS",
			"category":    "BPJS",
			"available":   true,
		},
		{
			"id":          "satusehat",
			"name":        "SatuSehat",
			"description": "Integrasi platform SatuSehat Kemenkes",
			"category":    "Kemenkes",
			"available":   true,
		},
		{
			"id":          "eklaim",
			"name":        "E-Klaim",
			"description": "E-Klaim Local Server (INA-CBG/iDRG)",
			"category":    "BPJS",
			"available":   true,
		},
	}

	// Check if each integration is configured (has cons_id/client_id AND secret_key/client_secret filled)
	for i, integration := range integrations {
		var count int64
		integrationID := integration["id"].(string)

		// Check if required credentials are configured
		if models.IsBPJSType(models.IntegrationType(integrationID)) {
			// For BPJS: check cons_id, secret_key, and user_key
			database.DB.Model(&models.IntegrationConfig{}).
				Where("integration = ? AND key IN (?, ?, ?) AND value != ''", integrationID, "cons_id", "secret_key", "user_key").
				Count(&count)
			integrations[i]["configured"] = count >= 3
		} else if integrationID == "satusehat" {
			// For SatuSehat: check client_id and client_secret
			database.DB.Model(&models.IntegrationConfig{}).
				Where("integration = ? AND key IN (?, ?) AND value != ''", integrationID, "client_id", "client_secret").
				Count(&count)
			integrations[i]["configured"] = count >= 2
		} else if integrationID == "eklaim" {
			// For E-Klaim: check eklaim_local_url and eklaim_secret_key
			database.DB.Model(&models.IntegrationConfig{}).
				Where("integration = ? AND key IN (?, ?) AND value != ''", integrationID, "eklaim_local_url", "eklaim_secret_key").
				Count(&count)
			integrations[i]["configured"] = count >= 2
		} else {
			database.DB.Model(&models.IntegrationConfig{}).
				Where("integration = ? AND value != ''", integrationID).
				Count(&count)
			integrations[i]["configured"] = count > 0
		}

		// Get environment setting
		var envConfig models.IntegrationConfig
		if err := database.DB.Where("integration = ? AND key = ?", integrationID, "environment").First(&envConfig).Error; err == nil {
			integrations[i]["environment"] = envConfig.Value
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": integrations})
}

// GetAllSyncLogs returns sync logs for all or specific integration
func GetAllSyncLogs(c *gin.Context) {
	integration := c.Query("integration")
	limitStr := c.DefaultQuery("limit", "100")
	limit := 100
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 500 {
		limit = l
	}

	var logs []models.IntegrationSyncLog
	query := database.DB.Order("request_at DESC, created_at DESC").Limit(limit)

	if integration != "" {
		query = query.Where("integration = ?", integration)
	}

	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}
