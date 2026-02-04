package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"time"

	"github.com/gin-gonic/gin"
)

// DashboardStats represents the main dashboard statistics
type DashboardStats struct {
	// Patient Statistics
	TotalPatients    int64 `json:"total_patients"`
	NewPatientsToday int64 `json:"new_patients_today"`
	NewPatientsWeek  int64 `json:"new_patients_week"`
	NewPatientsMonth int64 `json:"new_patients_month"`
	ActivePatients   int64 `json:"active_patients"`

	// Registration/Visit Statistics
	TotalRegistrations int64 `json:"total_registrations"`
	RegistrationsToday int64 `json:"registrations_today"`
	RegistrationsWeek  int64 `json:"registrations_week"`
	RegistrationsMonth int64 `json:"registrations_month"`
	OutpatientToday    int64 `json:"outpatient_today"`
	InpatientToday     int64 `json:"inpatient_today"`
	EmergencyToday     int64 `json:"emergency_today"`

	// Visit Statistics
	TotalVisits      int64 `json:"total_visits"`
	VisitsToday      int64 `json:"visits_today"`
	VisitsWeek       int64 `json:"visits_week"`
	VisitsMonth      int64 `json:"visits_month"`
	VisitsInProgress int64 `json:"visits_in_progress"`
	VisitsWaiting    int64 `json:"visits_waiting"`
	VisitsCompleted  int64 `json:"visits_completed_today"`

	// Billing Statistics
	TotalRevenue        float64 `json:"total_revenue"`
	RevenueToday        float64 `json:"revenue_today"`
	RevenueWeek         float64 `json:"revenue_week"`
	RevenueMonth        float64 `json:"revenue_month"`
	PendingBillings     int64   `json:"pending_billings"`
	PaidBillings        int64   `json:"paid_billings_today"`
	TotalBillingAmount  float64 `json:"total_billing_amount"`
	UnpaidBillingAmount float64 `json:"unpaid_billing_amount"`

	// Bed/Inpatient Statistics
	TotalBeds         int64   `json:"total_beds"`
	OccupiedBeds      int64   `json:"occupied_beds"`
	AvailableBeds     int64   `json:"available_beds"`
	BedOccupancyRate  float64 `json:"bed_occupancy_rate"`
	CurrentInpatients int64   `json:"current_inpatients"`

	// Medicine Order Statistics
	TotalMedicineOrders     int64 `json:"total_medicine_orders"`
	MedicineOrdersToday     int64 `json:"medicine_orders_today"`
	PendingMedicineOrders   int64 `json:"pending_medicine_orders"`
	CompletedMedicineOrders int64 `json:"completed_medicine_orders_today"`

	// Procedure Order Statistics
	TotalProcedureOrders   int64 `json:"total_procedure_orders"`
	ProcedureOrdersToday   int64 `json:"procedure_orders_today"`
	PendingProcedureOrders int64 `json:"pending_procedure_orders"`
	LabOrdersToday         int64 `json:"lab_orders_today"`
	RadiologyOrdersToday   int64 `json:"radiology_orders_today"`

	// Employee Statistics
	TotalEmployees  int64 `json:"total_employees"`
	TotalDoctors    int64 `json:"total_doctors"`
	TotalNurses     int64 `json:"total_nurses"`
	ActiveEmployees int64 `json:"active_employees"`

	// Room Statistics
	TotalRooms      int64 `json:"total_rooms"`
	ActiveRooms     int64 `json:"active_rooms"`
	PoliklinikRooms int64 `json:"poliklinik_rooms"`
	InpatientRooms  int64 `json:"inpatient_rooms"`

	// Inventory Statistics
	TotalInventoryItems int64 `json:"total_inventory_items"`
	LowStockItems       int64 `json:"low_stock_items"`

	// Medicine Statistics
	TotalMedicines    int64 `json:"total_medicines"`
	LowStockMedicines int64 `json:"low_stock_medicines"`
}

// DashboardTrend represents trend data for charts
type DashboardTrend struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
	Count int64   `json:"count"`
}

