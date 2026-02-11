package bpjs

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	lzstring "github.com/pieroxy/lz-string-go"
)

// VClaimClient adalah client untuk BPJS VClaim API
type VClaimClient struct {
	ConsID     string
	SecretKey  string
	UserKey    string
	KodePPK    string // Kode Faskes RS
	BaseURL    string
	HTTPClient *http.Client
}

// VClaimResponse adalah struktur response dari VClaim API
type VClaimResponse struct {
	MetaData struct {
		Code    interface{} `json:"code"`
		Message string      `json:"message"`
	} `json:"metaData"`
	Response interface{} `json:"response"`
}

// NewVClaimClient membuat VClaim client baru dari database config
func NewVClaimClient() (*VClaimClient, error) {
	var configs []models.IntegrationConfig

	// Coba ambil config khusus VClaim dulu
	if err := database.DB.Where("integration = ?", models.IntegrationTypeBPJSVClaim).Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("gagal load config VClaim: %w", err)
	}

	// Fallback ke config BPJS Antrian jika VClaim belum diset
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

	// Pilih base URL sesuai environment + VClaim path
	var baseURL string
	if environment == "production" {
		baseURL = configMap["base_url_prod"]
		if baseURL != "" {
			baseURL = baseURL + "/vclaim-rest"
		}
	} else {
		baseURL = configMap["base_url_dev"]
		if baseURL != "" {
			baseURL = baseURL + "/vclaim-rest-dev"
		}
	}

	fmt.Printf("[VClaim Client] Environment=%s, BaseURL=%s\n", environment, baseURL)

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

	return &VClaimClient{
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

// GenerateSignature membuat signature untuk VClaim
// Format: Base64(HMAC-SHA256(cons_id + "&" + timestamp, secret_key))
func (c *VClaimClient) GenerateSignature(timestamp string) string {
	data := c.ConsID + "&" + timestamp
	h := hmac.New(sha256.New, []byte(c.SecretKey))
	h.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// generateDecryptionKey membuat key untuk dekripsi response VClaim
func (c *VClaimClient) generateDecryptionKey(timestamp string) []byte {
	key := c.ConsID + c.SecretKey + timestamp
	h := sha256.Sum256([]byte(key))
	hexStr := hex.EncodeToString(h[:])
	result, _ := hex.DecodeString(hexStr)
	return result
}

// DecryptResponse mendekripsi response dari VClaim
func (c *VClaimClient) DecryptResponse(encryptedData string, timestamp string) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return nil, fmt.Errorf("base64 decode error: %w", err)
	}

	key := c.generateDecryptionKey(timestamp)
	iv := key[:16]

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("cipher error: %w", err)
	}

	if len(ciphertext) < aes.BlockSize {
		return nil, fmt.Errorf("ciphertext too short: %d", len(ciphertext))
	}

	mode := cipher.NewCBCDecrypter(block, iv)
	plaintext := make([]byte, len(ciphertext))
	mode.CryptBlocks(plaintext, ciphertext)

	decrypted := removePKCS7Padding(plaintext)

	// Decompress dengan LZString
	decompressed, err := lzstring.DecompressFromEncodedUriComponent(string(decrypted))
	if err != nil || decompressed == "" {
		return decrypted, nil
	}

	return []byte(decompressed), nil
}

// Request melakukan HTTP request ke VClaim API
func (c *VClaimClient) Request(method, endpoint string, body interface{}) ([]byte, int, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := c.GenerateSignature(timestamp)

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

	// Set headers untuk VClaim
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

	fmt.Printf("[VClaim Request] %s %s\n", method, fullURL)

	startTime := time.Now()
	resp, err := c.HTTPClient.Do(req)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		logVClaimSync(method, fullURL, reqBodyStr, "", http.StatusInternalServerError, int(duration), "Request failed: "+err.Error())
		return nil, 0, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		logVClaimSync(method, fullURL, reqBodyStr, "", resp.StatusCode, int(duration), "Read response error: "+err.Error())
		return nil, resp.StatusCode, fmt.Errorf("read response: %w", err)
	}

	fmt.Printf("[VClaim Response] Status=%d, BodyLen=%d\n", resp.StatusCode, len(respBody))

	if resp.StatusCode >= 400 {
		logVClaimSync(method, fullURL, reqBodyStr, string(respBody), resp.StatusCode, int(duration), fmt.Sprintf("HTTP %d", resp.StatusCode))
		return nil, resp.StatusCode, fmt.Errorf("server VClaim mengembalikan status: %d", resp.StatusCode)
	}

	var vclaimResp VClaimResponse
	if err := json.Unmarshal(respBody, &vclaimResp); err != nil {
		logVClaimSync(method, fullURL, reqBodyStr, string(respBody), resp.StatusCode, int(duration), "JSON parse error: "+err.Error())
		return respBody, resp.StatusCode, nil
	}

	code := 0
	switch v := vclaimResp.MetaData.Code.(type) {
	case float64:
		code = int(v)
	case string:
		code, _ = strconv.Atoi(v)
	case int:
		code = v
	}

	if code != 200 {
		errMsg := vclaimResp.MetaData.Message
		logVClaimSync(method, fullURL, reqBodyStr, string(respBody), code, int(duration), "VClaim error: "+errMsg)
		return nil, code, fmt.Errorf("VClaim error [%d]: %s", code, errMsg)
	}

	// Decrypt jika response berupa string encrypted
	// Skip decrypt untuk response yang bukan encrypted (seperti nomor SEP dari DELETE)
	if respStr, ok := vclaimResp.Response.(string); ok && len(respStr) > 0 {
		// Cek apakah string seperti nomor SEP (tidak perlu decrypt)
		// Nomor SEP biasanya format: 0301R0011017V000007
		if isLikelyPlainResponse(respStr) {
			logVClaimSync(method, fullURL, reqBodyStr, respStr, code, int(duration), "")
			return []byte(respStr), code, nil
		}

		decrypted, err := c.DecryptResponse(respStr, timestamp)
		if err != nil {
			logVClaimSync(method, fullURL, reqBodyStr, string(respBody), code, int(duration), "Decryption error: "+err.Error())
			return nil, code, fmt.Errorf("decrypt response: %w", err)
		}
		logVClaimSync(method, fullURL, reqBodyStr, string(decrypted), code, int(duration), "")
		return decrypted, code, nil
	}

	responseJSON, _ := json.Marshal(vclaimResp.Response)
	logVClaimSync(method, fullURL, reqBodyStr, string(responseJSON), code, int(duration), "")
	return responseJSON, code, nil
}

