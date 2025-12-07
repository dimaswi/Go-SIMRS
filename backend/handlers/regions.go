package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"sync"

	"github.com/gin-gonic/gin"
)

const baseURL = "https://emsifa.github.io/api-wilayah-indonesia/api"

// API Response structures
type ProvinceAPI struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RegencyAPI struct {
	ID         string `json:"id"`
	ProvinceID string `json:"province_id"`
	Name       string `json:"name"`
}

type DistrictAPI struct {
	ID        string `json:"id"`
	RegencyID string `json:"regency_id"`
	Name      string `json:"name"`
}

type VillageAPI struct {
	ID         string `json:"id"`
	DistrictID string `json:"district_id"`
	Name       string `json:"name"`
}

// GetProvinces returns all provinces
func GetProvinces(c *gin.Context) {
	var provinces []models.Province
	if err := database.DB.Order("name ASC").Find(&provinces).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": provinces})
}

// GetProvince returns a single province by ID
func GetProvince(c *gin.Context) {
	id := c.Param("id")

	var province models.Province
	if err := database.DB.Preload("Regencies").First(&province, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provinsi tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": province})
}

// GetAllRegencies returns all regencies with province info
func GetAllRegencies(c *gin.Context) {
	var regencies []models.Regency
	if err := database.DB.Preload("Province").Order("name ASC").Find(&regencies).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": regencies})
}

// GetRegencies returns regencies by province ID
func GetRegencies(c *gin.Context) {
	provinceID := c.Param("province_id")

	var regencies []models.Regency
	query := database.DB.Order("name ASC")

	if provinceID != "" {
		query = query.Where("province_id = ?", provinceID)
	}

	if err := query.Find(&regencies).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": regencies})
}

// GetRegency returns a single regency by ID
func GetRegency(c *gin.Context) {
	id := c.Param("id")

	var regency models.Regency
	if err := database.DB.Preload("Province").Preload("Districts").First(&regency, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kabupaten/Kota tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": regency})
}

// GetDistricts returns districts by regency ID
func GetDistricts(c *gin.Context) {
	regencyID := c.Param("regency_id")

	var districts []models.District
	query := database.DB.Order("name ASC")

	if regencyID != "" {
		query = query.Where("regency_id = ?", regencyID)
	}

	if err := query.Find(&districts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": districts})
}

// GetDistrict returns a single district by ID
func GetDistrict(c *gin.Context) {
	id := c.Param("id")

	var district models.District
	if err := database.DB.Preload("Regency.Province").Preload("Villages").First(&district, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kecamatan tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": district})
}

// GetVillages returns villages by district ID
func GetVillages(c *gin.Context) {
	districtID := c.Param("district_id")

	var villages []models.Village
	query := database.DB.Order("name ASC")

	if districtID != "" {
		query = query.Where("district_id = ?", districtID)
	}

	if err := query.Find(&villages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": villages})
}

// GetVillage returns a single village by ID
func GetVillage(c *gin.Context) {
	id := c.Param("id")

	var village models.Village
	if err := database.DB.Preload("District.Regency.Province").First(&village, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kelurahan/Desa tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": village})
}

// GetRegionStats returns statistics of region data
func GetRegionStats(c *gin.Context) {
	var provinceCount, regencyCount, districtCount, villageCount int64

	database.DB.Model(&models.Province{}).Count(&provinceCount)
	database.DB.Model(&models.Regency{}).Count(&regencyCount)
	database.DB.Model(&models.District{}).Count(&districtCount)
	database.DB.Model(&models.Village{}).Count(&villageCount)

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"provinces": provinceCount,
			"regencies": regencyCount,
			"districts": districtCount,
			"villages":  villageCount,
		},
	})
}

// SyncRegions syncs region data from external API
func SyncRegions(c *gin.Context) {
	// Create a channel to report progress
	progress := make(chan string, 100)
	done := make(chan bool)
	var syncErrors []string
	var mu sync.Mutex

	go func() {
		defer close(done)

		// Step 1: Sync Provinces
		progress <- "Mengambil data provinsi..."
		provinces, err := fetchProvinces()
		if err != nil {
			mu.Lock()
			syncErrors = append(syncErrors, fmt.Sprintf("Gagal mengambil provinsi: %v", err))
			mu.Unlock()
			return
		}

		progress <- fmt.Sprintf("Menyimpan %d provinsi...", len(provinces))
		for _, p := range provinces {
			province := models.Province{ID: p.ID, Name: p.Name}
			database.DB.Where(models.Province{ID: p.ID}).Assign(province).FirstOrCreate(&province)
		}

		// Step 2: Sync Regencies
		progress <- "Mengambil data kabupaten/kota..."
		var allRegencies []RegencyAPI
		for _, p := range provinces {
			regencies, err := fetchRegencies(p.ID)
			if err != nil {
				mu.Lock()
				syncErrors = append(syncErrors, fmt.Sprintf("Gagal mengambil kabupaten provinsi %s: %v", p.Name, err))
				mu.Unlock()
				continue
			}
			allRegencies = append(allRegencies, regencies...)
		}

		progress <- fmt.Sprintf("Menyimpan %d kabupaten/kota...", len(allRegencies))
		for _, r := range allRegencies {
			regency := models.Regency{ID: r.ID, ProvinceID: r.ProvinceID, Name: r.Name}
			database.DB.Where(models.Regency{ID: r.ID}).Assign(regency).FirstOrCreate(&regency)
		}

		// Step 3: Sync Districts (in batches to avoid rate limiting)
		progress <- "Mengambil data kecamatan..."
		var allDistricts []DistrictAPI
		for i, r := range allRegencies {
			districts, err := fetchDistricts(r.ID)
			if err != nil {
				mu.Lock()
				syncErrors = append(syncErrors, fmt.Sprintf("Gagal mengambil kecamatan kabupaten %s: %v", r.Name, err))
				mu.Unlock()
				continue
			}
			allDistricts = append(allDistricts, districts...)

			if (i+1)%50 == 0 {
				progress <- fmt.Sprintf("Mengambil kecamatan... %d/%d kabupaten", i+1, len(allRegencies))
			}
		}

		progress <- fmt.Sprintf("Menyimpan %d kecamatan...", len(allDistricts))
		for _, d := range allDistricts {
			district := models.District{ID: d.ID, RegencyID: d.RegencyID, Name: d.Name}
			database.DB.Where(models.District{ID: d.ID}).Assign(district).FirstOrCreate(&district)
		}

		// Step 4: Sync Villages (this takes the longest)
		progress <- "Mengambil data kelurahan/desa..."
		var allVillages []VillageAPI
		for i, d := range allDistricts {
			villages, err := fetchVillages(d.ID)
			if err != nil {
				mu.Lock()
				syncErrors = append(syncErrors, fmt.Sprintf("Gagal mengambil desa kecamatan %s: %v", d.Name, err))
				mu.Unlock()
				continue
			}
			allVillages = append(allVillages, villages...)

			if (i+1)%100 == 0 {
				progress <- fmt.Sprintf("Mengambil desa... %d/%d kecamatan", i+1, len(allDistricts))
			}
		}

		progress <- fmt.Sprintf("Menyimpan %d kelurahan/desa...", len(allVillages))
		// Batch insert villages for better performance
		batchSize := 1000
		for i := 0; i < len(allVillages); i += batchSize {
			end := i + batchSize
			if end > len(allVillages) {
				end = len(allVillages)
			}
			batch := allVillages[i:end]
			for _, v := range batch {
				village := models.Village{ID: v.ID, DistrictID: v.DistrictID, Name: v.Name}
				database.DB.Where(models.Village{ID: v.ID}).Assign(village).FirstOrCreate(&village)
			}
			progress <- fmt.Sprintf("Menyimpan desa... %d/%d", end, len(allVillages))
		}

		progress <- "Sinkronisasi selesai!"
	}()

	// Wait for completion and collect messages
	var messages []string
	go func() {
		for msg := range progress {
			messages = append(messages, msg)
		}
	}()

	<-done

	// Get final counts
	var provinceCount, regencyCount, districtCount, villageCount int64
	database.DB.Model(&models.Province{}).Count(&provinceCount)
	database.DB.Model(&models.Regency{}).Count(&regencyCount)
	database.DB.Model(&models.District{}).Count(&districtCount)
	database.DB.Model(&models.Village{}).Count(&villageCount)

	c.JSON(http.StatusOK, gin.H{
		"message": "Sinkronisasi wilayah selesai",
		"data": gin.H{
			"provinces": provinceCount,
			"regencies": regencyCount,
			"districts": districtCount,
			"villages":  villageCount,
		},
		"errors": syncErrors,
	})
}

// SyncProvincesOnly syncs only provinces (quick sync)
func SyncProvincesOnly(c *gin.Context) {
	provinces, err := fetchProvinces()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal mengambil provinsi: %v", err)})
		return
	}

	for _, p := range provinces {
		province := models.Province{ID: p.ID, Name: p.Name}
		database.DB.Where(models.Province{ID: p.ID}).Assign(province).FirstOrCreate(&province)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Berhasil menyinkronkan %d provinsi", len(provinces)),
		"data":    provinces,
	})
}

// SyncRegenciesByProvince syncs regencies for a specific province
func SyncRegenciesByProvince(c *gin.Context) {
	provinceID := c.Param("province_id")

	regencies, err := fetchRegencies(provinceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal mengambil kabupaten: %v", err)})
		return
	}

	for _, r := range regencies {
		regency := models.Regency{ID: r.ID, ProvinceID: r.ProvinceID, Name: r.Name}
		database.DB.Where(models.Regency{ID: r.ID}).Assign(regency).FirstOrCreate(&regency)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Berhasil menyinkronkan %d kabupaten/kota", len(regencies)),
		"data":    regencies,
	})
}

