package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetBillings returns all billings with filters
func GetBillings(c *gin.Context) {
	var billings []models.Billing

	query := database.DB.Preload("Visit").
		Preload("Visit.Room").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("GeneratedBy").
		Preload("FinalizedBy")

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by payment_method
	if paymentMethod := c.Query("payment_method"); paymentMethod != "" {
		query = query.Where("payment_method = ?", paymentMethod)
	}

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("DATE(created_at) >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("DATE(created_at) <= ?", endDate)
	}

	// Filter by visit_id
	if visitID := c.Query("visit_id"); visitID != "" {
		query = query.Where("visit_id = ?", visitID)
	}

	// Filter by registration_id
	if registrationID := c.Query("registration_id"); registrationID != "" {
		query = query.Where("registration_id = ?", registrationID)
	}

	// Search by billing number or patient name
	if search := c.Query("search"); search != "" {
		query = query.Joins("LEFT JOIN registrations ON registrations.id = billings.registration_id").
			Joins("LEFT JOIN patients ON patients.id = registrations.patient_id").
			Where("billings.billing_number LIKE ? OR patients.nama_lengkap LIKE ?",
				"%"+search+"%", "%"+search+"%")
	}

	// Order by created_at descending
	query = query.Order("billings.created_at DESC")

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.Billing{}).Count(&total)

	if err := query.Offset(offset).Limit(limit).Find(&billings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": billings,
		"meta": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetBilling returns a single billing by ID
func GetBilling(c *gin.Context) {
	id := c.Param("id")
	var billing models.Billing

	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Items").
		Preload("Payments").
		Preload("Payments.Cashier").
		Preload("GeneratedBy").
		Preload("FinalizedBy").
		First(&billing, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing not found"})
		return
	}

	c.JSON(http.StatusOK, billing)
}

// GetBillingByVisit returns billing for a specific visit
// Since billing is now per-registration, it finds billing via visit's registration_id
func GetBillingByVisit(c *gin.Context) {
	visitID := c.Param("visit_id")

	// First, get the visit to find its registration_id
	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Find billing by registration_id (not visit_id)
	var billing models.Billing
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Items").
		Preload("Payments").
		Preload("Payments.Cashier").
		Preload("GeneratedBy").
		Preload("FinalizedBy").
		Where("registration_id = ?", visit.RegistrationID).
		First(&billing).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Billing not found for this registration"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get all visits for this registration
	var visits []models.Visit
	database.DB.
		Preload("Room").
		Preload("Doctor").
		Where("registration_id = ?", visit.RegistrationID).
		Order("created_at ASC").
		Find(&visits)

	// Return billing with all visits
	c.JSON(http.StatusOK, gin.H{
		"billing": billing,
		"visits":  visits,
	})
}

// GenerateBilling generates billing for a registration (all visits combined)
func GenerateBilling(c *gin.Context) {
	// Can accept either visit_id or registration_id
	visitID := c.Param("visit_id")

	// Get current user
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get visit to find registration
	var visit models.Visit
	if err := database.DB.
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Room").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Get registration
	registration := visit.Registration
	if registration == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registration not found for this visit"})
		return
	}

	// Check if registration is completed
	if registration.Status != "completed" && registration.Status != "discharged" {
		// Also check if main visit is completed
		if visit.Status != models.VisitStatusCompleted {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran atau kunjungan utama harus dalam status selesai untuk membuat billing"})
			return
		}
	}

	// Check if billing already exists for this registration
	var existingBilling models.Billing
	if err := database.DB.Where("registration_id = ?", registration.ID).First(&existingBilling).Error; err == nil {
		// Billing exists, regenerate items
		regenerateBillingItemsFromRegistration(c, &existingBilling, registration, userID.(uint))
		return
	}

	// Get all visits for this registration
	var allVisits []models.Visit
	if err := database.DB.
		Preload("Room").
		Where("registration_id = ?", registration.ID).
		Find(&allVisits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get visits: " + err.Error()})
		return
	}

	// Determine patient class based on payment method
	patientClass := determinePatientClass(registration)

	// Generate billing number
	billingNumber := generateBillingNumber()

	// Create new billing - now based on registration, not single visit
	now := time.Now()
	userIDUint := userID.(uint)
	billing := models.Billing{
		BillingNumber:  billingNumber,
		VisitID:        visit.ID, // Keep reference to main visit for backward compatibility
		RegistrationID: registration.ID,
		PatientClass:   patientClass,
		Status:         models.BillingStatusDraft,
		PaymentMethod:  registration.PaymentMethod,
		BPJSNumber:     registration.BPJSNumber,
		InsuranceName:  registration.InsuranceName,
		InsuranceNo:    registration.InsuranceNumber,
		GeneratedByID:  &userIDUint,
		GeneratedAt:    &now,
	}

	// Start transaction
	tx := database.DB.Begin()

	if err := tx.Create(&billing).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create billing: " + err.Error()})
		return
	}

	// Generate billing items from ALL visits in this registration
	if err := generateBillingItemsFromRegistration(tx, &billing, registration, allVisits); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate billing items: " + err.Error()})
		return
	}

	// Calculate totals
	var items []models.BillingItem
	if err := tx.Where("billing_id = ?", billing.ID).Find(&items).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get billing items: " + err.Error()})
		return
	}

	var totalAmount float64
	for _, item := range items {
		totalAmount += item.Subtotal
	}

	billing.TotalAmount = totalAmount
	billing.FinalAmount = totalAmount
	billing.RemainingAmount = totalAmount

	if err := tx.Save(&billing).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update billing: " + err.Error()})
		return
	}

	tx.Commit()

	// Reload billing with all relations
	database.DB.
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Items").
		Preload("GeneratedBy").
		First(&billing, billing.ID)

	c.JSON(http.StatusCreated, billing)
}

