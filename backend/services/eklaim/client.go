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
	NomorSEP string `json:"nomor_sep,omitempty"` // Required for set_claim_data, diagnosa_set, procedure_set
	NomorRM  string `json:"nomor_rm,omitempty"`  // Required for update_patient
	Stage    string `json:"stage,omitempty"`     // "1" or "2" for grouper
	Grouper  string `json:"grouper,omitempty"`   // "idrg" or "inacbg" for grouper
}

// EKlaimResponse is the standard response envelope from E-Klaim API
// Note: E-Klaim server returns code as number (200, 400), not string.
// Different methods return responses in different top-level fields:
//   - response: new_claim, set_claim_data, send_claim_individual
//   - response_idrg: grouper with grouper="idrg"
//   - response_inacbg: grouper with grouper="inacbg"
//   - special_cmg_option: INACBG grouper stage 1 & 2
//   - data: *_diagnosa_set, *_procedure_set, *_diagnosa_get, *_procedure_get, idrg_to_inacbg_import
type EKlaimResponse struct {
	Metadata struct {
		Code    json.Number `json:"code"`
		Message string      `json:"message"`
		ErrorNo string      `json:"error_no,omitempty"`
		Method  string      `json:"method,omitempty"`
	} `json:"metadata"`
	Response         json.RawMessage `json:"response,omitempty"`
	ResponseIDRG     json.RawMessage `json:"response_idrg,omitempty"`
	ResponseINACBG   json.RawMessage `json:"response_inacbg,omitempty"`
	SpecialCMGOption json.RawMessage `json:"special_cmg_option,omitempty"`
	Data             json.RawMessage `json:"data,omitempty"`
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

// GrouperResult represents grouping result from E-Klaim (legacy format)
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

// ==================== iDRG/INACBG RESPONSE TYPES ====================

// IDRGGrouperResult represents iDRG grouper response from response_idrg field
type IDRGGrouperResult struct {
	MDCNumber       string `json:"mdc_number"`
	MDCDescription  string `json:"mdc_description"`
	DRGCode         string `json:"drg_code"`
	DRGDescription  string `json:"drg_description"`
	ScriptVersion   string `json:"script_version"`
	LogicVersion    string `json:"logic_version"`
	CostWeight      string `json:"cost_weight"`
	SubAcuteWeight  string `json:"sub_acute_weight"`
	ChronicWeight   string `json:"chronic_weight"`
	TotalCostWeight string `json:"total_cost_weight"`
	NBR             string `json:"nbr"`
	StatusCd        string `json:"status_cd"` // "normal" or error
}

// INACBGGrouperResult represents INACBG grouper response from response_inacbg field
type INACBGGrouperResult struct {
	CBG struct {
		Code        string `json:"code"`
		Description string `json:"description"`
	} `json:"cbg"`
	BaseTariff    string           `json:"base_tariff"`
	Tariff        string           `json:"tariff"`
	SpecialCMG    []SpecialCMGItem `json:"special_cmg,omitempty"` // only in stage 2
	Kelas         string           `json:"kelas"`
	INACBGVersion string           `json:"inacbg_version"`
	StatusCd      string           `json:"status_cd"`
}

// SpecialCMGOption is an option returned by INACBG grouper stage 1/2
type SpecialCMGOption struct {
	Code        string `json:"code"`
	Description string `json:"description"`
	Type        string `json:"type"` // "Special Prosthesis" or "Special Procedure"
}

// SpecialCMGItem is a selected CMG item with tariff in stage 2 response
type SpecialCMGItem struct {
	Code        string  `json:"code"`
	Description string  `json:"description"`
	Tariff      float64 `json:"tariff"`
	Type        string  `json:"type"`
}

// CodingExpandedItem represents one code in a diagnosa/procedure set/get response
type CodingExpandedItem struct {
	Code         string `json:"code"`
	Display      string `json:"display"`
	Multiplicity int    `json:"multiplicity,omitempty"` // only for procedures
	No           string `json:"no"`
	ValidCode    string `json:"validcode"`
	Metadata     struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		ErrorNo string `json:"error_no,omitempty"`
	} `json:"metadata"`
}