// DashboardCharts represents chart data
type DashboardCharts struct {
	// Registration Trends (last 7 days or 30 days)
	RegistrationTrends  []DashboardTrend `json:"registration_trends"`
	RevenueTrends       []DashboardTrend `json:"revenue_trends"`
	VisitTypeTrends     []DashboardTrend `json:"visit_type_trends"`
	PaymentMethodTrends []DashboardTrend `json:"payment_method_trends"`

	// Top Items
	TopRooms      []RoomVisitCount   `json:"top_rooms"`
	TopDoctors    []DoctorVisitCount `json:"top_doctors"`
	TopProcedures []ProcedureCount   `json:"top_procedures"`
	TopMedicines  []MedicineCount    `json:"top_medicines"`
	TopDiagnoses  []DiagnosisCount   `json:"top_diagnoses"`
}

// Supporting types for charts
type RoomVisitCount struct {
	RoomID   uint   `json:"room_id"`
	RoomName string `json:"room_name"`
	RoomCode string `json:"room_code"`
	Count    int64  `json:"count"`
}

type DoctorVisitCount struct {
	DoctorID   uint   `json:"doctor_id"`
	DoctorName string `json:"doctor_name"`
	Count      int64  `json:"count"`
}

type ProcedureCount struct {
	ProcedureID   uint   `json:"procedure_id"`
	ProcedureName string `json:"procedure_name"`
	ProcedureCode string `json:"procedure_code"`
	Count         int64  `json:"count"`
}

type MedicineCount struct {
	MedicineID   uint   `json:"medicine_id"`
	MedicineName string `json:"medicine_name"`
	MedicineCode string `json:"medicine_code"`
	Count        int64  `json:"count"`
}

type DiagnosisCount struct {
	Diagnosis string `json:"diagnosis"`
	Count     int64  `json:"count"`
}

