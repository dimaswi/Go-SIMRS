package handlers

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// PatientSignatureClaims defines JWT claims for patient signature request
type PatientSignatureClaims struct {
	DocumentType string `json:"doc_type"`
	DocumentID   uint   `json:"doc_id"`
	PatientName  string `json:"patient_name"`
	Slot         string `json:"slot"`
	RequesterID  uint   `json:"req_id"` // Staff who requested it
	jwt.RegisteredClaims
}

// GeneratePatientSignatureLink generates a temporary JWT token for patient signature
func GeneratePatientSignatureLink(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	docType := c.Query("document_type")
	docIDStr := c.Query("document_id")
	patientName := c.Query("patient_name")
	slot := c.Query("slot")

	if docType == "" || docIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document_type and document_id are required"})
		return
	}

	docID := uint(0)
	fmt.Sscanf(docIDStr, "%d", &docID)

	if slot == "" {
		slot = "right" // default
	}

	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "dev-secret-key-not-for-production"
	}

	claims := PatientSignatureClaims{
		DocumentType: docType,
		DocumentID:   docID,
		PatientName:  patientName,
		Slot:         slot,
		RequesterID:  userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)), // Valid for 1 hour
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secretKey))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Generate frontend link
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5173"
	}
	// For local network access via phone, the APP_URL needs to be the network IP, 
	// but we'll let frontend construct the full URL from the token.
	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
	})
}

type SubmitPatientSignatureRequest struct {
	Token          string `json:"token" binding:"required"`
	SignatureImage string `json:"signature_image" binding:"required"` // base64 string
	PhotoImage     string `json:"photo_image" binding:"required"`     // base64 string
}

