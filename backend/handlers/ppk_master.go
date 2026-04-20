package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetPPKList returns local PPK master list.
func GetPPKList(c *gin.Context) {
	search := c.Query("search")
	activeOnly := c.DefaultQuery("active", "true") != "false"
	limit := 200
	if q := c.Query("limit"); q != "" {
		if parsed, err := strconv.Atoi(q); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	query := database.DB.Model(&models.PPKMaster{})
	if activeOnly {
		query = query.Where("is_active = ?", true)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("kode_bpjs ILIKE ? OR nama ILIKE ?", like, like)
	}

	var items []models.PPKMaster
	if err := query.Order("nama ASC").Limit(limit).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data PPK"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

// GetPPKByID returns one PPK record by ID.
func GetPPKByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var item models.PPKMaster
	if err := database.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data PPK tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

// CreatePPK creates a PPK master record.
func CreatePPK(c *gin.Context) {
	var input struct {
		KodeBPJS     string `json:"kode_bpjs" binding:"required"`
		KodeKemenkes string `json:"kode_kemenkes"`
		Nama         string `json:"nama" binding:"required"`
		Jenis        string `json:"jenis"`
		Kelas        string `json:"kelas"`
		Alamat       string `json:"alamat"`
		Telepon      string `json:"telepon"`
		Wilayah      string `json:"wilayah"`
		DesWilayah   string `json:"des_wilayah"`
		IsActive     *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing models.PPKMaster
	if err := database.DB.Where("kode_bpjs = ?", input.KodeBPJS).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode BPJS sudah digunakan"})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	item := models.PPKMaster{
		KodeBPJS:     input.KodeBPJS,
		KodeKemenkes: input.KodeKemenkes,
		Nama:         input.Nama,
		Jenis:        input.Jenis,
		Kelas:        input.Kelas,
		Alamat:       input.Alamat,
		Telepon:      input.Telepon,
		Wilayah:      input.Wilayah,
		DesWilayah:   input.DesWilayah,
		IsActive:     isActive,
	}

	if err := database.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data PPK"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Data PPK berhasil ditambahkan",
		"data":    item,
	})
}

// UpdatePPK updates a PPK master record.
func UpdatePPK(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var item models.PPKMaster
	if err := database.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data PPK tidak ditemukan"})
		return
	}

	var input struct {
		KodeBPJS     string `json:"kode_bpjs"`
		KodeKemenkes string `json:"kode_kemenkes"`
		Nama         string `json:"nama"`
		Jenis        string `json:"jenis"`
		Kelas        string `json:"kelas"`
		Alamat       string `json:"alamat"`
		Telepon      string `json:"telepon"`
		Wilayah      string `json:"wilayah"`
		DesWilayah   string `json:"des_wilayah"`
		IsActive     *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.KodeBPJS != "" && input.KodeBPJS != item.KodeBPJS {
		var existing models.PPKMaster
		if err := database.DB.Where("kode_bpjs = ? AND id != ?", input.KodeBPJS, item.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode BPJS sudah digunakan"})
			return
		}
		item.KodeBPJS = input.KodeBPJS
	}
	if input.KodeKemenkes != "" {
		item.KodeKemenkes = input.KodeKemenkes
	}
	if input.Nama != "" {
		item.Nama = input.Nama
	}
	item.Jenis = input.Jenis
	item.Kelas = input.Kelas
	item.Alamat = input.Alamat
	item.Telepon = input.Telepon
	item.Wilayah = input.Wilayah
	item.DesWilayah = input.DesWilayah
	if input.IsActive != nil {
		item.IsActive = *input.IsActive
	}

	if err := database.DB.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data PPK"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data PPK berhasil diperbarui",
		"data":    item,
	})
}

// DeletePPK soft deletes a PPK record.
func DeletePPK(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var item models.PPKMaster
	if err := database.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data PPK tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data PPK"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Data PPK berhasil dihapus"})
}