// SyncDistrictsByRegency syncs districts for a specific regency
func SyncDistrictsByRegency(c *gin.Context) {
	regencyID := c.Param("regency_id")

	districts, err := fetchDistricts(regencyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal mengambil kecamatan: %v", err)})
		return
	}

	for _, d := range districts {
		district := models.District{ID: d.ID, RegencyID: d.RegencyID, Name: d.Name}
		database.DB.Where(models.District{ID: d.ID}).Assign(district).FirstOrCreate(&district)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Berhasil menyinkronkan %d kecamatan", len(districts)),
		"data":    districts,
	})
}

// SyncVillagesByDistrict syncs villages for a specific district
func SyncVillagesByDistrict(c *gin.Context) {
	districtID := c.Param("district_id")

	villages, err := fetchVillages(districtID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal mengambil desa: %v", err)})
		return
	}

	for _, v := range villages {
		village := models.Village{ID: v.ID, DistrictID: v.DistrictID, Name: v.Name}
		database.DB.Where(models.Village{ID: v.ID}).Assign(village).FirstOrCreate(&village)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Berhasil menyinkronkan %d kelurahan/desa", len(villages)),
		"data":    villages,
	})
}

// Helper functions to fetch data from API
func fetchProvinces() ([]ProvinceAPI, error) {
	resp, err := http.Get(fmt.Sprintf("%s/provinces.json", baseURL))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var provinces []ProvinceAPI
	if err := json.Unmarshal(body, &provinces); err != nil {
		return nil, err
	}

	return provinces, nil
}