// isLikelyPlainResponse checks if response is plain text (not encrypted)
// Plain responses include: SEP numbers, simple status messages
func isLikelyPlainResponse(s string) bool {
	// Nomor SEP pattern: contains R and V with digits
	if len(s) < 50 && (strings.Contains(s, "R") || strings.Contains(s, "V")) {
		return true
	}
	// Short responses are usually not encrypted
	if len(s) < 30 {
		return true
	}
	return false
}

func logVClaimSync(method, endpoint, request, response string, statusCode int, durationMs int, errorMsg string) {
	now := time.Now()
	responseAt := now
	status := "success"
	if errorMsg != "" {
		status = "failed"
	}

	log := models.IntegrationSyncLog{
		Integration:  models.IntegrationTypeBPJSVClaim,
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

	fmt.Printf("[VClaim %s] %s %s - %dms - Status: %d\n", strings.ToUpper(status), method, endpoint, durationMs, statusCode)
}

// ==================== PESERTA ====================

// PesertaResponse adalah response data peserta
type PesertaResponse struct {
	Peserta struct {
		Cob struct {
			NmAsuransi *string `json:"nmAsuransi"`
			NoAsuransi *string `json:"noAsuransi"`
			TglTAT     *string `json:"tglTAT"`
			TglTMT     *string `json:"tglTMT"`
		} `json:"cob"`
		Nik      string `json:"nik"`
		NoKartu  string `json:"noKartu"`
		Nama     string `json:"nama"`
		Pisa     string `json:"pisa"`
		Sex      string `json:"sex"`
		HakKelas struct {
			Kode       string `json:"kode"`
			Keterangan string `json:"keterangan"`
		} `json:"hakKelas"`
		JenisPeserta struct {
			Kode       string `json:"kode"`
			Keterangan string `json:"keterangan"`
		} `json:"jenisPeserta"`
		Mr struct {
			NoMR      *string `json:"noMR"`
			NoTelepon *string `json:"noTelepon"`
		} `json:"mr"`
		ProvUmum struct {
			KdProvider *string `json:"kdProvider"`
			NmProvider *string `json:"nmProvider"`
		} `json:"provUmum"`
		StatusPeserta struct {
			Kode       string `json:"kode"`
			Keterangan string `json:"keterangan"`
		} `json:"statusPeserta"`
		TglCetakKartu string `json:"tglCetakKartu"`
		TglLahir      string `json:"tglLahir"`
		TglTAT        string `json:"tglTAT"`
		TglTMT        string `json:"tglTMT"`
		Umur          struct {
			UmurSekarang      string `json:"umurSekarang"`
			UmurSaatPelayanan string `json:"umurSaatPelayanan"`
		} `json:"umur"`
		Informasi struct {
			Dinsos      *string `json:"dinsos"`
			NoSKTM      *string `json:"noSKTM"`
			ProlanisPRB *string `json:"prolanisPRB"`
		} `json:"informasi"`
	} `json:"peserta"`
}

// GetPesertaByNoKartu mencari peserta berdasarkan nomor kartu BPJS
func (c *VClaimClient) GetPesertaByNoKartu(noKartu string, tglSEP string) (*PesertaResponse, error) {
	endpoint := fmt.Sprintf("/Peserta/nokartu/%s/tglSEP/%s", noKartu, tglSEP)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result PesertaResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse peserta response: %w", err)
	}

	return &result, nil
}

// GetPesertaByNIK mencari peserta berdasarkan NIK
func (c *VClaimClient) GetPesertaByNIK(nik string, tglSEP string) (*PesertaResponse, error) {
	endpoint := fmt.Sprintf("/Peserta/nik/%s/tglSEP/%s", nik, tglSEP)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result PesertaResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse peserta response: %w", err)
	}

	return &result, nil
}

// ==================== RUJUKAN ====================

// RujukanResponse adalah response data rujukan
type RujukanResponse struct {
	Rujukan struct {
		NoKunjungan  string `json:"noKunjungan"`
		TglKunjungan string `json:"tglKunjungan"`
		ProvPerujuk  struct {
			Kode string `json:"kode"`
			Nama string `json:"nama"`
		} `json:"provPerujuk"`
		Diagnosa struct {
			Kode string `json:"kode"`
			Nama string `json:"nama"`
		} `json:"diagnosa"`
		Poli struct {
			Kode string `json:"kode"`
			Nama string `json:"nama"`
		} `json:"poliRujukan"`
		Peserta struct {
			Cob struct {
				NmAsuransi string `json:"nmAsuransi"`
				NoAsuransi string `json:"noAsuransi"`
				TglTAT     string `json:"tglTAT"`
				TglTMT     string `json:"tglTMT"`
			} `json:"cob"`
			HakKelas struct {
				Kode string `json:"kode"`
				Nama string `json:"nama"`
			} `json:"hakKelas"`
			JenisPeserta struct {
				Kode string `json:"kode"`
				Nama string `json:"nama"`
			} `json:"jenisPeserta"`
			Nik      string `json:"nik"`
			NoKartu  string `json:"noKartu"`
			NoMr     string `json:"noMr"`
			Nama     string `json:"nama"`
			Sex      string `json:"sex"`
			TglLahir string `json:"tglLahir"`
		} `json:"peserta"`
		TglRujukanBerakhir string `json:"tglRujukanBerakhir"`
	} `json:"rujukan"`
	AsalFaskes string `json:"asalFaskes"` // "1" = Faskes 1, "2" = Faskes 2
}

