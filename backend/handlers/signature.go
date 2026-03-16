package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

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
	PIN              string `json:"pin" binding:"required,len=6,numeric"`
	DocumentType     string `json:"document_type" binding:"required"`
	DocumentID       uint   `json:"document_id" binding:"required"`
	VisitID          *uint  `json:"visit_id,omitempty"`
	Notes            string `json:"notes,omitempty"`
	SignerEmployeeID *uint  `json:"signer_employee_id,omitempty"` // Sign on behalf of another employee
}

// SignDocument signs a document with the user's PIN
func SignDocument(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var req SignDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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

	// If PIN is required, verify it
	if signatureRequired {
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
	}

	// Check if document already has a signature record (will be updated if re-signing)
	var existingSignature models.DocumentSignature
	database.DB.Where("document_type = ? AND document_id = ?", req.DocumentType, req.DocumentID).First(&existingSignature)

	// Generate signature hash
	signedAt := time.Now()
	signatureData := fmt.Sprintf("%s:%d:%d:%s", req.DocumentType, req.DocumentID, userID, signedAt.Format(time.RFC3339))
	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "default-signature-secret"
	}
	signatureHash := generateHMAC(signatureData, secretKey)

	// Get signer info — use designated employee if signing on behalf of, otherwise use logged-in user
	var signerName, signerNIP, signerSTR, signerSIP, signerRole string
	var signerEmployeeID *uint
	if req.SignerEmployeeID != nil {
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

	// Create signature log
	signatureLog := models.SignatureLog{
		UserID:           userID,
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

	if err := database.DB.Create(&signatureLog).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan log tanda tangan"})
		return
	}

	// Create or update document signature
	docSignature := models.DocumentSignature{
		DocumentType:  req.DocumentType,
		DocumentID:    req.DocumentID,
		SignedAt:      &signedAt,
		SignedByID:    &userID,
		SignatureHash: signatureHash,
		IsLocked:      true,
	}

	if existingSignature.ID > 0 {
		docSignature.ID = existingSignature.ID
		database.DB.Save(&docSignature)
	} else {
		database.DB.Create(&docSignature)
	}

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

	var signature models.DocumentSignature
	if err := database.DB.Preload("SignedBy").
		Where("document_type = ? AND document_id = ?", docType, docID).
		First(&signature).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"is_signed": false,
			"is_locked": false,
		})
		return
	}

	result := gin.H{
		"is_signed":      signature.SignedAt != nil,
		"is_locked":      signature.IsLocked,
		"signed_at":      signature.SignedAt,
		"signature_hash": signature.SignatureHash,
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
		"signer_name":    signatureLog.SignerName,
		"signer_nip":     signatureLog.SignerNIP,
		"signer_str":     signatureLog.SignerSTR,
		"signer_role":    signatureLog.SignerRole,
		"signature_hash": signatureLog.SignatureHash,
	}

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
		models.DocTypeInformedConsent:    "Informed Consent",
		models.DocTypeCPPT:               "CPPT",
		models.DocTypeNursingCare:        "Asuhan Keperawatan",
		models.DocTypeTriage:             "Formulir Triage",
		models.DocTypeEmergencySummary:   "Ringkasan Pelayanan UGD",
		models.DocTypeOperativeReport:    "Laporan Operasi",
		models.DocTypeConsultationResult: "Hasil Konsultasi",
		models.DocTypeInpatientCert:      "Surat Keterangan Rawat Inap",
		models.DocTypePharmacyHandover:   "Serah Terima Obat",
		models.DocTypeRegistration:       "Bukti Registrasi",

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

	// Check if document is signed
	var docSignature models.DocumentSignature
	if err := database.DB.Where("document_type = ? AND document_id = ?", req.DocumentType, req.DocumentID).
		First(&docSignature).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tanda tangan tidak ditemukan"})
		return
	}

	if docSignature.SignedAt == nil {
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
	if err := database.DB.Where("document_type = ? AND document_id = ? AND action = ?",
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

	if err := database.DB.Create(&revokeLog).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan log pembatalan"})
		return
	}

	// Clear the document signature
	docSignature.SignedAt = nil
	docSignature.SignedByID = nil
	docSignature.SignatureHash = ""
	docSignature.IsLocked = false
	database.DB.Save(&docSignature)

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
		if ds, ok := signedMap[key]; ok && ds.SignedAt != nil {
			signerName := ""
			if name, exists := signerNameMap[key]; exists {
				signerName = name
			} else if ds.SignedBy != nil && ds.SignedBy.Employee != nil {
				signerName = ds.SignedBy.Employee.NamaLengkap
			} else if ds.SignedBy != nil {
				signerName = ds.SignedBy.FullName
			}
			statuses[key] = gin.H{
				"is_signed":   true,
				"signer_name": signerName,
				"signed_at":   ds.SignedAt,
			}
		} else {
			statuses[key] = gin.H{
				"is_signed": false,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"statuses": statuses})
}
