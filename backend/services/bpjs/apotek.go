package bpjs

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

type ApotekClient struct {
	ConsID     string
	SecretKey  string
	UserKey    string
	BaseURL    string
	HTTPClient *http.Client
}

type apotekMetaData struct {
	Code    interface{} `json:"code"`
	Message string      `json:"message"`
}

type apotekResponse struct {
	MetaData apotekMetaData `json:"metaData"`
	Metadata apotekMetaData `json:"metadata"`
	Response interface{}    `json:"response"`
}

func NewApotekClient() (*ApotekClient, error) {
	var configs []models.IntegrationConfig

	if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSApotek).Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("gagal load config Apotek: %w", err)
	}

	if len(configs) == 0 {
		if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSVClaim).Find(&configs).Error; err != nil {
			return nil, fmt.Errorf("gagal load config BPJS: %w", err)
		}
	}

	if len(configs) == 0 {
		if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSAntrian).Find(&configs).Error; err != nil {
			return nil, fmt.Errorf("gagal load config BPJS: %w", err)
		}
	}

	if len(configs) == 0 {
		if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJS).Find(&configs).Error; err != nil {
			return nil, fmt.Errorf("gagal load config BPJS: %w", err)
		}
	}

	configMap := make(map[string]string)
	for _, c := range configs {
		configMap[c.Key] = c.Value
	}

	environment := configMap["environment"]
	if environment == "" {
		environment = "development"
	}

	baseURL := configMap["base_url_dev"]
	if environment == "production" {
		baseURL = configMap["base_url_prod"]
	}

	baseURL = strings.TrimRight(baseURL, "/")
	if baseURL != "" && !strings.Contains(baseURL, "/apotek-rest") {
		if environment == "production" {
			baseURL += "/apotek-rest"
		} else {
			baseURL += "/apotek-rest-dev"
		}
	}

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

	return &ApotekClient{
		ConsID:    configMap["cons_id"],
		SecretKey: configMap["secret_key"],
		UserKey:   configMap["user_key"],
		BaseURL:   baseURL,
		HTTPClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}, nil
}

func (c *ApotekClient) asVClaimClient() *VClaimClient {
	return &VClaimClient{
		ConsID:    c.ConsID,
		SecretKey: c.SecretKey,
		UserKey:   c.UserKey,
		BaseURL:   c.BaseURL,
	}
}

// Use exact VClaim signature function for Apotek headers to keep BPJS signing behavior consistent.
func (c *ApotekClient) generateSignature(timestamp string) string {
	return c.asVClaimClient().GenerateSignature(timestamp)
}

// Use exact VClaim decryption function for Apotek responses.
func (c *ApotekClient) decryptResponse(encryptedData string, timestamp string) ([]byte, error) {
	return c.asVClaimClient().DecryptResponse(encryptedData, timestamp)
}