// regenerateBillingItemsFromRegistration regenerates items for existing billing based on registration
func regenerateBillingItemsFromRegistration(c *gin.Context, billing *models.Billing, registration *models.Registration, userID uint) {
	// Allow regenerate for draft and cancelled status
	if billing.Status != models.BillingStatusDraft && billing.Status != models.BillingStatusCancelled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Billing sudah difinalisasi atau lunas, tidak dapat di-regenerate"})
		return
	}

	// Get all visits for this registration
	var allVisits []models.Visit
	if err := database.DB.
		Preload("Room").
		Where("registration_id = ?", registration.ID).
		Find(&allVisits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get visits: " + err.Error()})
		return
	}

	tx := database.DB.Begin()

	// Delete existing items
	if err := tx.Where("billing_id = ?", billing.ID).Delete(&models.BillingItem{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete existing items: " + err.Error()})
		return
	}

	// Regenerate items from all visits
	if err := generateBillingItemsFromRegistration(tx, billing, registration, allVisits); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to regenerate billing items: " + err.Error()})
		return
	}

	// Recalculate totals
	var items []models.BillingItem
	if err := tx.Where("billing_id = ?", billing.ID).Find(&items).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get billing items: " + err.Error()})
		return
	}

	var totalAmount float64
	for _, item := range items {
		totalAmount += item.Subtotal
	}

	now := time.Now()
	billing.TotalAmount = totalAmount
	billing.FinalAmount = totalAmount - billing.DiscountAmount + billing.AdjustAmount
	billing.RemainingAmount = billing.FinalAmount - billing.PaidAmount
	billing.GeneratedByID = &userID
	billing.GeneratedAt = &now
	// Reset status to draft if it was cancelled
	if billing.Status == models.BillingStatusCancelled {
		billing.Status = models.BillingStatusDraft
	}

	if err := tx.Save(billing).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update billing: " + err.Error()})
		return
	}

	tx.Commit()

	// Reload billing with all relations
	database.DB.
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Items").
		Preload("GeneratedBy").
		First(billing, billing.ID)

	c.JSON(http.StatusOK, billing)
}

// generateBillingItemsFromRegistration creates billing items from all visits in a registration
// Rules:
// 1. Rawat Jalan & UGD: Only Administrasi fee as registration (1x)
// 2. Rawat Inap: Administrasi (1x at registration) + Daily charges (Akomodasi + Makan + Perawatan + Lainnya)
// 3. Orders (Lab/Radiology): NO room charges, only procedure fees
func generateBillingItemsFromRegistration(tx *gorm.DB, billing *models.Billing, registration *models.Registration, visits []models.Visit) error {
	fmt.Printf("[BILLING] Generating billing items for registration %d with %d visits\n", registration.ID, len(visits))

	// Separate visits by type
	var mainVisit *models.Visit        // First visit (non-referral) - for registration fee
	var inpatientVisit *models.Visit   // Inpatient visit if exists
	var clinicalVisits []*models.Visit // Poli, UGD, Rawat Inap (for procedures & medicines)
	var orderVisits []*models.Visit    // Lab, Radiology visits (only for procedure items, NO room fee)

	for i := range visits {
		v := &visits[i]

		// Find main visit (first visit without referral)
		if v.ReferralFrom == nil && mainVisit == nil {
			mainVisit = v
		}

		// Track inpatient visit
		if v.VisitType == models.VisitTypeInpatient {
			inpatientVisit = v
		}

		// Categorize visits
		switch v.VisitType {
		case models.VisitTypeLab, models.VisitTypeRadiology:
			// Order visits - only procedure items, NO room charges
			orderVisits = append(orderVisits, v)
		default:
			// Clinical visits (poli, ugd, rawat inap) - can have room charges
			clinicalVisits = append(clinicalVisits, v)
		}
	}

	if mainVisit == nil && len(visits) > 0 {
		mainVisit = &visits[0]
	}

	fmt.Printf("[BILLING] Main visit: %v, Inpatient: %v, Clinical visits: %d, Order visits: %d\n",
		mainVisit != nil, inpatientVisit != nil, len(clinicalVisits), len(orderVisits))

	// ============================================
	// 1. REGISTRATION FEE (Administrasi) - Only 1x
	// ============================================
	if mainVisit != nil {
		if err := generateAdministrasiFee(tx, billing, mainVisit); err != nil {
			return err
		}
	}

	// If patient transferred to inpatient from outpatient/emergency, add inpatient admin fee too
	if mainVisit != nil && mainVisit.VisitType != models.VisitTypeInpatient && inpatientVisit != nil {
		fmt.Printf("[BILLING] Patient transferred to inpatient, adding inpatient admin fee\n")
		if err := generateAdministrasiFee(tx, billing, inpatientVisit); err != nil {
			return err
		}
	}

	// ============================================
	// 2. CLINICAL VISITS - Procedures, Medicines, Room Charges
	// ============================================
	for _, visit := range clinicalVisits {
		fmt.Printf("[BILLING] Processing clinical visit %d (type: %s)\n", visit.ID, visit.VisitType)

		// Visit Procedures (Tindakan langsung di ruangan)
		if err := generateVisitProcedureItems(tx, billing, visit); err != nil {
			return err
		}

		// Medicine Orders from this visit
		if err := generateMedicineOrderItems(tx, billing, visit); err != nil {
			return err
		}

		// Room Charges - ONLY for inpatient visits
		if visit.VisitType == models.VisitTypeInpatient {
			if err := generateInpatientRoomCharges(tx, billing, visit); err != nil {
				return err
			}
		}
	}

	// ============================================
	// 3. ORDER VISITS (Lab/Radiology) - Only Procedure Items, NO room fee
	// ============================================
	for _, visit := range orderVisits {
		fmt.Printf("[BILLING] Processing order visit %d (type: %s) - NO room charges\n", visit.ID, visit.VisitType)

		// Only procedure items from orders
		if err := generateVisitProcedureItems(tx, billing, visit); err != nil {
			return err
		}
	}

	// ============================================
	// 4. PROCEDURE ORDERS (from source visits)
	// ============================================
	for _, visit := range clinicalVisits {
		if err := generateProcedureOrderItems(tx, billing, visit); err != nil {
			return err
		}
	}

	return nil
}