// GetRujukanByNomor mendapatkan detail rujukan berdasarkan nomor rujukan
func (c *VClaimClient) GetRujukanByNomor(noRujukan string, asalFaskes string) (*RujukanResponse, error) {
	var endpoint string
	if asalFaskes == "2" {
		// Rujukan dari RS (Faskes 2)
		endpoint = fmt.Sprintf("/Rujukan/RS/Nomor/%s", noRujukan)
	} else {
		// Rujukan dari Faskes 1 (Puskesmas/Klinik)
		endpoint = fmt.Sprintf("/Rujukan/%s", noRujukan)
	}

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result RujukanResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse rujukan response: %w", err)
	}
	result.AsalFaskes = asalFaskes

	return &result, nil
}

// GetRujukanByPeserta mendapatkan list rujukan peserta
func (c *VClaimClient) GetRujukanByPeserta(noKartu string, asalFaskes string) ([]RujukanResponse, error) {
	var endpoint string
	if asalFaskes == "2" {
		endpoint = fmt.Sprintf("/Rujukan/RS/Peserta/%s", noKartu)
	} else {
		endpoint = fmt.Sprintf("/Rujukan/Peserta/%s", noKartu)
	}

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		Rujukan []RujukanResponse `json:"rujukan"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse rujukan list response: %w", err)
	}

	return result.Rujukan, nil
}

// ==================== SEP ====================

// SEPRequest adalah struktur request untuk insert SEP
type SEPRequest struct {
	Request struct {
		TSep SEPData `json:"t_sep"`
	} `json:"request"`
}

// SEPData adalah data SEP untuk insert/update
type SEPData struct {
	NoKartu       string        `json:"noKartu"`
	TglSep        string        `json:"tglSep"`
	PPKPelayanan  string        `json:"ppkPelayanan"`
	JnsPelayanan  string        `json:"jnsPelayanan"` // 1=Ranap, 2=Rajal
	KlsRawat      SEPKelasRawat `json:"klsRawat"`
	NoMR          string        `json:"noMR"`
	Rujukan       SEPRujukan    `json:"rujukan"`
	Catatan       string        `json:"catatan"`
	DiagAwal      string        `json:"diagAwal"`
	Poli          SEPPoli       `json:"poli"`
	Cob           SEPCob        `json:"cob"`
	Katarak       SEPKatarak    `json:"katarak"`
	Jaminan       SEPJaminan    `json:"jaminan"`
	TujuanKunj    string        `json:"tujuanKunj"`    // 0=Normal, 1=Prosedur, 2=Konsul Dokter
	FlagProcedure string        `json:"flagProcedure"` // 0=Tidak Berkelanjutan, 1=Berkelanjutan
	KdPenunjang   string        `json:"kdPenunjang"`   // 1-12 sesuai jenis penunjang
	AssesmentPel  string        `json:"assesmentPel"`  // 1-5 sesuai jenis
	SKDP          SEPSKDP       `json:"skdp"`
	DPJPLayan     string        `json:"dpjpLayan"`
	NoTelp        string        `json:"noTelp"`
	User          string        `json:"user"`
}

// SEPKelasRawat adalah data kelas rawat SEP
type SEPKelasRawat struct {
	KlsRawatHak     string `json:"klsRawatHak"`
	KlsRawatNaik    string `json:"klsRawatNaik"`
	Pembiayaan      string `json:"pembiayaan"`
	PenanggungJawab string `json:"penanggungJawab"`
}

// SEPRujukan adalah data rujukan SEP
type SEPRujukan struct {
	AsalRujukan string `json:"asalRujukan"` // 1=Faskes 1, 2=Faskes 2
	TglRujukan  string `json:"tglRujukan"`
	NoRujukan   string `json:"noRujukan"`
	PPKRujukan  string `json:"ppkRujukan"`
}

// SEPPoli adalah data poli SEP
type SEPPoli struct {
	Tujuan    string `json:"tujuan"`
	Eksekutif string `json:"eksekutif"` // 0=Tidak, 1=Ya
}

// SEPCob adalah data COB SEP
type SEPCob struct {
	Cob string `json:"cob"` // 0=Tidak, 1=Ya
}

// SEPKatarak adalah data katarak SEP
type SEPKatarak struct {
	Katarak string `json:"katarak"` // 0=Tidak, 1=Ya
}

// SEPJaminan adalah data jaminan/kecelakaan SEP
type SEPJaminan struct {
	LakaLantas string       `json:"lakaLantas"` // 0=BKLL, 1=KLL&BKK, 2=KLL&KK, 3=KK
	NoLP       string       `json:"noLP"`
	Penjamin   *SEPPenjamin `json:"penjamin"`
}

// SEPPenjamin adalah data penjamin kecelakaan
type SEPPenjamin struct {
	Penjamin    string      `json:"penjamin"` // 0=Tidak, 1=Ya (field baru)
	TglKejadian string      `json:"tglKejadian"`
	Keterangan  string      `json:"keterangan"`
	Suplesi     *SEPSuplesi `json:"suplesi"`
}

// SEPSuplesi adalah data suplesi
type SEPSuplesi struct {
	Suplesi      string         `json:"suplesi"` // 0=Tidak, 1=Ya
	NoSepSuplesi string         `json:"noSepSuplesi"`
	LokasiLaka   *SEPLokasiLaka `json:"lokasiLaka"`
}

// SEPLokasiLaka adalah data lokasi kecelakaan
type SEPLokasiLaka struct {
	KdPropinsi  string `json:"kdPropinsi"`
	KdKabupaten string `json:"kdKabupaten"`
	KdKecamatan string `json:"kdKecamatan"`
}

// SEPSKDP adalah data surat kontrol
type SEPSKDP struct {
	NoSurat  string `json:"noSurat"`
	KodeDPJP string `json:"kodeDPJP"`
}

// SEPResponse adalah response dari insert SEP (struktur sederhana)
type SEPResponse struct {
	Sep struct {
		NoSep        string `json:"noSep"`
		TglSep       string `json:"tglSep"`
		NoKartu      string `json:"noKartu"`
		Nama         string `json:"nama"`
		JnsPelayanan string `json:"jnsPelayanan"`
		KelasRawat   string `json:"kelasRawat"`
		Diagnosa     string `json:"diagnosa"`
		PoliTujuan   string `json:"poliTujuan"`
		Catatan      string `json:"catatan"`
	} `json:"sep"`
}

// GetSEPResponse adalah response dari GetSEP (struktur lengkap dari BPJS)
type GetSEPResponse struct {
	NoSep              string          `json:"noSep"`
	TglSep             string          `json:"tglSep"`
	JnsPelayanan       string          `json:"jnsPelayanan"`
	KelasRawat         string          `json:"kelasRawat"`
	Diagnosa           string          `json:"diagnosa"`
	NoRujukan          string          `json:"noRujukan"`
	Poli               string          `json:"poli"`
	PoliEksekutif      string          `json:"poliEksekutif"`
	Catatan            string          `json:"catatan"`
	KdStatusKecelakaan string          `json:"kdStatusKecelakaan"`
	NmstatusKecelakaan string          `json:"nmstatusKecelakaan"`
	Cob                string          `json:"cob"`
	Katarak            string          `json:"katarak"`
	ESEP               string          `json:"eSEP"`
	Penjamin           any             `json:"penjamin"`
	Peserta            *GetSEPPeserta  `json:"peserta"`
	KlsRawat           *GetSEPKlsRawat `json:"klsRawat"`
	Informasi          any             `json:"informasi"`
	Dpjp               *GetSEPDpjp     `json:"dpjp"`
	Kontrol            *GetSEPKontrol  `json:"kontrol"`
	LokasiKejadian     *GetSEPLokasi   `json:"lokasiKejadian"`
	TujuanKunj         *GetSEPTujuan   `json:"tujuanKunj"`
	FlagProcedure      *GetSEPTujuan   `json:"flagProcedure"`
	KdPenunjang        *GetSEPTujuan   `json:"kdPenunjang"`
	AssestmenPel       *GetSEPTujuan   `json:"assestmenPel"`
}

type GetSEPPeserta struct {
	NoKartu     string `json:"noKartu"`
	Nama        string `json:"nama"`
	TglLahir    string `json:"tglLahir"`
	NoMr        string `json:"noMr"`
	Kelamin     string `json:"kelamin"`
	JnsPeserta  string `json:"jnsPeserta"`
	HakKelas    string `json:"hakKelas"`
	Asuransi    any    `json:"asuransi"`
	StatusPRB   any    `json:"statusPRB"`
	PotensiPRB  string `json:"potensiPRB"`
	KdStatusPRB any    `json:"kdStatusPRB"`
}

type GetSEPKlsRawat struct {
	KlsRawatHak     string `json:"klsRawatHak"`
	KlsRawatNaik    any    `json:"klsRawatNaik"`
	Pembiayaan      any    `json:"pembiayaan"`
	PenanggungJawab any    `json:"penanggungJawab"`
}

type GetSEPDpjp struct {
	KdDPJP string `json:"kdDPJP"`
	NmDPJP string `json:"nmDPJP"`
}

type GetSEPKontrol struct {
	NoSurat  any `json:"noSurat"`
	KdDokter any `json:"kdDokter"`
	NmDokter any `json:"nmDokter"`
}

type GetSEPLokasi struct {
	TglKejadian any `json:"tglKejadian"`
	KdProp      any `json:"kdProp"`
	KdKab       any `json:"kdKab"`
	KdKec       any `json:"kdKec"`
	KetKejadian any `json:"ketKejadian"`
	Lokasi      any `json:"lokasi"`
}

type GetSEPTujuan struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}

// InsertSEP membuat SEP baru
func (c *VClaimClient) InsertSEP(data *SEPData) (*SEPResponse, error) {
	// Set default PPK Pelayanan dari config jika kosong
	if data.PPKPelayanan == "" {
		data.PPKPelayanan = c.KodePPK
	}

	reqBody := SEPRequest{}
	reqBody.Request.TSep = *data

	respBody, code, err := c.Request("POST", "/SEP/2.0/insert", reqBody)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result SEPResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse SEP response: %w", err)
	}

	return &result, nil
}

// UpdateSEPRequest adalah request untuk update SEP
type UpdateSEPRequest struct {
	Request struct {
		TSep struct {
			NoSep     string        `json:"noSep"`
			KlsRawat  SEPKelasRawat `json:"klsRawat"`
			NoMR      string        `json:"noMR"`
			Catatan   string        `json:"catatan"`
			DiagAwal  string        `json:"diagAwal"`
			Poli      SEPPoli       `json:"poli"`
			Cob       SEPCob        `json:"cob"`
			Katarak   SEPKatarak    `json:"katarak"`
			Jaminan   SEPJaminan    `json:"jaminan"`
			DPJPLayan string        `json:"dpjpLayan"`
			NoTelp    string        `json:"noTelp"`
			User      string        `json:"user"`
		} `json:"t_sep"`
	} `json:"request"`
}

// UpdateSEP mengupdate SEP yang sudah ada
func (c *VClaimClient) UpdateSEP(noSep string, data *SEPData) (*SEPResponse, error) {
	reqBody := UpdateSEPRequest{}
	reqBody.Request.TSep.NoSep = noSep
	reqBody.Request.TSep.KlsRawat = data.KlsRawat
	reqBody.Request.TSep.NoMR = data.NoMR
	reqBody.Request.TSep.Catatan = data.Catatan
	reqBody.Request.TSep.DiagAwal = data.DiagAwal
	reqBody.Request.TSep.Poli = data.Poli
	reqBody.Request.TSep.Cob = data.Cob
	reqBody.Request.TSep.Katarak = data.Katarak
	reqBody.Request.TSep.Jaminan = data.Jaminan
	reqBody.Request.TSep.DPJPLayan = data.DPJPLayan
	reqBody.Request.TSep.NoTelp = data.NoTelp
	reqBody.Request.TSep.User = data.User

	respBody, code, err := c.Request("PUT", "/SEP/2.0/update", reqBody)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result SEPResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse SEP response: %w", err)
	}

	return &result, nil
}

// DeleteSEPRequest adalah request untuk hapus SEP
type DeleteSEPRequest struct {
	Request struct {
		TSep struct {
			NoSep string `json:"noSep"`
			User  string `json:"user"`
		} `json:"t_sep"`
	} `json:"request"`
}

// DeleteSEP menghapus SEP
func (c *VClaimClient) DeleteSEP(noSep string, user string) error {
	reqBody := DeleteSEPRequest{}
	reqBody.Request.TSep.NoSep = noSep
	reqBody.Request.TSep.User = user

	_, code, err := c.Request("DELETE", "/SEP/2.0/delete", reqBody)
	if err != nil {
		return err
	}
	if code != 200 {
		return fmt.Errorf("VClaim response code: %d", code)
	}

	return nil
}

// ApprovalSEPRequest adalah request untuk approval SEP (backdate/finger print)
type ApprovalSEPRequest struct {
	Request struct {
		TSep struct {
			NoKartu      string `json:"noKartu"`
			TglSep       string `json:"tglSep"`
			JnsPelayanan string `json:"jnsPelayanan"` // 1=Rawat Inap, 2=Rawat Jalan
			JnsPengajuan string `json:"jnsPengajuan"` // 1=Backdate, 2=Finger Print
			Keterangan   string `json:"keterangan"`
			User         string `json:"user"`
		} `json:"t_sep"`
	} `json:"request"`
}

// ApprovalSEPResponse adalah response dari approval SEP
type ApprovalSEPResponse struct {
	NoKartu string `json:"noKartu,omitempty"` // Nomor kartu BPJS yang disetujui
	Message string `json:"message,omitempty"` // Pesan dari BPJS
}

// ApprovalSEP mengajukan approval SEP (backdate atau finger print)
// jnsPengajuan: 1=Backdate, 2=Finger Print (default: 1)
func (c *VClaimClient) ApprovalSEP(noKartu, tglSep, jnsPelayanan, jnsPengajuan, keterangan, user string) (*ApprovalSEPResponse, error) {
	// Default jnsPengajuan = 1 (Backdate)
	if jnsPengajuan == "" {
		jnsPengajuan = "1"
	}

	reqBody := ApprovalSEPRequest{}
	reqBody.Request.TSep.NoKartu = noKartu
	reqBody.Request.TSep.TglSep = tglSep
	reqBody.Request.TSep.JnsPelayanan = jnsPelayanan
	reqBody.Request.TSep.JnsPengajuan = jnsPengajuan
	reqBody.Request.TSep.Keterangan = keterangan
	reqBody.Request.TSep.User = user

	respBody, code, err := c.Request("POST", "/Sep/aprovalSEP", reqBody)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	// Response bisa berupa string (nomor kartu) atau JSON object
	// Coba parse sebagai JSON dulu, jika gagal anggap sebagai string plain
	var result ApprovalSEPResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		// Response adalah string plain (nomor kartu)
		result.NoKartu = strings.Trim(string(respBody), "\"")
		result.Message = "Pengajuan berhasil"
	}

	return &result, nil
}

// PengajuanSEP mengajukan pengajuan SEP (untuk SEP yang butuh approval)
// jnsPengajuan: 1=Backdate, 2=Finger Print
func (c *VClaimClient) PengajuanSEP(noKartu, tglSep, jnsPelayanan, jnsPengajuan, keterangan, user string) (*ApprovalSEPResponse, error) {
	reqBody := ApprovalSEPRequest{}
	reqBody.Request.TSep.NoKartu = noKartu
	reqBody.Request.TSep.TglSep = tglSep
	reqBody.Request.TSep.JnsPelayanan = jnsPelayanan
	reqBody.Request.TSep.JnsPengajuan = jnsPengajuan
	reqBody.Request.TSep.Keterangan = keterangan
	reqBody.Request.TSep.User = user

	respBody, code, err := c.Request("POST", "/Sep/pengajuanSEP", reqBody)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	// Response bisa berupa string (nomor kartu) atau JSON object
	// Coba parse sebagai JSON dulu, jika gagal anggap sebagai string plain
	var result ApprovalSEPResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		// Response adalah string plain (nomor kartu)
		result.NoKartu = strings.Trim(string(respBody), "\"")
		result.Message = "Pengajuan berhasil"
	}

	return &result, nil
}

// GetSEP mendapatkan detail SEP
func (c *VClaimClient) GetSEP(noSep string) (*GetSEPResponse, error) {
	endpoint := fmt.Sprintf("/SEP/%s", noSep)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result GetSEPResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse SEP response: %w", err)
	}

	return &result, nil
}

// ==================== REFERENSI ====================

// GetReferensiPoli mendapatkan referensi poli dari VClaim
func (c *VClaimClient) GetReferensiPoli(namaPoli string) ([]map[string]interface{}, error) {
	endpoint := fmt.Sprintf("/referensi/poli/%s", namaPoli)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		Poli []map[string]interface{} `json:"poli"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse poli response: %w", err)
	}

	return result.Poli, nil
}