func (c *ApotekClient) request(method, endpoint string, body interface{}) (interface{}, int, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := c.generateSignature(timestamp)

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

	fullURL := strings.TrimRight(c.BaseURL, "/") + endpoint
	req, err := http.NewRequest(method, fullURL, reqBody)
	if err != nil {
		return nil, 0, fmt.Errorf("create request: %w", err)
	}

	// Keep header generation aligned with VClaim implementation.
	req.Header.Set("X-cons-id", c.ConsID)
	req.Header.Set("X-timestamp", timestamp)
	req.Header.Set("X-signature", signature)
	req.Header.Set("user_key", c.UserKey)
	if method == "POST" || method == "PUT" || method == "DELETE" {
		req.Header.Set("Content-Type", "Application/x-www-form-urlencoded")
	} else {
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
	}
	req.Header.Set("Accept", "application/json")

	fmt.Printf("[Apotek Request] %s %s\n", method, fullURL)

	startTime := time.Now()
	resp, err := c.HTTPClient.Do(req)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		logApotekSync(method, fullURL, reqBodyStr, "", http.StatusInternalServerError, int(duration), "Request failed: "+err.Error())
		return nil, 0, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		logApotekSync(method, fullURL, reqBodyStr, "", resp.StatusCode, int(duration), "Read response error: "+err.Error())
		return nil, resp.StatusCode, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		errorBody := strings.TrimSpace(string(respBody))
		logApotekSync(method, fullURL, reqBodyStr, errorBody, resp.StatusCode, int(duration), fmt.Sprintf("HTTP %d", resp.StatusCode))
		if errorBody != "" {
			return nil, resp.StatusCode, fmt.Errorf("server Apotek BPJS mengembalikan status: %d - %s", resp.StatusCode, errorBody)
		}
		return nil, resp.StatusCode, fmt.Errorf("server Apotek BPJS mengembalikan status: %d", resp.StatusCode)
	}

	var envelope apotekResponse
	if err := json.Unmarshal(respBody, &envelope); err != nil {
		logApotekSync(method, fullURL, reqBodyStr, string(respBody), resp.StatusCode, int(duration), "JSON parse error: "+err.Error())
		return nil, resp.StatusCode, fmt.Errorf("parse response: %w", err)
	}

	meta := envelope.MetaData
	if meta.Code == nil {
		meta = envelope.Metadata
	}

	code := parseMetaCode(meta.Code)
	if code == 0 {
		code = resp.StatusCode
	}

	if code != 200 && code != 1 {
		errMsg := meta.Message
		if errMsg == "" {
			errMsg = "Unknown error"
		}
		logApotekSync(method, fullURL, reqBodyStr, string(respBody), code, int(duration), "Apotek error: "+errMsg)
		return nil, code, fmt.Errorf("Apotek error [%d]: %s", code, errMsg)
	}

	responseData := envelope.Response
	if respStr, ok := responseData.(string); ok && strings.TrimSpace(respStr) != "" {
		var parsed interface{}
		if json.Unmarshal([]byte(respStr), &parsed) == nil {
			responseData = parsed
		} else {
			decrypted, derr := c.decryptResponse(respStr, timestamp)
			if derr == nil {
				if json.Unmarshal(decrypted, &parsed) == nil {
					responseData = parsed
				} else {
					responseData = string(decrypted)
				}
			} else {
				responseData = respStr
			}
		}
	}

	serializedResponse, _ := json.Marshal(responseData)
	logApotekSync(method, fullURL, reqBodyStr, string(serializedResponse), code, int(duration), "")

	return responseData, code, nil
}

func parseMetaCode(v interface{}) int {
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case string:
		n, _ := strconv.Atoi(val)
		return n
	default:
		return 0
	}
}

func logApotekSync(method, endpoint, request, response string, statusCode int, durationMs int, errorMsg string) {
	now := time.Now()
	responseAt := now
	status := "success"
	if errorMsg != "" {
		status = "failed"
	}

	log := models.IntegrationSyncLog{
		Integration:  models.IntegrationTypeBPJSApotek,
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
}

func isApotekRetriableError(statusCode int, err error) bool {
	if statusCode == http.StatusGatewayTimeout || statusCode == http.StatusBadGateway || statusCode == http.StatusServiceUnavailable {
		return true
	}
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "stream timeout") || strings.Contains(msg, "timeout")
}

func (c *ApotekClient) getCachedSuccessResponse(endpoint string) (interface{}, bool, error) {
	fullURL := strings.TrimRight(c.BaseURL, "/") + endpoint

	var logEntry models.IntegrationSyncLog
	err := database.DB.
		Where("integration = ? AND endpoint = ? AND status = ?", models.IntegrationTypeBPJSApotek, fullURL, "success").
		Order("request_at DESC").
		First(&logEntry).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, nil
		}
		return nil, false, err
	}

	responseBody := strings.TrimSpace(logEntry.ResponseBody)
	if responseBody == "" {
		return nil, false, nil
	}

	var parsed interface{}
	if err := json.Unmarshal([]byte(responseBody), &parsed); err != nil {
		return nil, false, fmt.Errorf("parse cached response: %w", err)
	}

	return parsed, true, nil
}

func (c *ApotekClient) GetReferensiDPHO() (interface{}, bool, error) {
	const endpoint = "/referensi/dpho"

	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		data, statusCode, err := c.request("GET", endpoint, nil)
		if err == nil {
			return data, false, nil
		}

		lastErr = err
		if !isApotekRetriableError(statusCode, err) {
			break
		}
	}

	cachedData, found, cacheErr := c.getCachedSuccessResponse(endpoint)
	if cacheErr == nil && found {
		return cachedData, true, nil
	}
	if cacheErr != nil {
		return nil, false, fmt.Errorf("%v; fallback cache gagal: %w", lastErr, cacheErr)
	}

	return nil, false, lastErr
}

func (c *ApotekClient) GetReferensiPoli(parameter string) (interface{}, error) {
	endpoint := "/referensi/poli/" + url.PathEscape(parameter)
	data, _, err := c.request("GET", endpoint, nil)
	return data, err
}

