package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"starter/backend/database"
	"starter/backend/models"
	bpjsService "starter/backend/services/bpjs"

	"github.com/gin-gonic/gin"
)

// ===========================================================================
// CPPT HANDLERS - Catatan Perkembangan Pasien Terintegrasi
// ===========================================================================

func normalizeCPPTFormat(value string) string {
	format := strings.ToLower(strings.TrimSpace(value))
	switch format {
	case "", models.CPPTFormatSOAP:
		return models.CPPTFormatSOAP
	case models.CPPTFormatSBAR:
		return models.CPPTFormatSBAR
	case models.CPPTFormatTBAK:
		return models.CPPTFormatTBAK
	default:
		return ""
	}
}

// GetCPPTs returns all CPPT records for a visit
func GetCPPTs(c *gin.Context) {
	visitID := c.Param("id")

	// Verify visit exists and is inpatient
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CPPT hanya tersedia untuk rawat inap"})
		return
	}

	var cppts []models.CPPT
	query := scopedRMQuery(c, visitID).
		Preload("CreatedBy").
		Preload("VerifiedBy").
		Order("record_date DESC, created_at DESC")

	// Filter by profession if provided
	if profession := c.Query("profession"); profession != "" {
		query = query.Where("profession = ?", profession)
	}

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("DATE(record_date) >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("DATE(record_date) <= ?", endDate)
	}

	if err := query.Find(&cppts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data CPPT"})
		return
	}

	for i := range cppts {
		if cppts[i].CPPTFormat == "" {
			cppts[i].CPPTFormat = models.CPPTFormatSOAP
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": cppts})
}

// GetCPPT returns a single CPPT record
func GetCPPT(c *gin.Context) {
	visitID := c.Param("id")
	cpptID := c.Param("cpptId")

	var cppt models.CPPT
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", cpptID).
		Preload("CreatedBy").
		Preload("VerifiedBy").
		First(&cppt).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data CPPT tidak ditemukan"})
		return
	}
	if cppt.CPPTFormat == "" {
		cppt.CPPTFormat = models.CPPTFormatSOAP
	}

	c.JSON(http.StatusOK, gin.H{"data": cppt})
}

// CreateCPPT creates a new CPPT record
func CreateCPPT(c *gin.Context) {
	visitID := c.Param("id")
	isCasemix := c.Query("is_casemix") == "true"
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		RecordDate       string `json:"record_date" binding:"required"`
		Profession       string `json:"profession" binding:"required"`
		CPPTFormat       string `json:"cppt_format"`
		Subjective       string `json:"subjective"`
		Objective        string `json:"objective"`
		Assessment       string `json:"assessment"`
		Plan             string `json:"plan"`
		Instruction      string `json:"instruction"`
		BloodPressure    string `json:"blood_pressure"`
		HeartRate        int    `json:"heart_rate"`
		RespiratoryRate  int    `json:"respiratory_rate"`
		Temperature      string `json:"temperature"`
		OxygenSaturation int    `json:"oxygen_saturation"`
		PainScale        int    `json:"pain_scale"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cpptFormat := normalizeCPPTFormat(input.CPPTFormat)
	if cpptFormat == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format CPPT tidak valid. Gunakan: soap, sbar, atau tbak"})
		return
	}

	// Verify visit exists and is inpatient
	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitIDUint).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CPPT hanya tersedia untuk rawat inap"})
		return
	}

	// Parse record date
	recordDate := ParseLocalDatetime(input.RecordDate)

	var createdByID *uint
	if userID > 0 {
		createdByID = &userID
	}

	cppt := models.CPPT{
		VisitID:          uint(visitIDUint),
		IsCasemix:        isCasemix,
		CasemixEklaimID:  getCasemixEklaimID(c),
		RecordDate:       recordDate,
		Profession:       input.Profession,
		CPPTFormat:       cpptFormat,
		Subjective:       input.Subjective,
		Objective:        input.Objective,
		Assessment:       input.Assessment,
		Plan:             input.Plan,
		Instruction:      input.Instruction,
		BloodPressure:    input.BloodPressure,
		HeartRate:        input.HeartRate,
		RespiratoryRate:  input.RespiratoryRate,
		Temperature:      input.Temperature,
		OxygenSaturation: input.OxygenSaturation,
		PainScale:        input.PainScale,
		CreatedByID:      createdByID,
	}

	if err := database.DB.Create(&cppt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan CPPT"})
		return
	}

	// Reload with relations
	database.DB.Preload("CreatedBy").First(&cppt, cppt.ID)

	c.JSON(http.StatusCreated, gin.H{"data": cppt})
}

// UpdateCPPT updates a CPPT record
func UpdateCPPT(c *gin.Context) {
	visitID := c.Param("id")
	cpptID := c.Param("cpptId")

	var cppt models.CPPT
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", cpptID).
		First(&cppt).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data CPPT tidak ditemukan"})
		return
	}

	// Don't allow editing verified records
	if cppt.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CPPT yang sudah diverifikasi tidak dapat diubah"})
		return
	}

	var input struct {
		RecordDate       string `json:"record_date"`
		Profession       string `json:"profession"`
		CPPTFormat       string `json:"cppt_format"`
		Subjective       string `json:"subjective"`
		Objective        string `json:"objective"`
		Assessment       string `json:"assessment"`
		Plan             string `json:"plan"`
		Instruction      string `json:"instruction"`
		BloodPressure    string `json:"blood_pressure"`
		HeartRate        int    `json:"heart_rate"`
		RespiratoryRate  int    `json:"respiratory_rate"`
		Temperature      string `json:"temperature"`
		OxygenSaturation int    `json:"oxygen_saturation"`
		PainScale        int    `json:"pain_scale"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cpptFormat := cppt.CPPTFormat
	if cpptFormat == "" {
		cpptFormat = models.CPPTFormatSOAP
	}
	if input.CPPTFormat != "" {
		cpptFormat = normalizeCPPTFormat(input.CPPTFormat)
		if cpptFormat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format CPPT tidak valid. Gunakan: soap, sbar, atau tbak"})
			return
		}
	}

	updates := map[string]interface{}{
		"profession":        input.Profession,
		"cppt_format":       cpptFormat,
		"subjective":        input.Subjective,
		"objective":         input.Objective,
		"assessment":        input.Assessment,
		"plan":              input.Plan,
		"instruction":       input.Instruction,
		"blood_pressure":    input.BloodPressure,
		"heart_rate":        input.HeartRate,
		"respiratory_rate":  input.RespiratoryRate,
		"temperature":       input.Temperature,
		"oxygen_saturation": input.OxygenSaturation,
		"pain_scale":        input.PainScale,
	}

	if input.RecordDate != "" {
		if rd, ok := TryParseLocalDatetime(input.RecordDate); ok {
			updates["record_date"] = rd
		}
	}

	if err := database.DB.Model(&cppt).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui CPPT"})
		return
	}

	// Reload with relations
	database.DB.Preload("CreatedBy").Preload("VerifiedBy").First(&cppt, cppt.ID)

	c.JSON(http.StatusOK, gin.H{"data": cppt})
}