// generateAdministrasiFee adds administration fee for a visit (only Administrasi component)
// - For outpatient/emergency: Administrasi as registration fee
// - For inpatient: Administrasi as one-time admission fee
func generateAdministrasiFee(tx *gorm.DB, billing *models.Billing, visit *models.Visit) error {
	var room models.Room
	if err := tx.First(&room, visit.RoomID).Error; err != nil {
		fmt.Printf("[BILLING] Room not found for visit %d\n", visit.ID)
		return nil
	}
	fmt.Printf("[BILLING] Getting admin fee for room: %s (type: %s)\n", room.Name, visit.VisitType)

	// Get registration with RegisteredBy info
	var registration models.Registration
	tx.Preload("RegisteredBy").First(&registration, billing.RegistrationID)

	// Get room tariff
	var roomTariff models.RoomTariff
	var foundTariff bool

	classesToTry := []string{billing.PatientClass}
	if billing.PaymentMethod == "bpjs" {
		classesToTry = []string{billing.PatientClass, "kelas_3", "kelas_2", "kelas_1", "non_kelas"}
	} else {
		classesToTry = append(classesToTry, "non_kelas")
	}

	for _, class := range classesToTry {
		err := tx.Where("room_id = ? AND patient_class = ? AND is_active = ?", room.ID, class, true).
			First(&roomTariff).Error
		if err == nil {
			foundTariff = true
			break
		}
	}

	// Fallback to any active tariff
	if !foundTariff {
		if err := tx.Where("room_id = ? AND is_active = ?", room.ID, true).First(&roomTariff).Error; err == nil {
			foundTariff = true
		}
	}

	if !foundTariff {
		// Use legacy registration_fee
		if room.RegistrationFee > 0 {
			item := models.BillingItem{
				BillingID:     billing.ID,
				ItemType:      models.BillingItemTypeRegistration,
				ReferenceID:   room.ID,
				ReferenceType: "room",
				Description:   fmt.Sprintf("Biaya Pendaftaran %s", room.Name),
				Quantity:      1,
				Unit:          "kali",
				UnitPrice:     room.RegistrationFee,
				Subtotal:      room.RegistrationFee,
			}
			// Set registrar info
			if registration.RegisteredBy != nil {
				item.PerformedByID = &registration.RegisteredByID
				item.PerformedByName = registration.RegisteredBy.FullName
				item.PerformedByRole = "admin"
			}
			if err := tx.Create(&item).Error; err != nil {
				return err
			}
			fmt.Printf("[BILLING] Created legacy registration fee: %.0f\n", room.RegistrationFee)
		} else {
			// No tariff and no legacy fee - create 0 amount registration item
			item := models.BillingItem{
				BillingID:     billing.ID,
				ItemType:      models.BillingItemTypeRegistration,
				ReferenceID:   room.ID,
				ReferenceType: "room",
				Description:   fmt.Sprintf("Biaya Pendaftaran %s", room.Name),
				Quantity:      1,
				Unit:          "kali",
				UnitPrice:     0,
				Subtotal:      0,
			}
			// Set registrar info
			if registration.RegisteredBy != nil {
				item.PerformedByID = &registration.RegisteredByID
				item.PerformedByName = registration.RegisteredBy.FullName
				item.PerformedByRole = "admin"
			}
			if err := tx.Create(&item).Error; err != nil {
				return err
			}
			fmt.Printf("[BILLING] Created 0 registration fee (no tariff found) for room: %s\n", room.Name)
		}
		return nil
	}

	// Always add Administrasi component (even if 0)
	description := fmt.Sprintf("Biaya Administrasi %s", room.Name)
	if visit.VisitType == models.VisitTypeInpatient {
		description = fmt.Sprintf("Biaya Administrasi Rawat Inap %s", room.Name)
	}

	item := models.BillingItem{
		BillingID:     billing.ID,
		ItemType:      models.BillingItemTypeRegistration,
		ReferenceID:   roomTariff.ID,
		ReferenceType: "room_tariff",
		Description:   description,
		Quantity:      1,
		Unit:          "kali",
		UnitPrice:     roomTariff.Administrasi,
		Subtotal:      roomTariff.Administrasi,
		Administrasi:  roomTariff.Administrasi,
	}
	// Set registrar info
	if registration.RegisteredBy != nil {
		item.PerformedByID = &registration.RegisteredByID
		item.PerformedByName = registration.RegisteredBy.FullName
		item.PerformedByRole = "admin"
	}
	if err := tx.Create(&item).Error; err != nil {
		return err
	}
	fmt.Printf("[BILLING] Created admin fee: %.0f for %s\n", roomTariff.Administrasi, room.Name)

	return nil
}

