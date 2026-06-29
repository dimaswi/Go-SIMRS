package handlers

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
	"os"
	"path/filepath"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"
)

func getCachedPDF(docType string, docID uint) ([]byte, string, bool) {
	var cache models.DocumentPDFCache
	if err := database.DB.
		Where("document_type = ? AND document_id = ?", docType, docID).
		First(&cache).Error; err != nil {
		return nil, "", false
	}

	// Prefer file-based cache when path is available.
	if strings.TrimSpace(cache.FilePath) != "" {
		if b, err := os.ReadFile(cache.FilePath); err == nil && len(b) > 0 {
			return b, cache.FileName, true
		}
	}

	// Backward compatibility for legacy DB blob cache.
	if len(cache.PDFData) > 0 {
		return cache.PDFData, cache.FileName, true
	}
	return nil, "", false
}

func storeCachedPDF(docType string, docID uint, pdfData []byte, fileName string) {
	now := time.Now()
	fileSize := int64(len(pdfData))
	cachePath, pathErr := writePDFCacheToFile(docType, docID, pdfData)
	if pathErr != nil {
		return
	}

	var existing models.DocumentPDFCache
	err := database.DB.
		Where("document_type = ? AND document_id = ?", docType, docID).
		First(&existing).Error

	sigCount, sigTarget := getSignatureCounts(docType, docID)
	if err == nil {
		database.DB.Model(&existing).Updates(map[string]interface{}{
			"pdf_data":         nil, // keep new records file-based; old blob still readable
			"file_path":        cachePath,
			"file_name":        fileName,
			"file_size":        fileSize,
			"generated_at":     now,
			"signature_count":  sigCount,
			"signature_target": sigTarget,
		})
	} else {
		database.DB.Create(&models.DocumentPDFCache{
			DocumentType:    docType,
			DocumentID:      docID,
			PDFData:         nil,
			FilePath:        cachePath,
			FileName:        fileName,
			FileSize:        fileSize,
			GeneratedAt:     now,
			SignatureCount:  sigCount,
			SignatureTarget: sigTarget,
		})
	}
}

func invalidatePDFCache(docType string, docID uint) {
	var cache models.DocumentPDFCache
	if err := database.DB.Where("document_type = ? AND document_id = ?", docType, docID).First(&cache).Error; err == nil {
		if strings.TrimSpace(cache.FilePath) != "" {
			_ = os.Remove(cache.FilePath)
		}
	}
	database.DB.
		Where("document_type = ? AND document_id = ?", docType, docID).
		Delete(&models.DocumentPDFCache{})
}

func cacheRootDir() string {
	dir := os.Getenv("SIGNED_PDF_CACHE_DIR")
	if strings.TrimSpace(dir) == "" {
		dir = filepath.Join("uploads", "signed-pdf")
	}
	return dir
}

func safeCacheSegment(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	v = strings.ReplaceAll(v, "..", "")
	v = strings.ReplaceAll(v, "\\", "_")
	v = strings.ReplaceAll(v, "/", "_")
	v = strings.ReplaceAll(v, " ", "_")
	if v == "" {
		return "unknown"
	}
	return v
}

func writePDFCacheToFile(docType string, docID uint, pdfData []byte) (string, error) {
	base := cacheRootDir()
	docDir := filepath.Join(base, safeCacheSegment(docType))
	if err := os.MkdirAll(docDir, 0o755); err != nil {
		return "", err
	}

	tmpPath := filepath.Join(docDir, fmt.Sprintf("%d.tmp", docID))
	finalPath := filepath.Join(docDir, fmt.Sprintf("%d.pdf", docID))
	if err := os.WriteFile(tmpPath, pdfData, 0o644); err != nil {
		return "", err
	}
	if err := os.Rename(tmpPath, finalPath); err != nil {
		_ = os.Remove(tmpPath)
		return "", err
	}
	return finalPath, nil
}

func getSignatureCounts(docType string, docID uint) (int, int) {
	sigDB := database.DB
	if strings.HasPrefix(docType, "rm_dup_") && database.CasemixDB != nil {
		sigDB = database.CasemixDB
	}
	var docSig models.DocumentSignature
	if err := sigDB.Where("document_type = ? AND document_id = ?", docType, docID).First(&docSig).Error; err == nil {
		required := docSig.RequiredSignatures
		if required <= 0 {
			required = 1
		}
		return docSig.SignedSignatures, required
	}
	return 0, 1
}

