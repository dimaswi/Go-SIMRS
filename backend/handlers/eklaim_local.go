package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	eklaimSvc "starter/backend/services/eklaim"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==========================================================================
// E-KLAIM LOCAL HANDLERS
//
// Handler untuk fitur E-Klaim Local Server:
// 1. List SEP — daftar kunjungan yang sudah punya SEP
// 2. SEP Detail — detail SEP + rekam medis (dan tombol duplikasi RM)
// 3. Duplicate RM — duplikasi data RM ke E-Klaim (bisa diedit, tidak pengaruhi asli)
// 4. New Claim — kirim new_claim ke server eklaim lokal
// 5. Set Claim Data — kirim set_claim_data setelah new_claim sukses
// 6. Grouper — grouping INA-CBG/iDRG
// 7. Finalisasi — finalisasi klaim
// 8. Cancel / Reedit — batal/reedit klaim
// 9. Log — log semua komunikasi ke server eklaim
// ==========================================================================

// GetListSEP returns visits that have SEP.
// GET /eklaim-local/list-sep?page=1&per_page=20&search=&status=&tgl_from=&tgl_to=
func GetListSEP(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	search := c.Query("search")
	status := c.Query("status")              // aktif, batal
	tglFrom := c.Query("tgl_from")           // yyyy-mm-dd
	tglTo := c.Query("tgl_to")               // yyyy-mm-dd
	claimStatus := c.Query("claim_status")   // has_claim, no_claim (filter apakah sudah dibuat eklaim_local atau belum)
	jnsPelayanan := c.Query("jns_pelayanan") // 1=Ranap, 2=Rajal

	offset := (page - 1) * perPage

	query := database.DB.Model(&models.SEP{}).
		Preload("Patient").
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Visit.Doctor")

	// Search by name, SEP number, or kartu
	if search != "" {
		query = query.Where(
			"no_sep ILIKE ? OR nama_pasien ILIKE ? OR no_kartu ILIKE ? OR no_mr ILIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%",
		)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if tglFrom != "" {
		query = query.Where("tgl_sep >= ?", tglFrom)
	}
	if tglTo != "" {
		query = query.Where("tgl_sep <= ?", tglTo)
	}

	if jnsPelayanan != "" {
		query = query.Where("jns_pelayanan = ?", jnsPelayanan)
	}

	// Filter by claim status (has_claim = already has eklaim_local record)
	if claimStatus == "has_claim" {
		query = query.Where("EXISTS (SELECT 1 FROM eklaim_locals el WHERE el.no_sep = sep.no_sep AND el.deleted_at IS NULL)")
	} else if claimStatus == "no_claim" {
		query = query.Where("NOT EXISTS (SELECT 1 FROM eklaim_locals el WHERE el.no_sep = sep.no_sep AND el.deleted_at IS NULL)")
	}

	var total int64
	query.Count(&total)

	var seps []models.SEP
	if err := query.Order("tgl_sep DESC, created_at DESC").
		Offset(offset).Limit(perPage).
		Find(&seps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data SEP"})
		return
	}

	// Add eklaim_local status info for each SEP
	type SEPWithClaim struct {
		models.SEP
		EKlaimLocal *models.EKlaimLocal `json:"eklaim_local,omitempty"`
	}

	var result []SEPWithClaim
	for _, sep := range seps {
		item := SEPWithClaim{SEP: sep}
		var eklaimLocal models.EKlaimLocal
		if err := database.DB.Where("no_sep = ?", sep.NoSEP).First(&eklaimLocal).Error; err == nil {
			item.EKlaimLocal = &eklaimLocal
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"data": result,
		"meta": gin.H{
			"page":     page,
			"per_page": perPage,
			"total":    total,
		},
	})
}

// GetSEPDetail returns detailed SEP info with visit, diagnoses, procedures
// GET /eklaim-local/list-sep/:sepId
func GetSEPDetail(c *gin.Context) {
	sepID, err := strconv.ParseUint(c.Param("sepId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid SEP ID"})
		return
	}

	var sep models.SEP
	if err := database.DB.
		Preload("Patient").
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Visit.Doctor").
		Preload("Visit.Registration").
		First(&sep, sepID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan"})
		return
	}

	// Load visit diagnoses and procedures from RM
	var diagnoses []models.Diagnosis
	var visitProcedures []models.VisitProcedure
	if sep.VisitID != nil {
		database.DB.Where("visit_id = ?", *sep.VisitID).
			Order("type ASC, created_at ASC").
			Find(&diagnoses)
		database.DB.Where("visit_id = ?", *sep.VisitID).
			Preload("Procedure").
			Find(&visitProcedures)
	}

	// Check if eklaim_local already exists
	var eklaimLocal *models.EKlaimLocal
	var el models.EKlaimLocal
	if err := database.DB.Where("no_sep = ?", sep.NoSEP).
		Preload("Logs", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC").Limit(10)
		}).
		First(&el).Error; err == nil {
		eklaimLocal = &el
	}

	c.JSON(http.StatusOK, gin.H{
		"sep":              sep,
		"diagnoses":        diagnoses,
		"visit_procedures": visitProcedures,
		"eklaim_local":     eklaimLocal,
	})
}

// DuplicateRM creates a duplicate of the medical record for E-Klaim editing.
// POST /eklaim-local/list-sep/:sepId/duplicate-rm
// Body: {} (empty — it copies from the visit's RM)
func DuplicateRM(c *gin.Context) {
	sepID, err := strconv.ParseUint(c.Param("sepId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid SEP ID"})
		return
	}

	var sep models.SEP
	if err := database.DB.First(&sep, sepID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan"})
		return
	}

	if sep.VisitID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SEP belum terhubung dengan visit"})
		return
	}

	// Ensure EKlaimLocal exists
	var eklaimLocal models.EKlaimLocal
	err = database.DB.Where("no_sep = ?", sep.NoSEP).First(&eklaimLocal).Error
	if err != nil {
		eklaimLocal = models.EKlaimLocal{
			SEPID:      sep.ID,
			VisitID:    *sep.VisitID,
			NoSEP:      sep.NoSEP,
			NoKartu:    sep.NoKartu,
			NamaPasien: sep.NamaPasien,
			Status:     "draft",
		}
		userID := getUserIDValue(c)
		if userID > 0 {
			eklaimLocal.CreatedByID = &userID
		}
		if err := database.DB.Create(&eklaimLocal).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat eklaim local"})
			return
		}
	}

	// Call service to duplicate RM
	if err := duplicateRMLogic(*sep.VisitID, eklaimLocal.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal duplikasi RM ke Casemix: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Duplikasi RM ke Casemix berhasil",
		"eklaim_local": eklaimLocal,
	})
}

// duplicateRMLogic copies original RM data to Casemix marked records
func duplicateRMLogic(visitID uint, eklaimLocalID uint) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Delete old Casemix records
		tables := []string{
			"triages", "anamneses", "physical_examinations", "diagnoses", "diagnosis_summaries",
			"assessment_plans", "dispositions", "cppts", "fluid_balances",
			"nursing_cares", "body_markers", "visit_procedures", "procedure_orders",
			"medicine_orders",
		}
		for _, t := range tables {
			if t == "procedure_orders" || t == "medicine_orders" {
				tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE source_visit_id = ? AND is_casemix = ?", t), visitID, true)
			} else {
				tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE visit_id = ? AND is_casemix = ?", t), visitID, true)
			}
		}

		// 2. Helper to duplicate
		duplicateRecords := func(model interface{}, dest interface{}, visitColumn string) error {
			if err := tx.Where(visitColumn+" = ? AND is_casemix = ?", visitID, false).Find(model).Error; err != nil {
				return err
			}

			// Marshal and unmarshal to deep copy
			data, _ := json.Marshal(model)
			json.Unmarshal(data, dest)

			return nil
		}

		// Diagnoses
		var diags, newDiags []models.Diagnosis
		duplicateRecords(&diags, &newDiags, "visit_id")
		for i := range newDiags {
			newDiags[i].ID = 0
			newDiags[i].IsCasemix = true
			newDiags[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newDiags[i])
		}

		// Diagnosis Summary
		var diagSummaries, newDiagSummaries []models.DiagnosisSummary
		duplicateRecords(&diagSummaries, &newDiagSummaries, "visit_id")
		for i := range newDiagSummaries {
			newDiagSummaries[i].ID = 0
			newDiagSummaries[i].IsCasemix = true
			newDiagSummaries[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newDiagSummaries[i])
		}

		// Anamnesis
		var anm, newAnm []models.Anamnesis
		duplicateRecords(&anm, &newAnm, "visit_id")
		for i := range newAnm {
			newAnm[i].ID = 0
			newAnm[i].IsCasemix = true
			newAnm[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newAnm[i])
		}

		// Triage
		var trg, newTrg []models.Triage
		duplicateRecords(&trg, &newTrg, "visit_id")
		for i := range newTrg {
			newTrg[i].ID = 0
			newTrg[i].IsCasemix = true
			newTrg[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newTrg[i])
		}
		if len(newTrg) == 0 {
			if triagePtr, ok := findTriageForVisit(visitID); ok {
				triageCopy := *triagePtr
				triageCopy.ID = 0
				// Keep the RM Casemix record scoped to the claim visit, even when
				// the source triage came from a same-registration UGD visit.
				triageCopy.VisitID = visitID
				triageCopy.IsCasemix = true
				triageCopy.CasemixEklaimID = &eklaimLocalID
				tx.Create(&triageCopy)
			}
		}

		// Physical Examination
		var pe, newPe []models.PhysicalExamination
		duplicateRecords(&pe, &newPe, "visit_id")
		for i := range newPe {
			newPe[i].ID = 0
			newPe[i].IsCasemix = true
			newPe[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newPe[i])
		}

		// Assessment Plan
		var ap, newAp []models.AssessmentPlan
		duplicateRecords(&ap, &newAp, "visit_id")
		for i := range newAp {
			newAp[i].ID = 0
			newAp[i].IsCasemix = true
			newAp[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newAp[i])
		}

		// Body Markers
		var bm, newBm []models.BodyMarker
		duplicateRecords(&bm, &newBm, "visit_id")
		for i := range newBm {
			newBm[i].ID = 0
			newBm[i].IsCasemix = true
			newBm[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newBm[i])
		}

		// Disposition
		var disp, newDisp []models.Disposition
		duplicateRecords(&disp, &newDisp, "visit_id")
		for i := range newDisp {
			newDisp[i].ID = 0
			newDisp[i].IsCasemix = true
			newDisp[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newDisp[i])
		}

		// Visit Procedures
		var vp, newVp []models.VisitProcedure
		duplicateRecords(&vp, &newVp, "visit_id")
		for i := range newVp {
			newVp[i].ID = 0
			newVp[i].IsCasemix = true
			newVp[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newVp[i])
		}

		// Medicine Orders
		var mo []models.MedicineOrder
		tx.Where("source_visit_id = ? AND is_casemix = ?", visitID, false).Preload("Items").Find(&mo)
		for _, order := range mo {
			newOrder := order
			newOrder.ID = 0
			newOrder.IsCasemix = true
			newOrder.CasemixEklaimID = &eklaimLocalID
			newOrder.Items = nil
			tx.Create(&newOrder)

			for _, item := range order.Items {
				newItem := item
				newItem.ID = 0
				newItem.MedicineOrderID = newOrder.ID
				tx.Create(&newItem)
			}
		}

		// Procedure Orders
		var po []models.ProcedureOrder
		tx.Where("source_visit_id = ? AND is_casemix = ?", visitID, false).Preload("Items").Find(&po)
		for _, order := range po {
			newOrder := order
			newOrder.ID = 0
			newOrder.IsCasemix = true
			newOrder.CasemixEklaimID = &eklaimLocalID
			newOrder.Items = nil
			tx.Create(&newOrder)

			for _, item := range order.Items {
				newItem := item
				newItem.ID = 0
				newItem.ProcedureOrderID = newOrder.ID
				tx.Create(&newItem)
			}
		}

		return nil
	})
}

// ensureRMDuplicateDraftOnly makes sure one RM duplicate header exists
// without re-syncing or replacing existing editable casemix data.
func ensureRMDuplicateDraftOnly(visitID uint, eklaimLocalID uint) error {
	var existing models.EKlaimRMDuplicate
	err := database.DB.Where("e_klaim_local_id = ?", eklaimLocalID).First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	now := time.Now()
	rmDup := models.EKlaimRMDuplicate{
		EKlaimLocalID: eklaimLocalID,
		VisitID:       visitID,
		DuplicatedAt:  &now,
	}
	return database.DB.Create(&rmDup).Error
}

// CreateClaimFromSEP creates EKlaimLocal + sends new_claim in one step.
// POST /eklaim-local/list-sep/:sepId/create-claim
// Body (optional overrides): { nomor_kartu, nomor_sep, nomor_rm, nama_pasien, tgl_lahir, gender }
func CreateClaimFromSEP(c *gin.Context) {
	sepID, err := strconv.ParseUint(c.Param("sepId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid SEP ID"})
		return
	}

	// Parse optional overrides from request body
	var req struct {
		NomorKartu string `json:"nomor_kartu"`
		NomorSEP   string `json:"nomor_sep"`
		NomorRM    string `json:"nomor_rm"`
		NamaPasien string `json:"nama_pasien"`
		TglLahir   string `json:"tgl_lahir"`
		Gender     int    `json:"gender"`
	}
	c.ShouldBindJSON(&req)

	var sep models.SEP
	if err := database.DB.First(&sep, sepID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan"})
		return
	}

	if sep.VisitID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SEP belum terhubung dengan visit"})
		return
	}

	userID := getUserIDValue(c)

	// Step 1: Create or get EKlaimLocal
	var eklaimLocal models.EKlaimLocal
	findErr := database.DB.Where("no_sep = ?", sep.NoSEP).First(&eklaimLocal).Error
	if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal cek eklaim local: " + findErr.Error()})
		return
	}

	if errors.Is(findErr, gorm.ErrRecordNotFound) {
		eklaimLocal = models.EKlaimLocal{
			SEPID:      sep.ID,
			VisitID:    *sep.VisitID,
			NoSEP:      sep.NoSEP,
			NoKartu:    sep.NoKartu,
			NamaPasien: sep.NamaPasien,
			Status:     "draft",
		}
		if userID > 0 {
			eklaimLocal.CreatedByID = &userID
		}
		if err := database.DB.Create(&eklaimLocal).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat eklaim local: " + err.Error()})
			return
		}
	}

	// If new_claim already succeeded, return conflict
	if eklaimLocal.NewClaimSuccess {
		c.JSON(http.StatusConflict, gin.H{
			"error":        "new_claim sudah berhasil sebelumnya",
			"eklaim_local": eklaimLocal,
		})
		return
	}

	// Step 2: Build new_claim data (use overrides if provided, else from SEP)
	nomorKartu := sep.NoKartu
	if req.NomorKartu != "" {
		nomorKartu = req.NomorKartu
	}
	nomorSEP := sep.NoSEP
	if req.NomorSEP != "" {
		nomorSEP = req.NomorSEP
	}
	nomorRM := sep.NoMR
	if req.NomorRM != "" {
		nomorRM = req.NomorRM
	}
	namaPasien := sep.NamaPasien
	if req.NamaPasien != "" {
		namaPasien = req.NamaPasien
	}
	tglLahir := sep.TglLahir
	if req.TglLahir != "" {
		tglLahir = req.TglLahir
	}
	if len(tglLahir) == 10 {
		tglLahir = tglLahir + " 00:00:00"
	}

	gender := 0
	if req.Gender != 0 {
		gender = req.Gender
	} else {
		if sep.JenisKelamin == "L" {
			gender = 1
		} else if sep.JenisKelamin == "P" {
			gender = 2
		}
	}

	claimData := eklaimSvc.NewClaimData{
		NomorKartu: nomorKartu,
		NomorSEP:   nomorSEP,
		NomorRM:    nomorRM,
		NamaPasien: namaPasien,
		TglLahir:   tglLahir,
		Gender:     gender,
	}

	// Step 3: Send new_claim to E-Klaim server
	client, clientErr := eklaimSvc.NewClient()
	if clientErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + clientErr.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.NewClaim(claimData)

	// Log the API call
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "new_claim",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	// Update eklaim_local status
	now := time.Now()
	eklaimLocal.NewClaimSentAt = &now
	eklaimLocal.NewClaimResponse = string(respJSON)

	if apiErr != nil {
		eklaimLocal.NewClaimSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "new_claim gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
		})
		return
	}

	eklaimLocal.NewClaimSuccess = true
	eklaimLocal.Status = "new_claim"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Klaim baru berhasil dibuat dan dikirim ke server E-Klaim",
		"eklaim_local": eklaimLocal,
	})
}

// RecalculateEKlaimRMBilling recalculates the duplicate billing for E-Klaim RM
// based on order items (procedures) and medicine items.
// This is separate from the real billing and used only for E-Klaim display.
func RecalculateEKlaimRMBilling(tx *gorm.DB, rmDuplicateID uint, visitID uint) error {
	// Load visit to get patient class
	var visit models.Visit
	if err := tx.Preload("Registration.Patient").First(&visit, visitID).Error; err != nil {
		return fmt.Errorf("failed to load visit: %w", err)
	}

	// Determine patient class (same logic as billing generation)
	patientClass := models.PatientClassNonKelas

	// Check BPJS class from patient
	if visit.Registration != nil && visit.Registration.PaymentMethod == "bpjs" {
		if visit.Registration.Patient != nil && visit.Registration.Patient.KelasBPJS != "" {
			patientClass = "kelas_" + visit.Registration.Patient.KelasBPJS
		}
	}

	// Override with inpatient class if available
	if visit.InpatientClass != "" {
		patientClass = visit.InpatientClass
	}

	// Delete old billing items and billing (cascade)
	tx.Exec("DELETE FROM eklaim_rm_billing_items WHERE eklaim_rm_billing_id IN (SELECT id FROM eklaim_rm_billings WHERE rm_duplicate_id = ?)", rmDuplicateID)
	tx.Exec("DELETE FROM eklaim_rm_billings WHERE rm_duplicate_id = ?", rmDuplicateID)

	// Create new billing
	billing := models.EKlaimRMBilling{
		RMDuplicateID: rmDuplicateID,
		TotalAmount:   0,
		FinalAmount:   0,
		PaidAmount:    0,
	}
	if err := tx.Create(&billing).Error; err != nil {
		return fmt.Errorf("failed to create billing: %w", err)
	}

	var billingItems []models.EKlaimRMBillingItem
	sequence := 1

	// ===== Process Order Items (Procedures) =====
	var orders []models.EKlaimRMOrder
	if err := tx.Where("rm_duplicate_id = ?", rmDuplicateID).
		Preload("Items.Procedure.Tariffs").
		Find(&orders).Error; err != nil {
		return fmt.Errorf("failed to load orders: %w", err)
	}

	fmt.Printf("[BILLING] Processing %d orders for patient class: %s\n", len(orders), patientClass)

	for _, order := range orders {
		for _, item := range order.Items {
			if item.Procedure == nil {
				fmt.Printf("[BILLING] Skipping order item %d - no procedure\n", item.ID)
				continue
			}

			// Find tariff for patient class
			var unitPrice float64
			var foundTariff *models.ProcedureTariff

			// Try to find exact match for patient class
			for i := range item.Procedure.Tariffs {
				if item.Procedure.Tariffs[i].PatientClass == patientClass {
					foundTariff = &item.Procedure.Tariffs[i]
					break
				}
			}

			// Fallback to non_kelas if not found
			if foundTariff == nil {
				for i := range item.Procedure.Tariffs {
					if item.Procedure.Tariffs[i].PatientClass == models.PatientClassNonKelas {
						foundTariff = &item.Procedure.Tariffs[i]
						break
					}
				}
			}

			if foundTariff != nil {
				unitPrice = foundTariff.GetTotal()
			}

			if unitPrice <= 0 {
				fmt.Printf("[BILLING] Skipping order item %d (%s) - no tariff found or price = 0\n", item.ID, item.ProcedureName)
				continue
			}

			fmt.Printf("[BILLING] Adding procedure: %s @ %s = %.0f\n", item.ProcedureName, foundTariff.PatientClass, unitPrice)

			// Create billing item
			billingItem := models.EKlaimRMBillingItem{
				EKlaimRMBillingID: billing.ID,
				ItemType:          "procedure",
				ReferenceID:       item.ID,
				ReferenceType:     "order_item",
				ReferenceCode:     item.Procedure.Code,
				Description:       fmt.Sprintf("%s - %s", order.OrderType, item.ProcedureName),
				Quantity:          1,
				Unit:              "tindakan",
				UnitPrice:         unitPrice,
				Subtotal:          unitPrice,
				Sequence:          sequence,
			}
			billingItems = append(billingItems, billingItem)
			sequence++
		}
	}

	// ===== Process Medicine Items =====
	var medicineItems []models.EKlaimRMMedicineItem
	if err := tx.Where("rm_duplicate_id = ?", rmDuplicateID).Find(&medicineItems).Error; err != nil {
		return fmt.Errorf("failed to load medicine items: %w", err)
	}

	fmt.Printf("[BILLING] Processing %d medicine items\n", len(medicineItems))

	for _, med := range medicineItems {
		if med.UnitPrice <= 0 || med.Quantity <= 0 {
			fmt.Printf("[BILLING] Skipping medicine %s - price or qty = 0\n", med.MedicineName)
			continue
		}

		fmt.Printf("[BILLING] Adding medicine: %s qty=%d @ %.0f = %.0f\n", med.MedicineName, med.Quantity, med.UnitPrice, med.SubTotal)

		billingItem := models.EKlaimRMBillingItem{
			EKlaimRMBillingID: billing.ID,
			ItemType:          "medicine",
			ReferenceID:       med.ID,
			ReferenceType:     "medicine_item",
			Description:       fmt.Sprintf("%s (%s)", med.MedicineName, med.Dosage),
			Quantity:          med.Quantity,
			Unit:              med.Unit,
			UnitPrice:         med.UnitPrice,
			Subtotal:          med.SubTotal,
			Sequence:          sequence,
		}
		billingItems = append(billingItems, billingItem)
		sequence++
	}

	// ===== Process Administration Fee =====
	// Load room with tariffs to get administration fee
	var room models.Room
	if err := tx.Preload("Tariffs", "patient_class = ?", patientClass).First(&room, visit.RoomID).Error; err == nil {
		var adminFee float64

		// Try to get from room tariff for patient class
		if len(room.Tariffs) > 0 {
			adminFee = room.Tariffs[0].Administrasi
		}

		// Fallback to registration fee
		if adminFee <= 0 {
			adminFee = room.RegistrationFee
		}

		if adminFee > 0 {
			fmt.Printf("[BILLING] Adding administration fee: %.0f\n", adminFee)
			billingItem := models.EKlaimRMBillingItem{
				EKlaimRMBillingID: billing.ID,
				ItemType:          "administration",
				ReferenceType:     "room",
				ReferenceID:       room.ID,
				Description:       "Biaya Administrasi",
				Quantity:          1,
				Unit:              "paket",
				UnitPrice:         adminFee,
				Subtotal:          adminFee,
				Sequence:          sequence,
			}
			billingItems = append(billingItems, billingItem)
			sequence++
		}
	}

	// ===== Process Accommodation Fee (for Inpatient) =====
	// Calculate LOS (Length of Stay) for accommodation billing
	if visit.VisitType == models.VisitTypeInpatient || visit.AdmissionTime != nil {
		var los int

		// Check if RM Duplicate has LengthOfStay override
		var rmDup models.EKlaimRMDuplicate
		if err := tx.Where("id = ?", rmDuplicateID).First(&rmDup).Error; err == nil && rmDup.LengthOfStay > 0 {
			los = rmDup.LengthOfStay
			fmt.Printf("[BILLING] Using LOS from RM Duplicate override: %d days\n", los)
		} else {
			// Calculate LOS from admission and discharge time

			// Check RM Duplicate dates first
			if rmDup.AdmissionDate != "" && rmDup.DischargeDate != "" {
				// Try multiple datetime formats (ISO with T and with space)
				admTime, err1 := time.Parse("2006-01-02T15:04:05", rmDup.AdmissionDate)
				if err1 != nil {
					admTime, err1 = time.Parse("2006-01-02 15:04:05", rmDup.AdmissionDate)
				}
				if err1 != nil {
					admTime, err1 = time.Parse("2006-01-02T15:04", rmDup.AdmissionDate)
				}
				if err1 != nil {
					admTime, err1 = time.Parse("2006-01-02", rmDup.AdmissionDate)
				}

				disTime, err2 := time.Parse("2006-01-02T15:04:05", rmDup.DischargeDate)
				if err2 != nil {
					disTime, err2 = time.Parse("2006-01-02 15:04:05", rmDup.DischargeDate)
				}
				if err2 != nil {
					disTime, err2 = time.Parse("2006-01-02T15:04", rmDup.DischargeDate)
				}
				if err2 != nil {
					disTime, err2 = time.Parse("2006-01-02", rmDup.DischargeDate)
				}

				if err1 == nil && err2 == nil {
					// Calculate LOS using date difference + 1 (admission day counts)
					// Example: Admit Feb 1, Discharge Feb 3 = 3 days (not 2)
					admDate := time.Date(admTime.Year(), admTime.Month(), admTime.Day(), 0, 0, 0, 0, admTime.Location())
					disDate := time.Date(disTime.Year(), disTime.Month(), disTime.Day(), 0, 0, 0, 0, disTime.Location())
					daysDiff := int(disDate.Sub(admDate).Hours() / 24)
					los = daysDiff + 1 // Add 1 because admission day counts
					if los < 1 {
						los = 1
					}
					fmt.Printf("[BILLING] Using LOS from RM Duplicate dates: %d days (admit: %s, discharge: %s, diff: %d days)\n",
						los, admDate.Format("2006-01-02"), disDate.Format("2006-01-02"), daysDiff)
				} else {
					fmt.Printf("[BILLING] Failed to parse RM Duplicate dates - AdmissionDate: %s (err: %v), DischargeDate: %s (err: %v)\n",
						rmDup.AdmissionDate, err1, rmDup.DischargeDate, err2)
				}
			}

			// Fallback to visit admission/discharge time
			if los == 0 && visit.AdmissionTime != nil && visit.DischargeTime != nil {
				// Calculate LOS using date difference + 1 (admission day counts)
				admDate := time.Date(visit.AdmissionTime.Year(), visit.AdmissionTime.Month(), visit.AdmissionTime.Day(), 0, 0, 0, 0, visit.AdmissionTime.Location())
				disDate := time.Date(visit.DischargeTime.Year(), visit.DischargeTime.Month(), visit.DischargeTime.Day(), 0, 0, 0, 0, visit.DischargeTime.Location())
				daysDiff := int(disDate.Sub(admDate).Hours() / 24)
				los = daysDiff + 1 // Add 1 because admission day counts
				if los < 1 {
					los = 1 // Minimum 1 hari
				}
				fmt.Printf("[BILLING] Using LOS from Visit dates: %d days (admit: %s, discharge: %s, diff: %d days)\n",
					los, admDate.Format("2006-01-02"), disDate.Format("2006-01-02"), daysDiff)
			} else if los == 0 && visit.AdmissionTime != nil {
				// Jika belum discharge, hitung sampai sekarang
				admDate := time.Date(visit.AdmissionTime.Year(), visit.AdmissionTime.Month(), visit.AdmissionTime.Day(), 0, 0, 0, 0, visit.AdmissionTime.Location())
				nowDate := time.Date(time.Now().Year(), time.Now().Month(), time.Now().Day(), 0, 0, 0, 0, time.Now().Location())
				daysDiff := int(nowDate.Sub(admDate).Hours() / 24)
				los = daysDiff + 1 // Add 1 because admission day counts
				if los < 1 {
					los = 1
				}
				fmt.Printf("[BILLING] Patient still admitted, LOS from admission to now: %d days\n", los)
			} else if los == 0 {
				// Fallback to InpatientDays if available
				if visit.InpatientDays > 0 {
					los = visit.InpatientDays
				} else {
					los = 1
				}
			}
		}

		fmt.Printf("[BILLING] LOS (Length of Stay): %d days\n", los)

		// Get accommodation tariff from room
		if err := tx.Preload("Tariffs", "patient_class = ?", patientClass).First(&room, visit.RoomID).Error; err == nil {
			var accomTariffPerDay float64

			// Check if RM Duplicate has tariff override
			var rmDup models.EKlaimRMDuplicate
			if err := tx.Where("id = ?", rmDuplicateID).First(&rmDup).Error; err == nil && rmDup.AccommodationTariffPerDay > 0 {
				accomTariffPerDay = rmDup.AccommodationTariffPerDay
				fmt.Printf("[BILLING] Using accommodation tariff from RM Duplicate override: %.0f\n", accomTariffPerDay)
			} else {
				// Try to get from room tariff for patient class
				// Akomodasi + Makan (digabung jadi satu)
				if len(room.Tariffs) > 0 {
					accomTariffPerDay = room.Tariffs[0].Akomodasi + room.Tariffs[0].Makan
				}

				// Fallback to TariffPerDay (legacy)
				if accomTariffPerDay <= 0 {
					accomTariffPerDay = room.TariffPerDay
				}
			}

			if accomTariffPerDay > 0 {
				totalAccom := accomTariffPerDay * float64(los)

				var accomLog string
				if len(room.Tariffs) > 0 {
					accomLog = fmt.Sprintf("(Akomodasi: %.0f + Makan: %.0f)", room.Tariffs[0].Akomodasi, room.Tariffs[0].Makan)
				}
				fmt.Printf("[BILLING] Adding accommodation+meal: %d days @ %.0f %s = %.0f\n",
					los, accomTariffPerDay, accomLog, totalAccom)

				billingItem := models.EKlaimRMBillingItem{
					EKlaimRMBillingID: billing.ID,
					ItemType:          "accommodation",
					ReferenceType:     "room",
					ReferenceID:       room.ID,
					Description:       fmt.Sprintf("Biaya Akomodasi & Makan (%s) - %d hari", room.Name, los),
					Quantity:          los,
					Unit:              "hari",
					UnitPrice:         accomTariffPerDay,
					Subtotal:          totalAccom,
					Sequence:          sequence,
				}
				billingItems = append(billingItems, billingItem)
				sequence++
			}
		}
	}

	fmt.Printf("[BILLING] Total items to create: %d\n", len(billingItems))

	// Save all billing items
	if len(billingItems) > 0 {
		if err := tx.Create(&billingItems).Error; err != nil {
			return fmt.Errorf("failed to create billing items: %w", err)
		}
		fmt.Printf("[BILLING] Successfully created %d billing items\n", len(billingItems))
	} else {
		fmt.Printf("[BILLING] No billing items to create (empty billing)\n")
	}

	// Recalculate billing totals
	var total float64
	for _, item := range billingItems {
		total += item.Subtotal
	}
	billing.TotalAmount = total
	billing.FinalAmount = total - billing.DiscountAmount + billing.AdjustAmount
	billing.RemainingAmount = billing.FinalAmount - billing.PaidAmount

	if err := tx.Save(&billing).Error; err != nil {
		return fmt.Errorf("failed to update billing totals: %w", err)
	}

	fmt.Printf("[BILLING] Billing saved - Total: %.0f, Final: %.0f\n", billing.TotalAmount, billing.FinalAmount)
	return nil
}

