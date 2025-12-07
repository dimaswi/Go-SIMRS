package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GetEmployees returns all employees with pagination
func GetEmployees(c *gin.Context) {
	var employees []models.Employee

	// Get query parameters for filtering
	search := c.Query("search")
	tipeKaryawan := c.Query("tipe_karyawan")
	statusKepegawaian := c.Query("status_kepegawaian")
	isActive := c.Query("is_active")

	query := database.DB.Model(&models.Employee{})

	// Apply filters
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("nama_lengkap ILIKE ? OR nik ILIKE ? OR nip ILIKE ? OR email ILIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern)
	}

	if tipeKaryawan != "" {
		query = query.Where("tipe_karyawan = ?", tipeKaryawan)
	}

	if statusKepegawaian != "" {
		query = query.Where("status_kepegawaian = ?", statusKepegawaian)
	}

	if isActive != "" {
		active, _ := strconv.ParseBool(isActive)
		query = query.Where("is_active = ?", active)
	}

	if err := query.Preload("User").Order("nama_lengkap ASC").Find(&employees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": employees})
}

// GetEmployee returns a single employee by ID
func GetEmployee(c *gin.Context) {
	id := c.Param("id")

	var employee models.Employee
	if err := database.DB.First(&employee, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pegawai tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": employee})
}

// CreateEmployeeRequest represents the request body for creating an employee
type CreateEmployeeRequest struct {
	// Personal Information
	NIK              string `json:"nik" binding:"required,len=16"`
	NIP              string `json:"nip"`
	NamaLengkap      string `json:"nama_lengkap" binding:"required"`
	TempatLahir      string `json:"tempat_lahir"`
	TanggalLahir     string `json:"tanggal_lahir"`
	JenisKelamin     string `json:"jenis_kelamin" binding:"required,oneof=L P"`
	Agama            string `json:"agama"`
	StatusPerkawinan string `json:"status_perkawinan"`
	Alamat           string `json:"alamat"`
	Kota             string `json:"kota"`
	Provinsi         string `json:"provinsi"`
	KodePos          string `json:"kode_pos"`
	NoTelepon        string `json:"no_telepon"`
	NoHP             string `json:"no_hp"`
	Email            string `json:"email"`
	Foto             string `json:"foto"`

	// Employment Information
	TipeKaryawan      string `json:"tipe_karyawan" binding:"required"`
	StatusKepegawaian string `json:"status_kepegawaian" binding:"required"`
	TanggalMasuk      string `json:"tanggal_masuk"`
	TanggalKeluar     string `json:"tanggal_keluar"`
	Departemen        string `json:"departemen"`
	Jabatan           string `json:"jabatan"`

	// Medical Staff Information
	NoSTR          string `json:"no_str"`
	TanggalSTR     string `json:"tanggal_str"`
	MasaBerlakuSTR string `json:"masa_berlaku_str"`
	NoSIP          string `json:"no_sip"`
	TanggalSIP     string `json:"tanggal_sip"`
	MasaBerlakuSIP string `json:"masa_berlaku_sip"`
	Spesialisasi   string `json:"spesialisasi"`

	// Education
	PendidikanTerakhir string `json:"pendidikan_terakhir"`
	NamaInstitusi      string `json:"nama_institusi"`
	TahunLulus         int    `json:"tahun_lulus"`

	// Bank Information
	NamaBank         string `json:"nama_bank"`
	NoRekening       string `json:"no_rekening"`
	AtasNamaRekening string `json:"atas_nama_rekening"`

	// Emergency Contact
	NamaKontakDarurat     string `json:"nama_kontak_darurat"`
	HubunganKontakDarurat string `json:"hubungan_kontak_darurat"`
	TeleponKontakDarurat  string `json:"telepon_kontak_darurat"`
}

// parseDate parses a date string to time.Time pointer
func parseDate(dateStr string) *time.Time {
	if dateStr == "" {
		return nil
	}
	// Try multiple date formats
	formats := []string{"2006-01-02", "02-01-2006", "2006/01/02"}
	for _, format := range formats {
		t, err := time.Parse(format, dateStr)
		if err == nil {
			return &t
		}
	}
	return nil
}

// CreateEmployee creates a new employee
func CreateEmployee(c *gin.Context) {
	var req CreateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if NIK already exists
	var existingEmployee models.Employee
	if err := database.DB.Where("nik = ?", req.NIK).First(&existingEmployee).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIK sudah terdaftar"})
		return
	}

	// Check if NIP already exists (if provided)
	if req.NIP != "" {
		if err := database.DB.Where("nip = ?", req.NIP).First(&existingEmployee).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "NIP sudah terdaftar"})
			return
		}
	}

	employee := models.Employee{
		NIK:                   req.NIK,
		NIP:                   req.NIP,
		NamaLengkap:           req.NamaLengkap,
		TempatLahir:           req.TempatLahir,
		TanggalLahir:          parseDate(req.TanggalLahir),
		JenisKelamin:          models.Gender(req.JenisKelamin),
		Agama:                 req.Agama,
		StatusPerkawinan:      req.StatusPerkawinan,
		Alamat:                req.Alamat,
		Kota:                  req.Kota,
		Provinsi:              req.Provinsi,
		KodePos:               req.KodePos,
		NoTelepon:             req.NoTelepon,
		NoHP:                  req.NoHP,
		Email:                 req.Email,
		Foto:                  req.Foto,
		TipeKaryawan:          models.EmployeeType(req.TipeKaryawan),
		StatusKepegawaian:     models.EmploymentStatus(req.StatusKepegawaian),
		TanggalMasuk:          parseDate(req.TanggalMasuk),
		TanggalKeluar:         parseDate(req.TanggalKeluar),
		Departemen:            req.Departemen,
		Jabatan:               req.Jabatan,
		NoSTR:                 req.NoSTR,
		TanggalSTR:            parseDate(req.TanggalSTR),
		MasaBerlakuSTR:        parseDate(req.MasaBerlakuSTR),
		NoSIP:                 req.NoSIP,
		TanggalSIP:            parseDate(req.TanggalSIP),
		MasaBerlakuSIP:        parseDate(req.MasaBerlakuSIP),
		Spesialisasi:          req.Spesialisasi,
		PendidikanTerakhir:    req.PendidikanTerakhir,
		NamaInstitusi:         req.NamaInstitusi,
		TahunLulus:            req.TahunLulus,
		NamaBank:              req.NamaBank,
		NoRekening:            req.NoRekening,
		AtasNamaRekening:      req.AtasNamaRekening,
		NamaKontakDarurat:     req.NamaKontakDarurat,
		HubunganKontakDarurat: req.HubunganKontakDarurat,
		TeleponKontakDarurat:  req.TeleponKontakDarurat,
		IsActive:              true,
	}

	if err := database.DB.Create(&employee).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": employee})
}

