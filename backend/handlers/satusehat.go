package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// SatuSehat OAuth Token Response
type SatuSehatTokenResponse struct {
	AccessToken string      `json:"access_token"`
	TokenType   string      `json:"token_type"`
	ExpiresIn   json.Number `json:"expires_in"` // Can be string or int from API
	Scope       string      `json:"scope"`
}

// GetExpiresInSeconds converts ExpiresIn to int64
func (t *SatuSehatTokenResponse) GetExpiresInSeconds() int64 {
	if t.ExpiresIn == "" {
		return 3600 // default 1 hour
	}
	// Try to parse as int64
	n, err := strconv.ParseInt(string(t.ExpiresIn), 10, 64)
	if err != nil {
		return 3600 // default 1 hour on error
	}
	return n
}

// SatuSehat cached token
var satuSehatToken string
var satuSehatTokenExpiry time.Time

// getSatuSehatConfig returns SatuSehat configuration
func getSatuSehatConfig() (map[string]string, error) {
	var configs []models.IntegrationConfig
	database.DB.Where("integration = ?", models.IntegrationTypeSatuSehat).Find(&configs)

	configMap := make(map[string]string)
	for _, cfg := range configs {
		// Langsung ambil nilai TANPA dekripsi
		configMap[cfg.Key] = cfg.Value
	}

	return configMap, nil
}

// getSatuSehatBaseURL returns base URL based on environment
func getSatuSehatBaseURL(configMap map[string]string) string {
	environment := configMap["environment"]
	if environment == "production" {
		return configMap["base_url_prod"]
	}
	return configMap["base_url_dev"]
}

// GetSatuSehatToken gets or refreshes OAuth2 token
func GetSatuSehatToken() (string, error) {
	// Check if token is still valid (with 5 minute buffer)
	if satuSehatToken != "" && time.Now().Add(5*time.Minute).Before(satuSehatTokenExpiry) {
		return satuSehatToken, nil
	}

	configMap, err := getSatuSehatConfig()
	if err != nil {
		return "", err
	}

	clientID := configMap["client_id"]
	clientSecret := configMap["client_secret"]

	// Trim whitespace yang mungkin tidak sengaja masuk
	clientID = strings.TrimSpace(clientID)
	clientSecret = strings.TrimSpace(clientSecret)

	if clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("SatuSehat credentials not configured")
	}

	baseURL := getSatuSehatBaseURL(configMap)
	// Pastikan base URL tidak ada trailing slash
	baseURL = strings.TrimSuffix(baseURL, "/")
	tokenURL := baseURL + "/oauth2/v1/accesstoken?grant_type=client_credentials"

	// Debug log
	fmt.Printf("[SatuSehat] Token URL: %s\n", tokenURL)
	fmt.Printf("[SatuSehat] Client ID length: %d, Client Secret length: %d\n", len(clientID), len(clientSecret))

	// Create form data
	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 30 * time.Second}
	startTime := time.Now()

	resp, err := client.Do(req)
	duration := time.Since(startTime)

	// Log the request
	logEntry := models.IntegrationSyncLog{
		Integration: models.IntegrationTypeSatuSehat,
		Endpoint:    tokenURL,
		Method:      "POST",
		RequestBody: "client_credentials",
		Status:      "success",
		RequestAt:   startTime,
		DurationMs:  int(duration.Milliseconds()),
	}

	if err != nil {
		logEntry.Status = "failed"
		logEntry.ErrorMessage = err.Error()
		database.DB.Create(&logEntry)
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	now := time.Now()
	logEntry.ResponseAt = &now
	logEntry.ResponseCode = resp.StatusCode
	logEntry.ResponseBody = string(body)

	if resp.StatusCode != 200 {
		logEntry.Status = "failed"
		logEntry.ErrorMessage = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(body))
		database.DB.Create(&logEntry)
		return "", fmt.Errorf("failed to get token: %s", string(body))
	}

	var tokenResp SatuSehatTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		logEntry.Status = "failed"
		logEntry.ErrorMessage = "Failed to parse token response"
		database.DB.Create(&logEntry)
		return "", err
	}

	// Cache token
	satuSehatToken = tokenResp.AccessToken
	satuSehatTokenExpiry = time.Now().Add(time.Duration(tokenResp.GetExpiresInSeconds()) * time.Second)

	database.DB.Create(&logEntry)
	return satuSehatToken, nil
}