// GetDashboardStats returns main dashboard statistics
// @Summary Get dashboard statistics
// @Description Get comprehensive dashboard statistics for the hospital
// @Tags Dashboard
// @Produce json
// @Param period query string false "Period filter: today, week, month, all" default(today)
// @Success 200 {object} DashboardStats
// @Router /api/dashboard/stats [get]
func GetDashboardStats(c *gin.Context) {
	db := database.DB
	stats := DashboardStats{}

	// Get time boundaries
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfWeek := startOfDay.AddDate(0, 0, -int(now.Weekday()))
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	// ==================== PATIENT STATISTICS ====================
	db.Model(&models.Patient{}).Count(&stats.TotalPatients)
	db.Model(&models.Patient{}).Where("created_at >= ?", startOfDay).Count(&stats.NewPatientsToday)
	db.Model(&models.Patient{}).Where("created_at >= ?", startOfWeek).Count(&stats.NewPatientsWeek)
	db.Model(&models.Patient{}).Where("created_at >= ?", startOfMonth).Count(&stats.NewPatientsMonth)
	db.Model(&models.Patient{}).Where("status = ?", models.PatientStatusActive).Count(&stats.ActivePatients)

	// ==================== REGISTRATION STATISTICS ====================
	db.Model(&models.Registration{}).Count(&stats.TotalRegistrations)
	db.Model(&models.Registration{}).Where("registration_date >= ?", startOfDay).Count(&stats.RegistrationsToday)
	db.Model(&models.Registration{}).Where("registration_date >= ?", startOfWeek).Count(&stats.RegistrationsWeek)
	db.Model(&models.Registration{}).Where("registration_date >= ?", startOfMonth).Count(&stats.RegistrationsMonth)

	// Outpatient, Inpatient, Emergency today
	db.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_type = ?", startOfDay, "outpatient").
		Count(&stats.OutpatientToday)
	db.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_type = ?", startOfDay, "inpatient").
		Count(&stats.InpatientToday)
	db.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_type = ?", startOfDay, "emergency").
		Count(&stats.EmergencyToday)

	// ==================== VISIT STATISTICS ====================
	db.Model(&models.Visit{}).Count(&stats.TotalVisits)
	db.Model(&models.Visit{}).Where("created_at >= ?", startOfDay).Count(&stats.VisitsToday)
	db.Model(&models.Visit{}).Where("created_at >= ?", startOfWeek).Count(&stats.VisitsWeek)
	db.Model(&models.Visit{}).Where("created_at >= ?", startOfMonth).Count(&stats.VisitsMonth)
	db.Model(&models.Visit{}).Where("status = ?", models.VisitStatusInProgress).Count(&stats.VisitsInProgress)
	db.Model(&models.Visit{}).Where("status = ?", models.VisitStatusWaiting).Count(&stats.VisitsWaiting)
	db.Model(&models.Visit{}).
		Where("status = ? AND end_time >= ?", models.VisitStatusCompleted, startOfDay).
		Count(&stats.VisitsCompleted)

	// ==================== BILLING STATISTICS ====================
	// Total Revenue (all paid billings)
	db.Model(&models.Billing{}).
		Where("status = ?", models.BillingStatusPaid).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&stats.TotalRevenue)

	// Revenue Today
	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ?", models.BillingStatusPaid, startOfDay).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&stats.RevenueToday)

	// Revenue This Week
	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ?", models.BillingStatusPaid, startOfWeek).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&stats.RevenueWeek)

	// Revenue This Month
	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ?", models.BillingStatusPaid, startOfMonth).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&stats.RevenueMonth)

	// Pending and Paid Billings
	db.Model(&models.Billing{}).
		Where("status IN ?", []string{models.BillingStatusPending, models.BillingStatusPartial}).
		Count(&stats.PendingBillings)

	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ?", models.BillingStatusPaid, startOfDay).
		Count(&stats.PaidBillings)

	// Total and Unpaid Billing Amounts
	db.Model(&models.Billing{}).
		Where("status != ?", models.BillingStatusCancelled).
		Select("COALESCE(SUM(final_amount), 0)").
		Scan(&stats.TotalBillingAmount)

	db.Model(&models.Billing{}).
		Where("status IN ?", []string{models.BillingStatusPending, models.BillingStatusPartial}).
		Select("COALESCE(SUM(remaining_amount), 0)").
		Scan(&stats.UnpaidBillingAmount)

	// ==================== BED/INPATIENT STATISTICS ====================
	db.Model(&models.Bed{}).Count(&stats.TotalBeds)
	db.Model(&models.Bed{}).Where("status = ?", "occupied").Count(&stats.OccupiedBeds)
	db.Model(&models.Bed{}).Where("status = ?", "available").Count(&stats.AvailableBeds)

	if stats.TotalBeds > 0 {
		stats.BedOccupancyRate = float64(stats.OccupiedBeds) / float64(stats.TotalBeds) * 100
	}

	// Current Inpatients (visits with inpatient type and in_progress status)
	db.Model(&models.Visit{}).
		Where("visit_type = ? AND status = ?", models.VisitTypeInpatient, models.VisitStatusInProgress).
		Count(&stats.CurrentInpatients)

	// ==================== MEDICINE ORDER STATISTICS ====================
	db.Model(&models.MedicineOrder{}).Count(&stats.TotalMedicineOrders)
	db.Model(&models.MedicineOrder{}).Where("created_at >= ?", startOfDay).Count(&stats.MedicineOrdersToday)
	db.Model(&models.MedicineOrder{}).
		Where("status IN ?", []string{models.OrderStatusPending, models.OrderStatusReviewed, models.OrderStatusPreparing}).
		Count(&stats.PendingMedicineOrders)
	db.Model(&models.MedicineOrder{}).
		Where("status = ? AND delivered_at >= ?", models.OrderStatusDelivered, startOfDay).
		Count(&stats.CompletedMedicineOrders)

	// ==================== PROCEDURE ORDER STATISTICS ====================
	db.Model(&models.ProcedureOrder{}).Count(&stats.TotalProcedureOrders)
	db.Model(&models.ProcedureOrder{}).Where("created_at >= ?", startOfDay).Count(&stats.ProcedureOrdersToday)
	db.Model(&models.ProcedureOrder{}).
		Where("status = ?", models.ProcedureOrderStatusPending).
		Count(&stats.PendingProcedureOrders)
	db.Model(&models.ProcedureOrder{}).
		Where("order_type = ? AND created_at >= ?", models.ProcedureOrderTypeLaboratory, startOfDay).
		Count(&stats.LabOrdersToday)
	db.Model(&models.ProcedureOrder{}).
		Where("order_type = ? AND created_at >= ?", models.ProcedureOrderTypeRadiology, startOfDay).
		Count(&stats.RadiologyOrdersToday)

	// ==================== EMPLOYEE STATISTICS ====================
	db.Model(&models.Employee{}).Count(&stats.TotalEmployees)
	db.Model(&models.Employee{}).Where("tipe_karyawan = ?", models.EmployeeTypeDokter).Count(&stats.TotalDoctors)
	db.Model(&models.Employee{}).Where("tipe_karyawan = ?", models.EmployeeTypePerawat).Count(&stats.TotalNurses)
	db.Model(&models.Employee{}).Where("tanggal_keluar IS NULL").Count(&stats.ActiveEmployees)

	// ==================== ROOM STATISTICS ====================
	db.Model(&models.Room{}).Count(&stats.TotalRooms)
	db.Model(&models.Room{}).Where("is_active = ?", true).Count(&stats.ActiveRooms)
	db.Model(&models.Room{}).Where("room_type = ?", "poliklinik").Count(&stats.PoliklinikRooms)
	db.Model(&models.Room{}).Where("room_type = ?", "rawat_inap").Count(&stats.InpatientRooms)

	// ==================== INVENTORY STATISTICS ====================
	db.Model(&models.Inventory{}).Where("is_active = ?", true).Count(&stats.TotalInventoryItems)
	// Low stock items - this may need RoomInventory aggregation
	db.Model(&models.Inventory{}).
		Where("is_active = ? AND min_stock > 0", true).
		Count(&stats.LowStockItems)

	// ==================== MEDICINE STATISTICS ====================
	db.Model(&models.Medicine{}).Where("is_active = ?", true).Count(&stats.TotalMedicines)
	// Low stock medicines - similar to inventory
	db.Model(&models.Medicine{}).
		Where("is_active = ? AND min_stock > 0", true).
		Count(&stats.LowStockMedicines)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetDashboardCharts returns chart data for the dashboard