// GetReferensiDiagnosa mendapatkan referensi diagnosa ICD-10
func (c *VClaimClient) GetReferensiDiagnosa(kodeDiagnosa string) ([]map[string]interface{}, error) {
	endpoint := fmt.Sprintf("/referensi/diagnosa/%s", kodeDiagnosa)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		Diagnosa []map[string]interface{} `json:"diagnosa"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse diagnosa response: %w", err)
	}

	return result.Diagnosa, nil
}

// GetReferensiFaskes mendapatkan referensi faskes
func (c *VClaimClient) GetReferensiFaskes(namaFaskes string, jenisFaskes string) ([]map[string]interface{}, error) {
	endpoint := fmt.Sprintf("/referensi/faskes/%s/%s", namaFaskes, jenisFaskes)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		Faskes []map[string]interface{} `json:"faskes"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse faskes response: %w", err)
	}

	return result.Faskes, nil
}

// GetReferensiPropinsi mendapatkan referensi propinsi dari VClaim
func (c *VClaimClient) GetReferensiPropinsi() ([]map[string]interface{}, error) {
	endpoint := "/referensi/propinsi"

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		List []map[string]interface{} `json:"list"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse propinsi response: %w", err)
	}

	return result.List, nil
}

// GetReferensiKabupaten mendapatkan referensi kabupaten berdasarkan kode propinsi
func (c *VClaimClient) GetReferensiKabupaten(kdPropinsi string) ([]map[string]interface{}, error) {
	endpoint := fmt.Sprintf("/referensi/kabupaten/propinsi/%s", kdPropinsi)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		List []map[string]interface{} `json:"list"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse kabupaten response: %w", err)
	}

	return result.List, nil
}

