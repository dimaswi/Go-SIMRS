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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "PIN lama salah"})
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
	PIN          string `json:"pin" binding:"required,len=6,numeric"`
	DocumentType string `json:"document_type" binding:"required"`
	DocumentID   uint   `json:"document_id" binding:"required"`
	VisitID      *uint  `json:"visit_id,omitempty"`
	Notes        string `json:"notes,omitempty"`
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
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err != nil {
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
			c.JSON(http.StatusUnauthorized, gin.H{"error": "PIN salah"})
			return
		}
	}

	// Check if document already signed
	var existingSignature models.DocumentSignature
	if err := database.DB.Where("document_type = ? AND document_id = ?", req.DocumentType, req.DocumentID).First(&existingSignature).Error; err == nil {
		if existingSignature.SignedAt != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokumen sudah ditandatangani"})
			return
		}
	}

	// Generate signature hash
	signedAt := time.Now()
	signatureData := fmt.Sprintf("%s:%d:%d:%s", req.DocumentType, req.DocumentID, userID, signedAt.Format(time.RFC3339))
	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "default-signature-secret"
	}
	signatureHash := generateHMAC(signatureData, secretKey)

	// Get signer info from employee
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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "PIN salah", "valid": false})
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
		"document_type":  signatureLog.DocumentType,
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