// VerifyCPPT verifies a CPPT record
func VerifyCPPT(c *gin.Context) {
	visitID := c.Param("id")
	cpptID := c.Param("cpptId")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var cppt models.CPPT
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", cpptID).
		First(&cppt).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data CPPT tidak ditemukan"})
		return
	}

	if cppt.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CPPT sudah diverifikasi"})
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"is_verified":    true,
		"verified_by_id": userID,
		"verified_at":    &now,
	}

	if err := database.DB.Model(&cppt).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memverifikasi CPPT"})
		return
	}

	// Reload with relations
	database.DB.Preload("CreatedBy").Preload("VerifiedBy").First(&cppt, cppt.ID)

	c.JSON(http.StatusOK, gin.H{"data": cppt})
}

// DeleteCPPT deletes a CPPT record
func DeleteCPPT(c *gin.Context) {
	visitID := c.Param("id")
	cpptID := c.Param("cpptId")

	var cppt models.CPPT
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", cpptID).
		First(&cppt).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data CPPT tidak ditemukan"})
		return
	}

	if cppt.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CPPT yang sudah diverifikasi tidak dapat dihapus"})
		return
	}

	if err := database.DB.Delete(&cppt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus CPPT"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "CPPT berhasil dihapus"})
}

// ===========================================================================
// FLUID BALANCE HANDLERS - Balance Cairan
// ===========================================================================

// GetFluidBalances returns all fluid balance records for a visit
func GetFluidBalances(c *gin.Context) {
	visitID := c.Param("id")

	// Verify visit exists and is inpatient
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Balance cairan hanya tersedia untuk rawat inap"})
		return
	}

	var balances []models.FluidBalance
	query := scopedRMQuery(c, visitID).
		Preload("CreatedBy").
		Order("record_date DESC, shift_type ASC")

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("DATE(record_date) >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("DATE(record_date) <= ?", endDate)
	}

	// Filter by shift
	if shiftType := c.Query("shift_type"); shiftType != "" {
		query = query.Where("shift_type = ?", shiftType)
	}

	if err := query.Find(&balances).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data balance cairan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": balances})
}

// GetFluidBalance returns a single fluid balance record
func GetFluidBalance(c *gin.Context) {
	visitID := c.Param("id")
	balanceID := c.Param("balanceId")

	var balance models.FluidBalance
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", balanceID).
		Preload("CreatedBy").
		First(&balance).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data balance cairan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": balance})
}

// GetFluidBalanceSummary returns daily summary of fluid balance
func GetFluidBalanceSummary(c *gin.Context) {
	visitID := c.Param("id")

	type DailySummary struct {
		Date        string  `json:"date"`
		TotalIntake float64 `json:"total_intake"`
		TotalOutput float64 `json:"total_output"`
		Balance     float64 `json:"balance"`
	}

	var summaries []DailySummary
	err := scopedRMQuery(c, visitID).Model(&models.FluidBalance{}).
		Select("DATE(record_date) as date, SUM(total_intake) as total_intake, SUM(total_output) as total_output, SUM(balance) as balance").
		Group("DATE(record_date)").
		Order("date DESC").
		Scan(&summaries).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil ringkasan balance cairan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summaries})
}

