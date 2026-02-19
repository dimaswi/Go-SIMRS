package bpjs

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"
)

// logICareSync logs I-Care API request/response to integration_sync_logs
func logICareSync(method, endpoint, request, response string, statusCode int, durationMs int, errorMsg string) {
	now := time.Now()
	responseAt := now
	status := "success"
	if errorMsg != "" {
		status = "failed"
	}

	log := models.IntegrationSyncLog{
		Integration:  models.IntegrationTypeBPJSICare,
		Endpoint:     endpoint,
		Method:       method,
		RequestBody:  request,
		ResponseCode: statusCode,
		ResponseBody: response,
		Status:       status,
		ErrorMessage: errorMsg,
		RequestAt:    now.Add(-time.Duration(durationMs) * time.Millisecond),
		ResponseAt:   &responseAt,
		DurationMs:   durationMs,
	}
	database.DB.Create(&log)

	fmt.Printf("[I-Care %s] %s %s - %dms - Status: %d\n", strings.ToUpper(status), method, endpoint, durationMs, statusCode)
}

// ICareClient adalah client untuk BPJS I-Care API
type ICareClient struct {
	ConsID     string
	SecretKey  string
	UserKey    string
	BaseURL    string
	HTTPClient *http.Client
}

// ICareValidateRequest adalah request body untuk validate I-Care
type ICareValidateRequest struct {
	Param      string `json:"param"`      // Nomor Kartu BPJS
	KodeDokter int    `json:"kodedokter"` // Kode Dokter BPJS (integer)
}

// ICareValidateResponse adalah response dari validate I-Care
type ICareValidateResponse struct {
	URL string `json:"url"`
}

// NewICareClient membuat I-Care client baru dari database config
func NewICareClient() (*ICareClient, error) {
	var configs []models.IntegrationConfig

	// Ambil config khusus I-Care
	if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSICare).Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("gagal load config I-Care: %w", err)
	}

	// Fallback ke config VClaim jika I-Care belum diset
	if len(configs) == 0 {
		if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSVClaim).Find(&configs).Error; err != nil {
			return nil, fmt.Errorf("gagal load config BPJS: %w", err)
		}
	}

	// Fallback ke config Antrian jika VClaim juga belum diset
	if len(configs) == 0 {
		if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSAntrian).Find(&configs).Error; err != nil {
			return nil, fmt.Errorf("gagal load config BPJS: %w", err)
		}
	}

	configMap := make(map[string]string)
	for _, c := range configs {
		configMap[c.Key] = c.Value
	}

	// Determine environment
	environment := configMap["environment"]
	if environment == "" {
		environment = "development"
	}

	// Pilih base URL sesuai environment
	// I-Care: dev=https://apijkn-dev.bpjs-kesehatan.go.id/ihs_dev/api/rs, prod=https://apijkn.bpjs-kesehatan.go.id/wsihs/api/rs
	var baseURL string
	if environment == "production" {
		baseURL = configMap["base_url_prod"]
	} else {
		baseURL = configMap["base_url_dev"]
	}
	if baseURL != "" {
		baseURL = strings.TrimRight(baseURL, "/")
	}

	fmt.Printf("[I-Care Client] Environment=%s, BaseURL=%s\n", environment, baseURL)

	// Validasi config
	if configMap["cons_id"] == "" {
		return nil, fmt.Errorf("BPJS cons_id tidak ditemukan di konfigurasi")
	}
	if configMap["secret_key"] == "" {
		return nil, fmt.Errorf("BPJS secret_key tidak ditemukan di konfigurasi")
	}
	if configMap["user_key"] == "" {
		return nil, fmt.Errorf("BPJS user_key tidak ditemukan di konfigurasi")
	}
	if baseURL == "" {
		return nil, fmt.Errorf("BPJS base_url tidak ditemukan di konfigurasi")
	}

	return &ICareClient{
		ConsID:    configMap["cons_id"],
		SecretKey: configMap["secret_key"],
		UserKey:   configMap["user_key"],
		BaseURL:   baseURL,
		HTTPClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}, nil
}

