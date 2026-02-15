package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
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
	status := c.Query("status")            // aktif, batal
	tglFrom := c.Query("tgl_from")         // yyyy-mm-dd
	tglTo := c.Query("tgl_to")             // yyyy-mm-dd
	claimStatus := c.Query("claim_status") // has_claim, no_claim (filter apakah sudah dibuat eklaim_local atau belum)

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
		Preload("RMDuplicate").
		Preload("RMDuplicate.Diagnoses").
		Preload("RMDuplicate.Procedures").
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

	// Check if eklaim_local already exists
	var eklaimLocal models.EKlaimLocal
	err = database.DB.Where("no_sep = ?", sep.NoSEP).First(&eklaimLocal).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal cek eklaim local"})
		return
	}

	// If eklaim_local exists and already has rm_duplicate, skip
	if err == nil {
		var existingDup models.EKlaimRMDuplicate
		if database.DB.Where("eklaim_local_id = ?", eklaimLocal.ID).First(&existingDup).Error == nil {
			c.JSON(http.StatusConflict, gin.H{
				"error":        "Duplikasi RM sudah ada untuk SEP ini",
				"eklaim_local": eklaimLocal,
			})
			return
		}
	}

	// If no eklaim_local yet, we create one (pre-new_claim state)
	if err == gorm.ErrRecordNotFound {
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat eklaim local: " + err.Error()})
			return
		}
	}

	// Load diagnoses and procedures from original RM
	var diagnoses []models.Diagnosis
	database.DB.Where("visit_id = ?", *sep.VisitID).Order("type ASC, created_at ASC").Find(&diagnoses)

	var visitProcedures []models.VisitProcedure
	database.DB.Where("visit_id = ?", *sep.VisitID).Preload("Procedure").Find(&visitProcedures)

	// Load clinical data from original RM
	var anamnesis models.Anamnesis
	database.DB.Where("visit_id = ?", *sep.VisitID).First(&anamnesis)

	var physicalExam models.PhysicalExamination
	database.DB.Where("visit_id = ?", *sep.VisitID).First(&physicalExam)

	var assessmentPlan models.AssessmentPlan
	database.DB.Where("visit_id = ?", *sep.VisitID).First(&assessmentPlan)

	var disposition models.Disposition
	database.DB.Where("visit_id = ?", *sep.VisitID).First(&disposition)

	// Serialize originals as JSON (for snapshot/audit)
	origDiagJSON, _ := json.Marshal(diagnoses)
	origProcJSON, _ := json.Marshal(visitProcedures)
	origRMJSON, _ := json.Marshal(map[string]interface{}{
		"anamnesis":       anamnesis,
		"physical_exam":   physicalExam,
		"assessment_plan": assessmentPlan,
		"disposition":     disposition,
	})

	// Get user for audit
	userID := getUserIDValue(c)

	now := time.Now()
	rmDuplicate := models.EKlaimRMDuplicate{
		EKlaimLocalID:          eklaimLocal.ID,
		VisitID:                *sep.VisitID,
		OriginalDiagnosesJSON:  string(origDiagJSON),
		OriginalProceduresJSON: string(origProcJSON),
		OriginalRMJSON:         string(origRMJSON),
		DuplicatedAt:           &now,

		// Copy Anamnesis
		ChiefComplaint:          anamnesis.ChiefComplaint,
		HistoryOfPresentIllness: anamnesis.HistoryOfPresentIllness,
		PastMedicalHistory:      anamnesis.PastMedicalHistory,
		FamilyHistory:           anamnesis.FamilyHistory,
		Allergies:               anamnesis.Allergies,
		CurrentMedications:      anamnesis.CurrentMedications,

		// Copy Physical Exam
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

		// Copy Assessment & Plan
		ClinicalAssessment: assessmentPlan.ClinicalAssessment,
		Prognosis:          assessmentPlan.Prognosis,
		TreatmentPlan:      assessmentPlan.TreatmentPlan,
		MedicationPlan:     assessmentPlan.MedicationPlan,

		// Copy Disposition
		DispositionType:      disposition.DispositionType,
		DischargeStatus:      disposition.DischargeStatus,
		DischargeCondition:   disposition.DischargeCondition,
		DischargeInstruction: disposition.DischargeInstruction,
		FollowUpInstruction:  disposition.FollowUpInstruction,
	}
	if userID > 0 {
		rmDuplicate.DuplicatedByID = &userID
	}

	if err := database.DB.Create(&rmDuplicate).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat duplikasi RM: " + err.Error()})
		return
	}

	// Copy diagnoses to eklaim duplicates
	for i, d := range diagnoses {
		eklaimDiag := models.EKlaimRMDiagnosis{
			RMDuplicateID: rmDuplicate.ID,
			ICD10Code:     d.ICD10Code,
			ICD10Name:     d.ICD10Name,
			Type:          d.Type,
			Sequence:      i + 1,
		}
		database.DB.Create(&eklaimDiag)
	}

	// Copy procedures to eklaim duplicates
	for i, vp := range visitProcedures {
		var icd9Code, procName string
		if vp.Procedure != nil {
			icd9Code = vp.Procedure.ICD9CMCode
			procName = vp.Procedure.Name
		}
		eklaimProc := models.EKlaimRMProcedure{
			RMDuplicateID: rmDuplicate.ID,
			ICD9Code:      icd9Code,
			Name:          procName,
			Sequence:      i + 1,
		}
		database.DB.Create(&eklaimProc)
	}

	// Copy lab results from ProcedureOrders
	var labOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ? AND order_type = ?", *sep.VisitID, "laboratory").
		Preload("Items.Procedure").Preload("Items.Results.ProcedureParameter").
		Find(&labOrders)
	labSeq := 0
	for _, order := range labOrders {
		for _, item := range order.Items {
			itemName := ""
			if item.Procedure != nil {
				itemName = item.Procedure.Name
			}
			for _, result := range item.Results {
				labSeq++
				paramName := ""
				unit := ""
				refRange := ""
				if result.ProcedureParameter != nil {
					paramName = result.ProcedureParameter.Name
					unit = result.ProcedureParameter.Unit
					if result.ProcedureParameter.NormalText != "" {
						refRange = result.ProcedureParameter.NormalText
					} else if result.ProcedureParameter.NormalMin > 0 || result.ProcedureParameter.NormalMax > 0 {
						refRange = fmt.Sprintf("%.1f - %.1f", result.ProcedureParameter.NormalMin, result.ProcedureParameter.NormalMax)
					}
				}
				database.DB.Create(&models.EKlaimRMLabResult{
					RMDuplicateID:  rmDuplicate.ID,
					OrderNumber:    order.OrderNumber,
					OrderItemName:  itemName,
					ParameterName:  paramName,
					Value:          result.Value,
					Unit:           unit,
					ReferenceRange: refRange,
					IsAbnormal:     result.IsHigh || result.IsLow,
					IsCritical:     result.IsCritical,
					Sequence:       labSeq,
				})
			}
		}
	}

	// Copy radiology results from ProcedureOrders
	var radOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ? AND order_type = ?", *sep.VisitID, "radiology").
		Find(&radOrders)
	for i, order := range radOrders {
		procName := ""
		if len(order.Items) > 0 && order.Items[0].Procedure != nil {
			procName = order.Items[0].Procedure.Name
		}
		database.DB.Create(&models.EKlaimRMRadiologyResult{
			RMDuplicateID: rmDuplicate.ID,
			OrderNumber:   order.OrderNumber,
			ProcedureName: procName,
			ResultSummary: order.ResultSummary,
			Conclusion:    order.Conclusion,
			Suggestion:    order.Suggestion,
			IsCritical:    order.IsCritical,
			Sequence:      i + 1,
		})
	}

	// Copy surgery notes from ProcedureOrders
	var surgeryOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ? AND order_type = ?", *sep.VisitID, "surgery").
		Preload("SurgeonDoctor").Find(&surgeryOrders)
	for i, order := range surgeryOrders {
		surgeonName := ""
		if order.SurgeonDoctor != nil {
			surgeonName = order.SurgeonDoctor.NamaLengkap
		}
		database.DB.Create(&models.EKlaimRMSurgeryNote{
			RMDuplicateID:  rmDuplicate.ID,
			OrderNumber:    order.OrderNumber,
			ProcedureName:  order.Notes,
			SurgeonName:    surgeonName,
			PreOpDiagnosis: order.Diagnosis,
			ProcedureDesc:  order.ResultSummary,
			Complications:  order.CriticalNotes,
			Sequence:       i + 1,
		})
	}

	// Reload with relations
	database.DB.Preload("Diagnoses").Preload("Procedures").
		Preload("LabResults").Preload("RadiologyResults").Preload("SurgeryNotes").
		First(&rmDuplicate, rmDuplicate.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Duplikasi RM berhasil dibuat",
		"eklaim_local": eklaimLocal,
		"rm_duplicate": rmDuplicate,
	})
}

