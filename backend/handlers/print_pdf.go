package handlers

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"

	"starter/backend/models"
)

// GET /api/print/available-docs/:visitId
func GetAvailableDocs(c *gin.Context) {
	getAvailableDocsImpl(c)
}

// generateMedicineLabelPDF creates a PDF with medicine labels (each item on separate page).
func generateMedicineLabelPDF(items []models.MedicineOrderItem, patientName, noRM string) *gofpdf.Fpdf {
	return generateMedicineLabelPDFImpl(items, patientName, noRM)
}

// addBPJSDocSignature adds a signature area with QR code and validation footer
// that is always rendered. It generates a hash from the document number + signer + time
// so the QR code serves as a tamper-evident seal on the document.
func addBPJSDocSignature(pdf *gofpdf.Fpdf, city, doctorName, label, docNumber string, createdAt time.Time) {
	addBPJSDocSignatureImpl(pdf, city, doctorName, label, docNumber, createdAt)
}
