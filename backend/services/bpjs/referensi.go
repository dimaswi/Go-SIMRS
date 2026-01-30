package bpjs

import (
	"encoding/json"
	"fmt"
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

// ===============================
// REFERENSI ENDPOINTS
// ===============================

// GetReferensiPoli mengambil semua data poli dari BPJS
// GET {BASE URL}/{Service Name}/ref/poli
func (c *Client) GetReferensiPoli() ([]BPJSPoli, error) {
	respBody, _, err := c.Request("GET", "/ref/poli", nil)
	if err != nil {
		return nil, err
	}

	// Parse response
	var listResp ListResponse
	if err := json.Unmarshal(respBody, &listResp); err != nil {
		// Mungkin langsung array
		var polis []BPJSPoli
		if err := json.Unmarshal(respBody, &polis); err != nil {
			return nil, fmt.Errorf("parse poli response: %w", err)
		}
		return polis, nil
	}

	var polis []BPJSPoli
	if err := json.Unmarshal(listResp.List, &polis); err != nil {
		return nil, fmt.Errorf("parse poli list: %w", err)
	}

	return polis, nil
}

// GetReferensiDokter mengambil semua data dokter dari BPJS
// GET {BASE URL}/{Service Name}/ref/dokter
func (c *Client) GetReferensiDokter() ([]BPJSDokter, error) {
	respBody, _, err := c.Request("GET", "/ref/dokter", nil)
	if err != nil {
		return nil, err
	}

	// Parse response
	var listResp ListResponse
	if err := json.Unmarshal(respBody, &listResp); err != nil {
		var dokters []BPJSDokter
		if err := json.Unmarshal(respBody, &dokters); err != nil {
			return nil, fmt.Errorf("parse dokter response: %w", err)
		}
		return dokters, nil
	}

	var dokters []BPJSDokter
	if err := json.Unmarshal(listResp.List, &dokters); err != nil {
		return nil, fmt.Errorf("parse dokter list: %w", err)
	}

	return dokters, nil
}

// GetJadwalDokter mengambil jadwal dokter berdasarkan poli dan tanggal
// GET {BASE URL}/{Service Name}/jadwaldokter/kodepoli/{kodePoli}/tanggal/{tanggal}
// Parameter tanggal format: 2026-01-21
func (c *Client) GetJadwalDokter(kodePoli, tanggal string) ([]BPJSJadwalDokter, error) {
	endpoint := fmt.Sprintf("/jadwaldokter/kodepoli/%s/tanggal/%s", kodePoli, tanggal)

	respBody, _, err := c.Request("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	// Parse response
	var listResp ListResponse
	if err := json.Unmarshal(respBody, &listResp); err != nil {
		var jadwals []BPJSJadwalDokter
		if err := json.Unmarshal(respBody, &jadwals); err != nil {
			return nil, fmt.Errorf("parse jadwal response: %w", err)
		}
		return jadwals, nil
	}

	var jadwals []BPJSJadwalDokter
	if err := json.Unmarshal(listResp.List, &jadwals); err != nil {
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
