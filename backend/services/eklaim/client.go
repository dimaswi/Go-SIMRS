package eklaim

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
	"time"
)

// ==========================================================================
// E-Klaim Local Server Client
//
// Komunikasi dengan E-Klaim server menggunakan enkripsi AES-256-CBC:
//   1. Request JSON di-encrypt → base64 → POST sebagai x-www-form-urlencoded
//   2. Response dari server berupa encrypted payload → decrypt → JSON
//
// Ini sesuai dengan implementasi PHP inacbg_encrypt/inacbg_decrypt
// pada dokumentasi E-Klaim resmi BPJS Kesehatan.
// ==========================================================================

// Client communicates with the E-Klaim local server (BPJS desktop app)
type Client struct {
	BaseURL    string // URL server E-Klaim lokal, e.g. http://192.168.56.101/E-Klaim/ws.php
	SecretKey  string // Hex-encoded encryption key dari BPJS (64 hex chars → 32 bytes)
	CoderNIK   string // NIK Koder default
	HTTPClient *http.Client
}

// NewClient creates a new E-Klaim client from integration_configs
func NewClient() (*Client, error) {
	var configs []models.IntegrationConfig
	if err := database.DB.Where("integration = ?", "eklaim").Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("gagal load config E-Klaim: %w", err)
	}

	configMap := make(map[string]string)
	for _, c := range configs {
		configMap[c.Key] = c.Value
	}

	baseURL := configMap["eklaim_local_url"]
	if baseURL == "" {
		baseURL = "http://localhost/E-Klaim/ws.php"
	}

	return &Client{
		BaseURL:   baseURL,
		SecretKey: configMap["eklaim_secret_key"],
		CoderNIK:  configMap["eklaim_coder_nik"],
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// NewClientFromEnv creates client from direct parameters (for testing or override)
func NewClientFromEnv(baseURL, secretKey, coderNIK string) *Client {
	return &Client{
		BaseURL:   baseURL,
		SecretKey: secretKey,
		CoderNIK:  coderNIK,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ==================== REQUEST/RESPONSE TYPES ====================

// EKlaimRequest is the standard request envelope for E-Klaim API
type EKlaimRequest struct {
	Metadata EKlaimRequestMetadata `json:"metadata"`
	Data     interface{}           `json:"data"`
}

// EKlaimRequestMetadata for request envelope
type EKlaimRequestMetadata struct {
	Method   string `json:"method"`
	NomorSEP string `json:"nomor_sep,omitempty"` // Required for set_claim_data
}

// EKlaimResponse is the standard response envelope from E-Klaim API
// Note: E-Klaim server returns code as number (200, 400), not string.
type EKlaimResponse struct {
	Metadata struct {
		Code    json.Number `json:"code"`
		Message string      `json:"message"`
		ErrorNo string      `json:"error_no,omitempty"`
	} `json:"metadata"`
	Response json.RawMessage `json:"response"`
}

// NewClaimData contains fields for new_claim request.
// Sesuai dokumentasi: hanya mengirim data pasien dasar.
type NewClaimData struct {
	NomorKartu string `json:"nomor_kartu"`
	NomorSEP   string `json:"nomor_sep"`
	NomorRM    string `json:"nomor_rm"`
	NamaPasien string `json:"nama_pasien"`
	TglLahir   string `json:"tgl_lahir"` // format: "1940-01-01 02:00:00"
	Gender     int    `json:"gender"`    // 1=Laki-laki, 2=Perempuan
}

// SetClaimDataData contains the full claim data for set_claim_data.
// Sesuai dokumentasi resmi E-Klaim BPJS.
type SetClaimDataData struct {
	NomorSEP    string `json:"nomor_sep"`
	NomorKartu  string `json:"nomor_kartu"`
	TglMasuk    string `json:"tgl_masuk"`  // format: "2023-01-25 12:55:00"
	TglPulang   string `json:"tgl_pulang"` // format: "2023-01-31 09:55:00"
	CaraMasuk   string `json:"cara_masuk"` // "gp", "hosp-trans", "inp", "outp", dll
	JenisRawat  string `json:"jenis_rawat"`
	KelasRawat  string `json:"kelas_rawat"`
	ADLSubAcute string `json:"adl_sub_acute"`
	ADLChronic  string `json:"adl_chronic"`

	// ICU
	ICUIndikator   string      `json:"icu_indikator"`
	ICULOS         string      `json:"icu_los"`
	VentilatorHour string      `json:"ventilator_hour"`
	Ventilator     interface{} `json:"ventilator"` // bisa string "0" atau object {use_ind, start_dttm, stop_dttm}

	// Upgrade kelas
	UpgradeClassInd   string `json:"upgrade_class_ind"`
	UpgradeClassClass string `json:"upgrade_class_class"`
	UpgradeClassLOS   string `json:"upgrade_class_los"`
	UpgradeClassPayor string `json:"upgrade_class_payor,omitempty"`
	AddPaymentPct     string `json:"add_payment_pct"`

	// Neonatus
	BirthWeight string `json:"birth_weight"`

	// Vital signs
	Sistole  int `json:"sistole,omitempty"`
	Diastole int `json:"diastole,omitempty"`

	// Discharge
	DischargeStatus string `json:"discharge_status"`

	// Tarif RS — object dengan breakdown
	TarifRS *TarifRSDetail `json:"tarif_rs"`

	// Identitas tambahan
	NomorKartuT       string `json:"nomor_kartu_t,omitempty"`
	BayiLahirStatusCd int    `json:"bayi_lahir_status_cd,omitempty"`
	DializerSingleUse int    `json:"dializer_single_use,omitempty"`
	KantongDarah      int    `json:"kantong_darah,omitempty"`
	AlteplaseInd      int    `json:"alteplase_ind,omitempty"`

	// APGAR (untuk neonatus)
	Apgar *ApgarData `json:"apgar,omitempty"`

	// Persalinan
	Persalinan *PersalinanData `json:"persalinan,omitempty"`

	// Tarif poli eksekutif
	TarifPoliEks string `json:"tarif_poli_eks,omitempty"`

	// Dokter
	NamaDokter string `json:"nama_dokter,omitempty"`

	// Kode tarif & payor
	KodeTarif string `json:"kode_tarif,omitempty"`
	PayorID   string `json:"payor_id,omitempty"`
	PayorCd   string `json:"payor_cd,omitempty"`
	CobCd     string `json:"cob_cd,omitempty"`

	// Coder
	CoderNIK string `json:"coder_nik"`
}

// TarifRSDetail represents the detailed breakdown of hospital tariff
type TarifRSDetail struct {
	ProsedurNonBedah string `json:"prosedur_non_bedah"`
	ProsedurBedah    string `json:"prosedur_bedah"`
	Konsultasi       string `json:"konsultasi"`
	TenagaAhli       string `json:"tenaga_ahli"`
	Keperawatan      string `json:"keperawatan"`
	Penunjang        string `json:"penunjang"`
	Radiologi        string `json:"radiologi"`
	Laboratorium     string `json:"laboratorium"`
	PelayananDarah   string `json:"pelayanan_darah"`
	Rehabilitasi     string `json:"rehabilitasi"`
	Kamar            string `json:"kamar"`
	RawatIntensif    string `json:"rawat_intensif"`
	Obat             string `json:"obat"`
	ObatKronis       string `json:"obat_kronis"`
	ObatKemoterapi   string `json:"obat_kemoterapi"`
	Alkes            string `json:"alkes"`
	BMHP             string `json:"bmhp"`
	SewaAlat         string `json:"sewa_alat"`
}

// ApgarData represents APGAR score data
type ApgarData struct {
	Menit1 *ApgarScore `json:"menit_1,omitempty"`
	Menit5 *ApgarScore `json:"menit_5,omitempty"`
}

// ApgarScore represents individual APGAR score components
type ApgarScore struct {
	Appearance  int `json:"appearance"`
	Pulse       int `json:"pulse"`
	Grimace     int `json:"grimace"`
	Activity    int `json:"activity"`
	Respiration int `json:"respiration"`
}

// PersalinanData represents delivery data
type PersalinanData struct {
	UsiaKehamilan  string          `json:"usia_kehamilan"`
	Gravida        string          `json:"gravida"`
	Partus         string          `json:"partus"`
	Abortus        string          `json:"abortus"`
	OnsetKontraksi string          `json:"onset_kontraksi"`
	Delivery       []DeliveryEntry `json:"delivery,omitempty"`
}

// DeliveryEntry represents a single delivery record
type DeliveryEntry struct {
	DeliverySequence string `json:"delivery_sequence"`
	DeliveryMethod   string `json:"delivery_method"`
	DeliveryDttm     string `json:"delivery_dttm"`
	LetakJanin       string `json:"letak_janin"`
	Kondisi          string `json:"kondisi"`
	UseManual        string `json:"use_manual"`
	UseForcep        string `json:"use_forcep"`
	UseVacuum        string `json:"use_vacuum"`
	// SHK (Skrining Hipotiroid Kongenital)
	ShkSpesimenAmbil string `json:"shk_spesimen_ambil,omitempty"`
	ShkLokasi        string `json:"shk_lokasi,omitempty"`
	ShkSpesimenDttm  string `json:"shk_spesimen_dttm,omitempty"`
	ShkAlasan        string `json:"shk_alasan,omitempty"`
}

// VentilatorDetail represents ventilator usage details
type VentilatorDetail struct {
	UseInd    string `json:"use_ind"`
	StartDttm string `json:"start_dttm"`
	StopDttm  string `json:"stop_dttm"`
}

// GrouperResult represents grouping result from E-Klaim
type GrouperResult struct {
	SEP string `json:"sep"`
	CBG struct {
		Code        string  `json:"code"`
		Description string  `json:"description"`
		Tariff      float64 `json:"tariff"`
		TariffBase  float64 `json:"tariff_base"`
		TopUpTariff float64 `json:"top_up_tariff"`
	} `json:"cbg"`
	HospitalTariff float64 `json:"hospital_tariff"`
	Difference     float64 `json:"difference"`
	GrouperVersion string  `json:"grouper_version"`
	DRGType        string  `json:"drg_type"`
	SeverityLevel  string  `json:"severity_level"`
}

// StatusRequest contains fields for get_claim_status
type StatusRequest struct {
	TglMasukFrom string `json:"tgl_masuk_from"`
	TglMasukTo   string `json:"tgl_masuk_to"`
	JenisRawat   string `json:"jenis_rawat"`
	Status       string `json:"status"`
}

// ==================== CORE METHODS ====================

// doRequest sends an encrypted request to E-Klaim local server and decrypts the response.
//
// Alur komunikasi (sesuai PHP reference):
//  1. Build JSON request
//  2. Encrypt JSON dengan AES-256-CBC (inacbg_encrypt)
//  3. POST encrypted payload dengan Content-Type: application/x-www-form-urlencoded
//  4. Receive encrypted response
//  5. Strip envelope markers (BEGIN/END ENCRYPTED DATA)
//  6. Decrypt response (inacbg_decrypt)
//  7. Parse JSON response
//
// Returns: parsed response, raw request JSON, raw response JSON, elapsed ms, error
func (c *Client) doRequest(method string, data interface{}) (*EKlaimResponse, []byte, []byte, int, error) {
	startTime := time.Now()

	// Build request JSON
	reqBody := EKlaimRequest{
		Metadata: EKlaimRequestMetadata{Method: method},
		Data:     data,
	}

	// For set_claim_data, metadata also needs nomor_sep
	if method == "set_claim_data" {
		if setData, ok := data.(*SetClaimDataData); ok && setData != nil {
			reqBody.Metadata.NomorSEP = setData.NomorSEP
		} else if setData, ok := data.(SetClaimDataData); ok {
			reqBody.Metadata.NomorSEP = setData.NomorSEP
		}
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, nil, nil, 0, fmt.Errorf("marshal request: %w", err)
	}

	// Encrypt the JSON payload
	encryptedPayload, err := Encrypt(string(jsonBody), c.SecretKey)
	if err != nil {
		return nil, jsonBody, nil, 0, fmt.Errorf("encrypt request: %w", err)
	}

	// Send as POST with x-www-form-urlencoded content type
	req, err := http.NewRequest("POST", c.BaseURL, strings.NewReader(encryptedPayload))
	if err != nil {
		return nil, jsonBody, nil, 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		elapsed := int(time.Since(startTime).Milliseconds())
		return nil, jsonBody, nil, elapsed, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	elapsed := int(time.Since(startTime).Milliseconds())
	if err != nil {
		return nil, jsonBody, nil, elapsed, fmt.Errorf("read response: %w", err)
	}

	// Strip envelope markers from response
	// Response format: "----BEGIN ENCRYPTED DATA----\r\n<encrypted>\r\n----END ENCRYPTED DATA----\r\n"
	strippedResponse := StripResponseEnvelope(string(respBody))

	// Decrypt response
	decryptedJSON, err := Decrypt(strippedResponse, c.SecretKey)
	if err != nil {
		return nil, jsonBody, respBody, elapsed, fmt.Errorf("decrypt response: %w (raw=%d bytes)", err, len(respBody))
	}

	// Parse decrypted JSON
	var result EKlaimResponse
	if err := json.Unmarshal([]byte(decryptedJSON), &result); err != nil {
		return nil, jsonBody, []byte(decryptedJSON), elapsed, fmt.Errorf("unmarshal response: %w", err)
	}

	codeStr := result.Metadata.Code.String()
	if codeInt, err := result.Metadata.Code.Int64(); err == nil {
		if codeInt != 200 && codeInt != 201 {
			return &result, jsonBody, []byte(decryptedJSON), elapsed, fmt.Errorf("eklaim error [%s]: %s",
				codeStr, result.Metadata.Message)
		}
	} else if codeStr != "200" && codeStr != "201" {
		return &result, jsonBody, []byte(decryptedJSON), elapsed, fmt.Errorf("eklaim error [%s]: %s",
			codeStr, result.Metadata.Message)
	}

	return &result, jsonBody, []byte(decryptedJSON), elapsed, nil
}

// doRequestRaw sends encrypted request and returns the raw decrypted PDF/binary response.
// Used for claim_print which returns base64-encoded PDF in the "data" field.
func (c *Client) doRequestRaw(method string, data interface{}) ([]byte, []byte, int, error) {
	startTime := time.Now()

	reqBody := EKlaimRequest{
		Metadata: EKlaimRequestMetadata{Method: method},
		Data:     data,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, jsonBody, 0, fmt.Errorf("marshal request: %w", err)
	}

	encryptedPayload, err := Encrypt(string(jsonBody), c.SecretKey)
	if err != nil {
		return nil, jsonBody, 0, fmt.Errorf("encrypt request: %w", err)
	}

	req, err := http.NewRequest("POST", c.BaseURL, strings.NewReader(encryptedPayload))
	if err != nil {
		return nil, jsonBody, 0, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		elapsed := int(time.Since(startTime).Milliseconds())
		return nil, jsonBody, elapsed, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	elapsed := int(time.Since(startTime).Milliseconds())
	if err != nil {
		return nil, jsonBody, elapsed, fmt.Errorf("read response: %w", err)
	}

	strippedResponse := StripResponseEnvelope(string(respBody))
	decrypted, err := Decrypt(strippedResponse, c.SecretKey)
	if err != nil {
		return nil, jsonBody, elapsed, fmt.Errorf("decrypt response: %w", err)
	}

	return []byte(decrypted), jsonBody, elapsed, nil
}

// ==================== API METHODS ====================

// Ping checks if the local server is reachable
func (c *Client) Ping() error {
	resp, err := c.HTTPClient.Get(c.BaseURL)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// NewClaim calls new_claim on the E-Klaim local server.
// Membuat klaim baru dengan data pasien dasar.
func (c *Client) NewClaim(data NewClaimData) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("new_claim", data)
}

// SetClaimData calls set_claim_data on the E-Klaim local server.
// Update/lengkapi data klaim (diagnosis, prosedur, tarif, dll).
func (c *Client) SetClaimData(data SetClaimDataData) (*EKlaimResponse, []byte, []byte, int, error) {
	if data.CoderNIK == "" {
		data.CoderNIK = c.CoderNIK
	}
	return c.doRequest("set_claim_data", data)
}

// Grouper calls grouper on the E-Klaim local server.
// Melakukan grouping INA-CBG/iDRG.
func (c *Client) Grouper(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("grouper", map[string]string{"nomor_sep": noSEP})
}

// GetClaimData calls get_claim_data on the E-Klaim local server.
// Mengambil data klaim yang sudah ada.
func (c *Client) GetClaimData(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("get_claim_data", map[string]string{"nomor_sep": noSEP})
}

// FinalClaim calls claim_final on the E-Klaim local server.
// Finalisasi klaim untuk diverifikasi.
func (c *Client) FinalClaim(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("claim_final", map[string]string{
		"nomor_sep": noSEP,
		"coder_nik": c.CoderNIK,
	})
}

// CancelClaim calls claim_cancel on the E-Klaim local server.
// Membatalkan finalisasi klaim.
func (c *Client) CancelClaim(noSEP, reason string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("claim_cancel", map[string]string{
		"nomor_sep": noSEP,
		"reason":    reason,
	})
}

// DeleteClaim calls delete_claim on the E-Klaim local server.
func (c *Client) DeleteClaim(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("delete_claim", map[string]string{"nomor_sep": noSEP})
}

// ClaimPrint calls claim_print on the E-Klaim local server.
// Response berisi PDF dalam base64. Gunakan doRequestRaw untuk mendapatkan data asli.
func (c *Client) ClaimPrint(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("claim_print", map[string]string{"nomor_sep": noSEP})
}

// ClaimPrintPDF calls claim_print and returns the decrypted raw response.
// The "data" field in the response is a base64-encoded PDF.
func (c *Client) ClaimPrintPDF(noSEP string) ([]byte, []byte, int, error) {
	return c.doRequestRaw("claim_print", map[string]string{"nomor_sep": noSEP})
}

// GetClaimStatus calls get_claim_status on the E-Klaim local server.
// Mengambil status verifikasi klaim dalam rentang tanggal.
func (c *Client) GetClaimStatus(req StatusRequest) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("get_claim_status", req)
}

// ReeditClaim calls reedit_claim on the E-Klaim local server.
// Re-edit klaim yang ditolak verifikator.
func (c *Client) ReeditClaim(noSEP, diagnosa, procedure, reason string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("reedit_claim", map[string]string{
		"nomor_sep": noSEP,
		"diagnosa":  diagnosa,
		"procedure": procedure,
		"coder_nik": c.CoderNIK,
		"reason":    reason,
	})
}

// SendSuplesi calls send_suplesi on the E-Klaim local server.
func (c *Client) SendSuplesi(noSEP, jenisSuplesi string, jumlahHari int, tarifSuplesi float64, keterangan string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("send_suplesi", map[string]interface{}{
		"nomor_sep":     noSEP,
		"jenis_suplesi": jenisSuplesi,
		"jumlah_hari":   jumlahHari,
		"tarif_suplesi": tarifSuplesi,
		"keterangan":    keterangan,
	})
}

// GenerateSEPInternal calls generate_sep_internal on the E-Klaim local server.
func (c *Client) GenerateSEPInternal(data map[string]interface{}) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("generate_sep_internal", data)
}