// UpdateRMDuplicate updates the editable RM duplicate fields.
// PUT /eklaim-local/:id/rm-duplicate
// Body: { diagnoses: [...], procedures: [...], tarif_rs: 0, ... }
func UpdateRMDuplicate(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	// Find or create RM Duplicate via raw SQL upsert to handle soft-deleted records
	var rmDupID uint
	row := database.DB.Raw(`
		INSERT INTO eklaim_rm_duplicates (e_klaim_local_id, visit_id, created_at, updated_at, duplicated_at, deleted_at)
		VALUES (?, ?, NOW(), NOW(), NOW(), NULL)
		ON CONFLICT (e_klaim_local_id) DO UPDATE SET deleted_at = NULL, updated_at = NOW()
		RETURNING id
	`, eklaimLocal.ID, eklaimLocal.VisitID).Row()
	if err := row.Scan(&rmDupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat/menemukan RM Duplicate: " + err.Error()})
		return
	}
	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.First(&rmDup, rmDupID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal load RM Duplicate: " + err.Error()})
		return
	}

	var req struct {
		// Clinical fields - Anamnesis
		ChiefComplaint          string `json:"chief_complaint"`
		HistoryOfPresentIllness string `json:"history_of_present_illness"`
		PastMedicalHistory      string `json:"past_medical_history"`
		FamilyHistory           string `json:"family_history"`
		SocialHistory           string `json:"social_history"`
		Allergies               string `json:"allergies"`
		CurrentMedications      string `json:"current_medications"`
		ReviewOfSystems         string `json:"review_of_systems"`

		// Physical Exam
		GeneralCondition string  `json:"general_condition"`
		Consciousness    string  `json:"consciousness"`
		BloodPressure    string  `json:"blood_pressure"`
		Systolic         int     `json:"systolic"`
		Diastolic        int     `json:"diastolic"`
		HeartRate        string  `json:"heart_rate"`
		RespiratoryRate  string  `json:"respiratory_rate"`
		Temperature      string  `json:"temperature"`
		OxygenSaturation string  `json:"oxygen_saturation"`
		Weight           string  `json:"weight"`
		Height           string  `json:"height"`
		BMI              float64 `json:"bmi"`
		Waist            string  `json:"waist"`
		HeadCircum       string  `json:"head_circum"`
		PainMethod       string  `json:"pain_method"`
		PainScale        int     `json:"pain_scale"`
		PainLocation     string  `json:"pain_location"`

		// Body Systems (legacy)
		HeadNeck     string `json:"head_neck"`
		Eyes         string `json:"eyes"`
		ENT          string `json:"ent"`
		Thorax       string `json:"thorax"`
		Cardiac      string `json:"cardiac"`
		Pulmonary    string `json:"pulmonary"`
		Abdomen      string `json:"abdomen"`
		Extremities  string `json:"extremities"`
		Neurological string `json:"neurological"`
		Skin         string `json:"skin"`

		// Body Systems (new individual)
		Head          string `json:"head"`
		Ears          string `json:"ears"`
		Nose          string `json:"nose"`
		Throat        string `json:"throat"`
		Neck          string `json:"neck"`
		Chest         string `json:"chest"`
		Heart         string `json:"heart"`
		Lungs         string `json:"lungs"`
		Musculoskel   string `json:"musculoskel"`
		Genitourinary string `json:"genitourinary"`
		OtherFindings string `json:"other_findings"`

		// ECG
		ECGPerformed      bool   `json:"ecg_performed"`
		ECGResult         string `json:"ecg_result"`
		ECGInterpretation string `json:"ecg_interpretation"`
		ECGNotes          string `json:"ecg_notes"`

		// Assessment & Plan
		ClinicalAssessment string `json:"clinical_assessment"`
		Prognosis          string `json:"prognosis"`
		TreatmentPlan      string `json:"treatment_plan"`
		MedicationPlan     string `json:"medication_plan"`
		DietPlan           string `json:"diet_plan"`
		ActivityPlan       string `json:"activity_plan"`
		EducationPlan      string `json:"education_plan"`
		MonitoringPlan     string `json:"monitoring_plan"`
		ProcedurePlan      string `json:"procedure_plan"`
		ConsultationPlan   string `json:"consultation_plan"`

		// Disposition
		DispositionType      string `json:"disposition_type"`
		DispositionNote      string `json:"disposition_note"`
		RMDischargeStatus    string `json:"rm_discharge_status"`
		DischargeCondition   string `json:"discharge_condition"`
		DischargeInstruction string `json:"discharge_instruction"`
		DischargeMedication  string `json:"discharge_medication"`
		FollowUpInstruction  string `json:"follow_up_instruction"`
		FollowUpDate         string `json:"follow_up_date"`
		ReferralFacility     string `json:"referral_facility"`
		ReferralReason       string `json:"referral_reason"`
		ReferralDiagnosis    string `json:"referral_diagnosis"`
		ReferralTherapy      string `json:"referral_therapy"`
		ReferralNotes        string `json:"referral_notes"`
		DeathTime            string `json:"death_time"`
		DeathCause           string `json:"death_cause"`

		// Diagnoses, Procedures, Tarif
		// Use pointer types so nil (field absent) means "don't replace" vs [] which means "clear all"
		Diagnoses             *[]models.EKlaimRMDiagnosis `json:"diagnoses"`
		Procedures            *[]models.EKlaimRMProcedure `json:"procedures"`
		TarifProsedurNonBedah float64                     `json:"tarif_prosedur_non_bedah"`
		TarifProsedurBedah    float64                     `json:"tarif_prosedur_bedah"`
		TarifKonsultasi       float64                     `json:"tarif_konsultasi"`
		TarifTenagaAhli       float64                     `json:"tarif_tenaga_ahli"`
		TarifKeperawatan      float64                     `json:"tarif_keperawatan"`
		TarifPenunjang        float64                     `json:"tarif_penunjang"`
		TarifRadiologi        float64                     `json:"tarif_radiologi"`
		TarifLaboratorium     float64                     `json:"tarif_laboratorium"`
		TarifPelayananDarah   float64                     `json:"tarif_pelayanan_darah"`
		TarifRehabilitasi     float64                     `json:"tarif_rehabilitasi"`
		TarifKamar            float64                     `json:"tarif_kamar"`
		TarifRawatIntensif    float64                     `json:"tarif_rawat_intensif"`
		TarifObat             float64                     `json:"tarif_obat"`
		TarifObatKronis       float64                     `json:"tarif_obat_kronis"`
		TarifObatKemoterapi   float64                     `json:"tarif_obat_kemoterapi"`
		TarifAlkes            float64                     `json:"tarif_alkes"`
		TarifBMHP             float64                     `json:"tarif_bmhp"`
		TarifSewaAlat         float64                     `json:"tarif_sewa_alat"`

		// Inpatient-specific fields
		AdmissionDate             string  `json:"admission_date"`
		DischargeDate             string  `json:"discharge_date"`
		LengthOfStay              int     `json:"length_of_stay"`
		AccommodationTariffPerDay float64 `json:"accommodation_tariff_per_day"`

		// Lab, Radiology, Surgery, Consultation — unified order hierarchy
		// Pointer so nil = absent (skip replace) vs [] = explicit clear
		Orders *[]models.EKlaimRMOrder `json:"orders"`

		// Medicine, CPPT, Fluid Balance
		MedicineItems *[]models.EKlaimRMMedicineItem `json:"medicine_items"`
		CPPTNotes     *[]models.EKlaimRMCPPT         `json:"cppt_notes"`
		NursingCares  *[]models.EKlaimRMNursingCare  `json:"nursing_cares"`
		FluidBalances *[]models.EKlaimRMFluidBalance `json:"fluid_balances"`

		// Triage UGD
		HasTriage             bool   `json:"has_triage"`
		TriageArrivalMode     string `json:"triage_arrival_mode"`
		TriageComplaint       string `json:"triage_complaint"`
		TriageLevel           string `json:"triage_level"`
		TriageAirway          string `json:"triage_airway"`
		TriageAirwayNote      string `json:"triage_airway_note"`
		TriageBreathing       string `json:"triage_breathing"`
		TriageBreathingNote   string `json:"triage_breathing_note"`
		TriageCirculation     string `json:"triage_circulation"`
		TriageCirculationNote string `json:"triage_circulation_note"`
		TriageBloodPressure   string `json:"triage_blood_pressure"`
		TriageHeartRate       string `json:"triage_heart_rate"`
		TriageRespiratoryRate string `json:"triage_respiratory_rate"`
		TriageTemperature     string `json:"triage_temperature"`
		TriageOxygenSat       string `json:"triage_oxygen_saturation"`
		TriagePainScale       int    `json:"triage_pain_scale"`
		TriageGCSE            int    `json:"triage_gcs_e"`
		TriageGCSV            int    `json:"triage_gcs_v"`
		TriageGCSM            int    `json:"triage_gcs_m"`
		TriageAssessment      string `json:"triage_assessment"`
		TriageImmediateAction string `json:"triage_immediate_actions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	tx := database.DB.Begin()

	// Update clinical fields - Anamnesis
	rmDup.ChiefComplaint = req.ChiefComplaint
	rmDup.HistoryOfPresentIllness = req.HistoryOfPresentIllness
	rmDup.PastMedicalHistory = req.PastMedicalHistory
	rmDup.FamilyHistory = req.FamilyHistory
	rmDup.SocialHistory = req.SocialHistory
	rmDup.Allergies = req.Allergies
	rmDup.CurrentMedications = req.CurrentMedications
	rmDup.ReviewOfSystems = req.ReviewOfSystems

	// Physical Exam
	rmDup.GeneralCondition = req.GeneralCondition
	rmDup.Consciousness = req.Consciousness
	rmDup.BloodPressure = req.BloodPressure
	rmDup.Systolic = req.Systolic
	rmDup.Diastolic = req.Diastolic
	rmDup.HeartRate = req.HeartRate
	rmDup.RespiratoryRate = req.RespiratoryRate
	rmDup.Temperature = req.Temperature
	rmDup.OxygenSaturation = req.OxygenSaturation
	rmDup.Weight = req.Weight
	rmDup.Height = req.Height
	rmDup.BMI = req.BMI
	rmDup.Waist = req.Waist
	rmDup.HeadCircum = req.HeadCircum
	rmDup.PainMethod = req.PainMethod
	rmDup.PainScale = req.PainScale
	rmDup.PainLocation = req.PainLocation

	// Body Systems (legacy)
	rmDup.HeadNeck = req.HeadNeck
	rmDup.Eyes = req.Eyes
	rmDup.ENT = req.ENT
	rmDup.Thorax = req.Thorax
	rmDup.Cardiac = req.Cardiac
	rmDup.Pulmonary = req.Pulmonary
	rmDup.Abdomen = req.Abdomen
	rmDup.Extremities = req.Extremities
	rmDup.Neurological = req.Neurological
	rmDup.Skin = req.Skin

	// Body Systems (new individual)
	rmDup.Head = req.Head
	rmDup.Ears = req.Ears
	rmDup.Nose = req.Nose
	rmDup.Throat = req.Throat
	rmDup.Neck = req.Neck
	rmDup.Chest = req.Chest
	rmDup.Heart = req.Heart
	rmDup.Lungs = req.Lungs
	rmDup.Musculoskel = req.Musculoskel
	rmDup.Genitourinary = req.Genitourinary
	rmDup.OtherFindings = req.OtherFindings

	// ECG
	rmDup.ECGPerformed = req.ECGPerformed
	rmDup.ECGResult = req.ECGResult
	rmDup.ECGInterpretation = req.ECGInterpretation
	rmDup.ECGNotes = req.ECGNotes

	// Assessment & Plan
	rmDup.ClinicalAssessment = req.ClinicalAssessment
	rmDup.Prognosis = req.Prognosis
	rmDup.TreatmentPlan = req.TreatmentPlan
	rmDup.MedicationPlan = req.MedicationPlan
	rmDup.DietPlan = req.DietPlan
	rmDup.ActivityPlan = req.ActivityPlan
	rmDup.EducationPlan = req.EducationPlan
	rmDup.MonitoringPlan = req.MonitoringPlan
	rmDup.ProcedurePlan = req.ProcedurePlan
	rmDup.ConsultationPlan = req.ConsultationPlan

	// Disposition
	rmDup.DispositionType = req.DispositionType
	rmDup.DispositionNote = req.DispositionNote
	rmDup.DischargeStatus = req.RMDischargeStatus
	rmDup.DischargeCondition = req.DischargeCondition
	rmDup.DischargeInstruction = req.DischargeInstruction
	rmDup.DischargeMedication = req.DischargeMedication
	rmDup.FollowUpInstruction = req.FollowUpInstruction
	rmDup.FollowUpDate = req.FollowUpDate
	rmDup.ReferralFacility = req.ReferralFacility
	rmDup.ReferralReason = req.ReferralReason
	rmDup.ReferralDiagnosis = req.ReferralDiagnosis
	rmDup.ReferralTherapy = req.ReferralTherapy
	rmDup.ReferralNotes = req.ReferralNotes
	rmDup.DeathTime = req.DeathTime
	rmDup.DeathCause = req.DeathCause

	// Triage UGD
	if req.HasTriage {
		rmDup.HasTriage = true
		rmDup.TriageArrivalMode = req.TriageArrivalMode
		rmDup.TriageComplaint = req.TriageComplaint
		rmDup.TriageLevel = req.TriageLevel
		rmDup.TriageAirway = req.TriageAirway
		rmDup.TriageAirwayNote = req.TriageAirwayNote
		rmDup.TriageBreathing = req.TriageBreathing
		rmDup.TriageBreathingNote = req.TriageBreathingNote
		rmDup.TriageCirculation = req.TriageCirculation
		rmDup.TriageCirculationNote = req.TriageCirculationNote
		rmDup.TriageBloodPressure = req.TriageBloodPressure
		rmDup.TriageHeartRate = req.TriageHeartRate
		rmDup.TriageRespiratoryRate = req.TriageRespiratoryRate
		rmDup.TriageTemperature = req.TriageTemperature
		rmDup.TriageOxygenSat = req.TriageOxygenSat
		rmDup.TriagePainScale = req.TriagePainScale
		rmDup.TriageGCSE = req.TriageGCSE
		rmDup.TriageGCSV = req.TriageGCSV
		rmDup.TriageGCSM = req.TriageGCSM
		rmDup.TriageAssessment = req.TriageAssessment
		rmDup.TriageImmediateAction = req.TriageImmediateAction
	}
	rmDup.TarifProsedurNonBedah = req.TarifProsedurNonBedah
	rmDup.TarifProsedurBedah = req.TarifProsedurBedah
	rmDup.TarifKonsultasi = req.TarifKonsultasi
	rmDup.TarifTenagaAhli = req.TarifTenagaAhli
	rmDup.TarifKeperawatan = req.TarifKeperawatan
	rmDup.TarifPenunjang = req.TarifPenunjang
	rmDup.TarifRadiologi = req.TarifRadiologi
	rmDup.TarifLaboratorium = req.TarifLaboratorium
	rmDup.TarifPelayananDarah = req.TarifPelayananDarah
	rmDup.TarifRehabilitasi = req.TarifRehabilitasi
	rmDup.TarifKamar = req.TarifKamar
	rmDup.TarifRawatIntensif = req.TarifRawatIntensif
	rmDup.TarifObat = req.TarifObat
	rmDup.TarifObatKronis = req.TarifObatKronis
	rmDup.TarifObatKemoterapi = req.TarifObatKemoterapi
	rmDup.TarifAlkes = req.TarifAlkes
	rmDup.TarifBMHP = req.TarifBMHP
	rmDup.TarifSewaAlat = req.TarifSewaAlat
	rmDup.TotalTarif = req.TarifProsedurNonBedah + req.TarifProsedurBedah + req.TarifKonsultasi + req.TarifTenagaAhli + req.TarifKeperawatan + req.TarifPenunjang + req.TarifRadiologi + req.TarifLaboratorium + req.TarifPelayananDarah + req.TarifRehabilitasi + req.TarifKamar + req.TarifRawatIntensif + req.TarifObat + req.TarifObatKronis + req.TarifObatKemoterapi + req.TarifAlkes + req.TarifBMHP + req.TarifSewaAlat

	// Update inpatient-specific fields
	oldAdmissionDate := rmDup.AdmissionDate
	oldDischargeDate := rmDup.DischargeDate
	rmDup.AdmissionDate = req.AdmissionDate
	rmDup.DischargeDate = req.DischargeDate
	rmDup.LengthOfStay = req.LengthOfStay
	rmDup.AccommodationTariffPerDay = req.AccommodationTariffPerDay

	if err := tx.Save(&rmDup).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update RM: " + err.Error()})
		return
	}

	// Update EKlaimLocal tanggal masuk/pulang jika belum set_claim_data_success
	// Ini penting untuk sinkronisasi data klaim
	if !eklaimLocal.SetClaimDataSuccess {
		dateChanged := false

		// Update tgl_masuk jika berubah
		if req.AdmissionDate != "" && req.AdmissionDate != oldAdmissionDate {
			eklaimLocal.TglMasuk = req.AdmissionDate
			dateChanged = true
		}

		// Update tgl_pulang jika berubah
		if req.DischargeDate != "" && req.DischargeDate != oldDischargeDate {
			eklaimLocal.TglPulang = req.DischargeDate
			dateChanged = true
		}

		if dateChanged {
			if err := tx.Model(&eklaimLocal).Updates(map[string]interface{}{
				"tgl_masuk":  eklaimLocal.TglMasuk,
				"tgl_pulang": eklaimLocal.TglPulang,
			}).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update tanggal di eklaim local: " + err.Error()})
				return
			}
			fmt.Printf("[UpdateRMDuplicate] Updated eklaim_local dates - TglMasuk: %s, TglPulang: %s\n", eklaimLocal.TglMasuk, eklaimLocal.TglPulang)
		}
	}

	// Replace diagnoses — only when explicitly provided (nil = field absent in request)
	if req.Diagnoses != nil {
		if err := tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMDiagnosis{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus diagnosis lama: " + err.Error()})
			return
		}
		for i, d := range *req.Diagnoses {
			d.RMDuplicateID = rmDup.ID
			d.ID = 0
			d.Sequence = i + 1
			if err := tx.Create(&d).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan diagnosis: " + err.Error()})
				return
			}
		}
	}

	// Replace procedures — only when explicitly provided
	if req.Procedures != nil {
		if err := tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMProcedure{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus prosedur lama: " + err.Error()})
			return
		}
		for i, p := range *req.Procedures {
			p.RMDuplicateID = rmDup.ID
			p.ID = 0
			p.Sequence = i + 1
			if err := tx.Create(&p).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan prosedur: " + err.Error()})
				return
			}
		}
	}

	// Replace orders — only when explicitly provided
	if req.Orders != nil {
		// First delete old order results, items, then orders (cascade)
		var oldOrderIDs []uint
		if err := tx.Model(&models.EKlaimRMOrder{}).Where("rm_duplicate_id = ?", rmDup.ID).Pluck("id", &oldOrderIDs).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal query order lama: " + err.Error()})
			return
		}
		if len(oldOrderIDs) > 0 {
			var oldItemIDs []uint
			if err := tx.Model(&models.EKlaimRMOrderItem{}).Where("eklaim_rm_order_id IN ?", oldOrderIDs).Pluck("id", &oldItemIDs).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal query order item lama: " + err.Error()})
				return
			}
			if len(oldItemIDs) > 0 {
				if err := tx.Where("eklaim_rm_order_item_id IN ?", oldItemIDs).Delete(&models.EKlaimRMOrderResult{}).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus order result lama: " + err.Error()})
					return
				}
			}
			if err := tx.Where("eklaim_rm_order_id IN ?", oldOrderIDs).Delete(&models.EKlaimRMOrderItem{}).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus order item lama: " + err.Error()})
				return
			}
		}
		if err := tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMOrder{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus order lama: " + err.Error()})
			return
		}
		for orderSeq, o := range *req.Orders {
			o.RMDuplicateID = rmDup.ID
			o.ID = 0
			o.Sequence = orderSeq + 1
			items := o.Items
			o.Items = nil // Create order first without items
			if err := tx.Create(&o).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan order: " + err.Error()})
				return
			}
			for itemSeq, item := range items {
				item.EKlaimRMOrderID = o.ID
				item.ID = 0
				item.Sequence = itemSeq + 1
				results := item.Results
				item.Results = nil // Create item first without results
				if err := tx.Create(&item).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan order item: " + err.Error()})
					return
				}
				for resSeq, res := range results {
					res.EKlaimRMOrderItemID = item.ID
					res.ID = 0
					res.Sequence = resSeq + 1
					if err := tx.Create(&res).Error; err != nil {
						tx.Rollback()
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan order result: " + err.Error()})
						return
					}
				}
			}
		}
	}

	// Replace medicine items — only when explicitly provided
	if req.MedicineItems != nil {
		if err := tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMMedicineItem{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus obat lama: " + err.Error()})
			return
		}
		for i, m := range *req.MedicineItems {
			m.RMDuplicateID = rmDup.ID
			m.ID = 0
			m.Sequence = i + 1
			// Auto-calculate sub_total
			m.SubTotal = float64(m.Quantity) * m.UnitPrice
			if err := tx.Create(&m).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan obat: " + err.Error()})
				return
			}
		}
	}

	// Replace CPPT notes — only when explicitly provided
	if req.CPPTNotes != nil {
		if err := tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMCPPT{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus CPPT lama: " + err.Error()})
			return
		}
		for i, cppt := range *req.CPPTNotes {
			cppt.RMDuplicateID = rmDup.ID
			cppt.ID = 0
			cppt.Sequence = i + 1
			if cppt.CPPTFormat == "" {
				cppt.CPPTFormat = models.CPPTFormatSOAP
			}
			if err := tx.Create(&cppt).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan CPPT: " + err.Error()})
				return
			}
		}
	}

	// Replace nursing cares — only when explicitly provided
	if req.NursingCares != nil {
		if err := tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMNursingCare{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus asuhan keperawatan lama: " + err.Error()})
			return
		}
		for i, nursing := range *req.NursingCares {
			nursing.RMDuplicateID = rmDup.ID
			nursing.ID = 0
			nursing.Sequence = i + 1
			if err := tx.Create(&nursing).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan asuhan keperawatan: " + err.Error()})
				return
			}
		}
	}

	// Replace fluid balances — only when explicitly provided
	if req.FluidBalances != nil {
		if err := tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMFluidBalance{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus fluid balance lama: " + err.Error()})
			return
		}
		for i, fb := range *req.FluidBalances {
			fb.RMDuplicateID = rmDup.ID
			fb.ID = 0
			fb.Sequence = i + 1
			// Auto-calculate totals
			fb.TotalIntake = fb.OralDrink + fb.OralFood + fb.OralMedicine + fb.IVFluid + fb.IVMedicine + fb.BloodProduct + fb.EnteralFeed + fb.OtherIntake
			fb.TotalOutput = fb.UrineAmount + fb.FecesAmount + fb.VomitAmount + fb.DrainAmount + fb.BloodLoss + fb.IWL + fb.OtherOutput
			fb.Balance = fb.TotalIntake - fb.TotalOutput
			if err := tx.Create(&fb).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan balance cairan: " + err.Error()})
				return
			}
		}
	}

	// Recalculate billing only when order/medicine data was explicitly updated
	if req.Orders != nil || req.MedicineItems != nil {
		if err := RecalculateEKlaimRMBilling(tx, rmDup.ID, rmDup.VisitID); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal kalkulasi billing: " + err.Error()})
			return
		}
	}

	tx.Commit()

	// Invalidate all cached PDFs for this RM duplicate
	go InvalidateRMDuplicatePDFCaches(rmDup.ID)

	// ===== Auto-sync RM Edit data back to EKlaimLocal (claim data fields) =====
	updates := map[string]interface{}{}
	if req.Systolic > 0 {
		updates["sistole"] = req.Systolic
		updates["diastole"] = req.Diastolic
	}
	if req.DispositionType != "" {
		mapped := mapEKlaimDischargeStatus(req.DispositionType)
		if mapped != "" {
			updates["discharge_status"] = mapped
		}
	}
	// Sync tarif total
	totalTarif := req.TarifProsedurNonBedah + req.TarifProsedurBedah + req.TarifKonsultasi +
		req.TarifTenagaAhli + req.TarifKeperawatan + req.TarifPenunjang +
		req.TarifRadiologi + req.TarifLaboratorium + req.TarifPelayananDarah +
		req.TarifRehabilitasi + req.TarifKamar + req.TarifRawatIntensif +
		req.TarifObat + req.TarifObatKronis + req.TarifObatKemoterapi +
		req.TarifAlkes + req.TarifBMHP + req.TarifSewaAlat
	if totalTarif > 0 {
		updates["tarif_rs"] = totalTarif
	}
	if len(updates) > 0 {
		database.DB.Model(&eklaimLocal).Updates(updates)
	}

	// Reload
	database.DB.Preload("Diagnoses").Preload("Procedures").
		Preload("Orders.Items.Procedure.Parameters").Preload("Orders.Items.Results.ProcedureParameter").
		Preload("MedicineItems.Medicine").
		Preload("CPPTNotes").Preload("NursingCares").Preload("FluidBalances").
		Preload("Billing.Items").
		First(&rmDup, rmDup.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":      "RM Duplicate berhasil diupdate",
		"rm_duplicate": rmDup,
	})
}

// UpdateRMDuplicateAnamnesis updates only anamnesis section in RM duplicate.
// PUT /eklaim-local/:id/rm-duplicate/anamnesis
func UpdateRMDuplicateAnamnesis(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	var req struct {
		AnamnesisSource         string `json:"anamnesis_source"`
		FunctionalStatus        string `json:"functional_status"`
		ChiefComplaint          string `json:"chief_complaint"`
		HistoryOfPresentIllness string `json:"history_of_present_illness"`
		PastMedicalHistory      string `json:"past_medical_history"`
		FamilyHistory           string `json:"family_history"`
		SocialHistory           string `json:"social_history"`
		Allergies               string `json:"allergies"`
		CurrentMedications      string `json:"current_medications"`
		ReviewOfSystems         string `json:"review_of_systems"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	var rmDupID uint
	row := database.DB.Raw(`
		INSERT INTO eklaim_rm_duplicates (e_klaim_local_id, visit_id, created_at, updated_at, duplicated_at, deleted_at)
		VALUES (?, ?, NOW(), NOW(), NOW(), NULL)
		ON CONFLICT (e_klaim_local_id) DO UPDATE SET deleted_at = NULL, updated_at = NOW()
		RETURNING id
	`, eklaimLocal.ID, eklaimLocal.VisitID).Row()
	if err := row.Scan(&rmDupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat/menemukan RM Duplicate: " + err.Error()})
		return
	}

	updates := map[string]interface{}{
		"is_casemix":                 true,
		"casemix_eklaim_id":          eklaimLocal.ID,
		"anamnesis_source":           req.AnamnesisSource,
		"functional_status":          req.FunctionalStatus,
		"chief_complaint":            req.ChiefComplaint,
		"history_of_present_illness": req.HistoryOfPresentIllness,
		"past_medical_history":       req.PastMedicalHistory,
		"family_history":             req.FamilyHistory,
		"social_history":             req.SocialHistory,
		"allergies":                  req.Allergies,
		"current_medications":        req.CurrentMedications,
		"review_of_systems":          req.ReviewOfSystems,
	}

	// 1. Update CasemixDB (Clinical Isolation)
	var anamnesis models.Anamnesis
	if err := database.CasemixDB.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", eklaimLocal.VisitID, true, eklaimLocal.ID).First(&anamnesis).Error; err == nil {
		database.CasemixDB.Model(&anamnesis).Updates(updates)
	} else {
		anamnesis = models.Anamnesis{
			VisitID:                 eklaimLocal.VisitID,
			IsCasemix:               true,
			CasemixEklaimID:         &eklaimLocal.ID,
			AnamnesisSource:         req.AnamnesisSource,
			FunctionalStatus:        req.FunctionalStatus,
			ChiefComplaint:          req.ChiefComplaint,
			HistoryOfPresentIllness: req.HistoryOfPresentIllness,
			PastMedicalHistory:      req.PastMedicalHistory,
			FamilyHistory:           req.FamilyHistory,
			SocialHistory:           req.SocialHistory,
			Allergies:               req.Allergies,
			CurrentMedications:      req.CurrentMedications,
			ReviewOfSystems:         req.ReviewOfSystems,
		}
		database.CasemixDB.Create(&anamnesis)
	}

	// 2. Update Legacy EKlaimRMDuplicate in Main DB (for backward compatibility)
	if err := database.DB.Model(&models.EKlaimRMDuplicate{}).Where("id = ?", rmDupID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update anamnesis RM Duplicate: " + err.Error()})
		return
	}

	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.First(&rmDup, rmDupID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal load RM Duplicate: " + err.Error()})
		return
	}
	go InvalidateRMDuplicatePDFCaches(rmDupID)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Anamnesis RM Duplicate berhasil diupdate",
		"rm_duplicate": rmDup,
	})
}

