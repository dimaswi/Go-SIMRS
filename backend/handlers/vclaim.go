package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"starter/backend/services/bpjs"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== PESERTA ====================

// VClaimGetPesertaByNoKartu mencari peserta BPJS berdasarkan nomor kartu
func VClaimGetPesertaByNoKartu(c *gin.Context) {
	noKartu := c.Param("noKartu")
	tglSEP := c.Query("tglSEP")

	if noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu wajib diisi"})
		return
	}
	if tglSEP == "" {
		tglSEP = time.Now().Format("2006-01-02")
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	peserta, err := client.GetPesertaByNoKartu(noKartu, tglSEP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return peserta data directly (unwrap from nested structure)
	c.JSON(http.StatusOK, gin.H{"data": peserta.Peserta})
}

// VClaimGetPesertaByNIK mencari peserta BPJS berdasarkan NIK
func VClaimGetPesertaByNIK(c *gin.Context) {
	nik := c.Param("nik")
	tglSEP := c.Query("tglSEP")

	if nik == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIK wajib diisi"})
		return
	}
	if tglSEP == "" {
		tglSEP = time.Now().Format("2006-01-02")
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	peserta, err := client.GetPesertaByNIK(nik, tglSEP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return peserta data directly (unwrap from nested structure)
	c.JSON(http.StatusOK, gin.H{"data": peserta.Peserta})
}

// ==================== RUJUKAN ====================

// VClaimGetRujukanByNomor mendapatkan detail rujukan
func VClaimGetRujukanByNomor(c *gin.Context) {
	noRujukan := c.Param("noRujukan")
	asalFaskes := c.DefaultQuery("asalFaskes", "1") // Default Faskes 1

	if noRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor rujukan wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	rujukan, err := client.GetRujukanByNomor(noRujukan, asalFaskes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rujukan})
}

// VClaimGetRujukanByPeserta mendapatkan list rujukan peserta
func VClaimGetRujukanByPeserta(c *gin.Context) {
	noKartu := c.Param("noKartu")
	asalFaskes := c.DefaultQuery("asalFaskes", "1") // Default Faskes 1

	if noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	rujukan, err := client.GetRujukanByPeserta(noKartu, asalFaskes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rujukan})
}

type VClaimRujukanV1Input struct {
	NoSEP        string `json:"no_sep" binding:"required"`
	VisitID      uint   `json:"visit_id"`
	Registration uint   `json:"registration_id"`
	PatientID    uint   `json:"patient_id"`
	SEPID        uint   `json:"sep_id"`

	TglRujukan   string `json:"tgl_rujukan" binding:"required"`
	PPKDirujuk   string `json:"ppk_dirujuk" binding:"required"`
	JnsPelayanan string `json:"jns_pelayanan" binding:"required"`
	Catatan      string `json:"catatan"`
	DiagRujukan  string `json:"diag_rujukan" binding:"required"`
	TipeRujukan  string `json:"tipe_rujukan" binding:"required"`
	PoliRujukan  string `json:"poli_rujukan"`
}

type VClaimRujukanV2Input struct {
	NoSEP               string `json:"no_sep" binding:"required"`
	VisitID             uint   `json:"visit_id"`
	Registration        uint   `json:"registration_id"`
	PatientID           uint   `json:"patient_id"`
	SEPID               uint   `json:"sep_id"`
	TglRujukan          string `json:"tgl_rujukan" binding:"required"`
	TglRencanaKunjungan string `json:"tgl_rencana_kunjungan" binding:"required"`
	PPKDirujuk          string `json:"ppk_dirujuk" binding:"required"`
	JnsPelayanan        string `json:"jns_pelayanan" binding:"required"`
	Catatan             string `json:"catatan"`
	DiagRujukan         string `json:"diag_rujukan" binding:"required"`
	TipeRujukan         string `json:"tipe_rujukan" binding:"required"`
	PoliRujukan         string `json:"poli_rujukan"`
}

type VClaimRujukanKhususInput struct {
	NoRujukan      string   `json:"no_rujukan" binding:"required"`
	DiagnosaCodes  []string `json:"diagnosa_codes" binding:"required"`
	ProcedureCodes []string `json:"procedure_codes"`
}

type VClaimDeleteRujukanKhususInput struct {
	IDRujukan string `json:"id_rujukan" binding:"required"`
	NoRujukan string `json:"no_rujukan" binding:"required"`
}

func upsertReferralLocal(inputNoSEP, noRujukan, version string, visitID, registrationID, patientID, sepID uint, userName string, source any, isKhusus bool) {
	if noRujukan == "" {
		return
	}

	var existing models.BPJSReferral
	_ = database.DB.Where("no_rujukan = ?", noRujukan).First(&existing).Error

	referral := existing
	referral.NoRujukan = noRujukan
	referral.NoSEP = inputNoSEP
	referral.Version = version
	referral.UserBuat = userName
	referral.Status = "active"
	referral.IsKhusus = referral.IsKhusus || isKhusus

	if visitID > 0 {
		referral.VisitID = &visitID
	}
	if registrationID > 0 {
		referral.RegistrationID = &registrationID
	}
	if patientID > 0 {
		referral.PatientID = &patientID
	}
	if sepID > 0 {
		referral.SEPID = &sepID
	}

	var ppk models.PPKMaster
	resolvePPKName := func(kode string) string {
		if kode == "" {
			return ""
		}
		if err := database.DB.Where("kode_bpjs = ?", kode).First(&ppk).Error; err == nil {
			return ppk.Nama
		}
		return ""
	}

	switch r := source.(type) {
	case *bpjs.RujukanCreateResponseData:
		referral.TglRujukan = r.TglRujukan
		referral.TglRencanaKunjungan = r.TglRencanaKunjungan
		referral.DiagRujukan = r.Diagnosa.Kode
		referral.DiagRujukanNama = r.Diagnosa.Nama
		referral.PoliRujukan = r.PoliTujuan.Kode
		referral.PoliRujukanNama = r.PoliTujuan.Nama
		referral.NoKartu = r.Peserta.NoKartu
		referral.NamaPeserta = r.Peserta.Nama
		referral.PPKDirujuk = r.TujuanRujukan.Kode
		referral.NamaPPKDirujuk = r.TujuanRujukan.Nama
	case *VClaimRujukanV1Input:
		referral.TglRujukan = r.TglRujukan
		referral.PPKDirujuk = r.PPKDirujuk
		referral.JnsPelayanan = r.JnsPelayanan
		referral.Catatan = r.Catatan
		referral.DiagRujukan = r.DiagRujukan
		referral.TipeRujukan = r.TipeRujukan
		referral.PoliRujukan = r.PoliRujukan
		if referral.NamaPPKDirujuk == "" {
			referral.NamaPPKDirujuk = resolvePPKName(r.PPKDirujuk)
		}
	case *VClaimRujukanV2Input:
		referral.TglRujukan = r.TglRujukan
		referral.TglRencanaKunjungan = r.TglRencanaKunjungan
		referral.PPKDirujuk = r.PPKDirujuk
		referral.JnsPelayanan = r.JnsPelayanan
		referral.Catatan = r.Catatan
		referral.DiagRujukan = r.DiagRujukan
		referral.TipeRujukan = r.TipeRujukan
		referral.PoliRujukan = r.PoliRujukan
		if referral.NamaPPKDirujuk == "" {
			referral.NamaPPKDirujuk = resolvePPKName(r.PPKDirujuk)
		}
	}

	if existing.ID == 0 {
		_ = database.DB.Create(&referral).Error
		return
	}
	_ = database.DB.Save(&referral).Error
}

// VClaimCreateRujukanV1 creates BPJS referral using VClaim v1 endpoint.
func VClaimCreateRujukanV1(c *gin.Context) {
	var input VClaimRujukanV1Input
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.TipeRujukan != "2" && input.PoliRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poli rujukan wajib diisi untuk tipe rujukan 0/1"})
		return
	}

	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	result, err := client.InsertRujukanV1(bpjs.RujukanCreateRequest{
		NoSEP:        input.NoSEP,
		TglRujukan:   input.TglRujukan,
		PPKDirujuk:   input.PPKDirujuk,
		JnsPelayanan: input.JnsPelayanan,
		Catatan:      input.Catatan,
		DiagRujukan:  input.DiagRujukan,
		TipeRujukan:  input.TipeRujukan,
		PoliRujukan:  input.PoliRujukan,
		User:         user.Username,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	upsertReferralLocal(input.NoSEP, result.NoRujukan, "v1", input.VisitID, input.Registration, input.PatientID, input.SEPID, user.Username, result, false)
	if result.NoRujukan != "" {
		upsertReferralLocal(input.NoSEP, result.NoRujukan, "v1", input.VisitID, input.Registration, input.PatientID, input.SEPID, user.Username, &input, false)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rujukan BPJS V1 berhasil dibuat", "data": result})
}

// VClaimUpdateRujukanV1 updates BPJS referral using VClaim v1 endpoint.
func VClaimUpdateRujukanV1(c *gin.Context) {
	noRujukan := c.Param("noRujukan")
	if noRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor rujukan wajib diisi"})
		return
	}

	var input VClaimRujukanV1Input
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.TipeRujukan != "2" && input.PoliRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poli rujukan wajib diisi untuk tipe rujukan 0/1"})
		return
	}

	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	updatedNoRujukan, err := client.UpdateRujukanV1(bpjs.RujukanUpdateRequest{
		NoRujukan:    noRujukan,
		PPKDirujuk:   input.PPKDirujuk,
		JnsPelayanan: input.JnsPelayanan,
		Catatan:      input.Catatan,
		DiagRujukan:  input.DiagRujukan,
		TipeRujukan:  input.TipeRujukan,
		PoliRujukan:  input.PoliRujukan,
		User:         user.Username,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	upsertReferralLocal(input.NoSEP, noRujukan, "v1", input.VisitID, input.Registration, input.PatientID, input.SEPID, user.Username, &input, false)

	c.JSON(http.StatusOK, gin.H{"message": "Rujukan BPJS V1 berhasil diperbarui", "data": gin.H{"no_rujukan": updatedNoRujukan}})
}

// VClaimCreateRujukanV2 creates BPJS referral using VClaim v2 endpoint.
func VClaimCreateRujukanV2(c *gin.Context) {
	var input VClaimRujukanV2Input
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.TipeRujukan != "2" && input.PoliRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poli rujukan wajib diisi untuk tipe rujukan 0/1"})
		return
	}

	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	result, err := client.InsertRujukanV2(bpjs.RujukanCreateRequest{
		NoSEP:               input.NoSEP,
		TglRujukan:          input.TglRujukan,
		TglRencanaKunjungan: input.TglRencanaKunjungan,
		PPKDirujuk:          input.PPKDirujuk,
		JnsPelayanan:        input.JnsPelayanan,
		Catatan:             input.Catatan,
		DiagRujukan:         input.DiagRujukan,
		TipeRujukan:         input.TipeRujukan,
		PoliRujukan:         input.PoliRujukan,
		User:                user.Username,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	upsertReferralLocal(input.NoSEP, result.NoRujukan, "v2", input.VisitID, input.Registration, input.PatientID, input.SEPID, user.Username, result, false)
	if result.NoRujukan != "" {
		upsertReferralLocal(input.NoSEP, result.NoRujukan, "v2", input.VisitID, input.Registration, input.PatientID, input.SEPID, user.Username, &input, false)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rujukan BPJS V2 berhasil dibuat", "data": result})
}

// VClaimUpdateRujukanV2 updates BPJS referral using VClaim v2 endpoint.
func VClaimUpdateRujukanV2(c *gin.Context) {
	noRujukan := c.Param("noRujukan")
	if noRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor rujukan wajib diisi"})
		return
	}

	var input VClaimRujukanV2Input
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.TipeRujukan != "2" && input.PoliRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poli rujukan wajib diisi untuk tipe rujukan 0/1"})
		return
	}

	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	updatedNoRujukan, err := client.UpdateRujukanV2(bpjs.RujukanUpdateRequest{
		NoRujukan:           noRujukan,
		TglRujukan:          input.TglRujukan,
		TglRencanaKunjungan: input.TglRencanaKunjungan,
		PPKDirujuk:          input.PPKDirujuk,
		JnsPelayanan:        input.JnsPelayanan,
		Catatan:             input.Catatan,
		DiagRujukan:         input.DiagRujukan,
		TipeRujukan:         input.TipeRujukan,
		PoliRujukan:         input.PoliRujukan,
		User:                user.Username,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	upsertReferralLocal(input.NoSEP, noRujukan, "v2", input.VisitID, input.Registration, input.PatientID, input.SEPID, user.Username, &input, false)

	c.JSON(http.StatusOK, gin.H{"message": "Rujukan BPJS V2 berhasil diperbarui", "data": gin.H{"no_rujukan": updatedNoRujukan}})
}

// VClaimDeleteRujukan deletes BPJS referral (v1/v2).
func VClaimDeleteRujukan(c *gin.Context) {
	noRujukan := c.Param("noRujukan")
	if noRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor rujukan wajib diisi"})
		return
	}

	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	deletedNoRujukan, err := client.DeleteRujukan(noRujukan, user.Username)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&models.BPJSReferral{}).
		Where("no_rujukan = ?", noRujukan).
		Updates(map[string]interface{}{"status": "cancelled", "khusus_id_rujukan": "", "is_khusus": false})

	c.JSON(http.StatusOK, gin.H{"message": "Rujukan BPJS berhasil dihapus", "data": gin.H{"no_rujukan": deletedNoRujukan}})
}

// VClaimInsertRujukanKhusus creates special BPJS referral based on a regular referral number.
func VClaimInsertRujukanKhusus(c *gin.Context) {
	var input VClaimRujukanKhususInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	result, err := client.InsertRujukanKhusus(input.NoRujukan, input.DiagnosaCodes, input.ProcedureCodes, user.Username)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&models.BPJSReferral{}).
		Where("no_rujukan = ?", input.NoRujukan).
		Updates(map[string]interface{}{
			"is_khusus":              true,
			"khusus_diagnosa_codes":  strings.Join(input.DiagnosaCodes, ","),
			"khusus_procedure_codes": strings.Join(input.ProcedureCodes, ","),
			"status":                 "active",
		})

	c.JSON(http.StatusOK, gin.H{"message": "Rujukan khusus BPJS berhasil dibuat", "data": result})
}

// VClaimDeleteRujukanKhusus deletes special BPJS referral.
func VClaimDeleteRujukanKhusus(c *gin.Context) {
	var input VClaimDeleteRujukanKhususInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	deletedID, err := client.DeleteRujukanKhusus(input.IDRujukan, input.NoRujukan, user.Username)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&models.BPJSReferral{}).
		Where("no_rujukan = ?", input.NoRujukan).
		Updates(map[string]interface{}{
			"is_khusus":              false,
			"khusus_id_rujukan":      "",
			"khusus_diagnosa_codes":  "",
			"khusus_procedure_codes": "",
		})

	c.JSON(http.StatusOK, gin.H{"message": "Rujukan khusus BPJS berhasil dihapus", "data": gin.H{"id_rujukan": deletedID}})
}