func (c *ApotekClient) GetFasilitasKesehatan(jenisFaskes string, namaFaskes string) (interface{}, error) {
	endpoint := "/referensi/ppk/" + url.PathEscape(jenisFaskes) + "/" + url.PathEscape(namaFaskes)
	data, _, err := c.request("GET", endpoint, nil)
	return data, err
}

func (c *ApotekClient) GetSettingApotek(kodeApotek string) (interface{}, error) {
	endpoint := "/referensi/settingppk/read/" + url.PathEscape(kodeApotek)
	data, _, err := c.request("GET", endpoint, nil)
	return data, err
}

func (c *ApotekClient) GetSpesialistik() (interface{}, error) {
	data, _, err := c.request("GET", "/referensi/spesialistik", nil)
	return data, err
}

func apotekOptionalPathSegment(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return url.PathEscape(" ")
	}
	return url.PathEscape(trimmed)
}

func (c *ApotekClient) GetReferensiObat(kodeJenisObat, tglResep, filter string) (interface{}, error) {
	endpoint := "/referensi/obat/" + apotekOptionalPathSegment(kodeJenisObat) + "/" + url.PathEscape(strings.TrimSpace(tglResep)) + "/" + apotekOptionalPathSegment(filter)
	data, _, err := c.request("GET", endpoint, nil)
	return data, err
}

func (c *ApotekClient) InsertObatNonRacikan(payload map[string]interface{}) (interface{}, error) {
	data, _, err := c.request("POST", "/obatnonracikan/v3/insert", payload)
	return data, err
}

func (c *ApotekClient) InsertObatRacikan(payload map[string]interface{}) (interface{}, error) {
	data, _, err := c.request("POST", "/obatracikan/v3/insert", payload)
	return data, err
}

func (c *ApotekClient) UpdateStokObat(payload map[string]interface{}) (interface{}, error) {
	data, _, err := c.request("POST", "/UpdateStokObat/updatestok", payload)
	return data, err
}

func (c *ApotekClient) HapusPelayananObat(payload map[string]interface{}) (interface{}, error) {
	data, _, err := c.request("DELETE", "/pelayanan/obat/hapus/", payload)
	return data, err
}

func (c *ApotekClient) GetDaftarPelayananObat(noKunjungan string) (interface{}, error) {
	endpoint := "/obat/daftar/" + url.PathEscape(noKunjungan)
	data, _, err := c.request("GET", endpoint, nil)
	return data, err
}

func (c *ApotekClient) GetRiwayatPelayananObat(tglAwal, tglAkhir, noKartu string) (interface{}, error) {
	endpoint := "/riwayatobat/" + url.PathEscape(tglAwal) + "/" + url.PathEscape(tglAkhir) + "/" + url.PathEscape(noKartu)
	data, _, err := c.request("GET", endpoint, nil)
	return data, err
}

func (c *ApotekClient) SimpanResep(payload map[string]interface{}) (interface{}, error) {
	data, _, err := c.request("POST", "/sjpresep/v3/insert", payload)
	return data, err
}

func (c *ApotekClient) HapusResep(payload map[string]interface{}) (interface{}, error) {
	data, _, err := c.request("DELETE", "/hapusresep", payload)
	return data, err
}

func (c *ApotekClient) DaftarResep(payload map[string]interface{}) (interface{}, error) {
	data, _, err := c.request("POST", "/daftarresep", payload)
	return data, err
}

func (c *ApotekClient) CariKunjunganBySEP(noSEP string) (interface{}, error) {
	endpoint := "/sep/" + url.PathEscape(noSEP)
	data, _, err := c.request("GET", endpoint, nil)
	return data, err
}

func (c *ApotekClient) GetDataKlaim(bulan, tahun, jenisObat, status string) (interface{}, error) {
	endpoint := "/monitoring/klaim/" + url.PathEscape(bulan) + "/" + url.PathEscape(tahun) + "/" + url.PathEscape(jenisObat) + "/" + url.PathEscape(status)
	data, _, err := c.request("GET", endpoint, nil)
	return data, err
}

func (c *ApotekClient) GetRekapPesertaPRB(tahun, bulan string) (interface{}, error) {
	endpoint := "/Prb/rekappeserta/tahun/" + url.PathEscape(tahun) + "/bulan/" + url.PathEscape(bulan)
	data, _, err := c.request("GET", endpoint, nil)
	return data, err
}