// @Summary Get dashboard chart data
// @Description Get trend data and top items for dashboard charts
// @Tags Dashboard
// @Produce json
// @Param period query string false "Period filter: week, month" default(week)
// @Success 200 {object} DashboardCharts
// @Router /api/dashboard/charts [get]
func GetDashboardCharts(c *gin.Context) {
	db := database.DB
	period := c.DefaultQuery("period", "week")

	var startDate time.Time
	now := time.Now()

	switch period {
	case "month":
		startDate = now.AddDate(0, -1, 0)
	case "year":
		startDate = now.AddDate(-1, 0, 0)
	default: // week
		startDate = now.AddDate(0, 0, -7)
	}

	charts := DashboardCharts{
		RegistrationTrends:  []DashboardTrend{},
		RevenueTrends:       []DashboardTrend{},
		VisitTypeTrends:     []DashboardTrend{},
		PaymentMethodTrends: []DashboardTrend{},
		TopRooms:            []RoomVisitCount{},
		TopDoctors:          []DoctorVisitCount{},
		TopProcedures:       []ProcedureCount{},
		TopMedicines:        []MedicineCount{},
		TopDiagnoses:        []DiagnosisCount{},
	}

	// ==================== REGISTRATION TRENDS ====================
	var regTrends []struct {
		Date  string
		Count int64
	}

	db.Model(&models.Registration{}).
		Select("DATE(registration_date) as date, COUNT(*) as count").
		Where("registration_date >= ?", startDate).
		Group("DATE(registration_date)").
		Order("date").
		Scan(&regTrends)

	for _, trend := range regTrends {
		charts.RegistrationTrends = append(charts.RegistrationTrends, DashboardTrend{
			Label: trend.Date,
			Count: trend.Count,
		})
	}

	// ==================== REVENUE TRENDS ====================
	var revTrends []struct {
		Date  string
		Value float64
	}

	db.Model(&models.Billing{}).
		Select("DATE(paid_at) as date, COALESCE(SUM(paid_amount), 0) as value").
		Where("status = ? AND paid_at >= ?", models.BillingStatusPaid, startDate).
		Group("DATE(paid_at)").
		Order("date").
		Scan(&revTrends)

	for _, trend := range revTrends {
		charts.RevenueTrends = append(charts.RevenueTrends, DashboardTrend{
			Label: trend.Date,
			Value: trend.Value,
		})
	}

	// ==================== VISIT TYPE TRENDS ====================
	var visitTypeTrends []struct {
		VisitType string
		Count     int64
	}

	db.Model(&models.Visit{}).
		Select("visit_type, COUNT(*) as count").
		Where("created_at >= ?", startDate).
		Group("visit_type").
		Order("count DESC").
		Scan(&visitTypeTrends)

	for _, trend := range visitTypeTrends {
		charts.VisitTypeTrends = append(charts.VisitTypeTrends, DashboardTrend{
			Label: trend.VisitType,
			Count: trend.Count,
		})
	}

	// ==================== PAYMENT METHOD TRENDS ====================
	var paymentTrends []struct {
		PaymentMethod string
		Count         int64
		Value         float64
	}

	db.Model(&models.Registration{}).
		Select("payment_method, COUNT(*) as count").
		Where("registration_date >= ?", startDate).
		Group("payment_method").
		Order("count DESC").
		Scan(&paymentTrends)

	for _, trend := range paymentTrends {
		charts.PaymentMethodTrends = append(charts.PaymentMethodTrends, DashboardTrend{
			Label: trend.PaymentMethod,
			Count: trend.Count,
			Value: trend.Value,
		})
	}

	// ==================== TOP ROOMS BY VISITS ====================
	var topRooms []struct {
		RoomID   uint
		RoomName string
		RoomCode string
		Count    int64
	}

	db.Model(&models.Visit{}).
		Select("visits.room_id, rooms.name as room_name, rooms.code as room_code, COUNT(*) as count").
		Joins("LEFT JOIN rooms ON rooms.id = visits.room_id").
		Where("visits.created_at >= ?", startDate).
		Group("visits.room_id, rooms.name, rooms.code").
		Order("count DESC").
		Limit(10).
		Scan(&topRooms)

	for _, room := range topRooms {
		charts.TopRooms = append(charts.TopRooms, RoomVisitCount{
			RoomID:   room.RoomID,
			RoomName: room.RoomName,
			RoomCode: room.RoomCode,
			Count:    room.Count,
		})
	}

	// ==================== TOP DOCTORS BY VISITS ====================
	var topDoctors []struct {
		DoctorID   uint
		DoctorName string
		Count      int64
	}

	db.Model(&models.Visit{}).
		Select("visits.doctor_id, employees.nama_lengkap as doctor_name, COUNT(*) as count").
		Joins("LEFT JOIN employees ON employees.id = visits.doctor_id").
		Where("visits.created_at >= ? AND visits.doctor_id IS NOT NULL", startDate).
		Group("visits.doctor_id, employees.nama_lengkap").
		Order("count DESC").
		Limit(10).
		Scan(&topDoctors)

	for _, doc := range topDoctors {
		charts.TopDoctors = append(charts.TopDoctors, DoctorVisitCount{
			DoctorID:   doc.DoctorID,
			DoctorName: doc.DoctorName,
			Count:      doc.Count,
		})
	}

	// ==================== TOP PROCEDURES ====================
	var topProcs []struct {
		ProcedureID   uint
		ProcedureName string
		ProcedureCode string
		Count         int64
	}

	db.Model(&models.ProcedureOrderItem{}).
		Select("procedure_order_items.procedure_id, procedures.name as procedure_name, procedures.code as procedure_code, COUNT(*) as count").
		Joins("LEFT JOIN procedures ON procedures.id = procedure_order_items.procedure_id").
		Joins("LEFT JOIN procedure_orders ON procedure_orders.id = procedure_order_items.procedure_order_id").
		Where("procedure_orders.created_at >= ?", startDate).
		Group("procedure_order_items.procedure_id, procedures.name, procedures.code").
		Order("count DESC").
		Limit(10).
		Scan(&topProcs)

	for _, proc := range topProcs {
		charts.TopProcedures = append(charts.TopProcedures, ProcedureCount{
			ProcedureID:   proc.ProcedureID,
			ProcedureName: proc.ProcedureName,
			ProcedureCode: proc.ProcedureCode,
			Count:         proc.Count,
		})
	}

	// ==================== TOP MEDICINES ====================
	var topMeds []struct {
		MedicineID   uint
		MedicineName string
		MedicineCode string
		Count        int64
	}

	db.Model(&models.MedicineOrderItem{}).
		Select("medicine_order_items.medicine_id, medicines.name as medicine_name, medicines.code as medicine_code, SUM(medicine_order_items.quantity) as count").
		Joins("LEFT JOIN medicines ON medicines.id = medicine_order_items.medicine_id").
		Joins("LEFT JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.created_at >= ?", startDate).
		Group("medicine_order_items.medicine_id, medicines.name, medicines.code").
		Order("count DESC").
		Limit(10).
		Scan(&topMeds)

	for _, med := range topMeds {
		charts.TopMedicines = append(charts.TopMedicines, MedicineCount{
			MedicineID:   med.MedicineID,
			MedicineName: med.MedicineName,
			MedicineCode: med.MedicineCode,
			Count:        med.Count,
		})
	}

	// ==================== TOP DIAGNOSES ====================
	var topDiag []struct {
		Diagnosis string
		Count     int64
	}

	db.Model(&models.Visit{}).
		Select("diagnosis, COUNT(*) as count").
		Where("created_at >= ? AND diagnosis IS NOT NULL AND diagnosis != ''", startDate).
		Group("diagnosis").
		Order("count DESC").
		Limit(10).
		Scan(&topDiag)

	for _, diag := range topDiag {
		charts.TopDiagnoses = append(charts.TopDiagnoses, DiagnosisCount{
			Diagnosis: diag.Diagnosis,
			Count:     diag.Count,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    charts,
	})
}

// GetDashboardSummary returns a quick summary for dashboard widgets
// @Summary Get dashboard summary
// @Description Get quick summary with daily/weekly/monthly comparisons
// @Tags Dashboard
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/dashboard/summary [get]
func GetDashboardSummary(c *gin.Context) {
	db := database.DB
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfWeek := startOfDay.AddDate(0, 0, -int(now.Weekday()))
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	// Yesterday for comparison
	yesterday := startOfDay.AddDate(0, 0, -1)
	lastWeek := startOfWeek.AddDate(0, 0, -7)
	lastMonth := startOfMonth.AddDate(0, -1, 0)

	summary := make(map[string]interface{})

	// Today's Summary
	var todaySummary struct {
		Registrations int64
		Visits        int64
		Revenue       float64
		NewPatients   int64
	}

	db.Model(&models.Registration{}).Where("registration_date >= ?", startOfDay).Count(&todaySummary.Registrations)
	db.Model(&models.Visit{}).Where("created_at >= ?", startOfDay).Count(&todaySummary.Visits)
	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ?", models.BillingStatusPaid, startOfDay).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&todaySummary.Revenue)
	db.Model(&models.Patient{}).Where("created_at >= ?", startOfDay).Count(&todaySummary.NewPatients)

	// Yesterday's Summary (for comparison)
	var yesterdaySummary struct {
		Registrations int64
		Visits        int64
		Revenue       float64
	}

	db.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_date < ?", yesterday, startOfDay).
		Count(&yesterdaySummary.Registrations)
	db.Model(&models.Visit{}).
		Where("created_at >= ? AND created_at < ?", yesterday, startOfDay).
		Count(&yesterdaySummary.Visits)
	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ? AND paid_at < ?", models.BillingStatusPaid, yesterday, startOfDay).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&yesterdaySummary.Revenue)

	summary["today"] = gin.H{
		"registrations":        todaySummary.Registrations,
		"visits":               todaySummary.Visits,
		"revenue":              todaySummary.Revenue,
		"new_patients":         todaySummary.NewPatients,
		"registrations_change": calculatePercentageChange(float64(yesterdaySummary.Registrations), float64(todaySummary.Registrations)),
		"visits_change":        calculatePercentageChange(float64(yesterdaySummary.Visits), float64(todaySummary.Visits)),
		"revenue_change":       calculatePercentageChange(yesterdaySummary.Revenue, todaySummary.Revenue),
	}

	// This Week's Summary
	var weekSummary struct {
		Registrations int64
		Visits        int64
		Revenue       float64
	}

	db.Model(&models.Registration{}).Where("registration_date >= ?", startOfWeek).Count(&weekSummary.Registrations)
	db.Model(&models.Visit{}).Where("created_at >= ?", startOfWeek).Count(&weekSummary.Visits)
	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ?", models.BillingStatusPaid, startOfWeek).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&weekSummary.Revenue)

	// Last Week (for comparison)
	var lastWeekSummary struct {
		Registrations int64
		Revenue       float64
	}

	db.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_date < ?", lastWeek, startOfWeek).
		Count(&lastWeekSummary.Registrations)
	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ? AND paid_at < ?", models.BillingStatusPaid, lastWeek, startOfWeek).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&lastWeekSummary.Revenue)

	summary["week"] = gin.H{
		"registrations":        weekSummary.Registrations,
		"visits":               weekSummary.Visits,
		"revenue":              weekSummary.Revenue,
		"registrations_change": calculatePercentageChange(float64(lastWeekSummary.Registrations), float64(weekSummary.Registrations)),
		"revenue_change":       calculatePercentageChange(lastWeekSummary.Revenue, weekSummary.Revenue),
	}

	// This Month's Summary
	var monthSummary struct {
		Registrations int64
		Visits        int64
		Revenue       float64
	}

	db.Model(&models.Registration{}).Where("registration_date >= ?", startOfMonth).Count(&monthSummary.Registrations)
	db.Model(&models.Visit{}).Where("created_at >= ?", startOfMonth).Count(&monthSummary.Visits)
	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ?", models.BillingStatusPaid, startOfMonth).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&monthSummary.Revenue)

	// Last Month (for comparison)
	var lastMonthSummary struct {
		Registrations int64
		Revenue       float64
	}

	db.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_date < ?", lastMonth, startOfMonth).
		Count(&lastMonthSummary.Registrations)
	db.Model(&models.Billing{}).
		Where("status = ? AND paid_at >= ? AND paid_at < ?", models.BillingStatusPaid, lastMonth, startOfMonth).
		Select("COALESCE(SUM(paid_amount), 0)").
		Scan(&lastMonthSummary.Revenue)

	summary["month"] = gin.H{
		"registrations":        monthSummary.Registrations,
		"visits":               monthSummary.Visits,
		"revenue":              monthSummary.Revenue,
		"registrations_change": calculatePercentageChange(float64(lastMonthSummary.Registrations), float64(monthSummary.Registrations)),
		"revenue_change":       calculatePercentageChange(lastMonthSummary.Revenue, monthSummary.Revenue),
	}

	// Queue Status (current)
	var queueStatus struct {
		Waiting    int64
		InProgress int64
		Completed  int64
	}

	db.Model(&models.Visit{}).
		Where("status = ? AND DATE(created_at) = DATE(?)", models.VisitStatusWaiting, now).
		Count(&queueStatus.Waiting)
	db.Model(&models.Visit{}).
		Where("status = ? AND DATE(created_at) = DATE(?)", models.VisitStatusInProgress, now).
		Count(&queueStatus.InProgress)
	db.Model(&models.Visit{}).
		Where("status = ? AND DATE(end_time) = DATE(?)", models.VisitStatusCompleted, now).
		Count(&queueStatus.Completed)

	summary["queue_status"] = gin.H{
		"waiting":     queueStatus.Waiting,
		"in_progress": queueStatus.InProgress,
		"completed":   queueStatus.Completed,
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    summary,
	})
}

