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

// logAplicareSync logs Aplicare API request/response to integration_sync_logs
func logAplicareSync(method, endpoint, request, response string, statusCode int, durationMs int, errorMsg string) {
	now := time.Now()
	responseAt := now
	status := "success"
	if errorMsg != "" {
		status = "failed"
	}

	log := models.IntegrationSyncLog{
		Integration:  models.IntegrationTypeBPJSAplicare,
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

	fmt.Printf("[Aplicare %s] %s %s - %dms - Status: %d\n", strings.ToUpper(status), method, endpoint, durationMs, statusCode)
}

// AplicareClient adalah client untuk BPJS Aplicare API (ketersediaan tempat tidur)
type AplicareClient struct {
	ConsID     string
	SecretKey  string
	UserKey    string
	KodePPK    string
	BaseURL    string
	HTTPClient *http.Client
}

// AplicareRefKelasItem represents a room class from Aplicare
type AplicareRefKelasItem struct {
	KodeKelas string `json:"kodekelas"`
	NamaKelas string `json:"namakelas"`
}

// AplicareBedRequest represents bed create/update request
type AplicareBedRequest struct {
	KodeKelas          string `json:"kodekelas"`
	KodeRuang          string `json:"koderuang"`
	NamaRuang          string `json:"namaruang"`
	Kapasitas          string `json:"kapasitas"`
	Tersedia           string `json:"tersedia"`
	TersediaPria       string `json:"tersediapria"`
	TersediaWanita     string `json:"tersediawanita"`
	TersediaPriaWanita string `json:"tersediapriawanita"`
}

// AplicareDeleteRequest represents bed delete request
type AplicareDeleteRequest struct {
	KodeKelas string `json:"kodekelas"`
	KodeRuang string `json:"koderuang"`
}

// AplicareBedItem represents a room/bed from read endpoint
type AplicareBedItem struct {
	KodeKelas          string `json:"kodekelas"`
	NamaKelas          string `json:"namakelas"`
	KodeRuang          string `json:"koderuang"`
	NamaRuang          string `json:"namaruang"`
	Kapasitas          int    `json:"kapasitas"`
	Tersedia           int    `json:"tersedia"`
	TersediaPria       int    `json:"tersediapria"`
	TersediaWanita     int    `json:"tersediawanita"`
	TersediaPriaWanita int    `json:"tersediapriawanita"`
}

// NewAplicareClient membuat Aplicare client baru dari database config
func NewAplicareClient() (*AplicareClient, error) {
	var configs []models.IntegrationConfig

	// Coba ambil config khusus Aplicare
	if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSAplicare).Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("gagal load config Aplicare: %w", err)
	}

	// Fallback ke config VClaim
	if len(configs) == 0 {
		if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSVClaim).Find(&configs).Error; err != nil {
			return nil, fmt.Errorf("gagal load config BPJS: %w", err)
		}
	}

	// Fallback ke config Antrian
	if len(configs) == 0 {
		if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSAntrian).Find(&configs).Error; err != nil {
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

	// Pilih base URL sesuai environment
	// Aplicare: dev=https://dvlp.bpjs-kesehatan.go.id:8888/aplicaresws/rest (prod: belum ada URL resmi)
	var baseURL string
	if environment == "production" {
		baseURL = configMap["base_url_prod"]
	} else {
		baseURL = configMap["base_url_dev"]
	}
	if baseURL != "" {
		baseURL = strings.TrimRight(baseURL, "/")
	}

	fmt.Printf("[Aplicare Client] Environment=%s, BaseURL=%s\n", environment, baseURL)

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
	if configMap["kode_ppk"] == "" {
		return nil, fmt.Errorf("BPJS kode_ppk tidak ditemukan di konfigurasi")
	}

	return &AplicareClient{
		ConsID:    configMap["cons_id"],
		SecretKey: configMap["secret_key"],
		UserKey:   configMap["user_key"],
		KodePPK:   configMap["kode_ppk"],
		BaseURL:   baseURL,
		HTTPClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}, nil
}