func fetchRegencies(provinceID string) ([]RegencyAPI, error) {
	resp, err := http.Get(fmt.Sprintf("%s/regencies/%s.json", baseURL, provinceID))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var regencies []RegencyAPI
	if err := json.Unmarshal(body, &regencies); err != nil {
		return nil, err
	}

	return regencies, nil
}

func fetchDistricts(regencyID string) ([]DistrictAPI, error) {
	resp, err := http.Get(fmt.Sprintf("%s/districts/%s.json", baseURL, regencyID))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var districts []DistrictAPI
	if err := json.Unmarshal(body, &districts); err != nil {
		return nil, err
	}

	return districts, nil
}

func fetchVillages(districtID string) ([]VillageAPI, error) {
	resp, err := http.Get(fmt.Sprintf("%s/villages/%s.json", baseURL, districtID))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var villages []VillageAPI
	if err := json.Unmarshal(body, &villages); err != nil {
		return nil, err
	}

	return villages, nil
}

// CRUD operations for manual management

// CreateProvince creates a new province
func CreateProvince(c *gin.Context) {
	var input struct {
		ID   string `json:"id" binding:"required"`
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	province := models.Province{ID: input.ID, Name: input.Name}
	if err := database.DB.Create(&province).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat provinsi: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": province, "message": "Provinsi berhasil dibuat"})
}

// UpdateProvince updates a province
func UpdateProvince(c *gin.Context) {
	id := c.Param("id")

	var province models.Province
	if err := database.DB.First(&province, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provinsi tidak ditemukan"})
		return
	}

	var input struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	province.Name = input.Name
	if err := database.DB.Save(&province).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate provinsi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": province, "message": "Provinsi berhasil diupdate"})
}

// CreateRegency creates a new regency
func CreateRegency(c *gin.Context) {
	var input struct {
		ID         string `json:"id" binding:"required"`
		ProvinceID string `json:"province_id" binding:"required"`
		Name       string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify province exists
	var province models.Province
	if err := database.DB.First(&province, "id = ?", input.ProvinceID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provinsi tidak ditemukan"})
		return
	}

	regency := models.Regency{ID: input.ID, ProvinceID: input.ProvinceID, Name: input.Name}
	if err := database.DB.Create(&regency).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kabupaten/kota: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": regency, "message": "Kabupaten/Kota berhasil dibuat"})
}

// UpdateRegency updates a regency
func UpdateRegency(c *gin.Context) {
	id := c.Param("id")

	var regency models.Regency
	if err := database.DB.First(&regency, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kabupaten/Kota tidak ditemukan"})
		return
	}

	var input struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	regency.Name = input.Name
	if err := database.DB.Save(&regency).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate kabupaten/kota"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": regency, "message": "Kabupaten/Kota berhasil diupdate"})
}