// CreateFluidBalance creates a new fluid balance record
func CreateFluidBalance(c *gin.Context) {
	visitID := c.Param("id")
	isCasemix := c.Query("is_casemix") == "true"
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		RecordDate      string  `json:"record_date" binding:"required"`
		ShiftType       string  `json:"shift_type" binding:"required"`
		OralDrink       float64 `json:"oral_drink"`
		OralFood        float64 `json:"oral_food"`
		OralMedicine    float64 `json:"oral_medicine"`
		IVFluid         float64 `json:"iv_fluid"`
		IVMedicine      float64 `json:"iv_medicine"`
		BloodProduct    float64 `json:"blood_product"`
		EnteralFeed     float64 `json:"enteral_feed"`
		OtherIntake     float64 `json:"other_intake"`
		OtherIntakeNote string  `json:"other_intake_note"`
		UrineAmount     float64 `json:"urine_amount"`
		UrineColor      string  `json:"urine_color"`
		UrineCatheter   bool    `json:"urine_catheter"`
		FecesAmount     float64 `json:"feces_amount"`
		FecesFreq       int     `json:"feces_freq"`
		FecesType       string  `json:"feces_type"`
		VomitAmount     float64 `json:"vomit_amount"`
		VomitFreq       int     `json:"vomit_freq"`
		DrainAmount     float64 `json:"drain_amount"`
		DrainType       string  `json:"drain_type"`
		DrainColor      string  `json:"drain_color"`
		BloodLoss       float64 `json:"blood_loss"`
		BloodLossNote   string  `json:"blood_loss_note"`
		IWL             float64 `json:"iwl"`
		OtherOutput     float64 `json:"other_output"`
		OtherOutputNote string  `json:"other_output_note"`
		Notes           string  `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify visit exists and is inpatient
	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitIDUint).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Balance cairan hanya tersedia untuk rawat inap"})
		return
	}

	// Parse record date
	recordDate, err := ParseLocalDate(input.RecordDate)
	if err != nil {
		recordDate = time.Now()
	}

	// Check for duplicate (same date and shift)
	var existingCount int64
	scopedRMQuery(c, visitIDUint).Model(&models.FluidBalance{}).
		Where("DATE(record_date) = DATE(?) AND shift_type = ?", recordDate, input.ShiftType).
		Count(&existingCount)
	if existingCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data balance cairan untuk tanggal dan shift ini sudah ada"})
		return
	}

	var createdByID *uint
	if userID > 0 {
		createdByID = &userID
	}

	balance := models.FluidBalance{
		VisitID:         uint(visitIDUint),
		IsCasemix:       isCasemix,
		CasemixEklaimID: getCasemixEklaimID(c),
		RecordDate:      recordDate,
		ShiftType:       input.ShiftType,
		OralDrink:       input.OralDrink,
		OralFood:        input.OralFood,
		OralMedicine:    input.OralMedicine,
		IVFluid:         input.IVFluid,
		IVMedicine:      input.IVMedicine,
		BloodProduct:    input.BloodProduct,
		EnteralFeed:     input.EnteralFeed,
		OtherIntake:     input.OtherIntake,
		OtherIntakeNote: input.OtherIntakeNote,
		UrineAmount:     input.UrineAmount,
		UrineColor:      input.UrineColor,
		UrineCatheter:   input.UrineCatheter,
		FecesAmount:     input.FecesAmount,
		FecesFreq:       input.FecesFreq,
		FecesType:       input.FecesType,
		VomitAmount:     input.VomitAmount,
		VomitFreq:       input.VomitFreq,
		DrainAmount:     input.DrainAmount,
		DrainType:       input.DrainType,
		DrainColor:      input.DrainColor,
		BloodLoss:       input.BloodLoss,
		BloodLossNote:   input.BloodLossNote,
		IWL:             input.IWL,
		OtherOutput:     input.OtherOutput,
		OtherOutputNote: input.OtherOutputNote,
		Notes:           input.Notes,
		CreatedByID:     createdByID,
	}

	// Calculate totals
	balance.CalculateTotals()

	if err := database.DB.Create(&balance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan balance cairan"})
		return
	}

	// Reload with relations
	database.DB.Preload("CreatedBy").First(&balance, balance.ID)

	c.JSON(http.StatusCreated, gin.H{"data": balance})
}

// UpdateFluidBalance updates a fluid balance record
func UpdateFluidBalance(c *gin.Context) {
	visitID := c.Param("id")
	balanceID := c.Param("balanceId")

	var balance models.FluidBalance
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", balanceID).
		First(&balance).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data balance cairan tidak ditemukan"})
		return
	}

	var input struct {
		RecordDate      string  `json:"record_date"`
		ShiftType       string  `json:"shift_type"`
		OralDrink       float64 `json:"oral_drink"`
		OralFood        float64 `json:"oral_food"`
		OralMedicine    float64 `json:"oral_medicine"`
		IVFluid         float64 `json:"iv_fluid"`
		IVMedicine      float64 `json:"iv_medicine"`
		BloodProduct    float64 `json:"blood_product"`
		EnteralFeed     float64 `json:"enteral_feed"`
		OtherIntake     float64 `json:"other_intake"`
		OtherIntakeNote string  `json:"other_intake_note"`
		UrineAmount     float64 `json:"urine_amount"`
		UrineColor      string  `json:"urine_color"`
		UrineCatheter   bool    `json:"urine_catheter"`
		FecesAmount     float64 `json:"feces_amount"`
		FecesFreq       int     `json:"feces_freq"`
		FecesType       string  `json:"feces_type"`
		VomitAmount     float64 `json:"vomit_amount"`
		VomitFreq       int     `json:"vomit_freq"`
		DrainAmount     float64 `json:"drain_amount"`
		DrainType       string  `json:"drain_type"`
		DrainColor      string  `json:"drain_color"`
		BloodLoss       float64 `json:"blood_loss"`
		BloodLossNote   string  `json:"blood_loss_note"`
		IWL             float64 `json:"iwl"`
		OtherOutput     float64 `json:"other_output"`
		OtherOutputNote string  `json:"other_output_note"`
		Notes           string  `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	balance.OralDrink = input.OralDrink
	balance.OralFood = input.OralFood
	balance.OralMedicine = input.OralMedicine
	balance.IVFluid = input.IVFluid
	balance.IVMedicine = input.IVMedicine
	balance.BloodProduct = input.BloodProduct
	balance.EnteralFeed = input.EnteralFeed
	balance.OtherIntake = input.OtherIntake
	balance.OtherIntakeNote = input.OtherIntakeNote
	balance.UrineAmount = input.UrineAmount
	balance.UrineColor = input.UrineColor
	balance.UrineCatheter = input.UrineCatheter
	balance.FecesAmount = input.FecesAmount
	balance.FecesFreq = input.FecesFreq
	balance.FecesType = input.FecesType
	balance.VomitAmount = input.VomitAmount
	balance.VomitFreq = input.VomitFreq
	balance.DrainAmount = input.DrainAmount
	balance.DrainType = input.DrainType
	balance.DrainColor = input.DrainColor
	balance.BloodLoss = input.BloodLoss
	balance.BloodLossNote = input.BloodLossNote
	balance.IWL = input.IWL
	balance.OtherOutput = input.OtherOutput
	balance.OtherOutputNote = input.OtherOutputNote
	balance.Notes = input.Notes

	if input.RecordDate != "" {
		recordDate, err := ParseLocalDate(input.RecordDate)
		if err == nil {
			balance.RecordDate = recordDate
		}
	}

	if input.ShiftType != "" {
		balance.ShiftType = input.ShiftType
	}

	// Recalculate totals
	balance.CalculateTotals()

	if err := database.DB.Save(&balance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui balance cairan"})
		return
	}

	// Reload with relations
	database.DB.Preload("CreatedBy").First(&balance, balance.ID)

	c.JSON(http.StatusOK, gin.H{"data": balance})
}