// request melakukan HTTP request ke Aplicare API
func (c *AplicareClient) request(method, endpoint string, body interface{}) ([]byte, int, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	// Generate signature (same as VClaim)
	vclient := &VClaimClient{ConsID: c.ConsID, SecretKey: c.SecretKey}
	signature := vclient.GenerateSignature(timestamp)

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

	fullURL := c.BaseURL + endpoint
	req, err := http.NewRequest(method, fullURL, reqBody)
	if err != nil {
		return nil, 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("X-cons-id", c.ConsID)
	req.Header.Set("X-timestamp", timestamp) // JANGAN UBAH!
	req.Header.Set("X-signature", signature)
	req.Header.Set("user_key", c.UserKey) // JANGAN UBAH!
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	fmt.Printf("[Aplicare Request] %s %s\n", method, fullURL)

	startTime := time.Now()
	resp, err := c.HTTPClient.Do(req)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		logAplicareSync(method, fullURL, reqBodyStr, "", http.StatusInternalServerError, int(duration), "Request failed: "+err.Error())
		return nil, 0, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		logAplicareSync(method, fullURL, reqBodyStr, "", resp.StatusCode, int(duration), "Read response error: "+err.Error())
		return nil, resp.StatusCode, fmt.Errorf("read response: %w", err)
	}

	fmt.Printf("[Aplicare Response] Status=%d, Body=%s\n", resp.StatusCode, string(respBody))

	logAplicareSync(method, fullURL, reqBodyStr, string(respBody), resp.StatusCode, int(duration), "")
	return respBody, resp.StatusCode, nil
}