// VClaimGetRujukanByVisit returns latest active local BPJS referral linked to a visit.
func VClaimGetRujukanByVisit(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID wajib diisi"})
		return
	}

	var referral models.BPJSReferral
	if err := database.DB.Where("visit_id = ?", visitID).Order("created_at DESC").First(&referral).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rujukan BPJS tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": referral})
}

// VClaimGetRujukanSpesialistik returns referral specialist list (kode poli) by target PPK and referral date.
func VClaimGetRujukanSpesialistik(c *gin.Context) {
	ppkRujukan := c.Query("ppk_rujukan")
	tglRujukan := c.Query("tgl_rujukan")
	keyword := strings.ToLower(strings.TrimSpace(c.Query("keyword")))

	if ppkRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PPK rujukan wajib diisi"})
		return
	}
	if tglRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal rujukan wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	items, err := client.GetRujukanListSpesialistik(ppkRujukan, tglRujukan)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := make([]gin.H, 0, len(items))
	for _, item := range items {
		kode := strings.TrimSpace(item.KodeSpesialis)
		nama := strings.TrimSpace(item.NamaSpesialis)
		if keyword != "" {
			haystack := strings.ToLower(kode + " " + nama)
			if !strings.Contains(haystack, keyword) {
				continue
			}
		}
		result = append(result, gin.H{
			"kode":           kode,
			"nama":           nama,
			"kapasitas":      strings.TrimSpace(item.Kapasitas),
			"jumlah_rujukan": strings.TrimSpace(item.JumlahRujukan),
			"persentase":     strings.TrimSpace(item.Persentase),
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// VClaimGetRujukanSarana returns referral supporting facility list by target PPK.
func VClaimGetRujukanSarana(c *gin.Context) {
	ppkRujukan := c.Query("ppk_rujukan")
	keyword := strings.ToLower(strings.TrimSpace(c.Query("keyword")))

	if ppkRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PPK rujukan wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	items, err := client.GetRujukanListSarana(ppkRujukan)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := make([]gin.H, 0, len(items))
	for _, item := range items {
		kode := strings.TrimSpace(item.KodeSarana)
		nama := strings.TrimSpace(item.NamaSarana)
		if keyword != "" {
			haystack := strings.ToLower(kode + " " + nama)
			if !strings.Contains(haystack, keyword) {
				continue
			}
		}
		result = append(result, gin.H{
			"kode": kode,
			"nama": nama,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// ==================== SEP ====================

// SEPInput adalah input untuk membuat SEP
type SEPInput struct {
	// Data Pasien
	NoKartu string `json:"no_kartu" binding:"required"`
	NoMR    string `json:"no_mr" binding:"required"`
	NoTelp  string `json:"no_telp"`

	// Link ke SIMRS
	RegistrationID uint `json:"registration_id"` // Optional - untuk link ke registration SIMRS
	VisitID        uint `json:"visit_id"`        // Optional - untuk link ke visit SIMRS (rawat inap)
	PatientID      uint `json:"patient_id" binding:"required"`

	// Data SEP
	TglSEP       string `json:"tgl_sep" binding:"required"`       // yyyy-mm-dd
	JnsPelayanan string `json:"jns_pelayanan" binding:"required"` // 1=Ranap, 2=Rajal

	// Kelas Rawat
	KlsRawatHak     string `json:"kls_rawat_hak" binding:"required"` // 1, 2, 3
	KlsRawatNaik    string `json:"kls_rawat_naik"`
	Pembiayaan      string `json:"pembiayaan"`
	PenanggungJawab string `json:"penanggung_jawab"`

	// Rujukan - tidak wajib untuk IGD/UGD
	AsalRujukan string `json:"asal_rujukan"` // 1=Faskes1, 2=Faskes2
	NoRujukan   string `json:"no_rujukan"`
	TglRujukan  string `json:"tgl_rujukan"`
	PPKRujukan  string `json:"ppk_rujukan"`

	// Poli & Dokter
	KodePoli string `json:"kode_poli"` // Kosong untuk Ranap
	NamaPoli string `json:"nama_poli"` // Nama poli dari frontend
	PoliEks  string `json:"poli_eks"`  // 0=Tidak, 1=Ya
	KodeDPJP string `json:"kode_dpjp"` // Kosong untuk Ranap
	NamaDPJP string `json:"nama_dpjp"` // Nama dokter dari frontend

	// Diagnosa
	DiagAwal     string `json:"diag_awal" binding:"required"` // Kode ICD-10
	NamaDiagnosa string `json:"nama_diagnosa"`                // Nama diagnosa dari frontend

	// Jaminan
	LakaLantas   string `json:"laka_lantas"` // 0, 1, 2, 3
	NoLP         string `json:"no_lp"`
	TglKejadian  string `json:"tgl_kejadian"`
	KetKejadian  string `json:"ket_kejadian"`
	Suplesi      string `json:"suplesi"` // 0=Tidak, 1=Ya
	NoSEPSuplesi string `json:"no_sep_suplesi"`
	KdPropinsi   string `json:"kd_propinsi"`
	KdKabupaten  string `json:"kd_kabupaten"`
	KdKecamatan  string `json:"kd_kecamatan"`

	// COB & Katarak
	COB     string `json:"cob"`     // 0=Tidak, 1=Ya
	Katarak string `json:"katarak"` // 0=Tidak, 1=Ya

	// Tujuan Kunjungan
	TujuanKunj    string `json:"tujuan_kunj"`    // 0, 1, 2
	FlagProcedure string `json:"flag_procedure"` // 0, 1
	KdPenunjang   string `json:"kd_penunjang"`   // 1-12
	AssesmentPel  string `json:"assesment_pel"`  // 1-5

	// Surat Kontrol
	NoSuratKontrol string `json:"no_surat_kontrol"`

	// Catatan
	Catatan string `json:"catatan"`
}

// VClaimCreateSEP membuat SEP baru
func VClaimCreateSEP(c *gin.Context) {
	var input SEPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Cek apakah poli IGD/UGD - tidak perlu rujukan
	isIGD := strings.ToUpper(input.KodePoli) == "IGD" || strings.ToUpper(input.KodePoli) == "UGD"

	// Cek apakah ada surat kontrol (SKDP) - tidak perlu rujukan manual
	hasSuratKontrol := input.NoSuratKontrol != ""

	// Validasi rujukan untuk non-IGD dan non-SKDP
	if !isIGD && !hasSuratKontrol {
		if input.NoRujukan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Rujukan wajib diisi atau gunakan Surat Kontrol"})
			return
		}
		if input.TglRujukan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal Rujukan wajib diisi untuk non-IGD"})
			return
		}
		if input.AsalRujukan == "" {
			input.AsalRujukan = "1" // Default faskes 1
		}
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Validasi registration (optional)
	var registration models.Registration
	if input.RegistrationID > 0 {
		if err := database.DB.Preload("Patient").First(&registration, input.RegistrationID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran tidak ditemukan"})
			return
		}
	}

	// Validasi patient
	var patient models.Patient
	if err := database.DB.First(&patient, input.PatientID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien tidak ditemukan"})
		return
	}

	// Cek apakah SEP sudah ada untuk registration ini (jika ada registration)
	// Filter: hanya SEP active dengan jenis pelayanan yang sama
	// Ini memungkinkan SEP Rajal/UGD (jns_pelayanan=2) dan SEP Ranap (jns_pelayanan=1)
	// hidup bersamaan di satu registration (karena SEP Rajal akan di-close saat SPRI dibuat)
	var existingSEP models.SEP
	if input.RegistrationID > 0 {
		if err := database.DB.Where("registration_id = ? AND jns_pelayanan = ? AND status = ?",
			input.RegistrationID, input.JnsPelayanan, "active").First(&existingSEP).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "SEP sudah ada untuk pendaftaran ini",
				"data":  existingSEP,
			})
			return
		}
	}

	// Create VClaim client
	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Validasi kode_ppk dari config
	if client.KodePPK == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode PPK (Faskes) belum dikonfigurasi. Silakan isi di menu Integrasi > BPJS"})
		return
	}

	// Untuk IGD: auto-fill rujukan fields sesuai format BPJS
	if isIGD {
		input.AsalRujukan = "2"           // Dari RS sendiri (Faskes 2)
		input.TglRujukan = input.TglSEP   // Tanggal rujukan = tanggal SEP
		input.NoRujukan = ""              // Kosong untuk IGD
		input.PPKRujukan = client.KodePPK // PPK rujukan = RS sendiri
	}

	// Set defaults
	if input.LakaLantas == "" {
		input.LakaLantas = "0"
	}
	if input.COB == "" {
		input.COB = "0"
	}
	if input.Katarak == "" {
		input.Katarak = "0"
	}
	if input.TujuanKunj == "" {
		input.TujuanKunj = "0"
	}
	if input.PoliEks == "" {
		input.PoliEks = "0"
	}

	// Jika ada noSuratKontrol (SKDP), ppkRujukan harus sama dengan ppkPelayanan (RS sendiri)
	ppkRujukan := input.PPKRujukan
	if input.NoSuratKontrol != "" {
		ppkRujukan = client.KodePPK
	}

	// Untuk rawat inap (jnsPelayanan = "1"), poliTujuan harus dikosongkan
	poliTujuan := input.KodePoli
	if input.JnsPelayanan == "1" {
		poliTujuan = ""
	}

	// Build SEP request
	sepData := &bpjs.SEPData{
		NoKartu:      input.NoKartu,
		TglSep:       input.TglSEP,
		JnsPelayanan: input.JnsPelayanan,
		KlsRawat: bpjs.SEPKelasRawat{
			KlsRawatHak:     input.KlsRawatHak,
			KlsRawatNaik:    input.KlsRawatNaik,
			Pembiayaan:      input.Pembiayaan,
			PenanggungJawab: input.PenanggungJawab,
		},
		NoMR: input.NoMR,
		Rujukan: bpjs.SEPRujukan{
			AsalRujukan: input.AsalRujukan,
			TglRujukan:  input.TglRujukan,
			NoRujukan:   input.NoRujukan,
			PPKRujukan:  ppkRujukan, // Gunakan ppkRujukan yang sudah diproses
		},
		Catatan:  input.Catatan,
		DiagAwal: input.DiagAwal,
		Poli: bpjs.SEPPoli{
			Tujuan:    poliTujuan, // Kosong untuk rawat inap
			Eksekutif: input.PoliEks,
		},
		Cob: bpjs.SEPCob{
			Cob: input.COB,
		},
		Katarak: bpjs.SEPKatarak{
			Katarak: input.Katarak,
		},
		Jaminan: bpjs.SEPJaminan{
			LakaLantas: input.LakaLantas,
			NoLP:       input.NoLP,
			Penjamin: &bpjs.SEPPenjamin{
				Penjamin:    "0", // Default tidak ada penjamin
				TglKejadian: "",
				Keterangan:  "",
				Suplesi: &bpjs.SEPSuplesi{
					Suplesi:      "0",
					NoSepSuplesi: "",
					LokasiLaka: &bpjs.SEPLokasiLaka{
						KdPropinsi:  "",
						KdKabupaten: "",
						KdKecamatan: "",
					},
				},
			},
		},
		TujuanKunj:    input.TujuanKunj,
		FlagProcedure: input.FlagProcedure,
		KdPenunjang:   input.KdPenunjang,
		AssesmentPel:  input.AssesmentPel,
		SKDP: bpjs.SEPSKDP{
			NoSurat:  input.NoSuratKontrol,
			KodeDPJP: input.KodeDPJP,
		},
		DPJPLayan: func() string {
			// Untuk rawat inap, dpjpLayan dikosongkan karena sudah ada di SKDP.kodeDPJP
			if input.JnsPelayanan == "1" {
				return ""
			}
			return input.KodeDPJP
		}(),
		NoTelp: input.NoTelp,
		User:   user.Username,
	}

	// Jika laka lantas, update data penjamin
	if input.LakaLantas != "0" && input.LakaLantas != "" {
		sepData.Jaminan.Penjamin.Penjamin = "1"
		sepData.Jaminan.Penjamin.TglKejadian = input.TglKejadian
		sepData.Jaminan.Penjamin.Keterangan = input.KetKejadian
		if input.Suplesi == "1" {
			sepData.Jaminan.Penjamin.Suplesi.Suplesi = input.Suplesi
			sepData.Jaminan.Penjamin.Suplesi.NoSepSuplesi = input.NoSEPSuplesi
			sepData.Jaminan.Penjamin.Suplesi.LokasiLaka.KdPropinsi = input.KdPropinsi
			sepData.Jaminan.Penjamin.Suplesi.LokasiLaka.KdKabupaten = input.KdKabupaten
			sepData.Jaminan.Penjamin.Suplesi.LokasiLaka.KdKecamatan = input.KdKecamatan
		}
	}

	// Call VClaim API
	sepResponse, err := client.InsertSEP(sepData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal membuat SEP: " + err.Error()})
		return
	}

	// Get nama diagnosa - prioritas dari input, fallback ke ICD10 database
	var icd10 models.ICD10
	namaDiagnosa := input.NamaDiagnosa
	if namaDiagnosa == "" {
		if err := database.DB.Where("code = ? OR code2 = ?", input.DiagAwal, input.DiagAwal).First(&icd10).Error; err == nil {
			namaDiagnosa = icd10.Display
		}
	}

	// Get nama poli - prioritas dari input, fallback ke mapping
	var poliMapping models.BPJSPoliMapping
	namaPoli := input.NamaPoli
	if namaPoli == "" {
		if err := database.DB.Where("kode_poli_bpjs = ?", input.KodePoli).First(&poliMapping).Error; err == nil {
			namaPoli = poliMapping.NamaPoliBPJS
		}
	}

	// Get nama dokter - prioritas dari input, fallback ke mapping
	var dokterMapping models.BPJSDoctorMapping
	namaDokter := input.NamaDPJP
	if namaDokter == "" {
		if err := database.DB.Where("kode_dokter_bpjs = ?", input.KodeDPJP).First(&dokterMapping).Error; err == nil {
			namaDokter = dokterMapping.NamaDokterBPJS
		}
	}

	// Save SEP to database
	tglLahir := ""
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		tglLahir = patient.TanggalLahir.Format("2006-01-02")
	}

	// Handle nullable registration_id
	var regID *uint
	if input.RegistrationID > 0 {
		regID = &input.RegistrationID
	}

	// Handle nullable visit_id
	var visitID *uint
	if input.VisitID > 0 {
		visitID = &input.VisitID
	}

	sep := models.SEP{
		NoSEP:          sepResponse.Sep.NoSep,
		RegistrationID: regID,
		VisitID:        visitID,
		PatientID:      input.PatientID,
		NoKartu:        input.NoKartu,
		NamaPasien:     patient.NamaLengkap,
		NIK:            patient.NIK,
		TglLahir:       tglLahir,
		JenisKelamin:   string(patient.JenisKelamin),
		TglSEP:         input.TglSEP,
		JnsPelayanan:   input.JnsPelayanan,
		KlsRawatHak:    input.KlsRawatHak,
		KlsRawatNaik:   input.KlsRawatNaik,
		Pembiayaan:     input.Pembiayaan,
		NoMR:           input.NoMR,
		AsalRujukan:    input.AsalRujukan,
		NoRujukan:      input.NoRujukan,
		TglRujukan:     input.TglRujukan,
		PPKRujukan:     ppkRujukan, // Gunakan ppkRujukan yang sudah diproses
		KodePoli:       input.KodePoli,
		NamaPoli:       namaPoli,
		PoliEks:        input.PoliEks,
		KodeDPJP:       input.KodeDPJP,
		NamaDPJP:       namaDokter,
		PPKPelayanan:   client.KodePPK,
		DiagAwal:       input.DiagAwal,
		NamaDiagnosa:   namaDiagnosa,
		LakaLantas:     input.LakaLantas,
		NoLPLaka:       input.NoLP,
		TglKejadian:    input.TglKejadian,
		Keterangan:     input.KetKejadian,
		Suplesi:        input.Suplesi,
		NoSEPSuplesi:   input.NoSEPSuplesi,
		KdPropinsi:     input.KdPropinsi,
		KdKabupaten:    input.KdKabupaten,
		KdKecamatan:    input.KdKecamatan,
		COB:            input.COB,
		Katarak:        input.Katarak,
		TujuanKunj:     input.TujuanKunj,
		FlagProcedure:  input.FlagProcedure,
		KdPenunjang:    input.KdPenunjang,
		AssesmentPel:   input.AssesmentPel,
		NoSuratKontrol: input.NoSuratKontrol,
		Catatan:        input.Catatan,
		NoTelp:         input.NoTelp,
		UserBuat:       user.Username,
		Status:         "active",
	}

	if err := database.DB.Create(&sep).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan SEP: " + err.Error()})
		return
	}

	// Update registration dengan nomor SEP
	database.DB.Model(&registration).Updates(map[string]interface{}{
		"sep_number": sep.NoSEP,
	})

	c.JSON(http.StatusCreated, gin.H{
		"message": "SEP berhasil dibuat",
		"data":    sep,
	})
}