// calculatePercentageChange calculates the percentage change between two values
func calculatePercentageChange(oldValue, newValue float64) float64 {
	if oldValue == 0 {
		if newValue > 0 {
			return 100
		}
		return 0
	}
	return ((newValue - oldValue) / oldValue) * 100
}

// GetRecentActivity returns recent activities for the dashboard
// @Summary Get recent activities
// @Description Get recent registrations, visits, and billing activities
// @Tags Dashboard
// @Produce json
// @Param limit query int false "Number of items to return" default(10)
// @Success 200 {object} map[string]interface{}
// @Router /api/dashboard/recent [get]
func GetRecentActivity(c *gin.Context) {
	db := database.DB
	limit := 10

	// Recent Registrations
	var recentRegistrations []models.Registration
	db.Preload("Patient").
		Preload("DestinationRoom").
		Preload("Doctor").
		Order("created_at DESC").
		Limit(limit).
		Find(&recentRegistrations)

	// Recent Visits
	var recentVisits []models.Visit
	db.Preload("Room").
		Preload("Doctor").
		Preload("Registration.Patient").
		Order("created_at DESC").
		Limit(limit).
		Find(&recentVisits)

	// Recent Payments
	var recentPayments []models.Billing
	db.Preload("Visit.Registration.Patient").
		Where("status = ?", models.BillingStatusPaid).
		Order("paid_at DESC").
		Limit(limit).
		Find(&recentPayments)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"recent_registrations": recentRegistrations,
			"recent_visits":        recentVisits,
			"recent_payments":      recentPayments,
		},
	})
}