// GetReferensiKecamatan mendapatkan referensi kecamatan berdasarkan kode kabupaten
func (c *VClaimClient) GetReferensiKecamatan(kdKabupaten string) ([]map[string]interface{}, error) {
	endpoint := fmt.Sprintf("/referensi/kecamatan/kabupaten/%s", kdKabupaten)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		List []map[string]interface{} `json:"list"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse kecamatan response: %w", err)
	}

	return result.List, nil
}

// GetReferensiDokterDPJP mendapatkan referensi dokter DPJP
func (c *VClaimClient) GetReferensiDokterDPJP(jnsPelayanan, tglPelayanan, spesialis string) ([]map[string]interface{}, error) {
	endpoint := fmt.Sprintf("/referensi/dokter/pelayanan/%s/tglPelayanan/%s/Spesialis/%s", jnsPelayanan, tglPelayanan, spesialis)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		List []map[string]interface{} `json:"list"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse dokter response: %w", err)
	}

	return result.List, nil
}

// ==================== RENCANA KONTROL / SKDP ====================

// RencanaKontrolBySEPResponse adalah response dari get rencana kontrol by SEP
type RencanaKontrolBySEPResponse struct {
	NoSep        string `json:"noSep"`
	TglSep       string `json:"tglSep"`
	JnsPelayanan string `json:"jnsPelayanan"`
	Poli         string `json:"poli"`
	Diagnosa     string `json:"diagnosa"`
	Peserta      struct {
		NoKartu  string `json:"noKartu"`
		Nama     string `json:"nama"`
		TglLahir string `json:"tglLahir"`
		Kelamin  string `json:"kelamin"`
		HakKelas string `json:"hakKelas"`
	} `json:"peserta"`
	ProvUmum struct {
		KdProvider string `json:"kdProvider"`
		NmProvider string `json:"nmProvider"`
	} `json:"provUmum"`
	ProvPerujuk struct {
		KdProviderPerujuk string `json:"kdProviderPerujuk"`
		NmProviderPerujuk string `json:"nmProviderPerujuk"`
		AsalRujukan       string `json:"asalRujukan"`
		NoRujukan         string `json:"noRujukan"`
		TglRujukan        string `json:"tglRujukan"`
	} `json:"provPerujuk"`
}