// TestSatuSehatConnection tests the SatuSehat API connection
func TestSatuSehatConnection(c *gin.Context) {
	startTime := time.Now()

	configMap, err := getSatuSehatConfig()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Gagal membaca konfigurasi: " + err.Error(),
		})
		return
	}

	clientID := strings.TrimSpace(configMap["client_id"])
	clientSecret := strings.TrimSpace(configMap["client_secret"])
	environment := configMap["environment"]
	baseURL := getSatuSehatBaseURL(configMap)

	// Debug info
	debugInfo := gin.H{
		"client_id_length":     len(clientID),
		"client_secret_length": len(clientSecret),
		"environment":          environment,
		"base_url":             baseURL,
	}

	if clientID == "" || clientSecret == "" {
		c.JSON(http.StatusOK, gin.H{
			"success":     false,
			"error":       "Kredensial SatuSehat belum lengkap. Silakan isi Client ID dan Client Secret.",
			"environment": environment,
			"debug":       debugInfo,
		})
		return
	}

	// Clear cached token to force re-authentication
	satuSehatToken = ""
	satuSehatTokenExpiry = time.Time{}

	// Try to get token
	token, err := GetSatuSehatToken()
	duration := time.Since(startTime)

	if err != nil {
		// Provide more helpful error message
		errorMsg := err.Error()
		hint := ""
		if strings.Contains(errorMsg, "client_id or client_secret") {
			hint = "Pastikan Client ID dan Client Secret sesuai dengan environment (" + environment + "). Credential staging tidak bisa digunakan di production dan sebaliknya."
		}

		c.JSON(http.StatusOK, gin.H{
			"success":       false,
			"error":         "Gagal mendapatkan access token: " + errorMsg,
			"hint":          hint,
			"environment":   environment,
			"response_time": duration.String(),
			"debug":         debugInfo,
		})
		return
	}

	// Token obtained successfully, try to get organization info
	orgID := configMap["organization_id"]

	if orgID != "" {
		// Try to get organization data to verify
		orgURL := baseURL + "/fhir-r4/v1/Organization/" + orgID

		req, _ := http.NewRequest("GET", orgURL, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)

		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success":       true,
				"message":       "Autentikasi berhasil! (Gagal verifikasi Organization: " + err.Error() + ")",
				"environment":   environment,
				"response_time": time.Since(startTime).String(),
			})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == 200 {
			body, _ := io.ReadAll(resp.Body)
			var orgData map[string]interface{}
			json.Unmarshal(body, &orgData)

			orgName := ""
			if name, ok := orgData["name"].(string); ok {
				orgName = name
			}

			c.JSON(http.StatusOK, gin.H{
				"success":           true,
				"message":           "Koneksi SatuSehat berhasil!",
				"environment":       environment,
				"response_time":     time.Since(startTime).String(),
				"organization_name": orgName,
				"organization_id":   orgID,
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"message":       "Autentikasi SatuSehat berhasil!",
		"environment":   environment,
		"response_time": duration.String(),
	})
}