// GetBedMonitoring returns bed monitoring data
// @Summary Get bed monitoring
// @Description Get bed occupancy status per room
// @Tags Dashboard
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/dashboard/bed-monitoring [get]
func GetBedMonitoring(c *gin.Context) {
	db := database.DB

	type RoomBedStatus struct {
		RoomID        uint    `json:"room_id"`
		RoomName      string  `json:"room_name"`
		RoomCode      string  `json:"room_code"`
		RoomClass     string  `json:"room_class"`
		TotalBeds     int64   `json:"total_beds"`
		OccupiedBeds  int64   `json:"occupied_beds"`
		AvailableBeds int64   `json:"available_beds"`
		OccupancyRate float64 `json:"occupancy_rate"`
	}

	var roomStats []RoomBedStatus

	// Get all inpatient rooms with bed counts
	db.Raw(`
		SELECT 
			r.id as room_id,
			r.name as room_name,
			r.code as room_code,
			r.room_class,
			COUNT(b.id) as total_beds,
			SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) as occupied_beds,
			SUM(CASE WHEN b.status = 'available' THEN 1 ELSE 0 END) as available_beds
		FROM rooms r
		LEFT JOIN room_units ru ON ru.room_id = r.id
		LEFT JOIN beds b ON b.room_unit_id = ru.id
		WHERE r.has_bed = true AND r.is_active = true AND r.deleted_at IS NULL
		GROUP BY r.id, r.name, r.code, r.room_class
		ORDER BY r.name
	`).Scan(&roomStats)

	// Calculate occupancy rate
	for i := range roomStats {
		if roomStats[i].TotalBeds > 0 {
			roomStats[i].OccupancyRate = float64(roomStats[i].OccupiedBeds) / float64(roomStats[i].TotalBeds) * 100
		}
	}

	// Summary
	var totalBeds, occupiedBeds, availableBeds int64
	for _, rs := range roomStats {
		totalBeds += rs.TotalBeds
		occupiedBeds += rs.OccupiedBeds
		availableBeds += rs.AvailableBeds
	}

	var overallOccupancyRate float64
	if totalBeds > 0 {
		overallOccupancyRate = float64(occupiedBeds) / float64(totalBeds) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"rooms": roomStats,
			"summary": gin.H{
				"total_beds":     totalBeds,
				"occupied_beds":  occupiedBeds,
				"available_beds": availableBeds,
				"occupancy_rate": overallOccupancyRate,
			},
		},
	})
}
