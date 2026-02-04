package handlers

import (
	"math"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== Quality Control Indicators ====================

// HospitalIndicators contains standard hospital quality indicators
type HospitalIndicators struct {
	BOR  float64 `json:"bor"`  // Bed Occupancy Rate
	ALOS float64 `json:"alos"` // Average Length of Stay
	TOI  float64 `json:"toi"`  // Turn Over Interval
	BTO  float64 `json:"bto"`  // Bed Turn Over
	NDR  float64 `json:"ndr"`  // Net Death Rate (>48 hours)
	GDR  float64 `json:"gdr"`  // Gross Death Rate
	// Standard values for comparison
	Standards IndicatorStandards `json:"standards"`
}

// IndicatorStandards contains ideal standard values for hospital indicators
type IndicatorStandards struct {
	BORMin  float64 `json:"bor_min"`  // 60%
	BORMax  float64 `json:"bor_max"`  // 85%
	ALOSMin float64 `json:"alos_min"` // 6 days
	ALOSMax float64 `json:"alos_max"` // 9 days
	TOIMin  float64 `json:"toi_min"`  // 1 day
	TOIMax  float64 `json:"toi_max"`  // 3 days
	BTOMin  float64 `json:"bto_min"`  // 40x per year
	BTOMax  float64 `json:"bto_max"`  // 50x per year
	NDRMax  float64 `json:"ndr_max"`  // <25 per mille
	GDRMax  float64 `json:"gdr_max"`  // <45 per mille
}

// QualityMetricsResponse contains quality metrics data
type QualityMetricsResponse struct {
	Indicators       HospitalIndicators `json:"indicators"`
	Period           string             `json:"period"`
	TotalBeds        int64              `json:"total_beds"`
	TotalDischarges  int64              `json:"total_discharges"`
	TotalDeaths      int64              `json:"total_deaths"`
	DeathsAfter48h   int64              `json:"deaths_after_48h"`
	TotalPatientDays int64              `json:"total_patient_days"`
}

// ==================== Cost Control Structures ====================

// CostAnalysisSummary contains cost control summary data
type CostAnalysisSummary struct {
	TotalCases       int64   `json:"total_cases"`
	TotalActualCost  float64 `json:"total_actual_cost"`
	TotalClaimAmount float64 `json:"total_claim_amount"`
	CostRecoveryRate float64 `json:"cost_recovery_rate"` // % covered by claims
	SurplusCases     int64   `json:"surplus_cases"`      // Cases with profit
	DeficitCases     int64   `json:"deficit_cases"`      // Cases with loss
	TotalSurplus     float64 `json:"total_surplus"`      // Total profit amount
	TotalDeficit     float64 `json:"total_deficit"`      // Total loss amount
	NetBalance       float64 `json:"net_balance"`        // Overall profit/loss
	AvgCostPerCase   float64 `json:"avg_cost_per_case"`
	AvgClaimPerCase  float64 `json:"avg_claim_per_case"`
	DrugCostRatio    float64 `json:"drug_cost_ratio"` // % of drug cost from total
}

// CostCaseDetail represents individual case cost analysis
type CostCaseDetail struct {
	ID                uint       `json:"id"`
	BillingNumber     string     `json:"billing_number"`
	PatientName       string     `json:"patient_name"`
	MRN               string     `json:"mrn"`
	VisitType         string     `json:"visit_type"`
	Diagnosis         string     `json:"diagnosis"`
	InaCBGCode        string     `json:"inacbg_code"`
	InaCBGTariff      float64    `json:"inacbg_tariff"`
	ActualCost        float64    `json:"actual_cost"`
	Difference        float64    `json:"difference"` // Tariff - Cost (positive = profit)
	DifferencePercent float64    `json:"difference_percent"`
	LOS               int        `json:"los"` // Length of Stay
	PaymentMethod     string     `json:"payment_method"`
	Status            string     `json:"status"`
	DischargeDate     *time.Time `json:"discharge_date"`
}

// CostByCategory represents cost breakdown by category
type CostByCategory struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
}

// TopLossCase represents cases with highest losses
type TopLossCase struct {
	CostCaseDetail
	LossReason string `json:"loss_reason"`
}

