package handlers

import (
	"bytes"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"
)

func printPrescriptionImpl(c *gin.Context) {
	orderID := c.Param("orderId")

	// Cache check
	oid, _ := strconv.ParseUint(orderID, 10, 32)
	if pdfData, fileName, found := getCachedPDF(models.DocTypePrescription, uint(oid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	// Load medicine order
	var order models.MedicineOrder
	if err := database.DB.
		Preload("Items.Medicine").
		Preload("SourceVisit.Registration.Patient").
		Preload("SourceVisit.Doctor").
		Preload("SourceVisit.Room").
		First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.SourceVisit == nil || order.SourceVisit.Registration == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit data not found"})
		return
	}

	patient := order.SourceVisit.Registration.Patient
	visit := order.SourceVisit

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "Resep Obat", order.OrderNumber)

	// Patient info
	addPatientInfoTable(pdf, patient, visit)

	// Medications table
	addTableHeader(pdf, "DAFTAR OBAT")
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(10, 6, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(60, 6, "Nama Obat", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 6, "Jumlah", "1", 0, "C", true, 0, "")
	pdf.CellFormat(25, 6, "Dosis", "1", 0, "C", true, 0, "")
	pdf.CellFormat(25, 6, "Frekuensi", "1", 0, "C", true, 0, "")
	pdf.CellFormat(40, 6, "Instruksi", "1", 1, "C", true, 0, "")

	pdf.SetFont("Arial", "", 9)
	itemNo := 0
	for _, item := range order.Items {
		// Skip cancelled items
		if item.Status == models.ItemStatusCancelled {
			continue
		}
		itemNo++
		medName := ""
		if item.Medicine != nil {
			medName = item.Medicine.Name
		}
		qty := formatNumber(float64(item.Quantity))
		dosage := item.Dosage
		frequency := item.Frequency
		instruction := item.Instructions

		pdf.CellFormat(10, 6, fmt.Sprintf("%d", itemNo), "1", 0, "C", false, 0, "")
		pdf.CellFormat(60, 6, truncateText(medName, 35), "1", 0, "", false, 0, "")
		pdf.CellFormat(20, 6, qty, "1", 0, "C", false, 0, "")
		pdf.CellFormat(25, 6, dosage, "1", 0, "C", false, 0, "")
		pdf.CellFormat(25, 6, frequency, "1", 0, "C", false, 0, "")
		pdf.CellFormat(40, 6, truncateText(instruction, 25), "1", 1, "", false, 0, "")
	}

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "", models.DocTypePrescription, order.ID)

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Resep_%s.pdf", order.OrderNumber)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypePrescription, order.ID}); isSigned {
		go storeCachedPDF(models.DocTypePrescription, order.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintLabOrder generates PDF for lab order
func printLabOrderImpl(c *gin.Context) {
	orderID := c.Param("orderId")

	// Cache check
	oid, _ := strconv.ParseUint(orderID, 10, 32)
	if pdfData, fileName, found := getCachedPDF("lab_order", uint(oid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	// Load procedure order
	var order models.ProcedureOrder
	if err := database.DB.
		Preload("Items.Procedure").
		Preload("SourceVisit.Registration.Patient").
		Preload("SourceVisit.Doctor").
		Preload("SourceVisit.Room").
		First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.SourceVisit == nil || order.SourceVisit.Registration == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit data not found"})
		return
	}

	patient := order.SourceVisit.Registration.Patient
	visit := order.SourceVisit

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "Permintaan Pemeriksaan Laboratorium", order.OrderNumber)

	// Patient info
	addPatientInfoTable(pdf, patient, visit)

	// Procedures table
	addTableHeader(pdf, "DAFTAR PEMERIKSAAN")
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(10, 6, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(60, 6, "Nama Pemeriksaan", "1", 0, "C", true, 0, "")
	pdf.CellFormat(30, 6, "Kode", "1", 0, "C", true, 0, "")
	pdf.CellFormat(80, 6, "Catatan", "1", 1, "C", true, 0, "")

	pdf.SetFont("Arial", "", 9)
	for i, item := range order.Items {
		procName := ""
		procCode := ""
		if item.Procedure != nil {
			procName = item.Procedure.Name
			procCode = item.Procedure.Code
		}
		notes := item.Notes

		pdf.CellFormat(10, 6, fmt.Sprintf("%d", i+1), "1", 0, "C", false, 0, "")
		pdf.CellFormat(60, 6, truncateText(procName, 35), "1", 0, "", false, 0, "")
		pdf.CellFormat(30, 6, procCode, "1", 0, "C", false, 0, "")
		pdf.CellFormat(80, 6, truncateText(notes, 45), "1", 1, "", false, 0, "")
	}

	// Clinical notes
	if order.ClinicalNotes != "" {
		pdf.SetY(pdf.GetY() + 3)
		addTableHeader(pdf, "CATATAN KLINIS")
		addTableFullRow(pdf, order.ClinicalNotes, false)
		addTableEnd(pdf)
	}

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "", models.DocTypeLabResult, order.ID)

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Order_Lab_%s.pdf", order.OrderNumber)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeLabResult, order.ID}); isSigned {
		go storeCachedPDF("lab_order", order.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintLabResult generates PDF for lab result
func printLabResultImpl(c *gin.Context) {
	orderID := c.Param("orderId")

	// Load procedure order with results
	var order models.ProcedureOrder
	if err := database.DB.
		Preload("Items.Procedure").
		Preload("Items.Results").
		Preload("SourceVisit.Registration.Patient").
		Preload("SourceVisit.Doctor").
		Preload("SourceVisit.Room").
		First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.SourceVisit == nil || order.SourceVisit.Registration == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit data not found"})
		return
	}

	patient := order.SourceVisit.Registration.Patient
	visit := order.SourceVisit

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "Hasil Pemeriksaan Laboratorium", order.OrderNumber)

	// Patient info
	addPatientInfoTable(pdf, patient, visit)

	// Results table
	addTableHeader(pdf, "HASIL PEMERIKSAAN")
	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(50, 6, "Parameter", "1", 0, "C", true, 0, "")
	pdf.CellFormat(30, 6, "Hasil", "1", 0, "C", true, 0, "")
	pdf.CellFormat(25, 6, "Satuan", "1", 0, "C", true, 0, "")
	pdf.CellFormat(40, 6, "Nilai Normal", "1", 0, "C", true, 0, "")
	pdf.CellFormat(35, 6, "Keterangan", "1", 1, "C", true, 0, "")

	pdf.SetFont("Arial", "", 8)
	for _, item := range order.Items {
		// Preload parameters for each result
		for _, result := range item.Results {
			// Load the procedure parameter if needed
			var param models.ProcedureParameter
			database.DB.First(&param, result.ProcedureParameterID)

			paramName := param.Name
			resultVal := result.Value
			unit := param.Unit

			// Build normal range
			normalRange := ""
			if param.NormalMin > 0 || param.NormalMax > 0 {
				normalRange = formatFloatNoExponent(param.NormalMin) + " - " + formatFloatNoExponent(param.NormalMax)
			} else if param.NormalText != "" {
				normalRange = param.NormalText
			}

			// Determine flag
			flag := ""
			if result.IsLow {
				flag = "L"
			} else if result.IsHigh {
				flag = "H"
			} else if result.IsCritical {
				flag = "C!"
			}

			// Highlight abnormal
			if flag != "" {
				pdf.SetTextColor(220, 53, 69)
			}

			pdf.CellFormat(50, 5, truncateText(paramName, 30), "1", 0, "", false, 0, "")
			pdf.CellFormat(30, 5, resultVal, "1", 0, "C", false, 0, "")
			pdf.CellFormat(25, 5, unit, "1", 0, "C", false, 0, "")
			pdf.CellFormat(40, 5, normalRange, "1", 0, "C", false, 0, "")
			pdf.CellFormat(35, 5, flag, "1", 1, "C", false, 0, "")

			pdf.SetTextColor(0, 0, 0)
		}
	}

	// Completed time
	pdf.SetY(pdf.GetY() + 5)
	if order.CompletedAt != nil {
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(0, 5, "Tanggal Pemeriksaan: "+formatDateIndonesian(*order.CompletedAt)+" "+order.CompletedAt.Format("15:04"), "", 1, "", false, 0, "")
	}

	// Signature - lab technician
	pdf.SetY(pdf.GetY() + 10)
	pdf.SetX(130)
	pdf.CellFormat(60, 5, hospitalInfo.City+", "+formatDateIndonesian(time.Now()), "", 1, "C", false, 0, "")
	pdf.SetX(130)
	pdf.CellFormat(60, 5, "Petugas Laboratorium,", "", 1, "C", false, 0, "")
	pdf.SetY(pdf.GetY() + 20)
	pdf.SetX(130)
	pdf.CellFormat(60, 5, "(...........................)", "", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Hasil_Lab_%s.pdf", order.OrderNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// ===========================================================================
// C. CETAKAN GAWAT DARURAT (UGD)
// ===========================================================================

// PrintTriageForm prints the emergency triage form (C1)
// GET /api/print/triage/:visitId?rm_duplicate_id=xxx
func printLaboratoryResultImpl(c *gin.Context) {
	id := c.Param("id")

	// Cache check
	lid, _ := strconv.ParseUint(id, 10, 32)
	if pdfData, fileName, found := getCachedPDF(models.DocTypeLabResult, uint(lid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	var order models.ProcedureOrder
	if err := database.DB.
		Preload("SourceVisit.Registration.Patient").
		Preload("SourceRoom").
		Preload("TargetRoom").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("PerformedBy").
		Preload("ValidatedBy").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Where("status != ?", "cancelled")
		}).
		Preload("Items.Procedure").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.PerformedBy").
		Preload("Items.Results.ProcedureParameter").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
		return
	}

	if order.OrderType != models.ProcedureOrderTypeLaboratory {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order bukan tipe laboratorium"})
		return
	}

	// Get hospital info
	info := getHospitalInfo()

	// Get patient
	patient := order.Registration.Patient

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, 10, marginRight)
	pdf.SetAutoPageBreak(false, 15)

	activeItems := []models.ProcedureOrderItem{}
	for _, item := range order.Items {
		if item.Status != "cancelled" {
			activeItems = append(activeItems, item)
		}
	}

	for idx, item := range activeItems {
		pdf.AddPage()
		addHeader(pdf, info, "HASIL PEMERIKSAAN LABORATORIUM", "")

		// Patient & Order Info Table
		addProcedureOrderInfoTable(pdf, patient, &order)

		// Procedure name
		addTableHeader(pdf, fmt.Sprintf("PEMERIKSAAN: %s", strings.ToUpper(item.Procedure.Name)))

		// Results Table
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(230, 230, 230)
		pdf.CellFormat(60, 7, "Parameter", "1", 0, "C", true, 0, "")
		pdf.CellFormat(35, 7, "Hasil", "1", 0, "C", true, 0, "")
		pdf.CellFormat(20, 7, "Satuan", "1", 0, "C", true, 0, "")
		pdf.CellFormat(45, 7, "Nilai Rujukan", "1", 0, "C", true, 0, "")
		pdf.CellFormat(20, 7, "Ket", "1", 1, "C", true, 0, "")

		pdf.SetFont("Arial", "", 9)
		for _, result := range item.Results {
			paramName := "-"
			unit := ""
			refRange := ""
			if result.ProcedureParameter != nil {
				paramName = result.ProcedureParameter.Name
				unit = result.ProcedureParameter.Unit
				// Build reference range from NormalMin/NormalMax or NormalText
				if result.ProcedureParameter.NormalText != "" {
					refRange = result.ProcedureParameter.NormalText
				} else if result.ProcedureParameter.NormalMin > 0 || result.ProcedureParameter.NormalMax > 0 {
					refRange = formatFloatNoExponent(result.ProcedureParameter.NormalMin) + " - " + formatFloatNoExponent(result.ProcedureParameter.NormalMax)
				}
			}

			// Status indicator
			status := ""
			pdf.SetTextColor(0, 0, 0)
			if result.IsCritical {
				status = "KRITIS"
				pdf.SetTextColor(255, 0, 0)
			} else if result.IsHigh {
				status = "H"
				pdf.SetTextColor(255, 0, 0)
			} else if result.IsLow {
				status = "L"
				pdf.SetTextColor(0, 0, 255)
			}

			pdf.CellFormat(60, 6, paramName, "1", 0, "L", false, 0, "")
			pdf.CellFormat(35, 6, formatNumericString(result.Value), "1", 0, "C", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
			pdf.CellFormat(20, 6, unit, "1", 0, "C", false, 0, "")
			pdf.CellFormat(45, 6, formatNumericString(refRange), "1", 0, "C", false, 0, "")

			// Status with color
			if result.IsCritical || result.IsHigh {
				pdf.SetTextColor(255, 0, 0)
			} else if result.IsLow {
				pdf.SetTextColor(0, 0, 255)
			}
			pdf.CellFormat(20, 6, status, "1", 1, "C", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
		}

		// Notes if any
		if item.Notes != "" {
			pdf.Ln(3)
			pdf.SetFont("Arial", "B", 9)
			pdf.CellFormat(0, 5, "Catatan:", "", 1, "L", false, 0, "")
			pdf.SetFont("Arial", "", 9)
			pdf.MultiCell(0, 5, item.Notes, "", "L", false)
		}

		// Signature section (digital-aware: reads signature log for lab_result)
		performedByName := ""
		if item.PerformedBy != nil {
			performedByName = resolveAssignedUserNameFromEmployee(item.PerformedBy, performedByName)
		}
		addSignature(pdf, info.City, performedByName, "Petugas Laboratorium", models.DocTypeLabResult, order.ID)

		// Page number
		pdf.SetFont("Arial", "", 8)
		pdf.SetXY(marginLeft, 280)
		pdf.CellFormat(0, 5, fmt.Sprintf("Halaman %d dari %d", idx+1, len(activeItems)), "", 0, "C", false, 0, "")
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate PDF"})
		return
	}

	filename := fmt.Sprintf("Hasil_Lab_%s.pdf", order.OrderNumber)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeLabResult, order.ID}); isSigned {
		go storeCachedPDF(models.DocTypeLabResult, order.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintLaboratoryResultItem prints a single laboratory result item
func printLaboratoryResultItemImpl(c *gin.Context) {
	itemID := c.Param("itemId")

	var item models.ProcedureOrderItem
	if err := database.DB.
		Preload("ProcedureOrder.SourceVisit.Registration.Patient").
		Preload("ProcedureOrder.SourceRoom").
		Preload("ProcedureOrder.TargetRoom").
		Preload("ProcedureOrder.Registration.Patient").
		Preload("ProcedureOrder.OrderedBy").
		Preload("Procedure").
		Preload("Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("PerformedBy").
		Preload("Results.ProcedureParameter").
		First(&item, itemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item tidak ditemukan"})
		return
	}

	order := item.ProcedureOrder
	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
		return
	}

	if order.OrderType != models.ProcedureOrderTypeLaboratory {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order bukan tipe laboratorium"})
		return
	}

	// Get hospital info
	info := getHospitalInfo()

	// Get patient
	patient := order.Registration.Patient

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, 10, marginRight)
	pdf.SetAutoPageBreak(false, 15)
	pdf.AddPage()

	addHeader(pdf, info, "HASIL PEMERIKSAAN LABORATORIUM", "")

	// Patient & Order Info Table
	addProcedureOrderInfoTable(pdf, patient, order)

	// Procedure name
	procedureName := "-"
	if item.Procedure != nil {
		procedureName = item.Procedure.Name
	}
	addTableHeader(pdf, fmt.Sprintf("PEMERIKSAAN: %s", strings.ToUpper(procedureName)))

	// Results Table
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(230, 230, 230)
	pdf.CellFormat(60, 7, "Parameter", "1", 0, "C", true, 0, "")
	pdf.CellFormat(35, 7, "Hasil", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 7, "Satuan", "1", 0, "C", true, 0, "")
	pdf.CellFormat(45, 7, "Nilai Rujukan", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 7, "Ket", "1", 1, "C", true, 0, "")

	pdf.SetFont("Arial", "", 9)
	for _, result := range item.Results {
		paramName := "-"
		unit := ""
		refRange := ""
		if result.ProcedureParameter != nil {
			paramName = result.ProcedureParameter.Name
			unit = result.ProcedureParameter.Unit
			// Build reference range from NormalMin/NormalMax or NormalText
			if result.ProcedureParameter.NormalText != "" {
				refRange = result.ProcedureParameter.NormalText
			} else if result.ProcedureParameter.NormalMin > 0 || result.ProcedureParameter.NormalMax > 0 {
				refRange = formatFloatNoExponent(result.ProcedureParameter.NormalMin) + " - " + formatFloatNoExponent(result.ProcedureParameter.NormalMax)
			}
		}

		// Status indicator
		status := ""
		pdf.SetTextColor(0, 0, 0)
		if result.IsCritical {
			status = "KRITIS"
			pdf.SetTextColor(255, 0, 0)
		} else if result.IsHigh {
			status = "H"
			pdf.SetTextColor(255, 0, 0)
		} else if result.IsLow {
			status = "L"
			pdf.SetTextColor(0, 0, 255)
		}

		pdf.CellFormat(60, 6, paramName, "1", 0, "L", false, 0, "")
		pdf.CellFormat(35, 6, formatNumericString(result.Value), "1", 0, "C", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
		pdf.CellFormat(20, 6, unit, "1", 0, "C", false, 0, "")
		pdf.CellFormat(45, 6, formatNumericString(refRange), "1", 0, "C", false, 0, "")

		// Status with color
		if result.IsCritical || result.IsHigh {
			pdf.SetTextColor(255, 0, 0)
		} else if result.IsLow {
			pdf.SetTextColor(0, 0, 255)
		}
		pdf.CellFormat(20, 6, status, "1", 1, "C", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
	}

	// Notes if any
	if item.Notes != "" {
		pdf.Ln(3)
		pdf.SetFont("Arial", "B", 9)
		pdf.CellFormat(0, 5, "Catatan:", "", 1, "L", false, 0, "")
		pdf.SetFont("Arial", "", 9)
		pdf.MultiCell(0, 5, item.Notes, "", "L", false)
	}

	// Signature section (digital-aware: reads signature log for lab_result)
	performedByName := ""
	if item.PerformedBy != nil {
		performedByName = resolveAssignedUserNameFromEmployee(item.PerformedBy, performedByName)
	}
	addSignature(pdf, info.City, performedByName, "Petugas Laboratorium", models.DocTypeLabResult, order.ID)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate PDF"})
		return
	}

	procedureCode := ""
	if item.Procedure != nil {
		procedureCode = item.Procedure.Code
	}
	filename := fmt.Sprintf("Hasil_Lab_%s_%s.pdf", order.OrderNumber, procedureCode)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintRadiologyResult prints radiology results for all items in an order
func printRadiologyResultImpl(c *gin.Context) {
	id := c.Param("id")

	// Cache check
	rid, _ := strconv.ParseUint(id, 10, 32)
	if pdfData, fileName, found := getCachedPDF(models.DocTypeRadiologyResult, uint(rid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	var order models.ProcedureOrder
	if err := database.DB.
		Preload("SourceVisit.Registration.Patient").
		Preload("SourceRoom").
		Preload("TargetRoom").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("PerformedBy").
		Preload("ValidatedBy").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Where("status != ?", "cancelled")
		}).
		Preload("Items.Procedure").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.PerformedBy").
		Preload("Items.Results.ProcedureParameter").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
		return
	}

	if order.OrderType != models.ProcedureOrderTypeRadiology {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order bukan tipe radiologi"})
		return
	}

	// Get hospital info
	info := getHospitalInfo()

	// Get patient
	patient := order.Registration.Patient

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, 10, marginRight)
	pdf.SetAutoPageBreak(false, 15)

	activeItems := []models.ProcedureOrderItem{}
	for _, item := range order.Items {
		if item.Status != "cancelled" {
			activeItems = append(activeItems, item)
		}
	}

	for idx, item := range activeItems {
		pdf.AddPage()
		addHeader(pdf, info, "HASIL PEMERIKSAAN RADIOLOGI", "")

		// Patient & Order Info Table
		addProcedureOrderInfoTable(pdf, patient, &order)

		// Procedure name
		procedureName := "-"
		if item.Procedure != nil {
			procedureName = item.Procedure.Name
		}
		addTableHeader(pdf, fmt.Sprintf("PEMERIKSAAN: %s", strings.ToUpper(procedureName)))

		// Results - for radiology, display using addTableMultiRow for consistent style
		for _, result := range item.Results {
			paramName := "-"
			if result.ProcedureParameter != nil {
				paramName = result.ProcedureParameter.Name
			}

			value := "-"
			if result.Value != "" {
				value = result.Value
			}
			addTableMultiRow(pdf, paramName, value, 35)
		}
		addTableEnd(pdf)

		// Notes if any
		if item.Notes != "" {
			pdf.Ln(2)
			addTableHeader(pdf, "CATATAN")
			addTableMultiRow(pdf, "Catatan", item.Notes, 35)
			addTableEnd(pdf)
		}

		// Signature section (digital-aware: reads signature log for radiology_result)
		pdf.Ln(10)
		performedByName := ""
		if item.PerformedBy != nil {
			performedByName = resolveAssignedUserNameFromEmployee(item.PerformedBy, performedByName)
		} else if order.PerformedBy != nil {
			performedByName = resolveAssignedUserNameFromEmployee(order.PerformedBy, performedByName)
		}
		addSignature(pdf, info.City, performedByName, "Petugas Radiologi", models.DocTypeRadiologyResult, order.ID)

		// Page number
		pdf.SetFont("Arial", "", 8)
		pdf.SetXY(marginLeft, 280)
		pdf.CellFormat(0, 5, fmt.Sprintf("Halaman %d dari %d", idx+1, len(activeItems)), "", 0, "C", false, 0, "")
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate PDF"})
		return
	}

	filename := fmt.Sprintf("Hasil_Radiologi_%s.pdf", order.OrderNumber)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRadiologyResult, order.ID}); isSigned {
		go storeCachedPDF(models.DocTypeRadiologyResult, order.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintRadiologyResultItem prints a single radiology result item
func printRadiologyResultItemImpl(c *gin.Context) {
	itemID := c.Param("itemId")

	var item models.ProcedureOrderItem
	if err := database.DB.
		Preload("ProcedureOrder.SourceVisit.Registration.Patient").
		Preload("ProcedureOrder.SourceRoom").
		Preload("ProcedureOrder.TargetRoom").
		Preload("ProcedureOrder.Registration.Patient").
		Preload("ProcedureOrder.OrderedBy").
		Preload("Procedure").
		Preload("Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("PerformedBy").
		Preload("Results.ProcedureParameter").
		First(&item, itemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item tidak ditemukan"})
		return
	}

	order := item.ProcedureOrder
	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
		return
	}

	if order.OrderType != models.ProcedureOrderTypeRadiology {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order bukan tipe radiologi"})
		return
	}

	// Get hospital info
	info := getHospitalInfo()

	// Get patient
	patient := order.Registration.Patient

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, 10, marginRight)
	pdf.SetAutoPageBreak(false, 15)
	pdf.AddPage()

	addHeader(pdf, info, "HASIL PEMERIKSAAN RADIOLOGI", "")

	// Patient & Order Info Table
	addProcedureOrderInfoTable(pdf, patient, order)

	// Procedure name
	procedureName := "-"
	if item.Procedure != nil {
		procedureName = item.Procedure.Name
	}
	addTableHeader(pdf, fmt.Sprintf("PEMERIKSAAN: %s", strings.ToUpper(procedureName)))

	// Results - for radiology, display using addTableMultiRow for consistent style
	for _, result := range item.Results {
		paramName := "-"
		if result.ProcedureParameter != nil {
			paramName = result.ProcedureParameter.Name
		}

		value := "-"
		if result.Value != "" {
			value = result.Value
		}
		addTableMultiRow(pdf, paramName, value, 35)
	}
	addTableEnd(pdf)

	// Notes if any
	if item.Notes != "" {
		pdf.Ln(2)
		addTableHeader(pdf, "CATATAN")
		addTableMultiRow(pdf, "Catatan", item.Notes, 35)
		addTableEnd(pdf)
	}

	// Signature section (digital-aware: reads signature log for radiology_result)
	pdf.Ln(10)
	performedByName := ""
	if item.PerformedBy != nil {
		performedByName = resolveAssignedUserNameFromEmployee(item.PerformedBy, performedByName)
	} else if order.PerformedBy != nil {
		performedByName = resolveAssignedUserNameFromEmployee(order.PerformedBy, performedByName)
	}
	addSignature(pdf, info.City, performedByName, "Petugas Radiologi", models.DocTypeRadiologyResult, order.ID)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate PDF"})
		return
	}

	procedureCode := ""
	if item.Procedure != nil {
		procedureCode = item.Procedure.Code
	}
	filename := fmt.Sprintf("Hasil_Radiologi_%s_%s.pdf", order.OrderNumber, procedureCode)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintBilling generates PDF for billing/invoice
// Query params:
//   - mode=per_visit : group items by visit (one section per kunjungan)
//   - visit_id=123   : print only items for a specific visit

func printProcedureOrderResultImpl(c *gin.Context) {
	id := c.Param("id")

	var order models.ProcedureOrder
	if err := database.DB.
		Preload("SourceVisit.Registration.Patient").
		Preload("TargetVisit.RoomQueue").
		Preload("SourceRoom").
		Preload("TargetRoom").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("SurgeonDoctor").
		Preload("PerformedBy").
		Preload("ValidatedBy").
		Preload("Consultation.Consultant").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.Results.ProcedureParameter").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	if order.OrderType != models.ProcedureOrderTypeSurgery && order.OrderType != models.ProcedureOrderTypeConsultation {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order type tidak didukung untuk cetak hasil prosedur"})
		return
	}

	var patient *models.Patient
	if order.Registration != nil && order.Registration.Patient != nil {
		patient = order.Registration.Patient
	}
	if patient == nil && order.SourceVisit != nil && order.SourceVisit.Registration != nil {
		patient = order.SourceVisit.Registration.Patient
	}
	if patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, 10, marginRight)
	pdf.SetAutoPageBreak(false, 15)
	pdf.AddPage()

	title := "HASIL KONSULTASI"
	if order.OrderType == models.ProcedureOrderTypeSurgery {
		title = "CATATAN OPERASI"
	}
	addHeader(pdf, hospitalInfo, title, order.OrderNumber)

	// Identitas pasien dan order
	addTableHeader(pdf, "INFORMASI PASIEN")
	addTableRow(pdf, "No. RM", safeString(patient.NoRM), 40)
	addTableRow(pdf, "Nama Pasien", safeString(patient.NamaLengkap), 40)
	birthDate := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = formatDateIndonesian(patient.TanggalLahir.Time)
	}
	addTableRow(pdf, "Tanggal Lahir", birthDate, 40)
	if order.SourceVisit != nil {
		addTableRow(pdf, "No. Kunjungan", safeString(order.SourceVisit.VisitNumber), 40)
	}
	addTableRow(pdf, "No. Order", safeString(order.OrderNumber), 40)
	addTableRow(pdf, "Tanggal Order", formatDateTimeIndonesian(order.CreatedAt), 40)
	if order.CompletedAt != nil {
		addTableRow(pdf, "Tanggal Selesai", formatDateTimeIndonesian(*order.CompletedAt), 40)
	}
	addTableEnd(pdf)

	if order.OrderType == models.ProcedureOrderTypeConsultation {
		hasNarrativeResults := false
		if order.Consultation != nil {
			hasNarrativeResults = strings.TrimSpace(order.Consultation.Subjective) != "" ||
				strings.TrimSpace(order.Consultation.Objective) != "" ||
				strings.TrimSpace(order.Consultation.Assessment) != "" ||
				strings.TrimSpace(order.Consultation.Plan) != "" ||
				strings.TrimSpace(order.Consultation.Recommendation) != "" ||
				strings.TrimSpace(order.Consultation.Notes) != ""
		} else {
			hasNarrativeResults = strings.TrimSpace(order.ResultSummary) != "" ||
				strings.TrimSpace(order.Conclusion) != "" ||
				strings.TrimSpace(order.Suggestion) != ""
		}

		if hasNarrativeResults {
			addTableHeader(pdf, "HASIL KONSULTASI")
		}
		if order.Consultation != nil {
			if order.Consultation.Consultant != nil {
				addTableMultiRow(pdf, "Dokter Konsultan", order.Consultation.Consultant.NamaLengkap, 40)
			}
			if order.Consultation.Subjective != "" {
				addTableMultiRow(pdf, "Subjective (S)", order.Consultation.Subjective, 40)
			}
			if order.Consultation.Objective != "" {
				addTableMultiRow(pdf, "Objective (O)", order.Consultation.Objective, 40)
			}
			if order.Consultation.Assessment != "" {
				addTableMultiRow(pdf, "Assessment (A)", order.Consultation.Assessment, 40)
			}
			if order.Consultation.Plan != "" {
				addTableMultiRow(pdf, "Plan (P)", order.Consultation.Plan, 40)
			}
			if order.Consultation.Recommendation != "" {
				addTableMultiRow(pdf, "Rekomendasi", order.Consultation.Recommendation, 40)
			}
			if order.Consultation.Notes != "" {
				addTableMultiRow(pdf, "Catatan", order.Consultation.Notes, 40)
			}
		} else {
			if order.ResultSummary != "" {
				addTableMultiRow(pdf, "Ringkasan", order.ResultSummary, 40)
			}
			if order.Conclusion != "" {
				addTableMultiRow(pdf, "Kesimpulan", order.Conclusion, 40)
			}
			if order.Suggestion != "" {
				addTableMultiRow(pdf, "Saran", order.Suggestion, 40)
			}
		}
		if hasNarrativeResults {
			addTableEnd(pdf)
		}

		// Consultation now supports parameter-based results via procedure_order_items/results.
		// Render them so printed output matches what user filled in consultation form.
		hasParameterResults := false
		for _, item := range order.Items {
			if item.Status == "cancelled" {
				continue
			}

			resultByParamID := map[uint]models.ProcedureOrderResult{}
			for _, result := range item.Results {
				resultByParamID[result.ProcedureParameterID] = result
			}

			procedureName := ""
			if item.Procedure != nil {
				procedureName = item.Procedure.Name
			}

			itemRows := 0
			for _, param := range item.Procedure.Parameters {
				res, ok := resultByParamID[param.ID]
				if !ok {
					continue
				}

				value := strings.TrimSpace(res.Value)
				if value == "" {
					if param.InputType == models.InputTypeNumber || res.NumericValue != 0 {
						value = strconv.FormatFloat(res.NumericValue, 'f', -1, 64)
					}
				}
				if value == "" {
					continue
				}

				if param.Unit != "" {
					value = fmt.Sprintf("%s %s", value, param.Unit)
				}

				if !hasParameterResults {
					addTableHeader(pdf, "HASIL PARAMETER KONSULTASI")
					hasParameterResults = true
				}

				if itemRows == 0 && procedureName != "" {
					addTableMultiRow(pdf, "Tindakan", procedureName, 40)
				}

				addTableMultiRow(pdf, param.Name, value, 40)
				if strings.TrimSpace(res.Notes) != "" {
					addTableMultiRow(pdf, param.Name+" (Catatan)", strings.TrimSpace(res.Notes), 40)
				}

				itemRows++
			}
		}
		if hasParameterResults {
			addTableEnd(pdf)
		}
	} else {
		addTableHeader(pdf, "LAPORAN OPERASI")
		if order.SurgeonDoctor != nil {
			addTableMultiRow(pdf, "Dokter Operator", order.SurgeonDoctor.NamaLengkap, 40)
		}
		if order.ScheduledDate != nil {
			addTableMultiRow(pdf, "Jadwal Operasi", formatDateTimeIndonesian(*order.ScheduledDate), 40)
		}
		if order.ResultSummary != "" {
			addTableMultiRow(pdf, "Deskripsi", order.ResultSummary, 40)
		}
		if order.Conclusion != "" {
			addTableMultiRow(pdf, "Kesimpulan", order.Conclusion, 40)
		}
		if order.Suggestion != "" {
			addTableMultiRow(pdf, "Saran", order.Suggestion, 40)
		}
		for idx, item := range order.Items {
			name := ""
			if item.Procedure != nil {
				name = item.Procedure.Name
			}
			if name == "" {
				continue
			}
			addTableMultiRow(pdf, fmt.Sprintf("Tindakan %d", idx+1), name, 40)
			if item.Notes != "" {
				addTableMultiRow(pdf, "Catatan", item.Notes, 40)
			}
		}
		addTableEnd(pdf)
	}

	if order.ClinicalNotes != "" {
		addTableHeader(pdf, "CATATAN KLINIS")
		addTableFullRow(pdf, order.ClinicalNotes, false)
		addTableEnd(pdf)
	}

	docType := models.DocTypeOperativeReport
	sigLabel := "Dokter Operator"
	doctorName := "-"
	if order.SurgeonDoctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.SurgeonDoctor, doctorName)
	}
	if order.OrderType == models.ProcedureOrderTypeConsultation {
		docType = models.DocTypeConsultationResult
		sigLabel = "Dokter Konsultan"
		if order.Consultation != nil && order.Consultation.Consultant != nil {
			doctorName = resolveAssignedUserNameFromEmployee(order.Consultation.Consultant, doctorName)
		}
		if doctorName == "-" && order.TargetVisit != nil && order.TargetVisit.Doctor != nil {
			doctorName = resolveAssignedUserNameFromEmployee(order.TargetVisit.Doctor, doctorName)
		}
	}
	if doctorName == "-" && order.ValidatedBy != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.ValidatedBy, doctorName)
	}
	if doctorName == "-" && order.PerformedBy != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.PerformedBy, doctorName)
	}
	if doctorName == "-" && order.OrderedBy != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.OrderedBy, doctorName)
	}
	if order.OrderType == models.ProcedureOrderTypeConsultation {
		// Keep backward compatibility with older signatures that might have used operative_report.
		addSignature(pdf, hospitalInfo.City, doctorName, sigLabel, docType, order.ID,
			signatureLookup{DocType: models.DocTypeOperativeReport, DocID: order.ID})
	} else {
		addSignature(pdf, hospitalInfo.City, doctorName, sigLabel, docType, order.ID)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filePrefix := "Hasil_Konsultasi"
	if order.OrderType == models.ProcedureOrderTypeSurgery {
		filePrefix = "Laporan_Operasi"
	}
	filename := fmt.Sprintf("%s_%s.pdf", filePrefix, order.OrderNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}