// generateInpatientRoomCharges adds room charges for inpatient visit
// Charges per day: Akomodasi + Makan + Perawatan + Lainnya (NO Administrasi - already charged once)
func generateInpatientRoomCharges(tx *gorm.DB, billing *models.Billing, visit *models.Visit) error {
	if visit.VisitType != models.VisitTypeInpatient {
		return nil
	}

	// Must have admission and discharge time
	if visit.AdmissionTime == nil || visit.DischargeTime == nil {
		fmt.Printf("[BILLING] Inpatient visit %d has no admission/discharge time\n", visit.ID)
		return nil
	}

	var room models.Room
	if err := tx.First(&room, visit.RoomID).Error; err != nil {
		return err
	}

	// Determine patient class
	patientClass := "non_kelas"
	if billing.PaymentMethod == "bpjs" {
		var reg models.Registration
		if err := tx.Preload("Patient").First(&reg, billing.RegistrationID).Error; err == nil {
			if reg.Patient != nil && reg.Patient.KelasBPJS != "" {
				patientClass = "kelas_" + reg.Patient.KelasBPJS
			}
		}
	}
	if visit.InpatientClass != "" {
		patientClass = visit.InpatientClass
	}

	// Get room tariff
	var roomTariff models.RoomTariff
	var foundTariff bool

	classesToTry := []string{patientClass, "non_kelas"}
	for _, class := range classesToTry {
		err := tx.Where("room_id = ? AND patient_class = ? AND is_active = ?", room.ID, class, true).
			First(&roomTariff).Error
		if err == nil {
			foundTariff = true
			break
		}
	}

	if !foundTariff {
		// Use legacy tariff_per_day
		if room.TariffPerDay > 0 {
			days := calculateInpatientDays(*visit.AdmissionTime, *visit.DischargeTime)
			if days < 1 {
				days = 1
			}

			item := models.BillingItem{
				BillingID:     billing.ID,
				ItemType:      models.BillingItemTypeRoom,
				ReferenceID:   room.ID,
				ReferenceType: "room",
				Description:   fmt.Sprintf("Biaya Kamar %s (%d hari)", room.Name, days),
				Quantity:      days,
				Unit:          "hari",
				UnitPrice:     room.TariffPerDay,
				Subtotal:      room.TariffPerDay * float64(days),
			}
			if err := tx.Create(&item).Error; err != nil {
				return err
			}
			fmt.Printf("[BILLING] Created legacy room charge: %.0f x %d days\n", room.TariffPerDay, days)
		}
		return nil
	}

	// Calculate days
	days := calculateInpatientDays(*visit.AdmissionTime, *visit.DischargeTime)
	if days < 1 {
		days = 1
	}

	// Per day charge = Akomodasi + Makan + Perawatan + Lainnya (NO Administrasi)
	perDayCharge := roomTariff.Akomodasi + roomTariff.Makan + roomTariff.Perawatan + roomTariff.Lainnya
	if perDayCharge <= 0 {
		return nil
	}

	subtotal := perDayCharge * float64(days)

	item := models.BillingItem{
		BillingID:     billing.ID,
		ItemType:      models.BillingItemTypeRoom,
		ReferenceID:   room.ID,
		ReferenceType: "room",
		ReferenceCode: room.Code,
		Description:   fmt.Sprintf("Biaya Kamar %s - %s (%d hari)", room.Name, formatPatientClass(patientClass), days),
		Quantity:      days,
		Unit:          "hari",
		UnitPrice:     perDayCharge,
		Subtotal:      subtotal,
		Akomodasi:     roomTariff.Akomodasi * float64(days),
		Makan:         roomTariff.Makan * float64(days),
		Perawatan:     roomTariff.Perawatan * float64(days),
		Lainnya:       roomTariff.Lainnya * float64(days),
	}

	if err := tx.Create(&item).Error; err != nil {
		return err
	}
	fmt.Printf("[BILLING] Created inpatient room charge: %.0f/day x %d days = %.0f\n", perDayCharge, days, subtotal)

	return nil
}

// Legacy function - kept for backward compatibility
func regenerateBillingItems(c *gin.Context, billing *models.Billing, visit *models.Visit, userID uint) {
	// Get registration
	var registration models.Registration
	if err := database.DB.First(&registration, billing.RegistrationID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration not found"})
		return
	}
	regenerateBillingItemsFromRegistration(c, billing, &registration, userID)
}

// Legacy function - kept for backward compatibility
func generateBillingItems(tx *gorm.DB, billing *models.Billing, visit *models.Visit) error {
	// Get all visits for this registration
	var allVisits []models.Visit
	if err := tx.Preload("Room").Where("registration_id = ?", billing.RegistrationID).Find(&allVisits).Error; err != nil {
		return err
	}

	var registration models.Registration
	if err := tx.First(&registration, billing.RegistrationID).Error; err != nil {
		return err
	}

	return generateBillingItemsFromRegistration(tx, billing, &registration, allVisits)
}

// generateVisitProcedureItems adds visit procedure items to billing
// Tindakan yang dikerjakan langsung di ruangan visit (bukan order ke ruangan lain)
func generateVisitProcedureItems(tx *gorm.DB, billing *models.Billing, visit *models.Visit) error {
	var visitProcedures []models.VisitProcedure

	err := tx.
		Preload("Procedure").
		Preload("Procedure.Tariffs", "patient_class = ?", billing.PatientClass).
		Preload("FilledBy"). // Load user who performed the procedure
		Where("visit_id = ? AND status = ?", visit.ID, models.VisitProcedureStatusCompleted).
		Find(&visitProcedures).Error

	if err != nil {
		return err
	}

	for _, vp := range visitProcedures {
		if vp.Procedure == nil {
			continue
		}

		var unitPrice float64 = 0
		billingItem := models.BillingItem{
			BillingID:     billing.ID,
			ItemType:      models.BillingItemTypeProcedure,
			ReferenceID:   vp.ID,
			ReferenceType: "visit_procedure",
			ReferenceCode: vp.Procedure.Code,
			Description:   vp.Procedure.Name,
			Quantity:      1,
			Unit:          "kali",
		}

		// Set performer info (who performed the procedure)
		if vp.FilledBy != nil {
			billingItem.PerformedByID = vp.FilledByID
			billingItem.PerformedByName = vp.FilledBy.FullName
			billingItem.PerformedByRole = "petugas"
		} else if visit.Doctor != nil {
			// Fallback to visit doctor
			billingItem.PerformedByID = visit.DoctorID
			billingItem.PerformedByName = visit.Doctor.NamaLengkap
			billingItem.PerformedByRole = "dokter"
		}

		// Get tariff for patient class
		if len(vp.Procedure.Tariffs) > 0 {
			tariff := vp.Procedure.Tariffs[0]
			unitPrice = tariff.GetTotal()

			// Store tariff components
			billingItem.Administrasi = tariff.Administrasi
			billingItem.Sarana = tariff.Sarana
			billingItem.BHP = tariff.BHP
			billingItem.DokterOperator = tariff.DokterOperator
			billingItem.DokterAnastesi = tariff.DokterAnastesi
			billingItem.DokterLainnya = tariff.DokterLainnya
			billingItem.PenataAnastesi = tariff.PenataAnastesi
			billingItem.Paramedis = tariff.Paramedis
			billingItem.NonMedis = tariff.NonMedis
		}

		billingItem.UnitPrice = unitPrice
		billingItem.Subtotal = unitPrice

		if err := tx.Create(&billingItem).Error; err != nil {
			return err
		}
	}

	return nil
}