// UpdateRMDuplicateTriage updates only triage section in RM duplicate.
// PUT /eklaim-local/:id/rm-duplicate/triage
func UpdateRMDuplicateTriage(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	var req struct {
		ArrivalMode      string `json:"arrival_mode"`
		TriageComplaint  string `json:"triage_complaint"`
		TriageLevel      string `json:"triage_level"`
		Airway           string `json:"airway"`
		AirwayNote       string `json:"airway_note"`
		Breathing        string `json:"breathing"`
		BreathingNote    string `json:"breathing_note"`
		BreathingRate    string `json:"breathing_rate"`
		Circulation      string `json:"circulation"`
		CirculationNote  string `json:"circulation_note"`
		CRT              string `json:"crt"`
		BloodPressure    string `json:"blood_pressure"`
		HeartRate        string `json:"heart_rate"`
		Temperature      string `json:"temperature"`
		OxygenSaturation string `json:"oxygen_saturation"`
		PainMethod       string `json:"pain_method"`
		PainScale        int    `json:"pain_scale"`
		PainLocation     string `json:"pain_location"`
		Consciousness    string `json:"consciousness"`
		GCSE             int    `json:"gcs_e"`
		GCSV             int    `json:"gcs_v"`
		GCSM             int    `json:"gcs_m"`
		TriageAssessment string `json:"triage_assessment"`
		ImmediateActions string `json:"immediate_actions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	var rmDupID uint
	row := database.DB.Raw(`
		INSERT INTO eklaim_rm_duplicates (e_klaim_local_id, visit_id, created_at, updated_at, duplicated_at, deleted_at)
		VALUES (?, ?, NOW(), NOW(), NOW(), NULL)
		ON CONFLICT (e_klaim_local_id) DO UPDATE SET deleted_at = NULL, updated_at = NOW()
		RETURNING id
	`, eklaimLocal.ID, eklaimLocal.VisitID).Row()
	if err := row.Scan(&rmDupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat/menemukan RM Duplicate: " + err.Error()})
		return
	}

	// 1. Update CasemixDB (Clinical Isolation)
	var triage models.Triage
	triageUpdates := map[string]interface{}{
		"is_casemix":        true,
		"casemix_eklaim_id": eklaimLocal.ID,
		"arrival_mode":      req.ArrivalMode,
		"triage_complaint":  req.TriageComplaint,
		"triage_level":      req.TriageLevel,
		"airway":            req.Airway,
		"airway_note":       req.AirwayNote,
		"breathing":         req.Breathing,
		"breathing_note":    req.BreathingNote,
		"breathing_rate":    req.BreathingRate,
		"circulation":       req.Circulation,
		"circulation_note":  req.CirculationNote,
		"crt":               req.CRT,
		"blood_pressure":    req.BloodPressure,
		"heart_rate":        req.HeartRate,
		"temperature":       req.Temperature,
		"oxygen_saturation": req.OxygenSaturation,
		"pain_method":       req.PainMethod,
		"pain_scale":        req.PainScale,
		"pain_location":     req.PainLocation,
		"consciousness":     req.Consciousness,
		"gcs_e":             req.GCSE,
		"gcs_v":             req.GCSV,
		"gcs_m":             req.GCSM,
		"triage_assessment": req.TriageAssessment,
		"immediate_actions": req.ImmediateActions,
	}

	if err := database.CasemixDB.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", eklaimLocal.VisitID, true, eklaimLocal.ID).First(&triage).Error; err == nil {
		database.CasemixDB.Model(&triage).Updates(triageUpdates)
	} else {
		triage = models.Triage{
			VisitID:          eklaimLocal.VisitID,
			IsCasemix:        true,
			CasemixEklaimID:  &eklaimLocal.ID,
			ArrivalMode:      req.ArrivalMode,
			TriageComplaint:  req.TriageComplaint,
			TriageLevel:      req.TriageLevel,
			Airway:           req.Airway,
			AirwayNote:       req.AirwayNote,
			Breathing:        req.Breathing,
			BreathingNote:    req.BreathingNote,
			BreathingRate:    req.BreathingRate,
			Circulation:      req.Circulation,
			CirculationNote:  req.CirculationNote,
			CRT:              req.CRT,
			BloodPressure:    req.BloodPressure,
			HeartRate:        req.HeartRate,
			Temperature:      req.Temperature,
			OxygenSaturation: req.OxygenSaturation,
			PainMethod:       req.PainMethod,
			PainScale:        req.PainScale,
			PainLocation:     req.PainLocation,
			Consciousness:    req.Consciousness,
			GCSE:             req.GCSE,
			GCSV:             req.GCSV,
			GCSM:             req.GCSM,
			TriageAssessment: req.TriageAssessment,
			ImmediateActions: req.ImmediateActions,
		}
		database.CasemixDB.Create(&triage)
	}

	// 2. Update Legacy EKlaimRMDuplicate in Main DB
	legacyUpdates := map[string]interface{}{
		"has_triage":              true,
		"triage_arrival_mode":     req.ArrivalMode,
		"triage_complaint":        req.TriageComplaint,
		"triage_level":            req.TriageLevel,
		"triage_airway":           req.Airway,
		"triage_airway_note":      req.AirwayNote,
		"triage_breathing":        req.Breathing,
		"triage_breathing_note":   req.BreathingNote,
		"triage_circulation":      req.Circulation,
		"triage_circulation_note": req.CirculationNote,
		"triage_blood_pressure":   req.BloodPressure,
		"triage_heart_rate":       req.HeartRate,
		"triage_respiratory_rate": req.BreathingRate,
		"triage_temperature":      req.Temperature,
		"triage_oxygen_sat":       req.OxygenSaturation,
		"triage_pain_scale":       req.PainScale,
		"triage_gcs_e":            req.GCSE,
		"triage_gcs_v":            req.GCSV,
		"triage_gcs_m":            req.GCSM,
		"triage_assessment":       req.TriageAssessment,
		"triage_immediate_action": req.ImmediateActions,
	}
	database.DB.Model(&models.EKlaimRMDuplicate{}).Where("id = ?", rmDupID).Updates(legacyUpdates)
	go InvalidateRMDuplicatePDFCaches(rmDupID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Triage RM Duplicate berhasil diupdate",
	})
}

// RecalculateRMDuplicateBilling manually recalculates billing for an RM Duplicate.
// POST /eklaim-local/rm-duplicate/:id/recalculate-billing
// Useful when billing data is missing or needs to be refreshed.
func RecalculateRMDuplicateBilling(c *gin.Context) {
	rmDupID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.First(&rmDup, rmDupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "RM Duplicate tidak ditemukan"})
		return
	}

	if rmDup.VisitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "RM Duplicate belum terhubung dengan visit"})
		return
	}

	// Recalculate billing
	tx := database.DB.Begin()
	if err := RecalculateEKlaimRMBilling(tx, rmDup.ID, rmDup.VisitID); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal kalkulasi billing: " + err.Error()})
		return
	}
	tx.Commit()

	// Reload with billing data
	database.DB.Preload("Billing.Items").First(&rmDup, rmDup.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Billing berhasil dihitung ulang",
		"billing": rmDup.Billing,
	})
}

// InitRMDuplicate creates or returns existing RM Duplicate for an eklaim_local.
// POST /eklaim-local/:id/init-rm-duplicate
// Used when the RM Duplicate wasn't created during CreateClaimFromSEP (or was lost).
func InitRMDuplicate(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.Preload("SEP").First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	// Check if already exists
	var existing models.EKlaimRMDuplicate
	existingFound := database.DB.Where("e_klaim_local_id = ?", eklaimLocal.ID).
		Preload("Diagnoses").Preload("Procedures").
		Preload("Orders.Items.Procedure.Parameters").Preload("Orders.Items.Results.ProcedureParameter").
		Preload("MedicineItems.Medicine").
		Preload("CPPTNotes").Preload("NursingCares").Preload("FluidBalances").
		Preload("Billing.Items").
		First(&existing).Error == nil

	// If already exists AND has data, return as-is
	if existingFound && existing.ChiefComplaint != "" {
		c.JSON(http.StatusOK, gin.H{
			"message":      "RM Duplicate sudah ada",
			"rm_duplicate": existing,
		})
		return
	}

	visitID := eklaimLocal.VisitID
	if visitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EKlaim local belum terhubung dengan visit"})
		return
	}

	// If exists but empty, re-sync from original RM
	if existingFound {
		// Load original RM data
		var diagnoses []models.Diagnosis
		database.DB.Where("visit_id = ?", visitID).Order("type ASC, created_at ASC").Find(&diagnoses)

		var visitProcedures []models.VisitProcedure
		database.DB.Where("visit_id = ?", visitID).Preload("Procedure").Find(&visitProcedures)

		var anamnesis models.Anamnesis
		database.DB.Where("visit_id = ?", visitID).First(&anamnesis)

		var physicalExam models.PhysicalExamination
		database.DB.Where("visit_id = ?", visitID).First(&physicalExam)

		var assessmentPlan models.AssessmentPlan
		database.DB.Where("visit_id = ?", visitID).First(&assessmentPlan)

		var disposition models.Disposition
		database.DB.Where("visit_id = ?", visitID).First(&disposition)

		origDiagJSON, _ := json.Marshal(diagnoses)
		origProcJSON, _ := json.Marshal(visitProcedures)
		origRMJSON, _ := json.Marshal(map[string]interface{}{
			"anamnesis":       anamnesis,
			"physical_exam":   physicalExam,
			"assessment_plan": assessmentPlan,
			"disposition":     disposition,
		})

		// Load triage for re-sync too (also checks same-registration emergency visit)
		reSyncTriagePtr, reSyncHasTriage := findTriageForVisit(visitID)
		var reSyncTriage models.Triage
		if reSyncHasTriage {
			reSyncTriage = *reSyncTriagePtr
		}

		// Update existing record fields
		updates := map[string]interface{}{
			"original_diagnoses_json":  string(origDiagJSON),
			"original_procedures_json": string(origProcJSON),
			"original_rm_json":         string(origRMJSON),
			// Anamnesis
			"chief_complaint":            anamnesis.ChiefComplaint,
			"history_of_present_illness": anamnesis.HistoryOfPresentIllness,
			"past_medical_history":       anamnesis.PastMedicalHistory,
			"family_history":             anamnesis.FamilyHistory,
			"allergies":                  anamnesis.Allergies,
			"current_medications":        anamnesis.CurrentMedications,
			// Physical Exam
			"general_condition": physicalExam.GeneralCondition,
			"consciousness":     physicalExam.Consciousness,
			"blood_pressure":    physicalExam.BloodPressure,
			"systolic":          physicalExam.Systolic,
			"diastolic":         physicalExam.Diastolic,
			"heart_rate":        physicalExam.HeartRate,
			"respiratory_rate":  physicalExam.RespiratoryRate,
			"temperature":       physicalExam.Temperature,
			"oxygen_saturation": physicalExam.OxygenSaturation,
			"weight":            physicalExam.Weight,
			"height":            physicalExam.Height,
			"bmi":               physicalExam.BMI,
			"head_neck":         physicalExam.HeadNeck,
			"eyes":              physicalExam.Eyes,
			"ent":               physicalExam.ENT,
			"thorax":            physicalExam.Thorax,
			"cardiac":           physicalExam.Cardiac,
			"pulmonary":         physicalExam.Pulmonary,
			"abdomen":           physicalExam.Abdomen,
			"extremities":       physicalExam.Extremities,
			"neurological":      physicalExam.Neurological,
			"skin":              physicalExam.Skin,
			// Assessment & Plan
			"clinical_assessment": assessmentPlan.ClinicalAssessment,
			"prognosis":           assessmentPlan.Prognosis,
			"treatment_plan":      assessmentPlan.TreatmentPlan,
			"medication_plan":     assessmentPlan.MedicationPlan,
			// Disposition
			"disposition_type":      disposition.DispositionType,
			"rm_discharge_status":   disposition.DischargeStatus,
			"discharge_condition":   disposition.DischargeCondition,
			"discharge_instruction": disposition.DischargeInstruction,
			"follow_up_instruction": disposition.FollowUpInstruction,
			// Triage
			"has_triage": reSyncHasTriage,
		}
		if reSyncHasTriage {
			updates["triage_arrival_mode"] = reSyncTriage.ArrivalMode
			updates["triage_complaint"] = reSyncTriage.TriageComplaint
			updates["triage_level"] = reSyncTriage.TriageLevel
			updates["triage_airway"] = reSyncTriage.Airway
			updates["triage_airway_note"] = reSyncTriage.AirwayNote
			updates["triage_breathing"] = reSyncTriage.Breathing
			updates["triage_breathing_note"] = reSyncTriage.BreathingNote
			updates["triage_circulation"] = reSyncTriage.Circulation
			updates["triage_circulation_note"] = reSyncTriage.CirculationNote
			updates["triage_blood_pressure"] = reSyncTriage.BloodPressure
			updates["triage_heart_rate"] = reSyncTriage.HeartRate
			updates["triage_respiratory_rate"] = reSyncTriage.BreathingRate
			updates["triage_temperature"] = reSyncTriage.Temperature
			updates["triage_oxygen_sat"] = reSyncTriage.OxygenSaturation
			updates["triage_pain_scale"] = reSyncTriage.PainScale
			updates["triage_gcs_e"] = reSyncTriage.GCSE
			updates["triage_gcs_v"] = reSyncTriage.GCSV
			updates["triage_gcs_m"] = reSyncTriage.GCSM
			updates["triage_assessment"] = reSyncTriage.TriageAssessment
			updates["triage_immediate_action"] = reSyncTriage.ImmediateActions
		}
		database.DB.Model(&existing).Updates(updates)

		// Re-sync diagnoses if empty
		if len(existing.Diagnoses) == 0 && len(diagnoses) > 0 {
			for i, d := range diagnoses {
				database.DB.Create(&models.EKlaimRMDiagnosis{
					RMDuplicateID: existing.ID,
					ICD10Code:     d.ICD10Code,
					ICD10Name:     d.ICD10Name,
					Type:          d.Type,
					Sequence:      i + 1,
				})
			}
		}

		// Re-sync procedures if empty
		if len(existing.Procedures) == 0 && len(visitProcedures) > 0 {
			for i, vp := range visitProcedures {
				var icd9Code, procName string
				if vp.Procedure != nil {
					icd9Code = vp.Procedure.ICD9CMCode
					procName = vp.Procedure.Name
				}
				database.DB.Create(&models.EKlaimRMProcedure{
					RMDuplicateID: existing.ID,
					ICD9Code:      icd9Code,
					Name:          procName,
					Sequence:      i + 1,
				})
			}
		}

		// Re-sync orders if empty
		if len(existing.Orders) == 0 {
			var allProcOrders []models.ProcedureOrder
			database.DB.Where("source_visit_id = ? AND status = ?", visitID, models.ProcedureOrderStatusCompleted).
				Preload("Items.Procedure").
				Preload("Items.Results.ProcedureParameter").
				Preload("Consultation.Consultant").
				Preload("SurgeonDoctor").
				Order("order_type ASC, created_at ASC").
				Find(&allProcOrders)

			for orderSeq, order := range allProcOrders {
				srcOrderID := order.ID
				rmOrder := models.EKlaimRMOrder{
					RMDuplicateID: existing.ID,
					OrderType:     order.OrderType,
					SourceOrderID: &srcOrderID,
					OrderNumber:   order.OrderNumber,
					Priority:      order.Priority,
					ClinicalNotes: order.ClinicalNotes,
					Diagnosis:     order.Diagnosis,
					Notes:         order.Notes,
					ResultSummary: order.ResultSummary,
					Conclusion:    order.Conclusion,
					Suggestion:    order.Suggestion,
					IsCritical:    order.IsCritical,
					CriticalNotes: order.CriticalNotes,
					Sequence:      orderSeq + 1,
				}
				if order.OrderType == "surgery" && order.SurgeonDoctor != nil {
					rmOrder.SurgeonName = order.SurgeonDoctor.NamaLengkap
					rmOrder.ScheduledDate = order.ScheduledDate
				}
				if order.OrderType == "consultation" && order.Consultation != nil {
					if order.Consultation.Consultant != nil {
						rmOrder.ConsultantName = order.Consultation.Consultant.NamaLengkap
					}
					rmOrder.Subjective = order.Consultation.Subjective
					rmOrder.Objective = order.Consultation.Objective
					rmOrder.Assessment = order.Consultation.Assessment
					rmOrder.Plan = order.Consultation.Plan
					rmOrder.Recommendation = order.Consultation.Recommendation
				}
				database.DB.Create(&rmOrder)

				for itemSeq, item := range order.Items {
					srcItemID := item.ID
					procName := ""
					if item.Procedure != nil {
						procName = item.Procedure.Name
					}
					rmItem := models.EKlaimRMOrderItem{
						EKlaimRMOrderID: rmOrder.ID,
						ProcedureID:     item.ProcedureID,
						ProcedureName:   procName,
						SourceItemID:    &srcItemID,
						Notes:           item.Notes,
						Sequence:        itemSeq + 1,
					}
					database.DB.Create(&rmItem)

					for resSeq, result := range item.Results {
						srcResultID := result.ID
						paramName := ""
						if result.ProcedureParameter != nil {
							paramName = result.ProcedureParameter.Name
						}
						database.DB.Create(&models.EKlaimRMOrderResult{
							EKlaimRMOrderItemID:  rmItem.ID,
							ProcedureParameterID: result.ProcedureParameterID,
							ParameterName:        paramName,
							SourceResultID:       &srcResultID,
							Value:                result.Value,
							NumericValue:         result.NumericValue,
							IsNormal:             result.IsNormal,
							IsLow:                result.IsLow,
							IsHigh:               result.IsHigh,
							IsCritical:           result.IsCritical,
							Notes:                result.Notes,
							Sequence:             resSeq + 1,
						})
					}
				}
			}
		}

		// Reload with updated data
		database.DB.Preload("Diagnoses").Preload("Procedures").
			Preload("Orders.Items.Procedure.Parameters").Preload("Orders.Items.Results.ProcedureParameter").
			Preload("MedicineItems.Medicine").
			Preload("CPPTNotes").Preload("NursingCares").Preload("FluidBalances").
			Preload("Billing.Items").
			First(&existing, existing.ID)

		c.JSON(http.StatusOK, gin.H{
			"message":      "RM Duplicate berhasil di-sync ulang dari RM asli",
			"rm_duplicate": existing,
		})
		return
	}

	// Load original RM data
	var diagnoses []models.Diagnosis
	database.DB.Where("visit_id = ?", visitID).Order("type ASC, created_at ASC").Find(&diagnoses)

	var visitProcedures []models.VisitProcedure
	database.DB.Where("visit_id = ?", visitID).Preload("Procedure").Find(&visitProcedures)

	var anamnesis models.Anamnesis
	database.DB.Where("visit_id = ?", visitID).First(&anamnesis)

	var physicalExam models.PhysicalExamination
	database.DB.Where("visit_id = ?", visitID).First(&physicalExam)

	var assessmentPlan models.AssessmentPlan
	database.DB.Where("visit_id = ?", visitID).First(&assessmentPlan)

	var disposition models.Disposition
	database.DB.Where("visit_id = ?", visitID).First(&disposition)

	origDiagJSON, _ := json.Marshal(diagnoses)
	origProcJSON, _ := json.Marshal(visitProcedures)
	origRMJSON, _ := json.Marshal(map[string]interface{}{
		"anamnesis":       anamnesis,
		"physical_exam":   physicalExam,
		"assessment_plan": assessmentPlan,
		"disposition":     disposition,
	})

	userID := getUserIDValue(c)
	now := time.Now()

	rmDup := models.EKlaimRMDuplicate{
		EKlaimLocalID:          eklaimLocal.ID,
		VisitID:                visitID,
		OriginalDiagnosesJSON:  string(origDiagJSON),
		OriginalProceduresJSON: string(origProcJSON),
		OriginalRMJSON:         string(origRMJSON),
		DuplicatedAt:           &now,
		// Anamnesis
		ChiefComplaint:          anamnesis.ChiefComplaint,
		HistoryOfPresentIllness: anamnesis.HistoryOfPresentIllness,
		PastMedicalHistory:      anamnesis.PastMedicalHistory,
		FamilyHistory:           anamnesis.FamilyHistory,
		Allergies:               anamnesis.Allergies,
		CurrentMedications:      anamnesis.CurrentMedications,
		// Physical Exam
		GeneralCondition: physicalExam.GeneralCondition,
		Consciousness:    physicalExam.Consciousness,
		BloodPressure:    physicalExam.BloodPressure,
		Systolic:         physicalExam.Systolic,
		Diastolic:        physicalExam.Diastolic,
		HeartRate:        physicalExam.HeartRate,
		RespiratoryRate:  physicalExam.RespiratoryRate,
		Temperature:      physicalExam.Temperature,
		OxygenSaturation: physicalExam.OxygenSaturation,
		Weight:           physicalExam.Weight,
		Height:           physicalExam.Height,
		BMI:              physicalExam.BMI,
		HeadNeck:         physicalExam.HeadNeck,
		Eyes:             physicalExam.Eyes,
		ENT:              physicalExam.ENT,
		Thorax:           physicalExam.Thorax,
		Cardiac:          physicalExam.Cardiac,
		Pulmonary:        physicalExam.Pulmonary,
		Abdomen:          physicalExam.Abdomen,
		Extremities:      physicalExam.Extremities,
		Neurological:     physicalExam.Neurological,
		Skin:             physicalExam.Skin,
		// Assessment
		ClinicalAssessment: assessmentPlan.ClinicalAssessment,
		Prognosis:          assessmentPlan.Prognosis,
		TreatmentPlan:      assessmentPlan.TreatmentPlan,
		MedicationPlan:     assessmentPlan.MedicationPlan,
		// Disposition
		DispositionType:      disposition.DispositionType,
		DischargeStatus:      disposition.DischargeStatus,
		DischargeCondition:   disposition.DischargeCondition,
		DischargeInstruction: disposition.DischargeInstruction,
		FollowUpInstruction:  disposition.FollowUpInstruction,
	}
	if userID > 0 {
		rmDup.DuplicatedByID = &userID
	}

	if err := database.DB.Create(&rmDup).Error; err != nil {
		// Handle race condition: if another request already created the record, load and re-sync it
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "23505") {
			var raceExisting models.EKlaimRMDuplicate
			if database.DB.Where("e_klaim_local_id = ?", eklaimLocal.ID).First(&raceExisting).Error == nil {
				// Re-sync fields
				database.DB.Model(&raceExisting).Updates(map[string]interface{}{
					"chief_complaint": anamnesis.ChiefComplaint, "history_of_present_illness": anamnesis.HistoryOfPresentIllness,
					"past_medical_history": anamnesis.PastMedicalHistory, "family_history": anamnesis.FamilyHistory,
					"allergies": anamnesis.Allergies, "current_medications": anamnesis.CurrentMedications,
					"general_condition": physicalExam.GeneralCondition, "consciousness": physicalExam.Consciousness,
					"blood_pressure": physicalExam.BloodPressure, "systolic": physicalExam.Systolic, "diastolic": physicalExam.Diastolic,
					"heart_rate": physicalExam.HeartRate, "respiratory_rate": physicalExam.RespiratoryRate,
					"temperature": physicalExam.Temperature, "oxygen_saturation": physicalExam.OxygenSaturation,
					"weight": physicalExam.Weight, "height": physicalExam.Height, "bmi": physicalExam.BMI,
					"clinical_assessment": assessmentPlan.ClinicalAssessment, "prognosis": assessmentPlan.Prognosis,
					"treatment_plan": assessmentPlan.TreatmentPlan, "medication_plan": assessmentPlan.MedicationPlan,
					"disposition_type": disposition.DispositionType, "rm_discharge_status": disposition.DischargeStatus,
					"discharge_condition": disposition.DischargeCondition, "discharge_instruction": disposition.DischargeInstruction,
					"follow_up_instruction": disposition.FollowUpInstruction,
				})
				database.DB.Preload("Diagnoses").Preload("Procedures").
					Preload("Orders.Items.Procedure.Parameters").Preload("Orders.Items.Results.ProcedureParameter").
					Preload("MedicineItems.Medicine").
					Preload("CPPTNotes").Preload("NursingCares").Preload("FluidBalances").
					Preload("Billing.Items").
					First(&raceExisting, raceExisting.ID)
				c.JSON(http.StatusOK, gin.H{"message": "RM Duplicate berhasil di-sync", "rm_duplicate": raceExisting})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat RM Duplicate: " + err.Error()})
		return
	}

	// Copy diagnoses
	for i, d := range diagnoses {
		database.DB.Create(&models.EKlaimRMDiagnosis{
			RMDuplicateID: rmDup.ID,
			ICD10Code:     d.ICD10Code,
			ICD10Name:     d.ICD10Name,
			Type:          d.Type,
			Sequence:      i + 1,
		})
	}

	// Copy procedures
	for i, vp := range visitProcedures {
		var icd9Code, procName string
		if vp.Procedure != nil {
			icd9Code = vp.Procedure.ICD9CMCode
			procName = vp.Procedure.Name
		}
		database.DB.Create(&models.EKlaimRMProcedure{
			RMDuplicateID: rmDup.ID,
			ICD9Code:      icd9Code,
			Name:          procName,
			Sequence:      i + 1,
		})
	}

	// Copy all procedure orders (lab, radiology, surgery, consultation)
	var allProcOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ? AND status = ?", visitID, models.ProcedureOrderStatusCompleted).
		Preload("Items.Procedure").
		Preload("Items.Results.ProcedureParameter").
		Preload("Consultation.Consultant").
		Preload("SurgeonDoctor").
		Order("order_type ASC, created_at ASC").
		Find(&allProcOrders)

	for orderSeq, order := range allProcOrders {
		srcOrderID := order.ID
		rmOrder := models.EKlaimRMOrder{
			RMDuplicateID: rmDup.ID,
			OrderType:     order.OrderType,
			SourceOrderID: &srcOrderID,
			OrderNumber:   order.OrderNumber,
			Priority:      order.Priority,
			ClinicalNotes: order.ClinicalNotes,
			Diagnosis:     order.Diagnosis,
			Notes:         order.Notes,
			ResultSummary: order.ResultSummary,
			Conclusion:    order.Conclusion,
			Suggestion:    order.Suggestion,
			IsCritical:    order.IsCritical,
			CriticalNotes: order.CriticalNotes,
			Sequence:      orderSeq + 1,
		}
		if order.OrderType == "surgery" && order.SurgeonDoctor != nil {
			rmOrder.SurgeonName = order.SurgeonDoctor.NamaLengkap
			rmOrder.ScheduledDate = order.ScheduledDate
		}
		if order.OrderType == "consultation" && order.Consultation != nil {
			if order.Consultation.Consultant != nil {
				rmOrder.ConsultantName = order.Consultation.Consultant.NamaLengkap
			}
			rmOrder.Subjective = order.Consultation.Subjective
			rmOrder.Objective = order.Consultation.Objective
			rmOrder.Assessment = order.Consultation.Assessment
			rmOrder.Plan = order.Consultation.Plan
			rmOrder.Recommendation = order.Consultation.Recommendation
		}
		database.DB.Create(&rmOrder)

		for itemSeq, item := range order.Items {
			srcItemID := item.ID
			procName := ""
			if item.Procedure != nil {
				procName = item.Procedure.Name
			}
			rmItem := models.EKlaimRMOrderItem{
				EKlaimRMOrderID: rmOrder.ID,
				ProcedureID:     item.ProcedureID,
				ProcedureName:   procName,
				SourceItemID:    &srcItemID,
				Notes:           item.Notes,
				Sequence:        itemSeq + 1,
			}
			database.DB.Create(&rmItem)

			for resSeq, result := range item.Results {
				srcResultID := result.ID
				paramName := ""
				if result.ProcedureParameter != nil {
					paramName = result.ProcedureParameter.Name
				}
				database.DB.Create(&models.EKlaimRMOrderResult{
					EKlaimRMOrderItemID:  rmItem.ID,
					ProcedureParameterID: result.ProcedureParameterID,
					ParameterName:        paramName,
					SourceResultID:       &srcResultID,
					Value:                result.Value,
					NumericValue:         result.NumericValue,
					IsNormal:             result.IsNormal,
					IsLow:                result.IsLow,
					IsHigh:               result.IsHigh,
					IsCritical:           result.IsCritical,
					Notes:                result.Notes,
					Sequence:             resSeq + 1,
				})
			}
		}
	}

	// Reload with relations
	database.DB.Preload("Diagnoses").Preload("Procedures").
		Preload("Orders.Items.Procedure.Parameters").Preload("Orders.Items.Results.ProcedureParameter").
		Preload("MedicineItems.Medicine").
		Preload("CPPTNotes").Preload("NursingCares").Preload("FluidBalances").
		Preload("Billing.Items").
		First(&rmDup, rmDup.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message":      "RM Duplicate berhasil dibuat",
		"rm_duplicate": rmDup,
	})
}

// SendNewClaim sends new_claim to the E-Klaim local server.
// POST /eklaim-local/:id/new-claim
// Precondition: eklaim_local record must exist, SEP must have visit
func SendNewClaim(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.Preload("SEP").Preload("SEP.Patient").First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	// Validate status - should be draft or has previous error
	if eklaimLocal.NewClaimSuccess {
		c.JSON(http.StatusConflict, gin.H{
			"error":  "new_claim sudah berhasil sebelumnya",
			"status": eklaimLocal.Status,
		})
		return
	}

	// Build new_claim data
	sep := eklaimLocal.SEP
	if sep == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SEP data tidak ditemukan"})
		return
	}

	// Resolve patient data: SEP first, fallback to master Patient
	patient := sep.Patient

	nomorKartu := sep.NoKartu
	nomorRM := sep.NoMR
	namaPasien := sep.NamaPasien

	gender := 0
	if sep.JenisKelamin == "L" {
		gender = 1
	} else if sep.JenisKelamin == "P" {
		gender = 2
	}

	tglLahir := sep.TglLahir

	// Fallback ke master data pasien jika field SEP kosong
	if patient != nil {
		if namaPasien == "" {
			namaPasien = patient.NamaLengkap
		}
		if nomorRM == "" {
			nomorRM = patient.NoRM
		}
		if tglLahir == "" && patient.TanggalLahir != nil {
			tglLahir = patient.TanggalLahir.Format("2006-01-02")
		}
		if gender == 0 {
			if patient.JenisKelamin == "L" {
				gender = 1
			} else if patient.JenisKelamin == "P" {
				gender = 2
			}
		}
	}

	// Format tgl_lahir: "1940-01-01 00:00:00" (per dokumentasi)
	if len(tglLahir) == 10 {
		tglLahir = tglLahir + " 00:00:00"
	}

	claimData := eklaimSvc.NewClaimData{
		NomorKartu: nomorKartu,
		NomorSEP:   sep.NoSEP,
		NomorRM:    nomorRM,
		NamaPasien: namaPasien,
		TglLahir:   tglLahir,
		Gender:     gender,
	}

	// Create client and send
	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.NewClaim(claimData)

	// Log the API call
	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "new_claim",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	// Update eklaim_local status
	now := time.Now()
	eklaimLocal.NewClaimSentAt = &now
	eklaimLocal.NewClaimResponse = string(respJSON)

	if apiErr != nil {
		eklaimLocal.NewClaimSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "new_claim gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
		})
		return
	}

	eklaimLocal.NewClaimSuccess = true
	eklaimLocal.Status = "new_claim"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "new_claim berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
	})
}

// SendUpdatePatient sends update_patient to the E-Klaim local server.
// POST /eklaim-local/:id/update-patient
// Memperbarui data pasien (nama, tgl_lahir, gender) pada klaim yang sudah dibuat.
func SendUpdatePatient(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	// Accept optional overrides from request body
	var req struct {
		NomorKartu string `json:"nomor_kartu"`
		NomorRM    string `json:"nomor_rm"`
		NamaPasien string `json:"nama_pasien"`
		TglLahir   string `json:"tgl_lahir"`
		Gender     *int   `json:"gender"`
	}
	c.ShouldBindJSON(&req)

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.Preload("SEP").Preload("SEP.Patient").First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	// Validate: new_claim harus sudah berhasil
	if !eklaimLocal.NewClaimSuccess {
		c.JSON(http.StatusConflict, gin.H{
			"error": "new_claim belum berhasil, tidak bisa update_patient",
		})
		return
	}

	sep := eklaimLocal.SEP
	if sep == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SEP data tidak ditemukan"})
		return
	}

	// Resolve patient data: SEP first, fallback to master Patient, then override from request
	patient := sep.Patient

	// Default from SEP
	nomorKartu := sep.NoKartu
	nomorRM := sep.NoMR
	namaPasien := sep.NamaPasien

	gender := 0
	if sep.JenisKelamin == "L" {
		gender = 1
	} else if sep.JenisKelamin == "P" {
		gender = 2
	}

	tglLahir := sep.TglLahir

	// Fallback ke master data pasien jika field SEP kosong
	if patient != nil {
		if namaPasien == "" {
			namaPasien = patient.NamaLengkap
		}
		if nomorRM == "" {
			nomorRM = patient.NoRM
		}
		if tglLahir == "" && patient.TanggalLahir != nil {
			tglLahir = patient.TanggalLahir.Format("2006-01-02")
		}
		if gender == 0 {
			if patient.JenisKelamin == "L" {
				gender = 1
			} else if patient.JenisKelamin == "P" {
				gender = 2
			}
		}
	}

	// Override from request body
	if req.NomorKartu != "" {
		nomorKartu = req.NomorKartu
	}
	if req.NomorRM != "" {
		nomorRM = req.NomorRM
	}
	if req.NamaPasien != "" {
		namaPasien = req.NamaPasien
	}
	if req.Gender != nil {
		gender = *req.Gender
	}
	if req.TglLahir != "" {
		tglLahir = req.TglLahir
	}

	// Format tgl_lahir: "1940-01-01 00:00:00" (per dokumentasi)
	if len(tglLahir) == 10 {
		tglLahir = tglLahir + " 00:00:00"
	}

	claimData := eklaimSvc.NewClaimData{
		NomorKartu: nomorKartu,
		NomorSEP:   sep.NoSEP,
		NomorRM:    nomorRM,
		NamaPasien: namaPasien,
		TglLahir:   tglLahir,
		Gender:     gender,
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.UpdatePatient(claimData)

	// Log the API call
	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "update_patient",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	if apiErr != nil {
		now := time.Now()
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "update_patient gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "update_patient berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
	})
}

// SendSetClaimData sends set_claim_data to the E-Klaim local server.
// POST /eklaim-local/:id/set-claim-data
// Body: set_claim_data fields (tarif, cara_masuk, etc.)
func SendSetClaimData(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.
		Preload("RMDuplicate").
		Preload("RMDuplicate.Diagnoses").
		Preload("RMDuplicate.Procedures").
		Preload("RMDuplicate.Billing.Items").
		Preload("SEP").
		First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	// Validate - new_claim must have succeeded first
	if !eklaimLocal.NewClaimSuccess {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Harus new_claim terlebih dahulu"})
		return
	}

	// Parse the request body which contains editable set_claim_data fields
	var req eklaimSvc.SetClaimDataData
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Override nomor_sep and nomor_kartu from our record
	req.NomorSEP = eklaimLocal.NoSEP
	req.NomorKartu = eklaimLocal.NoKartu

	// Auto-populate from RM Duplicate if present
	if rm := eklaimLocal.RMDuplicate; rm != nil {
		// Sistole & Diastole from RM vitals
		if rm.Systolic > 0 && req.Sistole == 0 {
			req.Sistole = rm.Systolic
		}
		if rm.Diastolic > 0 && req.Diastole == 0 {
			req.Diastole = rm.Diastolic
		}

		// Build tarif_rs from RM Duplicate breakdown
		if req.TarifRS == nil {
			req.TarifRS = &eklaimSvc.TarifRSDetail{}
		}
		// Only fill tarif_rs breakdown if all zeros (not yet set from request)
		if req.TarifRS.ProsedurNonBedah == "" || req.TarifRS.ProsedurNonBedah == "0" {
			req.TarifRS.ProsedurNonBedah = fmt.Sprintf("%.0f", rm.TarifProsedurNonBedah)
			req.TarifRS.ProsedurBedah = fmt.Sprintf("%.0f", rm.TarifProsedurBedah)
			req.TarifRS.Konsultasi = fmt.Sprintf("%.0f", rm.TarifKonsultasi)
			req.TarifRS.TenagaAhli = fmt.Sprintf("%.0f", rm.TarifTenagaAhli)
			req.TarifRS.Keperawatan = fmt.Sprintf("%.0f", rm.TarifKeperawatan)
			req.TarifRS.Penunjang = fmt.Sprintf("%.0f", rm.TarifPenunjang)
			req.TarifRS.Radiologi = fmt.Sprintf("%.0f", rm.TarifRadiologi)
			req.TarifRS.Laboratorium = fmt.Sprintf("%.0f", rm.TarifLaboratorium)
			req.TarifRS.PelayananDarah = fmt.Sprintf("%.0f", rm.TarifPelayananDarah)
			req.TarifRS.Rehabilitasi = fmt.Sprintf("%.0f", rm.TarifRehabilitasi)
			req.TarifRS.Kamar = fmt.Sprintf("%.0f", rm.TarifKamar)
			req.TarifRS.RawatIntensif = fmt.Sprintf("%.0f", rm.TarifRawatIntensif)
			req.TarifRS.Obat = fmt.Sprintf("%.0f", rm.TarifObat)
			req.TarifRS.ObatKronis = fmt.Sprintf("%.0f", rm.TarifObatKronis)
			req.TarifRS.ObatKemoterapi = fmt.Sprintf("%.0f", rm.TarifObatKemoterapi)
			req.TarifRS.Alkes = fmt.Sprintf("%.0f", rm.TarifAlkes)
			req.TarifRS.BMHP = fmt.Sprintf("%.0f", rm.TarifBMHP)
			req.TarifRS.SewaAlat = fmt.Sprintf("%.0f", rm.TarifSewaAlat)
		}

		// Store diagnosa/procedure comma-separated for eklaim_local reference
		var diagCodes []string
		for _, d := range rm.Diagnoses {
			if d.ICD10Code != "" {
				diagCodes = append(diagCodes, d.ICD10Code)
			}
		}
		if len(diagCodes) > 0 {
			eklaimLocal.Diagnosa = strings.Join(diagCodes, ",")
		}
		var procCodes []string
		for _, p := range rm.Procedures {
			if p.ICD9Code != "" {
				procCodes = append(procCodes, p.ICD9Code)
			}
		}
		if len(procCodes) > 0 {
			eklaimLocal.Procedure = strings.Join(procCodes, ",")
		}
	}

	// === Save form data to DB FIRST (before E-Klaim call) ===
	// Use Updates with explicit map to avoid GORM association save issues
	formFields := map[string]interface{}{
		"form_data_saved":      true,
		"tgl_masuk":            req.TglMasuk,
		"tgl_pulang":           req.TglPulang,
		"cara_masuk":           req.CaraMasuk,
		"jenis_rawat":          req.JenisRawat,
		"kelas_rawat":          req.KelasRawat,
		"discharge_status":     req.DischargeStatus,
		"icu_indikator":        req.ICUIndikator,
		"icu_los":              req.ICULOS,
		"ventilator_hour":      req.VentilatorHour,
		"birth_weight":         req.BirthWeight,
		"adl_sub_acute":        req.ADLSubAcute,
		"adl_chronic":          req.ADLChronic,
		"upgrade_class_ind":    req.UpgradeClassInd,
		"upgrade_class_class":  req.UpgradeClassClass,
		"upgrade_class_los":    req.UpgradeClassLOS,
		"upgrade_class_payor":  req.UpgradeClassPayor,
		"add_payment_pct":      req.AddPaymentPct,
		"coder_nik":            req.CoderNIK,
		"sistole":              req.Sistole,
		"diastole":             req.Diastole,
		"kode_tarif":           req.KodeTarif,
		"payor_id":             req.PayorID,
		"payor_cd":             req.PayorCd,
		"cob_cd":               req.CobCd,
		"nama_dokter":          req.NamaDokter,
		"tarif_poli_eks":       req.TarifPoliEks,
		"nomor_kartu_t":        req.NomorKartuT,
		"bayi_lahir_status_cd": req.BayiLahirStatusCd,
		"dializer_single_use":  req.DializerSingleUse,
		"kantong_darah":        req.KantongDarah,
		"alteplase_ind":        req.AlteplaseInd,
		"diagnosa":             eklaimLocal.Diagnosa,
		"procedure":            eklaimLocal.Procedure,
	}

	// Ventilator detail
	if vd, ok := req.Ventilator.(*eklaimSvc.VentilatorDetail); ok && vd != nil {
		formFields["ventilator_use_ind"] = vd.UseInd
		formFields["ventilator_start"] = vd.StartDttm
		formFields["ventilator_stop"] = vd.StopDttm
	} else if vdMap, ok := req.Ventilator.(map[string]interface{}); ok {
		if v, ok := vdMap["use_ind"].(string); ok {
			formFields["ventilator_use_ind"] = v
		}
		if v, ok := vdMap["start_dttm"].(string); ok {
			formFields["ventilator_start"] = v
		}
		if v, ok := vdMap["stop_dttm"].(string); ok {
			formFields["ventilator_stop"] = v
		}
	}

	// APGAR
	if req.Apgar != nil {
		if req.Apgar.Menit1 != nil {
			formFields["apgar_menit1_appearance"] = req.Apgar.Menit1.Appearance
			formFields["apgar_menit1_pulse"] = req.Apgar.Menit1.Pulse
			formFields["apgar_menit1_grimace"] = req.Apgar.Menit1.Grimace
			formFields["apgar_menit1_activity"] = req.Apgar.Menit1.Activity
			formFields["apgar_menit1_respiration"] = req.Apgar.Menit1.Respiration
		}
		if req.Apgar.Menit5 != nil {
			formFields["apgar_menit5_appearance"] = req.Apgar.Menit5.Appearance
			formFields["apgar_menit5_pulse"] = req.Apgar.Menit5.Pulse
			formFields["apgar_menit5_grimace"] = req.Apgar.Menit5.Grimace
			formFields["apgar_menit5_activity"] = req.Apgar.Menit5.Activity
			formFields["apgar_menit5_respiration"] = req.Apgar.Menit5.Respiration
		}
	}

	// Persalinan
	if req.Persalinan != nil {
		formFields["persalinan_usia_kehamilan"] = req.Persalinan.UsiaKehamilan
		formFields["persalinan_gravida"] = req.Persalinan.Gravida
		formFields["persalinan_partus"] = req.Persalinan.Partus
		formFields["persalinan_abortus"] = req.Persalinan.Abortus
		formFields["persalinan_onset_kontraksi"] = req.Persalinan.OnsetKontraksi
		if len(req.Persalinan.Delivery) > 0 {
			deliveryJSON, _ := json.Marshal(req.Persalinan.Delivery)
			formFields["persalinan_delivery_json"] = string(deliveryJSON)
		}
	}

	// Persist form data to DB — use Updates (map) to avoid GORM association issues
	if saveErr := database.DB.Model(&models.EKlaimLocal{}).Where("id = ?", eklaimLocal.ID).Updates(formFields).Error; saveErr != nil {
		log.Printf("[SendSetClaimData] ERROR saving form data for ID %d: %v", eklaimLocal.ID, saveErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data form ke database: " + saveErr.Error()})
		return
	}
	log.Printf("[SendSetClaimData] Form data saved to DB for ID %d (tgl_masuk=%s, tgl_pulang=%s)", eklaimLocal.ID, req.TglMasuk, req.TglPulang)

	// Also update the in-memory struct for response
	eklaimLocal.FormDataSaved = true
	eklaimLocal.TglMasuk = req.TglMasuk
	eklaimLocal.TglPulang = req.TglPulang
	eklaimLocal.CaraMasuk = req.CaraMasuk
	eklaimLocal.JenisRawat = req.JenisRawat
	eklaimLocal.KelasRawat = req.KelasRawat
	eklaimLocal.DischargeStatus = req.DischargeStatus

	// Create client and send to E-Klaim server
	client, err := eklaimSvc.NewClient()
	if err != nil {
		now := time.Now()
		database.DB.Model(&models.EKlaimLocal{}).Where("id = ?", eklaimLocal.ID).Updates(map[string]interface{}{
			"last_error":    "Gagal koneksi ke server E-Klaim: " + err.Error(),
			"last_error_at": now,
		})
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":        "Gagal koneksi ke server E-Klaim: " + err.Error(),
			"eklaim_local": eklaimLocal,
		})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.SetClaimData(req)

	// Log
	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "set_claim_data",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	// Update eklaim_local status based on E-Klaim result
	now := time.Now()

	if apiErr != nil {
		database.DB.Model(&models.EKlaimLocal{}).Where("id = ?", eklaimLocal.ID).Updates(map[string]interface{}{
			"set_claim_data_sent_at":  now,
			"set_claim_data_response": string(respJSON),
			"set_claim_data_success":  false,
			"last_error":              apiErr.Error(),
			"last_error_at":           now,
		})
		eklaimLocal.SetClaimDataSentAt = &now
		eklaimLocal.SetClaimDataSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		log.Printf("[SendSetClaimData] E-Klaim API FAILED for ID %d: %v", eklaimLocal.ID, apiErr)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "set_claim_data gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
		})
		return
	}

	// E-Klaim call succeeded
	database.DB.Model(&models.EKlaimLocal{}).Where("id = ?", eklaimLocal.ID).Updates(map[string]interface{}{
		"set_claim_data_sent_at":  now,
		"set_claim_data_response": string(respJSON),
		"set_claim_data_success":  true,
		"status":                  "set_claim_data",
		"last_error":              "",
		"last_error_at":           nil,
	})
	eklaimLocal.SetClaimDataSentAt = &now
	eklaimLocal.SetClaimDataSuccess = true
	eklaimLocal.Status = "set_claim_data"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	log.Printf("[SendSetClaimData] E-Klaim API SUCCESS for ID %d", eklaimLocal.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":      "set_claim_data berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
	})
}

// SendGrouper sends grouper request to E-Klaim local server.
// POST /eklaim-local/:id/grouper
func SendGrouper(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.SetClaimDataSuccess {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Harus set_claim_data terlebih dahulu"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.Grouper(eklaimLocal.NoSEP)

	// Log
	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "grouper",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()
	eklaimLocal.GrouperSentAt = &now
	eklaimLocal.GrouperResponse = string(respJSON)

	if apiErr != nil {
		eklaimLocal.GrouperSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "grouper gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
		})
		return
	}

	// Parse grouper response to extract CBG result
	eklaimLocal.GrouperSuccess = true
	eklaimLocal.Status = "grouped"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil

	if resp != nil && resp.Response != nil {
		var grouperResult eklaimSvc.GrouperResult
		if json.Unmarshal(resp.Response, &grouperResult) == nil {
			eklaimLocal.CBGCode = grouperResult.CBG.Code
			eklaimLocal.CBGDescription = grouperResult.CBG.Description
			eklaimLocal.CBGTariff = grouperResult.CBG.Tariff
			eklaimLocal.HospitalTariff = grouperResult.HospitalTariff
			eklaimLocal.TariffDiff = grouperResult.Difference
		}
	}

	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "grouper berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
	})
}

// SendFinalClaim sends claim_final to E-Klaim local server.
// POST /eklaim-local/:id/final
func SendFinalClaim(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanClaimFinal() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INACBG harus di-final terlebih dahulu"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.FinalClaim(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "claim_final",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()
	eklaimLocal.FinalSentAt = &now
	eklaimLocal.FinalResponse = string(respJSON)

	if apiErr != nil {
		eklaimLocal.FinalSuccess = false
		eklaimLocal.ClaimFinalSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "claim_final gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.FinalSuccess = true
	eklaimLocal.ClaimFinalSentAt = &now
	eklaimLocal.ClaimFinalResponse = string(respJSON)
	eklaimLocal.ClaimFinalSuccess = true
	eklaimLocal.Status = "claim_final"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "claim_final berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendCancelClaim sends claim_cancel to E-Klaim local server.
// POST /eklaim-local/:id/cancel
// Body: { "reason": "alasan pembatalan" }
func SendCancelClaim(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Alasan pembatalan harus diisi"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.CancelClaim(eklaimLocal.NoSEP, req.Reason)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "claim_cancel",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "claim_cancel gagal: " + apiErr.Error(), "response": resp})
		return
	}

	// Reset status after cancel
	eklaimLocal.Status = "set_claim_data" // Can re-grouper/re-final
	eklaimLocal.FinalSuccess = false
	eklaimLocal.GrouperSuccess = false
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "claim_cancel berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
	})
}

// SendDeleteClaim sends delete_claim to E-Klaim local server.
// DELETE /eklaim-local/:id/delete-claim
func SendDeleteClaim(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.DeleteClaim(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "delete_claim",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "delete_claim gagal: " + apiErr.Error(), "response": resp})
		return
	}

	// Reset status
	eklaimLocal.Status = "draft"
	eklaimLocal.NewClaimSuccess = false
	eklaimLocal.SetClaimDataSuccess = false
	eklaimLocal.GrouperSuccess = false
	eklaimLocal.FinalSuccess = false
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "delete_claim berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
	})
}

// SendReeditClaim sends reedit_claim to E-Klaim local server.
// POST /eklaim-local/:id/reedit
// Body: { "diagnosa": "A01.0,A02.0", "procedure": "99.04", "reason": "revisi ICD" }
func SendReeditClaim(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Diagnosa  string `json:"diagnosa" binding:"required"`
		Procedure string `json:"procedure"`
		Reason    string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.ReeditClaim(eklaimLocal.NoSEP, req.Diagnosa, req.Procedure, req.Reason)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "reedit_claim",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "reedit_claim gagal: " + apiErr.Error(), "response": resp})
		return
	}

	eklaimLocal.Status = "set_claim_data"
	eklaimLocal.FinalSuccess = false
	eklaimLocal.GrouperSuccess = false
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "reedit_claim berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
	})
}

// GetClaimData fetches claim data from E-Klaim local server.
// GET /eklaim-local/:id/claim-data
func GetClaimData(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, _, _, apiErr := client.GetClaimData(eklaimLocal.NoSEP)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "get_claim_data gagal: " + apiErr.Error(), "response": resp})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "get_claim_data berhasil",
		"response": resp,
	})
}

// GetClaimPrint gets claim print PDF from E-Klaim local server.
// GET /eklaim-local/:id/claim-print
func GetClaimPrint(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, _, _, apiErr := client.ClaimPrint(eklaimLocal.NoSEP)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "claim_print gagal: " + apiErr.Error(), "response": resp})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "claim_print berhasil",
		"response": resp,
	})
}

// SyncClaimDataFromEKlaim fetches get_claim_data from E-Klaim server and syncs key fields to local DB.
// POST /eklaim-local/:id/sync-claim-data
func SyncClaimDataFromEKlaim(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.GetClaimData(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "sync_claim_data_from_eklaim",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "sync get_claim_data gagal: " + apiErr.Error(), "response": resp})
		return
	}

	if resp == nil || len(resp.Response) == 0 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Response get_claim_data kosong"})
		return
	}

	var payload struct {
		Data map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(resp.Response, &payload); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Format response get_claim_data tidak valid: " + err.Error()})
		return
	}

	toString := func(v interface{}) string {
		switch val := v.(type) {
		case nil:
			return ""
		case string:
			return strings.TrimSpace(val)
		case float64:
			if val == float64(int64(val)) {
				return strconv.FormatInt(int64(val), 10)
			}
			return strconv.FormatFloat(val, 'f', -1, 64)
		case json.Number:
			return val.String()
		default:
			return strings.TrimSpace(fmt.Sprintf("%v", val))
		}
	}

	normalizeDate := func(s string) string {
		s = strings.TrimSpace(s)
		if s == "" {
			return ""
		}
		layouts := []string{"02/01/2006", "02/01/2006 15:04:05", "2006-01-02", "2006-01-02 15:04:05"}
		for _, layout := range layouts {
			if t, err := time.Parse(layout, s); err == nil {
				if strings.Contains(layout, "15:04:05") {
					return t.Format("2006-01-02 15:04:05")
				}
				return t.Format("2006-01-02")
			}
		}
		return s
	}

	toInt := func(v interface{}) int {
		s := toString(v)
		if s == "" {
			return 0
		}
		n, _ := strconv.Atoi(strings.Split(s, ".")[0])
		return n
	}

	get := func(key string) string {
		if payload.Data == nil {
			return ""
		}
		return toString(payload.Data[key])
	}
	has := func(key string) bool {
		if payload.Data == nil {
			return false
		}
		_, ok := payload.Data[key]
		return ok
	}
	normalizeCodes := func(s string) string {
		s = strings.TrimSpace(s)
		if s == "" {
			return ""
		}
		parts := strings.FieldsFunc(s, func(r rune) bool {
			return r == ',' || r == '#'
		})
		clean := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				clean = append(clean, p)
			}
		}
		return strings.Join(clean, "#")
	}

	updates := map[string]interface{}{}
	now := time.Now()
	updates["claim_data_last_sync_at"] = &now

	// Reset derived fields first so UI does not keep stale grouping/special CMG values.
	updates["idrg_code"] = ""
	updates["idrg_description"] = ""
	updates["idrg_cost_weight"] = ""
	updates["idrg_status_cd"] = ""
	updates["idrg_grouper_success"] = false
	updates["idrg_final_success"] = false
	updates["inacbg_cbg_code"] = ""
	updates["inacbg_cbg_description"] = ""
	updates["inacbg_base_tariff"] = ""
	updates["inacbg_tariff"] = ""
	updates["inacbg_status_cd"] = ""
	updates["inacbg_grouper_stage1_success"] = false
	updates["inacbg_grouper_stage2_success"] = false
	updates["inacbg_final_success"] = false
	updates["selected_special_cmg"] = ""
	updates["special_cmg_options"] = ""

	if has("tgl_masuk") {
		v := normalizeDate(get("tgl_masuk"))
		updates["tgl_masuk"] = v
	}
	if has("tgl_pulang") {
		v := normalizeDate(get("tgl_pulang"))
		updates["tgl_pulang"] = v
	}
	if has("cara_masuk") {
		updates["cara_masuk"] = get("cara_masuk")
	}
	if has("jenis_rawat") {
		updates["jenis_rawat"] = get("jenis_rawat")
	}
	if has("kelas_rawat") {
		updates["kelas_rawat"] = get("kelas_rawat")
	}
	if has("discharge_status") {
		updates["discharge_status"] = get("discharge_status")
	}
	if has("kode_tarif") {
		updates["kode_tarif"] = get("kode_tarif")
	}
	if has("diagnosa") {
		v := get("diagnosa")
		updates["diagnosa"] = v
		updates["idrg_diagnosa"] = normalizeCodes(v)
	}
	if has("procedure") {
		v := get("procedure")
		updates["procedure"] = v
		updates["idrg_procedure"] = normalizeCodes(v)
	}
	if has("diagnosa_inagrouper") {
		v := get("diagnosa_inagrouper")
		updates["diagnosa_inagrouper"] = v
		updates["inacbg_diagnosa"] = normalizeCodes(v)
	}
	if has("procedure_inagrouper") {
		v := get("procedure_inagrouper")
		updates["procedure_inagrouper"] = v
		updates["inacbg_procedure"] = normalizeCodes(v)
	}
	if has("adl_sub_acute") {
		updates["adl_sub_acute"] = get("adl_sub_acute")
	}
	if has("adl_chronic") {
		updates["adl_chronic"] = get("adl_chronic")
	}
	if has("icu_indikator") {
		updates["icu_indikator"] = get("icu_indikator")
	}
	if has("icu_los") {
		updates["icu_los"] = get("icu_los")
	}
	if has("ventilator_hour") {
		updates["ventilator_hour"] = get("ventilator_hour")
	}
	if has("upgrade_class_ind") {
		updates["upgrade_class_ind"] = get("upgrade_class_ind")
	}
	if has("upgrade_class_class") {
		updates["upgrade_class_class"] = get("upgrade_class_class")
	}
	if has("upgrade_class_los") {
		updates["upgrade_class_los"] = get("upgrade_class_los")
	}
	if has("add_payment_pct") {
		updates["add_payment_pct"] = get("add_payment_pct")
	}
	if has("nama_pasien") {
		updates["nama_pasien"] = get("nama_pasien")
	}
	if has("nomor_kartu") {
		updates["no_kartu"] = get("nomor_kartu")
	}
	if has("payor_id") {
		updates["payor_id"] = get("payor_id")
	}
	if has("coder_nik") {
		updates["coder_nik"] = get("coder_nik")
	}
	if has("nama_dokter") {
		updates["nama_dokter"] = get("nama_dokter")
	}
	if has("tarif_poli_eks") {
		updates["tarif_poli_eks"] = get("tarif_poli_eks")
	}
	if payload.Data != nil {
		if v, ok := payload.Data["kemenkes_dc_status_cd"]; ok {
			dcStatus := strings.ToLower(toString(v))
			updates["claim_send_success"] = dcStatus == "sent"
		}
		if v, ok := payload.Data["klaim_status_cd"]; ok {
			ks := strings.ToLower(toString(v))
			updates["claim_final_success"] = ks == "final" || ks == "klaim_final"
		}

		if _, ok := payload.Data["sistole"]; ok {
			updates["sistole"] = toInt(payload.Data["sistole"])
		}
		if _, ok := payload.Data["diastole"]; ok {
			updates["diastole"] = toInt(payload.Data["diastole"])
		}
		if _, ok := payload.Data["kantong_darah"]; ok {
			updates["kantong_darah"] = toInt(payload.Data["kantong_darah"])
		}
		if _, ok := payload.Data["alteplase_ind"]; ok {
			updates["alteplase_ind"] = toInt(payload.Data["alteplase_ind"])
		}
		if tarifRaw, ok := payload.Data["tarif_rs"]; ok {
			if tarifMap, ok := tarifRaw.(map[string]interface{}); ok {
				total := 0.0
				for _, val := range tarifMap {
					switch n := val.(type) {
					case float64:
						total += n
					case json.Number:
						if f, err := n.Float64(); err == nil {
							total += f
						}
					case string:
						if f, err := strconv.ParseFloat(strings.TrimSpace(n), 64); err == nil {
							total += f
						}
					}
				}
				updates["tarif_rs"] = total
			}
		}

		if grouperRaw, ok := payload.Data["grouper"]; ok {
			if grouperMap, ok := grouperRaw.(map[string]interface{}); ok {
				if idrgRaw, ok := grouperMap["response_idrg"]; ok {
					if idrgMap, ok := idrgRaw.(map[string]interface{}); ok {
						if v, ok := idrgMap["drg_code"]; ok {
							updates["idrg_code"] = toString(v)
						}
						if v, ok := idrgMap["drg_description"]; ok {
							updates["idrg_description"] = toString(v)
						}
						if v, ok := idrgMap["cost_weight"]; ok {
							updates["idrg_cost_weight"] = toString(v)
						}
						if v, ok := idrgMap["status_cd"]; ok {
							status := toString(v)
							updates["idrg_status_cd"] = status
							updates["idrg_final_success"] = strings.EqualFold(status, "final")
						}
						updates["idrg_grouper_success"] = true
					}
				}

				if inacbgRaw, ok := grouperMap["response_inacbg"]; ok {
					if inacbgMap, ok := inacbgRaw.(map[string]interface{}); ok {
						if v, ok := inacbgMap["status_cd"]; ok {
							status := toString(v)
							updates["inacbg_status_cd"] = status
							updates["inacbg_final_success"] = strings.EqualFold(status, "final")
						}
						if v, ok := inacbgMap["tariff"]; ok {
							updates["inacbg_tariff"] = toString(v)
						}
						if v, ok := inacbgMap["base_tariff"]; ok {
							updates["inacbg_base_tariff"] = toString(v)
						}
						if cbgRaw, ok := inacbgMap["cbg"]; ok {
							if cbgMap, ok := cbgRaw.(map[string]interface{}); ok {
								if v, ok := cbgMap["code"]; ok {
									updates["inacbg_cbg_code"] = toString(v)
								}
								if v, ok := cbgMap["description"]; ok {
									updates["inacbg_cbg_description"] = toString(v)
								}
							}
						}

						if specialRaw, ok := inacbgMap["special_cmg"]; ok {
							if specialArr, ok := specialRaw.([]interface{}); ok {
								selectedCodes := make([]string, 0, len(specialArr))
								specialOpts := make([]map[string]string, 0, len(specialArr))
								for _, item := range specialArr {
									itemMap, ok := item.(map[string]interface{})
									if !ok {
										continue
									}
									code := toString(itemMap["code"])
									desc := toString(itemMap["description"])
									typ := toString(itemMap["type"])
									if code == "" {
										continue
									}
									selectedCodes = append(selectedCodes, code)
									specialOpts = append(specialOpts, map[string]string{
										"code":        code,
										"description": desc,
										"type":        typ,
									})
								}
								updates["selected_special_cmg"] = strings.Join(selectedCodes, "#")
								if optsJSON, err := json.Marshal(specialOpts); err == nil {
									updates["special_cmg_options"] = string(optsJSON)
								}
								if len(selectedCodes) > 0 {
									updates["inacbg_grouper_stage2_success"] = true
								}
							}
						}
						updates["inacbg_grouper_stage1_success"] = true
					}
				}
			}
		}
	}

	getBoolUpdate := func(key string, fallback bool) bool {
		if raw, ok := updates[key]; ok {
			if b, ok := raw.(bool); ok {
				return b
			}
		}
		return fallback
	}

	claimSendSuccess := getBoolUpdate("claim_send_success", eklaimLocal.ClaimSendSuccess)
	claimFinalSuccess := getBoolUpdate("claim_final_success", eklaimLocal.ClaimFinalSuccess)
	inacbgFinalSuccess := getBoolUpdate("inacbg_final_success", eklaimLocal.INACBGFinalSuccess)
	inacbgGrouped := getBoolUpdate("inacbg_grouper_stage1_success", eklaimLocal.INACBGGrouperStage1Success) ||
		getBoolUpdate("inacbg_grouper_stage2_success", eklaimLocal.INACBGGrouperStage2Success)
	idrgFinalSuccess := getBoolUpdate("idrg_final_success", eklaimLocal.IDRGFinalSuccess)
	idrgGrouped := getBoolUpdate("idrg_grouper_success", eklaimLocal.IDRGGrouperSuccess)
	// Fallback: jika kedua modul sudah final berdasarkan status_cd masing-masing,
	// anggap claim final juga true saat klaim_status_cd tidak dikirim.
	if !claimFinalSuccess && idrgFinalSuccess && inacbgFinalSuccess {
		claimFinalSuccess = true
		updates["claim_final_success"] = true
	}
	setClaimDataSuccess := eklaimLocal.SetClaimDataSuccess
	newClaimSuccess := eklaimLocal.NewClaimSuccess

	newStatus := "draft"
	if claimSendSuccess {
		newStatus = "claim_sent"
	} else if claimFinalSuccess {
		newStatus = "claim_final"
	} else if inacbgFinalSuccess {
		newStatus = "inacbg_final"
	} else if inacbgGrouped {
		newStatus = "inacbg_grouped"
	} else if idrgFinalSuccess {
		newStatus = "idrg_final"
	} else if idrgGrouped {
		newStatus = "idrg_grouped"
	} else if setClaimDataSuccess {
		newStatus = "set_claim_data"
	} else if newClaimSuccess {
		newStatus = "new_claim"
	}
	updates["status"] = newStatus

	if err := database.DB.Model(&eklaimLocal).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan sinkronisasi ke database: " + err.Error()})
		return
	}

	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data setelah sinkronisasi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Sinkronisasi dari E-Klaim berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
	})
}

// GetClaimStatusList returns claim report from local database.
// GET /eklaim-local/claim-status?tgl_masuk_from=&tgl_masuk_to=&jenis_rawat=&status=
func GetClaimStatusList(c *gin.Context) {
	tglFrom := c.Query("tgl_masuk_from")
	tglTo := c.Query("tgl_masuk_to")

	if tglFrom == "" || tglTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tgl_masuk_from dan tgl_masuk_to harus diisi"})
		return
	}

	query := database.DB.Model(&models.EKlaimLocal{})

	// Date range filter on tgl_masuk
	query = query.Where("tgl_masuk >= ? AND tgl_masuk <= ?", tglFrom, tglTo)

	// Optional filters
	if jenisRawat := c.Query("jenis_rawat"); jenisRawat != "" {
		query = query.Where("jenis_rawat = ?", jenisRawat)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	var records []models.EKlaimLocal
	if err := query.Order("tgl_masuk DESC, created_at DESC").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data laporan: " + err.Error()})
		return
	}

	// Map to report items matching frontend ClaimStatusItem interface
	type ReportItem struct {
		ID         uint   `json:"id"`
		NoSEP      string `json:"no_sep"`
		NamaPasien string `json:"nama_pasien"`
		TglMasuk   string `json:"tgl_masuk"`
		TglPulang  string `json:"tgl_pulang"`
		JenisRawat string `json:"jenis_rawat"`
		KelasRawat string `json:"kelas_rawat"`
		Status     string `json:"status"`
		Diagnosa   string `json:"diagnosa"`
		Procedure  string `json:"procedure"`
		NamaDokter string `json:"nama_dokter"`
		// iDRG grouper result
		IDRGCode        string `json:"idrg_code"`
		IDRGDescription string `json:"idrg_description"`
		IDRGCostWeight  string `json:"idrg_cost_weight"`
		// INACBG grouper result
		INACBGCode        string `json:"inacbg_cbg_code"`
		INACBGDescription string `json:"inacbg_cbg_description"`
		INACBGTariff      string `json:"inacbg_tariff"`
		// Tarif RS from set_claim_data
		TarifRS float64 `json:"tarif_rs"`
		LOS     int     `json:"los"`
	}

	items := make([]ReportItem, 0, len(records))
	for _, r := range records {
		// Calculate LOS
		los := 0
		if r.TglMasuk != "" && r.TglPulang != "" {
			if tMasuk, err := time.Parse("2006-01-02", r.TglMasuk); err == nil {
				if tPulang, err := time.Parse("2006-01-02", r.TglPulang); err == nil {
					los = int(tPulang.Sub(tMasuk).Hours() / 24)
					if los < 0 {
						los = 0
					}
				}
			}
		}

		items = append(items, ReportItem{
			ID:                r.ID,
			NoSEP:             r.NoSEP,
			NamaPasien:        r.NamaPasien,
			TglMasuk:          r.TglMasuk,
			TglPulang:         r.TglPulang,
			JenisRawat:        r.JenisRawat,
			KelasRawat:        r.KelasRawat,
			Status:            r.Status,
			Diagnosa:          r.Diagnosa,
			Procedure:         r.Procedure,
			NamaDokter:        r.NamaDokter,
			IDRGCode:          r.IDRGCode,
			IDRGDescription:   r.IDRGDescription,
			IDRGCostWeight:    r.IDRGCostWeight,
			INACBGCode:        r.INACBGCBGCode,
			INACBGDescription: r.INACBGCBGDescription,
			INACBGTariff:      r.INACBGTariff,
			TarifRS:           r.TarifRS,
			LOS:               los,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"data": items,
	})
}

// GetEKlaimLocalList returns all E-Klaim local records (the "Eklaim" page).
// GET /eklaim-local?page=1&per_page=20&status=&search=
func GetEKlaimLocalList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	search := c.Query("search")
	status := c.Query("status")
	jenisRawat := c.Query("jenis_rawat") // 1=RI, 2=RJ
	kelasRawat := c.Query("kelas_rawat") // 1, 2, 3
	tglFrom := c.Query("tgl_from")       // yyyy-mm-dd
	tglTo := c.Query("tgl_to")           // yyyy-mm-dd

	offset := (page - 1) * perPage

	query := database.DB.Model(&models.EKlaimLocal{})

	if search != "" {
		query = query.Where(
			"no_sep ILIKE ? OR nama_pasien ILIKE ? OR no_kartu ILIKE ? OR cbg_code ILIKE ? OR idrg_code ILIKE ? OR inacbg_cbg_code ILIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%",
		)
	}

	if status != "" {
		// Map frontend filter values to actual DB statuses (including new iDRG/INACBG flow)
		switch status {
		case "grouped":
			// Legacy "grouped" should also match iDRG/INACBG grouped statuses
			query = query.Where("status IN ?", []string{"grouped", "idrg_coded", "idrg_grouped", "inacbg_imported", "inacbg_coded", "inacbg_grouped"})
		case "finalized":
			// Legacy "finalized" should match iDRG final, INACBG final, and claim_final
			query = query.Where("status IN ?", []string{"finalized", "idrg_final", "inacbg_final", "claim_final"})
		case "sent":
			// Legacy "sent" should match claim_sent
			query = query.Where("status IN ?", []string{"sent", "claim_sent"})
		default:
			query = query.Where("status = ?", status)
		}
	}

	if jenisRawat != "" {
		query = query.Where("jenis_rawat = ?", jenisRawat)
	}
	if kelasRawat != "" {
		query = query.Where("kelas_rawat = ?", kelasRawat)
	}
	if tglFrom != "" {
		query = query.Where("tgl_masuk >= ?", tglFrom)
	}
	if tglTo != "" {
		query = query.Where("tgl_masuk <= ?", tglTo+" 23:59:59")
	}

	var total int64
	query.Count(&total)

	var items []models.EKlaimLocal
	if err := query.Order("updated_at DESC").
		Offset(offset).Limit(perPage).
		Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": items,
		"meta": gin.H{
			"page":     page,
			"per_page": perPage,
			"total":    total,
		},
	})
}

// GetEKlaimLocalDetail returns a single E-Klaim local record with all relations.
// GET /eklaim-local/:id
func GetEKlaimLocalDetail(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var item models.EKlaimLocal
	if err := database.DB.
		Preload("SEP").
		Preload("SEP.Patient").
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Visit.Doctor").
		Preload("Visit.Registration").
		Preload("Visit.Registration.Patient").
		Preload("RMDuplicate").
		Preload("RMDuplicate.Diagnoses").
		Preload("RMDuplicate.Procedures").
		Preload("RMDuplicate.Orders.Items.Procedure.Parameters").Preload("RMDuplicate.Orders.Items.Results.ProcedureParameter").
		Preload("RMDuplicate.MedicineItems.Medicine").
		Preload("RMDuplicate.CPPTNotes").
		Preload("RMDuplicate.NursingCares").
		Preload("RMDuplicate.FluidBalances").
		Preload("RMDuplicate.Billing.Items").
		Preload("Logs", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC")
		}).
		Preload("CreatedBy").
		First(&item, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	// Auto-init RM Duplicate if missing (created empty — user syncs via button)
	visitID := item.VisitID
	if visitID > 0 {
		// Clean up any soft-deleted RM Duplicate to avoid unique constraint issues
		if item.RMDuplicate == nil {
			database.DB.Exec("DELETE FROM eklaim_rm_duplicates WHERE e_klaim_local_id = ? AND deleted_at IS NOT NULL", item.ID)
		}

		if item.RMDuplicate == nil {
			// Store original RM data as JSON reference
			var anm models.Anamnesis
			database.DB.Where("visit_id = ?", visitID).First(&anm)
			var pe models.PhysicalExamination
			database.DB.Where("visit_id = ?", visitID).First(&pe)
			var ap models.AssessmentPlan
			database.DB.Where("visit_id = ?", visitID).First(&ap)
			var disp models.Disposition
			database.DB.Where("visit_id = ?", visitID).First(&disp)
			var diags []models.Diagnosis
			database.DB.Where("visit_id = ?", visitID).Order("type ASC, created_at ASC").Find(&diags)
			var vps []models.VisitProcedure
			database.DB.Where("visit_id = ?", visitID).Preload("Procedure").Find(&vps)
			triagePtr, hasTriage := findTriageForVisit(visitID)
			var triageData models.Triage
			if hasTriage {
				triageData = *triagePtr
			}

			origDiagJSON, _ := json.Marshal(diags)
			origProcJSON, _ := json.Marshal(vps)
			origRMJSON, _ := json.Marshal(map[string]interface{}{"anamnesis": anm, "physical_exam": pe, "assessment_plan": ap, "disposition": disp})

			now := time.Now()
			rmDup := models.EKlaimRMDuplicate{
				EKlaimLocalID:          item.ID,
				VisitID:                visitID,
				OriginalDiagnosesJSON:  string(origDiagJSON),
				OriginalProceduresJSON: string(origProcJSON),
				OriginalRMJSON:         string(origRMJSON),
				DuplicatedAt:           &now,
				HasTriage:              hasTriage,
				// All clinical fields left empty — user will sync manually
			}
			if hasTriage {
				rmDup.TriageArrivalMode = triageData.ArrivalMode
				rmDup.TriageComplaint = triageData.TriageComplaint
				rmDup.TriageLevel = triageData.TriageLevel
				rmDup.TriageAirway = triageData.Airway
				rmDup.TriageAirwayNote = triageData.AirwayNote
				rmDup.TriageBreathing = triageData.Breathing
				rmDup.TriageBreathingNote = triageData.BreathingNote
				rmDup.TriageCirculation = triageData.Circulation
				rmDup.TriageCirculationNote = triageData.CirculationNote
				rmDup.TriageBloodPressure = triageData.BloodPressure
				rmDup.TriageHeartRate = triageData.HeartRate
				rmDup.TriageRespiratoryRate = triageData.BreathingRate
				rmDup.TriageTemperature = triageData.Temperature
				rmDup.TriageOxygenSat = triageData.OxygenSaturation
				rmDup.TriagePainScale = triageData.PainScale
				rmDup.TriageGCSE = triageData.GCSE
				rmDup.TriageGCSV = triageData.GCSV
				rmDup.TriageGCSM = triageData.GCSM
				rmDup.TriageAssessment = triageData.TriageAssessment
				rmDup.TriageImmediateAction = triageData.ImmediateActions
			}

			if err := database.DB.Create(&rmDup).Error; err == nil {
				item.RMDuplicate = &rmDup
				database.DB.Preload("Diagnoses").Preload("Procedures").
					Preload("Orders.Items.Procedure.Parameters").Preload("Orders.Items.Results.ProcedureParameter").
					Preload("MedicineItems.Medicine").
					Preload("CPPTNotes").Preload("NursingCares").Preload("FluidBalances").
					Preload("Billing.Items").
					First(item.RMDuplicate, rmDup.ID)
			}
		}
	}

	// ========== Auto-populate empty claim fields from Visit/SEP/RM ==========
	// Priority: RM Edit (RMDuplicate) > RM Asli (original) > SEP > Visit
	// SKIP if user already saved form data (FormDataSaved=true)
	if !item.FormDataSaved && item.TglMasuk == "" && visitID > 0 {
		visit := item.Visit
		sep := item.SEP
		rm := item.RMDuplicate

		// === Dates from Visit (MUST include time HH:mm:ss for INACBG) ===
		if visit != nil {
			if visit.AdmissionTime != nil {
				item.TglMasuk = visit.AdmissionTime.Format("2006-01-02 15:04:05")
			} else if visit.CheckInTime != nil {
				item.TglMasuk = visit.CheckInTime.Format("2006-01-02 15:04:05")
			} else if visit.StartTime != nil {
				item.TglMasuk = visit.StartTime.Format("2006-01-02 15:04:05")
			}
			if visit.DischargeTime != nil {
				item.TglPulang = visit.DischargeTime.Format("2006-01-02 15:04:05")
			} else if visit.EndTime != nil {
				item.TglPulang = visit.EndTime.Format("2006-01-02 15:04:05")
			}
		}

		// === Data from SEP ===
		if sep != nil {
			// jenis_rawat
			if item.JenisRawat == "" {
				jns := strings.TrimSpace(sep.JnsPelayanan)
				switch {
				case jns == "1" || strings.EqualFold(jns, "rawat inap"):
					item.JenisRawat = "1"
				case jns == "2" || strings.EqualFold(jns, "rawat jalan"):
					item.JenisRawat = "2"
				}
			}
			// kelas_rawat
			if item.KelasRawat == "" {
				kls := sep.KlsRawatHak
				switch {
				case strings.Contains(kls, "3"):
					item.KelasRawat = "3"
				case strings.Contains(kls, "2"):
					item.KelasRawat = "2"
				case strings.Contains(kls, "1"):
					item.KelasRawat = "1"
				}
			}
			// cara_masuk: biarkan kosong, user pilih sendiri di form data klaim
			// Mapping otomatis dari SEP.AsalRujukan hanya sebagai hint awal
			if item.CaraMasuk == "" && sep.AsalRujukan != "" {
				switch sep.AsalRujukan {
				case "1":
					item.CaraMasuk = "gp" // Rujukan FKTP
				case "2":
					item.CaraMasuk = "hosp-trans" // Rujukan FKRTL
				}
			}
			// nama_dokter from DPJP (priority over Visit.Doctor)
			if item.NamaDokter == "" {
				if sep.NamaDPJP != "" {
					item.NamaDokter = sep.NamaDPJP
				} else if visit != nil && visit.Doctor != nil {
					item.NamaDokter = visit.Doctor.NamaLengkap
				}
			}
			// upgrade class from SEP naik kelas
			if item.UpgradeClassInd == "0" && sep.KlsRawatNaik != "" {
				item.UpgradeClassInd = "1"
				naik := strings.ToLower(sep.KlsRawatNaik)
				switch {
				case strings.Contains(naik, "vip"):
					item.UpgradeClassClass = "vip"
				case strings.Contains(naik, "1"):
					item.UpgradeClassClass = "kelas_1"
				case strings.Contains(naik, "2"):
					item.UpgradeClassClass = "kelas_2"
				}
			}
			// Default payor JKN for BPJS
			if item.PayorID == "" {
				item.PayorID = "3"
				item.PayorCd = "JKN"
			}
		}

		// === Vital signs: RM Asli first, then RM Edit overrides ===
		var origPE models.PhysicalExamination
		if database.DB.Where("visit_id = ?", visitID).First(&origPE).Error == nil {
			if item.Sistole == 0 && origPE.Systolic > 0 {
				item.Sistole = origPE.Systolic
				item.Diastole = origPE.Diastolic
			}
		}
		// RM Edit overrides
		if rm != nil && rm.Systolic > 0 {
			item.Sistole = rm.Systolic
			item.Diastole = rm.Diastolic
		}

		// === Discharge status: RM Asli first, then RM Edit overrides ===
		if item.DischargeStatus == "" {
			var origDisp models.Disposition
			if database.DB.Where("visit_id = ?", visitID).First(&origDisp).Error == nil {
				item.DischargeStatus = mapEKlaimDischargeStatus(origDisp.DispositionType)
			}
		}
		// RM Edit overrides
		if rm != nil && rm.DispositionType != "" {
			mapped := mapEKlaimDischargeStatus(rm.DispositionType)
			if mapped != "" {
				item.DischargeStatus = mapped
			}
		}

		// === Coder NIK from integration config ===
		if item.CoderNIK == "" {
			var coderCfg models.IntegrationConfig
			if database.DB.Where("integration = ? AND key = ?", "eklaim", "eklaim_coder_nik").First(&coderCfg).Error == nil && coderCfg.Value != "" {
				item.CoderNIK = coderCfg.Value
			}
		}

		// === Kode Tarif from integration config ===
		if item.KodeTarif == "" {
			var tarifCfg models.IntegrationConfig
			if database.DB.Where("integration = ? AND key = ?", "eklaim", "eklaim_kode_tarif").First(&tarifCfg).Error == nil && tarifCfg.Value != "" {
				item.KodeTarif = tarifCfg.Value
			}
		}

		// === Tarif RS: auto-sync from billing if RM Duplicate tarif is all zero ===
		if rm != nil && rm.TotalTarif == 0 {
			if tb := mapBillingToEKlaimTarif(visitID); tb != nil {
				rm.TarifProsedurNonBedah = tb.ProsedurNonBedah
				rm.TarifProsedurBedah = tb.ProsedurBedah
				rm.TarifKonsultasi = tb.Konsultasi
				rm.TarifTenagaAhli = tb.TenagaAhli
				rm.TarifKeperawatan = tb.Keperawatan
				rm.TarifPenunjang = tb.Penunjang
				rm.TarifRadiologi = tb.Radiologi
				rm.TarifLaboratorium = tb.Laboratorium
				rm.TarifPelayananDarah = tb.PelayananDarah
				rm.TarifRehabilitasi = tb.Rehabilitasi
				rm.TarifKamar = tb.Kamar
				rm.TarifRawatIntensif = tb.RawatIntensif
				rm.TarifObat = tb.Obat
				rm.TarifObatKronis = tb.ObatKronis
				rm.TarifObatKemoterapi = tb.ObatKemoterapi
				rm.TarifAlkes = tb.Alkes
				rm.TarifBMHP = tb.BMHP
				rm.TarifSewaAlat = tb.SewaAlat
				rm.TotalTarif = tb.ProsedurNonBedah + tb.ProsedurBedah + tb.Konsultasi +
					tb.TenagaAhli + tb.Keperawatan + tb.Penunjang +
					tb.Radiologi + tb.Laboratorium + tb.PelayananDarah +
					tb.Rehabilitasi + tb.Kamar + tb.RawatIntensif +
					tb.Obat + tb.ObatKronis + tb.ObatKemoterapi +
					tb.Alkes + tb.BMHP + tb.SewaAlat
				database.DB.Save(rm)
			}
		}

		// Sync tarif_rs on EKlaimLocal from RM Duplicate total
		if rm != nil && item.TarifRS == 0 && rm.TotalTarif > 0 {
			item.TarifRS = rm.TotalTarif
		}

		database.DB.Save(&item)
	}

	// Backfill source_order_id untuk orders yang belum terisi (data lama)
	if item.RMDuplicate != nil && visitID > 0 {
		for i := range item.RMDuplicate.Orders {
			ord := &item.RMDuplicate.Orders[i]
			if ord.SourceOrderID != nil || ord.IsFake {
				continue
			}
			// Cari ProcedureOrder yang cocok berdasarkan visit + order_type + urutan
			var siblings []models.EKlaimRMOrder
			database.DB.Where("rm_duplicate_id = ? AND order_type = ? AND is_fake = false", ord.RMDuplicateID, ord.OrderType).
				Order("sequence ASC, id ASC").Find(&siblings)
			pos := 0
			for j, s := range siblings {
				if s.ID == ord.ID {
					pos = j
					break
				}
			}
			var srcOrders []models.ProcedureOrder
			database.DB.Where("source_visit_id = ? AND order_type = ? AND status = ?", visitID, ord.OrderType, models.ProcedureOrderStatusCompleted).
				Order("created_at ASC").Find(&srcOrders)
			if pos < len(srcOrders) {
				srcID := srcOrders[pos].ID
				ord.SourceOrderID = &srcID
				ord.OrderNumber = srcOrders[pos].OrderNumber
				database.DB.Model(ord).Updates(map[string]interface{}{
					"source_order_id": srcID,
					"order_number":    srcOrders[pos].OrderNumber,
				})
			}
		}
	}

	// Load original medical record data from visit
	originalRM := gin.H{}

	var anamnesis models.Anamnesis
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&anamnesis).Error; err == nil {
		originalRM["anamnesis"] = anamnesis
	}

	var physicalExam models.PhysicalExamination
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&physicalExam).Error; err == nil {
		originalRM["physical_examination"] = physicalExam
	}

	var diagnoses []models.Diagnosis
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).Order("type ASC, id ASC").Find(&diagnoses).Error; err == nil {
		originalRM["diagnoses"] = diagnoses
	}

	var assessmentPlan models.AssessmentPlan
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&assessmentPlan).Error; err == nil {
		originalRM["assessment_plan"] = assessmentPlan
	}

	var disposition models.Disposition
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&disposition).Error; err == nil {
		originalRM["disposition"] = disposition
	}

	var dischargePlanning models.DischargePlanning
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&dischargePlanning).Error; err == nil {
		items := make([]dischargePlanningItemPayload, 0)
		if strings.TrimSpace(dischargePlanning.ItemsJSON) != "" {
			_ = json.Unmarshal([]byte(dischargePlanning.ItemsJSON), &items)
		}
		if len(items) > 0 {
			originalRM["discharge_planning"] = gin.H{
				"id":            dischargePlanning.ID,
				"visit_id":      dischargePlanning.VisitID,
				"items":         items,
				"updated_by_id": dischargePlanning.UpdatedByID,
				"created_at":    dischargePlanning.CreatedAt,
				"updated_at":    dischargePlanning.UpdatedAt,
			}
		}
	}

	var bodyMarker models.BodyMarker
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&bodyMarker).Error; err == nil {
		items := make([]bodyMarkerItemPayload, 0)
		if strings.TrimSpace(bodyMarker.ItemsJSON) != "" {
			_ = json.Unmarshal([]byte(bodyMarker.ItemsJSON), &items)
		}
		if len(items) > 0 {
			originalRM["body_marker"] = gin.H{
				"id":         bodyMarker.ID,
				"visit_id":   bodyMarker.VisitID,
				"items":      items,
				"created_at": bodyMarker.CreatedAt,
				"updated_at": bodyMarker.UpdatedAt,
			}
		}
	}

	var visitProcedures []models.VisitProcedure
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).
		Preload("Procedure").Preload("Procedure.Parameters").Preload("Results").Preload("Results.Parameter").
		Order("created_at ASC").Find(&visitProcedures).Error; err == nil && len(visitProcedures) > 0 {
		originalRM["visit_procedures"] = visitProcedures
	}

	var cppts []models.CPPT
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).
		Preload("CreatedBy").Preload("VerifiedBy").
		Order("record_date ASC, id ASC").Find(&cppts).Error; err == nil && len(cppts) > 0 {
		originalRM["cppts"] = cppts
	}

	var nursingCares []models.NursingCare
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).
		Preload("CreatedBy").Preload("VerifiedBy").
		Order("record_date ASC, id ASC").Find(&nursingCares).Error; err == nil && len(nursingCares) > 0 {
		originalRM["nursing_cares"] = nursingCares
	}

	var fluidBalances []models.FluidBalance
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).
		Preload("CreatedBy").Preload("VerifiedBy").
		Order("record_date ASC, id ASC").Find(&fluidBalances).Error; err == nil && len(fluidBalances) > 0 {
		originalRM["fluid_balances"] = fluidBalances
	}

	var fallRisks []models.FallRiskAssessment
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).
		Preload("AssessedBy").
		Order("record_date ASC, id ASC").Find(&fallRisks).Error; err == nil && len(fallRisks) > 0 {
		originalRM["fall_risks"] = fallRisks
	}

	var o2Usages []models.O2UsageRecord
	if err := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).
		Preload("CreatedBy").Preload("StoppedBy").
		Order("started_at ASC, id ASC").Find(&o2Usages).Error; err == nil && len(o2Usages) > 0 {
		originalRM["o2_usages"] = o2Usages
	}

	// Lab results from procedure orders
	var labOrders []models.ProcedureOrder
	if err := database.DB.Where("source_visit_id = ? AND order_type = ? AND status = ?", visitID, "laboratory", models.ProcedureOrderStatusCompleted).
		Preload("Items").Preload("Items.Procedure").
		Preload("Items.Results").Preload("Items.Results.ProcedureParameter").
		Preload("PerformedBy").Preload("ValidatedBy").
		Find(&labOrders).Error; err == nil && len(labOrders) > 0 {
		originalRM["lab_orders"] = labOrders
	}

	// Radiology results from procedure orders
	var radOrders []models.ProcedureOrder
	if err := database.DB.Where("source_visit_id = ? AND order_type = ? AND status = ?", visitID, "radiology", models.ProcedureOrderStatusCompleted).
		Preload("Items").Preload("Items.Procedure").
		Preload("Items.Results").Preload("Items.Results.ProcedureParameter").
		Preload("PerformedBy").Preload("ValidatedBy").
		Find(&radOrders).Error; err == nil && len(radOrders) > 0 {
		originalRM["radiology_orders"] = radOrders
	}

	// Surgery orders
	var surgeryOrders []models.ProcedureOrder
	if err := database.DB.Where("source_visit_id = ? AND order_type = ? AND status = ?", visitID, "surgery", models.ProcedureOrderStatusCompleted).
		Preload("Items").Preload("Items.Procedure").
		Preload("Items.Results").Preload("Items.Results.ProcedureParameter").
		Preload("PerformedBy").Preload("SurgeonDoctor").
		Find(&surgeryOrders).Error; err == nil && len(surgeryOrders) > 0 {
		originalRM["surgery_orders"] = surgeryOrders
	}

	// Consultation orders
	var consultationOrders []models.ProcedureOrder
	if err := database.DB.Where("source_visit_id = ? AND order_type = ? AND status = ?", visitID, "consultation", models.ProcedureOrderStatusCompleted).
		Preload("Items").Preload("Items.Procedure").
		Preload("Consultation.Consultant").
		Preload("PerformedBy").
		Find(&consultationOrders).Error; err == nil && len(consultationOrders) > 0 {
		originalRM["consultation_orders"] = consultationOrders
	}

	// Medicine orders
	var medicineOrders []models.MedicineOrder
	if err := database.DB.Where("source_visit_id = ? AND is_casemix = ?", visitID, false).
		Preload("Items").Preload("Items.Medicine").
		Order("created_at ASC, id ASC").
		Find(&medicineOrders).Error; err == nil && len(medicineOrders) > 0 {
		originalRM["medicine_orders"] = medicineOrders
	}

	// Triage (UGD/IGD visits — also checks same-registration emergency visit for inpatient)
	if triagePtr, ok := findTriageForVisit(visitID); ok {
		originalRM["triage"] = triagePtr
	}

	// Billing data for tarif reference (try visit_id first, then registration_id)
	var billing models.Billing
	if err := database.DB.Where("visit_id = ?", visitID).Preload("Items").First(&billing).Error; err != nil {
		// Fallback: find via registration_id
		if item.Visit != nil && item.Visit.RegistrationID > 0 {
			database.DB.Where("registration_id = ?", item.Visit.RegistrationID).Preload("Items").First(&billing)
		}
	}
	if billing.ID > 0 {
		originalRM["billing"] = billing
	}

	// Document availability counts (for cetakan tab)
	var nursingCareCount int64
	database.DB.Model(&models.NursingCare{}).Where("visit_id = ?", visitID).Count(&nursingCareCount)
	originalRM["nursing_care_count"] = nursingCareCount

	// Vital sign chart comes from CPPT TTV data
	var cpptWithVitalsCount int64
	database.DB.Model(&models.CPPT{}).
		Where("visit_id = ? AND (blood_pressure != '' OR heart_rate > 0 OR respiratory_rate > 0 OR temperature != '' OR oxygen_saturation > 0)", visitID).
		Count(&cpptWithVitalsCount)
	originalRM["cppt_with_vitals_count"] = cpptWithVitalsCount

	var bedTransferCount int64
	database.DB.Model(&models.BedTransfer{}).Where("visit_id = ?", visitID).Count(&bedTransferCount)
	originalRM["bed_transfer_count"] = bedTransferCount

	var cpptCount int64
	database.DB.Model(&models.CPPT{}).Where("visit_id = ?", visitID).Count(&cpptCount)
	originalRM["cppt_count"] = cpptCount

	var fluidBalanceCount int64
	database.DB.Model(&models.FluidBalance{}).Where("visit_id = ?", visitID).Count(&fluidBalanceCount)
	originalRM["fluid_balance_count"] = fluidBalanceCount

	c.JSON(http.StatusOK, gin.H{
		"data":        item,
		"original_rm": originalRM,
		"buttons":     item.GetButtonVisibility(),
	})
}

// findTriageForVisit finds triage for a visit.
// For inpatient/outpatient visits, also checks if there's an emergency visit
// under the same registration (patient came from UGD before being admitted).
func findTriageForVisit(visitID uint) (*models.Triage, bool) {
	var triage models.Triage
	// Direct match first
	if database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&triage).Error == nil {
		return &triage, true
	}
	// Fallback: find via same registration's emergency visit
	var visit models.Visit
	if database.DB.Select("registration_id").First(&visit, visitID).Error != nil {
		return nil, false
	}
	if visit.RegistrationID == 0 {
		return nil, false
	}
	var emergencyVisitIDs []uint
	database.DB.Model(&models.Visit{}).
		Where("registration_id = ? AND visit_type = ?", visit.RegistrationID, models.VisitTypeEmergency).
		Pluck("id", &emergencyVisitIDs)
	if len(emergencyVisitIDs) == 0 {
		return nil, false
	}
	if database.DB.Where("visit_id IN ? AND is_casemix = ?", emergencyVisitIDs, false).First(&triage).Error == nil {
		return &triage, true
	}
	return nil, false
}

// SyncBillingTarif re-syncs tarif breakdown from billing data into the RM Duplicate.
// POST /eklaim-local/:id/sync-billing-tarif
// Unlike applyTarifBreakdown (which only fills zero fields), this OVERWRITES all tarif
// fields with fresh billing data, so manual edits will be replaced.
func SyncBillingTarif(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.
		Preload("RMDuplicate.Billing.Items").
		First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if eklaimLocal.RMDuplicate == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "RM Duplikat belum dibuat. Silakan init RM Duplikat terlebih dahulu."})
		return
	}

	// Check if RM Duplicate has billing data
	if eklaimLocal.RMDuplicate.Billing == nil || len(eklaimLocal.RMDuplicate.Billing.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Billing duplikat belum ada. Silakan hitung ulang billing terlebih dahulu."})
		return
	}

	// Map billing items to tarif breakdown
	tb := mapRMDuplicateBillingToTarif(eklaimLocal.RMDuplicate.Billing)

	// Force-overwrite all tarif fields from billing
	rm := eklaimLocal.RMDuplicate
	rm.TarifProsedurNonBedah = tb.ProsedurNonBedah
	rm.TarifProsedurBedah = tb.ProsedurBedah
	rm.TarifKonsultasi = tb.Konsultasi
	rm.TarifTenagaAhli = tb.TenagaAhli
	rm.TarifKeperawatan = tb.Keperawatan
	rm.TarifPenunjang = tb.Penunjang
	rm.TarifRadiologi = tb.Radiologi
	rm.TarifLaboratorium = tb.Laboratorium
	rm.TarifPelayananDarah = tb.PelayananDarah
	rm.TarifRehabilitasi = tb.Rehabilitasi
	rm.TarifKamar = tb.Kamar
	rm.TarifRawatIntensif = tb.RawatIntensif
	rm.TarifObat = tb.Obat
	rm.TarifObatKronis = tb.ObatKronis
	rm.TarifObatKemoterapi = tb.ObatKemoterapi
	rm.TarifAlkes = tb.Alkes
	rm.TarifBMHP = tb.BMHP
	rm.TarifSewaAlat = tb.SewaAlat
	rm.TotalTarif = tb.ProsedurNonBedah + tb.ProsedurBedah + tb.Konsultasi +
		tb.TenagaAhli + tb.Keperawatan + tb.Penunjang +
		tb.Radiologi + tb.Laboratorium + tb.PelayananDarah +
		tb.Rehabilitasi + tb.Kamar + tb.RawatIntensif +
		tb.Obat + tb.ObatKronis + tb.ObatKemoterapi +
		tb.Alkes + tb.BMHP + tb.SewaAlat

	if err := database.DB.Save(rm).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan tarif: " + err.Error()})
		return
	}

	// Also update tarif_rs on EKlaimLocal
	database.DB.Model(&eklaimLocal).Update("tarif_rs", rm.TotalTarif)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Tarif berhasil disinkronkan dari billing duplikat",
		"rm_duplicate": rm,
		"total_tarif":  rm.TotalTarif,
	})
}

// CreateCasemixPharmacyOrder creates one empty editable pharmacy order in casemix scope.
// This is used when original RM has no pharmacy order but casemix user still needs
// to add/edit duplicate medicines without affecting original stock/order.
// POST /eklaim-local/:id/create-pharmacy-order
func CreateCasemixPharmacyOrder(c *gin.Context) {
	var input struct {
		PrescriberID *uint  `json:"prescriber_id"`
		OrderDate    string `json:"order_date"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}

	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	visitID := eklaimLocal.VisitID
	if visitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EKlaim local belum terhubung dengan visit"})
		return
	}

	if err := ensureRMDuplicateDraftOnly(visitID, eklaimLocal.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan draft RM Duplikat: " + err.Error()})
		return
	}

	var sourceVisit models.Visit
	if err := database.DB.First(&sourceVisit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit sumber tidak ditemukan"})
		return
	}

	prescriberID := uint(0)
	if input.PrescriberID != nil && *input.PrescriberID > 0 {
		var selectedPrescriber models.Employee
		if err := database.DB.First(&selectedPrescriber, *input.PrescriberID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter pengirim tidak ditemukan"})
			return
		}
		prescriberID = selectedPrescriber.ID
	}

	if sourceVisit.DoctorID != nil && *sourceVisit.DoctorID > 0 {
		if prescriberID == 0 {
			prescriberID = *sourceVisit.DoctorID
		}
	}

	if prescriberID == 0 {
		userID := getUserIDValue(c)
		if userID > 0 {
			var user models.User
			if err := database.DB.First(&user, userID).Error; err == nil && user.EmployeeID != nil && *user.EmployeeID > 0 {
				prescriberID = *user.EmployeeID
			}
		}
	}

	if prescriberID == 0 {
		var doctor models.Employee
		if err := database.DB.
			Where("tipe_karyawan = ?", models.EmployeeTypeDokter).
			Order("id ASC").
			First(&doctor).Error; err == nil {
			prescriberID = doctor.ID
		}
	}

	if prescriberID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter penanggung jawab tidak ditemukan untuk membuat resep duplikat"})
		return
	}

	pharmacyRoomID := uint(0)
	var sourceOrder models.MedicineOrder
	if err := database.DB.
		Where("source_visit_id = ? AND is_casemix = ?", visitID, false).
		Order("created_at DESC, id DESC").
		First(&sourceOrder).Error; err == nil && sourceOrder.PharmacyRoomID > 0 {
		pharmacyRoomID = sourceOrder.PharmacyRoomID
	}

	if pharmacyRoomID == 0 {
		var pharmacyRoom models.Room
		if err := database.DB.
			Where("service_type = ? AND room_type <> ? AND is_active = ?", "farmasi", "depo_farmasi", true).
			Order("id ASC").
			First(&pharmacyRoom).Error; err == nil {
			pharmacyRoomID = pharmacyRoom.ID
		}
	}

	if pharmacyRoomID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan farmasi tidak ditemukan"})
		return
	}

	orderNumber := fmt.Sprintf("RXCMX%s%09d", time.Now().Format("20060102150405"), time.Now().Nanosecond())
	var manualOrderDate time.Time
	if strings.TrimSpace(input.OrderDate) != "" {
		layouts := []string{
			"2006-01-02T15:04",
			"2006-01-02 15:04:05",
			time.RFC3339,
		}
		for _, layout := range layouts {
			if t, parseErr := time.ParseInLocation(layout, strings.TrimSpace(input.OrderDate), time.Local); parseErr == nil {
				manualOrderDate = t
				break
			}
		}
		if manualOrderDate.IsZero() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal order tidak valid"})
			return
		}
	}

	order := models.MedicineOrder{
		OrderNumber:      orderNumber,
		SourceVisitID:    sourceVisit.ID,
		PharmacyVisitID:  nil,
		IsCasemix:        true,
		CasemixEklaimID:  &eklaimLocal.ID,
		SourceRoomID:     sourceVisit.RoomID,
		PharmacyRoomID:   pharmacyRoomID,
		RegistrationID:   sourceVisit.RegistrationID,
		PrescriberID:     prescriberID,
		PrescriptionType: "regular",
		FulfillmentType:  models.FulfillmentTypeTakeHome,
		Priority:         "normal",
		Diagnosis:        sourceVisit.Diagnosis,
		Status:           models.OrderStatusPending,
		Notes:            "Resep duplikat casemix (editable, tidak memengaruhi stok)",
	}
	if !manualOrderDate.IsZero() {
		order.CreatedAt = manualOrderDate
		order.UpdatedAt = manualOrderDate
	}

	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat resep duplikat: " + err.Error()})
		return
	}

	if err := database.DB.
		Preload("Items").
		Preload("SourceVisit").
		Preload("SourceVisit.Registration").
		Preload("SourceVisit.Registration.Patient").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Prescriber").
		Preload("PharmacyRoom").
		Preload("SourceRoom").
		First(&order, order.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Resep duplikat berhasil dibuat tapi gagal dimuat ulang: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Resep duplikat farmasi berhasil dibuat",
		"data":    order,
	})
}