// VClaimGetSEP mendapatkan detail SEP
func VClaimGetSEP(c *gin.Context) {
	noSEP := c.Param("noSEP")

	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	sep, err := client.GetSEP(noSEP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return langsung GetSEPResponse (struktur lengkap)
	c.JSON(http.StatusOK, gin.H{"data": sep})
}

// SEPImportInput adalah input untuk import SEP dari BPJS ke database lokal
type SEPImportInput struct {
	NoSEP          string `json:"no_sep" binding:"required"`
	NoKartu        string `json:"no_kartu"`
	NamaPasien     string `json:"nama_pasien"`
	NIK            string `json:"nik"`
	TglLahir       string `json:"tgl_lahir"`
	JenisKelamin   string `json:"jenis_kelamin"`
	TglSEP         string `json:"tgl_sep"`
	JnsPelayanan   string `json:"jns_pelayanan"`
	KlsRawatHak    string `json:"kls_rawat_hak"`
	NoMR           string `json:"no_mr"`
	AsalRujukan    string `json:"asal_rujukan"`
	NoRujukan      string `json:"no_rujukan"`
	TglRujukan     string `json:"tgl_rujukan"`
	PPKRujukan     string `json:"ppk_rujukan"`
	NamaRujukan    string `json:"nama_rujukan"`
	KodePoli       string `json:"kode_poli"`
	NamaPoli       string `json:"nama_poli"`
	KodeDPJP       string `json:"kode_dpjp"`
	NamaDPJP       string `json:"nama_dpjp"`
	PPKPelayanan   string `json:"ppk_pelayanan"`
	DiagAwal       string `json:"diag_awal"`
	NamaDiagnosa   string `json:"nama_diagnosa"`
	Catatan        string `json:"catatan"`
	PatientID      uint   `json:"patient_id"`
	RegistrationID uint   `json:"registration_id"` // Optional - untuk link ke registration SIMRS
	VisitID        uint   `json:"visit_id"`        // Optional - untuk link ke visit SIMRS
}

// VClaimImportSEP menyimpan data SEP dari BPJS ke database lokal
func VClaimImportSEP(c *gin.Context) {
	var input SEPImportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Cek apakah SEP sudah ada (termasuk yang sudah soft-deleted)
	var existingSEP models.SEP
	if err := database.DB.Unscoped().Where("no_sep = ?", input.NoSEP).First(&existingSEP).Error; err == nil {
		// SEP sudah ada — update link registration/visit dan restore jika soft-deleted
		updates := map[string]interface{}{
			"status":     "active",
			"deleted_at": nil,
		}
		if input.RegistrationID > 0 {
			updates["registration_id"] = input.RegistrationID
		}
		if input.VisitID > 0 {
			updates["visit_id"] = input.VisitID
		}
		if input.PatientID > 0 {
			updates["patient_id"] = input.PatientID
		}
		database.DB.Unscoped().Model(&existingSEP).Updates(updates)

		// Update registration sep_number jika registration_id ada
		if input.RegistrationID > 0 {
			database.DB.Model(&models.Registration{}).Where("id = ?", input.RegistrationID).
				Update("sep_number", input.NoSEP)
		}

		database.DB.Unscoped().First(&existingSEP, existingSEP.ID)
		c.JSON(http.StatusOK, gin.H{
			"message": "SEP sudah ada, berhasil di-update",
			"data":    existingSEP,
		})
		return
	}

	// Cari patient berdasarkan no_kartu BPJS
	var patient models.Patient
	patientID := input.PatientID
	if patientID == 0 && input.NoKartu != "" {
		if err := database.DB.Where("no_bpjs = ?", input.NoKartu).First(&patient).Error; err == nil {
			patientID = patient.ID
		}
	}

	// Jika masih tidak ada patient, coba cari by NIK
	if patientID == 0 && input.NIK != "" {
		if err := database.DB.Where("nik = ?", input.NIK).First(&patient).Error; err == nil {
			patientID = patient.ID
		}
	}

	// Handle nullable registration_id dan visit_id
	var regID *uint
	if input.RegistrationID > 0 {
		regID = &input.RegistrationID
	}
	var visitID *uint
	if input.VisitID > 0 {
		visitID = &input.VisitID
	}

	// Buat SEP baru
	sep := models.SEP{
		NoSEP:          input.NoSEP,
		PatientID:      patientID,
		RegistrationID: regID,
		VisitID:        visitID,
		NoKartu:        input.NoKartu,
		NamaPasien:     input.NamaPasien,
		NIK:            input.NIK,
		TglLahir:       input.TglLahir,
		JenisKelamin:   input.JenisKelamin,
		TglSEP:         input.TglSEP,
		JnsPelayanan:   input.JnsPelayanan,
		KlsRawatHak:    input.KlsRawatHak,
		NoMR:           input.NoMR,
		AsalRujukan:    input.AsalRujukan,
		NoRujukan:      input.NoRujukan,
		TglRujukan:     input.TglRujukan,
		PPKRujukan:     input.PPKRujukan,
		NamaRujukan:    input.NamaRujukan,
		KodePoli:       input.KodePoli,
		NamaPoli:       input.NamaPoli,
		KodeDPJP:       input.KodeDPJP,
		NamaDPJP:       input.NamaDPJP,
		PPKPelayanan:   input.PPKPelayanan,
		DiagAwal:       input.DiagAwal,
		NamaDiagnosa:   input.NamaDiagnosa,
		Catatan:        input.Catatan,
		Status:         "active",
	}

	if err := database.DB.Create(&sep).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan SEP: " + err.Error()})
		return
	}

	// Update registration sep_number jika registration_id ada
	if input.RegistrationID > 0 {
		database.DB.Model(&models.Registration{}).Where("id = ?", input.RegistrationID).
			Update("sep_number", input.NoSEP)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SEP berhasil disimpan",
		"data":    sep,
	})
}

// SPRIImportInput adalah input untuk import SPRI dari BPJS (GetSuratKontrolDetail) ke database lokal
type SPRIImportInput struct {
	NoSPRI            string `json:"no_spri" binding:"required"`
	NoKartu           string `json:"no_kartu"`
	Nama              string `json:"nama"`
	Kelamin           string `json:"kelamin"`
	TglLahir          string `json:"tgl_lahir"`
	TglRencanaKontrol string `json:"tgl_rencana_kontrol"`
	KodePoli          string `json:"kode_poli"`
	NamaPoli          string `json:"nama_poli"`
	KodeDokter        string `json:"kode_dokter"`
	NamaDokter        string `json:"nama_dokter"`
	NamaDiagnosa      string `json:"nama_diagnosa"`
	PatientID         uint   `json:"patient_id"`
	RegistrationID    uint   `json:"registration_id"`
	VisitID           uint   `json:"visit_id"`
	SEPID             uint   `json:"sep_id"`
}

// VClaimImportSPRI menyimpan data SPRI existing dari BPJS ke database lokal untuk assignment ke registration/visit
func VClaimImportSPRI(c *gin.Context) {
	var input SPRIImportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	noSPRI := strings.TrimSpace(input.NoSPRI)
	if noSPRI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SPRI wajib diisi"})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Resolve patient_id
	patientID := input.PatientID
	if patientID == 0 && input.RegistrationID > 0 {
		var reg models.Registration
		if err := database.DB.Select("id", "patient_id").First(&reg, input.RegistrationID).Error; err == nil {
			patientID = reg.PatientID
		}
	}
	if patientID == 0 && input.VisitID > 0 {
		var visit models.Visit
		if err := database.DB.Select("id", "registration_id").First(&visit, input.VisitID).Error; err == nil && visit.RegistrationID > 0 {
			var reg models.Registration
			if err := database.DB.Select("id", "patient_id").First(&reg, visit.RegistrationID).Error; err == nil {
				patientID = reg.PatientID
			}
		}
	}
	if patientID == 0 && strings.TrimSpace(input.NoKartu) != "" {
		var patient models.Patient
		if err := database.DB.Select("id").Where("no_bpjs = ?", strings.TrimSpace(input.NoKartu)).First(&patient).Error; err == nil {
			patientID = patient.ID
		}
	}

	if patientID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal menentukan pasien untuk import SPRI"})
		return
	}

	var regID *uint
	if input.RegistrationID > 0 {
		regID = &input.RegistrationID
	}
	var visitID *uint
	if input.VisitID > 0 {
		visitID = &input.VisitID
	}
	var sepID *uint
	if input.SEPID > 0 {
		sepID = &input.SEPID
	}

	// Upsert by no_spri (including soft-deleted rows)
	var existing models.SPRI
	if err := database.DB.Unscoped().Where("no_spri = ?", noSPRI).First(&existing).Error; err == nil {
		updates := map[string]interface{}{
			"is_bpjs":             true,
			"no_kartu":            strings.TrimSpace(input.NoKartu),
			"nama":                strings.TrimSpace(input.Nama),
			"kelamin":             strings.TrimSpace(input.Kelamin),
			"tgl_lahir":           strings.TrimSpace(input.TglLahir),
			"tgl_rencana_kontrol": strings.TrimSpace(input.TglRencanaKontrol),
			"kode_poli":           strings.TrimSpace(input.KodePoli),
			"nama_poli":           strings.TrimSpace(input.NamaPoli),
			"kode_dokter":         strings.TrimSpace(input.KodeDokter),
			"nama_dokter":         strings.TrimSpace(input.NamaDokter),
			"nama_diagnosa":       strings.TrimSpace(input.NamaDiagnosa),
			"registration_id":     regID,
			"visit_id":            visitID,
			"sep_id":              sepID,
			"patient_id":          patientID,
			"status":              "active",
			"user_buat":           user.Username,
			"deleted_at":          nil,
		}
		if err := database.DB.Unscoped().Model(&existing).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update SPRI existing: " + err.Error()})
			return
		}

		database.DB.Unscoped().Preload("Patient").First(&existing, existing.ID)
		c.JSON(http.StatusOK, gin.H{
			"message": "SPRI existing berhasil di-update dan di-assign",
			"data":    existing,
		})
		return
	}

	spri := models.SPRI{
		NoSPRI:            noSPRI,
		IsBPJS:            true,
		RegistrationID:    regID,
		VisitID:           visitID,
		SEPID:             sepID,
		PatientID:         patientID,
		NoKartu:           strings.TrimSpace(input.NoKartu),
		Nama:              strings.TrimSpace(input.Nama),
		Kelamin:           strings.TrimSpace(input.Kelamin),
		TglLahir:          strings.TrimSpace(input.TglLahir),
		TglRencanaKontrol: strings.TrimSpace(input.TglRencanaKontrol),
		KodePoli:          strings.TrimSpace(input.KodePoli),
		NamaPoli:          strings.TrimSpace(input.NamaPoli),
		KodeDokter:        strings.TrimSpace(input.KodeDokter),
		NamaDokter:        strings.TrimSpace(input.NamaDokter),
		NamaDiagnosa:      strings.TrimSpace(input.NamaDiagnosa),
		UserBuat:          user.Username,
		Status:            "active",
	}

	if err := database.DB.Create(&spri).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan SPRI import: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SPRI berhasil di-import dan di-assign",
		"data":    spri,
	})
}

// SEPUpdateInput adalah input untuk update SEP
type SEPUpdateInput struct {
	NoSep           string `json:"no_sep" binding:"required"`
	KlsRawatHak     string `json:"kls_rawat_hak"`
	KlsRawatNaik    string `json:"kls_rawat_naik"`
	Pembiayaan      string `json:"pembiayaan"`
	PenanggungJawab string `json:"penanggung_jawab"`
	NoMR            string `json:"no_mr"`
	Catatan         string `json:"catatan"`
	DiagAwal        string `json:"diag_awal"`
	PoliTujuan      string `json:"poli_tujuan"`
	PoliEksekutif   string `json:"poli_eksekutif"`
	Cob             string `json:"cob"`
	Katarak         string `json:"katarak"`
	LakaLantas      string `json:"laka_lantas"`
	TglKejadian     string `json:"tgl_kejadian"`
	Keterangan      string `json:"keterangan"`
	Suplesi         string `json:"suplesi"`
	NoSepSuplesi    string `json:"no_sep_suplesi"`
	KdPropinsi      string `json:"kd_propinsi"`
	KdKabupaten     string `json:"kd_kabupaten"`
	KdKecamatan     string `json:"kd_kecamatan"`
	DpjpLayan       string `json:"dpjp_layan"`
	NoTelp          string `json:"no_telp"`
}