// generateProcedureOrderItems adds procedure order items to billing
func generateProcedureOrderItems(tx *gorm.DB, billing *models.Billing, visit *models.Visit) error {
	// Get procedure orders for this visit (both as source and target)
	var orderItems []models.ProcedureOrderItem

	// Get items from orders where this visit is the source
	err := tx.
		Joins("JOIN procedure_orders ON procedure_orders.id = procedure_order_items.procedure_order_id").
		Preload("Procedure").
		Preload("Procedure.Tariffs", "patient_class = ?", billing.PatientClass).
		Preload("PerformedBy").              // Load performer (petugas yang mengerjakan)
		Preload("ProcedureOrder").           // Load order
		Preload("ProcedureOrder.OrderedBy"). // Load doctor who ordered
		Where("procedure_orders.source_visit_id = ? AND procedure_order_items.status = ?",
			visit.ID, models.ProcedureOrderStatusCompleted).
		Find(&orderItems).Error

	if err != nil {
		return err
	}

	for _, item := range orderItems {
		if item.Procedure == nil {
			continue
		}

		var unitPrice float64 = 0
		var tariffItem models.BillingItem

		tariffItem.BillingID = billing.ID
		tariffItem.ReferenceID = item.ID
		tariffItem.ReferenceType = "procedure_order_item"
		tariffItem.ReferenceCode = item.Procedure.Code
		tariffItem.Description = item.Procedure.Name
		tariffItem.Quantity = 1
		tariffItem.Unit = "kali"

		// Set performer info - for orders, show who ordered it (doctor)
		if item.ProcedureOrder != nil && item.ProcedureOrder.OrderedBy != nil {
			tariffItem.PerformedByID = &item.ProcedureOrder.OrderedByID
			tariffItem.PerformedByName = item.ProcedureOrder.OrderedBy.NamaLengkap
			tariffItem.PerformedByRole = "dokter"
		}

		// Get tariff based on procedure type
		if item.Procedure.ProcedureType == "radiology" {
			tariffItem.ItemType = models.BillingItemTypeRadiology
		} else if item.Procedure.ProcedureType == "laboratory" {
			tariffItem.ItemType = models.BillingItemTypeLaboratory
		} else if item.Procedure.ProcedureType == "consultation" {
			tariffItem.ItemType = models.BillingItemTypeConsultation
		} else {
			tariffItem.ItemType = models.BillingItemTypeProcedure
		}

		// Get tariff for patient class
		if len(item.Procedure.Tariffs) > 0 {
			tariff := item.Procedure.Tariffs[0]
			unitPrice = tariff.GetTotal()

			// Store tariff components
			tariffItem.Administrasi = tariff.Administrasi
			tariffItem.Sarana = tariff.Sarana
			tariffItem.BHP = tariff.BHP
			tariffItem.DokterOperator = tariff.DokterOperator
			tariffItem.DokterAnastesi = tariff.DokterAnastesi
			tariffItem.DokterLainnya = tariff.DokterLainnya
			tariffItem.PenataAnastesi = tariff.PenataAnastesi
			tariffItem.Paramedis = tariff.Paramedis
			tariffItem.NonMedis = tariff.NonMedis
		}

		tariffItem.UnitPrice = unitPrice
		tariffItem.Subtotal = unitPrice

		if err := tx.Create(&tariffItem).Error; err != nil {
			return err
		}
	}

	return nil
}

// generateMedicineOrderItems adds medicine order items to billing
func generateMedicineOrderItems(tx *gorm.DB, billing *models.Billing, visit *models.Visit) error {
	// Get medicine orders for this visit
	var orderItems []models.MedicineOrderItem

	err := tx.
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Preload("Medicine").
		Preload("MedicineOrder").             // Load order
		Preload("MedicineOrder.DeliveredBy"). // Load who delivered
		Where("medicine_orders.source_visit_id = ? AND medicine_order_items.status = ?",
			visit.ID, models.ItemStatusDelivered).
		Find(&orderItems).Error

	if err != nil {
		return err
	}

	for _, item := range orderItems {
		if item.Medicine == nil {
			continue
		}

		// Calculate actual dispensed quantity (after return)
		actualQty := item.DispensedQty - item.ReturnedQty
		if actualQty <= 0 {
			continue
		}

		unitPrice := item.Medicine.SellingPrice
		subtotal := unitPrice * float64(actualQty)

		billingItem := models.BillingItem{
			BillingID:     billing.ID,
			ItemType:      models.BillingItemTypeMedicine,
			ReferenceID:   item.ID,
			ReferenceType: "medicine_order_item",
			ReferenceCode: item.Medicine.Code,
			Description:   fmt.Sprintf("%s %s", item.Medicine.Name, item.Medicine.Strength),
			Quantity:      actualQty,
			Unit:          item.Unit,
			UnitPrice:     unitPrice,
			Subtotal:      subtotal,
		}

		// Set performer info - for medicines, show who delivered
		if item.MedicineOrder != nil && item.MedicineOrder.DeliveredBy != nil {
			billingItem.PerformedByID = item.MedicineOrder.DeliveredByID
			billingItem.PerformedByName = item.MedicineOrder.DeliveredBy.NamaLengkap
			billingItem.PerformedByRole = "apoteker"
		}

		if err := tx.Create(&billingItem).Error; err != nil {
			return err
		}
	}

	return nil
}

// calculateInpatientDays calculates number of days for inpatient stay
// Uses calendar date counting: counts each date the patient stayed
// e.g., admission Tue 23:00, discharge Fri 07:00 = 4 days (Tue, Wed, Thu, Fri)
func calculateInpatientDays(admission, discharge time.Time) int {
	// Normalize to date only (start of day)
	admissionDate := time.Date(admission.Year(), admission.Month(), admission.Day(), 0, 0, 0, 0, admission.Location())
	dischargeDate := time.Date(discharge.Year(), discharge.Month(), discharge.Day(), 0, 0, 0, 0, discharge.Location())

	// Calculate difference in days and add 1 (both dates are inclusive)
	days := int(dischargeDate.Sub(admissionDate).Hours()/24) + 1

	return days
}

// formatPatientClass returns human-readable patient class name
func formatPatientClass(class string) string {
	switch class {
	case "non_kelas":
		return "Non Kelas"
	case "kelas_1":
		return "Kelas 1"
	case "kelas_2":
		return "Kelas 2"
	case "kelas_3":
		return "Kelas 3"
	case "vip":
		return "VIP"
	case "vvip":
		return "VVIP"
	default:
		return class
	}
}