// CreateClaimFromSEP creates EKlaimLocal + DuplicateRM + sends new_claim in one step.
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

	// Step 2: Create RMDuplicate if not exists
	var rmDup models.EKlaimRMDuplicate
	if database.DB.Where("eklaim_local_id = ?", eklaimLocal.ID).First(&rmDup).Error == gorm.ErrRecordNotFound {
		var diagnoses []models.Diagnosis
		database.DB.Where("visit_id = ?", *sep.VisitID).Order("type ASC, created_at ASC").Find(&diagnoses)

		var visitProcedures []models.VisitProcedure
		database.DB.Where("visit_id = ?", *sep.VisitID).Preload("Procedure").Find(&visitProcedures)

		origDiagJSON, _ := json.Marshal(diagnoses)
		origProcJSON, _ := json.Marshal(visitProcedures)

		now := time.Now()
		rmDup = models.EKlaimRMDuplicate{
			EKlaimLocalID:          eklaimLocal.ID,
			VisitID:                *sep.VisitID,
			OriginalDiagnosesJSON:  string(origDiagJSON),
			OriginalProceduresJSON: string(origProcJSON),
			DuplicatedAt:           &now,
		}
		if userID > 0 {
			rmDup.DuplicatedByID = &userID
		}
		if err := database.DB.Create(&rmDup).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat duplikasi RM: " + err.Error()})
			return
		}

		for i, d := range diagnoses {
			database.DB.Create(&models.EKlaimRMDiagnosis{
				RMDuplicateID: rmDup.ID,
				ICD10Code:     d.ICD10Code,
				ICD10Name:     d.ICD10Name,
				Type:          d.Type,
				Sequence:      i + 1,
			})
		}
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
	}

	// Step 3: Build new_claim data (use overrides if provided, else from SEP)
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

	// Step 4: Send new_claim to E-Klaim server
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
		// Clinical fields
		ChiefComplaint          string `json:"chief_complaint"`
		HistoryOfPresentIllness string `json:"history_of_present_illness"`
		PastMedicalHistory      string `json:"past_medical_history"`
		FamilyHistory           string `json:"family_history"`
		Allergies               string `json:"allergies"`
		CurrentMedications      string `json:"current_medications"`

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

		ClinicalAssessment string `json:"clinical_assessment"`
		Prognosis          string `json:"prognosis"`
		TreatmentPlan      string `json:"treatment_plan"`
		MedicationPlan     string `json:"medication_plan"`

		DispositionType      string `json:"disposition_type"`
		RMDischargeStatus    string `json:"rm_discharge_status"`
		DischargeCondition   string `json:"discharge_condition"`
		DischargeInstruction string `json:"discharge_instruction"`
		FollowUpInstruction  string `json:"follow_up_instruction"`

		// Diagnoses, Procedures, Tarif
		Diagnoses             []models.EKlaimRMDiagnosis `json:"diagnoses"`
		Procedures            []models.EKlaimRMProcedure `json:"procedures"`
		TarifProsedurNonBedah float64                    `json:"tarif_prosedur_non_bedah"`
		TarifProsedurBedah    float64                    `json:"tarif_prosedur_bedah"`
		TarifKonsultasi       float64                    `json:"tarif_konsultasi"`
		TarifTenagaAhli       float64                    `json:"tarif_tenaga_ahli"`
		TarifKeperawatan      float64                    `json:"tarif_keperawatan"`
		TarifPenunjang        float64                    `json:"tarif_penunjang"`
		TarifRadiologi        float64                    `json:"tarif_radiologi"`
		TarifLaboratorium     float64                    `json:"tarif_laboratorium"`
		TarifPelayananDarah   float64                    `json:"tarif_pelayanan_darah"`
		TarifRehabilitasi     float64                    `json:"tarif_rehabilitasi"`
		TarifKamar            float64                    `json:"tarif_kamar"`
		TarifRawatIntensif    float64                    `json:"tarif_rawat_intensif"`
		TarifObat             float64                    `json:"tarif_obat"`
		TarifObatKronis       float64                    `json:"tarif_obat_kronis"`
		TarifObatKemoterapi   float64                    `json:"tarif_obat_kemoterapi"`
		TarifAlkes            float64                    `json:"tarif_alkes"`
		TarifBMHP             float64                    `json:"tarif_bmhp"`
		TarifSewaAlat         float64                    `json:"tarif_sewa_alat"`

		// Lab, Radiology, Surgery
		LabResults       []models.EKlaimRMLabResult       `json:"lab_results"`
		RadiologyResults []models.EKlaimRMRadiologyResult `json:"radiology_results"`
		SurgeryNotes     []models.EKlaimRMSurgeryNote     `json:"surgery_notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	tx := database.DB.Begin()

	// Update clinical fields
	rmDup.ChiefComplaint = req.ChiefComplaint
	rmDup.HistoryOfPresentIllness = req.HistoryOfPresentIllness
	rmDup.PastMedicalHistory = req.PastMedicalHistory
	rmDup.FamilyHistory = req.FamilyHistory
	rmDup.Allergies = req.Allergies
	rmDup.CurrentMedications = req.CurrentMedications

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

	rmDup.ClinicalAssessment = req.ClinicalAssessment
	rmDup.Prognosis = req.Prognosis
	rmDup.TreatmentPlan = req.TreatmentPlan
	rmDup.MedicationPlan = req.MedicationPlan

	rmDup.DispositionType = req.DispositionType
	rmDup.DischargeStatus = req.RMDischargeStatus
	rmDup.DischargeCondition = req.DischargeCondition
	rmDup.DischargeInstruction = req.DischargeInstruction
	rmDup.FollowUpInstruction = req.FollowUpInstruction

	// Update tarif fields
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

	if err := tx.Save(&rmDup).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update RM: " + err.Error()})
		return
	}

	// Replace diagnoses
	tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMDiagnosis{})
	for i, d := range req.Diagnoses {
		d.RMDuplicateID = rmDup.ID
		d.ID = 0
		d.Sequence = i + 1
		if err := tx.Create(&d).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan diagnosis: " + err.Error()})
			return
		}
	}

	// Replace procedures
	tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMProcedure{})
	for i, p := range req.Procedures {
		p.RMDuplicateID = rmDup.ID
		p.ID = 0
		p.Sequence = i + 1
		if err := tx.Create(&p).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan prosedur: " + err.Error()})
			return
		}
	}

	// Replace lab results
	tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMLabResult{})
	for i, l := range req.LabResults {
		l.RMDuplicateID = rmDup.ID
		l.ID = 0
		l.Sequence = i + 1
		if err := tx.Create(&l).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan hasil lab: " + err.Error()})
			return
		}
	}

	// Replace radiology results
	tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMRadiologyResult{})
	for i, r := range req.RadiologyResults {
		r.RMDuplicateID = rmDup.ID
		r.ID = 0
		r.Sequence = i + 1
		if err := tx.Create(&r).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan hasil radiologi: " + err.Error()})
			return
		}
	}

	// Replace surgery notes
	tx.Where("rm_duplicate_id = ?", rmDup.ID).Delete(&models.EKlaimRMSurgeryNote{})
	for i, s := range req.SurgeryNotes {
		s.RMDuplicateID = rmDup.ID
		s.ID = 0
		s.Sequence = i + 1
		if err := tx.Create(&s).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan catatan operasi: " + err.Error()})
			return
		}
	}

	tx.Commit()

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
		Preload("LabResults").Preload("RadiologyResults").Preload("SurgeryNotes").
		First(&rmDup, rmDup.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":      "RM Duplicate berhasil diupdate",
		"rm_duplicate": rmDup,
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
	existingFound := database.DB.Where("eklaim_local_id = ?", eklaimLocal.ID).
		Preload("Diagnoses").Preload("Procedures").
		Preload("LabResults").Preload("RadiologyResults").Preload("SurgeryNotes").
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

		// Update existing record fields
		database.DB.Model(&existing).Updates(map[string]interface{}{
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
		})

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

		// Re-sync lab results if empty
		if len(existing.LabResults) == 0 {
			var labOrders []models.ProcedureOrder
			database.DB.Where("source_visit_id = ? AND order_type = ?", visitID, "laboratory").
				Preload("Items.Procedure").Preload("Items.Results.ProcedureParameter").
				Find(&labOrders)
			labSeq := 0
			for _, order := range labOrders {
				for _, item := range order.Items {
					itemName := ""
					if item.Procedure != nil {
						itemName = item.Procedure.Name
					}
					for _, result := range item.Results {
						labSeq++
						paramName, unit, refRange := "", "", ""
						if result.ProcedureParameter != nil {
							paramName = result.ProcedureParameter.Name
							unit = result.ProcedureParameter.Unit
							if result.ProcedureParameter.NormalText != "" {
								refRange = result.ProcedureParameter.NormalText
							} else if result.ProcedureParameter.NormalMin > 0 || result.ProcedureParameter.NormalMax > 0 {
								refRange = fmt.Sprintf("%.1f - %.1f", result.ProcedureParameter.NormalMin, result.ProcedureParameter.NormalMax)
							}
						}
						database.DB.Create(&models.EKlaimRMLabResult{
							RMDuplicateID:  existing.ID,
							OrderNumber:    order.OrderNumber,
							OrderItemName:  itemName,
							ParameterName:  paramName,
							Value:          result.Value,
							Unit:           unit,
							ReferenceRange: refRange,
							IsAbnormal:     result.IsHigh || result.IsLow,
							IsCritical:     result.IsCritical,
							Sequence:       labSeq,
						})
					}
				}
			}
		}

		// Re-sync radiology if empty
		if len(existing.RadiologyResults) == 0 {
			var radOrders []models.ProcedureOrder
			database.DB.Where("source_visit_id = ? AND order_type = ?", visitID, "radiology").Find(&radOrders)
			for i, order := range radOrders {
				procName := ""
				if len(order.Items) > 0 && order.Items[0].Procedure != nil {
					procName = order.Items[0].Procedure.Name
				}
				database.DB.Create(&models.EKlaimRMRadiologyResult{
					RMDuplicateID: existing.ID,
					OrderNumber:   order.OrderNumber,
					ProcedureName: procName,
					ResultSummary: order.ResultSummary,
					Conclusion:    order.Conclusion,
					Suggestion:    order.Suggestion,
					IsCritical:    order.IsCritical,
					Sequence:      i + 1,
				})
			}
		}

		// Re-sync surgery if empty
		if len(existing.SurgeryNotes) == 0 {
			var surgeryOrders []models.ProcedureOrder
			database.DB.Where("source_visit_id = ? AND order_type = ?", visitID, "surgery").
				Preload("SurgeonDoctor").Find(&surgeryOrders)
			for i, order := range surgeryOrders {
				surgeonName := ""
				if order.SurgeonDoctor != nil {
					surgeonName = order.SurgeonDoctor.NamaLengkap
				}
				database.DB.Create(&models.EKlaimRMSurgeryNote{
					RMDuplicateID:  existing.ID,
					OrderNumber:    order.OrderNumber,
					ProcedureName:  order.Notes,
					SurgeonName:    surgeonName,
					PreOpDiagnosis: order.Diagnosis,
					ProcedureDesc:  order.ResultSummary,
					Complications:  order.CriticalNotes,
					Sequence:       i + 1,
				})
			}
		}

		// Reload with updated data
		database.DB.Preload("Diagnoses").Preload("Procedures").
			Preload("LabResults").Preload("RadiologyResults").Preload("SurgeryNotes").
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
			if database.DB.Where("eklaim_local_id = ?", eklaimLocal.ID).First(&raceExisting).Error == nil {
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
					Preload("LabResults").Preload("RadiologyResults").Preload("SurgeryNotes").
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

	// Copy lab results
	var labOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ? AND order_type = ?", visitID, "laboratory").
		Preload("Items.Procedure").Preload("Items.Results.ProcedureParameter").
		Find(&labOrders)
	labSeq := 0
	for _, order := range labOrders {
		for _, item := range order.Items {
			itemName := ""
			if item.Procedure != nil {
				itemName = item.Procedure.Name
			}
			for _, result := range item.Results {
				labSeq++
				paramName := ""
				unit := ""
				refRange := ""
				if result.ProcedureParameter != nil {
					paramName = result.ProcedureParameter.Name
					unit = result.ProcedureParameter.Unit
					if result.ProcedureParameter.NormalText != "" {
						refRange = result.ProcedureParameter.NormalText
					} else if result.ProcedureParameter.NormalMin > 0 || result.ProcedureParameter.NormalMax > 0 {
						refRange = fmt.Sprintf("%.1f - %.1f", result.ProcedureParameter.NormalMin, result.ProcedureParameter.NormalMax)
					}
				}
				database.DB.Create(&models.EKlaimRMLabResult{
					RMDuplicateID:  rmDup.ID,
					OrderNumber:    order.OrderNumber,
					OrderItemName:  itemName,
					ParameterName:  paramName,
					Value:          result.Value,
					Unit:           unit,
					ReferenceRange: refRange,
					IsAbnormal:     result.IsHigh || result.IsLow,
					IsCritical:     result.IsCritical,
					Sequence:       labSeq,
				})
			}
		}
	}

	// Copy radiology results
	var radOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ? AND order_type = ?", visitID, "radiology").
		Find(&radOrders)
	for i, order := range radOrders {
		procName := ""
		if len(order.Items) > 0 && order.Items[0].Procedure != nil {
			procName = order.Items[0].Procedure.Name
		}
		database.DB.Create(&models.EKlaimRMRadiologyResult{
			RMDuplicateID: rmDup.ID,
			OrderNumber:   order.OrderNumber,
			ProcedureName: procName,
			ResultSummary: order.ResultSummary,
			Conclusion:    order.Conclusion,
			Suggestion:    order.Suggestion,
			IsCritical:    order.IsCritical,
			Sequence:      i + 1,
		})
	}

	// Copy surgery notes
	var surgeryOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ? AND order_type = ?", visitID, "surgery").
		Preload("SurgeonDoctor").Find(&surgeryOrders)
	for i, order := range surgeryOrders {
		surgeonName := ""
		if order.SurgeonDoctor != nil {
			surgeonName = order.SurgeonDoctor.NamaLengkap
		}
		database.DB.Create(&models.EKlaimRMSurgeryNote{
			RMDuplicateID:  rmDup.ID,
			OrderNumber:    order.OrderNumber,
			ProcedureName:  order.Notes,
			SurgeonName:    surgeonName,
			PreOpDiagnosis: order.Diagnosis,
			ProcedureDesc:  order.ResultSummary,
			Complications:  order.CriticalNotes,
			Sequence:       i + 1,
		})
	}

	// Reload with relations
	database.DB.Preload("Diagnoses").Preload("Procedures").
		Preload("LabResults").Preload("RadiologyResults").Preload("SurgeryNotes").
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
	if err := database.DB.Preload("SEP").First(&eklaimLocal, eklaimID).Error; err != nil {
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

	gender := 0
	if sep.JenisKelamin == "L" {
		gender = 1
	} else if sep.JenisKelamin == "P" {
		gender = 2
	}

	// Format tgl_lahir: "1940-01-01 02:00:00" (per dokumentasi)
	tglLahir := sep.TglLahir
	if len(tglLahir) == 10 {
		tglLahir = tglLahir + " 00:00:00"
	}

	claimData := eklaimSvc.NewClaimData{
		NomorKartu: sep.NoKartu,
		NomorSEP:   sep.NoSEP,
		NomorRM:    sep.NoMR,
		NamaPasien: sep.NamaPasien,
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

	// Create client and send
	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
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

	// Update eklaim_local
	now := time.Now()
	eklaimLocal.SetClaimDataSentAt = &now
	eklaimLocal.SetClaimDataResponse = string(respJSON)

	if apiErr != nil {
		eklaimLocal.SetClaimDataSuccess = false
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "set_claim_data gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
		})
		return
	}

	// Save form data to eklaim_local for reference
	eklaimLocal.SetClaimDataSuccess = true
	eklaimLocal.Status = "set_claim_data"
	eklaimLocal.TglMasuk = req.TglMasuk
	eklaimLocal.TglPulang = req.TglPulang
	eklaimLocal.CaraMasuk = req.CaraMasuk
	eklaimLocal.JenisRawat = req.JenisRawat
	eklaimLocal.KelasRawat = req.KelasRawat
	eklaimLocal.DischargeStatus = req.DischargeStatus
	eklaimLocal.ICUIndikator = req.ICUIndikator
	eklaimLocal.ICULOS = req.ICULOS
	eklaimLocal.VentilatorHour = req.VentilatorHour
	eklaimLocal.BirthWeight = req.BirthWeight
	eklaimLocal.ADLSubAcute = req.ADLSubAcute
	eklaimLocal.ADLChronic = req.ADLChronic
	eklaimLocal.UpgradeClassInd = req.UpgradeClassInd
	eklaimLocal.UpgradeClassClass = req.UpgradeClassClass
	eklaimLocal.UpgradeClassLOS = req.UpgradeClassLOS
	eklaimLocal.UpgradeClassPayor = req.UpgradeClassPayor
	eklaimLocal.AddPaymentPct = req.AddPaymentPct
	eklaimLocal.CoderNIK = req.CoderNIK
	eklaimLocal.Sistole = req.Sistole
	eklaimLocal.Diastole = req.Diastole
	eklaimLocal.KodeTarif = req.KodeTarif
	eklaimLocal.PayorID = req.PayorID
	eklaimLocal.PayorCd = req.PayorCd
	eklaimLocal.CobCd = req.CobCd
	eklaimLocal.NamaDokter = req.NamaDokter
	eklaimLocal.TarifPoliEks = req.TarifPoliEks
	eklaimLocal.NomorKartuT = req.NomorKartuT
	eklaimLocal.BayiLahirStatusCd = req.BayiLahirStatusCd
	eklaimLocal.DializerSingleUse = req.DializerSingleUse
	eklaimLocal.KantongDarah = req.KantongDarah
	eklaimLocal.AlteplaseInd = req.AlteplaseInd

	// Ventilator detail
	if vd, ok := req.Ventilator.(*eklaimSvc.VentilatorDetail); ok && vd != nil {
		eklaimLocal.VentilatorUseInd = vd.UseInd
		eklaimLocal.VentilatorStart = vd.StartDttm
		eklaimLocal.VentilatorStop = vd.StopDttm
	} else if vdMap, ok := req.Ventilator.(map[string]interface{}); ok {
		if v, ok := vdMap["use_ind"].(string); ok {
			eklaimLocal.VentilatorUseInd = v
		}
		if v, ok := vdMap["start_dttm"].(string); ok {
			eklaimLocal.VentilatorStart = v
		}
		if v, ok := vdMap["stop_dttm"].(string); ok {
			eklaimLocal.VentilatorStop = v
		}
	}

	// APGAR
	if req.Apgar != nil {
		if req.Apgar.Menit1 != nil {
			eklaimLocal.ApgarMenit1Appearance = req.Apgar.Menit1.Appearance
			eklaimLocal.ApgarMenit1Pulse = req.Apgar.Menit1.Pulse
			eklaimLocal.ApgarMenit1Grimace = req.Apgar.Menit1.Grimace
			eklaimLocal.ApgarMenit1Activity = req.Apgar.Menit1.Activity
			eklaimLocal.ApgarMenit1Respiration = req.Apgar.Menit1.Respiration
		}
		if req.Apgar.Menit5 != nil {
			eklaimLocal.ApgarMenit5Appearance = req.Apgar.Menit5.Appearance
			eklaimLocal.ApgarMenit5Pulse = req.Apgar.Menit5.Pulse
			eklaimLocal.ApgarMenit5Grimace = req.Apgar.Menit5.Grimace
			eklaimLocal.ApgarMenit5Activity = req.Apgar.Menit5.Activity
			eklaimLocal.ApgarMenit5Respiration = req.Apgar.Menit5.Respiration
		}
	}

	// Persalinan
	if req.Persalinan != nil {
		eklaimLocal.PersalinanUsiaKehamilan = req.Persalinan.UsiaKehamilan
		eklaimLocal.PersalinanGravida = req.Persalinan.Gravida
		eklaimLocal.PersalinanPartus = req.Persalinan.Partus
		eklaimLocal.PersalinanAbortus = req.Persalinan.Abortus
		eklaimLocal.PersalinanOnsetKontraksi = req.Persalinan.OnsetKontraksi
		if len(req.Persalinan.Delivery) > 0 {
			deliveryJSON, _ := json.Marshal(req.Persalinan.Delivery)
			eklaimLocal.PersalinanDeliveryJSON = string(deliveryJSON)
		}
	}

	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

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

	if !eklaimLocal.GrouperSuccess {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Harus grouper terlebih dahulu"})
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
		eklaimLocal.LastError = apiErr.Error()
		eklaimLocal.LastErrorAt = &now
		database.DB.Save(&eklaimLocal)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":        "claim_final gagal: " + apiErr.Error(),
			"eklaim_local": eklaimLocal,
			"response":     resp,
		})
		return
	}

	eklaimLocal.FinalSuccess = true
	eklaimLocal.Status = "finalized"
	eklaimLocal.LastError = ""
	eklaimLocal.LastErrorAt = nil
	database.DB.Save(&eklaimLocal)

	c.JSON(http.StatusOK, gin.H{
		"message":      "claim_final berhasil",
		"eklaim_local": eklaimLocal,
		"response":     resp,
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

// GetClaimStatusList fetches claim status from E-Klaim local server.
// GET /eklaim-local/claim-status?tgl_masuk_from=&tgl_masuk_to=&jenis_rawat=&status=
func GetClaimStatusList(c *gin.Context) {
	req := eklaimSvc.StatusRequest{
		TglMasukFrom: c.Query("tgl_masuk_from"),
		TglMasukTo:   c.Query("tgl_masuk_to"),
		JenisRawat:   c.DefaultQuery("jenis_rawat", "1"),
		Status:       c.DefaultQuery("status", "1"),
	}

	if req.TglMasukFrom == "" || req.TglMasukTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tgl_masuk_from dan tgl_masuk_to harus diisi"})
		return
	}

	client, err := eklaimSvc.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal koneksi ke server E-Klaim: " + err.Error()})
		return
	}

	resp, _, _, _, apiErr := client.GetClaimStatus(req)
	if apiErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "get_claim_status gagal: " + apiErr.Error(), "response": resp})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "get_claim_status berhasil",
		"response": resp,
	})
}

// GetEKlaimLocalList returns all E-Klaim local records (the "Eklaim" page).
// GET /eklaim-local?page=1&per_page=20&status=&search=
func GetEKlaimLocalList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	search := c.Query("search")
	status := c.Query("status")

	offset := (page - 1) * perPage

	query := database.DB.Model(&models.EKlaimLocal{})

	if search != "" {
		query = query.Where(
			"no_sep ILIKE ? OR nama_pasien ILIKE ? OR no_kartu ILIKE ? OR cbg_code ILIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%",
		)
	}

	if status != "" {
		query = query.Where("status = ?", status)
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
		Preload("RMDuplicate").
		Preload("RMDuplicate.Diagnoses").
		Preload("RMDuplicate.Procedures").
		Preload("RMDuplicate.LabResults").
		Preload("RMDuplicate.RadiologyResults").
		Preload("RMDuplicate.SurgeryNotes").
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

			origDiagJSON, _ := json.Marshal(diags)
			origProcJSON, _ := json.Marshal(vps)
			origRMJSON, _ := json.Marshal(map[string]interface{}{"anamnesis": anm, "physical_exam": pe, "assessment_plan": ap, "disposition": disp})

			now := time.Now()
			rmDup := models.EKlaimRMDuplicate{
				EKlaimLocalID:         item.ID,
				VisitID:               visitID,
				OriginalDiagnosesJSON: string(origDiagJSON),
				OriginalProceduresJSON: string(origProcJSON),
				OriginalRMJSON:        string(origRMJSON),
				DuplicatedAt:          &now,
				// All clinical fields left empty — user will sync manually
			}

			if err := database.DB.Create(&rmDup).Error; err == nil {
				item.RMDuplicate = &rmDup
				database.DB.Preload("Diagnoses").Preload("Procedures").Preload("LabResults").Preload("RadiologyResults").Preload("SurgeryNotes").First(item.RMDuplicate, rmDup.ID)
			}
		}
	}

	// ========== Auto-populate empty claim fields from Visit/SEP/RM ==========
	// Priority: RM Edit (RMDuplicate) > RM Asli (original) > SEP > Visit
	if item.TglMasuk == "" && visitID > 0 {
		visit := item.Visit
		sep := item.SEP
		rm := item.RMDuplicate

		// === Dates from Visit ===
		if visit != nil {
			if visit.AdmissionTime != nil {
				item.TglMasuk = visit.AdmissionTime.Format("2006-01-02")
			} else if visit.CheckInTime != nil {
				item.TglMasuk = visit.CheckInTime.Format("2006-01-02")
			}
			if visit.DischargeTime != nil {
				item.TglPulang = visit.DischargeTime.Format("2006-01-02")
			} else if visit.EndTime != nil {
				item.TglPulang = visit.EndTime.Format("2006-01-02")
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
			// cara_masuk from referral source
			if item.CaraMasuk == "" {
				switch sep.AsalRujukan {
				case "1":
					item.CaraMasuk = "gp" // Rujukan FKTP
				case "2":
					item.CaraMasuk = "hosp-trans" // Rujukan FKRTL
				default:
					if visit != nil {
						switch visit.VisitType {
						case "emergency":
							item.CaraMasuk = "emd"
						case "outpatient":
							item.CaraMasuk = "outp"
						case "inpatient":
							item.CaraMasuk = "inp"
						}
					}
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

	// Load original medical record data from visit
	originalRM := gin.H{}

	var anamnesis models.Anamnesis
	if err := database.DB.Where("visit_id = ?", visitID).First(&anamnesis).Error; err == nil {
		originalRM["anamnesis"] = anamnesis
	}

	var physicalExam models.PhysicalExamination
	if err := database.DB.Where("visit_id = ?", visitID).First(&physicalExam).Error; err == nil {
		originalRM["physical_examination"] = physicalExam
	}

	var diagnoses []models.Diagnosis
	if err := database.DB.Where("visit_id = ?", visitID).Order("type ASC, id ASC").Find(&diagnoses).Error; err == nil {
		originalRM["diagnoses"] = diagnoses
	}

	var assessmentPlan models.AssessmentPlan
	if err := database.DB.Where("visit_id = ?", visitID).First(&assessmentPlan).Error; err == nil {
		originalRM["assessment_plan"] = assessmentPlan
	}

	var disposition models.Disposition
	if err := database.DB.Where("visit_id = ?", visitID).First(&disposition).Error; err == nil {
		originalRM["disposition"] = disposition
	}

	// Lab results from procedure orders
	var labOrders []models.ProcedureOrder
	if err := database.DB.Where("source_visit_id = ? AND order_type = ?", visitID, "laboratory").
		Preload("Items").Preload("Items.Procedure").
		Preload("Items.Results").Preload("Items.Results.ProcedureParameter").
		Preload("PerformedBy").Preload("ValidatedBy").
		Find(&labOrders).Error; err == nil && len(labOrders) > 0 {
		originalRM["lab_orders"] = labOrders
	}

	// Radiology results from procedure orders
	var radOrders []models.ProcedureOrder
	if err := database.DB.Where("source_visit_id = ? AND order_type = ?", visitID, "radiology").
		Preload("Items").Preload("Items.Procedure").
		Preload("Items.Results").Preload("Items.Results.ProcedureParameter").
		Preload("PerformedBy").Preload("ValidatedBy").
		Find(&radOrders).Error; err == nil && len(radOrders) > 0 {
		originalRM["radiology_orders"] = radOrders
	}

	// Surgery orders
	var surgeryOrders []models.ProcedureOrder
	if err := database.DB.Where("source_visit_id = ? AND order_type = ?", visitID, "surgery").
		Preload("Items").Preload("Items.Procedure").
		Preload("Items.Results").Preload("Items.Results.ProcedureParameter").
		Preload("PerformedBy").Preload("SurgeonDoctor").
		Find(&surgeryOrders).Error; err == nil && len(surgeryOrders) > 0 {
		originalRM["surgery_orders"] = surgeryOrders
	}

	// Medicine orders
	var medicineOrders []models.MedicineOrder
	if err := database.DB.Where("source_visit_id = ?", visitID).
		Preload("Items").Preload("Items.Medicine").
		Find(&medicineOrders).Error; err == nil && len(medicineOrders) > 0 {
		originalRM["medicine_orders"] = medicineOrders
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

	c.JSON(http.StatusOK, gin.H{
		"data":        item,
		"original_rm": originalRM,
	})
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
		Preload("RMDuplicate").
		First(&eklaimLocal, eklaimID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Eklaim local tidak ditemukan"})
		return
	}

	if eklaimLocal.RMDuplicate == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "RM Duplikat belum dibuat. Silakan init RM Duplikat terlebih dahulu."})
		return
	}

	if eklaimLocal.VisitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EKlaim local belum terhubung dengan visit"})
		return
	}

	tb := mapBillingToEKlaimTarif(eklaimLocal.VisitID)
	if tb == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing tidak ditemukan untuk visit ini. Pastikan billing sudah di-generate."})
		return
	}

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
		"message":      "Tarif berhasil disinkronkan dari billing",
		"rm_duplicate": rm,
		"total_tarif":  rm.TotalTarif,
	})
}

// SyncRMFromVisit pulls all clinical data from the original visit/RM into the RM Duplicate.
// POST /eklaim-local/:id/sync-rm-from-visit
// This OVERWRITES all clinical fields, diagnoses, procedures, and tarif in the RM Duplicate.
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

	if eklaimLocal.RMDuplicate == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "RM Duplikat belum dibuat"})
		return
	}

	visitID := eklaimLocal.VisitID
	if visitID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EKlaim local belum terhubung dengan visit"})
		return
	}

	// Load original RM data
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

	tx := database.DB.Begin()

	rm := eklaimLocal.RMDuplicate

	// Overwrite clinical fields
	rm.ChiefComplaint = anm.ChiefComplaint
	rm.HistoryOfPresentIllness = anm.HistoryOfPresentIllness
	rm.PastMedicalHistory = anm.PastMedicalHistory
	rm.FamilyHistory = anm.FamilyHistory
	rm.Allergies = anm.Allergies
	rm.CurrentMedications = anm.CurrentMedications
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
	rm.ClinicalAssessment = ap.ClinicalAssessment
	rm.Prognosis = ap.Prognosis
	rm.TreatmentPlan = ap.TreatmentPlan
	rm.MedicationPlan = ap.MedicationPlan
	rm.DispositionType = disp.DispositionType
	rm.DischargeStatus = disp.DischargeStatus
	rm.DischargeCondition = disp.DischargeCondition
	rm.DischargeInstruction = disp.DischargeInstruction
	rm.FollowUpInstruction = disp.FollowUpInstruction

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

	tx.Commit()

	// Sync tarif_rs back to EKlaimLocal
	if rm.TotalTarif > 0 {
		database.DB.Model(&eklaimLocal).Update("tarif_rs", rm.TotalTarif)
	}

	// Reload
	database.DB.Preload("Diagnoses").Preload("Procedures").
		Preload("LabResults").Preload("RadiologyResults").Preload("SurgeryNotes").
		First(rm, rm.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Data berhasil disinkronkan dari kunjungan",
		"rm_duplicate": rm,
	})
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
	database.DB.Model(&models.EKlaimLocalLog{}).Where("eklaim_local_id = ?", eklaimID).Count(&total)

	var logs []models.EKlaimLocalLog
	if err := database.DB.Where("eklaim_local_id = ?", eklaimID).
		Preload("User").
		Order("created_at DESC").
		Offset(offset).Limit(perPage).
		Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil logs"})
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
		query = query.Where("eklaim_local_id IN (?)", subQuery)
		countQuery = countQuery.Where("eklaim_local_id IN (?)", subQuery)
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
	case "pulang":
		return "1"
	case "rujuk":
		return "2"
	case "aps":
		return "3"
	case "meninggal", "dod":
		return "4"
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