// SatuSehatFHIRRequest makes authenticated request to SatuSehat FHIR API
func SatuSehatFHIRRequest(method, endpoint string, body interface{}) ([]byte, int, error) {
	token, err := GetSatuSehatToken()
	if err != nil {
		return nil, 0, err
	}

	configMap, _ := getSatuSehatConfig()
	baseURL := getSatuSehatBaseURL(configMap)
	fullURL := baseURL + "/fhir-r4/v1" + endpoint

	var reqBody io.Reader
	var reqBodyStr string
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		reqBody = bytes.NewReader(jsonBody)
		reqBodyStr = string(jsonBody)
	}

	req, err := http.NewRequest(method, fullURL, reqBody)
	if err != nil {
		return nil, 0, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	startTime := time.Now()

	resp, err := client.Do(req)
	duration := time.Since(startTime)

	// Log the request
	logEntry := models.IntegrationSyncLog{
		Integration: models.IntegrationTypeSatuSehat,
		Endpoint:    endpoint,
		Method:      method,
		RequestBody: reqBodyStr,
		Status:      "success",
		RequestAt:   startTime,
		DurationMs:  int(duration.Milliseconds()),
	}

	if err != nil {
		logEntry.Status = "failed"
		logEntry.ErrorMessage = err.Error()
		database.DB.Create(&logEntry)
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	now := time.Now()
	logEntry.ResponseAt = &now
	logEntry.ResponseCode = resp.StatusCode
	logEntry.ResponseBody = string(respBody)

	if resp.StatusCode >= 400 {
		logEntry.Status = "failed"
		logEntry.ErrorMessage = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}

	database.DB.Create(&logEntry)
	return respBody, resp.StatusCode, nil
}

// GetSatuSehatOrganization gets organization info from SatuSehat
func GetSatuSehatOrganization(c *gin.Context) {
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]

	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	body, statusCode, err := SatuSehatFHIRRequest("GET", "/Organization/"+orgID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// SearchSatuSehatPatient searches for patient in SatuSehat by NIK
func SearchSatuSehatPatient(c *gin.Context) {
	nik := c.Query("nik")
	if nik == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIK diperlukan"})
		return
	}

	endpoint := "/Patient?identifier=https://fhir.kemkes.go.id/id/nik|" + nik

	body, statusCode, err := SatuSehatFHIRRequest("GET", endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// SearchSatuSehatPractitioner searches for practitioner in SatuSehat by NIK
func SearchSatuSehatPractitioner(c *gin.Context) {
	nik := c.Query("nik")
	if nik == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIK diperlukan"})
		return
	}

	endpoint := "/Practitioner?identifier=https://fhir.kemkes.go.id/id/nik|" + nik

	body, statusCode, err := SatuSehatFHIRRequest("GET", endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetSatuSehatEncounters gets all encounters for organization
func GetSatuSehatEncounters(c *gin.Context) {
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]

	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Optional filters
	subjectID := c.Query("subject")
	date := c.Query("date")
	count := c.DefaultQuery("_count", "10")

	endpoint := "/Encounter?service-provider=" + orgID
	if subjectID != "" {
		endpoint += "&subject=" + subjectID
	}
	if date != "" {
		endpoint += "&date=" + date
	}
	endpoint += "&_count=" + count

	body, statusCode, err := SatuSehatFHIRRequest("GET", endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetSatuSehatConditions gets all conditions (diagnoses) for organization
func GetSatuSehatConditions(c *gin.Context) {
	encounterID := c.Query("encounter")

	if encounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter ID diperlukan"})
		return
	}

	endpoint := "/Condition?encounter=" + encounterID

	body, statusCode, err := SatuSehatFHIRRequest("GET", endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetSatuSehatObservations gets observations for an encounter
func GetSatuSehatObservations(c *gin.Context) {
	encounterID := c.Query("encounter")

	if encounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter ID diperlukan"})
		return
	}

	endpoint := "/Observation?encounter=" + encounterID

	body, statusCode, err := SatuSehatFHIRRequest("GET", endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetSatuSehatMedicationRequests gets medication requests for an encounter
func GetSatuSehatMedicationRequests(c *gin.Context) {
	encounterID := c.Query("encounter")

	if encounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter ID diperlukan"})
		return
	}

	endpoint := "/MedicationRequest?encounter=" + encounterID

	body, statusCode, err := SatuSehatFHIRRequest("GET", endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// SatuSehatHistoryResponse represents the history data
type SatuSehatHistoryResponse struct {
	TotalEncounters int                      `json:"total_encounters"`
	Encounters      []map[string]interface{} `json:"encounters"`
	Summary         map[string]int           `json:"summary"`
}

// GetSatuSehatHistory gets all history data from SatuSehat for the organization
func GetSatuSehatHistory(c *gin.Context) {
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]

	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Get date range from query
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, -1, 0).Format("2006-01-02"))
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	count := c.DefaultQuery("_count", "50")

	endpoint := fmt.Sprintf("/Encounter?service-provider=%s&date=ge%s&date=le%s&_count=%s&_sort=-date",
		orgID, startDate, endDate, count)

	body, statusCode, err := SatuSehatFHIRRequest("GET", endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	var bundle map[string]interface{}
	json.Unmarshal(body, &bundle)

	// Parse encounters
	var encounters []map[string]interface{}
	summary := make(map[string]int)

	if entries, ok := bundle["entry"].([]interface{}); ok {
		for _, entry := range entries {
			if entryMap, ok := entry.(map[string]interface{}); ok {
				if resource, ok := entryMap["resource"].(map[string]interface{}); ok {
					encounters = append(encounters, resource)

					// Count by class
					if class, ok := resource["class"].(map[string]interface{}); ok {
						if code, ok := class["code"].(string); ok {
							summary[code]++
						}
					}
				}
			}
		}
	}

	total := 0
	if t, ok := bundle["total"].(float64); ok {
		total = int(t)
	}

	c.JSON(http.StatusOK, gin.H{
		"data": SatuSehatHistoryResponse{
			TotalEncounters: total,
			Encounters:      encounters,
			Summary:         summary,
		},
		"period": gin.H{
			"start": startDate,
			"end":   endDate,
		},
	})
}