// SubmitPatientSignature handles the submission from the patient's phone
func SubmitPatientSignature(c *gin.Context) {
	var req SubmitPatientSignatureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
		return
	}

	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "dev-secret-key-not-for-production"
	}

	// Parse and validate JWT
	token, err := jwt.ParseWithClaims(req.Token, &PatientSignatureClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secretKey), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Link tanda tangan sudah kedaluwarsa atau tidak valid"})
		return
	}

	claims, ok := token.Claims.(*PatientSignatureClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Klaim tidak valid"})
		return
	}

	// Extract base64 image data (handle "data:image/png;base64,..." prefix if present)
	base64Data := req.SignatureImage
	if idx := strings.Index(base64Data, ","); idx != -1 {
		base64Data = base64Data[idx+1:]
	}

	imgBytes, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format gambar tanda tangan tidak valid"})
		return
	}

	// Save the image
	uploadsDir := "uploads/signatures"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat direktori upload"})
		return
	}

	fileName := fmt.Sprintf("%s_%d_%d.png", claims.DocumentType, claims.DocumentID, time.Now().UnixNano())
	filePath := filepath.Join(uploadsDir, fileName)

	if err := os.WriteFile(filePath, imgBytes, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan gambar tanda tangan"})
		return
	}

	// Extract and save photo image
	base64Photo := req.PhotoImage
	if idx := strings.Index(base64Photo, ","); idx != -1 {
		base64Photo = base64Photo[idx+1:]
	}

	photoBytes, err := base64.StdEncoding.DecodeString(base64Photo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format foto wajah tidak valid"})
		return
	}

	photoDir := "uploads/signatures_photos"
	if err := os.MkdirAll(photoDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat direktori foto"})
		return
	}

	photoFileName := fmt.Sprintf("%s_%d_photo_%d.png", claims.DocumentType, claims.DocumentID, time.Now().UnixNano())
	photoFilePath := filepath.Join(photoDir, photoFileName)

	if err := os.WriteFile(photoFilePath, photoBytes, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan foto wajah"})
		return
	}

	// Generate Hash for SignatureLog
	hashInput := fmt.Sprintf("%s|%d|%d|%s", claims.DocumentType, claims.DocumentID, claims.RequesterID, time.Now().Format(time.RFC3339Nano))
	hashBytes := sha256.Sum256([]byte(hashInput))
	sigHash := hex.EncodeToString(hashBytes[:])

	// Format notes with meta data including image and photo path
	patientName := claims.PatientName
	if patientName == "" {
		patientName = "Pasien"
	}
	
	metaNotes := fmt.Sprintf("signature_meta[role=pasien;label=%s;slot=%s;image=%s;photo=%s;]", patientName, claims.Slot, "/"+filepath.ToSlash(filePath), "/"+filepath.ToSlash(photoFilePath))

	// Get requester info
	var requester models.User
	database.DB.Preload("Employee").First(&requester, claims.RequesterID)

	// Create SignatureLog
	log := models.SignatureLog{
		UserID:        claims.RequesterID,
		DocumentType:  claims.DocumentType,
		DocumentID:    claims.DocumentID,
		SignedAt:      time.Now(),
		SignatureHash: sigHash,
		Action:        models.SignActionSign,
		SignerName:    patientName,
		SignerRole:    "Pasien",
		Notes:         metaNotes,
		IPAddress:     c.ClientIP(),
		UserAgent:     c.Request.UserAgent(),
	}

	if err := database.DB.Create(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan log tanda tangan"})
		return
	}

	// Ensure DocumentSignature exists so frontend polling (GetDocumentSignature) detects it
	sigDB := getSignatureDB(claims.DocumentType)
	var docSignature models.DocumentSignature
	if err := sigDB.Unscoped().Where("document_type = ? AND document_id = ?", claims.DocumentType, claims.DocumentID).First(&docSignature).Error; err != nil {
		// Does not exist, create it
		requiredSignatures := resolveRequiredSignatureCount(claims.DocumentType, nil)
		docSignature = models.DocumentSignature{
			DocumentType:       claims.DocumentType,
			DocumentID:         claims.DocumentID,
			SignatureHash:      sigHash,
			RequiredSignatures: requiredSignatures,
			SignedSignatures:   0, // Patient signature usually doesn't count towards doctor's required signatures
			IsFullySigned:      false,
			IsLocked:           false,
		}
		sigDB.Create(&docSignature)
	} else if docSignature.DeletedAt.Valid {
		// Exists but soft deleted, revive it
		sigDB.Unscoped().Model(&docSignature).Update("deleted_at", nil)
	}

	// Update the slot for the patient so getSignedSlots() detects it!
	now := time.Now()
	upsertDocumentSigner(sigDB, claims.DocumentType, claims.DocumentID, claims.Slot, claims.RequesterID, now, sigHash)
	refreshDocumentSignatureState(sigDB, claims.DocumentType, claims.DocumentID)

	// Invalidate cached PDF
	go invalidateAllPDFCachesForSignature(claims.DocumentType, claims.DocumentID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Tanda tangan berhasil disimpan",
		"data":    log,
	})
}

// RevokePatientSignature handles deletion of a specific patient signature slot
func RevokePatientSignature(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	docType := c.Query("document_type")
	docIDStr := c.Query("document_id")
	slot := c.Query("slot")

	if docType == "" || docIDStr == "" || slot == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document_type, document_id, and slot are required"})
		return
	}

	sigDB := getSignatureDB(docType)

	sigDB.Unscoped().Where("document_type = ? AND document_id = ? AND (signer_key = ? OR signer_key LIKE ?)", docType, docIDStr, slot, slot+":%").Delete(&models.DocumentSignatureSigner{})

	var docID uint
	fmt.Sscanf(docIDStr, "%d", &docID)

	refreshDocumentSignatureState(sigDB, docType, docID)
	go invalidateAllPDFCachesForSignature(docType, docID)

	// Create revoke log
	revokeLog := models.SignatureLog{
		UserID:        userID,
		DocumentType:  docType,
		DocumentID:    docID,
		SignedAt:      time.Now(),
		Action:        models.SignActionRevoke,
		Notes:         fmt.Sprintf("Revoked slot: %s", slot),
		IPAddress:     c.ClientIP(),
		UserAgent:     c.Request.UserAgent(),
	}
	database.DB.Create(&revokeLog)

	c.JSON(http.StatusOK, gin.H{"message": "Tanda tangan berhasil dihapus"})
}
