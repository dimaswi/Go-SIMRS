package handlers

import (
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// ===========================================================================
// CPPT HANDLERS - Catatan Perkembangan Pasien Terintegrasi
// ===========================================================================

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
	query := database.DB.
		Where("visit_id = ?", visitID).
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

	c.JSON(http.StatusOK, gin.H{"data": cppts})
}

// GetCPPT returns a single CPPT record
func GetCPPT(c *gin.Context) {
	visitID := c.Param("id")
	cpptID := c.Param("cpptId")

	var cppt models.CPPT
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, cpptID).
		Preload("CreatedBy").
		Preload("VerifiedBy").
		First(&cppt).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data CPPT tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cppt})
}

// CreateCPPT creates a new CPPT record
func CreateCPPT(c *gin.Context) {
	visitID := c.Param("id")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		RecordDate       string `json:"record_date" binding:"required"`
		Profession       string `json:"profession" binding:"required"`
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
	recordDate, err := time.Parse("2006-01-02T15:04", input.RecordDate)
	if err != nil {
		// Try another format
		recordDate, err = time.Parse("2006-01-02 15:04", input.RecordDate)
		if err != nil {
			recordDate = time.Now()
		}
	}

	var createdByID *uint
	if userID > 0 {
		createdByID = &userID
	}

	cppt := models.CPPT{
		VisitID:          uint(visitIDUint),
		RecordDate:       recordDate,
		Profession:       input.Profession,
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
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, cpptID).
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

	updates := map[string]interface{}{
		"profession":        input.Profession,
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
		recordDate, err := time.Parse("2006-01-02T15:04", input.RecordDate)
		if err != nil {
			recordDate, _ = time.Parse("2006-01-02 15:04", input.RecordDate)
		}
		updates["record_date"] = recordDate
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
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, cpptID).
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
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, cpptID).
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
	query := database.DB.
		Where("visit_id = ?", visitID).
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
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, balanceID).
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
	err := database.DB.Model(&models.FluidBalance{}).
		Select("DATE(record_date) as date, SUM(total_intake) as total_intake, SUM(total_output) as total_output, SUM(balance) as balance").
		Where("visit_id = ?", visitID).
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
	recordDate, err := time.Parse("2006-01-02", input.RecordDate)
	if err != nil {
		recordDate = time.Now()
	}

	// Check for duplicate (same date and shift)
	var existingCount int64
	database.DB.Model(&models.FluidBalance{}).
		Where("visit_id = ? AND DATE(record_date) = DATE(?) AND shift_type = ?", visitIDUint, recordDate, input.ShiftType).
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
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, balanceID).
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
		recordDate, err := time.Parse("2006-01-02", input.RecordDate)
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
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, balanceID).
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