// CreateCasemixProcedureOrder creates one empty editable laboratory/radiology order
// in casemix scope without touching original visit orders.
// POST /eklaim-local/:id/create-procedure-order
func CreateCasemixProcedureOrder(c *gin.Context) {
	var input struct {
		OrderType   string `json:"order_type" binding:"required"` // laboratory | radiology
		OrderedByID *uint  `json:"ordered_by_id"`
		OrderDate   string `json:"order_date"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}

	if input.OrderType != models.ProcedureOrderTypeLaboratory && input.OrderType != models.ProcedureOrderTypeRadiology {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_type harus laboratorium atau radiologi"})
		return
	}

	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	visitID := eklaimLocal.VisitID
	if visitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EKlaim local belum terhubung dengan visit"})
		return
	}

	if err := ensureRMDuplicateDraftOnly(visitID, eklaimLocal.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan draft RM Duplikat: " + err.Error()})
		return
	}

	var sourceVisit models.Visit
	if err := database.DB.First(&sourceVisit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit sumber tidak ditemukan"})
		return
	}

	orderedByID := uint(0)
	if input.OrderedByID != nil && *input.OrderedByID > 0 {
		var selectedDoctor models.Employee
		if err := database.DB.First(&selectedDoctor, *input.OrderedByID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter pengirim tidak ditemukan"})
			return
		}
		orderedByID = selectedDoctor.ID
	}
	if orderedByID == 0 && sourceVisit.DoctorID != nil && *sourceVisit.DoctorID > 0 {
		orderedByID = *sourceVisit.DoctorID
	}
	if orderedByID == 0 {
		userID := getUserIDValue(c)
		if userID > 0 {
			var user models.User
			if err := database.DB.First(&user, userID).Error; err == nil && user.EmployeeID != nil && *user.EmployeeID > 0 {
				orderedByID = *user.EmployeeID
			}
		}
	}
	if orderedByID == 0 {
		var doctor models.Employee
		if err := database.DB.
			Where("tipe_karyawan = ?", models.EmployeeTypeDokter).
			Order("id ASC").
			First(&doctor).Error; err == nil {
			orderedByID = doctor.ID
		}
	}
	if orderedByID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter penanggung jawab tidak ditemukan untuk membuat order duplikat"})
		return
	}

	targetRoomID := uint(0)
	var sourceOrder models.ProcedureOrder
	if err := database.DB.
		Where("source_visit_id = ? AND is_casemix = ? AND order_type = ?", visitID, false, input.OrderType).
		Order("created_at DESC, id DESC").
		First(&sourceOrder).Error; err == nil && sourceOrder.TargetRoomID > 0 {
		targetRoomID = sourceOrder.TargetRoomID
	}

	if targetRoomID == 0 {
		targetService := "laboratorium"
		if input.OrderType == models.ProcedureOrderTypeRadiology {
			targetService = "radiologi"
		}
		var targetRoom models.Room
		if err := database.DB.
			Where("service_type = ? AND is_active = ?", targetService, true).
			Order("id ASC").
			First(&targetRoom).Error; err == nil {
			targetRoomID = targetRoom.ID
		}
	}

	if targetRoomID == 0 {
		targetRoomID = sourceVisit.RoomID
	}

	prefix := "LABCMX"
	if input.OrderType == models.ProcedureOrderTypeRadiology {
		prefix = "RADCMX"
	}
	orderNumber := fmt.Sprintf("%s%s%09d", prefix, time.Now().Format("20060102150405"), time.Now().Nanosecond())

	var manualOrderDate time.Time
	if strings.TrimSpace(input.OrderDate) != "" {
		layouts := []string{
			"2006-01-02T15:04",
			"2006-01-02 15:04:05",
			time.RFC3339,
		}
		for _, layout := range layouts {
			if t, parseErr := time.ParseInLocation(layout, strings.TrimSpace(input.OrderDate), time.Local); parseErr == nil {
				manualOrderDate = t
				break
			}
		}
		if manualOrderDate.IsZero() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal order tidak valid"})
			return
		}
	}

	order := models.ProcedureOrder{
		OrderNumber:     orderNumber,
		OrderType:       input.OrderType,
		SourceVisitID:   sourceVisit.ID,
		TargetVisitID:   nil,
		IsCasemix:       true,
		CasemixEklaimID: &eklaimLocal.ID,
		SourceRoomID:    sourceVisit.RoomID,
		TargetRoomID:    targetRoomID,
		RegistrationID:  sourceVisit.RegistrationID,
		OrderedByID:     orderedByID,
		Priority:        "normal",
		Diagnosis:       sourceVisit.Diagnosis,
		Status:          models.ProcedureOrderStatusPending,
		Notes:           "Order duplikat casemix (editable, tidak memengaruhi order asli)",
	}
	if !manualOrderDate.IsZero() {
		order.CreatedAt = manualOrderDate
		order.UpdatedAt = manualOrderDate
	}

	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat order duplikat: " + err.Error()})
		return
	}

	if err := database.DB.
		Preload("Items").
		Preload("SourceVisit").
		Preload("SourceVisit.Registration").
		Preload("SourceVisit.Registration.Patient").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("TargetRoom").
		Preload("SourceRoom").
		First(&order, order.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Order duplikat berhasil dibuat tapi gagal dimuat ulang: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Order duplikat berhasil dibuat",
		"data":    order,
	})
}

// SyncSinglePharmacyOrderFromVisit copies one selected original pharmacy order
// into casemix scope as a separate editable recipe.
// POST /eklaim-local/:id/sync-pharmacy-order-from-visit
func SyncSinglePharmacyOrderFromVisit(c *gin.Context) {
	var input struct {
		SourceOrderID uint `json:"source_order_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source_order_id wajib diisi"})
		return
	}

	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	visitID := eklaimLocal.VisitID
	if visitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EKlaim local belum terhubung dengan visit"})
		return
	}

	if err := ensureRMDuplicateDraftOnly(visitID, eklaimLocal.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan draft RM Duplikat: " + err.Error()})
		return
	}

	var src models.MedicineOrder
	if err := database.DB.
		Where("id = ? AND source_visit_id = ? AND is_casemix = ?", input.SourceOrderID, visitID, false).
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("id ASC") }).
		First(&src).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order farmasi asli tidak ditemukan"})
		return
	}

	fulfillmentType := src.FulfillmentType
	if fulfillmentType != models.FulfillmentTypeInRoom && fulfillmentType != models.FulfillmentTypeTakeHome {
		fulfillmentType = models.FulfillmentTypeTakeHome
	}
	prescriptionType := strings.TrimSpace(src.PrescriptionType)
	if prescriptionType == "" {
		prescriptionType = "regular"
	}
	priority := strings.TrimSpace(src.Priority)
	if priority == "" {
		priority = "normal"
	}

	orderNumber := fmt.Sprintf("RXCMX%s%09d", time.Now().Format("20060102150405"), time.Now().Nanosecond())
	casemixOrder := models.MedicineOrder{
		OrderNumber:      orderNumber,
		SourceVisitID:    src.SourceVisitID,
		PharmacyVisitID:  nil,
		IsCasemix:        true,
		CasemixEklaimID:  &eklaimLocal.ID,
		SourceRoomID:     src.SourceRoomID,
		PharmacyRoomID:   src.PharmacyRoomID,
		RegistrationID:   src.RegistrationID,
		PrescriberID:     src.PrescriberID,
		PrescriptionType: prescriptionType,
		FulfillmentType:  fulfillmentType,
		Priority:         priority,
		Diagnosis:        src.Diagnosis,
		Notes:            src.Notes,
		Status:           models.OrderStatusPending,
		CreatedAt:        src.CreatedAt,
		UpdatedAt:        src.CreatedAt,
	}

	tx := database.DB.Begin()
	if err := tx.Create(&casemixOrder).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat order casemix: " + err.Error()})
		return
	}

	createdItems := 0
	for _, srcItem := range src.Items {
		if srcItem.Status == models.ItemStatusCancelled {
			continue
		}

		itemType := strings.TrimSpace(srcItem.ItemType)
		if itemType == "" {
			itemType = models.MedicineOrderItemTypeNonRacikan
		}
		casemixItem := models.MedicineOrderItem{
			MedicineOrderID: casemixOrder.ID,
			IsCasemix:       true,
			CasemixEklaimID: &eklaimLocal.ID,
			MedicineID:      srcItem.MedicineID,
			ItemType:        itemType,
			RacikanGroup:    srcItem.RacikanGroup,
			RacikanName:     srcItem.RacikanName,
			RacikanType:     srcItem.RacikanType,
			RacikanQty:      srcItem.RacikanQty,
			RacikanUnit:     srcItem.RacikanUnit,
			Quantity:        srcItem.Quantity,
			Unit:            srcItem.Unit,
			Dosage:          srcItem.Dosage,
			Frequency:       srcItem.Frequency,
			Route:           srcItem.Route,
			Duration:        srcItem.Duration,
			Instructions:    srcItem.Instructions,
			Status:          models.ItemStatusOrdered,
			Notes:           srcItem.Notes,
			AddedByPharmacy: srcItem.AddedByPharmacy,
		}
		if err := tx.Create(&casemixItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat item order casemix: " + err.Error()})
			return
		}
		createdItems++
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan sinkronisasi farmasi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Resep farmasi asli berhasil disalin ke mode casemix",
		"source_order_id":  src.ID,
		"created_order_id": casemixOrder.ID,
		"created_items":    createdItems,
	})
}

