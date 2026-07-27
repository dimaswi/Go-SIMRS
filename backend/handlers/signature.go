package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"
)

const documentSignatureConfigSettingKey = "document_signature_config_json"

type DocumentSignatureRule struct {
	DocumentType       string   `json:"document_type"`
	Label              string   `json:"label"`
	RequiredSignatures int      `json:"required_signatures"`
	Slots              []string `json:"slots,omitempty"`
	LayoutHint         string   `json:"layout_hint,omitempty"` // Human-readable slot location in PDF template
}

var documentSignatureCatalog = []string{
	models.DocTypeVisitResume,
	models.DocTypePrescription,
	models.DocTypeLabResult,
	models.DocTypeRadiologyResult,
	models.DocTypeSickLetter,
	models.DocTypeHealthCertificate,
	models.DocTypeBirthCertificate,
	models.DocTypeLeaveCertificate,
	models.DocTypeMCUCertificate,
	models.DocTypeDeathCertificate,
	models.DocTypeReferralLetter,
	models.DocTypeGeneralConsent,
	"general_consent_inpatient",
	models.DocTypeInformedConsent,
	models.DocTypeCPPT,
	models.DocTypeNursingCare,
	models.DocTypeFluidBalance,
	models.DocTypeBedTransfer,
	models.DocTypeVitalSign,
	models.DocTypeTriage,
	models.DocTypeEmergencySummary,
	models.DocTypeOperativeReport,
	models.DocTypeConsultationResult,
	models.DocTypeInpatientCert,
	models.DocTypePharmacyHandover,
	models.DocTypeRegistration,
	models.DocTypeSPRI,
	models.DocTypeSuratKontrol,
	models.DocTypeBersalin,

	models.DocTypeRMDupLabResult,
	models.DocTypeRMDupRadResult,
	models.DocTypeRMDupSurgeryReport,
	models.DocTypeRMDupConsultation,
	models.DocTypeRMDupResume,
	models.DocTypeRMDupInpatientResume,
	models.DocTypeRMDupReferral,
	models.DocTypeRMDupTriage,
	models.DocTypeRMDupEmergency,
	models.DocTypeRMDupCPPT,
	models.DocTypeRMDupConsent,
	"rm_dup_general_consent_inpatient",
	models.DocTypeRMDupNursingCare,
	models.DocTypeRMDupFluidBalance,
	models.DocTypeRMDupPrescription,
	models.DocTypeRMDupSEP,
	models.DocTypeRMDupAdmission,
	models.DocTypeRMDupRegistration,
	models.DocTypeRMDupConsent,
	models.DocTypeRMDupNursingCare,
	models.DocTypeRMDupBedTransfer,
	models.DocTypeRMDupVitalSign,
	models.DocTypeRMDupInpatientCert,
	models.DocTypeRMDupBilling,
}

func getSignatureDB(docType string) *gorm.DB {
	if strings.HasPrefix(docType, "rm_dup_") {
		return database.CasemixDB
	}
	return database.DB
}

// ================= PIN Management =================

// SetupPINRequest for setting up signature PIN
type SetupPINRequest struct {
	PIN        string `json:"pin" binding:"required,len=6,numeric"`
	ConfirmPIN string `json:"confirm_pin" binding:"required,len=6,numeric"`
	Password   string `json:"password" binding:"required"` // Verify current password
}

// SetupSignaturePIN sets up the user's signature PIN for the first time
func SetupSignaturePIN(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var req SetupPINRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN harus 6 digit angka"})
		return
	}

	if req.PIN != req.ConfirmPIN {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN dan konfirmasi PIN tidak sama"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Verify password
	if !user.CheckPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Password salah"})
		return
	}

	// Hash and save PIN
	if err := user.HashSignaturePin(req.PIN); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan PIN"})
		return
	}

	now := time.Now()
	user.SignaturePinSetAt = &now

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan PIN"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "PIN tanda tangan berhasil diatur",
	})
}

// ChangePINRequest for changing signature PIN
type ChangePINRequest struct {
	OldPIN     string `json:"old_pin" binding:"required,len=6,numeric"`
	NewPIN     string `json:"new_pin" binding:"required,len=6,numeric"`
	ConfirmPIN string `json:"confirm_pin" binding:"required,len=6,numeric"`
}

// ChangeSignaturePIN changes the user's signature PIN
func ChangeSignaturePIN(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var req ChangePINRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN harus 6 digit angka"})
		return
	}

	if req.NewPIN != req.ConfirmPIN {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN baru dan konfirmasi tidak sama"})
		return
	}

	if req.OldPIN == req.NewPIN {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN baru harus berbeda dengan PIN lama"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Verify old PIN
	if !user.CheckSignaturePin(req.OldPIN) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN lama salah"})
		return
	}

	// Hash and save new PIN
	if err := user.HashSignaturePin(req.NewPIN); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan PIN"})
		return
	}

	now := time.Now()
	user.SignaturePinSetAt = &now

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan PIN"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "PIN tanda tangan berhasil diubah",
	})
}

// ResetSignaturePIN (Admin only) resets user's PIN
type ResetPINRequest struct {
	UserID uint   `json:"user_id" binding:"required"`
	NewPIN string `json:"new_pin" binding:"required,len=6,numeric"`
}

// ResetUserSignaturePIN allows admin to reset a user's signature PIN
func ResetUserSignaturePIN(c *gin.Context) {
	var req ResetPINRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.First(&user, req.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Hash and save new PIN
	if err := user.HashSignaturePin(req.NewPIN); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan PIN"})
		return
	}

	now := time.Now()
	user.SignaturePinSetAt = &now

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan PIN"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "PIN tanda tangan user berhasil direset",
	})
}

// ================= Document Signing =================

// SignDocumentRequest for signing a document
type SignDocumentRequest struct {
	PIN                string `json:"pin,omitempty"`
	DocumentType       string `json:"document_type" binding:"required"`
	DocumentID         uint   `json:"document_id" binding:"required"`
	VisitID            *uint  `json:"visit_id,omitempty"`
	Notes              string `json:"notes,omitempty"`
	SignerEmployeeID   *uint  `json:"signer_employee_id,omitempty"`  // Sign on behalf of another employee
	RequiredSignatures *int   `json:"required_signatures,omitempty"` // Optional required signatures for this document
	SignatureSlot      string `json:"signature_slot,omitempty"`      // left | right
	SignatureRole      string `json:"signature_role,omitempty"`      // dpjp | perawat | pasien | kosong
	SignatureLocation  string `json:"signature_location,omitempty"`  // free text
	SignatureDate      string `json:"signature_date,omitempty"`      // YYYY-MM-DD
	SignatureName      string `json:"signature_name,omitempty"`      // optional display name (e.g. patient name)
}