// GetRencanaKontrolBySEP mendapatkan data rencana kontrol berdasarkan nomor SEP
// Digunakan untuk mengisi field SKDP saat create SEP rawat inap
func (c *VClaimClient) GetRencanaKontrolBySEP(noSEP string) (*RencanaKontrolBySEPResponse, error) {
	endpoint := fmt.Sprintf("/RencanaKontrol/nosep/%s", noSEP)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result RencanaKontrolBySEPResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse rencana kontrol response: %w", err)
	}

	return &result, nil
}

// ListRencanaKontrolResponse adalah response dari list rencana kontrol
type ListRencanaKontrolItem struct {
	NoSuratKontrol    string `json:"noSuratKontrol"`
	JnsPelayanan      string `json:"jnsPelayanan"`   // "Rawat Inap" / "Rawat Jalan"
	JnsKontrol        string `json:"jnsKontrol"`     // Kode jenis kontrol
	NamaJnsKontrol    string `json:"namaJnsKontrol"` // "Surat Kontrol"
	TglRencanaKontrol string `json:"tglRencanaKontrol"`
	TglTerbitKontrol  string `json:"tglTerbitKontrol"`
	NoSepAsalKontrol  string `json:"noSepAsalKontrol"`
	PoliAsal          string `json:"poliAsal"`
	NamaPoliAsal      string `json:"namaPoliAsal"`
	PoliTujuan        string `json:"poliTujuan"`
	NamaPoliTujuan    string `json:"namaPoliTujuan"`
	TglSEP            string `json:"tglSEP"`
	KodeDokter        string `json:"kodeDokter"`
	NamaDokter        string `json:"namaDokter"`
	NoKartu           string `json:"noKartu"`
	Nama              string `json:"nama"`
	TerbitSEP         string `json:"terbitSEP"` // "Belum" / "Sudah"
}