// DeleteFluidBalance deletes a fluid balance record
func DeleteFluidBalance(c *gin.Context) {
	visitID := c.Param("id")
	balanceID := c.Param("balanceId")

	var balance models.FluidBalance
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", balanceID).
		First(&balance).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data balance cairan tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&balance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus balance cairan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Balance cairan berhasil dihapus"})
}

// ===========================================================================
// NURSING CARE HANDLERS - Asuhan Keperawatan
// ===========================================================================

// GetNursingCares returns all nursing care records for a visit
func GetNursingCares(c *gin.Context) {
	visitID := c.Param("id")

	// Verify visit exists
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Nursing care only for inpatient visits
	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Asuhan keperawatan hanya tersedia untuk rawat inap"})
		return
	}

	var records []models.NursingCare
	query := scopedRMQuery(c, visitID).
		Preload("CreatedBy").
		Preload("VerifiedBy").
		Order("record_date DESC, created_at DESC")

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("DATE(record_date) >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("DATE(record_date) <= ?", endDate)
	}

	// Filter by shift
	if shiftType := c.Query("shift_type"); shiftType != "" {
		query = query.Where("shift_type = ?", shiftType)
	}

	// Filter by problem status
	if problemStatus := c.Query("problem_status"); problemStatus != "" {
		query = query.Where("problem_status = ?", problemStatus)
	}

	if err := query.Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data asuhan keperawatan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records})
}

// GetNursingCare returns a single nursing care record
func GetNursingCare(c *gin.Context) {
	visitID := c.Param("id")
	nursingID := c.Param("nursingId")

	var record models.NursingCare
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", nursingID).
		Preload("CreatedBy").
		Preload("VerifiedBy").
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data asuhan keperawatan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": record})
}

