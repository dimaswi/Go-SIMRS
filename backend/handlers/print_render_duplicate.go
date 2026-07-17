package handlers

import (
	"bytes"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"
	"net/http"
	"os"
	"path/filepath"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"
)

func printPrescriptionThermalImpl(c *gin.Context) {
	orderID := c.Param("orderId")

	var order models.MedicineOrder
	if err := database.DB.
		Preload("Items.Medicine").
		Preload("Registration.Patient").
		Preload("SourceVisit.Room").
		Preload("SourceVisit.Doctor").
		Preload("Prescriber").
		Preload("ReviewedBy").
		Preload("DeliveredBy").
		First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	if len(order.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No items in order"})
		return
	}

	// Get patient info
	patientName := "-"
	noRM := "-"
	if order.Registration != nil && order.Registration.Patient != nil {
		patientName = order.Registration.Patient.NamaLengkap
		noRM = order.Registration.Patient.NoRM
	}

	// Get doctor info
	doctorName := "-"
	if order.SourceVisit != nil && order.SourceVisit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.SourceVisit.Doctor, doctorName)
	} else if order.Prescriber != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.Prescriber, doctorName)
	}

	// Get pharmacist/petugas info - prefer DeliveredBy, then ReviewedBy
	pharmacistName := ""
	if order.DeliveredBy != nil {
		pharmacistName = resolveAssignedUserNameFromEmployee(order.DeliveredBy, pharmacistName)
	} else if order.ReviewedBy != nil {
		pharmacistName = resolveAssignedUserNameFromEmployee(order.ReviewedBy, pharmacistName)
	}

	// Get room info
	roomName := "-"
	if order.SourceVisit != nil && order.SourceVisit.Room != nil {
		roomName = order.SourceVisit.Room.Name
	}

	// Get hospital info for header
	hospitalInfo := getHospitalInfo()

	// Count active items (not cancelled) for page height calculation
	activeItemCount := 0
	for _, item := range order.Items {
		if item.Status != models.ItemStatusCancelled {
			activeItemCount++
		}
	}

	// Calculate page height based on number of active items
	// Header: ~30mm, Patient info: ~25mm, Each item: ~15mm, Signature: ~35mm, Footer: ~10mm
	itemsHeight := float64(activeItemCount) * 15.0
	pageHeight := 30.0 + 25.0 + itemsHeight + 40.0 + 10.0

	// Minimum height 120mm to accommodate signature
	if pageHeight < 120.0 {
		pageHeight = 120.0
	}

	pageWidth := 100.0

	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr: "mm",
		Size:    gofpdf.SizeType{Wd: pageWidth, Ht: pageHeight},
	})
	pdf.SetMargins(3, 3, 3)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	contentWidth := 94.0
	marginL := 3.0

	// Border box
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.3)
	pdf.Rect(marginL, 3, contentWidth, pageHeight-6, "D")

	// === KOP HEADER ===
	headerStartY := 4.0

	// Logo - di sebelah kiri
	logoWidth := 12.0
	logoPath := ""
	if hospitalInfo.Logo != "" {
		logoFile := strings.TrimPrefix(hospitalInfo.Logo, "/")
		logoFile = strings.TrimPrefix(logoFile, "uploads/")
		logoPath = filepath.Join("uploads", logoFile)
		if _, err := os.Stat(logoPath); err == nil {
			ext := strings.ToLower(filepath.Ext(logoPath))
			imgType := ""
			switch ext {
			case ".png":
				imgType = "PNG"
			case ".jpg", ".jpeg":
				imgType = "JPG"
			}
			if imgType != "" {
				pdf.Image(logoPath, marginL+2, headerStartY, logoWidth, logoWidth, false, imgType, 0, "")
			}
		}
	}

	// Hospital name - setelah logo
	textStartX := marginL + 2 + logoWidth + 2
	textWidth := contentWidth - logoWidth - 6
	pdf.SetFont("Arial", "B", 8)
	pdf.SetXY(textStartX, headerStartY)
	pdf.MultiCell(textWidth, 3.5, hospitalInfo.Name, "", "C", false)

	// Address
	pdf.SetFont("Arial", "", 6)
	address := hospitalInfo.Address
	if hospitalInfo.City != "" {
		address += ", " + hospitalInfo.City
	}
	pdf.SetX(textStartX)
	pdf.MultiCell(textWidth, 2.5, address, "", "C", false)

	// Phone
	if hospitalInfo.Phone != "" {
		pdf.SetX(textStartX)
		pdf.CellFormat(textWidth, 3, "Telp: "+hospitalInfo.Phone, "", 1, "C", false, 0, "")
	}

	// Double line after header
	lineY := headerStartY + logoWidth + 2
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.4)
	pdf.Line(marginL+2, lineY, marginL+contentWidth-2, lineY)
	pdf.SetLineWidth(0.15)
	pdf.Line(marginL+2, lineY+0.6, marginL+contentWidth-2, lineY+0.6)

	// Title
	pdf.SetY(lineY + 2)
	pdf.SetX(marginL)
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(contentWidth, 5, "RESEP OBAT", "", 1, "C", false, 0, "")

	// Order number
	pdf.SetFont("Arial", "", 7)
	pdf.SetX(marginL)
	pdf.CellFormat(contentWidth, 3, "No: "+order.OrderNumber, "", 1, "C", false, 0, "")

	// Divider
	pdf.Ln(1)
	pdf.SetDashPattern([]float64{1, 1}, 0)
	pdf.Line(marginL+2, pdf.GetY(), marginL+contentWidth-2, pdf.GetY())
	pdf.SetDashPattern([]float64{}, 0)
	pdf.Ln(2)

	// === PATIENT INFO ===
	labelWidth := 22.0
	valueWidth := contentWidth - labelWidth - 6

	pdf.SetFont("Arial", "", 8)
	pdf.SetX(marginL + 4)
	pdf.CellFormat(labelWidth, 4, "Nama Pasien", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(valueWidth, 4, patientName, "", 1, "L", false, 0, "")

	pdf.SetFont("Arial", "", 8)
	pdf.SetX(marginL + 4)
	pdf.CellFormat(labelWidth, 4, "No. RM", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.CellFormat(valueWidth, 4, noRM, "", 1, "L", false, 0, "")

	pdf.SetX(marginL + 4)
	pdf.CellFormat(labelWidth, 4, "Ruangan", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.CellFormat(valueWidth, 4, roomName, "", 1, "L", false, 0, "")

	pdf.SetX(marginL + 4)
	pdf.CellFormat(labelWidth, 4, "Dokter Peresep", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.CellFormat(valueWidth, 4, doctorName, "", 1, "L", false, 0, "")

	pdf.SetX(marginL + 4)
	pdf.CellFormat(labelWidth, 4, "Tanggal", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.CellFormat(valueWidth, 4, formatDateIndonesian(order.CreatedAt)+", "+order.CreatedAt.Format("15:04"), "", 1, "L", false, 0, "")

	// Divider
	pdf.Ln(1)
	pdf.SetDashPattern([]float64{1, 1}, 0)
	pdf.Line(marginL+2, pdf.GetY(), marginL+contentWidth-2, pdf.GetY())
	pdf.SetDashPattern([]float64{}, 0)
	pdf.Ln(2)

	// === MEDICINE LIST ===
	pdf.SetX(marginL + 4)
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(contentWidth-8, 4, "DAFTAR OBAT:", "", 1, "L", false, 0, "")
	pdf.Ln(1)

	// Medicine items
	itemNo := 0
	for _, item := range order.Items {
		// Skip cancelled items
		if item.Status == models.ItemStatusCancelled {
			continue
		}
		itemNo++
		medicineName := "-"
		if item.Medicine != nil {
			medicineName = item.Medicine.Name
		}

		// Number and medicine name
		pdf.SetX(marginL + 4)
		pdf.SetFont("Arial", "B", 8)
		numStr := fmt.Sprintf("%d.", itemNo)
		pdf.CellFormat(6, 4, numStr, "", 0, "L", false, 0, "")
		pdf.CellFormat(contentWidth-14, 4, truncateString(medicineName, 35), "", 1, "L", false, 0, "")

		// Quantity and dosage
		pdf.SetX(marginL + 10)
		pdf.SetFont("Arial", "", 7)
		qtyInfo := fmt.Sprintf("Jumlah: %s %s", formatNumber(float64(item.Quantity)), item.Unit)
		if item.Dosage != "" {
			qtyInfo += " | Dosis: " + item.Dosage
		}
		pdf.CellFormat(contentWidth-14, 3.5, qtyInfo, "", 1, "L", false, 0, "")

		// Instructions
		if item.Instructions != "" {
			pdf.SetX(marginL + 10)
			pdf.SetFont("Arial", "I", 7)
			pdf.CellFormat(contentWidth-14, 3.5, truncateString(item.Instructions, 45), "", 1, "L", false, 0, "")
		}

		pdf.Ln(1)
	}

	// Divider
	pdf.Ln(1)
	pdf.SetDashPattern([]float64{1, 1}, 0)
	pdf.Line(marginL+2, pdf.GetY(), marginL+contentWidth-2, pdf.GetY())
	pdf.SetDashPattern([]float64{}, 0)
	pdf.Ln(2)

	// === SIGNATURE SECTION ===
	pdf.Ln(3)

	// Two columns for signatures
	colWidth := (contentWidth - 10) / 2
	startX := marginL + 5
	signY := pdf.GetY()

	// Left column: Apoteker/Petugas
	pdf.SetXY(startX, signY)
	pdf.SetFont("Arial", "B", 7)
	pdf.CellFormat(colWidth, 4, "Apoteker/Petugas", "", 1, "C", false, 0, "")

	// Signature line
	pdf.SetXY(startX+5, signY+18)
	pdf.SetDrawColor(100, 100, 100)
	pdf.Line(startX+5, signY+18, startX+colWidth-5, signY+18)

	// Pharmacist name
	pdf.SetXY(startX, signY+19)
	pdf.SetFont("Arial", "", 7)
	pharmacistDisplay := "(..........................)"
	if pharmacistName != "" {
		pharmacistDisplay = "(" + pharmacistName + ")"
	}
	pdf.CellFormat(colWidth, 4, pharmacistDisplay, "", 0, "C", false, 0, "")

	// Right column: Penerima (Pasien/Keluarga)
	pdf.SetXY(startX+colWidth+5, signY)
	pdf.SetFont("Arial", "B", 7)
	pdf.CellFormat(colWidth, 4, "Penerima", "", 1, "C", false, 0, "")

	// Signature line
	pdf.Line(startX+colWidth+10, signY+18, startX+colWidth*2, signY+18)

	// Receiver placeholder
	pdf.SetXY(startX+colWidth+5, signY+19)
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(colWidth, 4, "(..........................)", "", 0, "C", false, 0, "")

	// Move Y down
	pdf.SetY(signY + 25)

	// Divider
	pdf.SetDashPattern([]float64{1, 1}, 0)
	pdf.Line(marginL+2, pdf.GetY(), marginL+contentWidth-2, pdf.GetY())
	pdf.SetDashPattern([]float64{}, 0)
	pdf.Ln(2)

	// === FOOTER ===
	pdf.SetFont("Arial", "", 6)
	pdf.SetX(marginL)
	pdf.CellFormat(contentWidth, 3, "Simpan resep ini sebagai bukti pengambilan obat", "", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Resep_%s.pdf", order.OrderNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintLaboratoryResult prints laboratory results for all items in an order
func printBillingImpl(c *gin.Context) {
	billingID := c.Param("billingId")
	printMode := c.Query("mode")       // "per_visit" or empty (default: by type)
	visitFilter := c.Query("visit_id") // filter to single visit

	// Load billing with all relations
	var billing models.Billing
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Visit.Doctor").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("source_visit_id ASC, item_type ASC")
		}).
		Preload("Items.SourceVisit").
		Preload("Items.SourceVisit.Room").
		Preload("Items.SourceVisit.Doctor").
		Preload("Payments").
		Preload("Payments.Cashier").
		Preload("GeneratedBy").
		Preload("FinalizedBy").
		First(&billing, billingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing not found"})
		return
	}

	// If visit_id filter, only keep items for that visit
	if visitFilter != "" {
		var filtered []models.BillingItem
		for _, item := range billing.Items {
			if item.SourceVisitID != nil && fmt.Sprintf("%d", *item.SourceVisitID) == visitFilter {
				filtered = append(filtered, item)
			}
		}
		billing.Items = filtered
		// Recalculate total for filtered items
		var filteredTotal float64
		for _, item := range filtered {
			filteredTotal += item.Subtotal
		}
		billing.TotalAmount = filteredTotal
		billing.FinalAmount = filteredTotal - billing.DiscountAmount + billing.AdjustAmount
	}

	// Get patient data
	if billing.Registration == nil || billing.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}
	patient := billing.Registration.Patient

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 15)
	pdf.AddPage()

	// Header
	headerSubtitle := "No: " + billing.BillingNumber
	if visitFilter != "" {
		headerSubtitle += " (Per Kunjungan)"
	}
	addHeader(pdf, hospitalInfo, "KWITANSI / INVOICE", headerSubtitle)

	// Patient Info Section
	pdf.SetY(pdf.GetY() + 8)
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(0, 6, "DATA PASIEN", "", 1, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)

	// Patient details in two columns
	leftColWidth := 35.0
	rightColWidth := 55.0
	gapWidth := 10.0

	// Row 1: Nama & No. RM
	pdf.CellFormat(leftColWidth, 5, "Nama", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(rightColWidth, 5, patient.NamaLengkap, "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(gapWidth, 5, "", "", 0, "", false, 0, "")
	pdf.CellFormat(leftColWidth, 5, "No. RM", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(rightColWidth, 5, patient.NoRM, "", 1, "", false, 0, "")

	// Row 2: NIK & No. Registrasi
	nik := patient.NIK
	if nik == "" {
		nik = "-"
	}
	pdf.CellFormat(leftColWidth, 5, "NIK", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(rightColWidth, 5, nik, "", 0, "", false, 0, "")
	pdf.CellFormat(gapWidth, 5, "", "", 0, "", false, 0, "")
	regNumber := ""
	if billing.Registration != nil {
		regNumber = billing.Registration.RegistrationNumber
	}
	pdf.CellFormat(leftColWidth, 5, "No. Registrasi", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(rightColWidth, 5, regNumber, "", 1, "", false, 0, "")

	// Row 3: Alamat
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(leftColWidth, 5, "Alamat", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(0, 5, truncateText(alamat, 80), "", 1, "", false, 0, "")

	// Row 4: Kelas & Cara Bayar
	pdf.CellFormat(leftColWidth, 5, "Kelas", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
	patientClass := billing.PatientClass
	switch patientClass {
	case "vip":
		patientClass = "VIP"
	case "kelas_1":
		patientClass = "Kelas 1"
	case "kelas_2":
		patientClass = "Kelas 2"
	case "kelas_3":
		patientClass = "Kelas 3"
	case "non_kelas":
		patientClass = "Non Kelas"
	case "":
		patientClass = "-"
	}
	pdf.CellFormat(rightColWidth, 5, patientClass, "", 0, "", false, 0, "")
	pdf.CellFormat(gapWidth, 5, "", "", 0, "", false, 0, "")
	pdf.CellFormat(leftColWidth, 5, "Cara Bayar", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
	paymentMethod := billing.PaymentMethod
	if paymentMethod == "" {
		paymentMethod = "Umum"
	} else if paymentMethod == "bpjs" {
		paymentMethod = "BPJS"
	} else if paymentMethod == "insurance" {
		paymentMethod = "Asuransi"
	} else if paymentMethod == "cash" {
		paymentMethod = "Tunai"
	}
	pdf.CellFormat(rightColWidth, 5, paymentMethod, "", 1, "", false, 0, "")

	pdf.Ln(3)

	// Billing Items Table
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(0, 6, "RINCIAN BIAYA", "", 1, "", false, 0, "")

	// Table Header
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(10, 7, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(80, 7, "Uraian", "1", 0, "C", true, 0, "")
	pdf.CellFormat(15, 7, "Qty", "1", 0, "C", true, 0, "")
	pdf.CellFormat(35, 7, "Harga Satuan", "1", 0, "C", true, 0, "")
	pdf.CellFormat(40, 7, "Subtotal", "1", 1, "C", true, 0, "")

	// Item type labels
	itemTypeLabels := map[string]string{
		"registration": "Pendaftaran",
		"procedure":    "Tindakan",
		"radiology":    "Radiologi",
		"laboratory":   "Laboratorium",
		"consultation": "Konsultasi",
		"medicine":     "Obat",
		"room":         "Kamar",
		"other":        "Lain-lain",
	}

	visitTypeLabels := map[string]string{
		"outpatient": "Rawat Jalan",
		"inpatient":  "Rawat Inap",
		"emergency":  "UGD",
		"lab":        "Lab",
		"radiology":  "Radiologi",
		"surgery":    "Operasi",
	}

	// Table Body
	pdf.SetFont("Arial", "", 9)
	no := 1

	if printMode == "per_visit" {
		// === PER VISIT MODE: group items by source_visit_id, then by type within each visit ===
		type visitGroup struct {
			visit *models.Visit
			items []models.BillingItem
			total float64
		}
		visitOrder := []uint{}
		visitMap := map[uint]*visitGroup{}

		for _, item := range billing.Items {
			vid := uint(0)
			if item.SourceVisitID != nil {
				vid = *item.SourceVisitID
			}
			if _, ok := visitMap[vid]; !ok {
				visitMap[vid] = &visitGroup{visit: item.SourceVisit}
				visitOrder = append(visitOrder, vid)
			}
			g := visitMap[vid]
			g.items = append(g.items, item)
			g.total += item.Subtotal
		}

		for _, vid := range visitOrder {
			g := visitMap[vid]

			// Visit header row
			visitLabel := "Kunjungan"
			if g.visit != nil {
				vtLabel := visitTypeLabels[g.visit.VisitType]
				if vtLabel == "" {
					vtLabel = g.visit.VisitType
				}
				visitLabel = vtLabel
				if g.visit.Room != nil {
					visitLabel += " - " + g.visit.Room.Name
				}
				if g.visit.Doctor != nil {
					visitLabel += " (" + resolveAssignedUserNameFromEmployee(g.visit.Doctor, g.visit.Doctor.NamaLengkap) + ")"
				}
			}

			pdf.SetFont("Arial", "B", 9)
			pdf.SetFillColor(220, 235, 250)
			pdf.CellFormat(140, 6, visitLabel, "1", 0, "L", true, 0, "")
			pdf.CellFormat(40, 6, formatCurrency(g.total), "1", 1, "R", true, 0, "")
			pdf.SetFont("Arial", "", 9)

			// Group items within visit by type
			itemTypes := []string{"registration", "procedure", "radiology", "laboratory", "consultation", "medicine", "room", "other"}
			for _, it := range itemTypes {
				var typeItems []models.BillingItem
				for _, item := range g.items {
					if item.ItemType == it {
						typeItems = append(typeItems, item)
					}
				}
				if len(typeItems) == 0 {
					continue
				}

				// Type sub-header
				pdf.SetFont("Arial", "B", 8)
				pdf.SetFillColor(248, 248, 248)
				label := itemTypeLabels[it]
				if label == "" {
					label = it
				}
				pdf.CellFormat(180, 5, "  "+label, "LR", 1, "L", true, 0, "")
				pdf.SetFont("Arial", "", 9)

				for _, item := range typeItems {
					pdf.CellFormat(10, 6, fmt.Sprintf("%d", no), "1", 0, "C", false, 0, "")
					desc := truncateText(item.Description, 50)
					pdf.CellFormat(80, 6, desc, "1", 0, "L", false, 0, "")
					pdf.CellFormat(15, 6, formatNumber(float64(item.Quantity)), "1", 0, "C", false, 0, "")
					pdf.CellFormat(35, 6, formatCurrency(item.UnitPrice), "1", 0, "R", false, 0, "")
					pdf.CellFormat(40, 6, formatCurrency(item.Subtotal), "1", 1, "R", false, 0, "")
					no++
				}
			}
		}
	} else {
		// === DEFAULT MODE: group items by type ===
		itemTypes := []string{"registration", "procedure", "radiology", "laboratory", "consultation", "medicine", "room", "other"}
		for _, itemType := range itemTypes {
			var typeItems []models.BillingItem
			for _, item := range billing.Items {
				if item.ItemType == itemType {
					typeItems = append(typeItems, item)
				}
			}
			if len(typeItems) == 0 {
				continue
			}

			// Type header
			pdf.SetFont("Arial", "B", 9)
			pdf.SetFillColor(250, 250, 250)
			label := itemTypeLabels[itemType]
			if label == "" {
				label = itemType
			}
			pdf.CellFormat(180, 6, label, "1", 1, "L", true, 0, "")
			pdf.SetFont("Arial", "", 9)

			for _, item := range typeItems {
				pdf.CellFormat(10, 6, fmt.Sprintf("%d", no), "1", 0, "C", false, 0, "")
				desc := truncateText(item.Description, 50)
				pdf.CellFormat(80, 6, desc, "1", 0, "L", false, 0, "")
				pdf.CellFormat(15, 6, formatNumber(float64(item.Quantity)), "1", 0, "C", false, 0, "")
				pdf.CellFormat(35, 6, formatCurrency(item.UnitPrice), "1", 0, "R", false, 0, "")
				pdf.CellFormat(40, 6, formatCurrency(item.Subtotal), "1", 1, "R", false, 0, "")
				no++
			}
		}
	}

	// Summary
	pdf.Ln(2)
	summaryX := 100.0
	labelWidth := 40.0
	valueWidth := 40.0

	// Total
	pdf.SetX(summaryX)
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(labelWidth, 6, "Total", "0", 0, "R", false, 0, "")
	pdf.CellFormat(5, 6, ":", "0", 0, "C", false, 0, "")
	pdf.CellFormat(valueWidth, 6, formatCurrency(billing.TotalAmount), "0", 1, "R", false, 0, "")

	// Discount (if any)
	if billing.DiscountAmount > 0 {
		pdf.SetX(summaryX)
		pdf.CellFormat(labelWidth, 6, "Diskon", "0", 0, "R", false, 0, "")
		pdf.CellFormat(5, 6, ":", "0", 0, "C", false, 0, "")
		pdf.SetTextColor(255, 0, 0)
		pdf.CellFormat(valueWidth, 6, "- "+formatCurrency(billing.DiscountAmount), "0", 1, "R", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
	}

	// Adjustment (if any)
	if billing.AdjustAmount != 0 {
		pdf.SetX(summaryX)
		pdf.CellFormat(labelWidth, 6, "Penyesuaian", "0", 0, "R", false, 0, "")
		pdf.CellFormat(5, 6, ":", "0", 0, "C", false, 0, "")
		if billing.AdjustAmount < 0 {
			pdf.SetTextColor(255, 0, 0)
			pdf.CellFormat(valueWidth, 6, formatCurrency(billing.AdjustAmount), "0", 1, "R", false, 0, "")
		} else {
			pdf.CellFormat(valueWidth, 6, "+ "+formatCurrency(billing.AdjustAmount), "0", 1, "R", false, 0, "")
		}
		pdf.SetTextColor(0, 0, 0)
	}

	// Grand Total
	pdf.SetX(summaryX)
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(labelWidth, 8, "GRAND TOTAL", "T", 0, "R", false, 0, "")
	pdf.CellFormat(5, 8, ":", "T", 0, "C", false, 0, "")
	pdf.CellFormat(valueWidth, 8, formatCurrency(billing.FinalAmount), "T", 1, "R", false, 0, "")

	// Paid Amount
	if billing.PaidAmount > 0 {
		pdf.SetX(summaryX)
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(labelWidth, 6, "Sudah Dibayar", "0", 0, "R", false, 0, "")
		pdf.CellFormat(5, 6, ":", "0", 0, "C", false, 0, "")
		pdf.CellFormat(valueWidth, 6, formatCurrency(billing.PaidAmount), "0", 1, "R", false, 0, "")
	}

	// Remaining
	if billing.RemainingAmount > 0 {
		pdf.SetX(summaryX)
		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(labelWidth, 6, "Sisa Tagihan", "0", 0, "R", false, 0, "")
		pdf.CellFormat(5, 6, ":", "0", 0, "C", false, 0, "")
		pdf.SetTextColor(255, 0, 0)
		pdf.CellFormat(valueWidth, 6, formatCurrency(billing.RemainingAmount), "0", 1, "R", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
	}

	// Status badge
	pdf.Ln(3)
	pdf.SetX(summaryX)
	statusLabel := billing.Status
	switch billing.Status {
	case "draft":
		statusLabel = "DRAFT"
	case "pending":
		statusLabel = "MENUNGGU PEMBAYARAN"
	case "partial":
		statusLabel = "PEMBAYARAN SEBAGIAN"
	case "paid":
		statusLabel = "LUNAS"
	case "cancelled":
		statusLabel = "DIBATALKAN"
	}
	pdf.SetFont("Arial", "B", 10)
	if billing.Status == "paid" {
		pdf.SetTextColor(0, 128, 0)
	} else if billing.Status == "cancelled" {
		pdf.SetTextColor(255, 0, 0)
	}
	pdf.CellFormat(labelWidth+5+valueWidth, 6, "Status: "+statusLabel, "", 1, "R", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	// Notes
	if billing.Notes != "" {
		pdf.Ln(3)
		pdf.SetFont("Arial", "I", 9)
		pdf.MultiCell(0, 5, "Catatan: "+billing.Notes, "", "", false)
	}

	// Signature section
	pdf.Ln(10)
	pdf.SetFont("Arial", "", 10)
	signDate := formatDateIndonesian(time.Now())
	if billing.FinalizedAt != nil {
		signDate = formatDateIndonesian(*billing.FinalizedAt)
	}
	pdf.SetX(130)
	pdf.CellFormat(60, 5, hospitalInfo.City+", "+signDate, "", 1, "C", false, 0, "")
	pdf.SetX(130)
	pdf.CellFormat(60, 5, "Petugas Kasir,", "", 1, "C", false, 0, "")
	pdf.Ln(15)
	pdf.SetX(130)
	pdf.SetFont("Arial", "B", 10)
	signCashierName := ""
	if billing.FinalizedBy != nil {
		signCashierName = billing.FinalizedBy.FullName
	} else if billing.GeneratedBy != nil {
		signCashierName = billing.GeneratedBy.FullName
	}
	pdf.CellFormat(60, 5, signCashierName, "", 1, "C", false, 0, "")

	// Footer note
	pdf.Ln(5)
	pdf.SetFont("Arial", "I", 8)
	pdf.CellFormat(0, 4, "Dokumen ini dicetak secara otomatis oleh sistem SIMRS.", "", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate PDF"})
		return
	}

	filename := fmt.Sprintf("Kwitansi_%s.pdf", billing.BillingNumber)
	if visitFilter != "" {
		filename = fmt.Sprintf("Kwitansi_%s_visit_%s.pdf", billing.BillingNumber, visitFilter)
	} else if printMode == "per_visit" {
		filename = fmt.Sprintf("Kwitansi_%s_per_kunjungan.pdf", billing.BillingNumber)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// formatCurrency formats number to Indonesian currency format
func printRMDuplicateLabOrderImpl(c *gin.Context) {
	rmOrderID := c.Param("rmOrderId")
	oid, err := strconv.ParseUint(rmOrderID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	serveCachedOrGenerate(c, "rm_dup_lab_order", uint(oid), func() ([]byte, string, error) {
		rmOrder, patient, visit, err := loadRMOrderWithPatient(rmOrderID)
		if err != nil {
			return nil, "", err
		}

		if rmOrder.OrderType != "laboratory" {
			return nil, "", fmt.Errorf("Order bukan tipe laboratorium")
		}

		info := getHospitalInfo()

		pdf := gofpdf.New("P", "mm", "A4", "")
		pdf.SetMargins(marginLeft, marginTop, marginRight)
		pdf.SetAutoPageBreak(false, 0)
		pdf.AddPage()

		addHeader(pdf, info, "Permintaan Pemeriksaan Laboratorium", rmOrder.OrderNumber)
		addRMOrderInfoTable(pdf, patient, rmOrder, visit)

		addTableHeader(pdf, "DAFTAR PEMERIKSAAN")
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(10, 6, "No", "1", 0, "C", true, 0, "")
		pdf.CellFormat(60, 6, "Nama Pemeriksaan", "1", 0, "C", true, 0, "")
		pdf.CellFormat(30, 6, "Kode", "1", 0, "C", true, 0, "")
		pdf.CellFormat(80, 6, "Catatan", "1", 1, "C", true, 0, "")

		pdf.SetFont("Arial", "", 9)
		for i, item := range rmOrder.Items {
			procName := item.ProcedureName
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

		if rmOrder.ClinicalNotes != "" {
			pdf.SetY(pdf.GetY() + 3)
			addTableHeader(pdf, "CATATAN KLINIS")
			addTableFullRow(pdf, rmOrder.ClinicalNotes, false)
			addTableEnd(pdf)
		}

		doctorName := "-"
		if visit != nil && visit.Doctor != nil {
			doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
		}
		addSignature(pdf, info.City, doctorName, "Petugas Laboratorium", models.DocTypeRMDupLabResult, rmOrder.ID)

		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			return nil, "", fmt.Errorf("Gagal generate PDF")
		}

		filename := fmt.Sprintf("Order_Lab_RM_%s.pdf", rmOrder.OrderNumber)
		return buf.Bytes(), filename, nil
	})
}

// PrintRMDuplicateLabResult generates PDF for lab results from RM Duplicate data
func printRMDuplicateLabResultImpl(c *gin.Context) {
	rmOrderID := c.Param("rmOrderId")
	oid, err := strconv.ParseUint(rmOrderID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	serveCachedOrGenerate(c, models.DocTypeRMDupLabResult, uint(oid), func() ([]byte, string, error) {
		rmOrder, patient, visit, err := loadRMOrderWithPatient(rmOrderID)
		if err != nil {
			return nil, "", err
		}

		if rmOrder.OrderType != "laboratory" {
			return nil, "", fmt.Errorf("Order bukan tipe laboratorium")
		}

		info := getHospitalInfo()

		pdf := gofpdf.New("P", "mm", "A4", "")
		pdf.SetMargins(marginLeft, 10, marginRight)
		pdf.SetAutoPageBreak(false, 15)

		for idx, item := range rmOrder.Items {
			pdf.AddPage()
			addHeader(pdf, info, "HASIL PEMERIKSAAN LABORATORIUM", "")
			addRMOrderInfoTable(pdf, patient, rmOrder, visit)

			procName := item.ProcedureName
			if item.Procedure != nil {
				procName = item.Procedure.Name
			}
			addTableHeader(pdf, fmt.Sprintf("PEMERIKSAAN: %s", strings.ToUpper(procName)))

			pdf.SetFont("Arial", "B", 9)
			pdf.SetFillColor(230, 230, 230)
			pdf.CellFormat(60, 7, "Parameter", "1", 0, "C", true, 0, "")
			pdf.CellFormat(35, 7, "Hasil", "1", 0, "C", true, 0, "")
			pdf.CellFormat(20, 7, "Satuan", "1", 0, "C", true, 0, "")
			pdf.CellFormat(45, 7, "Nilai Rujukan", "1", 0, "C", true, 0, "")
			pdf.CellFormat(20, 7, "Ket", "1", 1, "C", true, 0, "")

			pdf.SetFont("Arial", "", 9)
			for _, result := range item.Results {
				paramName := result.ParameterName
				unit := ""
				refRange := ""
				if result.ProcedureParameter != nil {
					paramName = result.ProcedureParameter.Name
					unit = result.ProcedureParameter.Unit
					if result.ProcedureParameter.NormalText != "" {
						refRange = result.ProcedureParameter.NormalText
					} else if result.ProcedureParameter.NormalMin > 0 || result.ProcedureParameter.NormalMax > 0 {
						refRange = formatFloatNoExponent(result.ProcedureParameter.NormalMin) + " - " + formatFloatNoExponent(result.ProcedureParameter.NormalMax)
					}
				}
				if paramName == "" {
					paramName = "-"
				}

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

				if result.IsCritical || result.IsHigh {
					pdf.SetTextColor(255, 0, 0)
				} else if result.IsLow {
					pdf.SetTextColor(0, 0, 255)
				}
				pdf.CellFormat(20, 6, status, "1", 1, "C", false, 0, "")
				pdf.SetTextColor(0, 0, 0)
			}

			if item.Notes != "" {
				pdf.Ln(3)
				pdf.SetFont("Arial", "B", 9)
				pdf.CellFormat(0, 5, "Catatan:", "", 1, "L", false, 0, "")
				pdf.SetFont("Arial", "", 9)
				pdf.MultiCell(0, 5, item.Notes, "", "L", false)
			}

			labSignerName := "-"
			if visit != nil && visit.Doctor != nil {
				labSignerName = resolveAssignedUserNameFromEmployee(visit.Doctor, labSignerName)
			}
			labSigLog, labIsSigned := findSignatureLog(
				signatureLookup{models.DocTypeRMDupLabResult, rmOrder.ID},
			)
			if labIsSigned {
				labSignerName = resolveSignedUserName(labSigLog, labSignerName)
			}

			pdf.Ln(10)
			signY := pdf.GetY()
			pdf.SetFont("Arial", "", 9)
			examDate := formatDateIndonesian(rmOrder.CreatedAt)
			if rmOrder.FakeDate != nil {
				examDate = formatDateIndonesian(*rmOrder.FakeDate)
			}
			pdf.CellFormat(0, 5, fmt.Sprintf("Tanggal Pemeriksaan: %s", examDate), "", 1, "L", false, 0, "")
			pdf.Ln(2)

			labSigX := marginLeft + 120.0
			pdf.SetXY(labSigX, signY+5)
			pdf.SetFont("Arial", "", 9)
			pdf.CellFormat(60, 5, "Petugas Pemeriksa,", "", 1, "C", false, 0, "")
			if labIsSigned {
				addSignatureQR(pdf, labSigLog, labSigX+30, signY+16, 16.0, fmt.Sprintf("lab_%d_%d", rmOrder.ID, idx))
			}
			pdf.SetXY(labSigX, signY+25)
			pdf.SetFont("Arial", "BU", 9)
			pdf.CellFormat(60, 5, labSignerName, "", 1, "C", false, 0, "")

			pdf.SetFont("Arial", "", 8)
			pdf.SetXY(marginLeft, 280)
			pdf.CellFormat(0, 5, fmt.Sprintf("Halaman %d dari %d", idx+1, len(rmOrder.Items)), "", 0, "C", false, 0, "")
		}

		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			return nil, "", fmt.Errorf("Gagal generate PDF")
		}

		filename := fmt.Sprintf("Hasil_Lab_RM_%s.pdf", rmOrder.OrderNumber)
		return buf.Bytes(), filename, nil
	})
}

// PrintRMDuplicateRadiologyResult generates PDF for radiology results from RM Duplicate data
func printRMDuplicateRadiologyResultImpl(c *gin.Context) {
	rmOrderID := c.Param("rmOrderId")
	oid, err := strconv.ParseUint(rmOrderID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	serveCachedOrGenerate(c, models.DocTypeRMDupRadResult, uint(oid), func() ([]byte, string, error) {
		rmOrder, patient, visit, err := loadRMOrderWithPatient(rmOrderID)
		if err != nil {
			return nil, "", err
		}

		if rmOrder.OrderType != "radiology" {
			return nil, "", fmt.Errorf("Order bukan tipe radiologi")
		}

		info := getHospitalInfo()

		pdf := gofpdf.New("P", "mm", "A4", "")
		pdf.SetMargins(marginLeft, 10, marginRight)
		pdf.SetAutoPageBreak(false, 15)

		for idx, item := range rmOrder.Items {
			pdf.AddPage()
			addHeader(pdf, info, "HASIL PEMERIKSAAN RADIOLOGI", "")
			addRMOrderInfoTable(pdf, patient, rmOrder, visit)

			procName := item.ProcedureName
			if item.Procedure != nil {
				procName = item.Procedure.Name
			}
			addTableHeader(pdf, fmt.Sprintf("PEMERIKSAAN: %s", strings.ToUpper(procName)))

			for _, result := range item.Results {
				paramName := result.ParameterName
				if result.ProcedureParameter != nil {
					paramName = result.ProcedureParameter.Name
				}
				if paramName == "" {
					paramName = "-"
				}

				value := "-"
				if result.Value != "" {
					value = result.Value
				}
				addTableMultiRow(pdf, paramName, value, 35)
			}

			if len(item.Results) == 0 {
				if rmOrder.ResultSummary != "" {
					addTableMultiRow(pdf, "Deskripsi", rmOrder.ResultSummary, 35)
				}
				if rmOrder.Conclusion != "" {
					addTableMultiRow(pdf, "Kesan", rmOrder.Conclusion, 35)
				}
				if rmOrder.Suggestion != "" {
					addTableMultiRow(pdf, "Saran", rmOrder.Suggestion, 35)
				}
			}
			addTableEnd(pdf)

			if item.Notes != "" {
				pdf.Ln(2)
				addTableHeader(pdf, "CATATAN")
				addTableMultiRow(pdf, "Catatan", item.Notes, 35)
				addTableEnd(pdf)
			}

			radSignerName := "-"
			if visit != nil && visit.Doctor != nil {
				radSignerName = resolveAssignedUserNameFromEmployee(visit.Doctor, radSignerName)
			}
			radSigLog, radIsSigned := findSignatureLog(
				signatureLookup{models.DocTypeRMDupRadResult, rmOrder.ID},
			)
			if radIsSigned {
				radSignerName = resolveSignedUserName(radSigLog, radSignerName)
			}

			pdf.Ln(10)
			signY := pdf.GetY()
			pdf.SetFont("Arial", "", 9)
			examDate := formatDateIndonesian(rmOrder.CreatedAt)
			if rmOrder.FakeDate != nil {
				examDate = formatDateIndonesian(*rmOrder.FakeDate)
			}
			pdf.CellFormat(0, 5, fmt.Sprintf("Tanggal Pemeriksaan: %s", examDate), "", 1, "L", false, 0, "")
			pdf.Ln(2)

			radSigX := marginLeft + 120.0
			pdf.SetXY(radSigX, signY+5)
			pdf.SetFont("Arial", "", 9)
			pdf.CellFormat(60, 5, "Petugas Pemeriksa,", "", 1, "C", false, 0, "")
			if radIsSigned {
				addSignatureQR(pdf, radSigLog, radSigX+30, signY+16, 16.0, fmt.Sprintf("rad_%d_%d", rmOrder.ID, idx))
			}
			pdf.SetXY(radSigX, signY+25)
			pdf.SetFont("Arial", "BU", 9)
			pdf.CellFormat(60, 5, radSignerName, "", 1, "C", false, 0, "")

			pdf.SetFont("Arial", "", 8)
			pdf.SetXY(marginLeft, 280)
			pdf.CellFormat(0, 5, fmt.Sprintf("Halaman %d dari %d", idx+1, len(rmOrder.Items)), "", 0, "C", false, 0, "")
		}

		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			return nil, "", fmt.Errorf("Gagal generate PDF")
		}

		filename := fmt.Sprintf("Hasil_Radiologi_RM_%s.pdf", rmOrder.OrderNumber)
		return buf.Bytes(), filename, nil
	})
}

// PrintRMDuplicateProcedureResult generates PDF for surgery/consultation results from RM Duplicate data
func printRMDuplicateProcedureResultImpl(c *gin.Context) {
	rmOrderID := c.Param("rmOrderId")
	oid, err := strconv.ParseUint(rmOrderID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	// Determine doc type after loading order — use surgery by default, override below
	// We need to peek at the order type first for correct cache key
	var peekOrder models.EKlaimRMOrder
	if err := database.DB.Select("order_type").First(&peekOrder, oid).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
		return
	}
	cacheDocType := models.DocTypeRMDupSurgeryReport
	if peekOrder.OrderType == "consultation" {
		cacheDocType = models.DocTypeRMDupConsultation
	}

	serveCachedOrGenerate(c, cacheDocType, uint(oid), func() ([]byte, string, error) {
		rmOrder, patient, visit, err := loadRMOrderWithPatient(rmOrderID)
		if err != nil {
			return nil, "", err
		}

		if rmOrder.OrderType != "surgery" && rmOrder.OrderType != "consultation" {
			return nil, "", fmt.Errorf("Order bukan tipe operasi atau konsultasi")
		}

		info := getHospitalInfo()

		pdf := gofpdf.New("P", "mm", "A4", "")
		pdf.SetMargins(marginLeft, 10, marginRight)
		pdf.SetAutoPageBreak(false, 15)
		pdf.AddPage()

		if rmOrder.OrderType == "surgery" {
			addHeader(pdf, info, "CATATAN OPERASI", rmOrder.OrderNumber)
		} else {
			addHeader(pdf, info, "HASIL KONSULTASI", rmOrder.OrderNumber)
		}

		addRMOrderInfoTable(pdf, patient, rmOrder, visit)

		if rmOrder.OrderType == "consultation" {
			addTableHeader(pdf, "KONSULTASI")

			if rmOrder.ConsultantName != "" {
				addTableMultiRow(pdf, "Dokter Konsultan", rmOrder.ConsultantName, 40)
			}
			if rmOrder.Specialty != "" {
				addTableMultiRow(pdf, "Spesialisasi", rmOrder.Specialty, 40)
			}
			if rmOrder.Subjective != "" {
				addTableMultiRow(pdf, "Subjective (S)", rmOrder.Subjective, 40)
			}
			if rmOrder.Objective != "" {
				addTableMultiRow(pdf, "Objective (O)", rmOrder.Objective, 40)
			}
			if rmOrder.Assessment != "" {
				addTableMultiRow(pdf, "Assessment (A)", rmOrder.Assessment, 40)
			}
			if rmOrder.Plan != "" {
				addTableMultiRow(pdf, "Plan (P)", rmOrder.Plan, 40)
			}
			if rmOrder.Recommendation != "" {
				addTableMultiRow(pdf, "Rekomendasi", rmOrder.Recommendation, 40)
			}
			addTableEnd(pdf)
		} else {
			addTableHeader(pdf, "DATA OPERASI")

			if rmOrder.SurgeonName != "" {
				addTableMultiRow(pdf, "Operator", rmOrder.SurgeonName, 40)
			}
			if rmOrder.AnesthesiaType != "" {
				addTableMultiRow(pdf, "Jenis Anestesi", rmOrder.AnesthesiaType, 40)
			}
			if rmOrder.ScheduledDate != nil {
				addTableMultiRow(pdf, "Tanggal Operasi", formatDateIndonesian(*rmOrder.ScheduledDate), 40)
			}

			if len(rmOrder.Items) > 0 {
				addTableEnd(pdf)
				addTableHeader(pdf, "DAFTAR TINDAKAN")
				for i, item := range rmOrder.Items {
					procName := item.ProcedureName
					if item.Procedure != nil {
						procName = item.Procedure.Name
					}
					addTableMultiRow(pdf, fmt.Sprintf("Tindakan %d", i+1), procName, 40)
					if item.Notes != "" {
						addTableMultiRow(pdf, "Catatan", item.Notes, 40)
					}
				}
			}

			if rmOrder.ResultSummary != "" {
				addTableEnd(pdf)
				addTableHeader(pdf, "LAPORAN OPERASI")
				addTableMultiRow(pdf, "Deskripsi", rmOrder.ResultSummary, 40)
			}
			if rmOrder.Conclusion != "" {
				addTableMultiRow(pdf, "Kesimpulan", rmOrder.Conclusion, 40)
			}
			if rmOrder.Suggestion != "" {
				addTableMultiRow(pdf, "Saran", rmOrder.Suggestion, 40)
			}
			addTableEnd(pdf)
		}

		if rmOrder.ClinicalNotes != "" {
			addTableHeader(pdf, "CATATAN KLINIS")
			addTableFullRow(pdf, rmOrder.ClinicalNotes, false)
			addTableEnd(pdf)
		}

		doctorName := "-"
		sigLabel := "Dokter Pemeriksa"
		procSigDocType := models.DocTypeRMDupSurgeryReport
		if rmOrder.OrderType == "consultation" {
			sigLabel = "Dokter Konsultan"
			procSigDocType = models.DocTypeRMDupConsultation
			if rmOrder.ConsultantName != "" {
				doctorName = rmOrder.ConsultantName
			}
		} else if rmOrder.OrderType == "surgery" {
			sigLabel = "Dokter Operator"
			if rmOrder.SurgeonName != "" {
				doctorName = rmOrder.SurgeonName
			}
		}
		if doctorName == "-" && visit != nil && visit.Doctor != nil {
			doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
		}
		addSignature(pdf, info.City, doctorName, sigLabel, procSigDocType, rmOrder.ID)

		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			return nil, "", fmt.Errorf("Gagal generate PDF")
		}

		typeLabel := "Operasi"
		if rmOrder.OrderType == "consultation" {
			typeLabel = "Konsultasi"
		}
		filename := fmt.Sprintf("%s_RM_%s.pdf", typeLabel, rmOrder.OrderNumber)
		return buf.Bytes(), filename, nil
	})
}

// ===========================================================================
// BPJS Document Signature (always shows QR + footer, no SignatureLog needed)
// ===========================================================================

// addBPJSDocSignature adds a signature area with QR code and validation footer
// that is always rendered. It generates a hash from the document number + signer + time
// so the QR code serves as a tamper-evident seal on the document.
func printRMDuplicatePrescriptionImpl(c *gin.Context) {
	rmOrderID := c.Param("rmOrderId")

	// Load the RM order (pharmacy type)
	var rmOrder models.EKlaimRMOrder
	if err := database.DB.First(&rmOrder, rmOrderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "RM Order tidak ditemukan"})
		return
	}
	if rmOrder.OrderType != "pharmacy" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order bukan tipe farmasi"})
		return
	}

	serveCachedOrGenerate(c, models.DocTypeRMDupPrescription, rmOrder.ID, func() ([]byte, string, error) {
		// Load RMDuplicate → Visit → Registration → Patient
		var rmDup models.EKlaimRMDuplicate
		if err := database.DB.
			Preload("Visit.Registration.Patient").
			Preload("Visit.Room").
			Preload("Visit.Doctor").
			First(&rmDup, rmOrder.RMDuplicateID).Error; err != nil {
			return nil, "", fmt.Errorf("RM Duplicate tidak ditemukan")
		}
		if rmDup.Visit == nil || rmDup.Visit.Registration == nil || rmDup.Visit.Registration.Patient == nil {
			return nil, "", fmt.Errorf("Data pasien tidak ditemukan")
		}

		patient := rmDup.Visit.Registration.Patient
		visit := rmDup.Visit

		// Load medicine items linked to this pharmacy order via fake_date
		var items []models.EKlaimRMMedicineItem
		if rmOrder.FakeDate != nil {
			database.DB.
				Where("rm_duplicate_id = ? AND fake_date = ?", rmOrder.RMDuplicateID, *rmOrder.FakeDate).
				Order("sequence ASC, id ASC").
				Find(&items)
		} else {
			database.DB.
				Where("rm_duplicate_id = ?", rmOrder.RMDuplicateID).
				Order("sequence ASC, id ASC").
				Find(&items)
		}

		info := getHospitalInfo()

		orderDate := rmOrder.CreatedAt
		if rmOrder.FakeDate != nil {
			orderDate = *rmOrder.FakeDate
		}

		orderNumber := rmOrder.OrderNumber
		if orderNumber == "" {
			orderNumber = fmt.Sprintf("RX%s%d", orderDate.Format("02012006"), rmOrder.ID)
		}

		pdf := gofpdf.New("P", "mm", "A4", "")
		pdf.SetMargins(marginLeft, marginTop, marginRight)
		pdf.SetAutoPageBreak(false, 0)
		pdf.AddPage()

		addHeader(pdf, info, "Resep Obat", orderNumber)
		addPatientInfoTable(pdf, patient, visit)

		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(0, 5, fmt.Sprintf("Tanggal Order: %s", orderDate.Format("02/01/2006 15:04")), "", 1, "", false, 0, "")
		pdf.Ln(2)

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
		for i, item := range items {
			medName := item.MedicineName
			qty := formatNumber(float64(item.Quantity))
			dosage := item.Dosage
			frequency := item.Frequency
			instruction := item.Instructions
			if instruction == "" {
				instruction = item.Route
			}

			pdf.CellFormat(10, 6, fmt.Sprintf("%d", i+1), "1", 0, "C", false, 0, "")
			pdf.CellFormat(60, 6, truncateText(medName, 35), "1", 0, "", false, 0, "")
			pdf.CellFormat(20, 6, qty, "1", 0, "C", false, 0, "")
			pdf.CellFormat(25, 6, dosage, "1", 0, "C", false, 0, "")
			pdf.CellFormat(25, 6, frequency, "1", 0, "C", false, 0, "")
			pdf.CellFormat(40, 6, truncateText(instruction, 25), "1", 1, "", false, 0, "")
		}

		doctorName := "-"
		if visit.Doctor != nil {
			doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
		}
		addSignature(pdf, info.City, doctorName, "DPJP / Apoteker", models.DocTypeRMDupPrescription, rmOrder.ID)

		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			return nil, "", fmt.Errorf("Gagal generate PDF")
		}

		filename := fmt.Sprintf("Resep_RM_%s.pdf", orderNumber)
		return buf.Bytes(), filename, nil
	})
}

// PrintRMDuplicateBilling generates PDF for billing/rincian biaya from RM Duplicate data
// GET /api/print/rm-duplicate/billing/:rmDuplicateId
func printRMDuplicateBillingImpl(c *gin.Context) {
	rmDuplicateID := c.Param("rmDuplicateId")
	rmDupID, err := strconv.ParseUint(rmDuplicateID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	serveCachedOrGenerate(c, models.DocTypeRMDupBilling, uint(rmDupID), func() ([]byte, string, error) {
		var rmDup models.EKlaimRMDuplicate
		if err := database.DB.
			Preload("Billing.Items", func(db *gorm.DB) *gorm.DB {
				return db.Order("sequence ASC, id ASC")
			}).
			Preload("Visit.Registration.Patient").
			Preload("Visit.Room").
			Preload("Visit.Doctor").
			First(&rmDup, rmDupID).Error; err != nil {
			return nil, "", fmt.Errorf("RM Duplicate tidak ditemukan")
		}

		if rmDup.Billing == nil {
			return nil, "", fmt.Errorf("Billing RM Duplikat tidak ditemukan")
		}
		if rmDup.Visit == nil || rmDup.Visit.Registration == nil || rmDup.Visit.Registration.Patient == nil {
			return nil, "", fmt.Errorf("Data pasien tidak ditemukan")
		}

		billing := rmDup.Billing
		patient := rmDup.Visit.Registration.Patient
		visit := rmDup.Visit
		info := getHospitalInfo()

		pdf := gofpdf.New("P", "mm", "A4", "")
		pdf.SetMargins(15, 15, 15)
		pdf.SetAutoPageBreak(true, 15)
		pdf.AddPage()

		regNumber := ""
		if visit.Registration != nil {
			regNumber = visit.Registration.RegistrationNumber
		}
		addHeader(pdf, info, "RINCIAN BIAYA PELAYANAN", regNumber)

		pdf.SetY(pdf.GetY() + 8)
		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(0, 6, "DATA PASIEN", "", 1, "", false, 0, "")
		pdf.SetFont("Arial", "", 10)

		leftColWidth := 35.0
		rightColWidth := 55.0
		gapWidth := 10.0

		pdf.CellFormat(leftColWidth, 5, "Nama", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(rightColWidth, 5, patient.NamaLengkap, "", 0, "", false, 0, "")
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(gapWidth, 5, "", "", 0, "", false, 0, "")
		pdf.CellFormat(leftColWidth, 5, "No. RM", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(rightColWidth, 5, patient.NoRM, "", 1, "", false, 0, "")

		nik := patient.NIK
		if nik == "" {
			nik = "-"
		}
		pdf.CellFormat(leftColWidth, 5, "NIK", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(rightColWidth, 5, nik, "", 0, "", false, 0, "")
		pdf.CellFormat(gapWidth, 5, "", "", 0, "", false, 0, "")
		pdf.CellFormat(leftColWidth, 5, "No. Registrasi", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(rightColWidth, 5, regNumber, "", 1, "", false, 0, "")

		roomName := "-"
		if visit.Room != nil {
			roomName = visit.Room.Name
		}
		doctorName := "-"
		if visit.Doctor != nil {
			doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, "-")
		}
		pdf.CellFormat(leftColWidth, 5, "Ruangan", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(rightColWidth, 5, roomName, "", 0, "", false, 0, "")
		pdf.CellFormat(gapWidth, 5, "", "", 0, "", false, 0, "")
		pdf.CellFormat(leftColWidth, 5, "Dokter", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 5, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(rightColWidth, 5, truncateText(doctorName, 30), "", 1, "", false, 0, "")

		pdf.Ln(3)

		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(0, 6, "RINCIAN BIAYA", "", 1, "", false, 0, "")

		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(10, 7, "No", "1", 0, "C", true, 0, "")
		pdf.CellFormat(80, 7, "Uraian", "1", 0, "C", true, 0, "")
		pdf.CellFormat(15, 7, "Qty", "1", 0, "C", true, 0, "")
		pdf.CellFormat(35, 7, "Harga Satuan", "1", 0, "C", true, 0, "")
		pdf.CellFormat(40, 7, "Subtotal", "1", 1, "C", true, 0, "")

		itemTypeLabels := map[string]string{
			"procedure":  "Tindakan",
			"medicine":   "Obat",
			"radiology":  "Radiologi",
			"laboratory": "Laboratorium",
			"room":       "Kamar",
			"other":      "Lain-lain",
		}

		itemTypes := []string{"procedure", "radiology", "laboratory", "medicine", "room", "other"}
		pdf.SetFont("Arial", "", 9)
		no := 1
		for _, itemType := range itemTypes {
			var typeItems []models.EKlaimRMBillingItem
			for _, item := range billing.Items {
				if item.ItemType == itemType {
					typeItems = append(typeItems, item)
				}
			}
			if len(typeItems) == 0 {
				continue
			}

			label := itemTypeLabels[itemType]
			if label == "" {
				label = itemType
			}
			pdf.SetFont("Arial", "B", 9)
			pdf.SetFillColor(250, 250, 250)
			pdf.CellFormat(180, 6, label, "1", 1, "L", true, 0, "")
			pdf.SetFont("Arial", "", 9)

			for _, item := range typeItems {
				pdf.CellFormat(10, 6, fmt.Sprintf("%d", no), "1", 0, "C", false, 0, "")
				pdf.CellFormat(80, 6, truncateText(item.Description, 50), "1", 0, "L", false, 0, "")
				pdf.CellFormat(15, 6, formatNumber(float64(item.Quantity)), "1", 0, "C", false, 0, "")
				pdf.CellFormat(35, 6, formatCurrency(item.UnitPrice), "1", 0, "R", false, 0, "")
				pdf.CellFormat(40, 6, formatCurrency(item.Subtotal), "1", 1, "R", false, 0, "")
				no++
			}
		}

		pdf.Ln(2)
		summaryX := 100.0
		labelW := 40.0
		valueW := 40.0

		pdf.SetX(summaryX)
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(labelW, 6, "Total", "0", 0, "R", false, 0, "")
		pdf.CellFormat(5, 6, ":", "0", 0, "C", false, 0, "")
		pdf.CellFormat(valueW, 6, formatCurrency(billing.TotalAmount), "0", 1, "R", false, 0, "")

		if billing.DiscountAmount > 0 {
			pdf.SetX(summaryX)
			pdf.CellFormat(labelW, 6, "Diskon", "0", 0, "R", false, 0, "")
			pdf.CellFormat(5, 6, ":", "0", 0, "C", false, 0, "")
			pdf.SetTextColor(255, 0, 0)
			pdf.CellFormat(valueW, 6, "- "+formatCurrency(billing.DiscountAmount), "0", 1, "R", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
		}

		if billing.AdjustAmount != 0 {
			pdf.SetX(summaryX)
			pdf.CellFormat(labelW, 6, "Penyesuaian", "0", 0, "R", false, 0, "")
			pdf.CellFormat(5, 6, ":", "0", 0, "C", false, 0, "")
			if billing.AdjustAmount < 0 {
				pdf.SetTextColor(255, 0, 0)
			}
			pdf.CellFormat(valueW, 6, formatCurrency(billing.AdjustAmount), "0", 1, "R", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
		}

		pdf.SetX(summaryX)
		pdf.SetFont("Arial", "B", 11)
		pdf.CellFormat(labelW, 8, "GRAND TOTAL", "T", 0, "R", false, 0, "")
		pdf.CellFormat(5, 8, ":", "T", 0, "C", false, 0, "")
		pdf.CellFormat(valueW, 8, formatCurrency(billing.FinalAmount), "T", 1, "R", false, 0, "")

		if billing.Notes != "" {
			pdf.Ln(3)
			pdf.SetFont("Arial", "I", 9)
			pdf.MultiCell(0, 5, "Catatan: "+billing.Notes, "", "", false)
		}

		pdf.Ln(10)
		addSignature(pdf, info.City, doctorName, "DPJP", models.DocTypeRMDupBilling, rmDup.ID)

		pdf.Ln(5)
		pdf.SetFont("Arial", "I", 8)
		pdf.CellFormat(0, 4, "Dokumen ini dicetak secara otomatis oleh sistem SIMRS.", "", 1, "C", false, 0, "")

		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			return nil, "", fmt.Errorf("Gagal generate PDF")
		}

		filename := fmt.Sprintf("Rincian_Biaya_RM_%d.pdf", billing.ID)
		return buf.Bytes(), filename, nil
	})
}