// GetListRencanaKontrolByNoKartu mendapatkan list rencana kontrol berdasarkan nomor kartu
// Untuk filter: 1=Tanggal Rencana Kontrol, 2=Tanggal Entry
func (c *VClaimClient) GetListRencanaKontrolByNoKartu(noKartu, bulan, tahun, filter string) ([]ListRencanaKontrolItem, error) {
	endpoint := fmt.Sprintf("/RencanaKontrol/ListRencanaKontrol/Bulan/%s/Tahun/%s/Nokartu/%s/filter/%s", bulan, tahun, noKartu, filter)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		List []ListRencanaKontrolItem `json:"list"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse list rencana kontrol response: %w", err)
	}

	return result.List, nil
}

// ==================== SPRI (Surat Perintah Rawat Inap) ====================

// SPRIRequest adalah struktur request untuk insert SPRI
type SPRIRequest struct {
	Request struct {
		NoKartu           string `json:"noKartu"`
		KodeDokter        string `json:"kodeDokter"`
		PoliKontrol       string `json:"poliKontrol"`
		TglRencanaKontrol string `json:"tglRencanaKontrol"`
		User              string `json:"user"`
	} `json:"request"`
}

// SPRIResponse adalah response dari insert SPRI
type SPRIResponse struct {
	NoSPRI            string `json:"noSPRI"`
	TglRencanaKontrol string `json:"tglRencanaKontrol"`
	NamaDokter        string `json:"namaDokter"`
	NoKartu           string `json:"noKartu"`
	Nama              string `json:"nama"`
	Kelamin           string `json:"kelamin"`
	TglLahir          string `json:"tglLahir"`
	NamaDiagnosa      string `json:"namaDiagnosa"`
}

// InsertSPRI membuat SPRI (Surat Perintah Rawat Inap)
func (c *VClaimClient) InsertSPRI(noKartu, kodeDokter, poliKontrol, tglRencanaKontrol, user string) (*SPRIResponse, error) {
	reqBody := SPRIRequest{}
	reqBody.Request.NoKartu = noKartu
	reqBody.Request.KodeDokter = kodeDokter
	reqBody.Request.PoliKontrol = poliKontrol
	reqBody.Request.TglRencanaKontrol = tglRencanaKontrol
	reqBody.Request.User = user

	respBody, code, err := c.Request("POST", "/RencanaKontrol/InsertSPRI", reqBody)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result SPRIResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse SPRI response: %w", err)
	}

	return &result, nil
}

// ==================== SURAT KONTROL (SKDP Rawat Jalan) ====================

// SuratKontrolRequest adalah struktur request untuk insert surat kontrol
type SuratKontrolRequest struct {
	Request struct {
		NoSEP             string           `json:"noSEP"`
		KodeDokter        string           `json:"kodeDokter"`
		PoliKontrol       string           `json:"poliKontrol"`
		TglRencanaKontrol string           `json:"tglRencanaKontrol"`
		User              string           `json:"user"`
		FormPRB           *SuratKontrolPRB `json:"formPRB,omitempty"`
	} `json:"request"`
}

// SuratKontrolPRB adalah data PRB untuk surat kontrol
type SuratKontrolPRB struct {
	KdStatusPRB string                 `json:"kdStatusPRB"`
	Data        map[string]interface{} `json:"data"`
}

// SuratKontrolResponse adalah response dari insert surat kontrol
type SuratKontrolResponse struct {
	NoSuratKontrol    string           `json:"noSuratKontrol"`
	TglRencanaKontrol string           `json:"tglRencanaKontrol"`
	NamaDokter        string           `json:"namaDokter"`
	NoKartu           string           `json:"noKartu"`
	Nama              string           `json:"nama"`
	Kelamin           string           `json:"kelamin"`
	TglLahir          string           `json:"tglLahir"`
	NamaDiagnosa      string           `json:"namaDiagnosa"`
	FormPRB           *SuratKontrolPRB `json:"formPRB,omitempty"`
}

// InsertSuratKontrol membuat Surat Kontrol (SKDP) untuk rawat jalan
// version: "v1" untuk endpoint lama (tanpa PRB), "v2" untuk endpoint baru (dengan PRB)
func (c *VClaimClient) InsertSuratKontrol(noSEP, kodeDokter, poliKontrol, tglRencanaKontrol, user string, formPRB *SuratKontrolPRB, version string) (*SuratKontrolResponse, error) {
	reqBody := SuratKontrolRequest{}
	reqBody.Request.NoSEP = noSEP
	reqBody.Request.KodeDokter = kodeDokter
	reqBody.Request.PoliKontrol = poliKontrol
	reqBody.Request.TglRencanaKontrol = tglRencanaKontrol
	reqBody.Request.User = user

	// Determine endpoint based on version
	var endpoint string
	if version == "v1" {
		// V1: /RencanaKontrol/insert (tanpa PRB)
		endpoint = "/RencanaKontrol/insert"
	} else {
		// V2: /RencanaKontrol/v2/Insert (dengan PRB)
		endpoint = "/RencanaKontrol/v2/Insert"
		if formPRB != nil && formPRB.KdStatusPRB != "" {
			reqBody.Request.FormPRB = formPRB
		}
	}

	respBody, code, err := c.Request("POST", endpoint, reqBody)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result SuratKontrolResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse surat kontrol response: %w", err)
	}

	return &result, nil
}

// UpdateSuratKontrol mengupdate surat kontrol
// Endpoint: PUT /RencanaKontrol/v2/Update
func (c *VClaimClient) UpdateSuratKontrol(noSuratKontrol, noSEP, kodeDokter, poliKontrol, tglRencanaKontrol, user string) (*SuratKontrolResponse, error) {
	reqBody := map[string]interface{}{
		"request": map[string]interface{}{
			"noSuratKontrol":    noSuratKontrol,
			"noSEP":             noSEP,
			"kodeDokter":        kodeDokter,
			"poliKontrol":       poliKontrol,
			"tglRencanaKontrol": tglRencanaKontrol,
			"user":              user,
		},
	}

	respBody, code, err := c.Request("PUT", "/RencanaKontrol/v2/Update", reqBody)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result SuratKontrolResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse update surat kontrol response: %w", err)
	}

	return &result, nil
}

// DeleteSuratKontrol menghapus surat kontrol
// Endpoint: DELETE /RencanaKontrol/Delete
// Request body format sesuai dokumentasi BPJS:
//
//	{
//	  "request": {
//	    "t_suratkontrol": {
//	      "noSuratKontrol": "xxx",
//	      "user": "xxx"
//	    }
//	  }
//	}
func (c *VClaimClient) DeleteSuratKontrol(noSuratKontrol, user string) error {
	reqBody := map[string]interface{}{
		"request": map[string]interface{}{
			"t_suratkontrol": map[string]interface{}{
				"noSuratKontrol": noSuratKontrol,
				"user":           user,
			},
		},
	}

	_, code, err := c.Request("DELETE", "/RencanaKontrol/Delete", reqBody)
	if err != nil {
		return err
	}
	if code != 200 {
		return fmt.Errorf("VClaim response code: %d", code)
	}

	return nil
}

// ==================== SURAT KONTROL DETAIL ====================

// SuratKontrolDetailResponse adalah response detail surat kontrol
type SuratKontrolDetailResponse struct {
	NoSuratKontrol    string `json:"noSuratKontrol"`
	TglRencanaKontrol string `json:"tglRencanaKontrol"`
	TglTerbit         string `json:"tglTerbit"`
	JnsKontrol        string `json:"jnsKontrol"`        // 1=SPRI, 2=Kontrol
	PoliTujuan        string `json:"poliTujuan"`        // Kode poli
	NamaPoliTujuan    string `json:"namaPoliTujuan"`    // Nama poli
	KodeDokter        string `json:"kodeDokter"`        // Kode dokter
	NamaDokter        string `json:"namaDokter"`        // Nama dokter
	FlagKontrol       string `json:"flagKontrol"`       // True/False - sudah terbit SEP atau belum
	KodeDokterPembuat string `json:"kodeDokterPembuat"` // Kode dokter pembuat
	NamaDokterPembuat string `json:"namaDokterPembuat"` // Nama dokter pembuat
	NamaJnsKontrol    string `json:"namaJnsKontrol"`    // "SPRI" atau "Kontrol"
	Sep               *struct {
		NoSep        string `json:"noSep"`
		TglSep       string `json:"tglSep"`
		JnsPelayanan string `json:"jnsPelayanan"`
		Poli         string `json:"poli"`
		Diagnosa     string `json:"diagnosa"`
		Peserta      struct {
			NoKartu  string `json:"noKartu"`
			Nama     string `json:"nama"`
			TglLahir string `json:"tglLahir"`
			Kelamin  string `json:"kelamin"`
			HakKelas string `json:"hakKelas"`
		} `json:"peserta"`
		ProvUmum struct {
			KdProvider string `json:"kdProvider"`
			NmProvider string `json:"nmProvider"`
		} `json:"provUmum"`
		ProvPerujuk struct {
			KdProviderPerujuk string `json:"kdProviderPerujuk"`
			NmProviderPerujuk string `json:"nmProviderPerujuk"`
			AsalRujukan       string `json:"asalRujukan"`
			NoRujukan         string `json:"noRujukan"`
			TglRujukan        string `json:"tglRujukan"`
		} `json:"provPerujuk"`
	} `json:"sep"` // Null jika jnsKontrol=1 (SPRI)
}

// GetSuratKontrolDetail mendapatkan detail surat kontrol berdasarkan nomor surat kontrol
func (c *VClaimClient) GetSuratKontrolDetail(noSuratKontrol string) (*SuratKontrolDetailResponse, error) {
	endpoint := fmt.Sprintf("/RencanaKontrol/noSuratKontrol/%s", noSuratKontrol)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result SuratKontrolDetailResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse surat kontrol detail response: %w", err)
	}

	return &result, nil
}

// GetPoliKontrolSPRI mendapatkan referensi poli untuk SPRI (rawat inap)
func (c *VClaimClient) GetPoliKontrolSPRI(namaPoli string, jnsPelayanan string) ([]map[string]interface{}, error) {
	// Gunakan jnsPelayanan = 1 untuk rawat inap
	if jnsPelayanan == "" {
		jnsPelayanan = "1" // Default rawat inap
	}
	endpoint := fmt.Sprintf("/referensi/poli/%s", namaPoli)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		Poli []map[string]interface{} `json:"poli"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse poli response: %w", err)
	}

	return result.Poli, nil
}