// SignDocument signs a document with the user's PIN
func SignDocument(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var req SignDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	role := strings.ToLower(strings.TrimSpace(req.SignatureRole))
	pinRequiredByRole := role != "pasien" && role != "kosong"

	// Check if signature PIN is required
	var setting models.Setting
	signatureRequired := true
	if err := database.DB.Where("key = ?", "signature_pin_required").First(&setting).Error; err == nil {
		signatureRequired = setting.Value == "true" || setting.Value == "1"
	}

	var user models.User
	if err := database.DB.Preload("Employee").Preload("Role").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// By default validate PIN against current logged-in user.
	pinOwnerUser := user
	pinOwnerUserID := userID

	// If signing for selected employee, validate using that employee's user PIN.
	if req.SignerEmployeeID != nil {
		var signerUser models.User
		if err := database.DB.Preload("Employee").Where("employee_id = ?", *req.SignerEmployeeID).First(&signerUser).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User penandatangan tidak ditemukan"})
			return
		}
		pinOwnerUser = signerUser
		pinOwnerUserID = signerUser.ID
	}

	// If PIN is required, verify it
	if signatureRequired && pinRequiredByRole {
		if len(req.PIN) != 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "PIN harus 6 digit angka"})
			return
		}
		for _, ch := range req.PIN {
			if ch < '0' || ch > '9' {
				c.JSON(http.StatusBadRequest, gin.H{"error": "PIN harus 6 digit angka"})
				return
			}
		}
		if pinOwnerUser.SignaturePin == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":    "PIN tanda tangan penandatangan belum diatur",
				"code":     "PIN_NOT_SET",
				"redirect": "/settings/signature-pin",
			})
			return
		}

		if !pinOwnerUser.CheckSignaturePin(req.PIN) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "PIN salah"})
			return
		}
	}

	// Check if document already has a signature record (will be updated if re-signing)
	var existingSignature models.DocumentSignature
	sigDB := getSignatureDB(req.DocumentType)
	sigDB.Where("document_type = ? AND document_id = ?", req.DocumentType, req.DocumentID).First(&existingSignature)

	// Generate signature hash
	signedAt := time.Now()
	signatureData := fmt.Sprintf("%s:%d:%d:%s", req.DocumentType, req.DocumentID, pinOwnerUserID, signedAt.Format(time.RFC3339))
	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "default-signature-secret"
	}
	signatureHash := generateHMAC(signatureData, secretKey)

	// Get signer info — use designated employee if signing on behalf of, otherwise use logged-in user
	var signerName, signerNIP, signerSTR, signerSIP, signerRole string
	var signerEmployeeID *uint
	if role == "pasien" {
		signerName = strings.TrimSpace(req.SignatureName)
		if signerName == "" {
			signerName = "Pasien"
		}
		signerRole = "Pasien"
		signerEmployeeID = nil
	} else if role == "kosong" {
		signerName = ""
		signerRole = ""
		signerEmployeeID = nil
	} else if req.SignerEmployeeID != nil {
		// Sign on behalf of another employee
		var designatedEmployee models.Employee
		if err := database.DB.First(&designatedEmployee, *req.SignerEmployeeID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Karyawan penandatangan tidak ditemukan"})
			return
		}
		signerName = designatedEmployee.NamaLengkap
		signerNIP = designatedEmployee.NIP
		signerSTR = designatedEmployee.NoSTR
		signerSIP = designatedEmployee.NoSIP
		signerRole = designatedEmployee.Jabatan
		signerEmployeeID = &designatedEmployee.ID

		// Auto-append audit note
		authorizedBy := user.FullName
		if user.Employee != nil {
			authorizedBy = user.Employee.NamaLengkap
		}
		auditNote := fmt.Sprintf("Ditandatangani atas nama %s oleh %s", signerName, authorizedBy)
		if req.Notes != "" {
			req.Notes = req.Notes + " | " + auditNote
		} else {
			req.Notes = auditNote
		}
	} else if user.Employee != nil {
		// Default signer name follows account identity to avoid mismatch between account label
		// and linked employee profile (e.g. System Admin account linked to specific employee).
		signerName = user.FullName
		if signerName == "" {
			signerName = user.Employee.NamaLengkap
		}
		signerNIP = user.Employee.NIP
		signerSTR = user.Employee.NoSTR
		signerSIP = user.Employee.NoSIP
		signerRole = user.Employee.Jabatan
		signerEmployeeID = &user.Employee.ID
	} else {
		signerName = user.FullName
	}

	if err := ensureAllowedOrderDocumentSigner(req.DocumentType, req.DocumentID, signerEmployeeID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	if err := ensureAllowedSuratDocumentSigner(req.DocumentType, req.DocumentID, signerEmployeeID, "TTD"); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	resolvedSlot := normalizeSignatureSlot(req.SignatureSlot)
	if req.Notes == "" {
		req.Notes = buildSignatureMetaNote(resolvedSlot, req.SignatureRole, req.SignatureLocation, req.SignatureDate, req.SignatureName)
	} else {
		req.Notes = req.Notes + " | " + buildSignatureMetaNote(resolvedSlot, req.SignatureRole, req.SignatureLocation, req.SignatureDate, req.SignatureName)
	}

	// Create signature log
	signatureLog := models.SignatureLog{
		UserID:           pinOwnerUserID,
		DocumentType:     req.DocumentType,
		DocumentID:       req.DocumentID,
		VisitID:          req.VisitID,
		SignedAt:         signedAt,
		SignatureHash:    signatureHash,
		Action:           models.SignActionSign,
		SignerName:       signerName,
		SignerNIP:        signerNIP,
		SignerSTR:        signerSTR,
		SignerSIP:        signerSIP,
		SignerRole:       signerRole,
		SignerEmployeeID: signerEmployeeID,
		IPAddress:        c.ClientIP(),
		UserAgent:        c.Request.UserAgent(),
		Notes:            req.Notes,
	}

	if err := sigDB.Create(&signatureLog).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan log tanda tangan"})
		return
	}

	// Create or update document signature
	requiredSignatures := resolveRequiredSignatureCount(req.DocumentType, req.RequiredSignatures)
	docSignature := models.DocumentSignature{
		DocumentType:       req.DocumentType,
		DocumentID:         req.DocumentID,
		SignedAt:           &signedAt,
		SignedByID:         &pinOwnerUserID,
		SignatureHash:      signatureHash,
		RequiredSignatures: requiredSignatures,
		SignedSignatures:   1,
		IsFullySigned:      requiredSignatures <= 1,
		IsLocked:           requiredSignatures <= 1,
	}

	if existingSignature.ID > 0 {
		docSignature.ID = existingSignature.ID
		if existingSignature.RequiredSignatures > 0 && req.RequiredSignatures == nil {
			docSignature.RequiredSignatures = existingSignature.RequiredSignatures
		}
		sigDB.Save(&docSignature)
	} else {
		sigDB.Create(&docSignature)
	}

	signerKey := signatureSignerKey(req.SignerEmployeeID, pinOwnerUserID, resolvedSlot)
	upsertDocumentSigner(sigDB, req.DocumentType, req.DocumentID, signerKey, pinOwnerUserID, signedAt, signatureHash)
	refreshDocumentSignatureState(sigDB, req.DocumentType, req.DocumentID)

	// Invalidate cached PDF for this document (signature changes the rendered output)
	go invalidateAllPDFCachesForSignature(req.DocumentType, req.DocumentID)

	c.JSON(http.StatusOK, gin.H{
		"message":        "Dokumen berhasil ditandatangani",
		"signature_hash": signatureHash,
		"signed_at":      signedAt,
		"signed_by":      signerName,
	})
}

func ensureAllowedOrderDocumentSigner(documentType string, documentID uint, signerEmployeeID *uint) error {
	if documentType != models.DocTypeConsultationResult {
		return nil
	}

	if signerEmployeeID == nil {
		return fmt.Errorf("TTD hasil konsultasi hanya bisa dilakukan oleh petugas pengisi")
	}

	var order models.ProcedureOrder
	if err := database.DB.Select("id", "ordered_by_id", "performed_by_id").Preload("Items", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "procedure_order_id", "performed_by_id")
	}).Preload("Consultation", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "procedure_order_id", "consultant_id")
	}).First(&order, documentID).Error; err != nil {
		return fmt.Errorf("Order konsultasi tidak ditemukan")
	}

	performed := false
	if order.PerformedByID != nil && *order.PerformedByID == *signerEmployeeID {
		performed = true
	}
	if !performed && order.Consultation != nil && order.Consultation.ConsultantID != nil && *order.Consultation.ConsultantID == *signerEmployeeID {
		performed = true
	}
	if !performed {
		for _, item := range order.Items {
			if item.PerformedByID != nil && *item.PerformedByID == *signerEmployeeID {
				performed = true
				break
			}
		}
	}

	if !performed {
		if order.OrderedByID == *signerEmployeeID {
			return fmt.Errorf("Pengorder tidak bisa TTD hasil konsultasi")
		}
		return fmt.Errorf("TTD hasil konsultasi hanya bisa dilakukan oleh petugas pengisi")
	}

	return nil
}