// parseResponse parses a standard BPJS Aplicare response
func (c *AplicareClient) parseResponse(data []byte) (interface{}, error) {
	var resp struct {
		MetaData struct {
			Code    interface{} `json:"code"`
			Message string      `json:"message"`
		} `json:"metadata"`
		Response interface{} `json:"response"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	code := 0
	switch v := resp.MetaData.Code.(type) {
	case float64:
		code = int(v)
	case string:
		code, _ = strconv.Atoi(v)
	case int:
		code = v
	}

	if code != 1 && code != 200 {
		return nil, fmt.Errorf("Aplicare error [%d]: %s", code, resp.MetaData.Message)
	}

	return resp.Response, nil
}

// GetRefKelas mengambil referensi kelas kamar dari BPJS
func (c *AplicareClient) GetRefKelas() ([]AplicareRefKelasItem, error) {
	data, statusCode, err := c.request("GET", "/ref/kelas", nil)
	if err != nil {
		return nil, err
	}

	if statusCode >= 400 {
		return nil, fmt.Errorf("server Aplicare mengembalikan status: %d", statusCode)
	}

	respData, err := c.parseResponse(data)
	if err != nil {
		return nil, err
	}

	// Parse response.list
	respMap, ok := respData.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("format response tidak dikenali")
	}

	listData, ok := respMap["list"]
	if !ok {
		return nil, fmt.Errorf("response tidak mengandung list")
	}

	jsonData, _ := json.Marshal(listData)
	var items []AplicareRefKelasItem
	if err := json.Unmarshal(jsonData, &items); err != nil {
		return nil, fmt.Errorf("parse list kelas: %w", err)
	}

	return items, nil
}

// CreateBed mendaftarkan ruang baru ke Aplicare
func (c *AplicareClient) CreateBed(req AplicareBedRequest) error {
	data, statusCode, err := c.request("POST", "/bed/create/"+c.KodePPK, req)
	if err != nil {
		return err
	}

	if statusCode >= 400 {
		return fmt.Errorf("server Aplicare mengembalikan status: %d", statusCode)
	}

	_, err = c.parseResponse(data)
	return err
}

// UpdateBed mengupdate ketersediaan tempat tidur ke Aplicare
func (c *AplicareClient) UpdateBed(req AplicareBedRequest) error {
	data, statusCode, err := c.request("POST", "/bed/update/"+c.KodePPK, req)
	if err != nil {
		return err
	}

	if statusCode >= 400 {
		return fmt.Errorf("server Aplicare mengembalikan status: %d", statusCode)
	}

	_, err = c.parseResponse(data)
	return err
}

// ReadBed membaca ketersediaan tempat tidur dari Aplicare
func (c *AplicareClient) ReadBed(start, limit int) ([]AplicareBedItem, error) {
	endpoint := fmt.Sprintf("/bed/read/%s/%d/%d", c.KodePPK, start, limit)
	data, statusCode, err := c.request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	if statusCode >= 400 {
		return nil, fmt.Errorf("server Aplicare mengembalikan status: %d", statusCode)
	}

	respData, err := c.parseResponse(data)
	if err != nil {
		return nil, err
	}

	// Parse response.list
	respMap, ok := respData.(map[string]interface{})
	if !ok {
		// Response might be a list directly
		jsonData, _ := json.Marshal(respData)
		var items []AplicareBedItem
		if err := json.Unmarshal(jsonData, &items); err != nil {
			return nil, fmt.Errorf("parse bed data: %w", err)
		}
		return items, nil
	}

	listData, ok := respMap["list"]
	if !ok {
		return nil, fmt.Errorf("response tidak mengandung list")
	}

	jsonData, _ := json.Marshal(listData)
	var items []AplicareBedItem
	if err := json.Unmarshal(jsonData, &items); err != nil {
		return nil, fmt.Errorf("parse bed list: %w", err)
	}

	return items, nil
}

// DeleteBed menghapus ruangan dari Aplicare
func (c *AplicareClient) DeleteBed(kodeKelas, kodeRuang string) error {
	req := AplicareDeleteRequest{
		KodeKelas: kodeKelas,
		KodeRuang: kodeRuang,
	}

	data, statusCode, err := c.request("POST", "/bed/delete/"+c.KodePPK, req)
	if err != nil {
		return err
	}

	if statusCode >= 400 {
		return fmt.Errorf("server Aplicare mengembalikan status: %d", statusCode)
	}

	_, err = c.parseResponse(data)
	return err
}

// IsRoomMappedInAplicare checks whether a SIMRS room code already exists in Aplicare.
func (c *AplicareClient) IsRoomMappedInAplicare(roomCode string) (bool, *AplicareBedItem, error) {
	items, err := c.ReadBed(1, 500)
	if err != nil {
		return false, nil, err
	}

	for i := range items {
		if items[i].KodeRuang == roomCode {
			return true, &items[i], nil
		}
	}

	return false, nil, nil
}

// MapRoomClassToAplicare maps SIMRS room class to BPJS Aplicare kode kelas
func MapRoomClassToAplicare(roomClass string) string {
	switch strings.ToLower(roomClass) {
	case "vvip":
		return "VVP"
	case "vip":
		return "VIP"
	case "kelas_1":
		return "KLS1"
	case "kelas_2":
		return "KLS2"
	case "kelas_3":
		return "KLS3"
	case "icu":
		return "ICU"
	default:
		return "NON"
	}
}

// UpdateRoomBedAvailability menghitung ketersediaan bed pada suatu room dan update ke Aplicare.
// source menjelaskan pemicu sinkronisasi agar jejak log lebih mudah dibaca.
func UpdateRoomBedAvailability(roomID uint, source string) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("[Aplicare] Panic saat update bed availability roomID=%d source=%s: %v\n", roomID, source, r)
			}
		}()

		var room models.Room
		if err := database.DB.First(&room, roomID).Error; err != nil {
			fmt.Printf("[Aplicare] Gagal load room %d source=%s: %v\n", roomID, source, err)
			return
		}

		// Hanya room rawat inap yang perlu di-update
		if !room.HasBed {
			fmt.Printf("[Aplicare] Skip update room %s source=%s karena room tidak memiliki bed\n", room.Code, source)
			return
		}

		room.ComputeBedStats(database.DB)
		fmt.Printf("[Aplicare] Mulai sync room %s source=%s kapasitas=%d tersedia=%d\n", room.Code, source, room.TotalBeds, room.AvailableBeds)

		client, err := NewAplicareClient()
		if err != nil {
			fmt.Printf("[Aplicare] Gagal init client untuk update bed room %s source=%s: %v\n", room.Code, source, err)
			return
		}

		mapped, existingRoom, err := client.IsRoomMappedInAplicare(room.Code)
		if err != nil {
			fmt.Printf("[Aplicare] Gagal cek mapping room %s source=%s: %v\n", room.Code, source, err)
			return
		}
		if !mapped {
			fmt.Printf("[Aplicare] Skip update room %s source=%s karena belum termapping di Aplicare\n", room.Code, source)
			return
		}

		kodeKelas := room.KodeKelasBPJS
		if kodeKelas == "" {
			kodeKelas = MapRoomClassToAplicare(room.RoomClass)
		}
		if existingRoom != nil && existingRoom.KodeKelas != "" {
			kodeKelas = existingRoom.KodeKelas
		}

		req := AplicareBedRequest{
			KodeKelas:          kodeKelas,
			KodeRuang:          room.Code,
			NamaRuang:          room.Name,
			Kapasitas:          strconv.Itoa(room.TotalBeds),
			Tersedia:           strconv.Itoa(room.AvailableBeds),
			TersediaPria:       "0",
			TersediaWanita:     "0",
			TersediaPriaWanita: "0",
		}

		if err := client.UpdateBed(req); err != nil {
			fmt.Printf("[Aplicare] Gagal update bed availability room %s source=%s: %v\n", room.Code, source, err)
			return
		}

		fmt.Printf("[Aplicare] Berhasil update bed availability room %s source=%s: kapasitas=%d tersedia=%d\n", room.Code, source, room.TotalBeds, room.AvailableBeds)
	}()
}