func invalidateAllPDFCachesForSignature(sigDocType string, docID uint) {
	// Always invalidate exact match
	invalidatePDFCache(sigDocType, docID)

	// Invalidate alternate cache keys for handlers that share this signature type
	switch sigDocType {
	case models.DocTypeVisitResume:
		invalidatePDFCache("outpatient_resume", docID)
		invalidatePDFCache("inpatient_resume", docID)
		// AdmissionDischargeSummary uses registration.ID, need DB lookup
		var visit models.Visit
		if err := database.DB.Select("registration_id").First(&visit, docID).Error; err == nil {
			invalidatePDFCache("admission_discharge_reg", visit.RegistrationID)
		}
	case models.DocTypeCPPT:
		invalidatePDFCache("fluid_balance", docID)
	case models.DocTypeFluidBalance:
		invalidatePDFCache(models.DocTypeFluidBalance, docID)
	case models.DocTypeLabResult:
		invalidatePDFCache("lab_order", docID)
	}
}

func InvalidateRMDuplicatePDFCaches(rmDuplicateID uint) {
	var caches []models.DocumentPDFCache
	database.DB.Where("document_type LIKE ? AND document_id = ?", "rm_dup_%", rmDuplicateID).Find(&caches)
	for _, cache := range caches {
		if strings.TrimSpace(cache.FilePath) != "" {
			_ = os.Remove(cache.FilePath)
		}
	}
	database.DB.
		Where("document_type LIKE ? AND document_id = ?", "rm_dup_%", rmDuplicateID).
		Delete(&models.DocumentPDFCache{})
}

func InvalidateRMDuplicateOrderPDFCache(docType string, orderID uint) {
	invalidatePDFCache(docType, orderID)
}

func serveCachedOrGenerate(c *gin.Context, docType string, docID uint, generate func() ([]byte, string, error)) {
	// Check cache - blob only exists for signed documents
	if pdfData, fileName, found := getCachedPDF(docType, docID); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	// Generate
	pdfData, fileName, err := generate()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Only cache when document is signed - unsigned docs are always generated fresh
	if _, isSigned := findSignatureLog(signatureLookup{docType, docID}); isSigned {
		go storeCachedPDF(docType, docID, pdfData, fileName)
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
	c.Data(http.StatusOK, "application/pdf", pdfData)
}

func GetPDFCacheStats(c *gin.Context) {
	var stats struct {
		TotalEntries int64  `json:"total_entries"`
		TotalSize    int64  `json:"total_size_bytes"`
		OldestEntry  string `json:"oldest_entry,omitempty"`
		NewestEntry  string `json:"newest_entry,omitempty"`
	}

	database.DB.Model(&models.DocumentPDFCache{}).Count(&stats.TotalEntries)
	database.DB.Model(&models.DocumentPDFCache{}).Select("COALESCE(SUM(file_size), 0)").Scan(&stats.TotalSize)

	var oldest, newest models.DocumentPDFCache
	if database.DB.Order("created_at ASC").First(&oldest).Error == nil {
		stats.OldestEntry = oldest.CreatedAt.Format("2006-01-02 15:04:05")
	}
	if database.DB.Order("created_at DESC").First(&newest).Error == nil {
		stats.NewestEntry = newest.CreatedAt.Format("2006-01-02 15:04:05")
	}

	// Per-type breakdown
	type TypeStat struct {
		DocumentType string `json:"document_type"`
		Count        int64  `json:"count"`
		TotalSize    int64  `json:"total_size_bytes"`
	}
	var byType []TypeStat
	database.DB.Model(&models.DocumentPDFCache{}).
		Select("document_type, COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size").
		Group("document_type").
		Order("total_size DESC").
		Scan(&byType)

	c.JSON(http.StatusOK, gin.H{
		"stats":   stats,
		"by_type": byType,
	})
}

func CleanupPDFCache(c *gin.Context) {
	daysStr := c.DefaultQuery("days", "30")
	days := 30
	if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
		days = d
	}

	cutoff := time.Now().AddDate(0, 0, -days)

	result := database.DB.Unscoped().
		Where("created_at < ?", cutoff).
		Delete(&models.DocumentPDFCache{})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       fmt.Sprintf("Berhasil menghapus cache PDF yang lebih dari %d hari", days),
		"deleted_count": result.RowsAffected,
	})
}