// CreateNursingCare creates a new nursing care record
func CreateNursingCare(c *gin.Context) {
	visitID := c.Param("id")
	isCasemix := c.Query("is_casemix") == "true"
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		RecordDate              string `json:"record_date" binding:"required"`
		ShiftType               string `json:"shift_type"`
		ChiefComplaint          string `json:"chief_complaint"`
		PainAssessment          string `json:"pain_assessment"`
		PainScale               int    `json:"pain_scale"`
		ConsciousnessLevel      string `json:"consciousness_level"`
		FunctionalStatus        string `json:"functional_status"`
		FallRiskAssessment      string `json:"fall_risk_assessment"`
		FallRiskScore           int    `json:"fall_risk_score"`
		NutritionAssessment     string `json:"nutrition_assessment"`
		SkinAssessment          string `json:"skin_assessment"`
		PressureUlcerRisk       string `json:"pressure_ulcer_risk"`
		BloodPressure           string `json:"blood_pressure"`
		HeartRate               int    `json:"heart_rate"`
		RespiratoryRate         int    `json:"respiratory_rate"`
		Temperature             string `json:"temperature"`
		OxygenSaturation        int    `json:"oxygen_saturation"`
		NursingDiagnosis        string `json:"nursing_diagnosis"`
		NursingDiagnosisCode    string `json:"nursing_diagnosis_code"`
		ProblemEtiology         string `json:"problem_etiology"`
		SignsSymptoms           string `json:"signs_symptoms"`
		NursingOutcome          string `json:"nursing_outcome"`
		NursingOutcomeCode      string `json:"nursing_outcome_code"`
		OutcomeIndicators       string `json:"outcome_indicators"`
		OutcomeTarget           string `json:"outcome_target"`
		NursingIntervention     string `json:"nursing_intervention"`
		NursingInterventionCode string `json:"nursing_intervention_code"`
		ObservationActions      string `json:"observation_actions"`
		TherapeuticActions      string `json:"therapeutic_actions"`
		EducationActions        string `json:"education_actions"`
		CollaborationActions    string `json:"collaboration_actions"`
		Implementation          string `json:"implementation"`
		ImplementationTime      string `json:"implementation_time"`
		PatientResponse         string `json:"patient_response"`
		EvaluationSubjective    string `json:"evaluation_subjective"`
		EvaluationObjective     string `json:"evaluation_objective"`
		EvaluationAnalysis      string `json:"evaluation_analysis"`
		EvaluationPlanning      string `json:"evaluation_planning"`
		ProblemStatus           string `json:"problem_status"`
		Notes                   string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify visit exists and is inpatient
	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitIDUint).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Asuhan keperawatan hanya tersedia untuk rawat inap"})
		return
	}

	// Parse record date
	recordDate := ParseLocalDatetime(input.RecordDate)

	// Parse implementation time if provided
	var implTime time.Time
	if input.ImplementationTime != "" {
		implTime, _ = TryParseLocalDatetime(input.ImplementationTime)
	}

	var createdByID *uint
	if userID > 0 {
		createdByID = &userID
	}

	record := models.NursingCare{
		VisitID:                 uint(visitIDUint),
		IsCasemix:               isCasemix,
		CasemixEklaimID:         getCasemixEklaimID(c),
		RecordDate:              recordDate,
		ShiftType:               input.ShiftType,
		ChiefComplaint:          input.ChiefComplaint,
		PainAssessment:          input.PainAssessment,
		PainScale:               input.PainScale,
		ConsciousnessLevel:      input.ConsciousnessLevel,
		FunctionalStatus:        input.FunctionalStatus,
		FallRiskAssessment:      input.FallRiskAssessment,
		FallRiskScore:           input.FallRiskScore,
		NutritionAssessment:     input.NutritionAssessment,
		SkinAssessment:          input.SkinAssessment,
		PressureUlcerRisk:       input.PressureUlcerRisk,
		BloodPressure:           input.BloodPressure,
		HeartRate:               input.HeartRate,
		RespiratoryRate:         input.RespiratoryRate,
		Temperature:             input.Temperature,
		OxygenSaturation:        input.OxygenSaturation,
		NursingDiagnosis:        input.NursingDiagnosis,
		NursingDiagnosisCode:    input.NursingDiagnosisCode,
		ProblemEtiology:         input.ProblemEtiology,
		SignsSymptoms:           input.SignsSymptoms,
		NursingOutcome:          input.NursingOutcome,
		NursingOutcomeCode:      input.NursingOutcomeCode,
		OutcomeIndicators:       input.OutcomeIndicators,
		OutcomeTarget:           input.OutcomeTarget,
		NursingIntervention:     input.NursingIntervention,
		NursingInterventionCode: input.NursingInterventionCode,
		ObservationActions:      input.ObservationActions,
		TherapeuticActions:      input.TherapeuticActions,
		EducationActions:        input.EducationActions,
		CollaborationActions:    input.CollaborationActions,
		Implementation:          input.Implementation,
		ImplementationTime:      implTime,
		PatientResponse:         input.PatientResponse,
		EvaluationSubjective:    input.EvaluationSubjective,
		EvaluationObjective:     input.EvaluationObjective,
		EvaluationAnalysis:      input.EvaluationAnalysis,
		EvaluationPlanning:      input.EvaluationPlanning,
		ProblemStatus:           input.ProblemStatus,
		Notes:                   input.Notes,
		CreatedByID:             createdByID,
	}

	if err := database.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan asuhan keperawatan"})
		return
	}

	// Reload with relations
	database.DB.Preload("CreatedBy").First(&record, record.ID)

	c.JSON(http.StatusCreated, gin.H{"data": record})
}