// VClaimUpdateSEP mengupdate SEP di BPJS
func VClaimUpdateSEP(c *gin.Context) {
	noSEP := c.Param("noSEP")
	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	var input SEPUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Prepare SEP Data for update
	sepData := &bpjs.SEPData{
		KlsRawat: bpjs.SEPKelasRawat{
			KlsRawatHak:     input.KlsRawatHak,
			KlsRawatNaik:    input.KlsRawatNaik,
			Pembiayaan:      input.Pembiayaan,
			PenanggungJawab: input.PenanggungJawab,
		},
		NoMR:     input.NoMR,
		Catatan:  input.Catatan,
		DiagAwal: input.DiagAwal,
		Poli: bpjs.SEPPoli{
			Tujuan:    input.PoliTujuan,
			Eksekutif: input.PoliEksekutif,
		},
		Cob: bpjs.SEPCob{
			Cob: input.Cob,
		},
		Katarak: bpjs.SEPKatarak{
			Katarak: input.Katarak,
		},
		Jaminan: bpjs.SEPJaminan{
			LakaLantas: input.LakaLantas,
			Penjamin: &bpjs.SEPPenjamin{
				TglKejadian: input.TglKejadian,
				Keterangan:  input.Keterangan,
				Suplesi: &bpjs.SEPSuplesi{
					Suplesi:      input.Suplesi,
					NoSepSuplesi: input.NoSepSuplesi,
					LokasiLaka: &bpjs.SEPLokasiLaka{
						KdPropinsi:  input.KdPropinsi,
						KdKabupaten: input.KdKabupaten,
						KdKecamatan: input.KdKecamatan,
					},
				},
			},
		},
		DPJPLayan: input.DpjpLayan,
		NoTelp:    input.NoTelp,
		User:      user.Username,
	}

	// Update to BPJS
	result, err := client.UpdateSEP(noSEP, sepData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mengupdate SEP: " + err.Error()})
		return
	}

	// Update di database lokal jika ada
	updates := map[string]interface{}{
		"kode_dpjp":     input.DpjpLayan,
		"kode_poli":     input.PoliTujuan,
		"diag_awal":     input.DiagAwal,
		"catatan":       input.Catatan,
		"kls_rawat_hak": input.KlsRawatHak,
	}
	database.DB.Model(&models.SEP{}).Where("no_sep = ?", noSEP).Updates(updates)

	c.JSON(http.StatusOK, gin.H{
		"message": "SEP berhasil diupdate",
		"data":    result,
	})
}

// VClaimDeleteSEP menghapus SEP
func VClaimDeleteSEP(c *gin.Context) {
	noSEP := c.Param("noSEP")

	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Delete from BPJS
	if err := client.DeleteSEP(noSEP, user.Username); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal menghapus SEP: " + err.Error()})
		return
	}

	tx := database.DB.Begin()
	if err := unlinkSEPAssignments(tx, noSEP); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal melepas assignment SEP: " + err.Error()})
		return
	}

	if err := tx.Model(&models.SEP{}).Where("no_sep = ?", noSEP).Update("status", "deleted").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status SEP lokal: " + err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "SEP berhasil dihapus"})
}

// ApprovalSEPInput adalah input untuk approval SEP (backdate/finger print)
type ApprovalSEPInput struct {
	NoKartu      string `json:"no_kartu" binding:"required"`
	TglSep       string `json:"tgl_sep" binding:"required"`       // yyyy-mm-dd
	JnsPelayanan string `json:"jns_pelayanan" binding:"required"` // 1=Rawat Inap, 2=Rawat Jalan
	JnsPengajuan string `json:"jns_pengajuan"`                    // 1=Backdate, 2=Finger Print (default: 1)
	Keterangan   string `json:"keterangan" binding:"required"`
}

// VClaimApprovalSEP mengajukan approval SEP (backdate atau finger print)
// POST /bpjs/vclaim/sep/approval
func VClaimApprovalSEP(c *gin.Context) {
	var input ApprovalSEPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Default jnsPengajuan = 1 (Backdate)
	jnsPengajuan := input.JnsPengajuan
	if jnsPengajuan == "" {
		jnsPengajuan = "1"
	}

	// Call VClaim API
	result, err := client.ApprovalSEP(
		input.NoKartu,
		input.TglSep,
		input.JnsPelayanan,
		jnsPengajuan,
		input.Keterangan,
		user.Username,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mengajukan approval SEP: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Approval SEP berhasil diajukan",
		"data":    result,
	})
}

// VClaimPengajuanSEP mengajukan pengajuan SEP (untuk SEP backdate/finger print)
// POST /bpjs/vclaim/sep/pengajuan
func VClaimPengajuanSEP(c *gin.Context) {
	var input ApprovalSEPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Call VClaim API
	result, err := client.PengajuanSEP(
		input.NoKartu,
		input.TglSep,
		input.JnsPelayanan,
		input.JnsPengajuan,
		input.Keterangan,
		user.Username,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mengajukan pengajuan SEP: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Pengajuan SEP berhasil dikirim",
		"data":    result,
	})
}

// ==================== SPRI (Surat Perintah Rawat Inap) ====================

// SPRIInput adalah input untuk membuat SPRI
type SPRIInput struct {
	NoKartu           string `json:"no_kartu" binding:"required"`
	KodeDokter        string `json:"kode_dokter" binding:"required"`
	NamaDokter        string `json:"nama_dokter"`
	PoliKontrol       string `json:"poli_kontrol" binding:"required"`
	NamaPoli          string `json:"nama_poli"`
	TglRencanaKontrol string `json:"tgl_rencana_kontrol" binding:"required"` // yyyy-mm-dd
	// Optional - untuk tracking di SIMRS
	VisitID        uint `json:"visit_id"`
	RegistrationID uint `json:"registration_id"`
	SEPID          uint `json:"sep_id"`
}

// VClaimCreateSPRI membuat SPRI (Surat Perintah Rawat Inap) baru
func VClaimCreateSPRI(c *gin.Context) {
	var input SPRIInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Insert SPRI ke BPJS
	result, err := client.InsertSPRI(
		input.NoKartu,
		input.KodeDokter,
		input.PoliKontrol,
		input.TglRencanaKontrol,
		user.Username,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal membuat SPRI: " + err.Error()})
		return
	}

	// Get patient ID from visit or registration
	var patientID uint
	if input.VisitID > 0 {
		var visit models.Visit
		if err := database.DB.First(&visit, input.VisitID).Error; err == nil {
			if visit.RegistrationID > 0 {
				var reg models.Registration
				if err := database.DB.First(&reg, visit.RegistrationID).Error; err == nil {
					patientID = reg.PatientID
				}
			}
		}
	} else if input.RegistrationID > 0 {
		var reg models.Registration
		if err := database.DB.First(&reg, input.RegistrationID).Error; err == nil {
			patientID = reg.PatientID
		}
	}

	// Save SPRI to local database
	spri := models.SPRI{
		NoSPRI:            result.NoSPRI,
		IsBPJS:            true,
		NoKartu:           result.NoKartu,
		Nama:              result.Nama,
		Kelamin:           result.Kelamin,
		TglLahir:          result.TglLahir,
		TglRencanaKontrol: result.TglRencanaKontrol,
		KodePoli:          input.PoliKontrol,
		NamaPoli:          input.NamaPoli,
		KodeDokter:        input.KodeDokter,
		NamaDokter:        input.NamaDokter,
		NamaDiagnosa:      result.NamaDiagnosa,
		UserBuat:          user.Username,
		PatientID:         patientID,
		Status:            "active",
	}

	// Set optional foreign keys
	if input.VisitID > 0 {
		spri.VisitID = &input.VisitID
	}
	if input.RegistrationID > 0 {
		spri.RegistrationID = &input.RegistrationID
	}
	if input.SEPID > 0 {
		spri.SEPID = &input.SEPID
	}

	// Save to database (ignore error if already exists)
	if err := database.DB.Create(&spri).Error; err != nil {
		// Log but don't fail - SPRI already created in BPJS
		fmt.Printf("Warning: Failed to save SPRI to database: %v\n", err)
	}

	// Update old SEP status to 'pulang' (closed) after successful SPRI creation
	// This deactivates the old SEP so when new SEP for rawat inap is created, it's a fresh one
	if input.SEPID > 0 {
		var oldSEP models.SEP
		if err := database.DB.First(&oldSEP, input.SEPID).Error; err == nil {
			if err := database.DB.Model(&oldSEP).Updates(map[string]interface{}{
				"status": "pulang",
			}).Error; err != nil {
				fmt.Printf("Warning: Failed to update SEP status after SPRI: %v\n", err)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SPRI berhasil dibuat",
		"data":    result,
		"spri_id": spri.ID,
	})
}

// CreateLocalSPRI membuat SPRI lokal tanpa koneksi ke BPJS VClaim
// SPRI lokal bisa disusulkan (dikirim ke BPJS) nanti melalui edit di monitoring
func CreateLocalSPRI(c *gin.Context) {
	var input struct {
		NoKartu           string `json:"no_kartu"`
		Nama              string `json:"nama"`
		Kelamin           string `json:"kelamin"`
		TglLahir          string `json:"tgl_lahir"`
		KodeDokter        string `json:"kode_dokter"`
		NamaDokter        string `json:"nama_dokter"`
		PoliKontrol       string `json:"poli_kontrol"`
		NamaPoli          string `json:"nama_poli"`
		TglRencanaKontrol string `json:"tgl_rencana_kontrol"`
		NamaDiagnosa      string `json:"nama_diagnosa"`
		// Optional - untuk tracking di SIMRS
		VisitID        uint `json:"visit_id"`
		RegistrationID uint `json:"registration_id"`
		SEPID          uint `json:"sep_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Get patient ID from visit or registration
	var patientID uint
	if input.VisitID > 0 {
		var visit models.Visit
		if err := database.DB.First(&visit, input.VisitID).Error; err == nil {
			if visit.RegistrationID > 0 {
				var reg models.Registration
				if err := database.DB.First(&reg, visit.RegistrationID).Error; err == nil {
					patientID = reg.PatientID
				}
			}
		}
	} else if input.RegistrationID > 0 {
		var reg models.Registration
		if err := database.DB.First(&reg, input.RegistrationID).Error; err == nil {
			patientID = reg.PatientID
		}
	}

	if patientID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan data pasien dari visit/registration"})
		return
	}

	// Generate local number: LOCAL-{timestamp}
	localNo := fmt.Sprintf("LOCAL-%d", time.Now().UnixMilli())

	spri := models.SPRI{
		NoSPRI:            localNo,
		IsBPJS:            false,
		NoKartu:           input.NoKartu,
		Nama:              input.Nama,
		Kelamin:           input.Kelamin,
		TglLahir:          input.TglLahir,
		TglRencanaKontrol: input.TglRencanaKontrol,
		KodePoli:          input.PoliKontrol,
		NamaPoli:          input.NamaPoli,
		KodeDokter:        input.KodeDokter,
		NamaDokter:        input.NamaDokter,
		NamaDiagnosa:      input.NamaDiagnosa,
		UserBuat:          user.Username,
		PatientID:         patientID,
		Status:            "active",
	}
	if input.VisitID > 0 {
		spri.VisitID = &input.VisitID
	}
	if input.RegistrationID > 0 {
		spri.RegistrationID = &input.RegistrationID
	}
	if input.SEPID > 0 {
		spri.SEPID = &input.SEPID
	}

	if err := database.DB.Create(&spri).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan SPRI lokal: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SPRI lokal berhasil dibuat (belum terkirim ke BPJS)",
		"data":    spri,
	})
}

// GetSPRIByVisit mendapatkan SPRI berdasarkan visit ID
func GetSPRIByVisit(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID wajib diisi"})
		return
	}

	var spri models.SPRI
	if err := database.DB.Where("visit_id = ? AND status = ?", visitID, "active").
		Order("created_at DESC").
		First(&spri).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SPRI tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": spri})
}

// GetSPRIByRegistration mendapatkan SPRI berdasarkan registration ID
func GetSPRIByRegistration(c *gin.Context) {
	registrationID := c.Param("registrationId")
	if registrationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registration ID wajib diisi"})
		return
	}

	var spri models.SPRI
	if err := database.DB.Where("registration_id = ? AND status = ?", registrationID, "active").
		Order("created_at DESC").
		First(&spri).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SPRI tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": spri})
}

// SPRIListResponse adalah response item untuk daftar SPRI dengan info pendaftaran rawat inap
type SPRIListResponse struct {
	models.SPRI
	// Computed: info pendaftaran rawat inap yang terkait (via SEP.no_surat_kontrol = SPRI.no_spri)
	InpatientSEPID              *uint  `json:"inpatient_sep_id,omitempty"`
	InpatientSEPNumber          string `json:"inpatient_sep_number,omitempty"`
	InpatientRegistrationID     *uint  `json:"inpatient_registration_id,omitempty"`
	InpatientRegistrationNumber string `json:"inpatient_registration_number,omitempty"`
}

// GetSPRIList mendapatkan daftar SPRI dengan filter tanggal terbit dan tanggal rencana kontrol
func GetSPRIList(c *gin.Context) {
	var spriList []models.SPRI
	query := database.DB.Preload("Patient")

	statusFilter := c.Query("status")

	// Filter by status (default: semua)
	if statusFilter != "" && statusFilter != "all" {
		if statusFilter == "draft" {
			// Draft = SPRI lokal yang belum terkirim ke BPJS
			query = query.Where("is_bpjs = ? AND status = ?", false, "active")
		} else if statusFilter != "terdaftar" && statusFilter != "sep_created" {
			// Status standar (active, used, cancelled) — filter terdaftar/sep_created ditangani setelah enrichment
			query = query.Where("status = ?", statusFilter)
		}
	}

	// Filter by tanggal terbit (created_at)
	if from := c.Query("tgl_terbit_from"); from != "" {
		query = query.Where("DATE(created_at) >= ?", from)
	}
	if to := c.Query("tgl_terbit_to"); to != "" {
		query = query.Where("DATE(created_at) <= ?", to)
	}

	// Filter by tanggal rencana kontrol
	if from := c.Query("tgl_kontrol_from"); from != "" {
		query = query.Where("tgl_rencana_kontrol >= ?", from)
	}
	if to := c.Query("tgl_kontrol_to"); to != "" {
		query = query.Where("tgl_rencana_kontrol <= ?", to)
	}

	// Filter by no_kartu or nama (search)
	if search := c.Query("search"); search != "" {
		like := "%" + search + "%"
		query = query.Where("no_kartu LIKE ? OR nama LIKE ?", like, like)
	}

	// Limit
	limit := 200
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	query.Order("created_at DESC").Limit(limit).Find(&spriList)

	// === Enrichment: cari SEP & Registration terkait rawat inap ===
	// Link via SEP.no_surat_kontrol = SPRI.no_spri (BPJS menggunakan SPRI sebagai surat kontrol)
	var noSpriList []string
	for _, s := range spriList {
		if s.IsBPJS && s.NoSPRI != "" {
			noSpriList = append(noSpriList, s.NoSPRI)
		}
	}

	type admissionInfo struct {
		NoSuratKontrol     string `gorm:"column:no_surat_kontrol"`
		SEPID              uint   `gorm:"column:sep_id"`
		NoSEP              string `gorm:"column:no_sep"`
		RegistrationID     *uint  `gorm:"column:registration_id"`
		RegistrationNumber string `gorm:"column:registration_number"`
	}
	admissionMap := make(map[string]admissionInfo)

	if len(noSpriList) > 0 {
		var admissions []admissionInfo
		database.DB.Table("sep").
			Select("sep.no_surat_kontrol, sep.id as sep_id, sep.no_sep, sep.registration_id, COALESCE(registrations.registration_number, '') as registration_number").
			Joins("LEFT JOIN registrations ON registrations.id = sep.registration_id AND registrations.deleted_at IS NULL").
			Where("sep.no_surat_kontrol IN ? AND sep.deleted_at IS NULL AND sep.status != ?", noSpriList, "batal").
			Find(&admissions)
		for _, a := range admissions {
			admissionMap[a.NoSuratKontrol] = a
		}
	}

	// Build enriched response
	result := make([]SPRIListResponse, 0, len(spriList))
	for _, s := range spriList {
		item := SPRIListResponse{SPRI: s}
		if a, ok := admissionMap[s.NoSPRI]; ok {
			item.InpatientSEPID = &a.SEPID
			item.InpatientSEPNumber = a.NoSEP
			if a.RegistrationID != nil && *a.RegistrationID > 0 {
				item.InpatientRegistrationID = a.RegistrationID
				item.InpatientRegistrationNumber = a.RegistrationNumber
			}
		}
		// Filter terdaftar: hanya yang sudah terdaftar rawat inap (via SEP)
		if statusFilter == "terdaftar" && item.InpatientRegistrationID == nil {
			continue
		}
		// Filter sep_created: hanya yang sudah ada SEP rawat inap
		if statusFilter == "sep_created" && item.InpatientSEPID == nil {
			continue
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// CancelSPRIByVisit membatalkan SPRI berdasarkan visit ID (lokal saja, BPJS tidak punya API delete)
func CancelSPRIByVisit(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID wajib diisi"})
		return
	}

	var spri models.SPRI
	if err := database.DB.Where("visit_id = ? AND status = ?", visitID, "active").
		First(&spri).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{"message": "SPRI sudah tidak aktif / tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data SPRI: " + err.Error()})
		return
	}

	// Update status to cancelled (local only - BPJS doesn't provide delete API)
	spri.Status = "cancelled"
	if err := database.DB.Save(&spri).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan SPRI: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SPRI berhasil dibatalkan (catatan lokal)",
		"data":    spri,
	})
}

// CancelSPRIByRegistration membatalkan SPRI berdasarkan registration ID (lokal saja, tidak memanggil BPJS API)
func CancelSPRIByRegistration(c *gin.Context) {
	registrationID := c.Param("registrationId")
	if registrationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registration ID wajib diisi"})
		return
	}

	var spri models.SPRI
	if err := database.DB.Where("registration_id = ? AND status = ?", registrationID, "active").
		First(&spri).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SPRI aktif tidak ditemukan untuk pendaftaran ini"})
		return
	}

	// Update status ke cancelled (lokal saja — data tetap ada)
	if err := database.DB.Model(&spri).Update("status", "cancelled").Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan SPRI: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SPRI berhasil dibatalkan",
		"data":    spri,
	})
}

// VClaimUpdateSPRI mengupdate SPRI di BPJS dan database lokal
// Jika SPRI lokal (IsBPJS=false), akan mengirim ke BPJS dulu (InsertSPRI) → dapat NoSPRI asli
// Jika SPRI sudah di BPJS (IsBPJS=true), akan update di BPJS (UpdateSPRI)
func VClaimUpdateSPRI(c *gin.Context) {
	noSPRI := c.Param("noSPRI")
	if noSPRI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SPRI wajib diisi"})
		return
	}

	var input struct {
		KodeDokter        string `json:"kode_dokter" binding:"required"`
		NamaDokter        string `json:"nama_dokter"`
		PoliKontrol       string `json:"poli_kontrol" binding:"required"`
		NamaPoli          string `json:"nama_poli"`
		TglRencanaKontrol string `json:"tgl_rencana_kontrol" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Cari SPRI di database lokal
	var spri models.SPRI
	if err := database.DB.Where("no_spri = ?", noSPRI).First(&spri).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SPRI tidak ditemukan di database lokal"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	if !spri.IsBPJS {
		// === SPRI lokal → kirim ke BPJS (InsertSPRI) untuk mendapat NoSPRI asli ===
		result, err := client.InsertSPRI(
			spri.NoKartu,
			input.KodeDokter,
			input.PoliKontrol,
			input.TglRencanaKontrol,
			user.Username,
		)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mengirim SPRI ke BPJS: " + err.Error()})
			return
		}

		// Update record lokal: ganti nomor lokal → nomor BPJS asli, set IsBPJS=true
		updates := map[string]interface{}{
			"no_spri":             result.NoSPRI,
			"is_bpjs":             true,
			"kode_dokter":         input.KodeDokter,
			"nama_dokter":         input.NamaDokter,
			"kode_poli":           input.PoliKontrol,
			"nama_poli":           input.NamaPoli,
			"tgl_rencana_kontrol": input.TglRencanaKontrol,
		}
		if result.NamaDokter != "" {
			updates["nama_dokter"] = result.NamaDokter
		}
		if result.NamaDiagnosa != "" {
			updates["nama_diagnosa"] = result.NamaDiagnosa
		}
		if result.Nama != "" {
			updates["nama"] = result.Nama
		}
		if result.Kelamin != "" {
			updates["kelamin"] = result.Kelamin
		}
		if result.TglLahir != "" {
			updates["tgl_lahir"] = result.TglLahir
		}

		if err := database.DB.Model(&spri).Updates(updates).Error; err != nil {
			fmt.Printf("Warning: SPRI terkirim ke BPJS (No: %s) tapi gagal update lokal: %v\n", result.NoSPRI, err)
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "SPRI berhasil dikirim ke BPJS",
			"data":    result,
		})
		return
	}

	// === SPRI sudah di BPJS → update biasa ===
	result, err := client.UpdateSPRI(noSPRI, spri.NoKartu, input.KodeDokter, input.PoliKontrol, input.TglRencanaKontrol, user.Username)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal update SPRI di BPJS: " + err.Error()})
		return
	}

	// Update database lokal
	updates := map[string]interface{}{
		"kode_dokter":         input.KodeDokter,
		"nama_dokter":         input.NamaDokter,
		"kode_poli":           input.PoliKontrol,
		"nama_poli":           input.NamaPoli,
		"tgl_rencana_kontrol": input.TglRencanaKontrol,
	}
	if result.NamaDokter != "" {
		updates["nama_dokter"] = result.NamaDokter
	}
	if result.NamaDiagnosa != "" {
		updates["nama_diagnosa"] = result.NamaDiagnosa
	}

	if err := database.DB.Model(&spri).Updates(updates).Error; err != nil {
		fmt.Printf("Warning: SPRI updated di BPJS tapi gagal update lokal: %v\n", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SPRI berhasil diupdate",
		"data":    result,
	})
}