// CreateDistrict creates a new district
func CreateDistrict(c *gin.Context) {
	var input struct {
		ID        string `json:"id" binding:"required"`
		RegencyID string `json:"regency_id" binding:"required"`
		Name      string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify regency exists
	var regency models.Regency
	if err := database.DB.First(&regency, "id = ?", input.RegencyID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kabupaten/Kota tidak ditemukan"})
		return
	}

	district := models.District{ID: input.ID, RegencyID: input.RegencyID, Name: input.Name}
	if err := database.DB.Create(&district).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kecamatan: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": district, "message": "Kecamatan berhasil dibuat"})
}

// UpdateDistrict updates a district
func UpdateDistrict(c *gin.Context) {
	id := c.Param("id")

	var district models.District
	if err := database.DB.First(&district, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kecamatan tidak ditemukan"})
		return
	}

	var input struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	district.Name = input.Name
	if err := database.DB.Save(&district).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate kecamatan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": district, "message": "Kecamatan berhasil diupdate"})
}

// CreateVillage creates a new village
func CreateVillage(c *gin.Context) {
	var input struct {
		ID         string `json:"id" binding:"required"`
		DistrictID string `json:"district_id" binding:"required"`
		Name       string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify district exists
	var district models.District
	if err := database.DB.First(&district, "id = ?", input.DistrictID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kecamatan tidak ditemukan"})
		return
	}

	village := models.Village{ID: input.ID, DistrictID: input.DistrictID, Name: input.Name}
	if err := database.DB.Create(&village).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat desa/kelurahan: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": village, "message": "Desa/Kelurahan berhasil dibuat"})
}

// UpdateVillage updates a village
func UpdateVillage(c *gin.Context) {
	id := c.Param("id")

	var village models.Village
	if err := database.DB.First(&village, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Desa/Kelurahan tidak ditemukan"})
		return
	}

	var input struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	village.Name = input.Name
	if err := database.DB.Save(&village).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate desa/kelurahan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": village, "message": "Desa/Kelurahan berhasil diupdate"})
}