// UpdateNursingCare updates a nursing care record
func UpdateNursingCare(c *gin.Context) {
	visitID := c.Param("id")
	nursingID := c.Param("nursingId")

	var record models.NursingCare
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", nursingID).
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data asuhan keperawatan tidak ditemukan"})
		return
	}

	// Don't allow editing verified records
	if record.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Asuhan keperawatan yang sudah diverifikasi tidak dapat diubah"})
		return
	}

	var input struct {
		RecordDate              string `json:"record_date"`
		ShiftType               string `json:"shift_type"`
		ChiefComplaint          string `json:"chief_complaint"`
		PainAssessment          string `json:"pain_assessment"`
		PainScale               int    `json:"pain_scale"`
		ConsciousnessLevel      string `json:"consciousness_level"`
		FunctionalStatus        string `json:"functional_status"`
		FallRiskAssessment      string `json:"fall_risk_assessment"`
		FallRiskScore           int    `json:"fall_risk_score"`
		NutritionAssessment     string `json:"nutrition_assessment"`
		SkinAssessment          string `json:"skin_assessment"`
		PressureUlcerRisk       string `json:"pressure_ulcer_risk"`
		BloodPressure           string `json:"blood_pressure"`
		HeartRate               int    `json:"heart_rate"`
		RespiratoryRate         int    `json:"respiratory_rate"`
		Temperature             string `json:"temperature"`
		OxygenSaturation        int    `json:"oxygen_saturation"`
		NursingDiagnosis        string `json:"nursing_diagnosis"`
		NursingDiagnosisCode    string `json:"nursing_diagnosis_code"`
		ProblemEtiology         string `json:"problem_etiology"`
		SignsSymptoms           string `json:"signs_symptoms"`
		NursingOutcome          string `json:"nursing_outcome"`
		NursingOutcomeCode      string `json:"nursing_outcome_code"`
		OutcomeIndicators       string `json:"outcome_indicators"`
		OutcomeTarget           string `json:"outcome_target"`
		NursingIntervention     string `json:"nursing_intervention"`
		NursingInterventionCode string `json:"nursing_intervention_code"`
		ObservationActions      string `json:"observation_actions"`
		TherapeuticActions      string `json:"therapeutic_actions"`
		EducationActions        string `json:"education_actions"`
		CollaborationActions    string `json:"collaboration_actions"`
		Implementation          string `json:"implementation"`
		ImplementationTime      string `json:"implementation_time"`
		PatientResponse         string `json:"patient_response"`
		EvaluationSubjective    string `json:"evaluation_subjective"`
		EvaluationObjective     string `json:"evaluation_objective"`
		EvaluationAnalysis      string `json:"evaluation_analysis"`
		EvaluationPlanning      string `json:"evaluation_planning"`
		ProblemStatus           string `json:"problem_status"`
		Notes                   string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"shift_type":                input.ShiftType,
		"chief_complaint":           input.ChiefComplaint,
		"pain_assessment":           input.PainAssessment,
		"pain_scale":                input.PainScale,
		"consciousness_level":       input.ConsciousnessLevel,
		"functional_status":         input.FunctionalStatus,
		"fall_risk_assessment":      input.FallRiskAssessment,
		"fall_risk_score":           input.FallRiskScore,
		"nutrition_assessment":      input.NutritionAssessment,
		"skin_assessment":           input.SkinAssessment,
		"pressure_ulcer_risk":       input.PressureUlcerRisk,
		"blood_pressure":            input.BloodPressure,
		"heart_rate":                input.HeartRate,
		"respiratory_rate":          input.RespiratoryRate,
		"temperature":               input.Temperature,
		"oxygen_saturation":         input.OxygenSaturation,
		"nursing_diagnosis":         input.NursingDiagnosis,
		"nursing_diagnosis_code":    input.NursingDiagnosisCode,
		"problem_etiology":          input.ProblemEtiology,
		"signs_symptoms":            input.SignsSymptoms,
		"nursing_outcome":           input.NursingOutcome,
		"nursing_outcome_code":      input.NursingOutcomeCode,
		"outcome_indicators":        input.OutcomeIndicators,
		"outcome_target":            input.OutcomeTarget,
		"nursing_intervention":      input.NursingIntervention,
		"nursing_intervention_code": input.NursingInterventionCode,
		"observation_actions":       input.ObservationActions,
		"therapeutic_actions":       input.TherapeuticActions,
		"education_actions":         input.EducationActions,
		"collaboration_actions":     input.CollaborationActions,
		"implementation":            input.Implementation,
		"patient_response":          input.PatientResponse,
		"evaluation_subjective":     input.EvaluationSubjective,
		"evaluation_objective":      input.EvaluationObjective,
		"evaluation_analysis":       input.EvaluationAnalysis,
		"evaluation_planning":       input.EvaluationPlanning,
		"problem_status":            input.ProblemStatus,
		"notes":                     input.Notes,
	}

	if input.RecordDate != "" {
		if rd, ok := TryParseLocalDatetime(input.RecordDate); ok {
			updates["record_date"] = rd
		}
	}

	if input.ImplementationTime != "" {
		if it, ok := TryParseLocalDatetime(input.ImplementationTime); ok {
			updates["implementation_time"] = it
		}
	}

	if err := database.DB.Model(&record).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui asuhan keperawatan"})
		return
	}

	// Reload with relations
	database.DB.Preload("CreatedBy").Preload("VerifiedBy").First(&record, record.ID)

	c.JSON(http.StatusOK, gin.H{"data": record})
}

