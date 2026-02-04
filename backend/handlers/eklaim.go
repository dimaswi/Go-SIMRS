package handlers

import (
	"encoding/json"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== EKLAIM CRUD ====================

// GetEKlaims returns list of E-Klaim records with filtering
// GET /api/eklaim
func GetEKlaims(c *gin.Context) {
	var eklaims []models.EKlaim

	query := database.DB.Preload("Visit").Preload("Visit.Patient")

	// Filter by state
	if state := c.Query("state"); state != "" {
		query = query.Where("state = ?", state)
	}

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("created_at <= ?", endDate+" 23:59:59")
	}

	// Filter by no_sep
	if noSEP := c.Query("no_sep"); noSEP != "" {
		query = query.Where("no_sep LIKE ?", "%"+noSEP+"%")
	}

	// Filter by verification status
	if verificationStatus := c.Query("verification_status"); verificationStatus != "" {
		query = query.Where("verification_status = ?", verificationStatus)
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.EKlaim{}).Count(&total)

	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&eklaims).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data E-Klaim"})
		return
	}

	// Add button visibility untuk setiap record
	type EKlaimWithButtons struct {
		models.EKlaim
		Buttons map[string]bool `json:"buttons"`
	}

	result := make([]EKlaimWithButtons, len(eklaims))
	for i, ek := range eklaims {
		result[i] = EKlaimWithButtons{
			EKlaim:  ek,
			Buttons: ek.GetButtonVisibility(),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  result,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetEKlaim returns single E-Klaim with full details
// GET /api/eklaim/:id
func GetEKlaim(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Patient").
		Preload("Diagnoses", func(db *gorm.DB) *gorm.DB {
			return db.Order("sequence ASC")
		}).
		Preload("Procedures", func(db *gorm.DB) *gorm.DB {
			return db.Order("sequence ASC")
		}).
		Preload("Logs", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC").Limit(50)
		}).
		First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
	})
}

