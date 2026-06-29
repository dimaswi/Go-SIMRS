package handlers

import "github.com/gin-gonic/gin"

// MRPrintDefinition describes a backend print entry grouped by MR code.
// The legacy PDF generators remain the rendering source of truth; this
// registry gives the print layer an explicit MR-oriented structure.
type MRPrintDefinition struct {
	Code     string `json:"code"`
	Title    string `json:"title"`
	Category string `json:"category"`
	RouteKey string `json:"route_key"`
}

var mrPrintRegistry = []MRPrintDefinition{
	{Code: "MR.0", Title: "Identitas Pasien / Label", Category: "Umum", RouteKey: "patient-label"},
	{Code: "MR.01", Title: "Ringkasan Masuk dan Keluar", Category: "Umum", RouteKey: "admission-discharge-summary"},
	{Code: "MR.06", Title: "Triage / Asesmen Gawat Darurat", Category: "UGD", RouteKey: "triage"},
	{Code: "MR.07", Title: "CPPT", Category: "Rawat Inap", RouteKey: "cppt"},
	{Code: "MR.09", Title: "Asuhan Keperawatan", Category: "Rawat Inap", RouteKey: "nursing-care"},
	{Code: "MR.10", Title: "Grafik Vital Sign", Category: "Rawat Inap", RouteKey: "vital-sign-chart"},
	{Code: "MR.13", Title: "Order Obat / Resep", Category: "Farmasi", RouteKey: "prescription"},
	{Code: "MR.16", Title: "Hasil Laboratorium", Category: "Laboratorium", RouteKey: "lab-result"},
	{Code: "MR.17", Title: "Hasil Radiologi", Category: "Radiologi", RouteKey: "radiology-result"},
	{Code: "MR.19", Title: "Permintaan Laboratorium", Category: "Laboratorium", RouteKey: "lab-order"},
	{Code: "MR.21", Title: "Hasil Konsultasi", Category: "Konsultasi", RouteKey: "consultation-result"},
	{Code: "MR.28", Title: "Laporan Operasi / Tindakan", Category: "Operasi", RouteKey: "operative-report"},
	{Code: "MR.32", Title: "Balance Cairan", Category: "Rawat Inap", RouteKey: "fluid-balance"},
	{Code: "MR.35", Title: "Resume Medis Rawat Jalan", Category: "Resume", RouteKey: "outpatient-resume"},
	{Code: "MR.35", Title: "Resume Medis Rawat Inap", Category: "Resume", RouteKey: "inpatient-resume"},
	{Code: "MR.35", Title: "Ringkasan Pelayanan UGD", Category: "Resume", RouteKey: "emergency-summary"},
	{Code: "MR.36", Title: "SPRI", Category: "Surat", RouteKey: "spri"},
	{Code: "MR.36", Title: "Surat Kontrol BPJS", Category: "Surat", RouteKey: "surat-kontrol"},
	{Code: "MR.36", Title: "Surat Kontrol SIMRS", Category: "Surat", RouteKey: "surat-kontrol-simrs"},
	{Code: "MR.38", Title: "Surat Rujukan Keluar", Category: "Surat", RouteKey: "referral-letter"},
	{Code: "MR.39", Title: "Surat Sakit", Category: "Surat", RouteKey: "sick-letter"},
	{Code: "MR.39", Title: "Surat Sehat", Category: "Surat", RouteKey: "health-certificate"},
	{Code: "MR.39", Title: "Surat Kelahiran", Category: "Surat", RouteKey: "birth-certificate"},
	{Code: "MR.39", Title: "Surat Cuti", Category: "Surat", RouteKey: "leave-certificate"},
	{Code: "MR.39", Title: "Surat MCU", Category: "Surat", RouteKey: "mcu-certificate"},
	{Code: "MR.40", Title: "Surat Kematian", Category: "Surat", RouteKey: "death-certificate"},
	{Code: "MR.50", Title: "SEP", Category: "Klaim", RouteKey: "sep"},
	{Code: "MR.50", Title: "Bukti Registrasi", Category: "Klaim", RouteKey: "registration-receipt"},
	{Code: "MR.50", Title: "Permohonan DPJP", Category: "Klaim", RouteKey: "dpjp-request"},
	{Code: "MR.24", Title: "Informed Consent", Category: "Legal", RouteKey: "informed-consent"},
	{Code: "MR.24", Title: "Bukti Informed Consent", Category: "Legal", RouteKey: "informed-consent-receipt"},
}

func GetMRPrintRegistry() []MRPrintDefinition {
	return mrPrintRegistry
}

func GetMRPrintRegistryJSON(c *gin.Context) {
	c.JSON(200, gin.H{
		"data":  mrPrintRegistry,
		"total": len(mrPrintRegistry),
	})
}