// FinalizeBilling finalizes billing for payment (draft -> pending)
func FinalizeBilling(c *gin.Context) {
	id := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var billing models.Billing
	if err := database.DB.Preload("Items").First(&billing, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing not found"})
		return
	}

	if billing.Status != models.BillingStatusDraft {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Billing sudah difinalisasi"})
		return
	}

	if len(billing.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Billing tidak memiliki item"})
		return
	}

	// Check if all visits for this registration are completed
	var incompleteVisits int64
	if err := database.DB.Model(&models.Visit{}).
		Where("registration_id = ?", billing.RegistrationID).
		Where("status NOT IN ?", []string{models.VisitStatusCompleted, models.VisitStatusCancelled}).
		Count(&incompleteVisits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check visits: " + err.Error()})
		return
	}

	if incompleteVisits > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Masih ada %d kunjungan yang belum selesai. Semua kunjungan harus difinalisasi terlebih dahulu.", incompleteVisits)})
		return
	}

	now := time.Now()
	userIDUint := userID.(uint)

	// Update billing status to pending (ready for payment)
	// Registration will be discharged when billing is fully paid
	billing.Status = models.BillingStatusPending
	billing.FinalizedByID = &userIDUint
	billing.FinalizedAt = &now

	if err := database.DB.Save(&billing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to finalize billing: " + err.Error()})
		return
	}

	// Reload with relations
	database.DB.
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Items").
		Preload("FinalizedBy").
		First(&billing, billing.ID)

	c.JSON(http.StatusOK, billing)
}

// UpdateBillingDiscount updates discount and adjustment
func UpdateBillingDiscount(c *gin.Context) {
	id := c.Param("id")

	var input struct {
		DiscountAmount float64 `json:"discount_amount"`
		DiscountReason string  `json:"discount_reason"`
		AdjustAmount   float64 `json:"adjust_amount"`
		AdjustReason   string  `json:"adjust_reason"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var billing models.Billing
	if err := database.DB.First(&billing, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing not found"})
		return
	}

	if billing.Status == models.BillingStatusPaid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Billing sudah lunas, tidak dapat diubah"})
		return
	}

	billing.DiscountAmount = input.DiscountAmount
	billing.DiscountReason = input.DiscountReason
	billing.AdjustAmount = input.AdjustAmount
	billing.AdjustReason = input.AdjustReason
	billing.FinalAmount = billing.TotalAmount - billing.DiscountAmount + billing.AdjustAmount
	billing.RemainingAmount = billing.FinalAmount - billing.PaidAmount

	if err := database.DB.Save(&billing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update billing: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, billing)
}

// CreatePayment creates a new payment for billing
func CreatePayment(c *gin.Context) {
	billingID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var input struct {
		PaymentMethod      string  `json:"payment_method" binding:"required"`
		Amount             float64 `json:"amount" binding:"required"`
		ReceivedAmount     float64 `json:"received_amount"`
		BPJSNumber         string  `json:"bpjs_number"`
		BPJSClaimCode      string  `json:"bpjs_claim_code"`
		InsuranceName      string  `json:"insurance_name"`
		InsuranceNumber    string  `json:"insurance_number"`
		InsuranceClaimCode string  `json:"insurance_claim_code"`
		BankName           string  `json:"bank_name"`
		CardNumber         string  `json:"card_number"`
		ReferenceNumber    string  `json:"reference_number"`
		Notes              string  `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var billing models.Billing
	if err := database.DB.First(&billing, billingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing not found"})
		return
	}

	if billing.Status == models.BillingStatusDraft {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Billing belum difinalisasi"})
		return
	}

	if billing.Status == models.BillingStatusPaid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Billing sudah lunas"})
		return
	}

	if billing.Status == models.BillingStatusCancelled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Billing sudah dibatalkan"})
		return
	}

	// Check if all visits for this registration are completed
	var incompleteVisits int64
	if err := database.DB.Model(&models.Visit{}).
		Where("registration_id = ?", billing.RegistrationID).
		Where("status NOT IN ?", []string{models.VisitStatusCompleted, models.VisitStatusCancelled}).
		Count(&incompleteVisits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check visits: " + err.Error()})
		return
	}

	if incompleteVisits > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Masih ada %d kunjungan yang belum selesai. Semua kunjungan harus difinalisasi terlebih dahulu sebelum melakukan pembayaran.", incompleteVisits)})
		return
	}

	// Validate amount
	if input.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jumlah pembayaran harus lebih dari 0"})
		return
	}

	if input.Amount > billing.RemainingAmount {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jumlah pembayaran melebihi sisa tagihan"})
		return
	}

	// Validate payment method specific fields
	switch input.PaymentMethod {
	case models.PaymentMethodBPJS:
		// BPJS payment - tidak perlu validasi field karena BPJS tidak dibayar pasien
		// Hanya cek apakah billing adalah BPJS
		if billing.PaymentMethod != "bpjs" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Metode pembayaran BPJS hanya untuk tagihan dengan metode pembayaran BPJS"})
			return
		}

	case models.PaymentMethodInsurance:
		// Insurance payment must match billing payment method
		if billing.PaymentMethod != "insurance" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Metode pembayaran Asuransi hanya untuk tagihan dengan metode pembayaran Asuransi"})
			return
		}
		// Nama asuransi diambil dari master data, hanya wajib kode klaim
		if input.InsuranceClaimCode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode klaim asuransi wajib diisi untuk pembayaran asuransi"})
			return
		}

	case models.PaymentMethodTransfer:
		if input.BankName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama bank wajib diisi untuk pembayaran transfer"})
			return
		}
		if input.ReferenceNumber == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor referensi wajib diisi untuk pembayaran transfer"})
			return
		}

	case models.PaymentMethodDebit, models.PaymentMethodCredit:
		if input.BankName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama bank wajib diisi untuk pembayaran kartu"})
			return
		}
		if input.ReferenceNumber == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor referensi/approval wajib diisi untuk pembayaran kartu"})
			return
		}
	}

	// Calculate change for cash payment
	var changeAmount float64 = 0
	if input.PaymentMethod == models.PaymentMethodCash {
		if input.ReceivedAmount < input.Amount {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jumlah diterima kurang dari jumlah pembayaran"})
			return
		}
		changeAmount = input.ReceivedAmount - input.Amount
	}

	tx := database.DB.Begin()

	// Create payment
	payment := models.BillingPayment{
		PaymentNumber:      generatePaymentNumber(),
		BillingID:          billing.ID,
		PaymentMethod:      input.PaymentMethod,
		Amount:             input.Amount,
		PaymentDate:        time.Now(),
		ReceivedAmount:     input.ReceivedAmount,
		ChangeAmount:       changeAmount,
		BPJSNumber:         input.BPJSNumber,
		BPJSClaimCode:      input.BPJSClaimCode,
		InsuranceName:      input.InsuranceName,
		InsuranceNumber:    input.InsuranceNumber,
		InsuranceClaimCode: input.InsuranceClaimCode,
		BankName:           input.BankName,
		CardNumber:         input.CardNumber,
		ReferenceNumber:    input.ReferenceNumber,
		CashierID:          userID.(uint),
		Status:             "completed",
		Notes:              input.Notes,
	}

	if err := tx.Create(&payment).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create payment: " + err.Error()})
		return
	}

	// Update billing
	billing.PaidAmount += input.Amount
	billing.RemainingAmount = billing.FinalAmount - billing.PaidAmount

	if billing.RemainingAmount <= 0 {
		billing.Status = models.BillingStatusPaid
		now := time.Now()
		billing.PaidAt = &now

		// Update registration to discharged when billing is fully paid
		if err := tx.Model(&models.Registration{}).
			Where("id = ?", billing.RegistrationID).
			Updates(map[string]interface{}{
				"status":        "discharged",
				"discharged_at": now,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update registration: " + err.Error()})
			return
		}
	} else {
		billing.Status = models.BillingStatusPartial
	}

	if err := tx.Save(&billing).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update billing: " + err.Error()})
		return
	}

	tx.Commit()

	// Reload payment with relations
	database.DB.Preload("Cashier").First(&payment, payment.ID)

	// Reload billing with relations
	database.DB.Preload("Visit").Preload("Registration").First(&billing, billing.ID)

	c.JSON(http.StatusCreated, gin.H{
		"payment": payment,
		"billing": billing,
	})
}