// CreateEKlaim creates new E-Klaim from visit
// POST /api/eklaim
func CreateEKlaim(c *gin.Context) {
	var input struct {
		VisitID       uint    `json:"visit_id" binding:"required"`
		NoSEP         string  `json:"no_sep" binding:"required"`
		NoKartu       string  `json:"no_kartu"`
		TglMasuk      string  `json:"tgl_masuk"`
		TglPulang     string  `json:"tgl_pulang"`
		JenisRawat    string  `json:"jenis_rawat"`
		CaraMasuk     string  `json:"cara_masuk"`
		JenisKeluar   string  `json:"jenis_keluar"`
		TglLahir      string  `json:"tgl_lahir"`
		JenisKelamin  string  `json:"jenis_kelamin"`
		BeratBadan    float64 `json:"berat_badan"`
		TarifRS       float64 `json:"tarif_rs"`
		TarifProsedur float64 `json:"tarif_prosedur"`
		TarifAlkes    float64 `json:"tarif_alkes"`
		TarifObat     float64 `json:"tarif_obat"`
		TarifKamar    float64 `json:"tarif_kamar"`
		TarifLainnya  float64 `json:"tarif_lainnya"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if visit exists
	var visit models.Visit
	if err := database.DB.First(&visit, input.VisitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Check if E-Klaim already exists for this visit
	var existing models.EKlaim
	if err := database.DB.Where("visit_id = ?", input.VisitID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":     "E-Klaim sudah ada untuk visit ini",
			"eklaim_id": existing.ID,
		})
		return
	}

	// Parse dates
	var tglMasuk, tglPulang, tglLahir *time.Time
	if input.TglMasuk != "" {
		t, _ := time.Parse("2006-01-02", input.TglMasuk)
		tglMasuk = &t
	}
	if input.TglPulang != "" {
		t, _ := time.Parse("2006-01-02", input.TglPulang)
		tglPulang = &t
	}
	if input.TglLahir != "" {
		t, _ := time.Parse("2006-01-02", input.TglLahir)
		tglLahir = &t
	}

	eklaim := models.EKlaim{
		VisitID:       input.VisitID,
		State:         models.ClaimStateDraft,
		NoSEP:         input.NoSEP,
		NoKartu:       input.NoKartu,
		TglMasuk:      tglMasuk,
		TglPulang:     tglPulang,
		JenisRawat:    models.JenisRawat(input.JenisRawat),
		CaraMasuk:     models.AdmissionType(input.CaraMasuk),
		JenisKeluar:   models.DischargeType(input.JenisKeluar),
		TglLahir:      tglLahir,
		JenisKelamin:  input.JenisKelamin,
		BeratBadan:    input.BeratBadan,
		TarifRS:       input.TarifRS,
		TarifProsedur: input.TarifProsedur,
		TarifAlkes:    input.TarifAlkes,
		TarifObat:     input.TarifObat,
		TarifKamar:    input.TarifKamar,
		TarifLainnya:  input.TarifLainnya,
		TotalTarifRS:  input.TarifRS + input.TarifProsedur + input.TarifAlkes + input.TarifObat + input.TarifKamar + input.TarifLainnya,
	}

	if err := database.DB.Create(&eklaim).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat E-Klaim"})
		return
	}

	// Log creation
	userID := getUserIDFromContext(c)
	logEKlaimAction(eklaim.ID, userID, "CREATE", "", string(eklaim.State), "E-Klaim dibuat", c.ClientIP())

	c.JSON(http.StatusCreated, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "E-Klaim berhasil dibuat",
	})
}

// UpdateEKlaim updates E-Klaim data (only if form is not disabled)
// PUT /api/eklaim/:id
func UpdateEKlaim(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	// Check if form is disabled
	if eklaim.IsFormDisabled() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Form tidak dapat diedit pada status " + string(eklaim.State),
		})
		return
	}

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Remove protected fields
	delete(input, "id")
	delete(input, "state")
	delete(input, "idrg_valid")
	delete(input, "inacbg_valid")
	delete(input, "visit_id")

	if err := database.DB.Model(&eklaim).Updates(input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate E-Klaim"})
		return
	}

	// Reload
	database.DB.First(&eklaim, id)

	// Recalculate total
	eklaim.TotalTarifRS = eklaim.TarifRS + eklaim.TarifProsedur + eklaim.TarifAlkes + eklaim.TarifObat + eklaim.TarifKamar + eklaim.TarifLainnya
	database.DB.Save(&eklaim)

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "E-Klaim berhasil diupdate",
	})
}

// ==================== DIAGNOSIS CRUD ====================

// AddDiagnosis adds diagnosis to E-Klaim
// POST /api/eklaim/:id/diagnosis
func AddEKlaimDiagnosis(c *gin.Context) {
	eklaimID, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	// Check state - only editable in DRAFT or IDRG_GROUPED for iDRG diagnoses
	source := c.DefaultQuery("source", "idrg")
	if source == "idrg" && eklaim.IsFormDisabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Diagnosis iDRG tidak dapat ditambah pada status ini"})
		return
	}
	if source == "inacbg" && !eklaim.IsINACBGSectionVisible() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Section INACBG belum tersedia"})
		return
	}

	var input struct {
		Code      string `json:"code" binding:"required"`
		Name      string `json:"name"`
		IsPrimary bool   `json:"is_primary"`
		IsIMCode  bool   `json:"is_im_code"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get next sequence
	var maxSeq struct{ MaxSeq int }
	database.DB.Model(&models.EKlaimDiagnosis{}).
		Where("eklaim_id = ? AND source = ?", eklaimID, source).
		Select("COALESCE(MAX(sequence), 0) as max_seq").
		Scan(&maxSeq)

	diagnosis := models.EKlaimDiagnosis{
		EKlaimID:  uint(eklaimID),
		Code:      input.Code,
		Name:      input.Name,
		IsPrimary: input.IsPrimary,
		Source:    source,
		IsIMCode:  input.IsIMCode,
		Sequence:  maxSeq.MaxSeq + 1,
	}

	// If primary, unset other primaries
	if input.IsPrimary {
		database.DB.Model(&models.EKlaimDiagnosis{}).
			Where("eklaim_id = ? AND source = ? AND is_primary = ?", eklaimID, source, true).
			Update("is_primary", false)
	}

	if err := database.DB.Create(&diagnosis).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menambah diagnosis"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    diagnosis,
		"message": "Diagnosis berhasil ditambahkan",
	})
}