// VerifyNursingCare verifies a nursing care record
func VerifyNursingCare(c *gin.Context) {
	visitID := c.Param("id")
	nursingID := c.Param("nursingId")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var record models.NursingCare
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", nursingID).
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data asuhan keperawatan tidak ditemukan"})
		return
	}

	if record.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Asuhan keperawatan sudah diverifikasi"})
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"is_verified":    true,
		"verified_by_id": userID,
		"verified_at":    &now,
	}

	if err := database.DB.Model(&record).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memverifikasi asuhan keperawatan"})
		return
	}

	// Reload with relations
	database.DB.Preload("CreatedBy").Preload("VerifiedBy").First(&record, record.ID)

	c.JSON(http.StatusOK, gin.H{"data": record})
}

// DeleteNursingCare deletes a nursing care record
func DeleteNursingCare(c *gin.Context) {
	visitID := c.Param("id")
	nursingID := c.Param("nursingId")

	var record models.NursingCare
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", nursingID).
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data asuhan keperawatan tidak ditemukan"})
		return
	}

	if record.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Asuhan keperawatan yang sudah diverifikasi tidak dapat dihapus"})
		return
	}

	if err := database.DB.Delete(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus asuhan keperawatan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Asuhan keperawatan berhasil dihapus"})
}

// ===========================================================================
// BED TRANSFER HANDLERS - Mutasi Pasien (Pindah Kamar/Bed)
// ===========================================================================

// GetBedTransfers returns all bed transfer records for a visit
func GetBedTransfers(c *gin.Context) {
	visitID := c.Param("id")

	// Verify visit exists and is inpatient
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mutasi hanya tersedia untuk rawat inap"})
		return
	}

	var transfers []models.BedTransfer
	if err := database.DB.
		Where("visit_id = ?", visitID).
		Preload("FromRoom").
		Preload("FromBed").
		Preload("ToRoom").
		Preload("ToBed").
		Preload("CreatedBy").
		Order("transfer_date DESC").
		Find(&transfers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mutasi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": transfers})
}

// GetBedTransfer returns a single bed transfer record
func GetBedTransfer(c *gin.Context) {
	visitID := c.Param("id")
	transferID := c.Param("transferId")

	var transfer models.BedTransfer
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, transferID).
		Preload("FromRoom").
		Preload("FromBed").
		Preload("ToRoom").
		Preload("ToBed").
		Preload("CreatedBy").
		First(&transfer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data mutasi tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": transfer})
}

