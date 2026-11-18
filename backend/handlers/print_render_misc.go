package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"net/http"
	"os"
	"path/filepath"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
	"time"
)

func printQueueTicketImpl(c *gin.Context) {
	queueID := c.Param("queueId")

	var queue models.RoomQueue
	if err := database.DB.
		Preload("Room").
		Preload("Visit.Registration.Patient").
		Preload("Visit.Doctor").
		First(&queue, queueID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Queue not found"})
		return
	}

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create custom size PDF (100mm x 90mm - increased height for better layout)
	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr: "mm",
		Size:    gofpdf.SizeType{Wd: 100, Ht: 90},
	})
	pdf.SetMargins(3, 3, 3)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	contentWidth := 94.0 // 100 - 6 margin

	// Add thermal header with KOP
	currentY := addThermalHeader(pdf, hospitalInfo, "")
	pdf.SetY(currentY + 2)

	// Room Name
	roomName := "-"
	if queue.Room != nil {
		roomName = queue.Room.Name
	}
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(contentWidth, 6, strings.ToUpper(roomName), "", 1, "C", false, 0, "")
	pdf.Ln(2)

	// Queue Number (Large - bigger font)
	pdf.SetFont("Arial", "B", 48)
	pdf.CellFormat(contentWidth, 22, queue.QueueNumber, "", 1, "C", false, 0, "")
	pdf.Ln(2)

	// Priority badge if urgent/emergency
	if queue.Priority != "" && queue.Priority != "normal" {
		priorityLabel := strings.ToUpper(queue.Priority)
		if queue.Priority == "urgent" {
			priorityLabel = "MENDESAK"
		} else if queue.Priority == "emergency" {
			priorityLabel = "DARURAT"
		}
		pdf.SetFont("Arial", "B", 10)
		pdf.SetFillColor(255, 200, 200)
		pdf.CellFormat(contentWidth, 5, priorityLabel, "", 1, "C", true, 0, "")
		pdf.Ln(1)
	}

	// Divider
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetDashPattern([]float64{1, 1}, 0)
	pdf.Line(3, pdf.GetY(), 97, pdf.GetY())
	pdf.SetDashPattern([]float64{}, 0)
	pdf.Ln(2)

	// Patient info
	patientName := "-"
	noRM := "-"
	if queue.Visit != nil && queue.Visit.Registration != nil && queue.Visit.Registration.Patient != nil {
		patientName = queue.Visit.Registration.Patient.NamaLengkap
		noRM = queue.Visit.Registration.Patient.NoRM
	}

	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(15, 4, "Nama", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(76, 4, patientName, "", 1, "L", false, 0, "")

	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(15, 4, "No. RM", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(76, 4, noRM, "", 1, "L", false, 0, "")

	// Date time
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(15, 4, "Waktu", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.CellFormat(76, 4, formatDateIndonesian(queue.CreatedAt)+", "+queue.CreatedAt.Format("15:04"), "", 1, "L", false, 0, "")

	// Divider
	pdf.Ln(1)
	pdf.SetDashPattern([]float64{1, 1}, 0)
	pdf.Line(3, pdf.GetY(), 97, pdf.GetY())
	pdf.SetDashPattern([]float64{}, 0)
	pdf.Ln(2)

	// Footer message
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(contentWidth, 3, "Mohon menunggu panggilan di layar display", "", 1, "C", false, 0, "")
	pdf.CellFormat(contentWidth, 3, "Terima kasih", "", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Tiket_Antrian_%s.pdf", queue.QueueNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintKioskTicket generates a queue ticket for Kiosk (models.Queue)
func PrintKioskTicket(c *gin.Context) {
	queueID := c.Param("queueId")

	var queue models.Queue
	if err := database.DB.Preload("Counter").First(&queue, queueID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Queue not found"})
		return
	}

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr: "mm",
		Size:    gofpdf.SizeType{Wd: 100, Ht: 90},
	})
	pdf.SetMargins(3, 3, 3)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	contentWidth := 94.0

	// Add thermal header with KOP
	currentY := addThermalHeader(pdf, hospitalInfo, "")
	pdf.SetY(currentY + 2)

	// Counter/Type
	counterName := "PENDAFTARAN"
	if queue.Counter != nil {
		counterName = queue.Counter.Name
	}
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(contentWidth, 6, strings.ToUpper(counterName), "", 1, "C", false, 0, "")
	pdf.Ln(2)

	// Queue Number (Large)
	pdf.SetFont("Arial", "B", 48)
	pdf.CellFormat(contentWidth, 22, queue.QueueNumber, "", 1, "C", false, 0, "")
	pdf.Ln(2)

	// Additional text
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(contentWidth, 5, "Silakan menunggu hingga nomor Anda dipanggil", "", 1, "C", false, 0, "")
	pdf.Ln(4)

	// Date and time
	pdf.SetFont("Arial", "", 9)
	dateStr := formatDateIndonesian(queue.CreatedAt) + ", " + queue.CreatedAt.Format("15:04")
	pdf.CellFormat(contentWidth, 4, dateStr, "", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Tiket_Kiosk_%s.pdf", queue.QueueNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}


// PrintRegistrationTicket generates a queue ticket based on registration ID
func printRegistrationTicketImpl(c *gin.Context) {
	registrationID := c.Param("registrationId")

	// Load registration with relations
	var registration models.Registration
	if err := database.DB.
		Preload("Patient").
		Preload("Queue").
		Preload("DestinationRoom").
		Preload("Doctor").
		Preload("Visit.RoomQueue").
		First(&registration, registrationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create custom size PDF (100mm x 90mm)
	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr: "mm",
		Size:    gofpdf.SizeType{Wd: 100, Ht: 90},
	})
	pdf.SetMargins(3, 3, 3)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	contentWidth := 94.0 // 100 - 6 margin

	// Add thermal header with KOP
	currentY := addThermalHeader(pdf, hospitalInfo, "")
	pdf.SetY(currentY + 2)

	// Room Name
	roomName := "-"
	if registration.DestinationRoom != nil {
		roomName = registration.DestinationRoom.Name
	}
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(contentWidth, 6, strings.ToUpper(roomName), "", 1, "C", false, 0, "")
	pdf.Ln(2)

	// Queue Number (prefer loket Queue, then RoomQueue e.g. MJKN, then RegistrationNumber)
	queueNumber := "-"
	if registration.Queue != nil && registration.Queue.QueueNumber != "" {
		queueNumber = registration.Queue.QueueNumber
	} else if registration.Visit != nil && registration.Visit.RoomQueue != nil && registration.Visit.RoomQueue.QueueNumber != "" {
		queueNumber = registration.Visit.RoomQueue.QueueNumber
	} else {
		// Use registration number as fallback
		queueNumber = registration.RegistrationNumber
	}
	pdf.SetFont("Arial", "B", 48)
	pdf.CellFormat(contentWidth, 22, queueNumber, "", 1, "C", false, 0, "")
	pdf.Ln(2)

	// Registration type badge
	if registration.RegistrationType == "emergency" {
		pdf.SetFont("Arial", "B", 10)
		pdf.SetFillColor(255, 200, 200)
		pdf.CellFormat(contentWidth, 5, "GAWAT DARURAT", "", 1, "C", true, 0, "")
		pdf.Ln(1)
	}

	// Divider
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetDashPattern([]float64{1, 1}, 0)
	pdf.Line(3, pdf.GetY(), 97, pdf.GetY())
	pdf.SetDashPattern([]float64{}, 0)
	pdf.Ln(2)

	// Patient info
	patientName := "-"
	noRM := "-"
	if registration.Patient != nil {
		patientName = registration.Patient.NamaLengkap
		noRM = registration.Patient.NoRM
	}

	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(15, 4, "Nama", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(76, 4, patientName, "", 1, "L", false, 0, "")

	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(15, 4, "No. RM", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(76, 4, noRM, "", 1, "L", false, 0, "")

	// Date time
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(15, 4, "Waktu", "", 0, "L", false, 0, "")
	pdf.CellFormat(3, 4, ":", "", 0, "L", false, 0, "")
	pdf.CellFormat(76, 4, formatDateIndonesian(registration.CreatedAt)+", "+registration.CreatedAt.Format("15:04"), "", 1, "L", false, 0, "")

	// Divider
	pdf.Ln(1)
	pdf.SetDashPattern([]float64{1, 1}, 0)
	pdf.Line(3, pdf.GetY(), 97, pdf.GetY())
	pdf.SetDashPattern([]float64{}, 0)
	pdf.Ln(2)

	// Footer message
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(contentWidth, 3, "Mohon menunggu panggilan di layar display", "", 1, "C", false, 0, "")
	pdf.CellFormat(contentWidth, 3, "Terima kasih", "", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Tiket_Registrasi_%s.pdf", registration.RegistrationNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// ===========================================================================
// F2. ETIKET OBAT (100mm x 40mm Thermal)
// ===========================================================================

// PrintMedicineLabel generates a thermal medicine label (100mm x 50mm)
func printMedicineLabelImpl(c *gin.Context) {
	itemID := c.Param("itemId")

	var item models.MedicineOrderItem
	if err := database.DB.
		Preload("Medicine").
		Preload("MedicineBatch").
		Preload("MedicineOrder.Registration.Patient").
		First(&item, itemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order item not found"})
		return
	}

	// Get patient info
	patientName := "-"
	noRM := "-"
	if item.MedicineOrder != nil && item.MedicineOrder.Registration != nil && item.MedicineOrder.Registration.Patient != nil {
		patientName = item.MedicineOrder.Registration.Patient.NamaLengkap
		noRM = item.MedicineOrder.Registration.Patient.NoRM
	}

	// Generate single label
	// If item is part of a racikan group, load all components in that racikan group
	items := []models.MedicineOrderItem{item}
	if (item.ItemType == models.MedicineOrderItemTypeRacikan || item.ItemType == "racikan") && item.RacikanGroup != "" && item.MedicineOrderID > 0 {
		var siblingItems []models.MedicineOrderItem
		if err := database.DB.
			Preload("Medicine").
			Preload("MedicineBatch").
			Preload("MedicineOrder.Registration.Patient").
			Where("medicine_order_id = ? AND racikan_group = ? AND status != ?", item.MedicineOrderID, item.RacikanGroup, models.ItemStatusCancelled).
			Find(&siblingItems).Error; err == nil && len(siblingItems) > 0 {
			items = siblingItems
		}
	}

	pdf := generateMedicineLabelPDF(items, patientName, noRM)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	medicineName := "Obat"
	if (item.ItemType == models.MedicineOrderItemTypeRacikan || item.ItemType == "racikan") && item.RacikanName != "" {
		medicineName = item.RacikanName
	} else if item.Medicine != nil {
		medicineName = item.Medicine.Name
	}
	filename := fmt.Sprintf("Etiket_%s.pdf", strings.ReplaceAll(medicineName, " ", "_"))
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintMedicineLabels generates thermal medicine labels for all items in an order (100mm x 50mm each)
func printMedicineLabelsImpl(c *gin.Context) {
	orderID := c.Param("orderId")

	var order models.MedicineOrder
	if err := database.DB.
		Preload("Items.Medicine").
		Preload("Items.MedicineBatch").
		Preload("Registration.Patient").
		First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	items := order.Items
	version := strings.ToLower(strings.TrimSpace(c.Query("version")))
	if version == "doctor" && order.DoctorItemsJSON != "" {
		var snapshots []models.DoctorOrderItemSnapshot
		if err := json.Unmarshal([]byte(order.DoctorItemsJSON), &snapshots); err == nil && len(snapshots) > 0 {
			var doctorItems []models.MedicineOrderItem
			for _, snap := range snapshots {
				doctorItems = append(doctorItems, models.MedicineOrderItem{
					MedicineID: snap.MedicineID,
					Medicine: &models.Medicine{
						ID:   snap.MedicineID,
						Name: snap.MedicineName,
						Code: snap.MedicineCode,
					},
					ItemType:     snap.ItemType,
					RacikanGroup: snap.RacikanGroup,
					RacikanName:  snap.RacikanName,
					RacikanType:  snap.RacikanType,
					RacikanQty:   snap.RacikanQty,
					RacikanUnit:  snap.RacikanUnit,
					Quantity:     snap.Quantity,
					Unit:         snap.Unit,
					Dosage:       snap.Dosage,
					Frequency:    snap.Frequency,
					Route:        snap.Route,
					Duration:     snap.Duration,
					Instructions: snap.Instructions,
					Notes:        snap.Notes,
					Status:       models.ItemStatusOrdered,
				})
			}
			items = doctorItems
		}
	}

	if len(items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No items in order"})
		return
	}

	// Link order reference to items if not set
	for i := range items {
		if items[i].MedicineOrder == nil {
			items[i].MedicineOrder = &order
		}
	}

	// Get patient info from order
	patientName := "-"
	noRM := "-"
	if order.Registration != nil && order.Registration.Patient != nil {
		patientName = order.Registration.Patient.NamaLengkap
		noRM = order.Registration.Patient.NoRM
	}

	// Generate labels for all items
	pdf := generateMedicineLabelPDF(items, patientName, noRM)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Etiket_Obat_%s.pdf", order.OrderNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// formatMedicineSigna formats medicine instructions and eliminates duplication
func formatMedicineSigna(dosage, frequency, instructions, medicineName string) string {
	dosage = strings.TrimSpace(dosage)
	frequency = strings.TrimSpace(frequency)
	instructions = strings.TrimSpace(instructions)
	if dosage == "-" {
		dosage = ""
	}
	if frequency == "-" {
		frequency = ""
	}
	if instructions == "-" {
		instructions = ""
	}
	medLower := strings.ToLower(medicineName)

	// If frequency and instructions are identical (case-insensitive), drop instructions
	if strings.EqualFold(frequency, instructions) {
		instructions = ""
	}

	// If one contains the other, keep only the longer one
	if frequency != "" && instructions != "" {
		fLower := strings.ToLower(frequency)
		iLower := strings.ToLower(instructions)
		if strings.Contains(iLower, fLower) {
			frequency = ""
		} else if strings.Contains(fLower, iLower) {
			instructions = ""
		}
	}

	var parts []string

	// If dosage is just medicine strength already in the medicine name (e.g. "1mg" in "Alprazolam 1mg"), skip it
	if dosage != "" {
		dLower := strings.ToLower(dosage)
		alreadyInName := strings.Contains(medLower, dLower)
		alreadyInFreq := frequency != "" && strings.Contains(strings.ToLower(frequency), dLower)
		alreadyInInstr := instructions != "" && strings.Contains(strings.ToLower(instructions), dLower)
		if !alreadyInName && !alreadyInFreq && !alreadyInInstr {
			parts = append(parts, dosage)
		}
	}

	if frequency != "" {
		parts = append(parts, frequency)
	}
	if instructions != "" {
		parts = append(parts, instructions)
	}

	result := strings.Join(parts, " - ")
	if result == "" {
		result = "....... X ....... Tab/Kap/Bungkus"
	}
	return result
}

// generateMedicineLabelPDF creates a PDF with medicine labels (each item on separate page)
func generateMedicineLabelPDFImpl(items []models.MedicineOrderItem, patientName, noRM string) *gofpdf.Fpdf {
	// Get hospital info for header
	hospitalInfo := getHospitalInfo()

	// Create custom size PDF (100mm x 50mm per page)
	pageWidth := 100.0
	pageHeight := 50.0

	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr: "mm",
		Size:    gofpdf.SizeType{Wd: pageWidth, Ht: pageHeight},
	})
	pdf.SetMargins(2, 2, 2)
	pdf.SetAutoPageBreak(false, 0)

	contentWidth := 96.0
	marginL := 2.0
	marginT := 2.0

	// Group items: consolidate racikan components under the same group into one label
	type labelGroupItem struct {
		IsRacikan    bool
		RacikanGroup string
		RacikanName  string
		RacikanType  string
		RacikanQty   int
		RacikanUnit  string
		Components   []models.MedicineOrderItem
		PrimaryItem  models.MedicineOrderItem
	}

	var groups []labelGroupItem
	racikanMap := make(map[string]int)

	for _, item := range items {
		// Skip cancelled items
		if item.Status == models.ItemStatusCancelled {
			continue
		}

		isRacikan := item.ItemType == models.MedicineOrderItemTypeRacikan || item.ItemType == "racikan"
		groupKey := strings.TrimSpace(item.RacikanGroup)
		if isRacikan && groupKey == "" && strings.TrimSpace(item.RacikanName) != "" {
			groupKey = "name:" + strings.ToLower(strings.TrimSpace(item.RacikanName))
		}

		if isRacikan && groupKey != "" {
			if idx, exists := racikanMap[groupKey]; exists {
				groups[idx].Components = append(groups[idx].Components, item)
				if groups[idx].RacikanName == "" && item.RacikanName != "" {
					groups[idx].RacikanName = item.RacikanName
				}
				if groups[idx].RacikanType == "" && item.RacikanType != "" {
					groups[idx].RacikanType = item.RacikanType
				}
				if groups[idx].RacikanQty <= 0 && item.RacikanQty > 0 {
					groups[idx].RacikanQty = item.RacikanQty
				}
				if groups[idx].RacikanUnit == "" && item.RacikanUnit != "" {
					groups[idx].RacikanUnit = item.RacikanUnit
				}
			} else {
				ng := labelGroupItem{
					IsRacikan:    true,
					RacikanGroup: groupKey,
					RacikanName:  item.RacikanName,
					RacikanType:  item.RacikanType,
					RacikanQty:   item.RacikanQty,
					RacikanUnit:  item.RacikanUnit,
					Components:   []models.MedicineOrderItem{item},
					PrimaryItem:  item,
				}
				groups = append(groups, ng)
				racikanMap[groupKey] = len(groups) - 1
			}
		} else {
			groups = append(groups, labelGroupItem{
				IsRacikan:   false,
				PrimaryItem: item,
			})
		}
	}

	for _, group := range groups {
		item := group.PrimaryItem
		// Skip cancelled items
		if item.Status == models.ItemStatusCancelled {
			continue
		}
		// Add new page for each medicine
		pdf.AddPage()

		// Outer Border box (100x50 minus 2mm margin all sides = 96x46)
		pdf.SetDrawColor(0, 0, 0)
		pdf.SetLineWidth(0.3)
		pdf.Rect(marginL, marginT, contentWidth, pageHeight-4, "D")

		// === TOP SECTION: KOP (Centered Header with optional Logo) ===
		logoWidth := 9.0
		logoX := marginL + 2.0
		logoY := marginT + 1.0
		hasLogo := false

		if hospitalInfo.Logo != "" {
			logoFile := strings.TrimPrefix(hospitalInfo.Logo, "/")
			logoFile = strings.TrimPrefix(logoFile, "uploads/")
			logoPath := filepath.Join("uploads", logoFile)
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
					pdf.Image(logoPath, logoX, logoY, logoWidth, logoWidth, false, imgType, 0, "")
					hasLogo = true
				}
			}
		}

		textStartX := marginL + 1.0
		textWidth := contentWidth - 2.0
		if hasLogo {
			textStartX = logoX + logoWidth + 2.0
			textWidth = contentWidth - (logoWidth + 4.0)
		}

		hospitalTitle := hospitalInfo.Name
		if hospitalTitle == "" {
			hospitalTitle = "KLINIK KEDUNGADEM"
		}

		titleFontSize := 8.0
		titleLineH := 3.0
		if len(hospitalTitle) > 30 {
			titleFontSize = 7.5
			titleLineH = 2.8
		}

		pdf.SetFont("Arial", "B", titleFontSize)
		pdf.SetXY(textStartX, marginT+1.0)
		pdf.MultiCell(textWidth, titleLineH, strings.ToUpper(hospitalTitle), "", "C", false)

		address := hospitalInfo.Address
		if hospitalInfo.City != "" {
			if address != "" {
				address += ", " + hospitalInfo.City
			} else {
				address = hospitalInfo.City
			}
		}
		if hospitalInfo.Phone != "" {
			if address != "" {
				address += " | Telp: " + hospitalInfo.Phone
			} else {
				address = "Telp: " + hospitalInfo.Phone
			}
		}
		if address != "" {
			pdf.SetFont("Arial", "", 4.8)
			pdf.SetXY(textStartX, pdf.GetY()+0.2)
			pdf.MultiCell(textWidth, 2.0, address, "", "C", false)
		}

		// Horizontal Divider under KOP (ensuring divider line is placed below all header text)
		dividerY := 14.5
		if pdf.GetY()+0.6 > dividerY {
			dividerY = pdf.GetY() + 0.6
		}
		pdf.SetLineWidth(0.3)
		pdf.Line(marginL, dividerY, marginL+contentWidth, dividerY)

		// === CONTENT SECTION ===
		contentY := dividerY + 1.2

		// 1. Tanggal (Top Right under divider)
		orderDateStr := time.Now().Format("02/01/2006")
		if item.MedicineOrder != nil && !item.MedicineOrder.CreatedAt.IsZero() {
			orderDateStr = item.MedicineOrder.CreatedAt.Format("02/01/2006")
		}
		pdf.SetFont("Arial", "", 7)
		pdf.SetXY(marginL+contentWidth-45.0, contentY)
		pdf.CellFormat(43.0, 3.5, "Tgl: "+orderDateStr, "", 0, "R", false, 0, "")

		// Medicine & Qty preparation
		medicineName := "-"
		if group.IsRacikan {
			racTitle := strings.TrimSpace(group.RacikanName)
			if racTitle == "" {
				racTitle = "Obat Racikan"
			}
			if group.RacikanType != "" && !strings.Contains(strings.ToLower(racTitle), strings.ToLower(group.RacikanType)) {
				racTitle = fmt.Sprintf("%s (%s)", racTitle, group.RacikanType)
			}
			medicineName = racTitle
		} else if item.ItemType == models.MedicineOrderItemTypeRacikan && item.RacikanName != "" {
			medicineName = item.RacikanName
		} else if item.Medicine != nil {
			medicineName = item.Medicine.Name
		}

		qty := item.Quantity
		unit := item.Unit
		if group.IsRacikan {
			if group.RacikanQty > 0 {
				qty = group.RacikanQty
			}
			if group.RacikanUnit != "" {
				unit = group.RacikanUnit
			}
		} else if item.ItemType == models.MedicineOrderItemTypeRacikan && item.RacikanQty > 0 {
			qty = item.RacikanQty
			if item.RacikanUnit != "" {
				unit = item.RacikanUnit
			}
		}
		qtyInfo := fmt.Sprintf("%s %s", formatNumber(float64(qty)), unit)

		// Expired Date (ED)
		edStr := "-"
		if group.IsRacikan {
			var earliestED *time.Time
			for _, comp := range group.Components {
				var compED *time.Time
				if comp.MedicineBatch != nil && !comp.MedicineBatch.ExpiryDate.IsZero() {
					t := comp.MedicineBatch.ExpiryDate
					compED = &t
				} else if comp.MedicineID > 0 {
					var batch models.MedicineBatch
					if err := database.DB.Where("medicine_id = ? AND remaining_qty > 0 AND expiry_date >= ?", comp.MedicineID, time.Now()).Order("expiry_date ASC").First(&batch).Error; err == nil {
						t := batch.ExpiryDate
						compED = &t
					}
				}
				if compED != nil {
					if earliestED == nil || compED.Before(*earliestED) {
						earliestED = compED
					}
				}
			}
			if earliestED != nil {
				edStr = earliestED.Format("02/01/2006")
			}
		} else if item.MedicineBatch != nil && !item.MedicineBatch.ExpiryDate.IsZero() {
			edStr = item.MedicineBatch.ExpiryDate.Format("02/01/2006")
		} else if item.MedicineID > 0 {
			var batch models.MedicineBatch
			if err := database.DB.Where("medicine_id = ? AND remaining_qty > 0 AND expiry_date >= ?", item.MedicineID, time.Now()).Order("expiry_date ASC").First(&batch).Error; err == nil {
				edStr = batch.ExpiryDate.Format("02/01/2006")
			} else if err := database.DB.Where("medicine_id = ?", item.MedicineID).Order("expiry_date DESC").First(&batch).Error; err == nil {
				edStr = batch.ExpiryDate.Format("02/01/2006")
			}
		}

		// Aturan Pakai / Signa (clean & deduplicated)
		dosageForSigna := item.Dosage
		if group.IsRacikan {
			dosageForSigna = ""
		}
		instructions := formatMedicineSigna(dosageForSigna, item.Frequency, item.Instructions, medicineName)

		textX := marginL + 2.5

		// Row 1: Nama
		pdf.SetFont("Arial", "", 7.5)
		pdf.SetXY(textX, contentY)
		pdf.CellFormat(16, 3.5, "Nama", "", 0, "L", false, 0, "")
		pdf.CellFormat(2.5, 3.5, ":", "", 0, "C", false, 0, "")
		pdf.SetFont("Arial", "B", 7.5)
		pdf.CellFormat(36, 3.5, truncateString(patientName, 32), "", 1, "L", false, 0, "")

		// Row 2: No. RM
		contentY += 3.8
		pdf.SetFont("Arial", "", 7.5)
		pdf.SetXY(textX, contentY)
		pdf.CellFormat(16, 3.5, "No. RM", "", 0, "L", false, 0, "")
		pdf.CellFormat(2.5, 3.5, ":", "", 0, "C", false, 0, "")
		pdf.SetFont("Arial", "B", 7.5)
		pdf.CellFormat(36, 3.5, noRM, "", 1, "L", false, 0, "")

		// Row 3: Obat
		contentY += 3.8
		pdf.SetFont("Arial", "", 7.5)
		pdf.SetXY(textX, contentY)
		pdf.CellFormat(16, 3.8, "Obat", "", 0, "L", false, 0, "")
		pdf.CellFormat(2.5, 3.8, ":", "", 0, "C", false, 0, "")
		pdf.SetFont("Arial", "B", 8)
		pdf.MultiCell(contentWidth-21.0, 3.8, truncateString(medicineName, 55), "", "L", false)
		if pdf.GetY() > contentY+3.8 {
			contentY = pdf.GetY()
		} else {
			contentY += 3.8
		}

		// Row 4: Jumlah & ED
		contentY += 0.3
		pdf.SetFont("Arial", "", 7.5)
		pdf.SetXY(textX, contentY)
		pdf.CellFormat(16, 3.5, "Jumlah", "", 0, "L", false, 0, "")
		pdf.CellFormat(2.5, 3.5, ":", "", 0, "C", false, 0, "")
		pdf.SetFont("Arial", "B", 7.5)
		pdf.CellFormat(26, 3.5, qtyInfo, "", 0, "L", false, 0, "")

		pdf.SetFont("Arial", "", 7.5)
		pdf.SetXY(52.0, contentY)
		pdf.CellFormat(8, 3.5, "ED", "", 0, "L", false, 0, "")
		pdf.CellFormat(2.5, 3.5, ":", "", 0, "C", false, 0, "")
		pdf.SetFont("Arial", "B", 7.5)
		pdf.CellFormat(32, 3.5, edStr, "", 1, "L", false, 0, "")

		// Separator line before Aturan Pakai
		lineY := contentY + 3.2
		if lineY > 37.5 {
			lineY = 37.5
		}
		contentY = lineY
		pdf.SetLineWidth(0.15)
		pdf.Line(marginL+2.0, contentY, marginL+contentWidth-2.0, contentY)

		// Row 5: Aturan Pakai -> Signa
		contentY += 0.8
		pdf.SetFont("Arial", "B", 7.5)
		pdf.SetXY(textX, contentY)
		pdf.CellFormat(21, 4.0, "Aturan Pakai", "", 0, "L", false, 0, "")
		pdf.CellFormat(2.5, 4.0, ":", "", 0, "C", false, 0, "")
		pdf.SetFont("Arial", "B", 8.5)
		pdf.SetXY(textX+23.5, contentY)
		pdf.MultiCell(contentWidth-26.0, 4.0, instructions, "", "L", false)
	}

	return pdf
}

// ===========================================================================
// F3. RESEP OBAT THERMAL (100mm width)
// ===========================================================================

// PrintPrescriptionThermal generates a thermal prescription (100mm width) for patient
func printDPJPRequestImpl(c *gin.Context) {
	visitID := c.Param("visitId")

	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Registration.DestinationRoom").
		Preload("Registration.Doctor").
		Preload("Room").
		Preload("Doctor").
		Preload("Bed.RoomUnit").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}
	patient := visit.Registration.Patient
	registration := visit.Registration

	// DPJP
	dpjpName := "-"
	if visit.Doctor != nil {
		dpjpName = resolveAssignedUserNameFromEmployee(visit.Doctor, dpjpName)
	} else if registration.Doctor != nil {
		dpjpName = resolveAssignedUserNameFromEmployee(registration.Doctor, dpjpName)
	}

	// Visit type label
	visitTypeLabel := visit.VisitType
	switch visit.VisitType {
	case "outpatient", "consultation":
		visitTypeLabel = "Rawat Jalan"
	case "inpatient":
		visitTypeLabel = "Rawat Inap"
	case "emergency":
		visitTypeLabel = "Gawat Darurat (IGD)"
	}

	// Room
	roomName := "-"
	if visit.Room != nil {
		roomName = visit.Room.Name
	}

	// Bed
	bedName := ""
	if visit.Bed != nil {
		if visit.Bed.RoomUnit != nil {
			bedName = visit.Bed.RoomUnit.Name + " - "
		}
		bedName += visit.Bed.BedNumber
	}

	// Inpatient class
	kelasRawat := ""
	if visit.InpatientClass != "" {
		kelasRawat = formatInpatientClass(visit.InpatientClass)
	}

	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(true, marginBottom)
	pdf.AddPage()

	addHeader(pdf, hospitalInfo, "FORMULIR PERMOHONAN", "DPJP (Dokter Penanggung Jawab Pasien)")

	// DATA PASIEN
	col1 := 40.0
	col2 := 50.0
	col3 := 35.0
	col4 := 55.0

	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA PASIEN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)

	// Row 1: No RM | JK
	pdf.CellFormat(col1, rowHeight, " No. Rekam Medis", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(col2, rowHeight, " "+patient.NoRM, "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowHeight, " Jenis Kelamin", "1", 0, "L", true, 0, "")
	gender := string(patient.JenisKelamin)
	if gender == "L" {
		gender = "Laki-laki"
	} else if gender == "P" {
		gender = "Perempuan"
	}
	pdf.CellFormat(col4, rowHeight, " "+gender, "1", 1, "L", false, 0, "")

	// Row 2: Nama | TTL
	pdf.CellFormat(col1, rowHeight, " Nama Lengkap", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(col2, rowHeight, " "+truncateText(patient.NamaLengkap, 28), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowHeight, " Tanggal Lahir", "1", 0, "L", true, 0, "")
	birthDate := "-"
	age := ""
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = patient.TanggalLahir.Format("02-01-2006")
		age = fmt.Sprintf(" (%d th)", calculateAgeYears(patient.TanggalLahir.Time))
	}
	pdf.CellFormat(col4, rowHeight, " "+birthDate+age, "1", 1, "L", false, 0, "")

	// Row 3: Alamat
	pdf.CellFormat(col1, rowHeight, " Alamat", "1", 0, "L", true, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+truncateText(alamat, 72), "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 3)

	// DATA PELAYANAN
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA PELAYANAN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)

	pdf.CellFormat(col1, rowHeight, " No. Registrasi", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2, rowHeight, " "+registration.RegistrationNumber, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " No. Kunjungan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col4, rowHeight, " "+visit.VisitNumber, "1", 1, "L", false, 0, "")

	pdf.CellFormat(col1, rowHeight, " Jenis Pelayanan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2, rowHeight, " "+visitTypeLabel, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Ruangan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col4, rowHeight, " "+truncateText(roomName, 28), "1", 1, "L", false, 0, "")

	if bedName != "" {
		pdf.CellFormat(col1, rowHeight, " Tempat Tidur", "1", 0, "L", true, 0, "")
		pdf.CellFormat(col2, rowHeight, " "+truncateText(bedName, 28), "1", 0, "L", false, 0, "")
		pdf.CellFormat(col3, rowHeight, " Kelas Rawat", "1", 0, "L", true, 0, "")
		pdf.CellFormat(col4, rowHeight, " "+kelasRawat, "1", 1, "L", false, 0, "")
	}

	// Tanggal masuk
	masukDate := visit.CreatedAt.Format("02 Januari 2006, 15:04 WIB")
	if visit.CheckInTime != nil {
		masukDate = visit.CheckInTime.Format("02 Januari 2006, 15:04 WIB")
	} else if visit.AdmissionTime != nil {
		masukDate = visit.AdmissionTime.Format("02 Januari 2006, 15:04 WIB")
	}
	pdf.CellFormat(col1, rowHeight, " Tanggal Masuk", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+masukDate, "1", 1, "L", false, 0, "")

	// Keluhan
	complaint := visit.Complaint
	if complaint == "" {
		complaint = registration.Complaint
	}
	if complaint == "" {
		complaint = "-"
	}
	pdf.CellFormat(col1, rowHeight, " Keluhan Utama", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+truncateText(complaint, 72), "1", 1, "L", false, 0, "")

	// Pembayaran
	paymentLabel := strings.ToUpper(registration.PaymentMethod)
	if paymentLabel == "" {
		paymentLabel = "UMUM"
	}
	noBpjs := registration.BPJSNumber
	if noBpjs == "" {
		noBpjs = patient.NoBPJS
	}
	pdf.CellFormat(col1, rowHeight, " Jaminan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2, rowHeight, " "+paymentLabel, "1", 0, "L", false, 0, "")
	if noBpjs != "" {
		pdf.CellFormat(col3, rowHeight, " No. BPJS", "1", 0, "L", true, 0, "")
		pdf.CellFormat(col4, rowHeight, " "+noBpjs, "1", 1, "L", false, 0, "")
	} else {
		pdf.CellFormat(col3+col4, rowHeight, "", "1", 1, "L", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 3)

	// PERMOHONAN DPJP
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(60, 60, 60)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetDrawColor(60, 60, 60)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " PERMOHONAN DPJP", "1", 1, "L", true, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)

	pdf.CellFormat(col1, rowHeight, " DPJP Ditunjuk", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+dpjpName, "1", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)

	// Alasan permohonan (blank line for handwriting)
	pdf.CellFormat(col1, rowHeight*4, " Alasan Permohonan", "1", 0, "LT", true, 0, "")
	pdf.CellFormat(col2+col3+col4, rowHeight*4, "", "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 3)

	// Pernyataan
	pdf.SetFont("Arial", "", 9)
	pdf.MultiCell(contentWidth, 5, "Dengan ini saya menyatakan bahwa pasien tersebut di atas memerlukan penanganan dari DPJP yang ditunjuk. Pasien/keluarga pasien telah diberikan penjelasan mengenai penunjukan DPJP dan menyetujui penanganan oleh dokter tersebut.", "", "L", false)

	pdf.SetY(pdf.GetY() + 5)

	// Tanda Tangan - 3 kolom
	signY := pdf.GetY()
	signColWidth := contentWidth / 3
	columnSlots := []string{"patient", "nurse"} // configurable first 2 columns
	for _, rule := range loadDocumentSignatureRules() {
		if rule.DocumentType != models.DocTypeInformedConsent || len(rule.Slots) == 0 {
			continue
		}
		columnSlots = append([]string{}, rule.Slots...)
		break
	}
	if len(columnSlots) < 2 {
		columnSlots = append(columnSlots, "none")
	}

	pdf.SetFont("Arial", "", 9)
	dateStr := hospitalInfo.City + ", " + formatDateIndonesian(time.Now())
	pdf.CellFormat(contentWidth, 5, dateStr, "", 1, "C", false, 0, "")

	pdf.SetY(pdf.GetY() + 2)
	signY = pdf.GetY()

	type staticSlotRender struct {
		label string
		name  string
	}
	resolveStaticSlot := func(slot string) staticSlotRender {
		switch strings.TrimSpace(strings.ToLower(slot)) {
		case "patient":
			return staticSlotRender{
				label: "Pasien / Keluarga Pasien",
				name:  "( " + truncateText(patient.NamaLengkap, 22) + " )",
			}
		case "doctor_dpjp":
			return staticSlotRender{
				label: "Dokter DPJP",
				name:  "( " + truncateText(dpjpName, 22) + " )",
			}
		case "nurse":
			return staticSlotRender{
				label: "Perawat / Petugas",
				name:  "( ................................ )",
			}
		default:
			return staticSlotRender{}
		}
	}
	left := resolveStaticSlot(columnSlots[0])
	mid := resolveStaticSlot(columnSlots[1])

	// Col 1: dynamic
	pdf.SetXY(marginLeft, signY)
	pdf.CellFormat(signColWidth, 5, "Slot 1 (Kiri)", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft, signY+5)
	pdf.CellFormat(signColWidth, 5, left.label, "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft, signY+28)
	pdf.CellFormat(signColWidth, 5, left.name, "", 1, "C", false, 0, "")

	// Col 2: dynamic
	pdf.SetXY(marginLeft+signColWidth, signY)
	pdf.CellFormat(signColWidth, 5, "Slot 2 (Kanan)", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft+signColWidth, signY+5)
	pdf.CellFormat(signColWidth, 5, mid.label, "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft+signColWidth, signY+28)
	pdf.CellFormat(signColWidth, 5, mid.name, "", 1, "C", false, 0, "")

	// Col 3: DPJP
	pdf.SetXY(marginLeft+signColWidth*2, signY)
	pdf.CellFormat(signColWidth, 5, "DPJP", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft+signColWidth*2, signY+28)
	pdf.CellFormat(signColWidth, 5, "( "+truncateText(dpjpName, 22)+" )", "", 1, "C", false, 0, "")

	// Dashed lines
	pdf.SetDrawColor(150, 150, 150)
	pdf.SetDashPattern([]float64{1, 1}, 0)
	for i := 0; i < 3; i++ {
		lx := marginLeft + float64(i)*signColWidth + 10
		rx := marginLeft + float64(i)*signColWidth + signColWidth - 10
		pdf.Line(lx, signY+27, rx, signY+27)
	}
	pdf.SetDashPattern([]float64{}, 0)
	pdf.SetDrawColor(100, 100, 100)

	// Footer
	pdf.SetY(signY + 36)
	pdf.SetFont("Arial", "I", 7)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(contentWidth, 4, "* Formulir ini merupakan bukti permohonan penunjukan DPJP yang sah.", "", 1, "C", false, 0, "")
	pdf.CellFormat(contentWidth, 4, "* Dicetak secara otomatis oleh sistem SIMRS.", "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Permohonan_DPJP_%s_%s.pdf", patient.NoRM, visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintInformedConsentReceipt generates PDF for Bukti Pemberian Informed Consent / Informasi
func printNutritionEtiketImpl(c *gin.Context) {
	orderID := c.Param("orderId")

	var order models.NutritionOrder
	if err := database.DB.
		Preload("Patient").
		Preload("Items.Menu").
		Preload("Package.Items.Menu").
		Preload("Visit.Room").
		Preload("Visit.Bed.RoomUnit").
		First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
		return
	}

	hospitalInfo := getHospitalInfo()

	// Thermal: 100mm width, auto height
	pageWidth := 100.0
	pageHeight := 140.0

	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr: "mm",
		Size:    gofpdf.SizeType{Wd: pageWidth, Ht: pageHeight},
	})
	pdf.SetMargins(3, 3, 3)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	contentWidth := 94.0
	marginL := 3.0

	// === KOP HEADER ===
	headerStartY := 3.0

	// Border box
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.3)

	// Logo
	logoWidth := 10.0
	if hospitalInfo.Logo != "" {
		logoFile := strings.TrimPrefix(hospitalInfo.Logo, "/")
		logoFile = strings.TrimPrefix(logoFile, "uploads/")
		logoPath := filepath.Join("uploads", logoFile)
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
				pdf.Image(logoPath, marginL, headerStartY, logoWidth, logoWidth, false, imgType, 0, "")
			}
		}
	}

	// Hospital name
	textStartX := marginL + logoWidth + 2
	textWidth := contentWidth - logoWidth - 2
	pdf.SetFont("Arial", "B", 8)
	pdf.SetXY(textStartX, headerStartY+1)
	pdf.MultiCell(textWidth, 3.5, hospitalInfo.Name, "", "C", false)

	// Address
	pdf.SetFont("Arial", "", 5.5)
	address := hospitalInfo.Address
	if hospitalInfo.City != "" {
		address += ", " + hospitalInfo.City
	}
	pdf.SetX(textStartX)
	pdf.MultiCell(textWidth, 2.5, address, "", "C", false)

	// Phone
	if hospitalInfo.Phone != "" {
		pdf.SetX(textStartX)
		pdf.CellFormat(textWidth, 2.5, "Telp: "+hospitalInfo.Phone, "", 1, "C", false, 0, "")
	}

	// Double line
	lineY := headerStartY + logoWidth + 1
	if pdf.GetY() > lineY {
		lineY = pdf.GetY() + 0.5
	}
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.4)
	pdf.Line(marginL, lineY, marginL+contentWidth, lineY)
	pdf.SetLineWidth(0.15)
	pdf.Line(marginL, lineY+0.5, marginL+contentWidth, lineY+0.5)

	// Title
	currentY := lineY + 2
	pdf.SetY(currentY)
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(0, 5, "ETIKET MAKANAN", "", 1, "C", false, 0, "")
	currentY = pdf.GetY() + 1

	// === PATIENT INFO ===
	labelW := 22.0
	valueW := contentWidth - labelW

	// Nama Pasien
	pdf.SetY(currentY)
	pdf.SetX(marginL)
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(labelW, 4, "Nama", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	patientName := "-"
	if order.Patient != nil {
		patientName = order.Patient.NamaLengkap
	}
	pdf.CellFormat(valueW, 4, ": "+patientName, "", 1, "L", false, 0, "")

	// No. RM
	pdf.SetX(marginL)
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(labelW, 4, "No. RM", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	noRM := "-"
	if order.Patient != nil {
		noRM = order.Patient.NoRM
	}
	pdf.CellFormat(valueW, 4, ": "+noRM, "", 1, "L", false, 0, "")

	// Ruangan / Kamar / Bed (from visit relations)
	pdf.SetX(marginL)
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(labelW, 4, "Ruangan", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 8)
	var locationParts []string
	if order.Visit != nil && order.Visit.Room != nil {
		locationParts = append(locationParts, order.Visit.Room.Name)
	} else if order.RoomName != "" {
		locationParts = append(locationParts, order.RoomName)
	}
	if order.Visit != nil && order.Visit.Bed != nil {
		if order.Visit.Bed.RoomUnit != nil {
			locationParts = append(locationParts, order.Visit.Bed.RoomUnit.Name)
		}
		locationParts = append(locationParts, order.Visit.Bed.BedNumber)
	} else if order.BedName != "" {
		locationParts = append(locationParts, order.BedName)
	}
	roomBed := strings.Join(locationParts, " / ")
	pdf.CellFormat(valueW, 4, ": "+roomBed, "", 1, "L", false, 0, "")

	// JK / Umur
	pdf.SetX(marginL)
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(labelW, 4, "JK / Umur", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 8)
	genderAge := "-"
	if order.Patient != nil {
		gender := string(order.Patient.JenisKelamin)
		if order.Patient.TanggalLahir != nil && !order.Patient.TanggalLahir.IsZero() {
			age := calculateAgeYears(order.Patient.TanggalLahir.Time)
			genderAge = fmt.Sprintf("%s / %d tahun", gender, age)
		} else {
			genderAge = gender
		}
	}
	pdf.CellFormat(valueW, 4, ": "+genderAge, "", 1, "L", false, 0, "")

	// Divider
	currentY = pdf.GetY() + 0.5
	pdf.SetDrawColor(150, 150, 150)
	pdf.SetLineWidth(0.2)
	pdf.Line(marginL, currentY, marginL+contentWidth, currentY)

	// Waktu Makan
	currentY += 1
	pdf.SetY(currentY)
	pdf.SetX(marginL)
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(labelW, 4, "Waktu Makan", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	mealTimeLabel := order.MealTime
	if label, ok := models.NutritionMealTimeLabels[order.MealTime]; ok {
		mealTimeLabel = label
	}
	pdf.CellFormat(valueW, 4, ": "+mealTimeLabel, "", 1, "L", false, 0, "")

	// Diet
	pdf.SetX(marginL)
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(labelW, 4, "Jenis Diet", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	dietLabel := order.DietType
	if label, ok := models.NutritionDietTypeLabels[order.DietType]; ok {
		dietLabel = label
	}
	pdf.CellFormat(valueW, 4, ": "+dietLabel, "", 1, "L", false, 0, "")

	// Paket (if any)
	if order.Package != nil {
		pdf.SetX(marginL)
		pdf.SetFont("Arial", "", 7)
		pdf.CellFormat(labelW, 4, "Paket", "", 0, "L", false, 0, "")
		pdf.SetFont("Arial", "B", 8)
		pdf.CellFormat(valueW, 4, ": "+order.Package.Name, "", 1, "L", false, 0, "")
	}

	// === MENU ITEMS TABLE ===
	currentY = pdf.GetY() + 1.5
	pdf.SetY(currentY)
	pdf.SetFont("Arial", "B", 8)
	pdf.SetX(marginL)
	pdf.CellFormat(contentWidth, 4, "RINCIAN MENU", "B", 1, "L", false, 0, "")

	// Table header
	currentY = pdf.GetY() + 0.5
	pdf.SetY(currentY)
	pdf.SetFont("Arial", "B", 7)
	pdf.SetFillColor(240, 240, 240)
	col1W := 38.0 // Menu name
	col2W := 20.0 // Kategori
	col3W := 10.0 // Qty
	col4W := 14.0 // Kalori
	col5W := 12.0 // Porsi
	pdf.SetX(marginL)
	pdf.CellFormat(col1W, 4, "Menu", "B", 0, "L", true, 0, "")
	pdf.CellFormat(col2W, 4, "Kategori", "B", 0, "L", true, 0, "")
	pdf.CellFormat(col3W, 4, "Qty", "B", 0, "C", true, 0, "")
	pdf.CellFormat(col4W, 4, "Kalori", "B", 0, "R", true, 0, "")
	pdf.CellFormat(col5W, 4, "Porsi", "B", 1, "C", true, 0, "")

	// Collect items: from order items or package items
	type menuRow struct {
		Name     string
		Category string
		Qty      float64
		Calories float64
		Serving  string
	}
	var menuRows []menuRow

	if len(order.Items) > 0 {
		for _, item := range order.Items {
			row := menuRow{Qty: item.Quantity}
			if item.Menu != nil {
				row.Name = item.Menu.Name
				cat := item.Menu.Category
				if label, ok := models.NutritionCategoryLabels[cat]; ok {
					cat = label
				}
				row.Category = cat
				row.Calories = item.Menu.Calories * item.Quantity
				row.Serving = item.Menu.ServingSize
			}
			menuRows = append(menuRows, row)
		}
	} else if order.Package != nil {
		for _, item := range order.Package.Items {
			row := menuRow{Qty: item.Quantity}
			if item.Menu != nil {
				row.Name = item.Menu.Name
				cat := item.Menu.Category
				if label, ok := models.NutritionCategoryLabels[cat]; ok {
					cat = label
				}
				row.Category = cat
				row.Calories = item.Menu.Calories * item.Quantity
				row.Serving = item.Menu.ServingSize
			}
			menuRows = append(menuRows, row)
		}
	}

	// Table rows
	pdf.SetFont("Arial", "", 7)
	totalCalories := 0.0
	for _, row := range menuRows {
		pdf.SetX(marginL)
		name := row.Name
		if len(name) > 22 {
			name = name[:19] + "..."
		}
		cat := row.Category
		if len(cat) > 12 {
			cat = cat[:9] + "..."
		}
		pdf.CellFormat(col1W, 3.5, name, "", 0, "L", false, 0, "")
		pdf.CellFormat(col2W, 3.5, cat, "", 0, "L", false, 0, "")
		pdf.CellFormat(col3W, 3.5, fmt.Sprintf("%.0f", row.Qty), "", 0, "C", false, 0, "")
		calStr := "-"
		if row.Calories > 0 {
			calStr = fmt.Sprintf("%.0f kkal", row.Calories)
			totalCalories += row.Calories
		}
		pdf.CellFormat(col4W, 3.5, calStr, "", 0, "R", false, 0, "")
		serving := row.Serving
		if len(serving) > 8 {
			serving = serving[:5] + "..."
		}
		pdf.CellFormat(col5W, 3.5, serving, "", 1, "C", false, 0, "")
	}

	if len(menuRows) == 0 {
		pdf.SetX(marginL)
		pdf.SetFont("Arial", "I", 7)
		pdf.CellFormat(contentWidth, 4, "Tidak ada item menu", "", 1, "C", false, 0, "")
	}

	// Total calories line
	if totalCalories > 0 {
		pdf.SetX(marginL)
		pdf.SetFont("Arial", "B", 7)
		pdf.SetDrawColor(100, 100, 100)
		pdf.CellFormat(col1W+col2W+col3W, 3.5, "Total Kalori", "T", 0, "R", false, 0, "")
		pdf.CellFormat(col4W, 3.5, fmt.Sprintf("%.0f kkal", totalCalories), "T", 0, "R", false, 0, "")
		pdf.CellFormat(col5W, 3.5, "", "T", 1, "C", false, 0, "")
	}

	// === ALLERGY WARNING ===
	if order.AllergyNotes != "" {
		currentY = pdf.GetY() + 2
		pdf.SetY(currentY)
		pdf.SetX(marginL)
		pdf.SetFont("Arial", "B", 7)
		pdf.SetTextColor(198, 40, 40)
		pdf.SetFillColor(255, 235, 238)
		pdf.CellFormat(contentWidth, 4.5, "!! ALERGI: "+order.AllergyNotes+" !!", "", 1, "C", true, 0, "")
		pdf.SetTextColor(0, 0, 0)
	}

	// === SPECIAL NOTES ===
	if order.SpecialNotes != "" {
		currentY = pdf.GetY() + 1
		pdf.SetY(currentY)
		pdf.SetX(marginL)
		pdf.SetFont("Arial", "", 6.5)
		pdf.MultiCell(contentWidth, 3, "Catatan: "+order.SpecialNotes, "", "L", false)
	}

	// === FOOTER ===
	currentY = pdf.GetY() + 2
	pdf.SetDrawColor(150, 150, 150)
	pdf.SetLineWidth(0.2)
	pdf.Line(marginL, currentY, marginL+contentWidth, currentY)

	currentY += 1
	pdf.SetY(currentY)
	pdf.SetFont("Arial", "", 6)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(0, 3, fmt.Sprintf("Dicetak: %s", formatDateTimeIndonesian(time.Now())), "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	rmSafe := "unknown"
	if order.Patient != nil {
		rmSafe = order.Patient.NoRM
	}
	filename := fmt.Sprintf("Etiket_Makanan_%s_%s.pdf", rmSafe, order.MealTime)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// =============================================================================
// RM DUPLICATE ORDER PRINT HANDLERS
// Print lab/radiology/surgery/consultation from EKlaimRMOrder data
// =============================================================================

// loadRMOrderWithPatient loads an EKlaimRMOrder and its associated patient via RMDuplicate → Visit → Registration → Patient