// SyncSingleProcedureOrderFromVisit copies one selected original procedure order
// (laboratory/radiology) including item results into casemix scope.
// POST /eklaim-local/:id/sync-procedure-order-from-visit
func SyncSingleProcedureOrderFromVisit(c *gin.Context) {
	var input struct {
		SourceOrderID uint `json:"source_order_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source_order_id wajib diisi"})
		return
	}

	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	visitID := eklaimLocal.VisitID
	if visitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EKlaim local belum terhubung dengan visit"})
		return
	}

	if err := ensureRMDuplicateDraftOnly(visitID, eklaimLocal.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan draft RM Duplikat: " + err.Error()})
		return
	}

	var src models.ProcedureOrder
	if err := database.DB.
		Where("id = ? AND source_visit_id = ? AND is_casemix = ?", input.SourceOrderID, visitID, false).
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("id ASC") }).
		Preload("Items.Results", func(db *gorm.DB) *gorm.DB { return db.Order("id ASC") }).
		First(&src).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tindakan asli tidak ditemukan"})
		return
	}

	if src.OrderType != models.ProcedureOrderTypeLaboratory && src.OrderType != models.ProcedureOrderTypeRadiology {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya order laboratorium/radiologi yang dapat diunduh"})
		return
	}

	prefix := "PDCMX"
	if src.OrderType == models.ProcedureOrderTypeLaboratory {
		prefix = "LABCMX"
	} else if src.OrderType == models.ProcedureOrderTypeRadiology {
		prefix = "RADCMX"
	}

	orderNumber := fmt.Sprintf("%s%s%09d", prefix, time.Now().Format("20060102150405"), time.Now().Nanosecond())
	casemixOrder := models.ProcedureOrder{
		OrderNumber:     orderNumber,
		OrderType:       src.OrderType,
		SourceVisitID:   src.SourceVisitID,
		TargetVisitID:   nil,
		IsCasemix:       true,
		CasemixEklaimID: &eklaimLocal.ID,
		SourceRoomID:    src.SourceRoomID,
		TargetRoomID:    src.TargetRoomID,
		RegistrationID:  src.RegistrationID,
		OrderedByID:     src.OrderedByID,
		SurgeonDoctorID: src.SurgeonDoctorID,
		ScheduledDate:   src.ScheduledDate,
		Priority:        src.Priority,
		ClinicalNotes:   src.ClinicalNotes,
		Diagnosis:       src.Diagnosis,
		Notes:           src.Notes,
		Status:          src.Status,
		PerformedByID:   src.PerformedByID,
		StartedAt:       src.StartedAt,
		CompletedAt:     src.CompletedAt,
		ResultSummary:   src.ResultSummary,
		Conclusion:      src.Conclusion,
		Suggestion:      src.Suggestion,
		IsCritical:      src.IsCritical,
		CriticalNotes:   src.CriticalNotes,
		ValidatedByID:   src.ValidatedByID,
		ValidatedAt:     src.ValidatedAt,
		AttachmentURLs:  src.AttachmentURLs,
		CreatedAt:       src.CreatedAt,
		UpdatedAt:       src.CreatedAt,
	}

	tx := database.DB.Begin()
	if err := tx.Create(&casemixOrder).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat order tindakan casemix: " + err.Error()})
		return
	}

	createdItems := 0
	createdResults := 0
	for _, srcItem := range src.Items {
		if srcItem.Status == models.ProcedureOrderStatusCancelled {
			continue
		}

		casemixItem := models.ProcedureOrderItem{
			ProcedureOrderID: casemixOrder.ID,
			IsCasemix:        true,
			CasemixEklaimID:  &eklaimLocal.ID,
			ProcedureID:      srcItem.ProcedureID,
			Status:           srcItem.Status,
			PerformedByID:    srcItem.PerformedByID,
			StartedAt:        srcItem.StartedAt,
			CompletedAt:      srcItem.CompletedAt,
			Notes:            srcItem.Notes,
		}
		if err := tx.Create(&casemixItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat item order tindakan casemix: " + err.Error()})
			return
		}
		createdItems++

		for _, srcResult := range srcItem.Results {
			casemixResult := models.ProcedureOrderResult{
				ProcedureOrderItemID: casemixItem.ID,
				IsCasemix:            true,
				CasemixEklaimID:      &eklaimLocal.ID,
				ProcedureParameterID: srcResult.ProcedureParameterID,
				Value:                srcResult.Value,
				NumericValue:         srcResult.NumericValue,
				IsNormal:             srcResult.IsNormal,
				IsLow:                srcResult.IsLow,
				IsHigh:               srcResult.IsHigh,
				IsCritical:           srcResult.IsCritical,
				Notes:                srcResult.Notes,
			}
			if err := tx.Create(&casemixResult).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat hasil order tindakan casemix: " + err.Error()})
				return
			}
			createdResults++
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan sinkronisasi order tindakan: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":           "Order tindakan asli berhasil disalin ke mode casemix",
		"source_order_id":   src.ID,
		"created_order_id":  casemixOrder.ID,
		"created_items":     createdItems,
		"created_results":   createdResults,
		"source_order_type": src.OrderType,
	})
}

// SyncPharmacyFromVisit copies all original pharmacy orders to casemix pharmacy orders
// for editable RM Duplicate workflow.
// POST /eklaim-local/:id/sync-pharmacy-from-visit
func SyncPharmacyFromVisit(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	visitID := eklaimLocal.VisitID
	if visitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EKlaim local belum terhubung dengan visit"})
		return
	}

	// Ensure draft RM duplicate exists (keeps workflow consistent for casemix users).
	if err := duplicateRMLogic(visitID, eklaimLocal.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan RM Duplikat: " + err.Error()})
		return
	}

	var sourceOrders []models.MedicineOrder
	if err := database.DB.
		Where("source_visit_id = ? AND is_casemix = ?", visitID, false).
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("id ASC") }).
		Order("created_at ASC, id ASC").
		Find(&sourceOrders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat order farmasi asli: " + err.Error()})
		return
	}

	tx := database.DB.Begin()

	// Replace previous casemix pharmacy orders for this visit + eklaim scope.
	var existingOrderIDs []uint
	if err := tx.Model(&models.MedicineOrder{}).
		Where("source_visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", visitID, true, eklaimLocal.ID).
		Pluck("id", &existingOrderIDs).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat order casemix lama: " + err.Error()})
		return
	}
	if len(existingOrderIDs) > 0 {
		if err := tx.Unscoped().Where("medicine_order_id IN ?", existingOrderIDs).Delete(&models.MedicineOrderItem{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus item order casemix lama: " + err.Error()})
			return
		}
		if err := tx.Unscoped().Where("id IN ?", existingOrderIDs).Delete(&models.MedicineOrder{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus order casemix lama: " + err.Error()})
			return
		}
	}

	createdOrders := 0
	createdItems := 0
	orderStamp := time.Now().Format("20060102150405")

	for idx, src := range sourceOrders {
		fulfillmentType := src.FulfillmentType
		if fulfillmentType != models.FulfillmentTypeInRoom && fulfillmentType != models.FulfillmentTypeTakeHome {
			fulfillmentType = models.FulfillmentTypeTakeHome
		}

		prescriptionType := src.PrescriptionType
		if strings.TrimSpace(prescriptionType) == "" {
			prescriptionType = "regular"
		}

		priority := src.Priority
		if strings.TrimSpace(priority) == "" {
			priority = "normal"
		}

		orderNumber := fmt.Sprintf("RXCMX%s%03d", orderStamp, idx+1)

		casemixOrder := models.MedicineOrder{
			OrderNumber:      orderNumber,
			SourceVisitID:    src.SourceVisitID,
			PharmacyVisitID:  nil,
			IsCasemix:        true,
			CasemixEklaimID:  &eklaimLocal.ID,
			SourceRoomID:     src.SourceRoomID,
			PharmacyRoomID:   src.PharmacyRoomID,
			RegistrationID:   src.RegistrationID,
			PrescriberID:     src.PrescriberID,
			PrescriptionType: prescriptionType,
			FulfillmentType:  fulfillmentType,
			Priority:         priority,
			Diagnosis:        src.Diagnosis,
			Notes:            src.Notes,
			Status:           models.OrderStatusPending,
		}

		if err := tx.Create(&casemixOrder).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat order casemix: " + err.Error()})
			return
		}
		createdOrders++

		for _, srcItem := range src.Items {
			if srcItem.Status == models.ItemStatusCancelled {
				continue
			}

			itemType := srcItem.ItemType
			if strings.TrimSpace(itemType) == "" {
				itemType = models.MedicineOrderItemTypeNonRacikan
			}

			casemixItem := models.MedicineOrderItem{
				MedicineOrderID: casemixOrder.ID,
				IsCasemix:       true,
				CasemixEklaimID: &eklaimLocal.ID,
				MedicineID:      srcItem.MedicineID,
				ItemType:        itemType,
				RacikanGroup:    srcItem.RacikanGroup,
				RacikanName:     srcItem.RacikanName,
				RacikanType:     srcItem.RacikanType,
				RacikanQty:      srcItem.RacikanQty,
				RacikanUnit:     srcItem.RacikanUnit,
				Quantity:        srcItem.Quantity,
				Unit:            srcItem.Unit,
				Dosage:          srcItem.Dosage,
				Frequency:       srcItem.Frequency,
				Route:           srcItem.Route,
				Duration:        srcItem.Duration,
				Instructions:    srcItem.Instructions,
				Status:          models.ItemStatusOrdered,
				Notes:           srcItem.Notes,
				AddedByPharmacy: srcItem.AddedByPharmacy,
			}

			if err := tx.Create(&casemixItem).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat item order casemix: " + err.Error()})
				return
			}
			createdItems++
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan sinkronisasi farmasi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Order farmasi asli berhasil disalin ke mode casemix",
		"created_orders": createdOrders,
		"created_items":  createdItems,
	})
}

// SyncRMFromVisit pulls all clinical data from the original visit/RM into the RM Duplicate.
// POST /eklaim-local/:id/sync-rm-from-visit
// This OVERWRITES all clinical fields, diagnoses, procedures, and tarif in the RM Duplicate.
// BackfillRMOrderSourceIDs runs once at startup to fix old eklaim_rm_orders
// that were created before source_order_id was tracked.
func BackfillRMOrderSourceIDs() {
	// Find all rm_orders without source_order_id that are not fake
	var rmOrders []models.EKlaimRMOrder
	database.DB.Where("source_order_id IS NULL AND is_fake = false").Find(&rmOrders)
	if len(rmOrders) == 0 {
		return
	}

	// For each, find the matching ProcedureOrder via rm_duplicate -> eklaim_local -> visit
	for i := range rmOrders {
		rmOrd := &rmOrders[i]
		// Get visit_id via rm_duplicate -> eklaim_local
		var rmDup models.EKlaimRMDuplicate
		if err := database.DB.First(&rmDup, rmOrd.RMDuplicateID).Error; err != nil {
			continue
		}
		visitID := rmDup.VisitID
		if visitID == 0 {
			continue
		}

		// Find all ProcedureOrders for this visit+type, ordered by created_at
		var srcOrders []models.ProcedureOrder
		database.DB.Where("source_visit_id = ? AND order_type = ? AND status = ?", visitID, rmOrd.OrderType, models.ProcedureOrderStatusCompleted).
			Order("created_at ASC").
			Find(&srcOrders)
		if len(srcOrders) == 0 {
			continue
		}

		// Find sequence position of this rmOrd among others of same type in same rm_duplicate
		var siblings []models.EKlaimRMOrder
		database.DB.Where("rm_duplicate_id = ? AND order_type = ? AND is_fake = false", rmOrd.RMDuplicateID, rmOrd.OrderType).
			Order("sequence ASC, id ASC").
			Find(&siblings)

		pos := -1
		for j, s := range siblings {
			if s.ID == rmOrd.ID {
				pos = j
				break
			}
		}
		if pos < 0 || pos >= len(srcOrders) {
			pos = 0
		}

		srcID := srcOrders[pos].ID
		database.DB.Model(rmOrd).Updates(map[string]interface{}{
			"source_order_id": srcID,
			"order_number":    srcOrders[pos].OrderNumber,
		})
	}
	log.Printf("BackfillRMOrderSourceIDs: processed %d orders", len(rmOrders))
}

func SyncRMFromVisit(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.
		Preload("RMDuplicate").
		First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	visitID := eklaimLocal.VisitID
	if visitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EKlaim local belum terhubung dengan visit"})
		return
	}

	if err := duplicateRMLogic(visitID, eklaimLocal.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyalin RM asli ke draft Casemix: " + err.Error()})
		return
	}

	if eklaimLocal.RMDuplicate == nil {
		c.JSON(http.StatusOK, gin.H{
			"message":   "RM asli berhasil disalin ke draft Casemix",
			"visit_id":  visitID,
			"eklaim_id": eklaimLocal.ID,
		})
		return
	}

	// Load original RM data
	var anm models.Anamnesis
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&anm)
	var pe models.PhysicalExamination
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&pe)
	var ap models.AssessmentPlan
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&ap)
	var disp models.Disposition
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).First(&disp)
	var diags []models.Diagnosis
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).Order("type ASC, created_at ASC").Find(&diags)
	var vps []models.VisitProcedure
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false).Preload("Procedure").Find(&vps)
	triagePtr, hasTriage := findTriageForVisit(visitID)
	var triageData models.Triage
	if hasTriage {
		triageData = *triagePtr
	}

	tx := database.DB.Begin()

	rm := eklaimLocal.RMDuplicate

	// Overwrite clinical fields - Anamnesis
	rm.ChiefComplaint = anm.ChiefComplaint
	rm.HistoryOfPresentIllness = anm.HistoryOfPresentIllness
	rm.PastMedicalHistory = anm.PastMedicalHistory
	rm.FamilyHistory = anm.FamilyHistory
	rm.SocialHistory = anm.SocialHistory
	rm.Allergies = anm.Allergies
	rm.CurrentMedications = anm.CurrentMedications
	rm.ReviewOfSystems = anm.ReviewOfSystems

	// Physical Exam
	rm.GeneralCondition = pe.GeneralCondition
	rm.Consciousness = pe.Consciousness
	rm.BloodPressure = pe.BloodPressure
	rm.Systolic = pe.Systolic
	rm.Diastolic = pe.Diastolic
	rm.HeartRate = pe.HeartRate
	rm.RespiratoryRate = pe.RespiratoryRate
	rm.Temperature = pe.Temperature
	rm.OxygenSaturation = pe.OxygenSaturation
	rm.Weight = pe.Weight
	rm.Height = pe.Height
	rm.BMI = pe.BMI
	rm.Waist = pe.Waist
	rm.HeadCircum = pe.HeadCircum
	rm.PainMethod = pe.PainMethod
	rm.PainScale = pe.PainScale
	rm.PainLocation = pe.PainLocation
	rm.HeadNeck = pe.HeadNeck
	rm.Eyes = pe.Eyes
	rm.ENT = pe.ENT
	rm.Thorax = pe.Thorax
	rm.Cardiac = pe.Cardiac
	rm.Pulmonary = pe.Pulmonary
	rm.Abdomen = pe.Abdomen
	rm.Extremities = pe.Extremities
	rm.Neurological = pe.Neurological
	rm.Skin = pe.Skin
	rm.Head = pe.Head
	rm.Ears = pe.Ears
	rm.Nose = pe.Nose
	rm.Throat = pe.Throat
	rm.Neck = pe.Neck
	rm.Chest = pe.Chest
	rm.Heart = pe.Heart
	rm.Lungs = pe.Lungs
	rm.Musculoskel = pe.Musculoskel
	rm.Genitourinary = pe.Genitourinary
	rm.OtherFindings = pe.OtherFindings
	rm.ECGPerformed = pe.ECGPerformed
	rm.ECGResult = pe.ECGResult
	rm.ECGInterpretation = pe.ECGInterpretation
	rm.ECGNotes = pe.ECGNotes

	// Assessment & Plan
	rm.ClinicalAssessment = ap.ClinicalAssessment
	rm.Prognosis = ap.Prognosis
	rm.TreatmentPlan = ap.TreatmentPlan
	rm.MedicationPlan = ap.MedicationPlan
	rm.DietPlan = ap.DietPlan
	rm.ActivityPlan = ap.ActivityPlan
	rm.EducationPlan = ap.EducationPlan
	rm.MonitoringPlan = ap.MonitoringPlan
	rm.ProcedurePlan = ap.ProcedurePlan
	rm.ConsultationPlan = ap.ConsultationPlan

	// Disposition
	rm.DispositionType = disp.DispositionType
	rm.DispositionNote = disp.DispositionNote
	rm.DischargeStatus = disp.DischargeStatus
	rm.DischargeCondition = disp.DischargeCondition
	rm.DischargeInstruction = disp.DischargeInstruction
	rm.DischargeMedication = disp.DischargeMedication
	rm.FollowUpInstruction = disp.FollowUpInstruction
	rm.ReferralFacility = disp.ReferralFacility
	rm.ReferralReason = disp.ReferralReason
	rm.ReferralDiagnosis = disp.ReferralDiagnosis
	rm.ReferralTherapy = disp.ReferralTherapy
	rm.ReferralNotes = disp.ReferralNotes
	rm.DeathCause = disp.DeathCause
	if disp.FollowUpDate != nil {
		rm.FollowUpDate = disp.FollowUpDate.Format("2006-01-02")
	}
	if disp.DeathTime != nil {
		rm.DeathTime = disp.DeathTime.Format("2006-01-02 15:04:05")
	}

	// Triage UGD
	rm.HasTriage = hasTriage
	if hasTriage {
		rm.TriageArrivalMode = triageData.ArrivalMode
		rm.TriageComplaint = triageData.TriageComplaint
		rm.TriageLevel = triageData.TriageLevel
		rm.TriageAirway = triageData.Airway
		rm.TriageAirwayNote = triageData.AirwayNote
		rm.TriageBreathing = triageData.Breathing
		rm.TriageBreathingNote = triageData.BreathingNote
		rm.TriageCirculation = triageData.Circulation
		rm.TriageCirculationNote = triageData.CirculationNote
		rm.TriageBloodPressure = triageData.BloodPressure
		rm.TriageHeartRate = triageData.HeartRate
		rm.TriageRespiratoryRate = triageData.BreathingRate
		rm.TriageTemperature = triageData.Temperature
		rm.TriageOxygenSat = triageData.OxygenSaturation
		rm.TriagePainScale = triageData.PainScale
		rm.TriageGCSE = triageData.GCSE
		rm.TriageGCSV = triageData.GCSV
		rm.TriageGCSM = triageData.GCSM
		rm.TriageAssessment = triageData.TriageAssessment
		rm.TriageImmediateAction = triageData.ImmediateActions
	}

	// Update original JSON snapshots
	origDiagJSON, _ := json.Marshal(diags)
	origProcJSON, _ := json.Marshal(vps)
	origRMJSON, _ := json.Marshal(map[string]interface{}{"anamnesis": anm, "physical_exam": pe, "assessment_plan": ap, "disposition": disp})
	rm.OriginalDiagnosesJSON = string(origDiagJSON)
	rm.OriginalProceduresJSON = string(origProcJSON)
	rm.OriginalRMJSON = string(origRMJSON)

	// Sync tarif from billing
	if tb := mapBillingToEKlaimTarif(visitID); tb != nil {
		rm.TarifProsedurNonBedah = tb.ProsedurNonBedah
		rm.TarifProsedurBedah = tb.ProsedurBedah
		rm.TarifKonsultasi = tb.Konsultasi
		rm.TarifTenagaAhli = tb.TenagaAhli
		rm.TarifKeperawatan = tb.Keperawatan
		rm.TarifPenunjang = tb.Penunjang
		rm.TarifRadiologi = tb.Radiologi
		rm.TarifLaboratorium = tb.Laboratorium
		rm.TarifPelayananDarah = tb.PelayananDarah
		rm.TarifRehabilitasi = tb.Rehabilitasi
		rm.TarifKamar = tb.Kamar
		rm.TarifRawatIntensif = tb.RawatIntensif
		rm.TarifObat = tb.Obat
		rm.TarifObatKronis = tb.ObatKronis
		rm.TarifObatKemoterapi = tb.ObatKemoterapi
		rm.TarifAlkes = tb.Alkes
		rm.TarifBMHP = tb.BMHP
		rm.TarifSewaAlat = tb.SewaAlat
		rm.TotalTarif = tb.ProsedurNonBedah + tb.ProsedurBedah + tb.Konsultasi +
			tb.TenagaAhli + tb.Keperawatan + tb.Penunjang +
			tb.Radiologi + tb.Laboratorium + tb.PelayananDarah +
			tb.Rehabilitasi + tb.Kamar + tb.RawatIntensif +
			tb.Obat + tb.ObatKronis + tb.ObatKemoterapi +
			tb.Alkes + tb.BMHP + tb.SewaAlat
	}

	if err := tx.Save(rm).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan RM Duplikat: " + err.Error()})
		return
	}

	// Replace diagnoses
	tx.Where("rm_duplicate_id = ?", rm.ID).Delete(&models.EKlaimRMDiagnosis{})
	for i, d := range diags {
		tx.Create(&models.EKlaimRMDiagnosis{
			RMDuplicateID: rm.ID,
			ICD10Code:     d.ICD10Code,
			ICD10Name:     d.ICD10Name,
			Type:          d.Type,
			Sequence:      i + 1,
		})
	}

	// Replace procedures
	tx.Where("rm_duplicate_id = ?", rm.ID).Delete(&models.EKlaimRMProcedure{})
	for i, vp := range vps {
		var code, name string
		if vp.Procedure != nil {
			code = vp.Procedure.ICD9CMCode
			name = vp.Procedure.Name
		}
		tx.Create(&models.EKlaimRMProcedure{
			RMDuplicateID: rm.ID,
			ICD9Code:      code,
			Name:          name,
			Sequence:      i + 1,
		})
	}

	// Replace orders (only non-fake) — unified lab/radiology/surgery/consultation
	// First cascade-delete non-fake order results → items → orders
	var nonFakeOrderIDs []uint
	tx.Model(&models.EKlaimRMOrder{}).Where("rm_duplicate_id = ? AND is_fake = false", rm.ID).Pluck("id", &nonFakeOrderIDs)
	if len(nonFakeOrderIDs) > 0 {
		var nonFakeItemIDs []uint
		tx.Model(&models.EKlaimRMOrderItem{}).Where("eklaim_rm_order_id IN ?", nonFakeOrderIDs).Pluck("id", &nonFakeItemIDs)
		if len(nonFakeItemIDs) > 0 {
			tx.Where("eklaim_rm_order_item_id IN ?", nonFakeItemIDs).Delete(&models.EKlaimRMOrderResult{})
		}
		tx.Where("eklaim_rm_order_id IN ?", nonFakeOrderIDs).Delete(&models.EKlaimRMOrderItem{})
	}
	tx.Where("rm_duplicate_id = ? AND is_fake = false", rm.ID).Delete(&models.EKlaimRMOrder{})

	// Get max sequence of existing fake orders
	var maxFakeOrderSeq int
	database.DB.Model(&models.EKlaimRMOrder{}).Where("rm_duplicate_id = ? AND is_fake = true", rm.ID).Select("COALESCE(MAX(sequence),0)").Scan(&maxFakeOrderSeq)

	// Re-copy all procedure orders from original visit
	var syncAllOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ? AND status = ?", visitID, models.ProcedureOrderStatusCompleted).
		Preload("Items.Procedure").
		Preload("Items.Results.ProcedureParameter").
		Preload("Consultation.Consultant").
		Preload("SurgeonDoctor").
		Order("order_type ASC, created_at ASC").
		Find(&syncAllOrders)

	for orderSeq, order := range syncAllOrders {
		srcOrderID := order.ID
		rmOrder := models.EKlaimRMOrder{
			RMDuplicateID: rm.ID,
			OrderType:     order.OrderType,
			SourceOrderID: &srcOrderID,
			OrderNumber:   order.OrderNumber,
			Priority:      order.Priority,
			ClinicalNotes: order.ClinicalNotes,
			Diagnosis:     order.Diagnosis,
			Notes:         order.Notes,
			ResultSummary: order.ResultSummary,
			Conclusion:    order.Conclusion,
			Suggestion:    order.Suggestion,
			IsCritical:    order.IsCritical,
			CriticalNotes: order.CriticalNotes,
			Sequence:      maxFakeOrderSeq + orderSeq + 1,
		}
		if order.OrderType == "surgery" && order.SurgeonDoctor != nil {
			rmOrder.SurgeonName = order.SurgeonDoctor.NamaLengkap
			rmOrder.ScheduledDate = order.ScheduledDate
		}
		if order.OrderType == "consultation" && order.Consultation != nil {
			if order.Consultation.Consultant != nil {
				rmOrder.ConsultantName = order.Consultation.Consultant.NamaLengkap
			}
			rmOrder.Subjective = order.Consultation.Subjective
			rmOrder.Objective = order.Consultation.Objective
			rmOrder.Assessment = order.Consultation.Assessment
			rmOrder.Plan = order.Consultation.Plan
			rmOrder.Recommendation = order.Consultation.Recommendation
		}
		tx.Create(&rmOrder)

		for itemSeq, item := range order.Items {
			srcItemID := item.ID
			procName := ""
			if item.Procedure != nil {
				procName = item.Procedure.Name
			}
			rmItem := models.EKlaimRMOrderItem{
				EKlaimRMOrderID: rmOrder.ID,
				ProcedureID:     item.ProcedureID,
				ProcedureName:   procName,
				SourceItemID:    &srcItemID,
				Notes:           item.Notes,
				Sequence:        itemSeq + 1,
			}
			tx.Create(&rmItem)

			for resSeq, result := range item.Results {
				srcResultID := result.ID
				paramName := ""
				if result.ProcedureParameter != nil {
					paramName = result.ProcedureParameter.Name
				}
				tx.Create(&models.EKlaimRMOrderResult{
					EKlaimRMOrderItemID:  rmItem.ID,
					ProcedureParameterID: result.ProcedureParameterID,
					ParameterName:        paramName,
					SourceResultID:       &srcResultID,
					Value:                result.Value,
					NumericValue:         result.NumericValue,
					IsNormal:             result.IsNormal,
					IsLow:                result.IsLow,
					IsHigh:               result.IsHigh,
					IsCritical:           result.IsCritical,
					Notes:                result.Notes,
					Sequence:             resSeq + 1,
				})
			}
		}
	}

	// Replace medicine items (only non-fake)
	tx.Where("rm_duplicate_id = ? AND is_fake = false", rm.ID).Delete(&models.EKlaimRMMedicineItem{})
	var syncMedOrders []models.MedicineOrder
	database.DB.Where("source_visit_id = ? AND status IN ?", visitID, []string{models.OrderStatusDelivered, models.OrderStatusPartial}).Preload("Items.Medicine").Find(&syncMedOrders)
	var maxFakeMedSeq int
	database.DB.Model(&models.EKlaimRMMedicineItem{}).Where("rm_duplicate_id = ? AND is_fake = true", rm.ID).Select("COALESCE(MAX(sequence),0)").Scan(&maxFakeMedSeq)
	medSeq := 0
	for _, order := range syncMedOrders {
		srcOrderID := order.ID
		for _, item := range order.Items {
			if item.DispensedQty <= 0 {
				continue
			}
			medSeq++
			medName := ""
			var medID *uint
			if item.Medicine != nil {
				medName = item.Medicine.Name
				medID = &item.MedicineID
			}
			srcItemID := item.ID
			tx.Create(&models.EKlaimRMMedicineItem{
				RMDuplicateID: rm.ID,
				MedicineID:    medID,
				SourceOrderID: &srcOrderID,
				SourceItemID:  &srcItemID,
				OrderNumber:   order.OrderNumber,
				MedicineName:  medName,
				Dosage:        item.Dosage,
				Frequency:     item.Frequency,
				Route:         item.Route,
				Quantity:      item.DispensedQty,
				Unit:          item.Unit,
				Duration:      item.Duration,
				Instructions:  item.Instructions,
				Notes:         item.Notes,
				Sequence:      maxFakeMedSeq + medSeq,
			})
		}
	}

	// Replace CPPT (only non-fake)
	tx.Where("rm_duplicate_id = ? AND is_fake = false", rm.ID).Delete(&models.EKlaimRMCPPT{})
	var syncCPPTs []models.CPPT
	database.DB.Where("visit_id = ?", visitID).Preload("CreatedBy.Employee").Order("record_date ASC").Find(&syncCPPTs)
	var maxFakeCPPTSeq int
	database.DB.Model(&models.EKlaimRMCPPT{}).Where("rm_duplicate_id = ? AND is_fake = true", rm.ID).Select("COALESCE(MAX(sequence),0)").Scan(&maxFakeCPPTSeq)
	for i, cppt := range syncCPPTs {
		recordDate := cppt.RecordDate.Format("2006-01-02 15:04:05")
		cpptFormat := cppt.CPPTFormat
		if cpptFormat == "" {
			cpptFormat = models.CPPTFormatSOAP
		}
		staffName := ""
		if cppt.CreatedBy != nil && cppt.CreatedBy.Employee != nil {
			staffName = cppt.CreatedBy.Employee.NamaLengkap
		}
		tx.Create(&models.EKlaimRMCPPT{
			RMDuplicateID:    rm.ID,
			RecordDate:       recordDate,
			Profession:       cppt.Profession,
			CPPTFormat:       cpptFormat,
			StaffName:        staffName,
			Subjective:       cppt.Subjective,
			Objective:        cppt.Objective,
			Assessment:       cppt.Assessment,
			Plan:             cppt.Plan,
			Instruction:      cppt.Instruction,
			BloodPressure:    cppt.BloodPressure,
			HeartRate:        cppt.HeartRate,
			RespiratoryRate:  cppt.RespiratoryRate,
			Temperature:      cppt.Temperature,
			OxygenSaturation: cppt.OxygenSaturation,
			PainScale:        cppt.PainScale,
			Sequence:         maxFakeCPPTSeq + i + 1,
		})
	}

	// Replace nursing care (only non-fake)
	tx.Where("rm_duplicate_id = ? AND is_fake = false", rm.ID).Delete(&models.EKlaimRMNursingCare{})
	var syncNursing []models.NursingCare
	database.DB.Where("visit_id = ?", visitID).Preload("CreatedBy.Employee").Order("record_date ASC").Find(&syncNursing)
	var maxFakeNursingSeq int
	database.DB.Model(&models.EKlaimRMNursingCare{}).Where("rm_duplicate_id = ? AND is_fake = true", rm.ID).Select("COALESCE(MAX(sequence),0)").Scan(&maxFakeNursingSeq)
	for i, record := range syncNursing {
		recordDate := record.RecordDate.Format("2006-01-02 15:04:05")
		implementationTime := ""
		if !record.ImplementationTime.IsZero() {
			implementationTime = record.ImplementationTime.Format("2006-01-02 15:04:05")
		}
		staffName := ""
		if record.CreatedBy != nil && record.CreatedBy.Employee != nil {
			staffName = record.CreatedBy.Employee.NamaLengkap
		}
		tx.Create(&models.EKlaimRMNursingCare{
			RMDuplicateID:           rm.ID,
			RecordDate:              recordDate,
			ShiftType:               record.ShiftType,
			StaffName:               staffName,
			ChiefComplaint:          record.ChiefComplaint,
			PainAssessment:          record.PainAssessment,
			PainScale:               record.PainScale,
			ConsciousnessLevel:      record.ConsciousnessLevel,
			FunctionalStatus:        record.FunctionalStatus,
			FallRiskAssessment:      record.FallRiskAssessment,
			FallRiskScore:           record.FallRiskScore,
			NutritionAssessment:     record.NutritionAssessment,
			SkinAssessment:          record.SkinAssessment,
			PressureUlcerRisk:       record.PressureUlcerRisk,
			BloodPressure:           record.BloodPressure,
			HeartRate:               record.HeartRate,
			RespiratoryRate:         record.RespiratoryRate,
			Temperature:             record.Temperature,
			OxygenSaturation:        record.OxygenSaturation,
			NursingDiagnosis:        record.NursingDiagnosis,
			NursingDiagnosisCode:    record.NursingDiagnosisCode,
			ProblemEtiology:         record.ProblemEtiology,
			SignsSymptoms:           record.SignsSymptoms,
			NursingOutcome:          record.NursingOutcome,
			NursingOutcomeCode:      record.NursingOutcomeCode,
			OutcomeIndicators:       record.OutcomeIndicators,
			OutcomeTarget:           record.OutcomeTarget,
			NursingIntervention:     record.NursingIntervention,
			NursingInterventionCode: record.NursingInterventionCode,
			ObservationActions:      record.ObservationActions,
			TherapeuticActions:      record.TherapeuticActions,
			EducationActions:        record.EducationActions,
			CollaborationActions:    record.CollaborationActions,
			Implementation:          record.Implementation,
			ImplementationTime:      implementationTime,
			PatientResponse:         record.PatientResponse,
			EvaluationSubjective:    record.EvaluationSubjective,
			EvaluationObjective:     record.EvaluationObjective,
			EvaluationAnalysis:      record.EvaluationAnalysis,
			EvaluationPlanning:      record.EvaluationPlanning,
			ProblemStatus:           record.ProblemStatus,
			Notes:                   record.Notes,
			Sequence:                maxFakeNursingSeq + i + 1,
		})
	}

	// Replace fluid balances (only non-fake)
	tx.Where("rm_duplicate_id = ? AND is_fake = false", rm.ID).Delete(&models.EKlaimRMFluidBalance{})
	var syncFBs []models.FluidBalance
	database.DB.Where("visit_id = ?", visitID).Preload("CreatedBy.Employee").Order("record_date ASC, shift_type ASC").Find(&syncFBs)
	var maxFakeFBSeq int
	database.DB.Model(&models.EKlaimRMFluidBalance{}).Where("rm_duplicate_id = ? AND is_fake = true", rm.ID).Select("COALESCE(MAX(sequence),0)").Scan(&maxFakeFBSeq)
	for i, fb := range syncFBs {
		recordDate := fb.RecordDate.Format("2006-01-02")
		fbStaffName := ""
		if fb.CreatedBy != nil && fb.CreatedBy.Employee != nil {
			fbStaffName = fb.CreatedBy.Employee.NamaLengkap
		}
		tx.Create(&models.EKlaimRMFluidBalance{
			RMDuplicateID: rm.ID,
			RecordDate:    recordDate,
			ShiftType:     fb.ShiftType,
			StaffName:     fbStaffName,
			OralDrink:     fb.OralDrink,
			OralFood:      fb.OralFood,
			OralMedicine:  fb.OralMedicine,
			IVFluid:       fb.IVFluid,
			IVMedicine:    fb.IVMedicine,
			BloodProduct:  fb.BloodProduct,
			EnteralFeed:   fb.EnteralFeed,
			OtherIntake:   fb.OtherIntake,
			UrineAmount:   fb.UrineAmount,
			FecesAmount:   fb.FecesAmount,
			VomitAmount:   fb.VomitAmount,
			DrainAmount:   fb.DrainAmount,
			BloodLoss:     fb.BloodLoss,
			IWL:           fb.IWL,
			OtherOutput:   fb.OtherOutput,
			TotalIntake:   fb.TotalIntake,
			TotalOutput:   fb.TotalOutput,
			Balance:       fb.Balance,
			Notes:         fb.Notes,
			Sequence:      maxFakeFBSeq + i + 1,
		})
	}

	// Recalculate billing based on orders and medicines
	if err := RecalculateEKlaimRMBilling(tx, rm.ID, rm.VisitID); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal kalkulasi billing: " + err.Error()})
		return
	}

	tx.Commit()

	// Sync tarif_rs back to EKlaimLocal
	if rm.TotalTarif > 0 {
		database.DB.Model(&eklaimLocal).Update("tarif_rs", rm.TotalTarif)
	}

	// Reload
	database.DB.Preload("Diagnoses").Preload("Procedures").
		Preload("Orders.Items.Procedure.Parameters").Preload("Orders.Items.Results.ProcedureParameter").
		Preload("MedicineItems.Medicine").
		Preload("CPPTNotes").Preload("NursingCares").Preload("FluidBalances").
		Preload("Billing.Items").
		First(rm, rm.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Data berhasil disinkronkan dari kunjungan",
		"rm_duplicate": rm,
	})
}

// GetEKlaimDefaults returns default config values for claim form auto-fill.
// GET /eklaim-local/defaults
func GetEKlaimDefaults(c *gin.Context) {
	defaults := make(map[string]string)

	var configs []models.IntegrationConfig
	database.DB.Where("integration = ?", "eklaim").Find(&configs)
	for _, cfg := range configs {
		switch cfg.Key {
		case "eklaim_coder_nik":
			defaults["coder_nik"] = cfg.Value
		case "eklaim_kode_tarif":
			defaults["kode_tarif"] = cfg.Value
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": defaults})
}

// GetEKlaimLocalLogs returns logs for an E-Klaim local record.
// GET /eklaim-local/:id/logs?page=1&per_page=20
func GetEKlaimLocalLogs(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))
	offset := (page - 1) * perPage

	var total int64
	if err := database.DB.Model(&models.EKlaimLocalLog{}).Where("e_klaim_local_id = ?", eklaimID).Count(&total).Error; err != nil {
		log.Printf("[WARN] Count eklaim_local_logs failed: %v", err)
	}

	var logs []models.EKlaimLocalLog
	if err := database.DB.Where("e_klaim_local_id = ?", eklaimID).
		Preload("User").
		Order("created_at DESC").
		Offset(offset).Limit(perPage).
		Find(&logs).Error; err != nil {
		log.Printf("[ERROR] GetEKlaimLocalLogs query failed for id=%d: %v", eklaimID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil logs: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": logs,
		"meta": gin.H{
			"page":     page,
			"per_page": perPage,
			"total":    total,
		},
	})
}

// GetAllEKlaimLocalLogs returns ALL logs across all eklaim_local records (global log view).
// GET /eklaim-local/logs?page=1&per_page=20&method=new_claim&status=success&search=xxx
func GetAllEKlaimLocalLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	offset := (page - 1) * perPage

	query := database.DB.Model(&models.EKlaimLocalLog{})
	countQuery := database.DB.Model(&models.EKlaimLocalLog{})

	// Filter by method
	if method := c.Query("method"); method != "" {
		query = query.Where("method = ?", method)
		countQuery = countQuery.Where("method = ?", method)
	}

	// Filter by success/fail
	if status := c.Query("status"); status == "success" {
		query = query.Where("is_success = true")
		countQuery = countQuery.Where("is_success = true")
	} else if status == "failed" {
		query = query.Where("is_success = false")
		countQuery = countQuery.Where("is_success = false")
	}

	// Search by SEP number or patient name via eklaim_local
	if search := c.Query("search"); search != "" {
		subQuery := database.DB.Model(&models.EKlaimLocal{}).Select("id").
			Where("no_sep ILIKE ? OR nama_pasien ILIKE ?", "%"+search+"%", "%"+search+"%")
		query = query.Where("e_klaim_local_id IN (?)", subQuery)
		countQuery = countQuery.Where("e_klaim_local_id IN (?)", subQuery)
	}

	var total int64
	countQuery.Count(&total)

	var logs []models.EKlaimLocalLog
	if err := query.
		Preload("User").
		Order("created_at DESC").
		Offset(offset).Limit(perPage).
		Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil logs"})
		return
	}

	// Enrich logs with eklaim_local info (no_sep, nama_pasien)
	type LogWithClaim struct {
		models.EKlaimLocalLog
		NoSEP      string `json:"no_sep"`
		NamaPasien string `json:"nama_pasien"`
	}

	var enriched []LogWithClaim
	// Collect unique eklaim_local_ids
	idSet := make(map[uint]bool)
	for _, l := range logs {
		idSet[l.EKlaimLocalID] = true
	}
	ids := make([]uint, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}

	claimMap := make(map[uint]models.EKlaimLocal)
	if len(ids) > 0 {
		var claims []models.EKlaimLocal
		database.DB.Where("id IN ?", ids).Find(&claims)
		for _, cl := range claims {
			claimMap[cl.ID] = cl
		}
	}

	for _, l := range logs {
		entry := LogWithClaim{EKlaimLocalLog: l}
		if cl, ok := claimMap[l.EKlaimLocalID]; ok {
			entry.NoSEP = cl.NoSEP
			entry.NamaPasien = cl.NamaPasien
		}
		enriched = append(enriched, entry)
	}

	c.JSON(http.StatusOK, gin.H{
		"data": enriched,
		"meta": gin.H{
			"page":     page,
			"per_page": perPage,
			"total":    total,
		},
	})
}

// PingEKlaimServer checks connectivity to E-Klaim local server.
// GET /eklaim-local/ping
func PingEKlaimServer(c *gin.Context) {
	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal load konfigurasi E-Klaim: " + err.Error(),
		})
		return
	}

	if err := client.Ping(); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"status":  "error",
			"message": fmt.Sprintf("Server E-Klaim tidak terjangkau (%s): %s", client.BaseURL, err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Server E-Klaim terhubung",
		"url":     client.BaseURL,
	})
}

// getUserIDValue extracts user ID as uint from gin context
func getUserIDValue(c *gin.Context) uint {
	ptr := getUserIDFromContext(c)
	if ptr != nil {
		return *ptr
	}
	return 0
}

// mapEKlaimDischargeStatus maps SIMRS disposition type to E-Klaim discharge_status code.
// 1 = Atas persetujuan dokter, 2 = Dirujuk, 3 = Atas permintaan sendiri,
// 4 = Meninggal, 5 = Lain-lain
func mapEKlaimDischargeStatus(dispositionType string) string {
	switch strings.ToLower(strings.TrimSpace(dispositionType)) {
	// Pulang normal / atas persetujuan dokter
	case "pulang", "sembuh", "membaik", "pulang_sehat", "pulang_paksa_dokter":
		return "1"
	// Dirujuk ke RS lain
	case "rujuk", "rujuk_keluar", "pindah_rs", "transfer":
		return "2"
	// Atas permintaan sendiri (APS) / Pulang Paksa
	case "aps", "pulang_paksa", "menolak_rawat":
		return "3"
	// Meninggal
	case "meninggal", "dod", "meninggal_48", "meninggal_lebih_48":
		return "4"
	// Lain-lain (rawat inap lanjutan, kontrol, dll)
	case "rawat_inap", "kontrol", "lain_lain", "lainnya":
		return "5"
	default:
		return ""
	}
}

// eKlaimTarifBreakdown holds the 18 E-Klaim tarif breakdown fields
type eKlaimTarifBreakdown struct {
	ProsedurNonBedah float64
	ProsedurBedah    float64
	Konsultasi       float64
	TenagaAhli       float64
	Keperawatan      float64
	Penunjang        float64
	Radiologi        float64
	Laboratorium     float64
	PelayananDarah   float64
	Rehabilitasi     float64
	Kamar            float64
	RawatIntensif    float64
	Obat             float64
	ObatKronis       float64
	ObatKemoterapi   float64
	Alkes            float64
	BMHP             float64
	SewaAlat         float64
}

// mapBillingToEKlaimTarif queries billing items for a visit and maps them
// to E-Klaim tarif breakdown fields using detailed tariff components.
//
// Mapping (BillingItem tariff components → E-Klaim fields):
//
// Procedure items (detailed component breakdown):
//   - DokterOperator + DokterAnastesi → ProsedurBedah (surgical doctor fees)
//   - Administrasi + remaining non-surgical subtotal → ProsedurNonBedah
//   - BHP (Bahan Habis Pakai) → BMHP
//   - Sarana (facilities/equipment) → Alkes
//   - DokterLainnya → TenagaAhli
//   - PenataAnastesi + Paramedis → Keperawatan
//   - NonMedis → Penunjang
//
// Room items (with ICU detection via Room.RoomType):
//   - ICU/NICU/PICU rooms → RawatIntensif (full subtotal)
//   - Regular rooms: Akomodasi → Kamar, Perawatan → Keperawatan, Makan+Lainnya → Penunjang
//
// Other item types:
//   - consultation → Konsultasi
//   - radiology → Radiologi
//   - laboratory → Laboratorium
//   - medicine → Obat
//   - registration / other → Penunjang
func mapBillingToEKlaimTarif(visitID uint) *eKlaimTarifBreakdown {
	var billing models.Billing
	// Try finding billing by visit_id first
	err := database.DB.
		Where("visit_id = ?", visitID).
		Preload("Items").
		First(&billing).Error
	if err != nil {
		// Fallback: find billing via visit's registration_id
		// (billing is per-registration; visit_id may point to a different visit)
		var visit models.Visit
		if database.DB.Select("registration_id").First(&visit, visitID).Error != nil {
			return nil
		}
		if database.DB.
			Where("registration_id = ?", visit.RegistrationID).
			Preload("Items").
			First(&billing).Error != nil {
			return nil
		}
	}

	// Pre-load ICU room IDs for room type detection
	icuRoomIDs := make(map[uint]bool)
	var roomIDs []uint
	for _, item := range billing.Items {
		if item.ItemType == models.BillingItemTypeRoom && item.ReferenceID > 0 {
			roomIDs = append(roomIDs, item.ReferenceID)
		}
	}
	if len(roomIDs) > 0 {
		var rooms []models.Room
		database.DB.Where("id IN ?", roomIDs).Find(&rooms)
		for _, r := range rooms {
			if r.RoomType == "icu" || r.RoomType == "nicu" || r.RoomType == "picu" {
				icuRoomIDs[r.ID] = true
			}
		}
	}

	t := &eKlaimTarifBreakdown{}
	for _, item := range billing.Items {
		switch item.ItemType {
		case models.BillingItemTypeProcedure:
			// Map each tariff component to the appropriate E-Klaim field
			isSurgical := item.DokterOperator > 0 || item.DokterAnastesi > 0
			hasComponents := item.Administrasi > 0 || item.Sarana > 0 || item.BHP > 0 ||
				item.DokterOperator > 0 || item.DokterAnastesi > 0 || item.DokterLainnya > 0 ||
				item.PenataAnastesi > 0 || item.Paramedis > 0 || item.NonMedis > 0

			if hasComponents {
				// Detailed component breakdown
				t.ProsedurBedah += item.DokterOperator + item.DokterAnastesi
				t.ProsedurNonBedah += item.Administrasi
				t.BMHP += item.BHP
				t.Alkes += item.Sarana
				t.TenagaAhli += item.DokterLainnya
				t.Keperawatan += item.PenataAnastesi + item.Paramedis
				t.Penunjang += item.NonMedis
			} else {
				// Fallback: no component detail, use subtotal
				if isSurgical {
					t.ProsedurBedah += item.Subtotal
				} else {
					t.ProsedurNonBedah += item.Subtotal
				}
			}

		case models.BillingItemTypeConsultation:
			t.Konsultasi += item.Subtotal

		case models.BillingItemTypeRadiology:
			t.Radiologi += item.Subtotal

		case models.BillingItemTypeLaboratory:
			t.Laboratorium += item.Subtotal

		case models.BillingItemTypeMedicine:
			t.Obat += item.Subtotal

		case models.BillingItemTypeRoom:
			if icuRoomIDs[item.ReferenceID] {
				// ICU/NICU/PICU → Rawat Intensif
				t.RawatIntensif += item.Subtotal
			} else {
				// Regular room: break down into components
				hasRoomComponents := item.Akomodasi > 0 || item.Perawatan > 0 ||
					item.Makan > 0 || item.Lainnya > 0

				if hasRoomComponents {
					t.Kamar += item.Akomodasi
					t.Keperawatan += item.Perawatan
					t.Penunjang += item.Makan + item.Lainnya
				} else {
					// Fallback: no component detail, use subtotal
					t.Kamar += item.Subtotal
				}
			}

		case models.BillingItemTypeRegistration:
			t.Penunjang += item.Subtotal

		default: // "other" and any unknown types
			t.Penunjang += item.Subtotal
		}
	}
	return t
}

// applyTarifBreakdown writes the tarif breakdown into an EKlaimRMDuplicate.
// Only populates fields that are still zero (does NOT overwrite manual edits).
func applyTarifBreakdown(rm *models.EKlaimRMDuplicate, t *eKlaimTarifBreakdown) {
	if t == nil {
		return
	}
	if rm.TarifProsedurNonBedah == 0 {
		rm.TarifProsedurNonBedah = t.ProsedurNonBedah
	}
	if rm.TarifProsedurBedah == 0 {
		rm.TarifProsedurBedah = t.ProsedurBedah
	}
	if rm.TarifKonsultasi == 0 {
		rm.TarifKonsultasi = t.Konsultasi
	}
	if rm.TarifTenagaAhli == 0 {
		rm.TarifTenagaAhli = t.TenagaAhli
	}
	if rm.TarifKeperawatan == 0 {
		rm.TarifKeperawatan = t.Keperawatan
	}
	if rm.TarifPenunjang == 0 {
		rm.TarifPenunjang = t.Penunjang
	}
	if rm.TarifRadiologi == 0 {
		rm.TarifRadiologi = t.Radiologi
	}
	if rm.TarifLaboratorium == 0 {
		rm.TarifLaboratorium = t.Laboratorium
	}
	if rm.TarifPelayananDarah == 0 {
		rm.TarifPelayananDarah = t.PelayananDarah
	}
	if rm.TarifRehabilitasi == 0 {
		rm.TarifRehabilitasi = t.Rehabilitasi
	}
	if rm.TarifKamar == 0 {
		rm.TarifKamar = t.Kamar
	}
	if rm.TarifRawatIntensif == 0 {
		rm.TarifRawatIntensif = t.RawatIntensif
	}
	if rm.TarifObat == 0 {
		rm.TarifObat = t.Obat
	}
	if rm.TarifObatKronis == 0 {
		rm.TarifObatKronis = t.ObatKronis
	}
	if rm.TarifObatKemoterapi == 0 {
		rm.TarifObatKemoterapi = t.ObatKemoterapi
	}
	if rm.TarifAlkes == 0 {
		rm.TarifAlkes = t.Alkes
	}
	if rm.TarifBMHP == 0 {
		rm.TarifBMHP = t.BMHP
	}
	if rm.TarifSewaAlat == 0 {
		rm.TarifSewaAlat = t.SewaAlat
	}
	// Recalculate total
	rm.TotalTarif = rm.TarifProsedurNonBedah + rm.TarifProsedurBedah + rm.TarifKonsultasi +
		rm.TarifTenagaAhli + rm.TarifKeperawatan + rm.TarifPenunjang +
		rm.TarifRadiologi + rm.TarifLaboratorium + rm.TarifPelayananDarah +
		rm.TarifRehabilitasi + rm.TarifKamar + rm.TarifRawatIntensif +
		rm.TarifObat + rm.TarifObatKronis + rm.TarifObatKemoterapi +
		rm.TarifAlkes + rm.TarifBMHP + rm.TarifSewaAlat
}

// mapRMDuplicateBillingToTarif converts EKlaimRMBilling items into E-Klaim tarif breakdown
// This maps from billing duplikat (eklaim_rm_billings) to tarif fields for claim data
// Item types: procedure, medicine, administration, accommodation
//
// Mapping strategy for procedures:
// 1. Load Procedure master data by code to get ProcedureGroup
// 2. Map based on ProcedureGroup (Kelompok Tindakan) from master
// 3. Fallback to order_type if ProcedureGroup not available
func mapRMDuplicateBillingToTarif(billing *models.EKlaimRMBilling) *eKlaimTarifBreakdown {
	if billing == nil || len(billing.Items) == 0 {
		return &eKlaimTarifBreakdown{}
	}

	t := &eKlaimTarifBreakdown{}

	// Pre-load order items to get procedure and order info
	orderItemIDs := []uint{}
	for _, item := range billing.Items {
		if item.ItemType == "procedure" && item.ReferenceType == "order_item" {
			orderItemIDs = append(orderItemIDs, item.ReferenceID)
		}
	}

	procedureGroupMap := make(map[uint]string) // orderItemID -> procedureGroup
	orderTypeMap := make(map[uint]string)      // orderItemID -> orderType

	if len(orderItemIDs) > 0 {
		var orderItems []models.EKlaimRMOrderItem
		database.DB.Where("id IN ?", orderItemIDs).Find(&orderItems)

		// Collect procedure IDs and order IDs
		procedureIDs := []uint{}
		orderIDs := []uint{}
		orderItemToOrderMap := make(map[uint]uint)     // orderItemID -> orderID
		orderItemToProcedureMap := make(map[uint]uint) // orderItemID -> procedureID

		for _, oi := range orderItems {
			if oi.ProcedureID > 0 {
				procedureIDs = append(procedureIDs, oi.ProcedureID)
				orderItemToProcedureMap[oi.ID] = oi.ProcedureID
			}
			if oi.EKlaimRMOrderID > 0 {
				orderIDs = append(orderIDs, oi.EKlaimRMOrderID)
				orderItemToOrderMap[oi.ID] = oi.EKlaimRMOrderID
			}
		}

		// Load procedures to get ProcedureGroup
		if len(procedureIDs) > 0 {
			var procedures []models.Procedure
			database.DB.Where("id IN ?", procedureIDs).Find(&procedures)

			procedureIDToGroupMap := make(map[uint]string) // procedureID -> procedureGroup
			for _, p := range procedures {
				procedureIDToGroupMap[p.ID] = p.ProcedureGroup
			}

			// Map orderItemID -> procedureGroup
			for orderItemID, procedureID := range orderItemToProcedureMap {
				procedureGroupMap[orderItemID] = procedureIDToGroupMap[procedureID]
			}
		}

		// Load orders to get order_type for fallback
		if len(orderIDs) > 0 {
			var orders []models.EKlaimRMOrder
			database.DB.Where("id IN ?", orderIDs).Find(&orders)

			orderIDToTypeMap := make(map[uint]string) // orderID -> orderType
			for _, o := range orders {
				orderIDToTypeMap[o.ID] = o.OrderType
			}

			// Map orderItemID -> orderType
			for orderItemID, orderID := range orderItemToOrderMap {
				orderTypeMap[orderItemID] = orderIDToTypeMap[orderID]
			}
		}
	}

	for _, item := range billing.Items {
		switch item.ItemType {
		case "procedure":
			// Get procedure group from master data (primary mapping source)
			procedureGroup := procedureGroupMap[item.ReferenceID]
			orderType := orderTypeMap[item.ReferenceID]

			mapped := false

			// Map based on ProcedureGroup (Kelompok Tindakan)
			// Common procedure groups and their mapping:
			if procedureGroup != "" {
				pgLower := strings.ToLower(procedureGroup)

				// Laboratorium
				if strings.Contains(pgLower, "laboratorium") ||
					strings.Contains(pgLower, "patologi") ||
					strings.Contains(pgLower, "hematologi") {
					t.Laboratorium += item.Subtotal
					mapped = true
				} else if strings.Contains(pgLower, "radiologi") ||
					strings.Contains(pgLower, "imaging") ||
					strings.Contains(pgLower, "rontgen") ||
					strings.Contains(pgLower, "ct scan") ||
					strings.Contains(pgLower, "mri") ||
					strings.Contains(pgLower, "usg") {
					t.Radiologi += item.Subtotal
					mapped = true
				} else if strings.Contains(pgLower, "bedah") ||
					strings.Contains(pgLower, "operasi") ||
					strings.Contains(pgLower, "surgery") {
					t.ProsedurBedah += item.Subtotal
					mapped = true
				} else if strings.Contains(pgLower, "konsultasi") ||
					strings.Contains(pgLower, "visite") {
					t.Konsultasi += item.Subtotal
					mapped = true
				} else if strings.Contains(pgLower, "rehabilitasi") ||
					strings.Contains(pgLower, "fisioterapi") {
					t.Rehabilitasi += item.Subtotal
					mapped = true
				} else if strings.Contains(pgLower, "pelayanan darah") ||
					strings.Contains(pgLower, "transfusi") {
					t.PelayananDarah += item.Subtotal
					mapped = true
				}
			}

			// Fallback to order_type if not mapped by ProcedureGroup
			if !mapped {
				switch orderType {
				case "laboratory":
					t.Laboratorium += item.Subtotal
					mapped = true
				case "radiology":
					t.Radiologi += item.Subtotal
					mapped = true
				case "consultation":
					t.Konsultasi += item.Subtotal
					mapped = true
				case "surgery":
					t.ProsedurBedah += item.Subtotal
					mapped = true
				}
			}

			// Final fallback: check item description/name
			if !mapped {
				descLower := strings.ToLower(item.Description)
				if strings.Contains(descLower, "laboratory") || strings.Contains(descLower, "laboratorium") ||
					strings.Contains(descLower, "lab -") || strings.Contains(descLower, "darah") ||
					strings.Contains(descLower, "hematologi") || strings.Contains(descLower, "patologi") {
					t.Laboratorium += item.Subtotal
					mapped = true
				} else if strings.Contains(descLower, "radiology") || strings.Contains(descLower, "radiologi") ||
					strings.Contains(descLower, "rontgen") || strings.Contains(descLower, "thorax") ||
					strings.Contains(descLower, "ct scan") || strings.Contains(descLower, "mri") ||
					strings.Contains(descLower, "usg") || strings.Contains(descLower, "imaging") {
					t.Radiologi += item.Subtotal
					mapped = true
				} else if strings.Contains(descLower, "consultation") || strings.Contains(descLower, "konsultasi") ||
					strings.Contains(descLower, "visite") {
					t.Konsultasi += item.Subtotal
					mapped = true
				} else if strings.Contains(descLower, "bedah") || strings.Contains(descLower, "operasi") ||
					strings.Contains(descLower, "surgery") {
					t.ProsedurBedah += item.Subtotal
					mapped = true
				}
			}

			// Default: Prosedur Non Bedah
			if !mapped {
				t.ProsedurNonBedah += item.Subtotal
			}

		case "medicine":
			// All medicines go to Obat (could differentiate kronis/kemoterapi if needed)
			t.Obat += item.Subtotal

		case "administration":
			// Administration fee → Penunjang
			t.Penunjang += item.Subtotal

		case "accommodation":
			// Accommodation + Makan → Kamar
			t.Kamar += item.Subtotal

		default:
			// Unknown item types → Penunjang
			t.Penunjang += item.Subtotal
		}
	}

	return t
}

// ==========================================================================
// iDRG / INACBG WORKFLOW HANDLERS
//
// Alur E-Klaim IDRG:
//   1. iDRG Diagnosa Set/Get
//   2. iDRG Procedure Set/Get
//   3. Grouper iDRG
//   4. Final iDRG
//   5. (opsional) Reedit iDRG
//
// Alur E-Klaim INACBG (setelah iDRG final):
//   6. Import iDRG → INACBG
//   7. INACBG Diagnosa Set/Get
//   8. INACBG Procedure Set/Get
//   9. Grouper INACBG Stage 1
//  10. Grouper INACBG Stage 2 (special CMG)
//  11. Final INACBG
//  12. (opsional) Reedit INACBG
//
// Alur Claim Send:
//  13. Send Claim Individual
//  14. Reedit Claim (simple, unfinal)
//
// Search:
//  15-18. Search iDRG/INACBG diagnosa/procedure
// ==========================================================================

// SendIDRGDiagnosaSet sends idrg_diagnosa_set to E-Klaim local server.
// POST /eklaim-local/:id/idrg-diagnosa
// Body: { "diagnosa": "S71.0#S87.9#E11.9" }
func SendIDRGDiagnosaSet(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Diagnosa string `json:"diagnosa" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanDoIDRGCoding() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat melakukan iDRG coding saat ini"})
		return
	}

	if err := validatePrimaryDiagnosaAccPdx(req.Diagnosa); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.IDRGDiagnosaSet(eklaimLocal.NoSEP, req.Diagnosa)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "idrg_diagnosa_set",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()

	if apiErr != nil {
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "idrg_diagnosa_set gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.IDRGDiagnosa = req.Diagnosa
	eklaimLocal.IDRGDiagnosaResponse = string(respJSON)
	eklaimLocal.Status = "idrg_coded"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "idrg_diagnosa_set berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

func validatePrimaryDiagnosaAccPdx(diagnosa string) error {
	parts := strings.Split(diagnosa, "#")
	primaryCode := ""
	for _, p := range parts {
		code := strings.TrimSpace(p)
		if code != "" {
			primaryCode = code
			break
		}
	}
	if primaryCode == "" {
		return nil
	}

	var icd models.ICD10
	err := database.DB.Where("code = ? OR code2 = ?", primaryCode, strings.ReplaceAll(primaryCode, ".", "")).Select("acc_pdx").First(&icd).Error
	if err != nil {
		// If code is not found in local ICD10, skip strict ACCPDX validation.
		return nil
	}

	if !icd.AccPdx {
		return errors.New("Diagnosa utama harus memiliki ACCPDX=Y; kode dengan ACCPDX=N hanya boleh sebagai diagnosa sekunder")
	}
	return nil
}

// GetIDRGDiagnosa fetches current iDRG diagnoses from E-Klaim local server.
// GET /eklaim-local/:id/idrg-diagnosa
func GetIDRGDiagnosa(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.SetClaimDataSuccess {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Harus set_claim_data terlebih dahulu"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, respJSON, _, apiErr := client.IDRGDiagnosaGet(eklaimLocal.NoSEP)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "idrg_diagnosa_get gagal: " + apiErr.Error(), "response": resp})
		return
	}

	eklaimLocal.IDRGDiagnosaResponse = string(respJSON)
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":  "idrg_diagnosa_get berhasil",
		"response": resp,
	})
}