// VerifySignaturePIN verifies PIN without signing (for validation)
type VerifyPINRequest struct {
	PIN string `json:"pin" binding:"required,len=6,numeric"`
}

// VerifySignaturePIN verifies the user's signature PIN
func VerifySignaturePIN(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var req VerifyPINRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN harus 6 digit angka"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Bypass PIN validation if user hasn't set one yet
	if !user.HasSignaturePin {
		c.JSON(http.StatusOK, gin.H{
			"message": "PIN valid (bypassed, not set)",
			"valid":   true,
		})
		return
	}

	if !user.CheckSignaturePin(req.PIN) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN salah", "valid": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "PIN valid",
		"valid":   true,
	})
}

// GetDocumentSignature gets the signature status of a document
func GetDocumentSignature(c *gin.Context) {
	docType := c.Query("document_type")
	docIDStr := c.Query("document_id")

	if docType == "" || docIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document_type dan document_id diperlukan"})
		return
	}

	docID, err := strconv.ParseUint(docIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document_id tidak valid"})
		return
	}

	sigDB := getSignatureDB(docType)
	var signature models.DocumentSignature
	reqSigs := resolveRequiredSignatureCount(docType, nil)
	
	if err := sigDB.Preload("SignedBy").
		Where("document_type = ? AND document_id = ?", docType, docID).
		First(&signature).Error; err != nil {
		
		signedSlots := getSignedSlots(sigDB, docType, uint(docID))
		slotDetails := getSignedSlotDetails(sigDB, docType, uint(docID))
		signedSlotsCount := len(signedSlots)
		
		c.JSON(http.StatusOK, gin.H{
			"is_signed": false,
			"is_locked": false,
			"required_signatures": reqSigs,
			"signed_signatures": signedSlotsCount,
			"is_fully_signed": false,
			"signed_slots": signedSlots,
			"slot_details": slotDetails,
		})
		return
	}

	signedSlots := getSignedSlots(sigDB, signature.DocumentType, signature.DocumentID)
	slotDetails := getSignedSlotDetails(sigDB, signature.DocumentType, signature.DocumentID)
	signedSlotsCount := len(signedSlots)
	
	currentSigned := signature.SignedSignatures
	if signedSlotsCount > currentSigned {
		currentSigned = signedSlotsCount
	}
	
	if signature.SignedAt != nil && currentSigned == 0 {
		currentSigned = 1
	}

	isFullySigned := signature.IsFullySigned
	if reqSigs > signature.RequiredSignatures {
		isFullySigned = currentSigned >= reqSigs
	}

	result := gin.H{
		"is_signed":           signature.SignedAt != nil,
		"is_locked":           signature.IsLocked,
		"signed_at":           signature.SignedAt,
		"signature_hash":      signature.SignatureHash,
		"required_signatures": reqSigs,
		"signed_signatures":   currentSigned,
		"is_fully_signed":     isFullySigned,
		"signed_slots":        signedSlots,
		"slot_details":        slotDetails,
	}

	if signature.SignedBy != nil {
		result["signed_by"] = gin.H{
			"id":        signature.SignedBy.ID,
			"full_name": signature.SignedBy.FullName,
		}
	}

	c.JSON(http.StatusOK, result)
}

// CanSignDocument checks whether current user can sign the requested document.
func CanSignDocument(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	docType := c.Query("document_type")
	docIDStr := c.Query("document_id")
	if docType == "" || docIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document_type dan document_id diperlukan"})
		return
	}

	docID, err := strconv.ParseUint(docIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document_id tidak valid"})
		return
	}

	var user models.User
	if err := database.DB.Select("id", "employee_id").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	err = ensureAllowedOrderDocumentSigner(docType, uint(docID), user.EmployeeID)
	if err == nil {
		err = ensureAllowedSuratDocumentSigner(docType, uint(docID), user.EmployeeID, "TTD")
	}
	allowed := err == nil

	resp := gin.H{"allowed": allowed}
	if err != nil {
		resp["reason"] = err.Error()
	}

	c.JSON(http.StatusOK, resp)
}

// ================= Audit Logs =================