// RemoveDiagnosis removes diagnosis from E-Klaim
// DELETE /api/eklaim/:id/diagnosis/:diagnosisId
func RemoveEKlaimDiagnosis(c *gin.Context) {
	eklaimID := c.Param("id")
	diagnosisID := c.Param("diagnosisId")

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	var diagnosis models.EKlaimDiagnosis
	if err := database.DB.Where("id = ? AND eklaim_id = ?", diagnosisID, eklaimID).First(&diagnosis).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Diagnosis tidak ditemukan"})
		return
	}

	// Check state
	if diagnosis.Source == "idrg" && eklaim.IsFormDisabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Diagnosis iDRG tidak dapat dihapus pada status ini"})
		return
	}

	if err := database.DB.Delete(&diagnosis).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus diagnosis"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Diagnosis berhasil dihapus"})
}

// ==================== PROCEDURE CRUD ====================

// AddProcedure adds procedure to E-Klaim
// POST /api/eklaim/:id/procedure
func AddEKlaimProcedure(c *gin.Context) {
	eklaimID, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	source := c.DefaultQuery("source", "idrg")
	if source == "idrg" && eklaim.IsFormDisabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Procedure iDRG tidak dapat ditambah pada status ini"})
		return
	}
	if source == "inacbg" && !eklaim.IsINACBGSectionVisible() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Section INACBG belum tersedia"})
		return
	}

	var input struct {
		Code         string `json:"code" binding:"required"`
		Name         string `json:"name"`
		Multiplicity int    `json:"multiplicity"`
		Setting      string `json:"setting"`
		IsIMCode     bool   `json:"is_im_code"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Multiplicity < 1 {
		input.Multiplicity = 1
	}
	if input.Setting == "" {
		input.Setting = "NON_OR"
	}

	// Get next sequence
	var maxSeq struct{ MaxSeq int }
	database.DB.Model(&models.EKlaimProcedure{}).
		Where("eklaim_id = ? AND source = ?", eklaimID, source).
		Select("COALESCE(MAX(sequence), 0) as max_seq").
		Scan(&maxSeq)

	procedure := models.EKlaimProcedure{
		EKlaimID:     uint(eklaimID),
		Code:         input.Code,
		Name:         input.Name,
		Multiplicity: input.Multiplicity,
		Setting:      models.ProcedureSetting(input.Setting),
		Source:       source,
		IsIMCode:     input.IsIMCode,
		Sequence:     maxSeq.MaxSeq + 1,
	}

	if err := database.DB.Create(&procedure).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menambah procedure"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    procedure,
		"message": "Procedure berhasil ditambahkan",
	})
}

// RemoveProcedure removes procedure from E-Klaim
// DELETE /api/eklaim/:id/procedure/:procedureId
func RemoveEKlaimProcedure(c *gin.Context) {
	eklaimID := c.Param("id")
	procedureID := c.Param("procedureId")

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	var procedure models.EKlaimProcedure
	if err := database.DB.Where("id = ? AND eklaim_id = ?", procedureID, eklaimID).First(&procedure).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure tidak ditemukan"})
		return
	}

	if procedure.Source == "idrg" && eklaim.IsFormDisabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Procedure iDRG tidak dapat dihapus pada status ini"})
		return
	}

	if err := database.DB.Delete(&procedure).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus procedure"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Procedure berhasil dihapus"})
}

// ==================== GROUPING & FINALIZATION ====================

// GroupingIDRG performs iDRG grouping
// POST /api/eklaim/:id/grouping-idrg
func GroupingIDRG(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.
		Preload("Diagnoses", "source = ?", "idrg").
		Preload("Procedures", "source = ?", "idrg").
		First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	if !eklaim.CanGroupIDRG() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Grouping iDRG tidak dapat dilakukan pada status " + string(eklaim.State),
		})
		return
	}

	// Validate required data
	if len(eklaim.Diagnoses) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal 1 diagnosis diperlukan"})
		return
	}

	// Build request for iDRG API
	// TODO: Implement actual API call to iDRG grouper
	// For now, simulate response

	userID := getUserIDFromContext(c)
	now := time.Now()

	// Simulate grouping result
	// In real implementation, call the iDRG API here
	groupingSuccess := true // Simulate success
	idrgCode := "A-4-01-I"
	idrgDesc := "Simple Appendectomy"
	idrgTarif := 5500000.0

	if groupingSuccess {
		eklaim.State = models.ClaimStateIDRGGrouped
		eklaim.IDRGValid = true
		eklaim.IDRGCode = idrgCode
		eklaim.IDRGDescription = idrgDesc
		eklaim.IDRGTarif = idrgTarif
		eklaim.IDRGGroupedAt = &now
		eklaim.LastGroupingAt = &now
		eklaim.LastError = ""
		eklaim.LastErrorAt = nil
	} else {
		eklaim.State = models.ClaimStateIDRGGrouped
		eklaim.IDRGValid = false
		eklaim.LastError = "Ungroupable: [error message from API]"
		eklaim.LastErrorAt = &now
		eklaim.LastGroupingAt = &now
	}

	database.DB.Save(&eklaim)

	// Log action
	logEKlaimAction(eklaim.ID, userID, "GROUPING_IDRG", string(models.ClaimStateDraft), string(eklaim.State),
		"Grouping iDRG: "+idrgCode, c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "Grouping iDRG berhasil",
	})
}

// FinalIDRG finalizes iDRG grouping
// POST /api/eklaim/:id/final-idrg
func FinalIDRG(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	if !eklaim.CanFinalIDRG() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Final iDRG tidak dapat dilakukan. Status: " + string(eklaim.State) + ", Valid: " + strconv.FormatBool(eklaim.IDRGValid),
		})
		return
	}

	userID := getUserIDFromContext(c)
	now := time.Now()

	oldState := eklaim.State
	eklaim.State = models.ClaimStateIDRGFinal
	eklaim.IDRGFinalizedAt = &now
	eklaim.IDRGFinalizedBy = userID

	database.DB.Save(&eklaim)

	logEKlaimAction(eklaim.ID, userID, "FINAL_IDRG", string(oldState), string(eklaim.State),
		"iDRG finalized: "+eklaim.IDRGCode, c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "iDRG berhasil di-finalisasi",
	})
}

// EditIDRG reverts iDRG finalization (unfinal)
// POST /api/eklaim/:id/edit-idrg
func EditIDRG(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	if !eklaim.CanEditIDRG() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Edit iDRG tidak dapat dilakukan pada status " + string(eklaim.State),
		})
		return
	}

	userID := getUserIDFromContext(c)
	oldState := eklaim.State

	// Reset to IDRG_GROUPED state
	eklaim.State = models.ClaimStateIDRGGrouped
	eklaim.IDRGFinalizedAt = nil
	eklaim.IDRGFinalizedBy = nil

	// Also reset INACBG data if any
	eklaim.INACBGCode = ""
	eklaim.INACBGDescription = ""
	eklaim.INACBGTarif = 0
	eklaim.INACBGGroupedAt = nil
	eklaim.INACBGFinalizedAt = nil
	eklaim.INACBGFinalizedBy = nil
	eklaim.INACBGValid = false

	// Delete INACBG diagnoses and procedures
	database.DB.Where("eklaim_id = ? AND source = ?", eklaim.ID, "inacbg").Delete(&models.EKlaimDiagnosis{})
	database.DB.Where("eklaim_id = ? AND source = ?", eklaim.ID, "inacbg").Delete(&models.EKlaimProcedure{})

	database.DB.Save(&eklaim)

	logEKlaimAction(eklaim.ID, userID, "EDIT_IDRG", string(oldState), string(eklaim.State),
		"iDRG di-unfinal untuk edit ulang", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "iDRG berhasil di-edit ulang",
	})
}

// ImportToINACBG imports iDRG coding to INACBG
// POST /api/eklaim/:id/import-inacbg
func ImportToINACBG(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.
		Preload("Diagnoses", "source = ?", "idrg").
		Preload("Procedures", "source = ?", "idrg").
		First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	if !eklaim.IsINACBGSectionVisible() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Section INACBG belum tersedia"})
		return
	}

	// Delete existing INACBG diagnoses and procedures
	database.DB.Where("eklaim_id = ? AND source = ?", eklaim.ID, "inacbg").Delete(&models.EKlaimDiagnosis{})
	database.DB.Where("eklaim_id = ? AND source = ?", eklaim.ID, "inacbg").Delete(&models.EKlaimProcedure{})

	var warnings []map[string]string

	// Copy diagnoses from iDRG to INACBG
	for _, diag := range eklaim.Diagnoses {
		newDiag := models.EKlaimDiagnosis{
			EKlaimID:  eklaim.ID,
			Code:      diag.Code,
			Name:      diag.Name,
			IsPrimary: diag.IsPrimary,
			Source:    "inacbg",
			IsIMCode:  diag.IsIMCode,
			Sequence:  diag.Sequence,
		}

		// Check if IM code - add warning
		if diag.IsIMCode {
			newDiag.HasWarning = true
			newDiag.WarningMessage = "Kode " + diag.Code + " adalah kode IM, mungkin tidak valid di INACBG standar"
			warnings = append(warnings, map[string]string{
				"type":    "diagnosis",
				"code":    diag.Code,
				"message": newDiag.WarningMessage,
			})
		}

		database.DB.Create(&newDiag)
	}

	// Copy procedures from iDRG to INACBG
	for _, proc := range eklaim.Procedures {
		newProc := models.EKlaimProcedure{
			EKlaimID:     eklaim.ID,
			Code:         proc.Code,
			Name:         proc.Name,
			Multiplicity: proc.Multiplicity,
			Setting:      proc.Setting,
			Source:       "inacbg",
			IsIMCode:     proc.IsIMCode,
			Sequence:     proc.Sequence,
		}

		if proc.IsIMCode {
			newProc.HasWarning = true
			newProc.WarningMessage = "Kode " + proc.Code + " adalah kode IM, mungkin tidak valid di INACBG standar"
			warnings = append(warnings, map[string]string{
				"type":    "procedure",
				"code":    proc.Code,
				"message": newProc.WarningMessage,
			})
		}

		database.DB.Create(&newProc)
	}

	userID := getUserIDFromContext(c)
	logEKlaimAction(eklaim.ID, userID, "IMPORT_INACBG", string(eklaim.State), string(eklaim.State),
		"Import coding dari iDRG ke INACBG", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"message":  "Coding berhasil di-import ke INACBG",
		"warnings": warnings,
	})
}

// GroupingINACBG performs INACBG grouping
// POST /api/eklaim/:id/grouping-inacbg
func GroupingINACBG(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.
		Preload("Diagnoses", "source = ?", "inacbg").
		Preload("Procedures", "source = ?", "inacbg").
		First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	if !eklaim.CanGroupINACBG() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Grouping INACBG tidak dapat dilakukan pada status " + string(eklaim.State),
		})
		return
	}

	if len(eklaim.Diagnoses) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal 1 diagnosis INACBG diperlukan"})
		return
	}

	userID := getUserIDFromContext(c)
	now := time.Now()

	// TODO: Call actual INACBG grouper API
	// Simulate response
	groupingSuccess := true
	inacbgCode := "A-4-01-III"
	inacbgDesc := "Appendectomy - INACBG"
	inacbgTarif := 5000000.0

	if groupingSuccess {
		eklaim.State = models.ClaimStateINACBGGrouped
		eklaim.INACBGValid = true
		eklaim.INACBGCode = inacbgCode
		eklaim.INACBGDescription = inacbgDesc
		eklaim.INACBGTarif = inacbgTarif
		eklaim.INACBGGroupedAt = &now
		eklaim.LastGroupingAt = &now
		eklaim.LastError = ""
		eklaim.LastErrorAt = nil
	} else {
		eklaim.State = models.ClaimStateINACBGGrouped
		eklaim.INACBGValid = false
		eklaim.LastError = "Ungroupable INACBG"
		eklaim.LastErrorAt = &now
	}

	database.DB.Save(&eklaim)

	logEKlaimAction(eklaim.ID, userID, "GROUPING_INACBG", string(models.ClaimStateIDRGFinal), string(eklaim.State),
		"Grouping INACBG: "+inacbgCode, c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "Grouping INACBG berhasil",
	})
}

// FinalINACBG finalizes INACBG grouping
// POST /api/eklaim/:id/final-inacbg
func FinalINACBG(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	if !eklaim.CanFinalINACBG() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Final INACBG tidak dapat dilakukan",
		})
		return
	}

	userID := getUserIDFromContext(c)
	now := time.Now()
	oldState := eklaim.State

	eklaim.State = models.ClaimStateINACBGFinal
	eklaim.INACBGFinalizedAt = &now
	eklaim.INACBGFinalizedBy = userID

	database.DB.Save(&eklaim)

	logEKlaimAction(eklaim.ID, userID, "FINAL_INACBG", string(oldState), string(eklaim.State),
		"INACBG finalized: "+eklaim.INACBGCode, c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "INACBG berhasil di-finalisasi",
	})
}

// EditINACBG reverts INACBG finalization
// POST /api/eklaim/:id/edit-inacbg
func EditINACBG(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	if !eklaim.CanEditINACBG() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Edit INACBG tidak dapat dilakukan pada status " + string(eklaim.State),
		})
		return
	}

	userID := getUserIDFromContext(c)
	oldState := eklaim.State

	eklaim.State = models.ClaimStateINACBGGrouped
	eklaim.INACBGFinalizedAt = nil
	eklaim.INACBGFinalizedBy = nil

	database.DB.Save(&eklaim)

	logEKlaimAction(eklaim.ID, userID, "EDIT_INACBG", string(oldState), string(eklaim.State),
		"INACBG di-unfinal untuk edit ulang", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "INACBG berhasil di-edit ulang",
	})
}

// FinalClaim finalizes the claim
// POST /api/eklaim/:id/final-claim
func FinalClaim(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	if !eklaim.CanFinalClaim() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Final Klaim tidak dapat dilakukan pada status " + string(eklaim.State),
		})
		return
	}

	userID := getUserIDFromContext(c)
	now := time.Now()
	oldState := eklaim.State

	eklaim.State = models.ClaimStateClaimFinal
	eklaim.ClaimFinalizedAt = &now
	eklaim.ClaimFinalizedBy = userID

	database.DB.Save(&eklaim)

	logEKlaimAction(eklaim.ID, userID, "FINAL_CLAIM", string(oldState), string(eklaim.State),
		"Klaim di-finalisasi", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "Klaim berhasil di-finalisasi",
	})
}

// SendClaim sends the claim to BPJS
// POST /api/eklaim/:id/send-claim
func SendClaim(c *gin.Context) {
	id := c.Param("id")

	var eklaim models.EKlaim
	if err := database.DB.First(&eklaim, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "E-Klaim tidak ditemukan"})
		return
	}

	if !eklaim.CanSendClaim() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Kirim Klaim tidak dapat dilakukan pada status " + string(eklaim.State),
		})
		return
	}

	// TODO: Call E-Klaim send API

	userID := getUserIDFromContext(c)
	now := time.Now()
	oldState := eklaim.State

	eklaim.State = models.ClaimStateSent
	eklaim.ClaimSentAt = &now
	eklaim.ClaimSentBy = userID

	database.DB.Save(&eklaim)

	logEKlaimAction(eklaim.ID, userID, "SEND_CLAIM", string(oldState), string(eklaim.State),
		"Klaim dikirim ke BPJS", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"data":    eklaim,
		"buttons": eklaim.GetButtonVisibility(),
		"message": "Klaim berhasil dikirim",
	})
}

// GetEKlaimLogs returns activity logs for E-Klaim
// GET /api/eklaim/:id/logs
func GetEKlaimLogs(c *gin.Context) {
	id := c.Param("id")

	var logs []models.EKlaimLog
	if err := database.DB.
		Where("eklaim_id = ?", id).
		Preload("User").
		Order("created_at DESC").
		Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// ==================== HELPER FUNCTIONS ====================

func getUserIDFromContext(c *gin.Context) *uint {
	if userID, exists := c.Get("user_id"); exists {
		if id, ok := userID.(uint); ok {
			return &id
		}
	}
	return nil
}

func logEKlaimAction(eklaimID uint, userID *uint, action, fromState, toState, description, ipAddress string) {
	log := models.EKlaimLog{
		EKlaimID:    eklaimID,
		UserID:      userID,
		Action:      action,
		FromState:   fromState,
		ToState:     toState,
		Description: description,
		IPAddress:   ipAddress,
	}
	database.DB.Create(&log)
}

func logEKlaimActionWithData(eklaimID uint, userID *uint, action, fromState, toState, description, ipAddress string, requestData, responseData interface{}, isError bool, errorMsg string) {
	reqJSON, _ := json.Marshal(requestData)
	respJSON, _ := json.Marshal(responseData)

	log := models.EKlaimLog{
		EKlaimID:     eklaimID,
		UserID:       userID,
		Action:       action,
		FromState:    fromState,
		ToState:      toState,
		Description:  description,
		RequestData:  string(reqJSON),
		ResponseData: string(respJSON),
		IsError:      isError,
		ErrorMessage: errorMsg,
		IPAddress:    ipAddress,
	}
	database.DB.Create(&log)
}
