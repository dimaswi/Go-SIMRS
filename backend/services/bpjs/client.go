package bpjs

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
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

type Client struct {
	ConsID     string
	SecretKey  string
	UserKey    string
	BaseURL    string
	HTTPClient *http.Client
}

type BPJSResponse struct {
	MetaData struct {
		Code    interface{} `json:"code"` // bisa int atau string
		Message string      `json:"message"`
	} `json:"metadata"`
	Response interface{} `json:"response"`
}

// NewClient membuat BPJS client baru dari database config (table integration_configs)
func NewClient() (*Client, error) {
	var configs []models.IntegrationConfig
	if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJS).Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("gagal load config BPJS: %w", err)
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
	var baseURL string
	if environment == "production" {
		baseURL = configMap["base_url_prod"]
	} else {
		baseURL = configMap["base_url_dev"]
	}

	// Backward compatibility: jika base URL tidak include service name, tambahkan otomatis
	if baseURL != "" && !strings.Contains(baseURL, "/antreanrs") {
		if environment == "production" {
			baseURL = baseURL + "/antreanrs"
		} else {
			baseURL = baseURL + "/antreanrs_dev"
		}
	}

	fmt.Printf("[BPJS Client] Environment=%s, BaseURL=%s\n", environment, baseURL)

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

	return &Client{
		ConsID:    configMap["cons_id"],
		SecretKey: configMap["secret_key"],
		UserKey:   configMap["user_key"],
		BaseURL:   baseURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// GenerateSignature membuat signature untuk BPJS Antrian RS
// Rumus: Base64(HMAC-SHA256(cons_id + "&" + timestamp, secret_key))
// Dimana HMAC key = secret_key (langsung, bukan di-hash)
func (c *Client) GenerateSignature(timestamp string) string {
	// Data yang di-sign: cons_id&timestamp
	data := c.ConsID + "&" + timestamp

	// HMAC-SHA256 dengan secret_key sebagai key
	h := hmac.New(sha256.New, []byte(c.SecretKey))
	h.Write([]byte(data))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))

	// Debug log
	fmt.Printf("[BPJS Signature] Data=%q, Signature=%s\n", data, signature)

	return signature
}

// generateDecryptionKey membuat key untuk dekripsi response
func (c *Client) generateDecryptionKey(timestamp string) []byte {
	key := c.ConsID + c.SecretKey + timestamp
	h := sha256.New()
	h.Write([]byte(key))
	return h.Sum(nil)
}

// DecryptResponse mendekripsi response AES-256-CBC dari BPJS
func (c *Client) DecryptResponse(encryptedData string, timestamp string) ([]byte, error) {
	// Decode base64
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return nil, fmt.Errorf("base64 decode error: %w", err)
	}

	// Generate key
	key := c.generateDecryptionKey(timestamp)

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("cipher error: %w", err)
	}

	// Check length
	if len(ciphertext) < aes.BlockSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	// Extract IV (first block)
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]

	// Decrypt
	mode := cipher.NewCBCDecrypter(block, iv)
	mode.CryptBlocks(ciphertext, ciphertext)

	// Remove PKCS7 padding
	return removePKCS7Padding(ciphertext), nil
}

// removePKCS7Padding removes PKCS7 padding
func removePKCS7Padding(data []byte) []byte {
	length := len(data)
	if length == 0 {
		return data
	}
	padding := int(data[length-1])
	if padding > length {
		return data
	}
	return data[:length-padding]
}