// GetPayments returns all payments for a billing
func GetPayments(c *gin.Context) {
	billingID := c.Param("id")

	var payments []models.BillingPayment
	if err := database.DB.
		Preload("Cashier").
		Where("billing_id = ?", billingID).
		Order("created_at DESC").
		Find(&payments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, payments)
}

// VoidPayment voids a payment
func VoidPayment(c *gin.Context) {
	paymentID := c.Param("payment_id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var payment models.BillingPayment
	if err := database.DB.First(&payment, paymentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	if payment.Status != "completed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pembayaran tidak dapat dibatalkan"})
		return
	}

	tx := database.DB.Begin()

	// Void payment
	now := time.Now()
	userIDUint := userID.(uint)
	payment.Status = "voided"
	payment.VoidedByID = &userIDUint
	payment.VoidedAt = &now
	payment.VoidedReason = input.Reason

	if err := tx.Save(&payment).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to void payment: " + err.Error()})
		return
	}

	// Update billing
	var billing models.Billing
	if err := tx.First(&billing, payment.BillingID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get billing: " + err.Error()})
		return
	}

	billing.PaidAmount -= payment.Amount
	billing.RemainingAmount = billing.FinalAmount - billing.PaidAmount

	// Check if billing was previously paid (status discharged)
	wasPaid := billing.Status == models.BillingStatusPaid

	if billing.PaidAmount <= 0 {
		billing.Status = models.BillingStatusPending
		billing.PaidAt = nil
	} else {
		billing.Status = models.BillingStatusPartial
	}

	if err := tx.Save(&billing).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update billing: " + err.Error()})
		return
	}

	// If billing was paid (registration was discharged), revert registration status
	if wasPaid {
		if err := tx.Model(&models.Registration{}).
			Where("id = ?", billing.RegistrationID).
			Updates(map[string]interface{}{
				"status":        "completed",
				"discharged_at": nil,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revert registration: " + err.Error()})
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"payment": payment,
		"billing": billing,
	})
}

// CancelBilling cancels a billing
func CancelBilling(c *gin.Context) {
	id := c.Param("id")

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var billing models.Billing
	if err := database.DB.Preload("Payments").First(&billing, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing not found"})
		return
	}

	// Cannot cancel paid billing
	if billing.Status == models.BillingStatusPaid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat membatalkan billing yang sudah lunas"})
		return
	}

	// Check if there are completed payments
	for _, payment := range billing.Payments {
		if payment.Status == "completed" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat membatalkan billing yang sudah ada pembayaran. Batalkan pembayaran terlebih dahulu."})
			return
		}
	}

	billing.Status = models.BillingStatusCancelled
	billing.Notes = input.Reason

	tx := database.DB.Begin()

	if err := tx.Save(&billing).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel billing: " + err.Error()})
		return
	}

	// Revert registration status back to completed (active)
	if err := tx.Model(&models.Registration{}).
		Where("id = ?", billing.RegistrationID).
		Updates(map[string]interface{}{
			"status":        "completed",
			"discharged_at": nil,
		}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revert registration status: " + err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, billing)
}

// GetRegistrationTariffs returns all registration tariffs
func GetRegistrationTariffs(c *gin.Context) {
	var tariffs []models.RegistrationTariff

	query := database.DB.Order("service_type, payment_method")

	if serviceType := c.Query("service_type"); serviceType != "" {
		query = query.Where("service_type = ?", serviceType)
	}

	if err := query.Find(&tariffs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tariffs)
}

// CreateRegistrationTariff creates a new registration tariff
func CreateRegistrationTariff(c *gin.Context) {
	var input models.RegistrationTariff

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tariff: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, input)
}

// UpdateRegistrationTariff updates a registration tariff
func UpdateRegistrationTariff(c *gin.Context) {
	id := c.Param("id")

	var tariff models.RegistrationTariff
	if err := database.DB.First(&tariff, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tariff not found"})
		return
	}

	if err := c.ShouldBindJSON(&tariff); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Save(&tariff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tariff: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, tariff)
}