// CodingSetResponse is the data field of diagnosa_set/procedure_set/get responses
type CodingSetResponse struct {
	String   string               `json:"string"`
	Expanded []CodingExpandedItem `json:"expanded"`
}

// ImportINACBGResponse is the data field of idrg_to_inacbg_import response
type ImportINACBGResponse struct {
	Diagnosa  CodingSetResponse `json:"diagnosa"`
	Procedure CodingSetResponse `json:"procedure"`
}

// SearchResult represents the response of search_diagnosis/search_procedures
type SearchResult struct {
	Count int        `json:"count"`
	Data  [][]string `json:"data"` // [[description, code], ...]
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
// This is a convenience wrapper around doRequestFull that constructs metadata from a method string.
func (c *Client) doRequest(method string, data interface{}) (*EKlaimResponse, []byte, []byte, int, error) {
	meta := EKlaimRequestMetadata{Method: method}
	// For set_claim_data, metadata also needs nomor_sep
	if method == "set_claim_data" {
		if setData, ok := data.(*SetClaimDataData); ok && setData != nil {
			meta.NomorSEP = setData.NomorSEP
		} else if setData, ok := data.(SetClaimDataData); ok {
			meta.NomorSEP = setData.NomorSEP
		}
	}
	return c.doRequestFull(meta, data)
}

// doRequestFull sends an encrypted request to E-Klaim local server and decrypts the response.
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
func (c *Client) doRequestFull(meta EKlaimRequestMetadata, data interface{}) (*EKlaimResponse, []byte, []byte, int, error) {
	startTime := time.Now()

	// Build request JSON
	reqBody := EKlaimRequest{
		Metadata: meta,
		Data:     data,
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

// UpdatePatient calls update_patient on the E-Klaim local server.
// Memperbarui data pasien pada klaim yang sudah dibuat.
// E-Klaim requires nomor_rm in metadata for update_patient.
func (c *Client) UpdatePatient(data NewClaimData) (*EKlaimResponse, []byte, []byte, int, error) {
	meta := EKlaimRequestMetadata{
		Method:  "update_patient",
		NomorRM: data.NomorRM,
	}
	return c.doRequestFull(meta, data)
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

// ==================== iDRG API METHODS ====================

// IDRGDiagnosaSet sets iDRG diagnoses. Codes separated by "#" (e.g. "S71.0#S87.9#E11.9")
func (c *Client) IDRGDiagnosaSet(noSEP, diagnosa string) (*EKlaimResponse, []byte, []byte, int, error) {
	meta := EKlaimRequestMetadata{Method: "idrg_diagnosa_set", NomorSEP: noSEP}
	return c.doRequestFull(meta, map[string]string{"diagnosa": diagnosa})
}

// IDRGDiagnosaGet retrieves current iDRG diagnoses.
func (c *Client) IDRGDiagnosaGet(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("idrg_diagnosa_get", map[string]string{"nomor_sep": noSEP})
}

// IDRGProcedureSet sets iDRG procedures. Codes separated by "#", multiplicity via "+N" (e.g. "81.51#86.28+2#91.799")
func (c *Client) IDRGProcedureSet(noSEP, procedure string) (*EKlaimResponse, []byte, []byte, int, error) {
	meta := EKlaimRequestMetadata{Method: "idrg_procedure_set", NomorSEP: noSEP}
	return c.doRequestFull(meta, map[string]string{"procedure": procedure})
}

// IDRGProcedureGet retrieves current iDRG procedures.
func (c *Client) IDRGProcedureGet(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("idrg_procedure_get", map[string]string{"nomor_sep": noSEP})
}

// GrouperIDRG runs iDRG grouping. Response in ResponseIDRG field.
func (c *Client) GrouperIDRG(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	meta := EKlaimRequestMetadata{Method: "grouper", Stage: "1", Grouper: "idrg"}
	return c.doRequestFull(meta, map[string]string{"nomor_sep": noSEP})
}

// FinalIDRG finalizes iDRG grouping.
func (c *Client) FinalIDRG(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("idrg_grouper_final", map[string]string{"nomor_sep": noSEP})
}

// ReeditIDRG re-opens iDRG for editing (unfinal).
func (c *Client) ReeditIDRG(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("idrg_grouper_reedit", map[string]string{"nomor_sep": noSEP})
}

// ==================== iDRG TO INACBG ====================

// IDRGToINACBGImport imports iDRG coding to INACBG.
func (c *Client) IDRGToINACBGImport(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("idrg_to_inacbg_import", map[string]string{"nomor_sep": noSEP})
}

// ==================== INACBG API METHODS ====================

// INACBGDiagnosaSet sets INACBG diagnoses. Codes separated by "#".
func (c *Client) INACBGDiagnosaSet(noSEP, diagnosa string) (*EKlaimResponse, []byte, []byte, int, error) {
	meta := EKlaimRequestMetadata{Method: "inacbg_diagnosa_set", NomorSEP: noSEP}
	return c.doRequestFull(meta, map[string]string{"diagnosa": diagnosa})
}

// INACBGDiagnosaGet retrieves current INACBG diagnoses.
func (c *Client) INACBGDiagnosaGet(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("inacbg_diagnosa_get", map[string]string{"nomor_sep": noSEP})
}

// INACBGProcedureSet sets INACBG procedures. Codes separated by "#". No multiplicity.
func (c *Client) INACBGProcedureSet(noSEP, procedure string) (*EKlaimResponse, []byte, []byte, int, error) {
	meta := EKlaimRequestMetadata{Method: "inacbg_procedure_set", NomorSEP: noSEP}
	return c.doRequestFull(meta, map[string]string{"procedure": procedure})
}

// INACBGProcedureGet retrieves current INACBG procedures.
func (c *Client) INACBGProcedureGet(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("inacbg_procedure_get", map[string]string{"nomor_sep": noSEP})
}

// GrouperINACBGStage1 runs INACBG grouping stage 1. Returns CBG code + special_cmg_option.
func (c *Client) GrouperINACBGStage1(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	meta := EKlaimRequestMetadata{Method: "grouper", Stage: "1", Grouper: "inacbg"}
	return c.doRequestFull(meta, map[string]string{"nomor_sep": noSEP})
}

// GrouperINACBGStage2 runs INACBG grouping stage 2 with selected special CMG codes ("#"-separated).
func (c *Client) GrouperINACBGStage2(noSEP, specialCMG string) (*EKlaimResponse, []byte, []byte, int, error) {
	meta := EKlaimRequestMetadata{Method: "grouper", Stage: "2", Grouper: "inacbg"}
	return c.doRequestFull(meta, map[string]string{"nomor_sep": noSEP, "special_cmg": specialCMG})
}

// FinalINACBG finalizes INACBG grouping.
func (c *Client) FinalINACBG(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("inacbg_grouper_final", map[string]string{"nomor_sep": noSEP})
}

// ReeditINACBG re-opens INACBG for editing (unfinal).
func (c *Client) ReeditINACBG(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("inacbg_grouper_reedit", map[string]string{"nomor_sep": noSEP})
}

// ==================== CLAIM SEND / RE-EDIT ====================

// SendClaimIndividual sends finalized claim to BPJS.
func (c *Client) SendClaimIndividual(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("send_claim_individual", map[string]string{"nomor_sep": noSEP})
}

// ReeditClaimSimple re-opens a finalized claim for editing.
func (c *Client) ReeditClaimSimple(noSEP string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("reedit_claim", map[string]string{"nomor_sep": noSEP})
}

// ==================== SEARCH API METHODS ====================

// SearchDiagnosisIDRG searches iDRG diagnoses by keyword.
func (c *Client) SearchDiagnosisIDRG(keyword string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("search_diagnosis_inagrouper", map[string]string{"keyword": keyword})
}

// SearchProceduresIDRG searches iDRG procedures by keyword.
func (c *Client) SearchProceduresIDRG(keyword string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("search_procedures_inagrouper", map[string]string{"keyword": keyword})
}

// SearchDiagnosisINACBG searches INACBG diagnoses by keyword.
func (c *Client) SearchDiagnosisINACBG(keyword string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("search_diagnosis", map[string]string{"keyword": keyword})
}

// SearchProceduresINACBG searches INACBG procedures by keyword.
func (c *Client) SearchProceduresINACBG(keyword string) (*EKlaimResponse, []byte, []byte, int, error) {
	return c.doRequest("search_procedures", map[string]string{"keyword": keyword})
}
