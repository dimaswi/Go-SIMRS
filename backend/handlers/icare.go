package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	bpjsService "starter/backend/services/bpjs"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ICareValidate menghit endpoint I-Care validate untuk mendapatkan URL I-Care
// Mengambil nomor kartu BPJS dari SEP kunjungan dan kode dokter dari mapping BPJS
func ICareValidate(c *gin.Context) {
	visitIDStr := c.Param("visitId")
	visitID, err := strconv.ParseUint(visitIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID tidak valid"})
		return
	}

	// Load visit dengan SEP dan Doctor
	var visit models.Visit
	if err := database.DB.Preload("SEP").Preload("Doctor").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Pastikan kunjungan punya SEP (pasien BPJS)
	if visit.SEP == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan ini tidak memiliki SEP. I-Care hanya untuk pasien BPJS."})
		return
	}

	noKartu := visit.SEP.NoKartu
	if noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu BPJS tidak ditemukan pada SEP"})
		return
	}

	// Cari kode dokter BPJS dari mapping
	if visit.DoctorID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan ini tidak memiliki dokter"})
		return
	}

	var doctorMapping models.BPJSDoctorMapping
	if err := database.DB.Where("employee_id = ? AND is_active = ?", *visit.DoctorID, true).
		First(&doctorMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Dokter belum di-mapping ke BPJS. Silakan mapping dokter di menu Integrasi > BPJS > Mapping Dokter."),
		})
		return
	}

	// Parse kode dokter ke integer
	kodeDokter, err := strconv.Atoi(doctorMapping.KodeDokterBPJS)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Format kode dokter BPJS tidak valid: %s", doctorMapping.KodeDokterBPJS),
		})
		return
	}

	// Panggil I-Care API
	client, err := bpjsService.NewICareClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Gagal menginisialisasi I-Care client: %v", err),
		})
		return
	}

	url, err := client.Validate(noKartu, kodeDokter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Gagal memanggil I-Care: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":     url,
		"message": "Berhasil mendapatkan URL I-Care",
	})
}

// ICareValidateManual menghit endpoint I-Care validate dengan input manual nomor kartu dan kode dokter
func ICareValidateManual(c *gin.Context) {
	var req struct {
		NoKartu    string `json:"no_kartu" binding:"required"`
		KodeDokter int    `json:"kode_dokter" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No. Kartu dan Kode Dokter wajib diisi"})
		return
	}

	client, err := bpjsService.NewICareClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Gagal menginisialisasi I-Care client: %v", err),
		})
		return
	}

	url, err := client.Validate(req.NoKartu, req.KodeDokter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Gagal memanggil I-Care: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":     url,
		"message": "Berhasil mendapatkan URL I-Care",
	})
}