// VClaimUpdateSuratKontrol mengupdate Surat Kontrol di BPJS dan database lokal
func VClaimUpdateSuratKontrol(c *gin.Context) {
	noSuratKontrol := c.Param("noSuratKontrol")
	if noSuratKontrol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor Surat Kontrol wajib diisi"})
		return
	}

	var input struct {
		KodeDokter        string `json:"kode_dokter" binding:"required"`
		NamaDokter        string `json:"nama_dokter"`
		PoliKontrol       string `json:"poli_kontrol" binding:"required"`
		NamaPoli          string `json:"nama_poli"`
		TglRencanaKontrol string `json:"tgl_rencana_kontrol" binding:"required"`
		
		// PRB
		IsPRB       bool                   `json:"is_prb"`
		KdStatusPRB string                 `json:"kd_status_prb"`
		DataPRB     map[string]interface{} `json:"data_prb"`
		Version     string                 `json:"version"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Cari Surat Kontrol di database lokal
	var sk models.SuratKontrol
	if err := database.DB.Where("no_surat_kontrol = ?", noSuratKontrol).First(&sk).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat Kontrol tidak ditemukan di database lokal"})
		return
	}

	// Update ke BPJS
	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Prepare PRB data jika ada
	var formPRB *bpjs.SuratKontrolPRB
	if input.IsPRB && input.KdStatusPRB != "" {
		formPRB = &bpjs.SuratKontrolPRB{
			KdStatusPRB: input.KdStatusPRB,
			Data:        input.DataPRB,
		}
	}

	// Determine version (default: v2)
	version := input.Version
	if version == "" {
		version = "v2"
	}

	result, err := client.UpdateSuratKontrol(noSuratKontrol, sk.NoSEP, input.KodeDokter, input.PoliKontrol, input.TglRencanaKontrol, user.Username, formPRB, version)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal update Surat Kontrol di BPJS: " + err.Error()})
		return
	}

	// Update database lokal
	updates := map[string]interface{}{
		"kode_dokter":         input.KodeDokter,
		"nama_dokter":         input.NamaDokter,
		"kode_poli":           input.PoliKontrol,
		"nama_poli":           input.NamaPoli,
		"tgl_rencana_kontrol": input.TglRencanaKontrol,
		"is_prb":              input.IsPRB,
		"kd_status_prb":       input.KdStatusPRB,
	}
	if result.NamaDokter != "" {
		updates["nama_dokter"] = result.NamaDokter
	}
	if result.NamaDiagnosa != "" {
		updates["nama_diagnosa"] = result.NamaDiagnosa
	}

	if input.IsPRB {
		// Get nama status PRB
		namaStatusPRB := ""
		for _, prb := range models.PRBStatusOptions {
			if prb.Kode == input.KdStatusPRB {
				namaStatusPRB = prb.Nama
				break
			}
		}
		updates["nama_status_prb"] = namaStatusPRB
		
		if input.DataPRB != nil {
			if jsonBytes, err := json.Marshal(input.DataPRB); err == nil {
				updates["data_prb"] = string(jsonBytes)
			}
		}
	} else {
		updates["nama_status_prb"] = ""
		updates["data_prb"] = "{}"
	}

	if err := database.DB.Model(&sk).Updates(updates).Error; err != nil {
		fmt.Printf("Warning: Surat Kontrol updated di BPJS tapi gagal update lokal: %v\n", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Surat Kontrol berhasil diupdate",
		"data":    result,
	})
}

// VClaimDeleteSPRI menghapus SPRI dari BPJS menggunakan endpoint DeleteSuratKontrol
// kemudian menandai record lokal sebagai cancelled (data tidak dihapus secara fisik)
// Jika SPRI lokal (IsBPJS=false), langsung hapus tanpa panggil BPJS
func VClaimDeleteSPRI(c *gin.Context) {
	noSPRI := c.Param("noSPRI")
	if noSPRI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SPRI wajib diisi"})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Cari SPRI di database lokal
	var spri models.SPRI
	if err := database.DB.Where("no_spri = ?", noSPRI).First(&spri).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SPRI tidak ditemukan di database lokal"})
		return
	}

	// Jika sudah di BPJS, hapus dari BPJS dulu
	if spri.IsBPJS {
		client, err := bpjs.NewVClaimClient()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
			return
		}

		if err := client.DeleteSuratKontrol(noSPRI, user.Username); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal menghapus SPRI dari BPJS: " + err.Error()})
			return
		}
	}

	// Hapus record lokal (soft delete via DeletedAt)
	if err := database.DB.Delete(&spri).Error; err != nil {
		if spri.IsBPJS {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "SPRI dihapus dari BPJS namun gagal menghapus data lokal: " + err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus SPRI lokal: " + err.Error()})
		}
		return
	}

	msg := "SPRI lokal berhasil dihapus"
	if spri.IsBPJS {
		msg = "SPRI berhasil dihapus dari BPJS dan database lokal"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": msg,
	})
}

// VClaimSearchPoliSPRI mencari poli untuk SPRI (rawat inap)
func VClaimSearchPoliSPRI(c *gin.Context) {
	nama := c.Query("nama")
	if nama == "" {
		nama = "bed" // Default untuk rawat inap (Bedah, Bed, dll)
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	poli, err := client.GetPoliKontrolSPRI(nama, "1") // 1 = rawat inap
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": poli})
}

// VClaimSearchDokterSPRI mencari dokter untuk SPRI
func VClaimSearchDokterSPRI(c *gin.Context) {
	kodePoli := c.Query("kode_poli")
	tglPelayanan := c.Query("tgl_pelayanan")

	if kodePoli == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode poli wajib diisi"})
		return
	}

	if tglPelayanan == "" {
		tglPelayanan = time.Now().Format("2006-01-02")
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	dokter, err := client.GetDokterSPRI(kodePoli, tglPelayanan)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": dokter})
}

// ==================== SURAT KONTROL (SKDP Rawat Jalan) ====================

// SuratKontrolInput adalah input untuk membuat surat kontrol
type SuratKontrolInput struct {
	// Data SEP Asal
	NoSEP string `json:"no_sep" binding:"required"`

	// Link ke SIMRS
	RegistrationID uint `json:"registration_id"`
	VisitID        uint `json:"visit_id"`
	PatientID      uint `json:"patient_id" binding:"required"`
	SEPID          uint `json:"sep_id"`

	// Data Rencana Kontrol
	TglRencanaKontrol string `json:"tgl_rencana_kontrol" binding:"required"` // yyyy-mm-dd
	KodePoli          string `json:"kode_poli" binding:"required"`
	NamaPoli          string `json:"nama_poli"`
	KodeDokter        string `json:"kode_dokter" binding:"required"`
	NamaDokter        string `json:"nama_dokter"`

	// Data PRB (Program Rujuk Balik) - Optional
	IsPRB       bool                   `json:"is_prb"`
	KdStatusPRB string                 `json:"kd_status_prb"`
	DataPRB     map[string]interface{} `json:"data_prb"`

	// Version: "v1" atau "v2" (default: v2)
	Version string `json:"version"`

	// Optional: Buatkan antrean MJKN (Mobile JKN) sekaligus
	BuatkanAntrean bool `json:"buatkan_antrean"`
}

// VClaimCreateSuratKontrol membuat surat kontrol baru
func VClaimCreateSuratKontrol(c *gin.Context) {
	var input SuratKontrolInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Validate patient
	var patient models.Patient
	if err := database.DB.First(&patient, input.PatientID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien tidak ditemukan"})
		return
	}

	// Get SEP data untuk ambil no_kartu
	var sep models.SEP
	if input.SEPID > 0 {
		if err := database.DB.First(&sep, input.SEPID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "SEP tidak ditemukan"})
			return
		}
	} else if input.NoSEP != "" {
		if err := database.DB.Where("no_sep = ?", input.NoSEP).First(&sep).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "SEP tidak ditemukan"})
			return
		}
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Prepare PRB data jika ada
	var formPRB *bpjs.SuratKontrolPRB
	if input.IsPRB && input.KdStatusPRB != "" {
		formPRB = &bpjs.SuratKontrolPRB{
			KdStatusPRB: input.KdStatusPRB,
			Data:        input.DataPRB,
		}
	}

	// Determine version (default: v2)
	version := input.Version
	if version == "" {
		version = "v2"
	}

	// Insert Surat Kontrol ke BPJS
	result, err := client.InsertSuratKontrol(
		input.NoSEP,
		input.KodeDokter,
		input.KodePoli,
		input.TglRencanaKontrol,
		user.Username,
		formPRB,
		version,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal membuat Surat Kontrol: " + err.Error()})
		return
	}

	// Get nama status PRB
	namaStatusPRB := ""
	for _, prb := range models.PRBStatusOptions {
		if prb.Kode == input.KdStatusPRB {
			namaStatusPRB = prb.Nama
			break
		}
	}

	// Convert DataPRB to JSON string
	dataPRBJSON := ""
	if input.DataPRB != nil {
		if jsonBytes, err := json.Marshal(input.DataPRB); err == nil {
			dataPRBJSON = string(jsonBytes)
		}
	}

	// Prioritaskan NamaDokter dari response BPJS (canonical), fallback ke input
	namaDokterFinal := result.NamaDokter
	if namaDokterFinal == "" {
		namaDokterFinal = input.NamaDokter
	}

	// FALLBACK TERAKHIR: Jika masih kosong, ambil dari Detail Surat Kontrol BPJS
	if namaDokterFinal == "" && result.NoSuratKontrol != "" {
		fmt.Printf("[VClaim] NamaDokter kosong dari Insert & input, fetching dari Detail Surat Kontrol %s\n", result.NoSuratKontrol)
		detail, err := client.GetSuratKontrolDetail(result.NoSuratKontrol)
		if err == nil && detail != nil && detail.NamaDokter != "" {
			namaDokterFinal = detail.NamaDokter
			fmt.Printf("[VClaim] NamaDokter resolved dari Detail: %s\n", namaDokterFinal)
		}
	}

	// Prioritaskan NamaPoli dari input (user selected), karena BPJS result tidak return nama poli
	namaPoliFinal := input.NamaPoli

	fmt.Printf("[VClaim] CreateSuratKontrol: kodeDokter=%s, namaDokter(input)=%s, namaDokter(bpjs)=%s, namaDokter(final)=%s\n",
		input.KodeDokter, input.NamaDokter, result.NamaDokter, namaDokterFinal)

	// Save to local database
	suratKontrol := models.SuratKontrol{
		NoSuratKontrol:    result.NoSuratKontrol,
		NoSEP:             input.NoSEP,
		NoKartu:           sep.NoKartu,
		Nama:              result.Nama,
		Kelamin:           result.Kelamin,
		TglLahir:          result.TglLahir,
		TglRencanaKontrol: result.TglRencanaKontrol,
		KodePoli:          input.KodePoli,
		NamaPoli:          namaPoliFinal,
		KodeDokter:        input.KodeDokter,
		NamaDokter:        namaDokterFinal,
		NamaDiagnosa:      result.NamaDiagnosa,
		IsPRB:             input.IsPRB,
		KdStatusPRB:       input.KdStatusPRB,
		NamaStatusPRB:     namaStatusPRB,
		DataPRB:           dataPRBJSON,
		UserBuat:          user.Username,
		PatientID:         input.PatientID,
		Status:            "active",
	}

	// Set optional foreign keys
	if input.VisitID > 0 {
		suratKontrol.VisitID = &input.VisitID
	}
	if input.RegistrationID > 0 {
		suratKontrol.RegistrationID = &input.RegistrationID
	}
	if input.SEPID > 0 {
		suratKontrol.SEPID = &input.SEPID
	} else if sep.ID > 0 {
		suratKontrol.SEPID = &sep.ID
	}

	// Save to database
	if err := database.DB.Create(&suratKontrol).Error; err != nil {
		fmt.Printf("Warning: Failed to save Surat Kontrol to database: %v\n", err)
	}

	// NOTE: SEP status should NOT be updated here
	// SEP status will be updated to 'deleted' when disposition is saved (SaveDisposition handler)
	// And reverted to 'active' when disposition is cancelled (CancelDisposition handler)

	// === OPTIONAL: Buatkan Antrean MJKN ===
	var antreanResult map[string]interface{}
	if input.BuatkanAntrean {
		antreanResult = buatAntreanDariSuratKontrol(
			&suratKontrol, &patient, &sep, input,
		)
	}

	response := gin.H{
		"message":          "Surat Kontrol berhasil dibuat",
		"data":             result,
		"surat_kontrol_id": suratKontrol.ID,
	}
	if antreanResult != nil {
		response["antrean"] = antreanResult
	}

	c.JSON(http.StatusOK, response)
}

// buatAntreanDariSuratKontrol membuat BPJSQueue dan mengirim AddAntrean ke BPJS
// saat pembuatan Surat Kontrol (opsional). Antrean ini untuk kunjungan kontrol di masa depan via Mobile JKN.
func buatAntreanDariSuratKontrol(
	suratKontrol *models.SuratKontrol,
	patient *models.Patient,
	sep *models.SEP,
	input SuratKontrolInput,
) map[string]interface{} {
	result := map[string]interface{}{
		"success": false,
		"message": "",
	}

	// Parse tanggal rencana kontrol
	tglKontrol, err := time.Parse("2006-01-02", input.TglRencanaKontrol)
	if err != nil {
		result["message"] = "Format tanggal rencana kontrol tidak valid"
		fmt.Printf("[BPJS Antrean SK] %s\n", result["message"])
		return result
	}

	// Find poli mapping by BPJS poli code
	var poliMapping models.BPJSPoliMapping
	if err := database.DB.Where("kode_poli_bpjs = ? AND is_active = ?", input.KodePoli, true).
		First(&poliMapping).Error; err != nil {
		result["message"] = fmt.Sprintf("Poli mapping tidak ditemukan untuk kode poli BPJS %s. Pastikan mapping poli sudah dikonfigurasi.", input.KodePoli)
		fmt.Printf("[BPJS Antrean SK] %s\n", result["message"])
		return result
	}

	// Find doctor mapping by BPJS doctor code in this poli
	var dokterMapping models.BPJSDoctorMapping
	if err := database.DB.Where("poli_mapping_id = ? AND kode_dokter_bpjs = ? AND is_active = ?",
		poliMapping.ID, input.KodeDokter, true).First(&dokterMapping).Error; err != nil {
		result["message"] = fmt.Sprintf("Dokter mapping tidak ditemukan untuk dokter %s di poli %s. Pastikan mapping dokter sudah dikonfigurasi.", input.KodeDokter, poliMapping.NamaPoliBPJS)
		fmt.Printf("[BPJS Antrean SK] %s\n", result["message"])
		return result
	}

	// Generate kode booking
	kodeBooking := generateKodeBookingSuratKontrol(tglKontrol, input.KodePoli)

	// Calculate angka antrean: count existing queues for this date + poli + dokter + 1
	var existingCount int64
	database.DB.Model(&models.BPJSQueue{}).
		Where("tanggal_periksa = ? AND kode_poli = ? AND kode_dokter = ? AND deleted_at IS NULL",
			tglKontrol, input.KodePoli, input.KodeDokter).
		Count(&existingCount)
	angkaAntrean := int(existingCount) + 1
	nomorAntrean := fmt.Sprintf("%s-%d", input.KodePoli, angkaAntrean)

	// Calculate estimasi dilayani (15 menit per pasien)
	jamPraktek := dokterMapping.JamPraktek
	if jamPraktek == "" {
		jamPraktek = "08:00-17:00"
	}
	jamPraktekParts := strings.Split(jamPraktek, "-")
	jamMulai := "08:00"
	if len(jamPraktekParts) > 0 {
		jamMulai = jamPraktekParts[0]
	}
	startTime, _ := time.Parse("15:04", jamMulai)
	estimasiTime := time.Date(tglKontrol.Year(), tglKontrol.Month(), tglKontrol.Day(),
		startTime.Hour(), startTime.Minute(), 0, 0, time.Local)
	estimasiTime = estimasiTime.Add(time.Duration((angkaAntrean-1)*15) * time.Minute)
	estimasiDilayani := estimasiTime.UnixMilli()

	// Create BPJSQueue record
	bpjsQueue := models.BPJSQueue{
		KodeBooking:      kodeBooking,
		NomorAntrean:     nomorAntrean,
		AngkaAntrean:     angkaAntrean,
		TanggalPeriksa:   tglKontrol,
		JamPraktek:       jamPraktek,
		KodePoli:         input.KodePoli,
		NamaPoli:         input.NamaPoli,
		KodeDokter:       input.KodeDokter,
		NamaDokter:       input.NamaDokter,
		JenisPasien:      "JKN",
		NoKartu:          sep.NoKartu,
		NIK:              patient.NIK,
		NoHP:             patient.NoHP,
		NoRM:             patient.NoRM,
		NamaPasien:       patient.NamaLengkap,
		JenisKunjungan:   3, // 3 = Kontrol
		NomorReferensi:   suratKontrol.NoSuratKontrol,
		EstimasiDilayani: estimasiDilayani,
		Status:           "booking",
		PatientID:        &input.PatientID,
		PoliMappingID:    &poliMapping.ID,
		DoctorMappingID:  &dokterMapping.ID,
		SyncStatus:       "pending",
	}

	// Set optional links
	if input.VisitID > 0 {
		bpjsQueue.VisitID = &input.VisitID
	}
	if input.RegistrationID > 0 {
		bpjsQueue.RegistrationID = &input.RegistrationID
	}

	if err := database.DB.Create(&bpjsQueue).Error; err != nil {
		result["message"] = fmt.Sprintf("Gagal menyimpan BPJSQueue: %s", err.Error())
		fmt.Printf("[BPJS Antrean SK] %s\n", result["message"])
		return result
	}

	// Call AddAntrean to BPJS
	addSuccess, addCode, addMsg := bpjs.AddAntrean(&bpjsQueue)

	// Update BPJSQueue with result
	now := time.Now()
	bpjsQueue.AddAntreanSent = true
	bpjsQueue.AddAntreanCode = addCode
	bpjsQueue.AddAntreanMsg = addMsg
	bpjsQueue.LastSyncAt = &now

	if addSuccess {
		bpjsQueue.SyncStatus = "synced"
		fmt.Printf("[BPJS Antrean SK] AddAntrean berhasil untuk kode_booking: %s, no_surat_kontrol: %s\n", kodeBooking, suratKontrol.NoSuratKontrol)
	} else {
		bpjsQueue.SyncStatus = "failed"
		bpjsQueue.SyncError = addMsg
		fmt.Printf("[BPJS Antrean SK] AddAntrean gagal untuk kode_booking: %s - [%d] %s\n", kodeBooking, addCode, addMsg)
	}

	database.DB.Save(&bpjsQueue)

	result["success"] = addSuccess
	result["kode_booking"] = kodeBooking
	result["nomor_antrean"] = nomorAntrean
	result["angka_antrean"] = angkaAntrean
	result["estimasi_dilayani"] = estimasiDilayani
	result["tanggal_periksa"] = input.TglRencanaKontrol
	result["bpjs_queue_id"] = bpjsQueue.ID
	if addSuccess {
		result["message"] = fmt.Sprintf("Antrean MJKN berhasil dibuat dengan kode booking: %s", kodeBooking)
	} else {
		result["message"] = fmt.Sprintf("Antrean lokal tersimpan, namun sinkronisasi ke BPJS gagal: [%d] %s", addCode, addMsg)
	}

	return result
}

// generateKodeBookingSuratKontrol generates unique booking code for Surat Kontrol queue
// Format: SK + DDMMYYYY + kodePoli + HHmmss
func generateKodeBookingSuratKontrol(tanggal time.Time, kodePoli string) string {
	dateStr := tanggal.Format("02012006")     // DDMMYYYY
	timeSuffix := time.Now().Format("150405") // HHmmss - unique per second
	return fmt.Sprintf("SK%s%s%s", dateStr, kodePoli, timeSuffix)
}

// GetSuratKontrolByVisit mendapatkan surat kontrol berdasarkan visit ID
func GetSuratKontrolByVisit(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID wajib diisi"})
		return
	}

	var suratKontrol models.SuratKontrol
	if err := database.DB.Where("visit_id = ? AND status = ?", visitID, "active").
		Order("created_at DESC").
		First(&suratKontrol).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat Kontrol tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": suratKontrol})
}

// GetSuratKontrolByRegistration mendapatkan surat kontrol berdasarkan registration ID
func GetSuratKontrolByRegistration(c *gin.Context) {
	registrationID := c.Param("registrationId")
	if registrationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registration ID wajib diisi"})
		return
	}

	var suratKontrol models.SuratKontrol
	if err := database.DB.Where("registration_id = ? AND status = ?", registrationID, "active").
		Order("created_at DESC").
		First(&suratKontrol).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat Kontrol tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": suratKontrol})
}

// GetSuratKontrolList mendapatkan list surat kontrol
func GetSuratKontrolList(c *gin.Context) {
	type suratKontrolMonitorItem struct {
		ID                uint      `json:"id"`
		NoSuratKontrol    string    `json:"no_surat_kontrol"`
		NoSEP             string    `json:"no_sep"`
		RegistrationID    *uint     `json:"registration_id,omitempty"`
		VisitID           *uint     `json:"visit_id,omitempty"`
		PatientID         uint      `json:"patient_id"`
		NoKartu           string    `json:"no_kartu"`
		Nama              string    `json:"nama"`
		Kelamin           string    `json:"kelamin"`
		TglLahir          string    `json:"tgl_lahir"`
		TglRencanaKontrol string    `json:"tgl_rencana_kontrol"`
		KodePoli          string    `json:"kode_poli"`
		NamaPoli          string    `json:"nama_poli"`
		KodeDokter        string    `json:"kode_dokter"`
		NamaDokter        string    `json:"nama_dokter"`
		NamaDiagnosa      string    `json:"nama_diagnosa"`
		IsPRB             bool      `json:"is_prb"`
		KdStatusPRB       string    `json:"kd_status_prb"`
		NamaStatusPRB     string    `json:"nama_status_prb"`
		DataPRB           string    `json:"data_prb"`
		UserBuat          string    `json:"user_buat"`
		Status            string    `json:"status"`
		CreatedAt         time.Time `json:"created_at"`
		UpdatedAt         time.Time `json:"updated_at"`
		SourceType        string    `json:"source_type"`
	}

	statusFilter := c.Query("status")
	search := c.Query("search")
	tglTerbitFrom := c.Query("tgl_terbit_from")
	tglTerbitTo := c.Query("tgl_terbit_to")
	tglKontrolFrom := c.Query("tgl_kontrol_from")
	tglKontrolTo := c.Query("tgl_kontrol_to")

	limit := 200
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
		if limit <= 0 {
			limit = 200
		}
	}

	var combined []suratKontrolMonitorItem

	// ==================== BPJS SURAT KONTROL ====================
	var suratKontrolList []models.SuratKontrol
	query := database.DB.Preload("Patient").Preload("Visit").Preload("SEP")

	// Filter by patient_id
	if patientID := c.Query("patient_id"); patientID != "" {
		query = query.Where("patient_id = ?", patientID)
	}

	// Filter by visit_id
	if visitID := c.Query("visit_id"); visitID != "" {
		query = query.Where("visit_id = ?", visitID)
	}

	// Filter by status
	if statusFilter != "" && statusFilter != "all" {
		query = query.Where("status = ?", statusFilter)
	} else if statusFilter == "" {
		query = query.Where("status = ?", "active")
	}

	// Filter by tanggal terbit (created_at)
	if tglTerbitFrom != "" {
		query = query.Where("DATE(created_at) >= ?", tglTerbitFrom)
	}
	if tglTerbitTo != "" {
		query = query.Where("DATE(created_at) <= ?", tglTerbitTo)
	}

	// Filter by tanggal rencana kontrol
	if tglKontrolFrom != "" {
		query = query.Where("tgl_rencana_kontrol >= ?", tglKontrolFrom)
	}
	if tglKontrolTo != "" {
		query = query.Where("tgl_rencana_kontrol <= ?", tglKontrolTo)
	}

	// Filter by no_kartu or nama (search)
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("no_kartu LIKE ? OR nama LIKE ?", like, like)
	}

	query.Order("created_at DESC").Limit(limit).Find(&suratKontrolList)
	for _, item := range suratKontrolList {
		combined = append(combined, suratKontrolMonitorItem{
			ID:                item.ID,
			NoSuratKontrol:    item.NoSuratKontrol,
			NoSEP:             item.NoSEP,
			RegistrationID:    item.RegistrationID,
			VisitID:           item.VisitID,
			PatientID:         item.PatientID,
			NoKartu:           item.NoKartu,
			Nama:              item.Nama,
			Kelamin:           item.Kelamin,
			TglLahir:          item.TglLahir,
			TglRencanaKontrol: item.TglRencanaKontrol,
			KodePoli:          item.KodePoli,
			NamaPoli:          item.NamaPoli,
			KodeDokter:        item.KodeDokter,
			NamaDokter:        item.NamaDokter,
			NamaDiagnosa:      item.NamaDiagnosa,
			IsPRB:             item.IsPRB,
			KdStatusPRB:       item.KdStatusPRB,
			NamaStatusPRB:     item.NamaStatusPRB,
			DataPRB:           item.DataPRB,
			UserBuat:          item.UserBuat,
			Status:            item.Status,
			CreatedAt:         item.CreatedAt,
			UpdatedAt:         item.UpdatedAt,
			SourceType:        "bpjs",
		})
	}

	// ==================== KONTROL UMUM (SIMRS) ====================
	var followUps []models.Registration
	regQuery := database.DB.
		Preload("Patient").
		Preload("DestinationRoom").
		Preload("Doctor").
		Where("is_follow_up = ?", true)

	if patientID := c.Query("patient_id"); patientID != "" {
		regQuery = regQuery.Where("patient_id = ?", patientID)
	}
	if visitID := c.Query("visit_id"); visitID != "" {
		regQuery = regQuery.Where("source_visit_id = ?", visitID)
	}

	if statusFilter != "" && statusFilter != "all" {
		switch statusFilter {
		case "active":
			regQuery = regQuery.Where("status IN ?", []string{models.RegistrationStatusScheduled, models.RegistrationStatusRegistered})
		case "used":
			regQuery = regQuery.Where("status IN ?", []string{models.RegistrationStatusInQueue, models.RegistrationStatusInProgress, models.RegistrationStatusCompleted, models.RegistrationStatusDischarged})
		case "cancelled":
			regQuery = regQuery.Where("status IN ?", []string{models.RegistrationStatusCancelled, models.RegistrationStatusNoShow})
		}
	} else if statusFilter == "" {
		regQuery = regQuery.Where("status IN ?", []string{models.RegistrationStatusScheduled, models.RegistrationStatusRegistered})
	}

	if tglTerbitFrom != "" {
		regQuery = regQuery.Where("DATE(created_at) >= ?", tglTerbitFrom)
	}
	if tglTerbitTo != "" {
		regQuery = regQuery.Where("DATE(created_at) <= ?", tglTerbitTo)
	}
	if tglKontrolFrom != "" {
		regQuery = regQuery.Where("scheduled_date >= ?", tglKontrolFrom)
	}
	if tglKontrolTo != "" {
		regQuery = regQuery.Where("scheduled_date <= ?", tglKontrolTo)
	}
	if search != "" {
		like := "%" + search + "%"
		regQuery = regQuery.Where("registration_number LIKE ?", like)
	}

	regQuery.Order("created_at DESC").Limit(limit).Find(&followUps)

	for _, reg := range followUps {
		// If specific search is set, also match by patient identity
		if search != "" {
			searchLower := strings.ToLower(search)
			patientName := ""
			patientNoBPJS := ""
			if reg.Patient != nil {
				patientName = strings.ToLower(reg.Patient.NamaLengkap)
				patientNoBPJS = strings.ToLower(reg.Patient.NoBPJS)
			}
			regNo := strings.ToLower(reg.RegistrationNumber)
			if !strings.Contains(patientName, searchLower) && !strings.Contains(patientNoBPJS, searchLower) && !strings.Contains(regNo, searchLower) {
				continue
			}
		}

		monitorStatus := "active"
		switch reg.Status {
		case models.RegistrationStatusInQueue, models.RegistrationStatusInProgress, models.RegistrationStatusCompleted, models.RegistrationStatusDischarged:
			monitorStatus = "used"
		case models.RegistrationStatusCancelled, models.RegistrationStatusNoShow:
			monitorStatus = "cancelled"
		}

		tglKontrol := ""
		if reg.ScheduledDate != nil && !reg.ScheduledDate.IsZero() {
			tglKontrol = reg.ScheduledDate.Format("2006-01-02")
		}
		tglLahir := ""
		if reg.Patient != nil && reg.Patient.TanggalLahir != nil && !reg.Patient.TanggalLahir.IsZero() {
			tglLahir = reg.Patient.TanggalLahir.Time.Format("2006-01-02")
		}
		kodeDokter := ""
		namaDokter := ""
		if reg.Doctor != nil {
			kodeDokter = reg.Doctor.NIP
			namaDokter = reg.Doctor.NamaLengkap
		}
		kodePoli := ""
		namaPoli := ""
		if reg.DestinationRoom != nil {
			kodePoli = reg.DestinationRoom.Code
			namaPoli = reg.DestinationRoom.Name
		}
		noKartu := ""
		namaPasien := ""
		kelamin := ""
		if reg.Patient != nil {
			noKartu = reg.Patient.NoBPJS
			namaPasien = reg.Patient.NamaLengkap
			kelamin = string(reg.Patient.JenisKelamin)
		}

		combined = append(combined, suratKontrolMonitorItem{
			ID:                1000000000 + reg.ID,
			NoSuratKontrol:    "SIMRS-" + reg.RegistrationNumber,
			NoSEP:             reg.SEPNumber,
			RegistrationID:    &reg.ID,
			VisitID:           reg.SourceVisitID,
			PatientID:         reg.PatientID,
			NoKartu:           noKartu,
			Nama:              namaPasien,
			Kelamin:           kelamin,
			TglLahir:          tglLahir,
			TglRencanaKontrol: tglKontrol,
			KodePoli:          kodePoli,
			NamaPoli:          namaPoli,
			KodeDokter:        kodeDokter,
			NamaDokter:        namaDokter,
			NamaDiagnosa:      reg.Complaint,
			IsPRB:             false,
			UserBuat:          "SIMRS",
			Status:            monitorStatus,
			CreatedAt:         reg.CreatedAt,
			UpdatedAt:         reg.UpdatedAt,
			SourceType:        "simrs",
		})
	}

	// Keep combined list ordered by created_at desc
	for i := 0; i < len(combined)-1; i++ {
		for j := i + 1; j < len(combined); j++ {
			if combined[j].CreatedAt.After(combined[i].CreatedAt) {
				combined[i], combined[j] = combined[j], combined[i]
			}
		}
	}
	if len(combined) > limit {
		combined = combined[:limit]
	}

	c.JSON(http.StatusOK, gin.H{"data": combined})
}

// GetSuratKontrolLocal mendapatkan surat kontrol local berdasarkan noSuratKontrol
// Endpoint ini mengembalikan data surat kontrol dari database lokal termasuk SEP asal
func GetSuratKontrolLocal(c *gin.Context) {
	noSuratKontrol := c.Param("noSuratKontrol")
	if noSuratKontrol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor Surat Kontrol wajib diisi"})
		return
	}

	var suratKontrol models.SuratKontrol
	if err := database.DB.Preload("SEP").Preload("Patient").
		Where("no_surat_kontrol = ?", noSuratKontrol).
		First(&suratKontrol).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat Kontrol tidak ditemukan di database lokal"})
		return
	}

	// Return data termasuk NoSEP asal
	c.JSON(http.StatusOK, gin.H{
		"data": suratKontrol,
		"sep_asal": gin.H{
			"no_sep": suratKontrol.NoSEP,
			"sep_id": suratKontrol.SEPID,
		},
	})
}

// VClaimDeleteSuratKontrol menghapus surat kontrol
func VClaimDeleteSuratKontrol(c *gin.Context) {
	noSuratKontrol := c.Param("noSuratKontrol")
	if noSuratKontrol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor Surat Kontrol wajib diisi"})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Delete from BPJS
	if err := client.DeleteSuratKontrol(noSuratKontrol, user.Username); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal menghapus Surat Kontrol: " + err.Error()})
		return
	}

	// Update status di database
	database.DB.Model(&models.SuratKontrol{}).Where("no_surat_kontrol = ?", noSuratKontrol).Update("status", "cancelled")

	c.JSON(http.StatusOK, gin.H{"message": "Surat Kontrol berhasil dihapus"})
}

// DeleteSuratKontrolLocal melepas assignment surat kontrol lokal tanpa call BPJS.
func DeleteSuratKontrolLocal(c *gin.Context) {
	noSuratKontrol := strings.TrimSpace(c.Param("noSuratKontrol"))
	if noSuratKontrol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor Surat Kontrol wajib diisi"})
		return
	}

	var sk models.SuratKontrol
	if err := database.DB.Where("no_surat_kontrol = ?", noSuratKontrol).First(&sk).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat Kontrol lokal tidak ditemukan"})
		return
	}

	tx := database.DB.Begin()

	if err := tx.Model(&models.SuratKontrol{}).
		Where("no_surat_kontrol = ?", noSuratKontrol).
		Updates(map[string]interface{}{
			"status":          "cancelled",
			"visit_id":        nil,
			"registration_id": nil,
			"sep_id":          nil,
			"updated_at":      time.Now(),
		}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status Surat Kontrol lokal: " + err.Error()})
		return
	}

	if err := tx.Model(&models.SEP{}).
		Where("no_surat_kontrol = ?", noSuratKontrol).
		Updates(map[string]interface{}{
			"no_surat_kontrol": "",
			"updated_at":       time.Now(),
		}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal melepas relasi SEP lokal: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan perubahan unlink Surat Kontrol: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Surat Kontrol berhasil di-unlink dari sistem lokal"})
}

// VClaimGetPRBOptions mendapatkan opsi status PRB
func VClaimGetPRBOptions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": models.PRBStatusOptions})
}

// VClaimSearchPoliSuratKontrol mencari poli untuk surat kontrol (rawat jalan)
func VClaimSearchPoliSuratKontrol(c *gin.Context) {
	nama := c.Query("nama")
	if nama == "" {
		nama = "umum" // Default untuk rawat jalan
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	poli, err := client.GetReferensiPoli(nama)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": poli})
}

// VClaimSearchDokterSuratKontrol mencari dokter untuk surat kontrol (rawat jalan)
func VClaimSearchDokterSuratKontrol(c *gin.Context) {
	kodePoli := c.Query("kode_poli")
	tglPelayanan := c.Query("tgl_pelayanan")

	if kodePoli == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode poli wajib diisi"})
		return
	}

	if tglPelayanan == "" {
		tglPelayanan = time.Now().Format("2006-01-02")
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Use jnsPelayanan = 2 for rawat jalan
	dokter, err := client.GetReferensiDokterDPJP("2", tglPelayanan, kodePoli)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": dokter})
}

// ==================== REFERENSI VCLAIM ====================

// VClaimGetReferensiPoli mendapatkan referensi poli dari VClaim
func VClaimGetReferensiPoli(c *gin.Context) {
	nama := c.Query("nama")
	if nama == "" {
		nama = "umum" // default search
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	poli, err := client.GetReferensiPoli(nama)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": poli})
}

// VClaimGetReferensiDiagnosa mendapatkan referensi diagnosa ICD-10
func VClaimGetReferensiDiagnosa(c *gin.Context) {
	kode := c.Query("kode")
	if kode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode diagnosa wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	diagnosa, err := client.GetReferensiDiagnosa(kode)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": diagnosa})
}

// VClaimGetReferensiFaskes mendapatkan referensi faskes
func VClaimGetReferensiFaskes(c *gin.Context) {
	nama := c.Query("nama")
	jenis := c.DefaultQuery("jenis", "1") // 1=Faskes 1, 2=RS

	if nama == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama faskes wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	faskes, err := client.GetReferensiFaskes(nama, jenis)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": faskes})
}

// VClaimGetReferensiDokterDPJP mendapatkan referensi dokter DPJP
func VClaimGetReferensiDokterDPJP(c *gin.Context) {
	jnsPelayanan := c.DefaultQuery("jnsPelayanan", "2") // Default rajal
	tglPelayanan := c.Query("tglPelayanan")
	spesialis := c.Query("spesialis")

	if tglPelayanan == "" {
		tglPelayanan = time.Now().Format("2006-01-02")
	}
	if spesialis == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode spesialis wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	dokter, err := client.GetReferensiDokterDPJP(jnsPelayanan, tglPelayanan, spesialis)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": dokter})
}

// VClaimGetReferensiPropinsi mendapatkan referensi propinsi dari VClaim
func VClaimGetReferensiPropinsi(c *gin.Context) {
	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	propinsi, err := client.GetReferensiPropinsi()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": propinsi})
}

// VClaimGetReferensiKabupaten mendapatkan referensi kabupaten berdasarkan kode propinsi
func VClaimGetReferensiKabupaten(c *gin.Context) {
	kdPropinsi := c.Param("kdPropinsi")
	if kdPropinsi == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode propinsi wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	kabupaten, err := client.GetReferensiKabupaten(kdPropinsi)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": kabupaten})
}

// VClaimGetReferensiKecamatan mendapatkan referensi kecamatan berdasarkan kode kabupaten
func VClaimGetReferensiKecamatan(c *gin.Context) {
	kdKabupaten := c.Param("kdKabupaten")
	if kdKabupaten == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode kabupaten wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	kecamatan, err := client.GetReferensiKecamatan(kdKabupaten)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": kecamatan})
}

// ==================== RENCANA KONTROL / SKDP ====================

// VClaimGetRencanaKontrolBySEP mendapatkan data rencana kontrol berdasarkan nomor SEP
func VClaimGetRencanaKontrolBySEP(c *gin.Context) {
	noSEP := c.Param("noSEP")
	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	rencanaKontrol, err := client.GetRencanaKontrolBySEP(noSEP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rencanaKontrol})
}

// VClaimGetListRencanaKontrol mendapatkan list rencana kontrol/SPRI berdasarkan nomor kartu
func VClaimGetListRencanaKontrol(c *gin.Context) {
	noKartu := c.Param("noKartu")
	bulan := c.DefaultQuery("bulan", time.Now().Format("01"))
	tahun := c.DefaultQuery("tahun", time.Now().Format("2006"))
	filter := c.DefaultQuery("filter", "2") // 1=Tanggal Rencana Kontrol, 2=Tanggal Entry

	if noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	list, err := client.GetListRencanaKontrolByNoKartu(noKartu, bulan, tahun, filter)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

// ==================== SEP OPTIONS ====================

// VClaimGetSEPOptions mendapatkan semua pilihan/options untuk form SEP
func VClaimGetSEPOptions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"jenis_pelayanan":     models.JenisPelayanan,
			"kelas_rawat":         models.KelasRawat,
			"kelas_rawat_naik":    models.KelasRawatNaik,
			"pembiayaan":          models.PembiayaanNaikKelas,
			"asal_rujukan":        models.AsalRujukan,
			"laka_lantas":         models.LakaLantas,
			"tujuan_kunjungan":    models.TujuanKunjungan,
			"flag_procedure":      models.FlagProcedure,
			"kd_penunjang":        models.KdPenunjang,
			"assesment_pelayanan": models.AssesmentPelayanan,
			"ya_tidak":            models.YaTidak,
		},
	})
}

// ==================== SEP LOCAL ====================

func unlinkSEPAssignments(tx *gorm.DB, noSEP string) error {
	cleanSEP := strings.TrimSpace(noSEP)
	if cleanSEP == "" {
		return nil
	}

	var sep models.SEP
	if err := tx.Select("id", "registration_id", "visit_id").Where("no_sep = ?", cleanSEP).First(&sep).Error; err == nil {
		if sep.RegistrationID != nil && *sep.RegistrationID > 0 {
			if err := tx.Model(&models.Registration{}).
				Where("id = ?", *sep.RegistrationID).
				Update("sep_number", "").Error; err != nil {
				return err
			}
		}
	}

	if err := tx.Model(&models.Registration{}).
		Where("sep_number = ? OR TRIM(sep_number) = ?", cleanSEP, cleanSEP).
		Update("sep_number", "").Error; err != nil {
		return err
	}

	if err := tx.Model(&models.SEP{}).
		Where("no_sep = ?", cleanSEP).
		Updates(map[string]interface{}{
			"registration_id": nil,
			"visit_id":        nil,
		}).Error; err != nil {
		return err
	}

	return nil
}

func resolveAssignedSEP(registrationID *uint, visitID *uint) (*models.SEP, error) {
	if registrationID != nil && *registrationID > 0 {
		var registration models.Registration
		if err := database.DB.Select("id", "sep_number").First(&registration, *registrationID).Error; err == nil {
			assignedSEPNumber := strings.TrimSpace(registration.SEPNumber)
			if assignedSEPNumber != "" {
				var sep models.SEP
				if err := database.DB.
					Where("no_sep = ? AND status = ?", assignedSEPNumber, "active").
					Order("updated_at DESC, id DESC").
					First(&sep).Error; err == nil {
					return &sep, nil
				}
			}
		}
	}

	if visitID != nil && *visitID > 0 {
		var sep models.SEP
		if err := database.DB.
			Where("visit_id = ? AND status = ?", *visitID, "active").
			Order("updated_at DESC, id DESC").
			First(&sep).Error; err == nil {
			return &sep, nil
		}
	}

	if registrationID != nil && *registrationID > 0 {
		var sep models.SEP
		if err := database.DB.
			Where("registration_id = ? AND status = ?", *registrationID, "active").
			Order("updated_at DESC, id DESC").
			First(&sep).Error; err == nil {
			return &sep, nil
		}
	}

	return nil, gorm.ErrRecordNotFound
}

// GetSEPByVisit mendapatkan SEP berdasarkan visit_id
func GetSEPByVisit(c *gin.Context) {
	visitID := c.Param("visitId")

	var visit models.Visit
	if err := database.DB.Select("id", "registration_id").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	sep, err := resolveAssignedSEP(&visit.RegistrationID, &visit.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan untuk visit ini"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sep})
}

// GetSEPByRegistration mendapatkan SEP berdasarkan registration_id
func GetSEPByRegistration(c *gin.Context) {
	registrationID := c.Param("registrationId")

	var registration models.Registration
	if err := database.DB.Select("id").First(&registration, registrationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pendaftaran tidak ditemukan"})
		return
	}

	sep, err := resolveAssignedSEP(&registration.ID, nil)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sep})
}

// GetSEPList mendapatkan list SEP dengan filter
func GetSEPList(c *gin.Context) {
	var seps []models.SEP
	query := database.DB.Preload("Patient").Preload("Registration")

	// Filter by patient_id (REQUIRED for security)
	if patientID := c.Query("patient_id"); patientID != "" {
		query = query.Where("patient_id = ?", patientID)
	}

	// Filter by registration_id
	if registrationID := c.Query("registration_id"); registrationID != "" {
		query = query.Where("registration_id = ?", registrationID)
	}

	// Filter by no_sep
	if noSEP := c.Query("no_sep"); noSEP != "" {
		query = query.Where("no_sep = ?", noSEP)
	}

	// Filter by tanggal
	if tglSEP := c.Query("tgl_sep"); tglSEP != "" {
		query = query.Where("tgl_sep = ?", tglSEP)
	}

	// Filter by no_kartu
	if noKartu := c.Query("no_kartu"); noKartu != "" {
		query = query.Where("no_kartu = ?", noKartu)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Limit
	limit := 100
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	query.Order("created_at DESC").Limit(limit).Find(&seps)

	c.JSON(http.StatusOK, gin.H{"data": seps})
}

// DeleteSEPLocal melepas assignment SEP lokal (unlink) tanpa call BPJS,
// dan menandai status lokal menjadi deleted (tidak hard delete).
func DeleteSEPLocal(c *gin.Context) {
	noSEP := strings.TrimSpace(c.Param("noSEP"))
	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	var sep models.SEP
	if err := database.DB.Where("no_sep = ?", noSEP).First(&sep).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP lokal tidak ditemukan"})
		return
	}

	tx := database.DB.Begin()
	if err := unlinkSEPAssignments(tx, noSEP); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal melepas assignment SEP lokal: " + err.Error()})
		return
	}

	if err := tx.Model(&models.SEP{}).Where("no_sep = ?", noSEP).Updates(map[string]interface{}{
		"status":     "deleted",
		"updated_at": time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status SEP lokal: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan perubahan unlink SEP: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SEP berhasil di-unlink dari sistem lokal"})
}

// UpdateSEPVisitID mengupdate visit_id di SEP lokal (untuk link SEP ke visit rawat inap)
func UpdateSEPVisitID(c *gin.Context) {
	noSEP := c.Param("noSEP")
	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	var input struct {
		VisitID uint `json:"visit_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find SEP
	var sep models.SEP
	if err := database.DB.Where("no_sep = ?", noSEP).First(&sep).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan"})
		return
	}

	// Update visit_id
	sep.VisitID = &input.VisitID
	if err := database.DB.Save(&sep).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate SEP: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SEP berhasil diupdate dengan visit_id",
		"data":    sep,
	})
}

