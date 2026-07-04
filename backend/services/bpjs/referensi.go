package bpjs

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// ===============================
// REFERENSI DATA STRUCTURES
// ===============================

// BPJSPoli represents poli data from BPJS
type BPJSPoli struct {
	KodePoli         string `json:"kdpoli"`
	NamaPoli         string `json:"nmpoli"`
	KodeSubspesialis string `json:"kdsubspesialis"`
	NamaSubspesialis string `json:"nmsubspesialis"`
}

// BPJSDokter represents dokter data from BPJS
type BPJSDokter struct {
	KodeDokter int    `json:"kodedokter"`
	NamaDokter string `json:"namadokter"`
}

// BPJSJadwalDokter represents jadwal dokter from BPJS
type BPJSJadwalDokter struct {
	KodePoli         string `json:"kodepoli"`
	NamaPoli         string `json:"namapoli"`
	KodeSubspesialis string `json:"kodesubspesialis"`
	NamaSubspesialis string `json:"namasubspesialis"`
	KodeDokter       int    `json:"kodedokter"`
	NamaDokter       string `json:"namadokter"`
	Hari             int    `json:"hari"`
	NamaHari         string `json:"namahari"`
	Jadwal           string `json:"jadwal"`
	KapasitasPasien  int    `json:"kapasitaspasien"`
	Libur            int    `json:"libur"`
}

// ListResponse wraps list response from BPJS
type ListResponse struct {
	List json.RawMessage `json:"list"`
}

type referensiEnvelope struct {
	MetaData struct {
		Code    interface{} `json:"code"`
		Message string      `json:"message"`
	} `json:"metadata"`
	Response interface{} `json:"response"`
}

func (c *Client) requestReferensiList(endpoint string) (json.RawMessage, error) {
	start := time.Now()
	timestamp := strconv.FormatInt(start.Unix(), 10)
	signature := c.GenerateSignature(timestamp)

	fullURL := c.BaseURL + endpoint
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create referensi request: %w", err)
	}

	req.Header.Set("X-cons-id", c.ConsID)
	req.Header.Set("X-timestamp", timestamp)
	req.Header.Set("X-signature", signature)
	req.Header.Set("user_key", c.UserKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTPClient.Do(req)
	duration := time.Since(start).Milliseconds()
	if err != nil {
		logSync("GET", fullURL, "", "", http.StatusInternalServerError, int(duration), "Request failed: "+err.Error())
		return nil, fmt.Errorf("execute referensi request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logSync("GET", fullURL, "", "", resp.StatusCode, int(duration), "Read response error: "+err.Error())
		return nil, fmt.Errorf("read referensi response: %w", err)
	}

	if resp.StatusCode >= http.StatusBadRequest {
		logSync("GET", fullURL, "", string(body), resp.StatusCode, int(duration), fmt.Sprintf("HTTP %d", resp.StatusCode))
		return nil, fmt.Errorf("server BPJS mengembalikan status: %d", resp.StatusCode)
	}

	var envelope referensiEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		logSync("GET", fullURL, "", string(body), resp.StatusCode, int(duration), "JSON parse error: "+err.Error())
		return nil, fmt.Errorf("parse referensi envelope: %w", err)
	}

	code := 0
	switch v := envelope.MetaData.Code.(type) {
	case float64:
		code = int(v)
	case string:
		code, _ = strconv.Atoi(v)
	case int:
		code = v
	}

	if code != 1 && code != 200 {
		logSync("GET", fullURL, "", string(body), code, int(duration), "BPJS error: "+envelope.MetaData.Message)
		return nil, fmt.Errorf("BPJS error [%d]: %s", code, envelope.MetaData.Message)
	}

	var responseBody []byte
	switch v := envelope.Response.(type) {
	case string:
		decrypted, err := c.DecryptResponse(v, timestamp)
		if err != nil {
			logSync("GET", fullURL, "", string(body), code, int(duration), "Decryption error: "+err.Error())
			return nil, fmt.Errorf("decrypt referensi response: %w", err)
		}
		responseBody = decrypted
	default:
		responseBody, err = json.Marshal(v)
		if err != nil {
			logSync("GET", fullURL, "", string(body), code, int(duration), "Marshal response error: "+err.Error())
			return nil, fmt.Errorf("marshal referensi response: %w", err)
		}
	}
	
	logSync("GET", fullURL, "", string(responseBody), code, int(duration), "")

	var listResp ListResponse
	if err := json.Unmarshal(responseBody, &listResp); err == nil && len(listResp.List) > 0 {
		return listResp.List, nil
	}

	return responseBody, nil
}

// ===============================
// REFERENSI ENDPOINTS
// ===============================

// GetReferensiPoli mengambil semua data poli dari BPJS
// GET {BASE URL}/{Service Name}/ref/poli
func (c *Client) GetReferensiPoli() ([]BPJSPoli, error) {
	respBody, err := c.requestReferensiList("/ref/poli")
	if err != nil {
		return nil, err
	}

	var polis []BPJSPoli
	if err := json.Unmarshal(respBody, &polis); err != nil {
		return nil, fmt.Errorf("parse poli list: %w", err)
	}

	return polis, nil
}

// GetReferensiDokter mengambil semua data dokter dari BPJS
// GET {BASE URL}/{Service Name}/ref/dokter
func (c *Client) GetReferensiDokter() ([]BPJSDokter, error) {
	respBody, err := c.requestReferensiList("/ref/dokter")
	if err != nil {
		return nil, err
	}

	var dokters []BPJSDokter
	if err := json.Unmarshal(respBody, &dokters); err != nil {
		return nil, fmt.Errorf("parse dokter list: %w", err)
	}

	return dokters, nil
}

// GetJadwalDokter mengambil jadwal dokter berdasarkan poli dan tanggal
// GET {BASE URL}/{Service Name}/jadwaldokter/kodepoli/{kodePoli}/tanggal/{tanggal}
// Parameter tanggal format: 2026-01-21
func (c *Client) GetJadwalDokter(kodePoli, tanggal string) ([]BPJSJadwalDokter, error) {
	endpoint := fmt.Sprintf("/jadwaldokter/kodepoli/%s/tanggal/%s", kodePoli, tanggal)

	respBody, err := c.requestReferensiList(endpoint)
	if err != nil {
		return nil, err
	}

	var jadwals []BPJSJadwalDokter
	if err := json.Unmarshal(respBody, &jadwals); err != nil {
		return nil, fmt.Errorf("parse jadwal list: %w", err)
	}

	return jadwals, nil
}

// ===============================
// UPDATE JADWAL DOKTER
// ===============================

// JadwalItem represents single jadwal item for update
type JadwalItem struct {
	Hari  string `json:"hari"`  // 1-7 (Senin-Minggu), 8 = libur nasional
	Buka  string `json:"buka"`  // Format: 08:00
	Tutup string `json:"tutup"` // Format: 12:00
}

// UpdateJadwalDokterRequest represents request body for update jadwal
type UpdateJadwalDokterRequest struct {
	KodePoli         string       `json:"kodepoli"`
	KodeSubspesialis string       `json:"kodesubspesialis"`
	KodeDokter       int          `json:"kodedokter"`
	Jadwal           []JadwalItem `json:"jadwal"`
}

// UpdateJadwalDokter mengirim update jadwal dokter ke BPJS
// POST {BASE URL}/{Service Name}/jadwaldokter/updatejadwaldokter
func (c *Client) UpdateJadwalDokter(req UpdateJadwalDokterRequest) error {
	_, _, err := c.Request("POST", "/jadwaldokter/updatejadwaldokter", req)
	return err
}