// UpdateEmployeeRequest represents the request body for updating an employee
type UpdateEmployeeRequest struct {
	// Personal Information
	NIK              string `json:"nik"`
	NIP              string `json:"nip"`
	NamaLengkap      string `json:"nama_lengkap"`
	TempatLahir      string `json:"tempat_lahir"`
	TanggalLahir     string `json:"tanggal_lahir"`
	JenisKelamin     string `json:"jenis_kelamin"`
	Agama            string `json:"agama"`
	StatusPerkawinan string `json:"status_perkawinan"`
	Alamat           string `json:"alamat"`
	Kota             string `json:"kota"`
	Provinsi         string `json:"provinsi"`
	KodePos          string `json:"kode_pos"`
	NoTelepon        string `json:"no_telepon"`
	NoHP             string `json:"no_hp"`
	Email            string `json:"email"`
	Foto             string `json:"foto"`

	// Employment Information
	TipeKaryawan      string `json:"tipe_karyawan"`
	StatusKepegawaian string `json:"status_kepegawaian"`
	TanggalMasuk      string `json:"tanggal_masuk"`
	TanggalKeluar     string `json:"tanggal_keluar"`
	Departemen        string `json:"departemen"`
	Jabatan           string `json:"jabatan"`

	// Medical Staff Information
	NoSTR          string `json:"no_str"`
	TanggalSTR     string `json:"tanggal_str"`
	MasaBerlakuSTR string `json:"masa_berlaku_str"`
	NoSIP          string `json:"no_sip"`
	TanggalSIP     string `json:"tanggal_sip"`
	MasaBerlakuSIP string `json:"masa_berlaku_sip"`
	Spesialisasi   string `json:"spesialisasi"`

	// Education
	PendidikanTerakhir string `json:"pendidikan_terakhir"`
	NamaInstitusi      string `json:"nama_institusi"`
	TahunLulus         int    `json:"tahun_lulus"`

	// Bank Information
	NamaBank         string `json:"nama_bank"`
	NoRekening       string `json:"no_rekening"`
	AtasNamaRekening string `json:"atas_nama_rekening"`

	// Emergency Contact
	NamaKontakDarurat     string `json:"nama_kontak_darurat"`
	HubunganKontakDarurat string `json:"hubungan_kontak_darurat"`
	TeleponKontakDarurat  string `json:"telepon_kontak_darurat"`

	// Status
	IsActive *bool `json:"is_active"`
}