// CreateBedTransfer creates a new bed transfer (mutasi)
func CreateBedTransfer(c *gin.Context) {
	visitID := c.Param("id")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		ToRoomID       uint   `json:"to_room_id" binding:"required"`
		ToBedID        uint   `json:"to_bed_id" binding:"required"`
		TransferReason string `json:"transfer_reason"`
		TransferType   string `json:"transfer_type"`
		Notes          string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get visit with current bed info
	var visit models.Visit
	if err := database.DB.
		Preload("Room").
		Preload("Bed").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Verify it's an inpatient visit
	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mutasi hanya tersedia untuk rawat inap"})
		return
	}

	// Verify visit is still in progress
	if visit.Status != "in_progress" && visit.Status != "waiting" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mutasi hanya bisa dilakukan untuk kunjungan aktif"})
		return
	}

	// Check if this is initial placement (no current bed) or transfer
	var oldBedID uint
	isInitialPlacement := true
	if visit.BedID != nil && *visit.BedID > 0 {
		isInitialPlacement = false
		oldBedID = *visit.BedID
	}

	// Verify target bed exists and is available
	var targetBed models.Bed
	if err := database.DB.Preload("RoomUnit").First(&targetBed, input.ToBedID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bed tujuan tidak ditemukan"})
		return
	}

	// Check if target bed is the same as current bed
	if !isInitialPlacement && oldBedID == input.ToBedID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bed tujuan sama dengan bed saat ini"})
		return
	}

	if targetBed.Status != "available" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bed tujuan tidak tersedia (sedang terisi)"})
		return
	}

	// Verify target room exists
	var targetRoom models.Room
	if err := database.DB.First(&targetRoom, input.ToRoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan tujuan tidak ditemukan"})
		return
	}

	// Get target room class for billing
	newInpatientClass := targetRoom.RoomClass

	// Start transaction
	tx := database.DB.Begin()

	// Create transfer record
	now := time.Now()
	transfer := models.BedTransfer{
		VisitID:           visit.ID,
		FromRoomID:        visit.RoomID,
		ToRoomID:          input.ToRoomID,
		ToBedID:           input.ToBedID,
		TransferDate:      now,
		TransferReason:    input.TransferReason,
		TransferType:      input.TransferType,
		OldInpatientClass: visit.InpatientClass,
		NewInpatientClass: newInpatientClass,
		Notes:             input.Notes,
		CreatedByID:       &userID,
	}

	// Set FromBedID only if patient already has a bed
	if !isInitialPlacement && oldBedID > 0 {
		transfer.FromBedID = &oldBedID
	}

	if err := tx.Create(&transfer).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat catatan mutasi"})
		return
	}

	// Update old bed status to available (only if patient already has a bed)
	if !isInitialPlacement && oldBedID > 0 {
		if err := tx.Model(&models.Bed{}).Where("id = ?", oldBedID).Update("status", "available").Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update bed lama"})
			return
		}
	}

	// Update new bed status to occupied
	if err := tx.Model(&models.Bed{}).Where("id = ?", input.ToBedID).Update("status", "occupied").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update bed baru"})
		return
	}

	// Update visit with new room and bed - use visit.ID to ensure correct record is updated
	if err := tx.Model(&models.Visit{}).Where("id = ?", visit.ID).Updates(map[string]interface{}{
		"room_id":         input.ToRoomID,
		"bed_id":          input.ToBedID,
		"inpatient_class": newInpatientClass,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update kunjungan"})
		return
	}

	tx.Commit()

	if !isInitialPlacement && transfer.FromRoomID > 0 {
		bpjsService.UpdateRoomBedAvailability(transfer.FromRoomID, "inpatient_bed_transfer_from_room")
	}
	bpjsService.UpdateRoomBedAvailability(input.ToRoomID, "inpatient_bed_transfer_to_room")

	// Reload transfer with relations
	database.DB.
		Preload("FromRoom").
		Preload("FromBed").
		Preload("ToRoom").
		Preload("ToBed").
		Preload("CreatedBy").
		First(&transfer, transfer.ID)

	// Send notifications for bed transfer/mutasi
	if NotifService != nil {
		// Get patient info
		var visitWithPatient models.Visit
		database.DB.Preload("Registration.Patient").First(&visitWithPatient, visit.ID)
		patientName := ""
		if visitWithPatient.Registration != nil && visitWithPatient.Registration.Patient != nil {
			patientName = visitWithPatient.Registration.Patient.NamaLengkap
		}

		fromRoomName := ""
		if transfer.FromRoom != nil {
			fromRoomName = transfer.FromRoom.Name
		}
		toRoomName := ""
		if transfer.ToRoom != nil {
			toRoomName = transfer.ToRoom.Name
		}

		// Notify previous room (FromRoom) - only if not initial placement
		if !isInitialPlacement && transfer.FromRoomID > 0 {
			go NotifService.NotifyRoomUsers(
				transfer.FromRoomID,
				models.NotificationTypeBedTransfer,
				"Pasien Pindah Ruangan",
				fmt.Sprintf("Pasien %s telah dipindahkan dari %s ke %s", patientName, fromRoomName, toRoomName),
				map[string]interface{}{
					"visit_id":      visit.ID,
					"transfer_id":   transfer.ID,
					"patient_name":  patientName,
					"from_room":     fromRoomName,
					"to_room":       toRoomName,
					"transfer_type": "out",
				},
			)
		}

		// Notify target room (ToRoom)
		notifTitle := "Pasien Baru Masuk"
		if !isInitialPlacement {
			notifTitle = "Pasien Pindahan Masuk"
		}
		go NotifService.NotifyRoomUsers(
			input.ToRoomID,
			models.NotificationTypeBedTransfer,
			notifTitle,
			fmt.Sprintf("Pasien %s telah masuk ke %s", patientName, toRoomName),
			map[string]interface{}{
				"visit_id":      visit.ID,
				"transfer_id":   transfer.ID,
				"patient_name":  patientName,
				"from_room":     fromRoomName,
				"to_room":       toRoomName,
				"transfer_type": "in",
			},
		)
	}

	message := "Mutasi pasien berhasil"
	if isInitialPlacement {
		message = "Penempatan bed pasien berhasil"
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    transfer,
		"message": message,
	})
}