// DeleteRegistrationTariff deletes a registration tariff
func DeleteRegistrationTariff(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.RegistrationTariff{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete tariff: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tariff deleted successfully"})
}

// Helper functions
func generateBillingNumber() string {
	now := time.Now()
	var count int64
	database.DB.Model(&models.Billing{}).
		Where("DATE(created_at) = DATE(?)", now).
		Count(&count)
	return fmt.Sprintf("BILL-%s-%04d", now.Format("20060102"), count+1)
}

func generatePaymentNumber() string {
	now := time.Now()
	var count int64
	database.DB.Model(&models.BillingPayment{}).
		Where("DATE(created_at) = DATE(?)", now).
		Count(&count)
	return fmt.Sprintf("PAY-%s-%04d", now.Format("20060102"), count+1)
}

func determinePatientClass(registration *models.Registration) string {
	if registration == nil {
		return models.PatientClassNonKelas
	}

	switch registration.PaymentMethod {
	case "bpjs":
		// For BPJS, default to kelas_3 (can be adjusted based on BPJS class)
		return models.PatientClassKelas3
	default:
		// For non-BPJS (cash, insurance), use non_kelas
		return models.PatientClassNonKelas
	}
}

// BillableVisitResponse is the response for billable visits
type BillableVisitResponse struct {
	models.Visit
	HasBilling    bool   `json:"has_billing"`
	BillingID     *uint  `json:"billing_id,omitempty"`
	BillingStatus string `json:"billing_status,omitempty"`
}

// BillableRegistrationResponse represents a registration with billing info
type BillableRegistrationResponse struct {
	models.Registration
	VisitCount      int     `json:"visit_count"`
	MainVisitID     *uint   `json:"main_visit_id,omitempty"`
	MainVisitType   string  `json:"main_visit_type,omitempty"`
	MainRoomName    string  `json:"main_room_name,omitempty"`
	HasBilling      bool    `json:"has_billing"`
	BillingID       *uint   `json:"billing_id,omitempty"`
	BillingStatus   string  `json:"billing_status,omitempty"`
	BillingNumber   string  `json:"billing_number,omitempty"`
	TotalAmount     float64 `json:"total_amount,omitempty"`
	RemainingAmount float64 `json:"remaining_amount,omitempty"`
}

// GetBillableRegistrations returns all registrations for billing page (per registration, not per visit)
func GetBillableRegistrations(c *gin.Context) {
	var registrations []models.Registration

	query := database.DB.
		Preload("Patient")

	// Filter by payment_method
	if paymentMethod := c.Query("payment_method"); paymentMethod != "" {
		query = query.Where("payment_method = ?", paymentMethod)
	}

	// Filter by date
	if date := c.Query("date"); date != "" {
		query = query.Where("DATE(created_at) = ?", date)
	}

	// Filter by status (default: show all except cancelled)
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	} else {
		// Default: exclude cancelled
		query = query.Where("status != ?", "cancelled")
	}

	// Search
	if search := c.Query("search"); search != "" {
		query = query.Joins("LEFT JOIN patients ON patients.id = registrations.patient_id").
			Where("registrations.registration_number LIKE ? OR patients.nama_lengkap LIKE ? OR patients.no_rm LIKE ?",
				"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// Order by created_at descending
	query = query.Order("registrations.created_at DESC")

	// Limit results
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	query = query.Limit(limit)

	if err := query.Find(&registrations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Build response with billing info for each registration
	result := make([]BillableRegistrationResponse, 0) // Initialize as empty slice, not nil
	for _, reg := range registrations {
		item := BillableRegistrationResponse{
			Registration: reg,
			HasBilling:   false,
		}

		// Get visit count and main visit info
		var visits []models.Visit
		database.DB.Preload("Room").Where("registration_id = ?", reg.ID).Find(&visits)
		item.VisitCount = len(visits)

		// Find main visit (the one without referral)
		for _, v := range visits {
			if v.ReferralFrom == nil {
				item.MainVisitID = &v.ID
				item.MainVisitType = string(v.VisitType)
				if v.Room != nil {
					item.MainRoomName = v.Room.Name
				}
				break
			}
		}
		// If no main visit found, use first visit
		if item.MainVisitID == nil && len(visits) > 0 {
			item.MainVisitID = &visits[0].ID
			item.MainVisitType = string(visits[0].VisitType)
			if visits[0].Room != nil {
				item.MainRoomName = visits[0].Room.Name
			}
		}

		// Check if billing exists for this registration
		var billing models.Billing
		if err := database.DB.Where("registration_id = ?", reg.ID).First(&billing).Error; err == nil {
			item.HasBilling = true
			item.BillingID = &billing.ID
			item.BillingStatus = string(billing.Status)
			item.BillingNumber = billing.BillingNumber
			item.TotalAmount = billing.TotalAmount
			item.RemainingAmount = billing.RemainingAmount
		}

		result = append(result, item)
	}

	c.JSON(http.StatusOK, result)
}

// GetBillableVisits returns all visits for billing page
func GetBillableVisits(c *gin.Context) {
	var visits []models.Visit

	query := database.DB.
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Room")

	// Filter by status (optional)
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by room_id
	if roomID := c.Query("room_id"); roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	// Filter by date
	if date := c.Query("date"); date != "" {
		query = query.Where("DATE(start_time) = ?", date)
	}

	// Order by created_at descending
	query = query.Order("created_at DESC")

	// Limit results
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	query = query.Limit(limit)

	if err := query.Find(&visits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get billing info for each visit
	var result []BillableVisitResponse
	for _, visit := range visits {
		item := BillableVisitResponse{
			Visit:      visit,
			HasBilling: false,
		}

		// Check if billing exists for this visit
		var billing models.Billing
		if err := database.DB.Where("visit_id = ?", visit.ID).First(&billing).Error; err == nil {
			item.HasBilling = true
			item.BillingID = &billing.ID
			item.BillingStatus = string(billing.Status)
		}

		result = append(result, item)
	}

	c.JSON(http.StatusOK, result)
}