// SendIDRGProcedureSet sends idrg_procedure_set to E-Klaim local server.
// POST /eklaim-local/:id/idrg-procedure
// Body: { "procedure": "81.51#86.28+2#91.799" }
func SendIDRGProcedureSet(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Procedure string `json:"procedure"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	if strings.TrimSpace(req.Procedure) == "" {
		req.Procedure = "#"
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanDoIDRGCoding() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat melakukan iDRG coding saat ini"})
		return
	}

	if invalidCodes, err := validateProcedureValidCodes(req.Procedure); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal validasi procedure VALIDCODE"})
		return
	} else if len(invalidCodes) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "Kode prosedur dengan VALIDCODE 0 tidak boleh diset",
			"invalid_procedure": invalidCodes,
		})
		return
	}

	if invalidAccPdxCodes, err := validateProcedureAccPdx(req.Procedure); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal validasi procedure ACCPDX"})
		return
	} else if len(invalidAccPdxCodes) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":               "Kode prosedur dengan ACCPDX=N tidak boleh diset untuk grouping",
			"invalid_accpdx_code": invalidAccPdxCodes,
		})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.IDRGProcedureSet(eklaimLocal.NoSEP, req.Procedure)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "idrg_procedure_set",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()

	if apiErr != nil {
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "idrg_procedure_set gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.IDRGProcedure = req.Procedure
	eklaimLocal.IDRGProcedureResponse = string(respJSON)
	eklaimLocal.Status = "idrg_coded"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "idrg_procedure_set berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

func validateProcedureValidCodes(procedure string) ([]string, error) {
	parts := strings.Split(procedure, "#")
	if len(parts) == 0 {
		return []string{}, nil
	}

	seen := map[string]struct{}{}
	codes := make([]string, 0, len(parts))
	for _, p := range parts {
		raw := strings.TrimSpace(p)
		if raw == "" {
			continue
		}
		base := raw
		if idx := strings.Index(raw, "+"); idx >= 0 {
			base = strings.TrimSpace(raw[:idx])
		}
		if base == "" {
			continue
		}
		norm := strings.ToUpper(base)
		if _, ok := seen[norm]; ok {
			continue
		}
		seen[norm] = struct{}{}
		codes = append(codes, norm)
	}

	if len(codes) == 0 {
		return []string{}, nil
	}

	var rows []models.ICD9CM
	if err := database.DB.
		Where("(code IN ? OR code2 IN ?) AND valid_code = ?", codes, codes, true).
		Select("code", "code2").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	validMap := map[string]bool{}
	for _, r := range rows {
		validMap[strings.ToUpper(strings.TrimSpace(r.Code))] = true
		validMap[strings.ToUpper(strings.TrimSpace(r.Code2))] = true
	}

	invalid := make([]string, 0)
	for _, code := range codes {
		if !validMap[code] {
			invalid = append(invalid, code)
		}
	}

	return invalid, nil
}

func validateProcedureAccPdx(procedure string) ([]string, error) {
	parts := strings.Split(procedure, "#")
	if len(parts) == 0 {
		return []string{}, nil
	}

	seen := map[string]struct{}{}
	codes := make([]string, 0, len(parts))
	for _, p := range parts {
		raw := strings.TrimSpace(p)
		if raw == "" {
			continue
		}
		base := raw
		if idx := strings.Index(raw, "+"); idx >= 0 {
			base = strings.TrimSpace(raw[:idx])
		}
		if base == "" {
			continue
		}
		norm := strings.ToUpper(base)
		if _, ok := seen[norm]; ok {
			continue
		}
		seen[norm] = struct{}{}
		codes = append(codes, norm)
	}

	if len(codes) == 0 {
		return []string{}, nil
	}

	var rows []models.ICD9CM
	if err := database.DB.
		Where("(code IN ? OR code2 IN ?) AND acc_pdx = ?", codes, codes, true).
		Select("code", "code2").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	allowedMap := map[string]bool{}
	for _, r := range rows {
		allowedMap[strings.ToUpper(strings.TrimSpace(r.Code))] = true
		allowedMap[strings.ToUpper(strings.TrimSpace(r.Code2))] = true
	}

	invalid := make([]string, 0)
	for _, code := range codes {
		if !allowedMap[code] {
			invalid = append(invalid, code)
		}
	}

	return invalid, nil
}

// GetIDRGProcedure fetches current iDRG procedures from E-Klaim local server.
// GET /eklaim-local/:id/idrg-procedure
func GetIDRGProcedure(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.SetClaimDataSuccess {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Harus set_claim_data terlebih dahulu"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, respJSON, _, apiErr := client.IDRGProcedureGet(eklaimLocal.NoSEP)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "idrg_procedure_get gagal: " + apiErr.Error(), "response": resp})
		return
	}

	eklaimLocal.IDRGProcedureResponse = string(respJSON)
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":  "idrg_procedure_get berhasil",
		"response": resp,
	})
}

// SendGrouperIDRG runs iDRG grouping on E-Klaim local server.
// POST /eklaim-local/:id/grouper-idrg
func SendGrouperIDRG(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanGroupIDRG() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat melakukan iDRG grouping saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.GrouperIDRG(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "grouper_idrg",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()
	eklaimLocal.IDRGGrouperSentAt = &now
	eklaimLocal.IDRGGrouperResponse = string(respJSON)

	if apiErr != nil {
		eklaimLocal.IDRGGrouperSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "grouper_idrg gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.IDRGGrouperSuccess = true
	eklaimLocal.Status = "idrg_grouped"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil

	if resp != nil && resp.ResponseIDRG != nil {
		var result eklaimSvc.IDRGGrouperResult
		if json.Unmarshal(resp.ResponseIDRG, &result) == nil {
			eklaimLocal.IDRGCode = result.DRGCode
			eklaimLocal.IDRGDescription = result.DRGDescription
			eklaimLocal.IDRGCostWeight = result.TotalCostWeight
			eklaimLocal.IDRGStatusCd = result.StatusCd
		}
	}

	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "grouper_idrg berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendFinalIDRG finalizes iDRG grouping on E-Klaim local server.
// POST /eklaim-local/:id/final-idrg
func SendFinalIDRG(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanFinalIDRG() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat memfinalisasi iDRG saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.FinalIDRG(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "idrg_grouper_final",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()
	eklaimLocal.IDRGFinalSentAt = &now

	if apiErr != nil {
		eklaimLocal.IDRGFinalSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "idrg_grouper_final gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.IDRGFinalSuccess = true
	eklaimLocal.Status = "idrg_final"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "idrg_grouper_final berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendReeditIDRG re-opens iDRG for editing (unfinal) on E-Klaim local server.
// POST /eklaim-local/:id/reedit-idrg
func SendReeditIDRG(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanReeditIDRG() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat reedit iDRG saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.ReeditIDRG(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "idrg_grouper_reedit",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()

	if apiErr != nil {
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "idrg_grouper_reedit gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.ResetIDRGState()
	eklaimLocal.Status = "set_claim_data"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "idrg_grouper_reedit berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendIDRGToINACBGImport imports iDRG coding to INACBG on E-Klaim local server.
// POST /eklaim-local/:id/import-inacbg
func SendIDRGToINACBGImport(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.IDRGFinalSuccess || eklaimLocal.INACBGFinalSuccess {
		c.JSON(http.StatusBadRequest, gin.H{"error": "iDRG harus sudah final dan INACBG belum final"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.IDRGToINACBGImport(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "idrg_to_inacbg_import",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()

	if apiErr != nil {
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "idrg_to_inacbg_import gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.INACBGImportResponse = string(respJSON)
	eklaimLocal.Status = "inacbg_imported"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil

	// Parse import response to get diagnosa/procedure strings
	if resp != nil && resp.Data != nil {
		var importResp eklaimSvc.ImportINACBGResponse
		if json.Unmarshal(resp.Data, &importResp) == nil {
			eklaimLocal.INACBGDiagnosa = importResp.Diagnosa.String
			eklaimLocal.INACBGProcedure = importResp.Procedure.String
		}
	}

	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "idrg_to_inacbg_import berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendINACBGDiagnosaSet sends inacbg_diagnosa_set to E-Klaim local server.
// POST /eklaim-local/:id/inacbg-diagnosa
// Body: { "diagnosa": "S71.0#S87.9" }
func SendINACBGDiagnosaSet(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Diagnosa string `json:"diagnosa" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanDoINACBGCoding() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat melakukan INACBG coding saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.INACBGDiagnosaSet(eklaimLocal.NoSEP, req.Diagnosa)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "inacbg_diagnosa_set",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()

	if apiErr != nil {
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "inacbg_diagnosa_set gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.INACBGDiagnosa = req.Diagnosa
	eklaimLocal.INACBGDiagnosaResponse = string(respJSON)
	// Diagnosis/procedure changes invalidate previous grouping and special CMG options.
	eklaimLocal.INACBGGrouperStage1SentAt = nil
	eklaimLocal.INACBGGrouperStage1Response = ""
	eklaimLocal.INACBGGrouperStage1Success = false
	eklaimLocal.SpecialCMGOptions = ""
	eklaimLocal.SelectedSpecialCMG = ""
	eklaimLocal.INACBGGrouperStage2SentAt = nil
	eklaimLocal.INACBGGrouperStage2Response = ""
	eklaimLocal.INACBGGrouperStage2Success = false
	eklaimLocal.INACBGCBGCode = ""
	eklaimLocal.INACBGCBGDescription = ""
	eklaimLocal.INACBGBaseTariff = ""
	eklaimLocal.INACBGTariff = ""
	eklaimLocal.INACBGStatusCd = ""
	eklaimLocal.Status = "inacbg_coded"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "inacbg_diagnosa_set berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// GetINACBGDiagnosa fetches current INACBG diagnoses from E-Klaim local server.
// GET /eklaim-local/:id/inacbg-diagnosa
func GetINACBGDiagnosa(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.IDRGFinalSuccess {
		c.JSON(http.StatusBadRequest, gin.H{"error": "iDRG harus sudah final terlebih dahulu"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, respJSON, _, apiErr := client.INACBGDiagnosaGet(eklaimLocal.NoSEP)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "inacbg_diagnosa_get gagal: " + apiErr.Error(), "response": resp})
		return
	}

	eklaimLocal.INACBGDiagnosaResponse = string(respJSON)
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":  "inacbg_diagnosa_get berhasil",
		"response": resp,
	})
}