// ==================== SURAT KONTROL UNTUK CHECK-IN ====================

// VClaimGetSuratKontrolDetail mendapatkan detail surat kontrol berdasarkan nomor surat
func VClaimGetSuratKontrolDetail(c *gin.Context) {
	noSuratKontrol := c.Param("noSuratKontrol")

	if noSuratKontrol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor surat kontrol wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	result, err := client.GetSuratKontrolDetail(noSuratKontrol)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// VClaimCariSuratKontrolByNoKartu mencari surat kontrol berdasarkan nomor kartu
func VClaimCariSuratKontrolByNoKartu(c *gin.Context) {
	noKartu := c.Param("noKartu")
	bulan := c.Query("bulan")
	tahun := c.Query("tahun")
	filter := c.Query("filter") // 1=Tanggal Rencana Kontrol, 2=Tanggal Entry

	if noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu wajib diisi"})
		return
	}

	// Default ke bulan dan tahun sekarang
	now := time.Now()
	if bulan == "" {
		bulan = fmt.Sprintf("%02d", now.Month())
	}
	if tahun == "" {
		tahun = fmt.Sprintf("%d", now.Year())
	}
	if filter == "" {
		filter = "1" // Default filter by tanggal rencana kontrol
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	result, err := client.GetListRencanaKontrolByNoKartu(noKartu, bulan, tahun, filter)
	if err != nil {
		// Jika tidak ada data, return empty array
		if strings.Contains(err.Error(), "tidak ditemukan") || strings.Contains(err.Error(), "Data Tidak Ditemukan") {
			c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// VClaimInsertSEPKontrol menerbitkan SEP untuk pasien kontrol menggunakan surat kontrol
func VClaimInsertSEPKontrol(c *gin.Context) {
	var input struct {
		RegistrationID  uint   `json:"registration_id"`
		NoSuratKontrol  string `json:"no_surat_kontrol" binding:"required"`
		NoSEPAsal       string `json:"no_sep_asal" binding:"required"`
		TglSEPAsal      string `json:"tgl_sep_asal" binding:"required"`
		DiagAwal        string `json:"diag_awal" binding:"required"`
		NoTelp          string `json:"no_telp" binding:"required"`
		Catatan         string `json:"catatan"`
		KodeDPJP        string `json:"kode_dokter" binding:"required"`
		KodePoli        string `json:"kode_poli" binding:"required"`
		NoKartu         string `json:"no_kartu" binding:"required"`
		KlsRawatHak     string `json:"kls_rawat_hak"`
		KlsRawatNaik    string `json:"kls_rawat_naik"`
		Pembiayaan      string `json:"pembiayaan"`
		PenanggungJawab string `json:"penanggung_jawab"`
		JnsPelayanan    string `json:"jns_pelayanan"` // Default 2 = Rawat Jalan
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get registration with patient if provided
	var registration *models.Registration
	var patient *models.Patient
	if input.RegistrationID > 0 {
		var reg models.Registration
		if err := database.DB.Preload("Patient").First(&reg, input.RegistrationID).Error; err == nil {
			registration = &reg
			patient = reg.Patient
		}
	}

	// Get current user
	userID := c.GetUint("user_id")
	var user models.User
	database.DB.First(&user, userID)
	userName := user.FullName
	if userName == "" {
		userName = user.Username
	}

	// Create VClaim client
	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Validasi kode_ppk dari config
	if client.KodePPK == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode PPK (Faskes) belum dikonfigurasi. Silakan isi di menu Integrasi > BPJS"})
		return
	}

	// Set defaults
	tglSEP := time.Now().Format("2006-01-02")
	jnsPelayanan := input.JnsPelayanan
	if jnsPelayanan == "" {
		jnsPelayanan = "2" // Rawat Jalan
	}
	klsRawatHak := input.KlsRawatHak
	if klsRawatHak == "" {
		klsRawatHak = "3" // Default kelas 3
	}

	// Get NoMR from patient if available
	noMR := ""
	if patient != nil {
		noMR = patient.NoRM
	}

	// Build SEP request using existing SEPData structure
	sepData := &bpjs.SEPData{
		NoKartu:      input.NoKartu,
		TglSep:       tglSEP,
		PPKPelayanan: client.KodePPK,
		JnsPelayanan: jnsPelayanan,
		KlsRawat: bpjs.SEPKelasRawat{
			KlsRawatHak:     klsRawatHak,
			KlsRawatNaik:    input.KlsRawatNaik,
			Pembiayaan:      input.Pembiayaan,
			PenanggungJawab: input.PenanggungJawab,
		},
		NoMR: noMR,
		Rujukan: bpjs.SEPRujukan{
			AsalRujukan: "2",              // 2 = Kontrol/internal
			TglRujukan:  input.TglSEPAsal, // Tanggal SEP asal
			NoRujukan:   input.NoSEPAsal,  // Nomor SEP asal (bukan surat kontrol)
			PPKRujukan:  client.KodePPK,   // RS sendiri
		},
		Catatan:  input.Catatan,
		DiagAwal: input.DiagAwal,
		Poli: bpjs.SEPPoli{
			Tujuan:    input.KodePoli,
			Eksekutif: "0",
		},
		Cob: bpjs.SEPCob{
			Cob: "0",
		},
		Katarak: bpjs.SEPKatarak{
			Katarak: "0",
		},
		Jaminan: bpjs.SEPJaminan{
			LakaLantas: "0",
			NoLP:       "",
			Penjamin: &bpjs.SEPPenjamin{
				Penjamin:    "0",
				TglKejadian: "",
				Keterangan:  "",
				Suplesi: &bpjs.SEPSuplesi{
					Suplesi:      "0",
					NoSepSuplesi: "",
					LokasiLaka: &bpjs.SEPLokasiLaka{
						KdPropinsi:  "",
						KdKabupaten: "",
						KdKecamatan: "",
					},
				},
			},
		},
		TujuanKunj:    "0", // Normal
		FlagProcedure: "",
		KdPenunjang:   "",
		AssesmentPel:  "",
		SKDP: bpjs.SEPSKDP{
			NoSurat:  input.NoSuratKontrol,
			KodeDPJP: input.KodeDPJP,
		},
		DPJPLayan: input.KodeDPJP,
		NoTelp:    input.NoTelp,
		User:      userName,
	}

	// Call VClaim API
	sepResponse, err := client.InsertSEP(sepData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal membuat SEP: " + err.Error()})
		return
	}

	// Save SEP to database
	var registrationID *uint
	var patientID uint
	if registration != nil {
		registrationID = &registration.ID
		patientID = registration.PatientID
	}

	sep := models.SEP{
		NoSEP:          sepResponse.Sep.NoSep,
		RegistrationID: registrationID,
		PatientID:      patientID,
		NoKartu:        input.NoKartu,
		TglSEP:         tglSEP,
		JnsPelayanan:   jnsPelayanan,
		KlsRawatHak:    klsRawatHak,
		KlsRawatNaik:   input.KlsRawatNaik,
		Pembiayaan:     input.Pembiayaan,
		AsalRujukan:    "2",
		NoRujukan:      input.NoSEPAsal,
		TglRujukan:     input.TglSEPAsal,
		PPKRujukan:     client.KodePPK,
		KodePoli:       input.KodePoli,
		KodeDPJP:       input.KodeDPJP,
		PPKPelayanan:   client.KodePPK,
		DiagAwal:       input.DiagAwal,
		NoSuratKontrol: input.NoSuratKontrol,
		Catatan:        input.Catatan,
		NoTelp:         input.NoTelp,
		UserBuat:       userName,
		Status:         "aktif",
	}

	if err := database.DB.Create(&sep).Error; err != nil {
		// SEP already created in BPJS but failed to save locally
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "SEP berhasil diterbitkan di BPJS tapi gagal disimpan di database: " + err.Error(),
			"no_sep":   sepResponse.Sep.NoSep,
			"sep_data": sepResponse,
		})
		return
	}

	// Update registration with SEP number if provided
	if registration != nil {
		registration.SEPNumber = sepResponse.Sep.NoSep
		database.DB.Save(registration)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SEP kontrol berhasil diterbitkan",
		"data": gin.H{
			"noSep": sepResponse.Sep.NoSep,
			"sepId": sep.ID,
		},
	})
}

// VClaimGetListPersetujuanSEP mendapatkan daftar SEP yang butuh persetujuan
func VClaimGetListPersetujuanSEP(c *gin.Context) {
	bulan := c.Query("bulan")
	tahun := c.Query("tahun")

	if bulan == "" || tahun == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter bulan dan tahun diperlukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	list, err := client.GetListPersetujuanSEP(bulan, tahun)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil list persetujuan SEP: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}