// Request melakukan HTTP request ke BPJS API
func (c *Client) Request(method, endpoint string, body interface{}) ([]byte, int, error) {
	// Generate timestamp
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	// Generate signature
	signature := c.GenerateSignature(timestamp)

	// Prepare request body
	var reqBody io.Reader
	var reqBodyStr string
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, 0, fmt.Errorf("marshal request: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
		reqBodyStr = string(jsonData)
	}

	// Create request - full URL
	fullURL := c.BaseURL + endpoint
	req, err := http.NewRequest(method, fullURL, reqBody)
	if err != nil {
		return nil, 0, fmt.Errorf("create request: %w", err)
	}

	// Set headers sesuai dokumentasi BPJS Antrian RS
	req.Header.Set("X-cons-id", c.ConsID)
	req.Header.Set("X-timestamp", timestamp)
	req.Header.Set("X-signature", signature)
	req.Header.Set("user_key", c.UserKey)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json")

	// Log request with full URL
	fmt.Printf("[BPJS Request] %s %s\n", method, fullURL)
	fmt.Printf("[BPJS Headers] X-cons-id=%s, X-timestamp=%s, user_key=%s\n", c.ConsID, timestamp, c.UserKey[:min(8, len(c.UserKey))]+"...")

	// Execute request
	startTime := time.Now()
	resp, err := c.HTTPClient.Do(req)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		logSync(method, fullURL, reqBodyStr, "", http.StatusInternalServerError, int(duration), "Request failed: "+err.Error())
		return nil, 0, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		logSync(method, fullURL, reqBodyStr, "", resp.StatusCode, int(duration), "Read response error: "+err.Error())
		return nil, resp.StatusCode, fmt.Errorf("read response: %w", err)
	}

	// Log raw response for debugging
	fmt.Printf("[BPJS Response] Status=%d, ContentLength=%d, BodyLen=%d, Body=%q\n", resp.StatusCode, resp.ContentLength, len(respBody), string(respBody))
	fmt.Printf("[BPJS Response Headers] %v\n", resp.Header)

	// Log HTTP error (4xx, 5xx) before parsing
	if resp.StatusCode >= 400 {
		errMsg := fmt.Sprintf("HTTP %d", resp.StatusCode)
		// Serialize all headers for debugging
		headersJSON, _ := json.Marshal(resp.Header)
		// Combine body + headers for full debug info
		responseInfo := fmt.Sprintf("Body: %s\nHeaders: %s", strings.TrimSpace(string(respBody)), string(headersJSON))
		logSync(method, fullURL, reqBodyStr, responseInfo, resp.StatusCode, int(duration), errMsg)
		return nil, resp.StatusCode, fmt.Errorf("server BPJS mengembalikan status: %d", resp.StatusCode)
	}

	// Parse untuk ambil encrypted response
	var bpjsResp BPJSResponse
	if err := json.Unmarshal(respBody, &bpjsResp); err != nil {
		logSync(method, endpoint, reqBodyStr, string(respBody), resp.StatusCode, int(duration), "JSON parse error: "+err.Error())
		return respBody, resp.StatusCode, nil // Return raw jika gagal parse
	}

	// Check metadata code
	code := 0
	switch v := bpjsResp.MetaData.Code.(type) {
	case float64:
		code = int(v)
	case string:
		code, _ = strconv.Atoi(v)
	case int:
		code = v
	}

	// Jika bukan 200/1, return error
	if code != 200 && code != 1 {
		errMsg := bpjsResp.MetaData.Message
		logSync(method, fullURL, reqBodyStr, string(respBody), resp.StatusCode, int(duration), "BPJS error: "+errMsg)
		return nil, resp.StatusCode, fmt.Errorf("BPJS error [%d]: %s", code, errMsg)
	}

	// Cek apakah response berupa string (encrypted)
	if respStr, ok := bpjsResp.Response.(string); ok && len(respStr) > 0 {
		// Response encrypted, decrypt
		decrypted, err := c.DecryptResponse(respStr, timestamp)
		if err != nil {
			logSync(method, fullURL, reqBodyStr, string(respBody), resp.StatusCode, int(duration), "Decryption error: "+err.Error())
			return nil, resp.StatusCode, fmt.Errorf("decrypt response: %w", err)
		}

		logSync(method, fullURL, reqBodyStr, string(decrypted), resp.StatusCode, int(duration), "")
		return decrypted, resp.StatusCode, nil
	}

	// Response tidak encrypted (object biasa)
	responseJSON, _ := json.Marshal(bpjsResp.Response)
	logSync(method, fullURL, reqBodyStr, string(responseJSON), resp.StatusCode, int(duration), "")

	return responseJSON, resp.StatusCode, nil
}

func logSync(method, endpoint, request, response string, statusCode int, durationMs int, errorMsg string) {
	now := time.Now()
	responseAt := now

	status := "success"
	if errorMsg != "" {
		status = "failed"
	}

	log := models.IntegrationSyncLog{
		Integration:  models.IntegrationTypeBPJS,
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

	fmt.Printf("[BPJS %s] %s %s - %dms - Status: %d\n", strings.ToUpper(status), method, endpoint, durationMs, statusCode)
}