// Validate memanggil endpoint I-Care validate dan mengembalikan URL
func (c *ICareClient) Validate(nomorKartu string, kodeDokter int) (string, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	// Generate signature (same as VClaim)
	signature := c.generateSignature(timestamp)

	// Build request body
	reqBody := ICareValidateRequest{
		Param:      nomorKartu,
		KodeDokter: kodeDokter,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	fullURL := c.BaseURL + "/validate"
	req, err := http.NewRequest("POST", fullURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	// Set headers - I-Care pakai X-timestamp (huruf t kecil, beda dengan Aplicare)
	req.Header.Set("X-cons-id", c.ConsID)
	req.Header.Set("X-timestamp", timestamp)
	req.Header.Set("X-signature", signature)
	req.Header.Set("user_key", c.UserKey)
	req.Header.Set("Content-Type", "application/json") // I-Care requires JSON, not form-urlencoded!
	req.Header.Set("Accept", "application/Json; charset=utf-8")

	fmt.Printf("[I-Care Request] POST %s, Body=%s\n", fullURL, string(jsonData))

	startTime := time.Now()
	resp, err := c.HTTPClient.Do(req)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		logICareSync("POST", fullURL, string(jsonData), "", http.StatusInternalServerError, int(duration), "Request failed: "+err.Error())
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		logICareSync("POST", fullURL, string(jsonData), "", resp.StatusCode, int(duration), "Read response error: "+err.Error())
		return "", fmt.Errorf("read response: %w", err)
	}

	fmt.Printf("[I-Care Response] Status=%d, Body=%s\n", resp.StatusCode, string(respBody))

	if resp.StatusCode >= 400 {
		logICareSync("POST", fullURL, string(jsonData), string(respBody), resp.StatusCode, int(duration), fmt.Sprintf("HTTP %d", resp.StatusCode))
		return "", fmt.Errorf("server I-Care mengembalikan status: %d", resp.StatusCode)
	}

	// Parse response - same structure as VClaim
	var icareResp struct {
		MetaData struct {
			Code    interface{} `json:"code"`
			Message string      `json:"message"`
		} `json:"metaData"`
		Response interface{} `json:"response"`
	}

	if err := json.Unmarshal(respBody, &icareResp); err != nil {
		logICareSync("POST", fullURL, string(jsonData), string(respBody), resp.StatusCode, int(duration), "JSON parse error: "+err.Error())
		return "", fmt.Errorf("parse response: %w", err)
	}

	// Check metadata code
	code := 0
	switch v := icareResp.MetaData.Code.(type) {
	case float64:
		code = int(v)
	case string:
		code, _ = strconv.Atoi(v)
	case int:
		code = v
	}

	if code != 200 {
		logICareSync("POST", fullURL, string(jsonData), string(respBody), code, int(duration), "I-Care error: "+icareResp.MetaData.Message)
		return "", fmt.Errorf("I-Care error [%d]: %s", code, icareResp.MetaData.Message)
	}

	// Response bisa encrypted (string) atau plain object
	switch resp := icareResp.Response.(type) {
	case string:
		// Encrypted response - decrypt dulu
		decrypted, err := c.decryptResponse(resp, timestamp)
		if err != nil {
			logICareSync("POST", fullURL, string(jsonData), string(respBody), code, int(duration), "Decryption error: "+err.Error())
			return "", fmt.Errorf("decrypt response: %w", err)
		}

		// Parse decrypted JSON untuk ambil URL
		var validateResp ICareValidateResponse
		if err := json.Unmarshal(decrypted, &validateResp); err != nil {
			logICareSync("POST", fullURL, string(jsonData), string(decrypted), code, int(duration), "Parse decrypted error: "+err.Error())
			return "", fmt.Errorf("parse decrypted response: %w, raw: %s", err, string(decrypted))
		}
		logICareSync("POST", fullURL, string(jsonData), string(decrypted), code, int(duration), "")
		return validateResp.URL, nil

	case map[string]interface{}:
		// Plain object response
		if url, ok := resp["url"].(string); ok {
			logICareSync("POST", fullURL, string(jsonData), string(respBody), code, int(duration), "")
			return url, nil
		}
		logICareSync("POST", fullURL, string(jsonData), string(respBody), code, int(duration), "Response tidak mengandung URL")
		return "", fmt.Errorf("response tidak mengandung URL: %v", resp)

	default:
		logICareSync("POST", fullURL, string(jsonData), string(respBody), code, int(duration), fmt.Sprintf("Format response tidak dikenali: %T", icareResp.Response))
		return "", fmt.Errorf("format response tidak dikenali: %T", icareResp.Response)
	}
}

// generateSignature membuat HMAC-SHA256 signature untuk I-Care (sama dengan VClaim)
func (c *ICareClient) generateSignature(timestamp string) string {
	vclient := &VClaimClient{
		ConsID:    c.ConsID,
		SecretKey: c.SecretKey,
	}
	return vclient.GenerateSignature(timestamp)
}

// decryptResponse mendekripsi response dari I-Care (sama dengan VClaim)
func (c *ICareClient) decryptResponse(encryptedData string, timestamp string) ([]byte, error) {
	vclient := &VClaimClient{
		ConsID:    c.ConsID,
		SecretKey: c.SecretKey,
	}
	return vclient.DecryptResponse(encryptedData, timestamp)
}