// SendINACBGProcedureSet sends inacbg_procedure_set to E-Klaim local server.
// POST /eklaim-local/:id/inacbg-procedure
// Body: { "procedure": "81.51#86.28" }
func SendINACBGProcedureSet(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Procedure string `json:"procedure"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	if strings.TrimSpace(req.Procedure) == "" {
		req.Procedure = "#"
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanDoINACBGCoding() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat melakukan INACBG coding saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.INACBGProcedureSet(eklaimLocal.NoSEP, req.Procedure)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "inacbg_procedure_set",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()

	if apiErr != nil {
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "inacbg_procedure_set gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.INACBGProcedure = req.Procedure
	eklaimLocal.INACBGProcedureResponse = string(respJSON)
	// Diagnosis/procedure changes invalidate previous grouping and special CMG options.
	eklaimLocal.INACBGGrouperStage1SentAt = nil
	eklaimLocal.INACBGGrouperStage1Response = ""
	eklaimLocal.INACBGGrouperStage1Success = false
	eklaimLocal.SpecialCMGOptions = ""
	eklaimLocal.SelectedSpecialCMG = ""
	eklaimLocal.INACBGGrouperStage2SentAt = nil
	eklaimLocal.INACBGGrouperStage2Response = ""
	eklaimLocal.INACBGGrouperStage2Success = false
	eklaimLocal.INACBGCBGCode = ""
	eklaimLocal.INACBGCBGDescription = ""
	eklaimLocal.INACBGBaseTariff = ""
	eklaimLocal.INACBGTariff = ""
	eklaimLocal.INACBGStatusCd = ""
	eklaimLocal.Status = "inacbg_coded"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "inacbg_procedure_set berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// GetINACBGProcedure fetches current INACBG procedures from E-Klaim local server.
// GET /eklaim-local/:id/inacbg-procedure
func GetINACBGProcedure(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.IDRGFinalSuccess {
		c.JSON(http.StatusBadRequest, gin.H{"error": "iDRG harus sudah final terlebih dahulu"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, respJSON, _, apiErr := client.INACBGProcedureGet(eklaimLocal.NoSEP)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "inacbg_procedure_get gagal: " + apiErr.Error(), "response": resp})
		return
	}

	eklaimLocal.INACBGProcedureResponse = string(respJSON)
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":  "inacbg_procedure_get berhasil",
		"response": resp,
	})
}

// SendGrouperINACBGStage1 runs INACBG grouping stage 1 on E-Klaim local server.
// POST /eklaim-local/:id/grouper-inacbg-stage1
func SendGrouperINACBGStage1(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanGroupINACBG() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat melakukan INACBG grouping saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.GrouperINACBGStage1(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "grouper_inacbg_stage1",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()
	eklaimLocal.INACBGGrouperStage1SentAt = &now
	eklaimLocal.INACBGGrouperStage1Response = string(respJSON)

	if apiErr != nil {
		eklaimLocal.INACBGGrouperStage1Success = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "grouper_inacbg_stage1 gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.INACBGGrouperStage1Success = true
	eklaimLocal.Status = "inacbg_grouped"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil

	// Store special_cmg_option as raw JSON string
	if resp != nil && resp.SpecialCMGOption != nil {
		eklaimLocal.SpecialCMGOptions = string(resp.SpecialCMGOption)
	}

	// Parse INACBG grouper result
	if resp != nil && resp.ResponseINACBG != nil {
		var result eklaimSvc.INACBGGrouperResult
		if json.Unmarshal(resp.ResponseINACBG, &result) == nil {
			eklaimLocal.INACBGCBGCode = result.CBG.Code
			eklaimLocal.INACBGCBGDescription = result.CBG.Description
			eklaimLocal.INACBGBaseTariff = result.BaseTariff
			eklaimLocal.INACBGTariff = result.Tariff
			eklaimLocal.INACBGStatusCd = result.StatusCd
		}
	}

	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "grouper_inacbg_stage1 berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendGrouperINACBGStage2 runs INACBG grouping stage 2 with selected special CMG codes.
// POST /eklaim-local/:id/grouper-inacbg-stage2
// Body: { "special_cmg": "code1#code2" }
func SendGrouperINACBGStage2(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		SpecialCMG string `json:"special_cmg"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.INACBGGrouperStage1Success || eklaimLocal.INACBGFinalSuccess {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INACBG stage 1 harus sudah berhasil dan belum di-final"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.GrouperINACBGStage2(eklaimLocal.NoSEP, req.SpecialCMG)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "grouper_inacbg_stage2",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()
	eklaimLocal.INACBGGrouperStage2SentAt = &now
	eklaimLocal.INACBGGrouperStage2Response = string(respJSON)

	if apiErr != nil {
		eklaimLocal.INACBGGrouperStage2Success = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "grouper_inacbg_stage2 gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.INACBGGrouperStage2Success = true
	eklaimLocal.SelectedSpecialCMG = req.SpecialCMG
	eklaimLocal.Status = "inacbg_grouped"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil

	// Store special_cmg_option from stage 2 as well
	if resp != nil && resp.SpecialCMGOption != nil {
		eklaimLocal.SpecialCMGOptions = string(resp.SpecialCMGOption)
	}

	// Parse INACBG grouper result
	if resp != nil && resp.ResponseINACBG != nil {
		var result eklaimSvc.INACBGGrouperResult
		if json.Unmarshal(resp.ResponseINACBG, &result) == nil {
			eklaimLocal.INACBGCBGCode = result.CBG.Code
			eklaimLocal.INACBGCBGDescription = result.CBG.Description
			eklaimLocal.INACBGBaseTariff = result.BaseTariff
			eklaimLocal.INACBGTariff = result.Tariff
			eklaimLocal.INACBGStatusCd = result.StatusCd
		}
	}

	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "grouper_inacbg_stage2 berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendFinalINACBG finalizes INACBG grouping on E-Klaim local server.
// POST /eklaim-local/:id/final-inacbg
func SendFinalINACBG(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanFinalINACBG() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat memfinalisasi INACBG saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.FinalINACBG(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "inacbg_grouper_final",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()
	eklaimLocal.INACBGFinalSentAt = &now

	if apiErr != nil {
		eklaimLocal.INACBGFinalSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "inacbg_grouper_final gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.INACBGFinalSuccess = true
	eklaimLocal.Status = "inacbg_final"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "inacbg_grouper_final berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendReeditINACBG re-opens INACBG for editing (unfinal) on E-Klaim local server.
// POST /eklaim-local/:id/reedit-inacbg
func SendReeditINACBG(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanReeditINACBG() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat reedit INACBG saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.ReeditINACBG(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "inacbg_grouper_reedit",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()

	if apiErr != nil {
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "inacbg_grouper_reedit gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.ResetINACBGState()
	eklaimLocal.Status = "idrg_final"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "inacbg_grouper_reedit berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendClaimSend sends finalized claim to BPJS via E-Klaim local server.
// POST /eklaim-local/:id/send-claim
func SendClaimSend(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanClaimSend() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat mengirim klaim saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.SendClaimIndividual(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "send_claim_individual",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()
	eklaimLocal.ClaimSendSentAt = &now
	eklaimLocal.ClaimSendResponse = string(respJSON)

	if apiErr != nil {
		eklaimLocal.ClaimSendSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "send_claim_individual gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.ClaimSendSuccess = true
	eklaimLocal.Status = "claim_sent"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "send_claim_individual berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// SendClaimReeditLocal re-opens a finalized claim for editing via simple reedit.
// POST /eklaim-local/:id/reedit-claim
// This is the simple reedit (no diagnosa/procedure/reason required), distinct from SendReeditClaim.
func SendClaimReeditLocal(c *gin.Context) {
	eklaimID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var eklaimLocal models.EKlaimLocal
	if err := database.DB.First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if !eklaimLocal.CanReeditClaim() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat reedit klaim saat ini"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, reqJSON, respJSON, elapsed, apiErr := client.ReeditClaimSimple(eklaimLocal.NoSEP)

	userID := getUserIDValue(c)
	logEntry := models.EKlaimLocalLog{
		EKlaimLocalID: eklaimLocal.ID,
		Method:        "reedit_claim_simple",
		RequestBody:   string(reqJSON),
		ResponseBody:  string(respJSON),
		ResponseTime:  elapsed,
		IsSuccess:     apiErr == nil,
	}
	if resp != nil {
		logEntry.ResponseCode = resp.Metadata.Code.String()
	}
	if apiErr != nil {
		logEntry.ErrorMessage = apiErr.Error()
	}
	if userID > 0 {
		logEntry.UserID = &userID
	}
	database.DB.Create(&logEntry)

	now := time.Now()
	eklaimLocal.ClaimReeditSentAt = &now
	eklaimLocal.ClaimReeditResponse = string(respJSON)

	if apiErr != nil {
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "reedit_claim gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
			"buttons":      eklaimLocal.GetButtonVisibility(),
		})
		return
	}

	eklaimLocal.ResetClaimFinalState()
	eklaimLocal.Status = "inacbg_final"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "reedit_claim berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
		"buttons":      eklaimLocal.GetButtonVisibility(),
	})
}

// ==================== SEARCH HANDLERS ====================

// searchResultItem is a normalized search result from E-Klaim enriched with IM flag.
type searchResultItem struct {
	Code        string `json:"code"`
	Description string `json:"description"`
	IM          bool   `json:"im"`
	ValidCode   string `json:"validcode,omitempty"`
	AccPdx      string `json:"accpdx,omitempty"`
}

func normalizeValidCode(value interface{}) string {
	switch v := value.(type) {
	case string:
		n := strings.TrimSpace(strings.ToLower(v))
		if n == "0" || n == "false" || n == "f" {
			return "0"
		}
		if n == "1" || n == "true" || n == "t" {
			return "1"
		}
	case float64:
		if v == 0 {
			return "0"
		}
		if v == 1 {
			return "1"
		}
	case int:
		if v == 0 {
			return "0"
		}
		if v == 1 {
			return "1"
		}
	case bool:
		if v {
			return "1"
		}
		return "0"
	}
	return "1"
}

func normalizeAccPdx(value interface{}) string {
	switch v := value.(type) {
	case string:
		n := strings.TrimSpace(strings.ToUpper(v))
		if n == "N" || n == "0" || n == "FALSE" || n == "F" {
			return "N"
		}
		if n == "Y" || n == "1" || n == "TRUE" || n == "T" {
			return "Y"
		}
	case float64:
		if v == 0 {
			return "N"
		}
		if v == 1 {
			return "Y"
		}
	case int:
		if v == 0 {
			return "N"
		}
		if v == 1 {
			return "Y"
		}
	case bool:
		if v {
			return "Y"
		}
		return "N"
	}
	return "Y"
}

// extractSearchItems extracts E-Klaim search response into normalized items.
func extractSearchItems(resp *eklaimSvc.EKlaimResponse) []searchResultItem {
	if resp == nil || resp.Response == nil {
		return []searchResultItem{}
	}
	// Try to extract "data" from the {"count":N,"data":[...]} wrapper
	var wrapper struct {
		Data json.RawMessage `json:"data"`
	}
	rawData := resp.Response
	if err := json.Unmarshal(resp.Response, &wrapper); err == nil && wrapper.Data != nil {
		rawData = wrapper.Data
	}

	// Parse as array — items can be {"code":"...","description":"..."} or ["desc","code"]
	var rawItems []json.RawMessage
	if err := json.Unmarshal(rawData, &rawItems); err != nil {
		return []searchResultItem{}
	}

	items := make([]searchResultItem, 0, len(rawItems))
	for _, raw := range rawItems {
		var obj map[string]interface{}
		if err := json.Unmarshal(raw, &obj); err == nil {
			item := searchResultItem{
				Code:        fmt.Sprintf("%v", obj["code"]),
				Description: fmt.Sprintf("%v", obj["description"]),
				ValidCode:   normalizeValidCode(obj["validcode"]),
				AccPdx:      normalizeAccPdx(obj["accpdx"]),
			}
			if _, ok := obj["validcode"]; !ok {
				item.ValidCode = normalizeValidCode(obj["valid_code"])
			}
			if _, ok := obj["accpdx"]; !ok {
				item.AccPdx = normalizeAccPdx(obj["acc_pdx"])
			}
			items = append(items, item)
			continue
		}
		// Try array format: [description, code]
		var arr []interface{}
		if err := json.Unmarshal(raw, &arr); err == nil && len(arr) >= 2 {
			items = append(items, searchResultItem{
				Code:        fmt.Sprintf("%v", arr[1]),
				Description: fmt.Sprintf("%v", arr[0]),
				ValidCode:   "1",
				AccPdx:      "Y",
			})
		}
	}
	return items
}

// enrichICD10IM enriches search results with IM flag from ICD-10 local DB.
func enrichICD10IM(items []searchResultItem) []searchResultItem {
	if len(items) == 0 {
		return items
	}
	codes := make([]string, len(items))
	for i, it := range items {
		codes[i] = it.Code
	}
	var icdRows []models.ICD10
	database.DB.Where("code IN ? OR code2 IN ?", codes, codes).Select("code", "code2", "im", "acc_pdx").Find(&icdRows)

	imMap := make(map[string]bool)
	accPdxMap := make(map[string]string)
	for _, row := range icdRows {
		if row.IM {
			imMap[row.Code] = true
			imMap[row.Code2] = true
		}
		accVal := "N"
		if row.AccPdx {
			accVal = "Y"
		}
		accPdxMap[row.Code] = accVal
		accPdxMap[row.Code2] = accVal
	}
	for i := range items {
		if imMap[items[i].Code] {
			items[i].IM = true
		}
		if acc, ok := accPdxMap[items[i].Code]; ok {
			items[i].AccPdx = acc
		}
	}
	return items
}

// enrichICD9CMIM enriches search results with IM flag from ICD-9-CM local DB.
func enrichICD9CMIM(items []searchResultItem) []searchResultItem {
	if len(items) == 0 {
		return items
	}
	codes := make([]string, len(items))
	for i, it := range items {
		codes[i] = it.Code
	}
	var icdRows []models.ICD9CM
	database.DB.Where("code IN ? OR code2 IN ?", codes, codes).Select("code", "code2", "im", "acc_pdx").Find(&icdRows)

	imMap := make(map[string]bool)
	accPdxMap := make(map[string]string)
	for _, row := range icdRows {
		if row.IM {
			imMap[row.Code] = true
			imMap[row.Code2] = true
		}
		accVal := "N"
		if row.AccPdx {
			accVal = "Y"
		}
		accPdxMap[row.Code] = accVal
		accPdxMap[row.Code2] = accVal
	}
	for i := range items {
		if imMap[items[i].Code] {
			items[i].IM = true
		}
		if acc, ok := accPdxMap[items[i].Code]; ok {
			items[i].AccPdx = acc
		}
	}
	return items
}

// SearchIDRGDiagnosa searches iDRG diagnoses by keyword.
// GET /eklaim-local/search/idrg-diagnosa?keyword=
func SearchIDRGDiagnosa(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	if len(keyword) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keyword minimal 2 karakter"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, _, _, apiErr := client.SearchDiagnosisIDRG(keyword)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "search_diagnosis_inagrouper gagal: " + apiErr.Error(), "response": resp})
		return
	}

	items := enrichICD10IM(extractSearchItems(resp))
	c.JSON(http.StatusOK, gin.H{
		"message": "search_diagnosis_inagrouper berhasil",
		"data":    items,
	})
}

// SearchIDRGProcedure searches iDRG procedures by keyword.
// GET /eklaim-local/search/idrg-procedure?keyword=
func SearchIDRGProcedure(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	if len(keyword) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keyword minimal 2 karakter"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, _, _, apiErr := client.SearchProceduresIDRG(keyword)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "search_procedures_inagrouper gagal: " + apiErr.Error(), "response": resp})
		return
	}

	items := enrichICD9CMIM(extractSearchItems(resp))
	c.JSON(http.StatusOK, gin.H{
		"message": "search_procedures_inagrouper berhasil",
		"data":    items,
	})
}

// SearchINACBGDiagnosa searches INACBG diagnoses by keyword.
// GET /eklaim-local/search/inacbg-diagnosa?keyword=
func SearchINACBGDiagnosa(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	if len(keyword) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keyword minimal 2 karakter"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, _, _, apiErr := client.SearchDiagnosisINACBG(keyword)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "search_diagnosis gagal: " + apiErr.Error(), "response": resp})
		return
	}

	items := enrichICD10IM(extractSearchItems(resp))
	c.JSON(http.StatusOK, gin.H{
		"message": "search_diagnosis berhasil",
		"data":    items,
	})
}

// SearchINACBGProcedure searches INACBG procedures by keyword.
// GET /eklaim-local/search/inacbg-procedure?keyword=
func SearchINACBGProcedure(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	if len(keyword) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keyword minimal 2 karakter"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, _, _, apiErr := client.SearchProceduresINACBG(keyword)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "search_procedures gagal: " + apiErr.Error(), "response": resp})
		return
	}

	items := enrichICD9CMIM(extractSearchItems(resp))
	c.JSON(http.StatusOK, gin.H{
		"message": "search_procedures berhasil",
		"data":    items,
	})
}

// GetEKlaimDashboard returns summary statistics for the E-Klaim dashboard.
// GET /eklaim-local/dashboard?bulan=2026-02
func GetEKlaimDashboard(c *gin.Context) {
	bulan := c.Query("bulan") // format: YYYY-MM
	if bulan == "" {
		bulan = time.Now().Format("2006-01")
	}

	tglFrom := bulan + "-01"
	t, err := time.Parse("2006-01-02", tglFrom)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format bulan tidak valid (YYYY-MM)"})
		return
	}
	tglTo := t.AddDate(0, 1, -1).Format("2006-01-02")

	db := database.DB
	monthFilter := func(q *gorm.DB) *gorm.DB {
		return q.Where("tgl_masuk >= ? AND tgl_masuk <= ?", tglFrom, tglTo)
	}

	// 1. Status counts
	type StatusCount struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	var statusCounts []StatusCount
	monthFilter(db.Model(&models.EKlaimLocal{})).
		Select("status, COUNT(*) as count").
		Group("status").Order("count DESC").
		Find(&statusCounts)

	// 2. Jenis rawat counts
	type JenisRawatCount struct {
		JenisRawat string `json:"jenis_rawat"`
		Count      int64  `json:"count"`
	}
	var jenisRawatCounts []JenisRawatCount
	monthFilter(db.Model(&models.EKlaimLocal{})).
		Select("jenis_rawat, COUNT(*) as count").
		Where("jenis_rawat != ''").
		Group("jenis_rawat").Order("count DESC").
		Find(&jenisRawatCounts)

	// 3. Kelas rawat counts
	type KelasRawatCount struct {
		KelasRawat string `json:"kelas_rawat"`
		Count      int64  `json:"count"`
	}
	var kelasRawatCounts []KelasRawatCount
	monthFilter(db.Model(&models.EKlaimLocal{})).
		Select("kelas_rawat, COUNT(*) as count").
		Where("kelas_rawat != ''").
		Group("kelas_rawat").Order("count DESC").
		Find(&kelasRawatCounts)

	// 4. Financial summary — inacbg_tariff is TEXT, cast to numeric; tarif_rs is float64
	type FinancialSummary struct {
		TotalINACBGTariff float64 `json:"total_inacbg_tariff"`
		TotalTarifRS      float64 `json:"total_tarif_rs"`
		AvgINACBGTariff   float64 `json:"avg_inacbg_tariff"`
		AvgTarifRS        float64 `json:"avg_tarif_rs"`
		ClaimCount        int64   `json:"claim_count"`
	}
	var financial FinancialSummary
	monthFilter(db.Model(&models.EKlaimLocal{})).
		Select(`COUNT(*) as claim_count,
			COALESCE(SUM(CASE WHEN inacbg_tariff != '' THEN CAST(inacbg_tariff AS NUMERIC) ELSE 0 END),0) as total_inacbg_tariff,
			COALESCE(SUM(tarif_rs),0) as total_tarif_rs,
			COALESCE(AVG(NULLIF(CASE WHEN inacbg_tariff != '' THEN CAST(inacbg_tariff AS NUMERIC) ELSE 0 END,0)),0) as avg_inacbg_tariff,
			COALESCE(AVG(NULLIF(tarif_rs,0)),0) as avg_tarif_rs`).
		Scan(&financial)

	// 5. Recent claims (last 10)
	var recentClaims []models.EKlaimLocal
	db.Model(&models.EKlaimLocal{}).
		Order("created_at DESC").Limit(10).
		Find(&recentClaims)

	type RecentItem struct {
		ID            uint    `json:"id"`
		NoSEP         string  `json:"no_sep"`
		NamaPasien    string  `json:"nama_pasien"`
		Status        string  `json:"status"`
		JenisRawat    string  `json:"jenis_rawat"`
		KelasRawat    string  `json:"kelas_rawat"`
		TglMasuk      string  `json:"tgl_masuk"`
		TglPulang     string  `json:"tgl_pulang"`
		INACBGCBGCode string  `json:"inacbg_cbg_code"`
		INACBGTariff  string  `json:"inacbg_tariff"`
		TarifRS       float64 `json:"tarif_rs"`
		CreatedAt     string  `json:"created_at"`
	}
	recentItems := make([]RecentItem, 0, len(recentClaims))
	for _, r := range recentClaims {
		recentItems = append(recentItems, RecentItem{
			ID:            r.ID,
			NoSEP:         r.NoSEP,
			NamaPasien:    r.NamaPasien,
			Status:        r.Status,
			JenisRawat:    r.JenisRawat,
			KelasRawat:    r.KelasRawat,
			TglMasuk:      r.TglMasuk,
			TglPulang:     r.TglPulang,
			INACBGCBGCode: r.INACBGCBGCode,
			INACBGTariff:  r.INACBGTariff,
			TarifRS:       r.TarifRS,
			CreatedAt:     r.CreatedAt.Format("2006-01-02 15:04"),
		})
	}

	// 6. Top 10 INACBG codes
	type TopCBG struct {
		CBGCode        string  `json:"cbg_code"`
		CBGDescription string  `json:"cbg_description"`
		Count          int64   `json:"count"`
		TotalTariff    float64 `json:"total_tariff"`
	}
	var topCBGs []TopCBG
	monthFilter(db.Model(&models.EKlaimLocal{})).
		Select("inacbg_cbg_code as cbg_code, inacbg_cbg_description as cbg_description, COUNT(*) as count, SUM(CASE WHEN inacbg_tariff != '' THEN CAST(inacbg_tariff AS NUMERIC) ELSE 0 END) as total_tariff").
		Where("inacbg_cbg_code != ''").
		Group("inacbg_cbg_code, inacbg_cbg_description").
		Order("count DESC").Limit(10).
		Find(&topCBGs)

	// 7. Daily tariff summary
	type DailyClaim struct {
		Date         string  `json:"date"`
		Count        int64   `json:"count"`
		TotalINACBG  float64 `json:"total_inacbg"`
		TotalTarifRS float64 `json:"total_tarif_rs"`
	}
	var dailyClaims []DailyClaim
	monthFilter(db.Model(&models.EKlaimLocal{})).
		Select("tgl_masuk as date, COUNT(*) as count, COALESCE(SUM(CASE WHEN inacbg_tariff != '' THEN CAST(inacbg_tariff AS NUMERIC) ELSE 0 END),0) as total_inacbg, COALESCE(SUM(tarif_rs),0) as total_tarif_rs").
		Where("tgl_masuk != ''").
		Group("tgl_masuk").Order("tgl_masuk ASC").
		Find(&dailyClaims)

	// 8. Pending actions (global, not month-filtered)
	var pendingDraft, pendingSetData, pendingGrouper, pendingFinal, pendingSend int64
	db.Model(&models.EKlaimLocal{}).Where("status = ?", "draft").Count(&pendingDraft)
	db.Model(&models.EKlaimLocal{}).Where("status = ?", "new_claim").Count(&pendingSetData)
	db.Model(&models.EKlaimLocal{}).Where("status IN ?", []string{"set_claim_data", "idrg_coded"}).Count(&pendingGrouper)
	db.Model(&models.EKlaimLocal{}).Where("status IN ?", []string{"idrg_grouped", "inacbg_grouped"}).Count(&pendingFinal)
	db.Model(&models.EKlaimLocal{}).Where("status = ?", "claim_final").Count(&pendingSend)

	c.JSON(http.StatusOK, gin.H{
		"bulan":              bulan,
		"tgl_from":           tglFrom,
		"tgl_to":             tglTo,
		"total_claims":       financial.ClaimCount,
		"status_counts":      statusCounts,
		"jenis_rawat_counts": jenisRawatCounts,
		"kelas_rawat_counts": kelasRawatCounts,
		"financial":          financial,
		"recent_claims":      recentItems,
		"top_cbg":            topCBGs,
		"daily_claims":       dailyClaims,
		"pending_actions": gin.H{
			"draft":           pendingDraft,
			"new_claim":       pendingSetData,
			"pending_grouper": pendingGrouper,
			"pending_final":   pendingFinal,
			"pending_send":    pendingSend,
		},
	})
}