// UpdateEmployee updates an existing employee
func UpdateEmployee(c *gin.Context) {
	id := c.Param("id")

	var employee models.Employee
	if err := database.DB.First(&employee, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pegawai tidak ditemukan"})
		return
	}

	var req UpdateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if NIK is being changed and if it already exists
	if req.NIK != "" && req.NIK != employee.NIK {
		var existingEmployee models.Employee
		if err := database.DB.Where("nik = ? AND id != ?", req.NIK, id).First(&existingEmployee).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "NIK sudah terdaftar"})
			return
		}
		employee.NIK = req.NIK
	}

	// Check if NIP is being changed and if it already exists
	if req.NIP != "" && req.NIP != employee.NIP {
		var existingEmployee models.Employee
		if err := database.DB.Where("nip = ? AND id != ?", req.NIP, id).First(&existingEmployee).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "NIP sudah terdaftar"})
			return
		}
		employee.NIP = req.NIP
	}

	// Update fields
	if req.NamaLengkap != "" {
		employee.NamaLengkap = req.NamaLengkap
	}
	if req.TempatLahir != "" {
		employee.TempatLahir = req.TempatLahir
	}
	if req.TanggalLahir != "" {
		employee.TanggalLahir = parseDate(req.TanggalLahir)
	}
	if req.JenisKelamin != "" {
		employee.JenisKelamin = models.Gender(req.JenisKelamin)
	}
	if req.Agama != "" {
		employee.Agama = req.Agama
	}
	if req.StatusPerkawinan != "" {
		employee.StatusPerkawinan = req.StatusPerkawinan
	}
	if req.Alamat != "" {
		employee.Alamat = req.Alamat
	}
	if req.Kota != "" {
		employee.Kota = req.Kota
	}
	if req.Provinsi != "" {
		employee.Provinsi = req.Provinsi
	}
	if req.KodePos != "" {
		employee.KodePos = req.KodePos
	}
	if req.NoTelepon != "" {
		employee.NoTelepon = req.NoTelepon
	}
	if req.NoHP != "" {
		employee.NoHP = req.NoHP
	}
	if req.Email != "" {
		employee.Email = req.Email
	}
	if req.Foto != "" {
		employee.Foto = req.Foto
	}
	if req.TipeKaryawan != "" {
		employee.TipeKaryawan = models.EmployeeType(req.TipeKaryawan)
	}
	if req.StatusKepegawaian != "" {
		employee.StatusKepegawaian = models.EmploymentStatus(req.StatusKepegawaian)
	}
	if req.TanggalMasuk != "" {
		employee.TanggalMasuk = parseDate(req.TanggalMasuk)
	}
	if req.TanggalKeluar != "" {
		employee.TanggalKeluar = parseDate(req.TanggalKeluar)
	}
	if req.Departemen != "" {
		employee.Departemen = req.Departemen
	}
	if req.Jabatan != "" {
		employee.Jabatan = req.Jabatan
	}
	if req.NoSTR != "" {
		employee.NoSTR = req.NoSTR
	}
	if req.TanggalSTR != "" {
		employee.TanggalSTR = parseDate(req.TanggalSTR)
	}
	if req.MasaBerlakuSTR != "" {
		employee.MasaBerlakuSTR = parseDate(req.MasaBerlakuSTR)
	}
	if req.NoSIP != "" {
		employee.NoSIP = req.NoSIP
	}
	if req.TanggalSIP != "" {
		employee.TanggalSIP = parseDate(req.TanggalSIP)
	}
	if req.MasaBerlakuSIP != "" {
		employee.MasaBerlakuSIP = parseDate(req.MasaBerlakuSIP)
	}
	if req.Spesialisasi != "" {
		employee.Spesialisasi = req.Spesialisasi
	}
	if req.PendidikanTerakhir != "" {
		employee.PendidikanTerakhir = req.PendidikanTerakhir
	}
	if req.NamaInstitusi != "" {
		employee.NamaInstitusi = req.NamaInstitusi
	}
	if req.TahunLulus > 0 {
		employee.TahunLulus = req.TahunLulus
	}
	if req.NamaBank != "" {
		employee.NamaBank = req.NamaBank
	}
	if req.NoRekening != "" {
		employee.NoRekening = req.NoRekening
	}
	if req.AtasNamaRekening != "" {
		employee.AtasNamaRekening = req.AtasNamaRekening
	}
	if req.NamaKontakDarurat != "" {
		employee.NamaKontakDarurat = req.NamaKontakDarurat
	}
	if req.HubunganKontakDarurat != "" {
		employee.HubunganKontakDarurat = req.HubunganKontakDarurat
	}
	if req.TeleponKontakDarurat != "" {
		employee.TeleponKontakDarurat = req.TeleponKontakDarurat
	}
	if req.IsActive != nil {
		employee.IsActive = *req.IsActive
	}

	if err := database.DB.Save(&employee).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": employee})
}