// GetSignatureLogs gets all signature logs with filtering
func GetSignatureLogs(c *gin.Context) {
	var logs []models.SignatureLog

	query := database.DB.Preload("User").Preload("Visit.Registration.Patient").
		Order("created_at DESC")

	// Filter by user
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	// Filter by document type
	if docType := c.Query("document_type"); docType != "" {
		query = query.Where("document_type = ?", docType)
	}

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("signed_at >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("signed_at < ?", endDate+" 23:59:59")
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * pageSize

	var total int64
	query.Model(&models.SignatureLog{}).Count(&total)

	query.Offset(offset).Limit(pageSize).Find(&logs)

	// Resolve Visit dynamically for logs that don't have it explicitly stored
	for i := range logs {
		if logs[i].VisitID == nil || logs[i].Visit == nil {
			var visitID uint
			db := getSignatureDB(logs[i].DocumentType)
			
			if logs[i].DocumentType == models.DocTypeSPRI {
				db.Table("spri").Select("visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
			} else if logs[i].DocumentType == models.DocTypeSuratKontrol {
				db.Table("surat_kontrol").Select("visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
			} else if logs[i].DocumentType == models.DocTypePrescription {
				db.Table("medicine_orders").Select("source_visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
				if visitID == 0 {
					db.Table("medicine_orders").Select("visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
				}
			} else if logs[i].DocumentType == models.DocTypeRegistration {
				db.Table("visits").Select("id").Where("registration_id = ?", logs[i].DocumentID).Order("id asc").Limit(1).Scan(&visitID)
			} else if logs[i].DocumentType == models.DocTypeLabResult || logs[i].DocumentType == models.DocTypeRadiologyResult {
				db.Table("procedure_orders").Select("source_visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
			} else if logs[i].DocumentType == models.DocTypeGeneralConsent {
				db.Table("general_consents").Select("visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
			} else if logs[i].DocumentType == models.DocTypeInformedConsent {
				db.Table("informed_consents").Select("visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
			} else if logs[i].DocumentType == models.DocTypeConsultationResult {
				db.Table("consultations").Select("visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
			} else if logs[i].DocumentType == "bersalin_record" || logs[i].DocumentType == "bersalin" {
				db.Table("bersalin_records").Select("visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
			} else {
				// Fallback to medical_records (CPP, Triage, Resume, dll)
				db.Table("medical_records").Select("visit_id").Where("id = ?", logs[i].DocumentID).Scan(&visitID)
			}
			
			if visitID > 0 {
				var visit models.Visit
				if err := database.DB.Preload("Registration.Patient").First(&visit, visitID).Error; err == nil {
					vID := visitID
					logs[i].VisitID = &vID
					logs[i].Visit = &visit
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
		"page":  page,
		"pages": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// GetMedicalRecordEditLogsAudit gets all medical record edit logs with extended filtering for audit
func GetMedicalRecordEditLogsAudit(c *gin.Context) {
	var logs []models.MedicalRecordEditLog

	query := database.DB.Preload("EditedBy").Preload("Visit.Registration.Patient").
		Order("created_at DESC")

	// Filter by visit
	if visitID := c.Query("visit_id"); visitID != "" {
		query = query.Where("visit_id = ?", visitID)
	}

	// Filter by user
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("edited_by_id = ?", userID)
	}

	// Filter by record type
	if recordType := c.Query("record_type"); recordType != "" {
		query = query.Where("record_type = ?", recordType)
	}

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("edited_at >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("edited_at < ?", endDate+" 23:59:59")
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * pageSize

	var total int64
	query.Model(&models.MedicalRecordEditLog{}).Count(&total)

	query.Offset(offset).Limit(pageSize).Find(&logs)

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
		"page":  page,
		"pages": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// VerifyDocumentSignature verifies a document signature by hash (public endpoint for external verification)
func VerifyDocumentSignature(c *gin.Context) {
	hash := c.Param("hash")

	if hash == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hash tidak valid"})
		return
	}

	var signatureLog models.SignatureLog
	if err := database.DB.Preload("User").Preload("Visit.Registration.Patient").
		Where("signature_hash = ?", hash).
		First(&signatureLog).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"valid":   false,
			"message": "Tanda tangan tidak ditemukan atau tidak valid",
		})
		return
	}

	result := gin.H{
		"valid":          true,
		"message":        "Tanda tangan valid",
		"document_type":  humanDocTypeName(signatureLog.DocumentType),
		"signed_at":      signatureLog.SignedAt,
		"signer_name":    resolveSignedUserName(signatureLog, signatureLog.SignerName),
		"signer_nip":     signatureLog.SignerNIP,
		"signer_str":     signatureLog.SignerSTR,
		"signer_role":    signatureLabelFromMeta(signatureLog),
		"signature_hash": signatureLog.SignatureHash,
	}

	if result["signer_role"] == "" {
		result["signer_role"] = signatureLog.SignerRole
	}

	var allSigners []models.SignatureLog
	database.DB.
		Where("document_type = ? AND document_id = ? AND action = ? AND signature_hash != ''", signatureLog.DocumentType, signatureLog.DocumentID, models.SignActionSign).
		Order("signed_at ASC").
		Find(&allSigners)

	type SignerDetail struct {
		Name string    `json:"name"`
		Role string    `json:"role"`
		Date time.Time `json:"date"`
		Hash string    `json:"hash"`
	}

	var signers []SignerDetail
	for _, s := range allSigners {
		name := resolveSignedUserName(s, s.SignerName)
		role := signatureLabelFromMeta(s)
		if role == "" {
			role = s.SignerRole
		}
		signers = append(signers, SignerDetail{
			Name: name,
			Role: role,
			Date: s.SignedAt,
			Hash: s.SignatureHash,
		})
	}
	result["signers"] = signers

	if signatureLog.Visit != nil && signatureLog.Visit.Registration != nil && signatureLog.Visit.Registration.Patient != nil {
		result["patient_name"] = signatureLog.Visit.Registration.Patient.NamaLengkap
		result["patient_mr"] = signatureLog.Visit.Registration.Patient.NoRM
	}

	c.JSON(http.StatusOK, result)
}

// CheckSignaturePINRequired checks if signature PIN is required
func CheckSignaturePINRequired(c *gin.Context) {
	var setting models.Setting
	required := true
	if err := database.DB.Where("key = ?", "signature_pin_required").First(&setting).Error; err == nil {
		required = setting.Value == "true" || setting.Value == "1"
	}

	c.JSON(http.StatusOK, gin.H{
		"signature_pin_required": required,
	})
}

// Helper function to generate HMAC-SHA256
func generateHMAC(data, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// humanDocTypeName maps internal document_type codes to human-readable Indonesian names.
// RM Duplicate types are mapped to their original document names (without exposing "rm_dup" prefix).
func humanDocTypeName(dt string) string {
	names := map[string]string{
		models.DocTypeVisitResume:        "Resume Medis",
		models.DocTypePrescription:       "Resep Obat",
		models.DocTypeLabResult:          "Hasil Laboratorium",
		models.DocTypeRadiologyResult:    "Hasil Radiologi",
		models.DocTypeSickLetter:         "Surat Keterangan Sakit",
		models.DocTypeDeathCertificate:   "Surat Kematian",
		models.DocTypeReferralLetter:     "Surat Rujukan",
		models.DocTypeGeneralConsent:     "General Consent",
		"general_consent_inpatient":      "Persetujuan Umum (General Consent) Rawat Inap",
		models.DocTypeInformedConsent:    "Informed Consent",
		models.DocTypeCPPT:               "CPPT",
		models.DocTypeNursingCare:        "Asuhan Keperawatan",
		models.DocTypeFluidBalance:       "Balance Cairan",
		models.DocTypeBedTransfer:        "Mutasi Pasien",
		models.DocTypeVitalSign:          "Grafik Tanda Vital",
		models.DocTypeTriage:             "Formulir Triage",
		models.DocTypeEmergencySummary:   "Ringkasan Pelayanan UGD",
		models.DocTypeOperativeReport:    "Laporan Operasi",
		models.DocTypeConsultationResult: "Hasil Konsultasi",
		models.DocTypeInpatientCert:      "Surat Keterangan Rawat Inap",
		models.DocTypePharmacyHandover:   "Serah Terima Obat",
		models.DocTypeRegistration:       "Bukti Registrasi",
		
		"outpatient_resume":              "Resume Medis Rawat Jalan",
		"inpatient_resume":               "Resume Medis Rawat Inap",
		"lab_order":                      "Permintaan Laboratorium",
		"admission_discharge_reg":        "Ringkasan Masuk & Keluar Pasien",

		// RM Duplicate — map to the same human-readable name as the original
		models.DocTypeRMDupLabResult:       "Hasil Laboratorium",
		models.DocTypeRMDupRadResult:       "Hasil Radiologi",
		models.DocTypeRMDupSurgeryReport:   "Laporan Operasi",
		models.DocTypeRMDupConsultation:    "Hasil Konsultasi",
		models.DocTypeRMDupResume:          "Resume Medis",
		models.DocTypeRMDupInpatientResume: "Resume Medis Rawat Inap",
		models.DocTypeRMDupReferral:        "Surat Rujukan",
		models.DocTypeRMDupTriage:          "Formulir Triage",
		models.DocTypeRMDupEmergency:       "Ringkasan Pelayanan UGD",
		models.DocTypeRMDupCPPT:            "CPPT",
		models.DocTypeRMDupFluidBalance:    "Balance Cairan",
		models.DocTypeRMDupPrescription:    "Resep Obat",
		models.DocTypeRMDupSEP:             "Surat Eligibilitas Peserta",
		models.DocTypeRMDupAdmission:       "Ringkasan Masuk & Keluar Pasien",
		models.DocTypeRMDupRegistration:    "Bukti Registrasi",
		models.DocTypeRMDupConsent:         "Informed Consent",
		"rm_dup_general_consent_inpatient": "Persetujuan Umum (General Consent) Rawat Inap",
		models.DocTypeRMDupNursingCare:     "Asuhan Keperawatan",
		models.DocTypeRMDupBedTransfer:     "Mutasi Pasien",
		models.DocTypeRMDupVitalSign:       "Grafik Tanda Vital",
		models.DocTypeRMDupInpatientCert:   "Surat Keterangan Rawat Inap",
	}
	if name, ok := names[dt]; ok {
		return name
	}
	return dt
}

// RevokeDocumentSignature revokes/cancels a document signature
// Requires PIN verification and creates an audit log entry
type RevokeSignatureRequest struct {
	DocumentType string `json:"document_type" binding:"required"`
	DocumentID   uint   `json:"document_id" binding:"required"`
	PIN          string `json:"pin" binding:"required,len=6,numeric"`
	Reason       string `json:"reason"` // Optional reason for revocation
	Slot         string `json:"slot"`   // Optional slot to revoke (e.g. "left" or "right")
}

func RevokeDocumentSignature(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var req RevokeSignatureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Verify PIN (always required for revocation)
	if user.SignaturePin == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":    "Anda belum mengatur PIN tanda tangan",
			"code":     "PIN_NOT_SET",
			"redirect": "/settings/signature-pin",
		})
		return
	}

	if !user.CheckSignaturePin(req.PIN) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN salah"})
		return
	}

	if err := ensureNotOrdererRevokingOrderDoc(req.DocumentType, req.DocumentID, user.EmployeeID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	if err := ensureAllowedSuratDocumentSigner(req.DocumentType, req.DocumentID, user.EmployeeID, "Batal TTD"); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// Check if document is signed (either by main signer or slot signers)
	sigDB := getSignatureDB(req.DocumentType)
	var docSignature models.DocumentSignature
	errSig := sigDB.Where("document_type = ? AND document_id = ?", req.DocumentType, req.DocumentID).First(&docSignature).Error
	
	var signers []models.DocumentSignatureSigner
	sigDB.Where("document_type = ? AND document_id = ? AND is_active = ?", req.DocumentType, req.DocumentID, true).Find(&signers)

	if errSig != nil && len(signers) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tanda tangan tidak ditemukan"})
		return
	}

	if (docSignature.SignedAt == nil || errSig != nil) && len(signers) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dokumen belum ditandatangani"})
		return
	}

	// Get signer info
	var signerName, signerNIP, signerSTR, signerSIP, signerRole string
	var signerEmployeeID *uint
	if user.Employee != nil {
		signerName = user.Employee.NamaLengkap
		signerNIP = user.Employee.NIP
		signerSTR = user.Employee.NoSTR
		signerSIP = user.Employee.NoSIP
		signerRole = user.Employee.Jabatan
		signerEmployeeID = &user.Employee.ID
	} else {
		signerName = user.FullName
	}

	revokedAt := time.Now()
	revokeData := fmt.Sprintf("revoke:%s:%d:%d:%s", req.DocumentType, req.DocumentID, userID, revokedAt.Format(time.RFC3339))
	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "default-signature-secret"
	}
	revokeHash := generateHMAC(revokeData, secretKey)

	notes := "Pembatalan tanda tangan digital"
	if req.Reason != "" {
		notes = req.Reason
	}

	// Get the original sign log to retrieve correct VisitID
	var originalSignLog models.SignatureLog
	var visitID *uint
	if err := sigDB.Where("document_type = ? AND document_id = ? AND action = ?",
		req.DocumentType, req.DocumentID, models.SignActionSign).
		Order("signed_at DESC").First(&originalSignLog).Error; err == nil {
		visitID = originalSignLog.VisitID
	}

	// Create revoke audit log
	revokeLog := models.SignatureLog{
		UserID:           userID,
		DocumentType:     req.DocumentType,
		DocumentID:       req.DocumentID,
		VisitID:          visitID,
		SignedAt:         revokedAt,
		SignatureHash:    revokeHash,
		Action:           models.SignActionRevoke,
		SignerName:       signerName,
		SignerNIP:        signerNIP,
		SignerSTR:        signerSTR,
		SignerSIP:        signerSIP,
		SignerRole:       signerRole,
		SignerEmployeeID: signerEmployeeID,
		IPAddress:        c.ClientIP(),
		UserAgent:        c.Request.UserAgent(),
		Notes:            notes,
	}

	if err := sigDB.Create(&revokeLog).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan log pembatalan"})
		return
	}

	if req.Slot != "" {
		// Only deactivate the specified slot
		sigDB.Where("document_type = ? AND document_id = ? AND signer_key = ?", req.DocumentType, req.DocumentID, req.Slot).
			Delete(&models.DocumentSignatureSigner{})
		refreshDocumentSignatureState(sigDB, req.DocumentType, req.DocumentID)
	} else {
		// Clear the document signature entirely
		if errSig == nil {
			docSignature.SignedAt = nil
			docSignature.SignedByID = nil
			docSignature.SignatureHash = ""
			docSignature.IsLocked = false
			docSignature.SignedSignatures = 0
			docSignature.IsFullySigned = false
			sigDB.Save(&docSignature)
		}
		sigDB.Where("document_type = ? AND document_id = ?", req.DocumentType, req.DocumentID).
			Delete(&models.DocumentSignatureSigner{})
	}

	// Delete cached PDF blob — signature revoked, so cached signed PDF is stale
	go invalidateAllPDFCachesForSignature(req.DocumentType, req.DocumentID)

	c.JSON(http.StatusOK, gin.H{
		"message":    "Tanda tangan berhasil dibatalkan",
		"revoked_at": revokedAt,
		"revoked_by": signerName,
	})
}

func ensureNotOrdererRevokingOrderDoc(documentType string, documentID uint, employeeID *uint) error {
	if employeeID == nil {
		return nil
	}

	switch documentType {
	case models.DocTypeLabResult, models.DocTypeRadiologyResult, models.DocTypeOperativeReport, models.DocTypeConsultationResult:
		var order models.ProcedureOrder
		if err := database.DB.Select("ordered_by_id").First(&order, documentID).Error; err != nil {
			return nil
		}
		if order.OrderedByID == *employeeID {
			return fmt.Errorf("TTD dokumen order tidak bisa dibatalkan dari pengorder")
		}
	case models.DocTypePrescription:
		var order models.MedicineOrder
		if err := database.DB.Select("prescriber_id").First(&order, documentID).Error; err != nil {
			return nil
		}
		if order.PrescriberID == *employeeID {
			return fmt.Errorf("TTD dokumen order tidak bisa dibatalkan dari pengorder")
		}
	}

	return nil
}

func ensureAllowedSuratDocumentSigner(documentType string, documentID uint, employeeID *uint, actionLabel string) error {
	// Bypass strict DPJP check because user wants any nurse/doctor to be able to sign 
	// (they will select their role and enter their PIN to validate).
	return nil
}

// BatchDocumentStatusRequest for checking multiple document signatures at once
type BatchDocumentStatusRequest struct {
	Documents []struct {
		DocumentType string `json:"document_type"`
		DocumentID   uint   `json:"document_id"`
	} `json:"documents"`
}

// BatchSignatureStatus checks signature status for multiple documents
func BatchSignatureStatus(c *gin.Context) {
	var req BatchDocumentStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.Documents) == 0 {
		c.JSON(http.StatusOK, gin.H{"statuses": map[string]interface{}{}})
		return
	}

	// Build OR conditions for batch query
	var docSignatures []models.DocumentSignature
	query := database.DB
	for i, doc := range req.Documents {
		if i == 0 {
			query = query.Where("(document_type = ? AND document_id = ?)", doc.DocumentType, doc.DocumentID)
		} else {
			query = query.Or("(document_type = ? AND document_id = ?)", doc.DocumentType, doc.DocumentID)
		}
	}
	query.Preload("SignedBy.Employee").Find(&docSignatures)

	// Also fetch signer names from signature logs for on-behalf signatures
	type logInfo struct {
		DocumentType string
		DocumentID   uint
		SignerName   string
	}
	var signerLogs []logInfo
	logQuery := database.DB.Model(&models.SignatureLog{}).Select("document_type, document_id, signer_name")
	for i, doc := range req.Documents {
		if i == 0 {
			logQuery = logQuery.Where("(document_type = ? AND document_id = ? AND action = ?)", doc.DocumentType, doc.DocumentID, models.SignActionSign)
		} else {
			logQuery = logQuery.Or("(document_type = ? AND document_id = ? AND action = ?)", doc.DocumentType, doc.DocumentID, models.SignActionSign)
		}
	}
	logQuery.Order("signed_at DESC").Find(&signerLogs)

	// Build signer name lookup from logs (latest sign action)
	signerNameMap := make(map[string]string)
	for _, log := range signerLogs {
		key := fmt.Sprintf("%s:%d", log.DocumentType, log.DocumentID)
		if _, exists := signerNameMap[key]; !exists {
			signerNameMap[key] = log.SignerName
		}
	}

	// Build response map
	statuses := make(map[string]interface{})
	signedMap := make(map[string]models.DocumentSignature)
	for _, ds := range docSignatures {
		key := fmt.Sprintf("%s:%d", ds.DocumentType, ds.DocumentID)
		signedMap[key] = ds
	}

	for _, doc := range req.Documents {
		key := fmt.Sprintf("%s:%d", doc.DocumentType, doc.DocumentID)
		
		reqSigs := resolveRequiredSignatureCount(doc.DocumentType, nil)

		signedSlots := getSignedSlots(getSignatureDB(doc.DocumentType), doc.DocumentType, doc.DocumentID)
		signedSlotsCount := len(signedSlots)
		
		if ds, ok := signedMap[key]; ok {
			signerName := ""
			if ds.SignedAt != nil {
				if name, exists := signerNameMap[key]; exists {
					signerName = name
				} else if ds.SignedBy != nil && ds.SignedBy.Employee != nil {
					signerName = ds.SignedBy.Employee.NamaLengkap
				} else if ds.SignedBy != nil {
					signerName = ds.SignedBy.FullName
				}
			}
			
			// Use the maximum between ds.SignedSignatures and len(signedSlots) to be accurate
			currentSigned := ds.SignedSignatures
			if signedSlotsCount > currentSigned {
				currentSigned = signedSlotsCount
			}
			
			// If Doctor signed, ensure it's at least 1
			if ds.SignedAt != nil && currentSigned == 0 {
			    currentSigned = 1
			}

			isFullySigned := ds.IsFullySigned
			if reqSigs > ds.RequiredSignatures {
				isFullySigned = currentSigned >= reqSigs
			}

			statuses[key] = gin.H{
				"is_signed":           ds.SignedAt != nil,
				"signer_name":         signerName,
				"signed_at":           ds.SignedAt,
				"required_signatures": reqSigs,
				"signed_signatures":   currentSigned,
				"is_fully_signed":     isFullySigned,
				"signed_slots":        signedSlots,
			}
		} else {
			statuses[key] = gin.H{
				"is_signed":           false,
				"required_signatures": reqSigs,
				"signed_signatures":   signedSlotsCount,
				"is_fully_signed":     false,
				"signed_slots":        signedSlots,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"statuses": statuses})
}

func signatureCountMinOne(v int) int {
	if v <= 0 {
		return 1
	}
	return v
}

func resolveRequiredSignatureCount(documentType string, requested *int) int {
	if requested != nil && *requested > 0 {
		return *requested
	}

	for _, rule := range loadDocumentSignatureRules() {
		if rule.DocumentType == documentType && rule.RequiredSignatures > 0 {
			return rule.RequiredSignatures
		}
	}
	return 1
}

func signatureSignerKey(signerEmployeeID *uint, userID uint, slot string) string {
	slotPrefix := strings.TrimSpace(slot)
	if slotPrefix == "" {
		slotPrefix = "default"
	}
	if slotPrefix == "left" || slotPrefix == "right" {
		// For slot-based signatures, keep a single signer state per slot.
		// Re-signing the same slot will replace previous signer metadata.
		return slotPrefix
	}
	if signerEmployeeID != nil && *signerEmployeeID > 0 {
		return fmt.Sprintf("%s:employee:%d", slotPrefix, *signerEmployeeID)
	}
	return fmt.Sprintf("%s:user:%d", slotPrefix, userID)
}

func normalizeSignatureSlot(slot string) string {
	switch strings.ToLower(strings.TrimSpace(slot)) {
	case "2", "right":
		return "right"
	default:
		return "left"
	}
}

func buildSignatureMetaNote(slot, role, location, date, name string) string {
	slot = normalizeSignatureSlot(slot)
	role = strings.ToLower(strings.TrimSpace(role))
	switch role {
	case "dpjp", "perawat", "pasien", "kosong":
	default:
		role = "kosong"
	}
	location = strings.TrimSpace(location)
	date = strings.TrimSpace(date)
	name = strings.TrimSpace(name)
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	return fmt.Sprintf("signature_meta[slot=%s;role=%s;location=%s;date=%s;name=%s]", slot, role, location, date, name)
}

func getSignedSlots(sigDB *gorm.DB, docType string, docID uint) map[string]bool {
	out := map[string]bool{}
	var signers []models.DocumentSignatureSigner
	if err := sigDB.Where("document_type = ? AND document_id = ? AND signed_at IS NOT NULL AND is_active = ?", docType, docID, true).Find(&signers).Error; err != nil {
		return out
	}
	for _, s := range signers {
		key := strings.ToLower(strings.TrimSpace(s.SignerKey))
		if strings.HasPrefix(key, "left:") || key == "left" || strings.HasPrefix(key, "nurse:") || key == "nurse" || strings.HasPrefix(key, "patient:") || key == "patient" || key == "pasien" {
			out["left"] = true
		}
		if strings.HasPrefix(key, "right:") || key == "right" || strings.HasPrefix(key, "doctor_dpjp:") || key == "doctor_dpjp" {
			out["right"] = true
		}
	}
	return out
}

func getSignedSlotDetails(sigDB *gorm.DB, docType string, docID uint) map[string]map[string]interface{} {
	out := map[string]map[string]interface{}{}
	var signers []models.DocumentSignatureSigner
	if err := sigDB.Where("document_type = ? AND document_id = ? AND signed_at IS NOT NULL AND is_active = ?", docType, docID, true).Find(&signers).Error; err != nil {
		return out
	}
	
	for _, s := range signers {
		key := strings.ToLower(strings.TrimSpace(s.SignerKey))
		slotName := ""
		if strings.HasPrefix(key, "left:") || key == "left" || strings.HasPrefix(key, "nurse:") || key == "nurse" || strings.HasPrefix(key, "patient:") || key == "patient" || key == "pasien" {
			slotName = "left"
		} else if strings.HasPrefix(key, "right:") || key == "right" || strings.HasPrefix(key, "doctor_dpjp:") || key == "doctor_dpjp" {
			slotName = "right"
		} else {
			slotName = key
		}

		detail := map[string]interface{}{
			"signature_hash": s.SignatureHash,
			"signed_at": s.SignedAt,
		}

		if s.SignatureHash != "" {
			var log models.SignatureLog
			if err := database.DB.Where("signature_hash = ? AND action = ?", s.SignatureHash, models.SignActionSign).First(&log).Error; err == nil {
				detail["signer_name"] = log.SignerName
				detail["signer_role"] = log.SignerRole
				detail["notes"] = log.Notes
			}
		}
		out[slotName] = detail
	}
	return out
}

func upsertDocumentSigner(sigDB *gorm.DB, docType string, docID uint, signerKey string, userID uint, signedAt time.Time, signatureHash string) {
	var signer models.DocumentSignatureSigner
	err := sigDB.Unscoped().Where("document_type = ? AND document_id = ? AND signer_key = ?", docType, docID, signerKey).First(&signer).Error
	if err == nil {
		sigDB.Unscoped().Model(&signer).Updates(map[string]interface{}{
			"signed_at":      signedAt,
			"signed_by_id":   userID,
			"signature_hash": signatureHash,
			"is_active":      true,
			"deleted_at":     nil, // Revive if soft-deleted
		})
		return
	}

	sigDB.Create(&models.DocumentSignatureSigner{
		DocumentType:  docType,
		DocumentID:    docID,
		SignerKey:     signerKey,
		SignedAt:      &signedAt,
		SignedByID:    &userID,
		SignatureHash: signatureHash,
		IsActive:      true,
	})
}

func refreshDocumentSignatureState(sigDB *gorm.DB, docType string, docID uint) {
	var docSig models.DocumentSignature
	if err := sigDB.Where("document_type = ? AND document_id = ?", docType, docID).First(&docSig).Error; err != nil {
		return
	}

	var signedCount int64
	sigDB.Model(&models.DocumentSignatureSigner{}).
		Where("document_type = ? AND document_id = ? AND signed_at IS NOT NULL AND is_active = ?", docType, docID, true).
		Count(&signedCount)

	required := signatureCountMinOne(docSig.RequiredSignatures)
	isFullySigned := int(signedCount) >= required
	updates := map[string]interface{}{
		"signed_signatures": int(signedCount),
		"is_fully_signed":   isFullySigned,
		"is_locked":         isFullySigned,
	}
	if isFullySigned {
		now := time.Now()
		updates["signed_at"] = &now
	}
	sigDB.Model(&docSig).Updates(updates)
}

func loadDocumentSignatureRules() []DocumentSignatureRule {
	defaultRules := buildDefaultDocumentSignatureRules()

	var setting models.Setting
	if err := database.DB.Where("key = ?", documentSignatureConfigSettingKey).First(&setting).Error; err != nil || strings.TrimSpace(setting.Value) == "" {
		return defaultRules
	}

	var rules []DocumentSignatureRule
	if err := json.Unmarshal([]byte(setting.Value), &rules); err != nil {
		return defaultRules
	}

	byDoc := make(map[string]DocumentSignatureRule, len(rules))
	for i := range rules {
		rules[i].DocumentType = strings.TrimSpace(rules[i].DocumentType)
		if rules[i].DocumentType == "" {
			continue
		}
		if strings.TrimSpace(rules[i].Label) == "" {
			rules[i].Label = humanDocTypeName(rules[i].DocumentType)
		}
		if rules[i].RequiredSignatures <= 0 {
			rules[i].RequiredSignatures = 1
		}
		byDoc[rules[i].DocumentType] = rules[i]
	}

	merged := make([]DocumentSignatureRule, 0, len(defaultRules))
	for _, def := range defaultRules {
		if configured, ok := byDoc[def.DocumentType]; ok {
			if strings.TrimSpace(configured.LayoutHint) == "" {
				configured.LayoutHint = def.LayoutHint
			}
			merged = append(merged, configured)
			continue
		}
		merged = append(merged, def)
	}

	// Keep any unknown/custom doc types appended after known catalog.
	for docType, configured := range byDoc {
		found := false
		for _, def := range defaultRules {
			if def.DocumentType == docType {
				found = true
				break
			}
		}
		if !found {
			merged = append(merged, configured)
		}
	}

	return merged
}

// GetDocumentSignatureSettings returns configurable signature rules per document type.
func GetDocumentSignatureSettings(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": loadDocumentSignatureRules()})
}

type UpdateDocumentSignatureSettingsRequest struct {
	Rules []DocumentSignatureRule `json:"rules" binding:"required"`
}

// UpdateDocumentSignatureSettings updates signature rules per document type.
func UpdateDocumentSignatureSettings(c *gin.Context) {
	var req UpdateDocumentSignatureSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid"})
		return
	}

	clean := make([]DocumentSignatureRule, 0, len(req.Rules))
	for _, r := range req.Rules {
		dt := strings.TrimSpace(r.DocumentType)
		if dt == "" {
			continue
		}
		label := strings.TrimSpace(r.Label)
		if label == "" {
			label = dt
		}
		required := r.RequiredSignatures
		if required <= 0 {
			required = 1
		}
		clean = append(clean, DocumentSignatureRule{
			DocumentType:       dt,
			Label:              label,
			RequiredSignatures: required,
			Slots:              r.Slots,
			LayoutHint:         strings.TrimSpace(r.LayoutHint),
		})
	}

	if len(clean) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal 1 rule diperlukan"})
		return
	}

	raw, err := json.Marshal(clean)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan konfigurasi"})
		return
	}

	var setting models.Setting
	err = database.DB.Where("key = ?", documentSignatureConfigSettingKey).First(&setting).Error
	if err == nil {
		setting.Value = string(raw)
		if err := database.DB.Save(&setting).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan konfigurasi"})
			return
		}
	} else {
		if err := database.DB.Create(&models.Setting{Key: documentSignatureConfigSettingKey, Value: string(raw)}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan konfigurasi"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi TTD dokumen berhasil disimpan", "data": clean})
}

func buildDefaultDocumentSignatureRules() []DocumentSignatureRule {
	rules := make([]DocumentSignatureRule, 0, len(documentSignatureCatalog))
	for _, dt := range documentSignatureCatalog {
		required := 2
		slots := []string{"patient", "doctor_dpjp"}
		layoutHint := "2 kolom: kiri dan kanan dapat ditentukan fleksibel."

		switch dt {
		case models.DocTypeVisitResume, models.DocTypeRMDupResume, models.DocTypeRMDupInpatientResume:
			slots = []string{"doctor_dpjp"}
			layoutHint = "2 kolom visual: kiri Pasien/Keluarga (non-digital), kanan Dokter."
		case models.DocTypePrescription, models.DocTypeRMDupPrescription:
			slots = []string{"doctor_dpjp"}
		case models.DocTypeLabResult, models.DocTypeRMDupLabResult:
			slots = []string{"lab_staff"}
		case models.DocTypeRadiologyResult, models.DocTypeRMDupRadResult:
			slots = []string{"radiology_doctor"}
		case models.DocTypeSickLetter, models.DocTypeHealthCertificate, models.DocTypeBirthCertificate, models.DocTypeLeaveCertificate, models.DocTypeMCUCertificate, models.DocTypeDeathCertificate:
			slots = []string{"doctor_dpjp"}
		case models.DocTypeReferralLetter, models.DocTypeRMDupReferral, models.DocTypeInpatientCert, models.DocTypeRMDupInpatientCert:
			slots = []string{"doctor_dpjp"}
		case models.DocTypeInformedConsent, models.DocTypeRMDupConsent:
			slots = []string{"patient", "nurse"}
			layoutHint = "2 kolom: kiri Pasien/Wali, kanan Petugas Rumah Sakit."
		case models.DocTypeSPRI, models.DocTypeSuratKontrol:
			slots = []string{"patient", "doctor_dpjp"}
			layoutHint = "2 kolom: kiri Pasien, kanan Dokter DPJP."
		case models.DocTypeRegistration, models.DocTypeRMDupRegistration:
			slots = []string{"nurse", "patient"}
			layoutHint = "2 kolom: kiri Petugas Pendaftaran, kanan Pasien/Keluarga."
		case models.DocTypeCPPT, models.DocTypeRMDupCPPT:
			slots = []string{"doctor_dpjp", "nurse"}
			layoutHint = "Kolom kanan bawah: DPJP / Perawat (sesuai slot)."
		case models.DocTypeNursingCare, models.DocTypeRMDupNursingCare:
			slots = []string{"doctor_dpjp", "nurse"}
			layoutHint = "2 kolom: kiri Dokter DPJP, kanan Perawat."
		case models.DocTypeTriage, models.DocTypeRMDupTriage:
			slots = []string{"triage_staff"}
			layoutHint = "Kolom kanan bawah: Petugas triage."
		case models.DocTypeEmergencySummary, models.DocTypeRMDupEmergency:
			slots = []string{"doctor_dpjp"}
		case models.DocTypeFluidBalance, models.DocTypeBedTransfer, models.DocTypeVitalSign, models.DocTypeRMDupFluidBalance, models.DocTypeRMDupBedTransfer, models.DocTypeRMDupVitalSign:
			slots = []string{"nurse"}
		}

		rules = append(rules, DocumentSignatureRule{
			DocumentType:       dt,
			Label:              humanDocTypeName(dt),
			RequiredSignatures: required,
			Slots:              slots,
			LayoutHint:         layoutHint,
		})
	}
	return rules
}

// PreviewDocumentSignatureTemplate renders a lightweight PDF template preview for signature layout.
// Query: document_type (required), column_1 (optional), column_2 (optional)
func PreviewDocumentSignatureTemplate(c *gin.Context) {
	docType := strings.TrimSpace(c.Query("document_type"))
	if docType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document_type wajib diisi"})
		return
	}

	col1 := strings.TrimSpace(strings.ToLower(c.Query("column_1")))
	col2 := strings.TrimSpace(strings.ToLower(c.Query("column_2")))

	slots := []string{}
	if col1 != "" {
		slots = append(slots, col1)
	}
	if col2 != "" {
		slots = append(slots, col2)
	}
	if len(slots) == 0 {
		for _, rule := range loadDocumentSignatureRules() {
			if rule.DocumentType == docType {
				slots = append(slots, rule.Slots...)
				break
			}
		}
	}
	for len(slots) < 2 {
		slots = append(slots, "none")
	}

	threeCol := docType == "dpjp_request" || docType == "informed_consent_receipt"
	title := "Dokumen Medis"
	section := "Area Isi Dokumen"
	switch docType {
	case models.DocTypeNursingCare, models.DocTypeRMDupNursingCare:
		title = "Asuhan Keperawatan"
		section = "A-F Pengkajian, Diagnosa, Intervensi, Evaluasi"
	case models.DocTypeInformedConsent, models.DocTypeRMDupConsent:
		title = "Informed Consent / General Consent"
		section = "Pernyataan Persetujuan Umum"
	case models.DocTypeRegistration, models.DocTypeRMDupRegistration:
		title = "Bukti Registrasi"
		section = "Data Pasien, Pelayanan, Pembayaran"
	case "dpjp_request":
		title = "Formulir Permohonan DPJP"
		section = "Data Pasien dan Permohonan DPJP"
	case "informed_consent_receipt":
		title = "Bukti Pemberian Informed Consent"
		section = "Informasi Tindakan Medis dan Persetujuan"
	case models.DocTypeFluidBalance, models.DocTypeRMDupFluidBalance:
		title = "Balance Cairan"
		section = "Tabel Intake/Output Harian"
	case models.DocTypeVitalSign, models.DocTypeRMDupVitalSign:
		title = "Grafik Tanda Vital"
		section = "Observasi Vital Sign"
	case models.DocTypeBedTransfer, models.DocTypeRMDupBedTransfer:
		title = "Mutasi Pasien"
		section = "Riwayat Perpindahan Bed/Ruangan"
	}

	slotLabel := func(slot string) string {
		switch strings.TrimSpace(strings.ToLower(slot)) {
		case "doctor_dpjp":
			return "DPJP"
		case "nurse":
			return "Perawat/Petugas"
		case "patient":
			return "Pasien/Keluarga"
		default:
			return "Kosong"
		}
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(12, 12, 12)
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(0, 7, "Preview Layout TTD Dokumen", "", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("Dokumen: %s (%s)", title, docType), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	pdf.SetDrawColor(180, 180, 180)
	pdf.Rect(12, 30, 186, 235, "D")
	pdf.SetFont("Arial", "B", 10)
	pdf.Text(15, 40, section)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)
	pdf.Rect(15, 45, 180, 170, "DF")
	pdf.SetTextColor(120, 120, 120)
	pdf.Text(18, 55, "Preview ini menggambarkan posisi area TTD, bukan isi klinis lengkap.")
	pdf.SetTextColor(0, 0, 0)

	// Lightweight template mimics per document family (visual guidance only)
	switch docType {
	case models.DocTypeNursingCare, models.DocTypeRMDupNursingCare:
		pdf.SetDrawColor(140, 140, 140)
		pdf.Rect(18, 62, 174, 40, "D")
		pdf.Rect(18, 106, 174, 30, "D")
		pdf.Rect(18, 140, 174, 30, "D")
		pdf.Rect(18, 174, 174, 35, "D")
		pdf.SetFont("Arial", "B", 8)
		pdf.Text(20, 67, "A. Pengkajian")
		pdf.Text(20, 111, "B. Diagnosa / C. Luaran")
		pdf.Text(20, 145, "D. Intervensi")
		pdf.Text(20, 179, "F. Evaluasi (SOAP)")
	case models.DocTypeFluidBalance, models.DocTypeRMDupFluidBalance:
		pdf.SetDrawColor(140, 140, 140)
		pdf.Rect(18, 62, 174, 12, "D")
		pdf.Rect(18, 76, 174, 120, "D")
		for i := 1; i < 8; i++ {
			y := 76.0 + float64(i)*15.0
			pdf.Line(18, y, 192, y)
		}
		pdf.SetFont("Arial", "B", 8)
		pdf.Text(20, 70, "Tanggal | Shift | Intake | Output | Balance | Petugas")
	case models.DocTypeVitalSign, models.DocTypeRMDupVitalSign:
		pdf.SetDrawColor(140, 140, 140)
		pdf.Rect(18, 62, 174, 12, "D")
		pdf.Rect(18, 76, 174, 120, "D")
		for i := 1; i < 8; i++ {
			y := 76.0 + float64(i)*15.0
			pdf.Line(18, y, 192, y)
		}
		pdf.SetFont("Arial", "B", 8)
		pdf.Text(20, 70, "Waktu | TD | Nadi | RR | Suhu | SpO2 | Nyeri | Petugas")
	case models.DocTypeInformedConsent, models.DocTypeRMDupConsent, "informed_consent_receipt":
		pdf.SetDrawColor(140, 140, 140)
		pdf.Rect(18, 62, 174, 22, "D")
		pdf.Rect(18, 88, 174, 50, "D")
		pdf.Rect(18, 142, 174, 50, "D")
		pdf.SetFont("Arial", "B", 8)
		pdf.Text(20, 68, "Data Pasien")
		pdf.Text(20, 94, "Pernyataan / Informasi Medis")
		pdf.Text(20, 148, "Persetujuan dan Catatan")
	case models.DocTypeRegistration, models.DocTypeRMDupRegistration:
		pdf.SetDrawColor(140, 140, 140)
		pdf.Rect(18, 62, 174, 28, "D")
		pdf.Rect(18, 94, 174, 28, "D")
		pdf.Rect(18, 126, 174, 28, "D")
		pdf.SetFont("Arial", "B", 8)
		pdf.Text(20, 68, "Data Pasien")
		pdf.Text(20, 100, "Data Pelayanan")
		pdf.Text(20, 132, "Data Pembayaran")
	default:
		pdf.SetDrawColor(150, 150, 150)
		pdf.Rect(18, 62, 174, 130, "D")
		pdf.SetFont("Arial", "B", 8)
		pdf.Text(20, 68, "Area Konten Dokumen")
	}

	signY := 230.0
	colCount := 2.0
	if threeCol {
		colCount = 3.0
	}
	colW := 186.0 / colCount
	pdf.SetFont("Arial", "", 9)

	for i := 0; i < int(colCount); i++ {
		x := 12.0 + float64(i)*colW
		pdf.Rect(x, signY, colW, 30, "D")
		label := ""
		switch i {
		case 0:
			label = slotLabel(slots[0])
		case 1:
			label = slotLabel(slots[1])
		case 2:
			label = "DPJP (Fixed)"
		}
		pdf.CellFormat(0, 0, "", "", 0, "", false, 0, "")
		pdf.Text(x+3, signY+6, "Kolom "+strconv.Itoa(i+1))
		pdf.SetFont("Arial", "B", 10)
		pdf.Text(x+3, signY+14, label)
		pdf.SetFont("Arial", "", 9)
		pdf.Text(x+3, signY+19, "Area QR/TTD Digital")
		pdf.Line(x+3, signY+25, x+colW-3, signY+25)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate preview"})
		return
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "inline; filename=\"preview_ttd.pdf\"")
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}