// GetDokterSPRI mendapatkan referensi dokter untuk SPRI
func (c *VClaimClient) GetDokterSPRI(kodePoli string, tglPelayanan string) ([]map[string]interface{}, error) {
	// Gunakan jnsPelayanan = 1 untuk rawat inap
	jnsPelayanan := "1"
	endpoint := fmt.Sprintf("/referensi/dokter/pelayanan/%s/tglPelayanan/%s/Spesialis/%s", jnsPelayanan, tglPelayanan, kodePoli)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		List []map[string]interface{} `json:"list"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse dokter response: %w", err)
	}

	return result.List, nil
}

// PersetujuanSEPItem adalah item dalam list persetujuan SEP
type PersetujuanSEPItem struct {
	NoKartu      string `json:"noKartu"`
	Nama         string `json:"nama"`
	TglSEP       string `json:"tglsep"`
	JnsPelayanan string `json:"jnspelayanan"`
	Persetujuan  string `json:"persetujuan"`
	Status       string `json:"status"`
}

// GetListPersetujuanSEP mendapatkan daftar SEP yang butuh persetujuan (approval)
func (c *VClaimClient) GetListPersetujuanSEP(bulan, tahun string) ([]PersetujuanSEPItem, error) {
	endpoint := fmt.Sprintf("/Sep/persetujuanSEP/list/bulan/%s/tahun/%s", bulan, tahun)

	respBody, code, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	if code != 200 {
		return nil, fmt.Errorf("VClaim response code: %d", code)
	}

	var result struct {
		List []PersetujuanSEPItem `json:"list"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse persetujuan SEP response: %w", err)
	}

	return result.List, nil
}