// DeleteEmployee deletes an employee
func DeleteEmployee(c *gin.Context) {
	id := c.Param("id")

	// Check if employee has associated users
	var userCount int64
	database.DB.Model(&models.User{}).Where("employee_id = ?", id).Count(&userCount)
	if userCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus pegawai yang memiliki akun user terkait"})
		return
	}

	if err := database.DB.Delete(&models.Employee{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pegawai berhasil dihapus"})
}

// GetEmployeeTypes returns all available employee types
func GetEmployeeTypes(c *gin.Context) {
	types := []string{
		string(models.EmployeeTypeDokter),
		string(models.EmployeeTypePerawat),
		string(models.EmployeeTypeBidan),
		string(models.EmployeeTypeApoteker),
		string(models.EmployeeTypeAsistenApoteker),
		string(models.EmployeeTypeRadiografer),
		string(models.EmployeeTypeAnalis),
		string(models.EmployeeTypeNutrisionis),
		string(models.EmployeeTypeAdministrasi),
		string(models.EmployeeTypeKeuangan),
		string(models.EmployeeTypeIT),
		string(models.EmployeeTypeKeamanan),
		string(models.EmployeeTypeKebersihan),
		string(models.EmployeeTypeLainnya),
	}
	c.JSON(http.StatusOK, gin.H{"data": types})
}

// GetEmploymentStatuses returns all available employment statuses
func GetEmploymentStatuses(c *gin.Context) {
	statuses := []string{
		string(models.EmploymentStatusPNS),
		string(models.EmploymentStatusPPPK),
		string(models.EmploymentStatusKontrak),
		string(models.EmploymentStatusHonorer),
		string(models.EmploymentStatusMagang),
	}
	c.JSON(http.StatusOK, gin.H{"data": statuses})
}

// GetEmployeesWithoutUser returns employees that don't have user accounts
func GetEmployeesWithoutUser(c *gin.Context) {
	var employees []models.Employee

	subQuery := database.DB.Model(&models.User{}).Select("employee_id").Where("employee_id IS NOT NULL")

	if err := database.DB.Where("id NOT IN (?) AND is_active = ?", subQuery, true).
		Order("nama_lengkap ASC").
		Find(&employees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": employees})
}