// PendingClaimSummary represents pending claims information
type PendingClaimSummary struct {
	TotalPendingClaims int64           `json:"total_pending_claims"`
	TotalPendingAmount float64         `json:"total_pending_amount"`
	OldestPendingDays  int             `json:"oldest_pending_days"`
	ByAgeGroup         []ClaimAgeGroup `json:"by_age_group"`
}

// ClaimAgeGroup represents claims grouped by age
type ClaimAgeGroup struct {
	AgeRange string  `json:"age_range"` // "0-7 hari", "8-14 hari", etc.
	Count    int64   `json:"count"`
	Amount   float64 `json:"amount"`
}

// ==================== Handlers ====================

// GetQualityMetrics returns hospital quality indicators (BOR, ALOS, TOI, BTO, NDR, GDR)
func GetQualityMetrics(c *gin.Context) {
	db := database.DB

	// Get period from query (default: month)
	period := c.DefaultQuery("period", "month")

	var startDate, endDate time.Time
	now := time.Now()

	switch period {
	case "week":
		startDate = now.AddDate(0, 0, -7)
	case "month":
		startDate = now.AddDate(0, -1, 0)
	case "quarter":
		startDate = now.AddDate(0, -3, 0)
	case "year":
		startDate = now.AddDate(-1, 0, 0)
	default:
		startDate = now.AddDate(0, -1, 0)
	}
	endDate = now

	// Calculate number of days in period
	periodDays := endDate.Sub(startDate).Hours() / 24

	// Get total beds - if no beds configured, assume default capacity
	var totalBeds int64
	db.Model(&models.Bed{}).Where("status != ?", "inactive").Count(&totalBeds)
	if totalBeds == 0 {
		// Try counting from room_units with bed capacity
		db.Model(&models.RoomUnit{}).Select("COALESCE(SUM(bed_capacity), 0)").Scan(&totalBeds)
	}
	if totalBeds == 0 {
		totalBeds = 50 // Default assumption if no bed data
	}

	// Get ALL visits in period for calculations
	var visits []struct {
		AdmissionTime *time.Time
		DischargeTime *time.Time
		Status        string
		InpatientDays int
		VisitType     string
	}
	db.Model(&models.Visit{}).
		Select("admission_time, discharge_time, status, inpatient_days, visit_type").
		Where("created_at >= ? AND created_at <= ?", startDate, endDate).
		Scan(&visits)

	// Also count from registrations
	var totalRegistrations int64
	db.Model(&models.Registration{}).
		Where("created_at >= ? AND created_at <= ?", startDate, endDate).
		Count(&totalRegistrations)

	// Calculate Total Patient Days (for BOR) - only inpatient
	var totalPatientDays int64
	var inpatientVisits int64
	for _, v := range visits {
		if v.VisitType == "inpatient" {
			inpatientVisits++
			if v.InpatientDays > 0 {
				totalPatientDays += int64(v.InpatientDays)
			} else if v.AdmissionTime != nil {
				endTime := endDate
				if v.DischargeTime != nil {
					endTime = *v.DischargeTime
				}
				days := int64(endTime.Sub(*v.AdmissionTime).Hours() / 24)
				if days < 1 {
					days = 1
				}
				totalPatientDays += days
			}
		}
	}

	// Count discharges in period (completed visits)
	var totalDischarges int64
	db.Model(&models.Visit{}).
		Where("visit_type = ?", "inpatient").
		Where("discharge_time >= ? AND discharge_time <= ?", startDate, endDate).
		Count(&totalDischarges)

	// Count deaths (for NDR and GDR) - assuming status = 'deceased' or similar
	var totalDeaths int64
	var deathsAfter48h int64

	db.Model(&models.Visit{}).
		Where("visit_type = ?", "inpatient").
		Where("status = ?", "deceased").
		Where("discharge_time >= ? AND discharge_time <= ?", startDate, endDate).
		Count(&totalDeaths)

	// Deaths after 48 hours - need to check admission duration
	db.Model(&models.Visit{}).
		Where("visit_type = ?", "inpatient").
		Where("status = ?", "deceased").
		Where("discharge_time >= ? AND discharge_time <= ?", startDate, endDate).
		Where("EXTRACT(EPOCH FROM (discharge_time - admission_time))/3600 > 48").
		Count(&deathsAfter48h)

	// Calculate indicators
	var bor, alos, toi, bto, ndr, gdr float64

	// BOR = (Total Patient Days / (Total Beds × Period Days)) × 100%
	if totalBeds > 0 && periodDays > 0 {
		bor = (float64(totalPatientDays) / (float64(totalBeds) * periodDays)) * 100
	}

	// ALOS = Total Patient Days / Total Discharges
	if totalDischarges > 0 {
		alos = float64(totalPatientDays) / float64(totalDischarges)
	}

	// BTO = Total Discharges / Total Beds (annualized)
	if totalBeds > 0 {
		annualizationFactor := 365.0 / periodDays
		bto = (float64(totalDischarges) / float64(totalBeds)) * annualizationFactor
	}

	// TOI = ((Total Beds × Period Days) - Total Patient Days) / Total Discharges
	if totalDischarges > 0 && totalBeds > 0 {
		availableBedDays := (float64(totalBeds) * periodDays) - float64(totalPatientDays)
		toi = availableBedDays / float64(totalDischarges)
	}

	// NDR = (Deaths after 48h / (Total Discharges - Deaths before 48h)) × 1000‰
	deathsBefore48h := totalDeaths - deathsAfter48h
	if (totalDischarges - deathsBefore48h) > 0 {
		ndr = (float64(deathsAfter48h) / float64(totalDischarges-deathsBefore48h)) * 1000
	}

	// GDR = (Total Deaths / Total Discharges) × 1000‰
	if totalDischarges > 0 {
		gdr = (float64(totalDeaths) / float64(totalDischarges)) * 1000
	}

	response := QualityMetricsResponse{
		Indicators: HospitalIndicators{
			BOR:  math.Round(bor*100) / 100,
			ALOS: math.Round(alos*100) / 100,
			TOI:  math.Round(toi*100) / 100,
			BTO:  math.Round(bto*100) / 100,
			NDR:  math.Round(ndr*100) / 100,
			GDR:  math.Round(gdr*100) / 100,
			Standards: IndicatorStandards{
				BORMin:  60,
				BORMax:  85,
				ALOSMin: 6,
				ALOSMax: 9,
				TOIMin:  1,
				TOIMax:  3,
				BTOMin:  40,
				BTOMax:  50,
				NDRMax:  25,
				GDRMax:  45,
			},
		},
		Period:           period,
		TotalBeds:        totalBeds,
		TotalDischarges:  totalDischarges,
		TotalDeaths:      totalDeaths,
		DeathsAfter48h:   deathsAfter48h,
		TotalPatientDays: totalPatientDays,
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// GetCostAnalysisSummary returns cost control summary based on ALL registrations
func GetCostAnalysisSummary(c *gin.Context) {
	db := database.DB

	period := c.DefaultQuery("period", "month")
	paymentMethod := c.DefaultQuery("payment_method", "") // Filter by payment method (e.g., "bpjs")

	var startDate time.Time
	now := time.Now()
	useTimeFilter := true

	switch period {
	case "week":
		startDate = now.AddDate(0, 0, -7)
	case "month":
		startDate = now.AddDate(0, -1, 0)
	case "quarter":
		startDate = now.AddDate(0, -3, 0)
	case "year":
		startDate = now.AddDate(-1, 0, 0)
	case "all":
		useTimeFilter = false // No time filter - ALL data
	default:
		startDate = now.AddDate(0, -1, 0)
	}

	// Query from REGISTRATIONS - all registrations in period
	regQuery := db.Model(&models.Registration{})
	if useTimeFilter {
		regQuery = regQuery.Where("created_at >= ?", startDate)
	}

	if paymentMethod != "" {
		regQuery = regQuery.Where("payment_method = ?", paymentMethod)
	}

	// Get total registrations
	var totalCases int64
	regQuery.Count(&totalCases)

	// Get cost data from billings linked to these registrations
	var costData []struct {
		RegistrationID  uint
		FinalAmount     float64
		BPJSClaimAmount float64
		Status          string
	}
	billingQuery := db.Model(&models.Billing{}).
		Select("registration_id, final_amount, bpjs_claim_amount, status")
	if useTimeFilter {
		billingQuery = billingQuery.Where("created_at >= ?", startDate)
	}
	if paymentMethod != "" {
		billingQuery = billingQuery.Joins("JOIN registrations ON registrations.id = billings.registration_id").
			Where("registrations.payment_method = ?", paymentMethod)
	}
	billingQuery.Scan(&costData)

	var totalActualCost, totalClaimAmount float64
	var surplusCases, deficitCases int64
	var totalSurplus, totalDeficit float64

	for _, r := range costData {
		totalActualCost += r.FinalAmount
		claimAmount := r.BPJSClaimAmount
		// Klaim tetap 0 jika belum ada bridging - tidak default ke biaya aktual
		totalClaimAmount += claimAmount

		diff := claimAmount - r.FinalAmount
		if diff >= 0 {
			surplusCases++
			totalSurplus += diff
		} else {
			deficitCases++
			totalDeficit += math.Abs(diff)
		}
	}

	// Calculate drug cost ratio from billing items
	var drugCost float64
	drugQuery := db.Model(&models.BillingItem{}).
		Joins("JOIN billings ON billings.id = billing_items.billing_id").
		Where("billing_items.item_type = ?", "medicine")
	if useTimeFilter {
		drugQuery = drugQuery.Where("billings.created_at >= ?", startDate)
	}
	drugQuery.Select("COALESCE(SUM(billing_items.subtotal), 0)").
		Scan(&drugCost)

	var drugCostRatio float64
	if totalActualCost > 0 {
		drugCostRatio = (drugCost / totalActualCost) * 100
	}

	var costRecoveryRate float64
	if totalActualCost > 0 {
		costRecoveryRate = (totalClaimAmount / totalActualCost) * 100
	}

	var avgCostPerCase, avgClaimPerCase float64
	if totalCases > 0 {
		avgCostPerCase = totalActualCost / float64(totalCases)
		avgClaimPerCase = totalClaimAmount / float64(totalCases)
	}

	summary := CostAnalysisSummary{
		TotalCases:       totalCases,
		TotalActualCost:  math.Round(totalActualCost*100) / 100,
		TotalClaimAmount: math.Round(totalClaimAmount*100) / 100,
		CostRecoveryRate: math.Round(costRecoveryRate*100) / 100,
		SurplusCases:     surplusCases,
		DeficitCases:     deficitCases,
		TotalSurplus:     math.Round(totalSurplus*100) / 100,
		TotalDeficit:     math.Round(totalDeficit*100) / 100,
		NetBalance:       math.Round((totalSurplus-totalDeficit)*100) / 100,
		AvgCostPerCase:   math.Round(avgCostPerCase*100) / 100,
		AvgClaimPerCase:  math.Round(avgClaimPerCase*100) / 100,
		DrugCostRatio:    math.Round(drugCostRatio*100) / 100,
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    summary,
	})
}

// GetCostCaseList returns list of ALL registrations with cost analysis
func GetCostCaseList(c *gin.Context) {
	db := database.DB

	period := c.DefaultQuery("period", "month")
	sortBy := c.DefaultQuery("sort_by", "date")       // date, cost, difference
	sortOrder := c.DefaultQuery("sort_order", "desc") // newest first by default
	paymentMethod := c.DefaultQuery("payment_method", "")
	page := 1
	limit := 50

	var startDate time.Time
	now := time.Now()
	useTimeFilter := true

	switch period {
	case "week":
		startDate = now.AddDate(0, 0, -7)
	case "month":
		startDate = now.AddDate(0, -1, 0)
	case "quarter":
		startDate = now.AddDate(0, -3, 0)
	case "year":
		startDate = now.AddDate(-1, 0, 0)
	case "all":
		useTimeFilter = false
	default:
		startDate = now.AddDate(0, -1, 0)
	}

	// Query from REGISTRATIONS - all registrations
	query := db.Model(&models.Registration{}).
		Preload("Patient").
		Preload("DestinationRoom").
		Preload("Doctor")
	if useTimeFilter {
		query = query.Where("registrations.created_at >= ?", startDate)
	}

	if paymentMethod != "" {
		query = query.Where("payment_method = ?", paymentMethod)
	}

	// Get total count
	var total int64
	query.Count(&total)

	// Order by registration date
	orderClause := "registrations.created_at DESC"
	if sortBy == "date" {
		if sortOrder == "asc" {
			orderClause = "registrations.created_at ASC"
		}
	}

	var registrations []models.Registration
	query.Order(orderClause).
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&registrations)

	// Get billing data for these registrations
	regIDs := make([]uint, len(registrations))
	for i, r := range registrations {
		regIDs[i] = r.ID
	}

	// Map billing data by registration_id
	billingMap := make(map[uint]*models.Billing)
	if len(regIDs) > 0 {
		var billings []models.Billing
		db.Where("registration_id IN ?", regIDs).Find(&billings)
		for i := range billings {
			billingMap[billings[i].RegistrationID] = &billings[i]
		}
	}

	// Get visit data for these registrations
	visitMap := make(map[uint]*models.Visit)
	if len(regIDs) > 0 {
		var visits []models.Visit
		db.Where("registration_id IN ?", regIDs).Find(&visits)
		for i := range visits {
			visitMap[visits[i].RegistrationID] = &visits[i]
		}
	}

	// Convert to response format
	var cases []CostCaseDetail
	for _, r := range registrations {
		patientName := ""
		mrn := ""
		if r.Patient != nil {
			patientName = r.Patient.NamaLengkap
			mrn = r.Patient.NoRM
		}

		var actualCost, claimAmount, diff, diffPercent float64
		var billingNumber, billingStatus, inaCBGCode string

		if b, ok := billingMap[r.ID]; ok {
			billingNumber = b.BillingNumber
			actualCost = b.FinalAmount
			claimAmount = b.BPJSClaimAmount // Tetap 0 jika belum ada bridging
			diff = claimAmount - actualCost
			if actualCost > 0 {
				diffPercent = (diff / actualCost) * 100
			}
			billingStatus = b.Status
			inaCBGCode = b.InaCBGCode
		}

		visitType := r.RegistrationType
		diagnosis := ""
		var los int
		var dischargeTime *time.Time
		if v, ok := visitMap[r.ID]; ok {
			visitType = v.VisitType
			diagnosis = v.Diagnosis
			los = v.InpatientDays
			dischargeTime = v.DischargeTime
		}

		cases = append(cases, CostCaseDetail{
			ID:                r.ID,
			BillingNumber:     billingNumber,
			PatientName:       patientName,
			MRN:               mrn,
			VisitType:         visitType,
			Diagnosis:         diagnosis,
			InaCBGCode:        inaCBGCode,
			InaCBGTariff:      claimAmount,
			ActualCost:        actualCost,
			Difference:        math.Round(diff*100) / 100,
			DifferencePercent: math.Round(diffPercent*100) / 100,
			LOS:               los,
			PaymentMethod:     r.PaymentMethod,
			Status:            billingStatus,
			DischargeDate:     dischargeTime,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    cases,
		"meta": gin.H{
			"total": total,
			"page":  page,
			"limit": limit,
			"pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetTopLossCases returns top cases with highest losses
func GetTopLossCases(c *gin.Context) {
	db := database.DB

	period := c.DefaultQuery("period", "month")
	limit := 10

	var startDate time.Time
	now := time.Now()

	switch period {
	case "week":
		startDate = now.AddDate(0, 0, -7)
	case "month":
		startDate = now.AddDate(0, -1, 0)
	case "quarter":
		startDate = now.AddDate(0, -3, 0)
	case "year":
		startDate = now.AddDate(-1, 0, 0)
	default:
		startDate = now.AddDate(0, -1, 0)
	}

	var billings []models.Billing
	db.Model(&models.Billing{}).
		Preload("Registration.Patient").
		Preload("Visit").
		Where("billings.created_at >= ?", startDate).
		Where("billings.status IN ?", []string{"paid", "partial"}).
		Where("billings.payment_method = ?", "bpjs").
		Order("(COALESCE(bpjs_claim_amount, final_amount) - final_amount) ASC").
		Limit(limit).
		Find(&billings)

	var lossCases []TopLossCase
	for _, b := range billings {
		claimAmount := b.BPJSClaimAmount
		if claimAmount == 0 {
			continue // Skip non-BPJS cases
		}

		diff := claimAmount - b.FinalAmount
		if diff >= 0 {
			continue // Skip surplus cases
		}

		var diffPercent float64
		if b.FinalAmount > 0 {
			diffPercent = (diff / b.FinalAmount) * 100
		}

		patientName := ""
		mrn := ""
		if b.Registration != nil && b.Registration.Patient != nil {
			patientName = b.Registration.Patient.NamaLengkap
			mrn = b.Registration.Patient.NoRM
		}

		visitType := ""
		diagnosis := ""
		var los int
		var dischargeTime *time.Time
		if b.Visit != nil {
			visitType = b.Visit.VisitType
			diagnosis = b.Visit.Diagnosis
			los = b.Visit.InpatientDays
			dischargeTime = b.Visit.DischargeTime
		}

		// Determine loss reason
		lossReason := "Biaya melebihi tarif INA-CBG"
		if los > 7 {
			lossReason = "LOS terlalu panjang"
		}

		lossCases = append(lossCases, TopLossCase{
			CostCaseDetail: CostCaseDetail{
				ID:                b.ID,
				BillingNumber:     b.BillingNumber,
				PatientName:       patientName,
				MRN:               mrn,
				VisitType:         visitType,
				Diagnosis:         diagnosis,
				InaCBGCode:        b.InaCBGCode,
				InaCBGTariff:      claimAmount,
				ActualCost:        b.FinalAmount,
				Difference:        math.Round(diff*100) / 100,
				DifferencePercent: math.Round(diffPercent*100) / 100,
				LOS:               los,
				PaymentMethod:     b.PaymentMethod,
				Status:            b.Status,
				DischargeDate:     dischargeTime,
			},
			LossReason: lossReason,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    lossCases,
	})
}

// GetCostByCategory returns cost breakdown by category
func GetCostByCategory(c *gin.Context) {
	db := database.DB

	period := c.DefaultQuery("period", "month")

	var startDate time.Time
	now := time.Now()

	switch period {
	case "week":
		startDate = now.AddDate(0, 0, -7)
	case "month":
		startDate = now.AddDate(0, -1, 0)
	case "quarter":
		startDate = now.AddDate(0, -3, 0)
	case "year":
		startDate = now.AddDate(-1, 0, 0)
	default:
		startDate = now.AddDate(0, -1, 0)
	}

	// Get cost breakdown by item type
	var categories []struct {
		ItemType string
		Total    float64
	}
	db.Model(&models.BillingItem{}).
		Joins("JOIN billings ON billings.id = billing_items.billing_id").
		Where("billings.created_at >= ?", startDate).
		Where("billings.status IN ?", []string{"paid", "partial"}).
		Group("billing_items.item_type").
		Select("billing_items.item_type as item_type, COALESCE(SUM(billing_items.subtotal), 0) as total").
		Scan(&categories)

	// Calculate total and percentages
	var grandTotal float64
	for _, cat := range categories {
		grandTotal += cat.Total
	}

	categoryLabels := map[string]string{
		"medicine":     "Obat-obatan",
		"procedure":    "Tindakan",
		"service":      "Jasa Pelayanan",
		"consultation": "Konsultasi",
		"room":         "Kamar/Akomodasi",
		"lab":          "Laboratorium",
		"radiology":    "Radiologi",
		"equipment":    "Alat Kesehatan",
		"other":        "Lainnya",
	}

	var result []CostByCategory
	for _, cat := range categories {
		var percentage float64
		if grandTotal > 0 {
			percentage = (cat.Total / grandTotal) * 100
		}
		label := categoryLabels[cat.ItemType]
		if label == "" {
			label = cat.ItemType
		}
		result = append(result, CostByCategory{
			Category:   label,
			Amount:     math.Round(cat.Total*100) / 100,
			Percentage: math.Round(percentage*100) / 100,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
		"total":   math.Round(grandTotal*100) / 100,
	})
}

// GetPendingClaims returns pending claims information
func GetPendingClaims(c *gin.Context) {
	db := database.DB
	now := time.Now()

	// Get pending BPJS billings
	var pendingBillings []models.Billing
	db.Model(&models.Billing{}).
		Where("payment_method = ?", "bpjs").
		Where("status IN ?", []string{"pending", "partial"}).
		Order("created_at ASC").
		Find(&pendingBillings)

	var totalPendingClaims int64
	var totalPendingAmount float64
	var oldestPendingDays int

	// Age groups
	ageGroups := map[string]*ClaimAgeGroup{
		"0-7":   {AgeRange: "0-7 hari", Count: 0, Amount: 0},
		"8-14":  {AgeRange: "8-14 hari", Count: 0, Amount: 0},
		"15-30": {AgeRange: "15-30 hari", Count: 0, Amount: 0},
		"31+":   {AgeRange: ">30 hari", Count: 0, Amount: 0},
	}

	for _, b := range pendingBillings {
		totalPendingClaims++
		totalPendingAmount += b.RemainingAmount

		daysPending := int(now.Sub(b.CreatedAt).Hours() / 24)
		if daysPending > oldestPendingDays {
			oldestPendingDays = daysPending
		}

		// Categorize by age
		if daysPending <= 7 {
			ageGroups["0-7"].Count++
			ageGroups["0-7"].Amount += b.RemainingAmount
		} else if daysPending <= 14 {
			ageGroups["8-14"].Count++
			ageGroups["8-14"].Amount += b.RemainingAmount
		} else if daysPending <= 30 {
			ageGroups["15-30"].Count++
			ageGroups["15-30"].Amount += b.RemainingAmount
		} else {
			ageGroups["31+"].Count++
			ageGroups["31+"].Amount += b.RemainingAmount
		}
	}

	var byAgeGroup []ClaimAgeGroup
	for _, order := range []string{"0-7", "8-14", "15-30", "31+"} {
		ag := ageGroups[order]
		ag.Amount = math.Round(ag.Amount*100) / 100
		byAgeGroup = append(byAgeGroup, *ag)
	}

	summary := PendingClaimSummary{
		TotalPendingClaims: totalPendingClaims,
		TotalPendingAmount: math.Round(totalPendingAmount*100) / 100,
		OldestPendingDays:  oldestPendingDays,
		ByAgeGroup:         byAgeGroup,
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    summary,
	})
}

// GetQualityTrends returns quality indicators over time
func GetQualityTrends(c *gin.Context) {
	db := database.DB

	period := c.DefaultQuery("period", "year") // Show monthly trends for a year

	var startDate time.Time
	now := time.Now()

	switch period {
	case "quarter":
		startDate = now.AddDate(0, -3, 0)
	case "year":
		startDate = now.AddDate(-1, 0, 0)
	default:
		startDate = now.AddDate(-1, 0, 0)
	}

	// Get total beds (assume relatively constant)
	var totalBeds int64
	db.Model(&models.Bed{}).Where("status != ?", "inactive").Count(&totalBeds)

	// Group by month
	type MonthlyData struct {
		Month            string
		TotalPatientDays int64
		TotalDischarges  int64
		TotalDeaths      int64
	}

	var monthlyStats []struct {
		YearMonth        string
		TotalPatientDays int64
		TotalDischarges  int64
	}

	db.Model(&models.Visit{}).
		Where("visit_type = ?", "inpatient").
		Where("admission_time >= ?", startDate).
		Select("TO_CHAR(admission_time, 'YYYY-MM') as year_month, " +
			"COALESCE(SUM(inpatient_days), 0) as total_patient_days, " +
			"COUNT(CASE WHEN discharge_time IS NOT NULL THEN 1 END) as total_discharges").
		Group("TO_CHAR(admission_time, 'YYYY-MM')").
		Order("year_month ASC").
		Scan(&monthlyStats)

	// Calculate BOR trend
	type TrendPoint struct {
		Period string  `json:"period"`
		BOR    float64 `json:"bor"`
		ALOS   float64 `json:"alos"`
	}

	var trends []TrendPoint
	for _, stat := range monthlyStats {
		daysInMonth := 30.0 // Approximate
		bor := 0.0
		alos := 0.0

		if totalBeds > 0 && daysInMonth > 0 {
			bor = (float64(stat.TotalPatientDays) / (float64(totalBeds) * daysInMonth)) * 100
		}
		if stat.TotalDischarges > 0 {
			alos = float64(stat.TotalPatientDays) / float64(stat.TotalDischarges)
		}

		trends = append(trends, TrendPoint{
			Period: stat.YearMonth,
			BOR:    math.Round(bor*100) / 100,
			ALOS:   math.Round(alos*100) / 100,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    trends,
	})
}
