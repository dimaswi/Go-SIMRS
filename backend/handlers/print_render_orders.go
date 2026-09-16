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

func printPrescriptionImpl(c *gin.Context) {
	orderID := c.Param("orderId")

	// Cache check
	// oid, _ := strconv.ParseUint(orderID, 10, 32)
	// if pdfData, fileName, found := getCachedPDF(models.DocTypePrescription, uint(oid)); found {
	// 	c.Header("Content-Type", "application/pdf")
	// 	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
	// 	c.Data(http.StatusOK, "application/pdf", pdfData)
	// 	return
	// }

	// Load medicine order
	var order models.MedicineOrder
	if err := database.DB.
		Preload("Items.Medicine").
		Preload("SourceVisit.Registration.Patient").
		Preload("SourceVisit.Doctor").
		Preload("SourceVisit.Room").
		Preload("SourceVisit.Registration.DestinationRoom").
		Preload("Prescriber").
		Preload("SourceRoom").
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

	// Fetch additional data
	var medRecord models.Anamnesis
	database.DB.Where("visit_id = ?", visit.ID).First(&medRecord)

	var physExam models.PhysicalExamination
	database.DB.Where("visit_id = ?", visit.ID).First(&physExam)

	var presReview models.PrescriptionReview
	database.DB.Where("medicine_order_id = ?", order.ID).First(&presReview)

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF (A5 format: 148 x 210 mm)
	pdf := gofpdf.New("P", "mm", "A5", "")
	pdf.SetMargins(10, 10, 10)
	pdf.SetAutoPageBreak(true, 10)
	pdf.AddPage()

	// Header (KOP) - A5 width is 148. Content width = 128.
	pdf.SetFont("Arial", "", 10)
	logoWidth := 15.0
	logoPath := ""
	if hospitalInfo.Logo != "" {
		logoFile := strings.TrimPrefix(hospitalInfo.Logo, "/")
		logoFile = strings.TrimPrefix(logoFile, "uploads/")
		logoPath = filepath.Join("uploads", logoFile)
		if _, err := os.Stat(logoPath); err == nil {
			ext := strings.ToLower(filepath.Ext(logoPath))
			imgType := ""
			switch ext {
			case ".png": imgType = "PNG"
			case ".jpg", ".jpeg": imgType = "JPG"
			}
			if imgType != "" {
				pdf.Image(logoPath, 10, 10, logoWidth, logoWidth, false, imgType, 0, "")
			}
		}
	}
	textStartX := 10.0 + logoWidth + 2.0
	textWidth := 128.0 - logoWidth - 2.0
	pdf.SetFont("Arial", "B", 10)
	pdf.SetXY(textStartX, 10)
	pdf.MultiCell(textWidth, 4, strings.ToUpper(hospitalInfo.Name), "", "C", false)

	pdf.SetFont("Arial", "", 7)
	address := hospitalInfo.Address
	if hospitalInfo.City != "" { address += ", " + hospitalInfo.City }
	pdf.SetX(textStartX)
	pdf.MultiCell(textWidth, 3.5, address, "", "C", false)

	contact := []string{}
	if hospitalInfo.Phone != "" { contact = append(contact, "Telp: "+hospitalInfo.Phone) }
	if hospitalInfo.Fax != "" { contact = append(contact, "Fax: "+hospitalInfo.Fax) }
	if hospitalInfo.Email != "" { contact = append(contact, hospitalInfo.Email) }
	pdf.SetX(textStartX)
	pdf.CellFormat(textWidth, 3.5, strings.Join(contact, " | "), "", 1, "C", false, 0, "")

	if hospitalInfo.Website != "" {
		pdf.SetX(textStartX)
		pdf.CellFormat(textWidth, 3.5, hospitalInfo.Website, "", 1, "C", false, 0, "")
	}

	pdf.SetY(26)
	pdf.SetLineWidth(0.5)
	pdf.Line(10, 26, 138, 26)
	pdf.SetLineWidth(0.2)
	pdf.Line(10, 26.8, 138, 26.8)
	pdf.SetY(28)

	// Body Top Info
	startX := 10.0
	startY := pdf.GetY()
	midX := 75.0
	pdf.SetFont("Arial", "", 8)

	// Left Side Info
	y := startY + 2
	lineH := 4.5

	doctorName := "-"
	sip := "____________________"
	// For prescriptions, the prescriber is the doctor
	if order.Prescriber != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.Prescriber, doctorName)
		if order.Prescriber.NoSIP != "" {
			sip = order.Prescriber.NoSIP
		}
	} else if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
		if visit.Doctor.NoSIP != "" {
			sip = visit.Doctor.NoSIP
		}
	}
	pdf.SetXY(startX+2, y)
	pdf.CellFormat(20, lineH, "Pengirim", "", 0, "L", false, 0, "")
	pdf.CellFormat(2, lineH, ":", "", 0, "C", false, 0, "")
	pdf.SetXY(startX+24, y)
	pdf.MultiCell(midX-(startX+24)-2, lineH, doctorName, "", "L", false)
	y = pdf.GetY()

	pdf.SetXY(startX+2, y)
	pdf.CellFormat(20, lineH, "SIP", "", 0, "L", false, 0, "")
	pdf.CellFormat(2, lineH, ":", "", 0, "C", false, 0, "")
	pdf.SetXY(startX+24, y)
	pdf.MultiCell(midX-(startX+24)-2, lineH, sip, "", "L", false)
	y = pdf.GetY()

	pdf.SetXY(startX+2, y)
	pdf.CellFormat(20, lineH, "PRO", "", 0, "L", false, 0, "")
	pdf.CellFormat(2, lineH, ":", "", 0, "C", false, 0, "")
	pro := patient.NamaLengkap
	genderMarker := "L / P"
	if patient.JenisKelamin == "L" {
		genderMarker = "L / -"
	} else if patient.JenisKelamin == "P" {
		genderMarker = "- / P"
	}
	pdf.SetXY(startX+24, y)
	pdf.MultiCell(midX-(startX+24)-2, lineH, fmt.Sprintf("%s (%s)", pro, genderMarker), "", "L", false)
	y = pdf.GetY()

	pdf.SetXY(startX+2, y)
	pdf.CellFormat(20, lineH, "Tanggal Lahir", "", 0, "L", false, 0, "")
	pdf.CellFormat(2, lineH, ":", "", 0, "C", false, 0, "")
	birthDate := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = patient.TanggalLahir.Format("02-01-2006")
	}
	weightStr := "___"
	if physExam.Weight != "" {
		weightStr = physExam.Weight
	}
	pdf.SetXY(startX+24, y)
	pdf.MultiCell(midX-(startX+24)-2, lineH, fmt.Sprintf("%s     BB %s kg", birthDate, weightStr), "", "L", false)
	y = pdf.GetY()

	pdf.SetXY(startX+2, y)
	pdf.CellFormat(20, lineH, "No. RM", "", 0, "L", false, 0, "")
	pdf.CellFormat(2, lineH, ":", "", 0, "C", false, 0, "")
	pdf.SetXY(startX+24, y)
	pdf.MultiCell(midX-(startX+24)-2, lineH, patient.NoRM, "", "L", false)
	y = pdf.GetY()

	pdf.SetXY(startX+2, y)
	pdf.CellFormat(20, lineH, "Alamat", "", 0, "L", false, 0, "")
	pdf.CellFormat(2, lineH, ":", "", 0, "C", false, 0, "")
	pdf.SetXY(startX+24, y)
	pdf.MultiCell(midX-(startX+24)-2, lineH, patient.AlamatKTP, "", "L", false)
	leftMaxY := pdf.GetY()

	// Right Side Info
	y = startY + 2
	pdf.SetXY(midX+2, y)
	pdf.CellFormat(25, lineH, "Tanggal Resep", "", 0, "L", false, 0, "")
	pdf.CellFormat(2, lineH, ":", "", 0, "C", false, 0, "")
	pdf.SetXY(midX+29, y)
	pdf.MultiCell(138-(midX+29)-2, lineH, formatDateIndonesian(order.CreatedAt), "", "L", false)
	y = pdf.GetY()

	pdf.SetXY(midX+2, y)
	pdf.CellFormat(25, lineH, "Ruangan/Poli", "", 0, "L", false, 0, "")
	pdf.CellFormat(2, lineH, ":", "", 0, "C", false, 0, "")
	roomName := "-"
	if order.SourceRoom != nil {
		roomName = order.SourceRoom.Name
	} else if visit.Room != nil {
		roomName = visit.Room.Name
	} else if visit.Registration != nil && visit.Registration.DestinationRoom != nil {
		roomName = visit.Registration.DestinationRoom.Name
	}
	pdf.SetXY(midX+29, y)
	pdf.MultiCell(138-(midX+29)-2, lineH, roomName, "", "L", false)
	y = pdf.GetY()

	pdf.SetXY(midX+2, y)
	isUmum := " "
	isBPJS := " "
	if visit.Registration != nil {
		if visit.Registration.PaymentMethod == "bpjs" {
			isBPJS = "X"
		} else {
			isUmum = "X"
		}
	}
	pdf.MultiCell(138-(midX+2)-2, lineH, fmt.Sprintf("[ %s ] Umum         [ %s ] BPJS", isUmum, isBPJS), "", "L", false)
	y = pdf.GetY()

	pdf.SetXY(midX+2, y)
	pdf.MultiCell(138-(midX+2)-2, lineH, "Riwayat Alergi", "", "L", false)
	y = pdf.GetY()

	hasAllergy := " "
	noAllergy := " "
	allergyName := "............................."
	
	patientAllergies := ""
	if patient.AlergiObat != "" {
		patientAllergies = patient.AlergiObat
	} else if patient.AlergiMakanan != "" {
		patientAllergies = patient.AlergiMakanan
	} else if patient.AlergiLainnya != "" {
		patientAllergies = patient.AlergiLainnya
	}
	if medRecord.Allergies != "" && medRecord.Allergies != "-" && medRecord.Allergies != "Tidak Ada" && medRecord.Allergies != "tidak ada" && medRecord.Allergies != "Tidak ada" {
		patientAllergies = medRecord.Allergies
	}
	
	if patientAllergies != "" && patientAllergies != "-" && patientAllergies != "Tidak Ada" && patientAllergies != "tidak ada" && patientAllergies != "Tidak ada" {
		hasAllergy = "X"
		allergyName = patientAllergies
	} else {
		noAllergy = "X"
	}

	pdf.SetXY(midX+2, y)
	pdf.MultiCell(138-(midX+2)-2, lineH, fmt.Sprintf("[ %s ] Ya, Nama %s", hasAllergy, allergyName), "", "L", false)
	y = pdf.GetY()

	pdf.SetXY(midX+2, y)
	pdf.MultiCell(138-(midX+2)-2, lineH, fmt.Sprintf("[ %s ] Tidak", noAllergy), "", "L", false)
	rightMaxY := pdf.GetY()

	maxY := leftMaxY
	if rightMaxY > maxY {
		maxY = rightMaxY
	}

	boxHeight := maxY - startY + 2
	if boxHeight < 30 {
		boxHeight = 30
	}

	// Lower Body Layout
	y = startY + boxHeight
	
	// If the remaining space is less than what's needed for the lower body (approx 125mm)
	if y + 125.0 > 200.0 {
		pdf.AddPage()
		y = 10.0
	}
	
	availH := 202.0 - y
	if availH < 125.0 {
		availH = 125.0
	}
	
	// Temporarily disable auto page break so we can draw to the very bottom margin without triggering a new page
	pdf.SetAutoPageBreak(false, 0)
	
	pdf.SetXY(startX, y)
	// Outer border for lower body
	pdf.Rect(10, y, 128, availH, "D")
	// Vertical split
	splitX := 75.0

	// Top box (drawn late to fit dynamic height)
	pdf.Rect(10, startY, 128, boxHeight, "D")
	pdf.Line(midX, startY, midX, startY+boxHeight)

	// Group items
	type groupedItem struct {
		isRacikan   bool
		racikanName string
		racikanQty  int
		racikanUnit string
		components  []models.MedicineOrderItem
		item        models.MedicineOrderItem
	}

	var groups []groupedItem
	racikanMap := make(map[string]int)

	for _, item := range order.Items {
		if item.Status == models.ItemStatusCancelled {
			continue
		}
		
		if item.ItemType == "racikan" && item.RacikanGroup != "" {
			if idx, exists := racikanMap[item.RacikanGroup]; exists {
				groups[idx].components = append(groups[idx].components, item)
			} else {
				ng := groupedItem{
					isRacikan:   true,
					racikanName: item.RacikanName,
					racikanQty:  item.RacikanQty,
					racikanUnit: item.RacikanUnit,
					components:  []models.MedicineOrderItem{item},
				}
				groups = append(groups, ng)
				racikanMap[item.RacikanGroup] = len(groups) - 1
			}
		} else {
			groups = append(groups, groupedItem{
				isRacikan: false,
				item:      item,
			})
		}
	}

	// Medicine List
	medY := y + 5
	for _, grp := range groups {
		pdf.SetFont("Times", "BI", 16)
		pdf.SetXY(12, medY)
		pdf.CellFormat(10, 4, "R/.", "", 0, "L", false, 0, "")
		
		if !grp.isRacikan {
			medName := ""
			if grp.item.Medicine != nil {
				medName = grp.item.Medicine.Name
			}
			pdf.SetFont("Arial", "B", 8)
			pdf.SetXY(22, medY)
			pdf.MultiCell(50, 4, medName, "", "L", false)
			
			qtyStr := fmt.Sprintf("Jumlah: %d %s", grp.item.Quantity, grp.item.Unit)
			if grp.item.Dosage != "" {
				qtyStr += " | Dosis: " + grp.item.Dosage
			}
			if grp.item.Frequency != "" {
				qtyStr += " | Frekuensi: " + grp.item.Frequency
			}
			if grp.item.Route != "" {
				qtyStr += " | Cara: " + grp.item.Route
			}
			pdf.SetFont("Arial", "", 7)
			pdf.SetXY(22, pdf.GetY())
			pdf.MultiCell(50, 3.5, qtyStr, "", "L", false)
			
			pdf.SetFont("Arial", "I", 7)
			pdf.SetXY(22, pdf.GetY())
			pdf.MultiCell(50, 3.5, "Signa: "+grp.item.Instructions, "", "L", false)
		} else {
			pdf.SetFont("Arial", "B", 8)
			pdf.SetXY(22, medY)
			pdf.MultiCell(50, 4, grp.racikanName, "", "L", false)
			
			pdf.SetFont("Arial", "", 7)
			compY := pdf.GetY()
			for _, comp := range grp.components {
				compName := ""
				if comp.Medicine != nil {
					compName = comp.Medicine.Name
				}
				compLine := fmt.Sprintf("- %s (%d %s)", compName, comp.Quantity, comp.Unit)
				pdf.SetXY(24, compY)
				pdf.MultiCell(48, 3.5, compLine, "", "L", false)
				compY = pdf.GetY()
			}
			
			firstComp := grp.components[0]
			qtyStr := fmt.Sprintf("Jumlah: %d %s", grp.racikanQty, grp.racikanUnit)
			if firstComp.Dosage != "" {
				qtyStr += " | Dosis: " + firstComp.Dosage
			}
			if firstComp.Frequency != "" {
				qtyStr += " | Frekuensi: " + firstComp.Frequency
			}
			if firstComp.Route != "" {
				qtyStr += " | Cara: " + firstComp.Route
			}
			pdf.SetXY(22, compY)
			pdf.MultiCell(50, 3.5, qtyStr, "", "L", false)
			
			pdf.SetFont("Arial", "I", 7)
			pdf.SetXY(22, pdf.GetY())
			pdf.MultiCell(50, 3.5, "Signa: "+firstComp.Instructions, "", "L", false)
		}
		
		medY = pdf.GetY() + 4
	}

	// Checklist Side
	cY := y + 2
	cLine := 4.0

	// Telaah Resep
	pdf.SetFont("Arial", "BU", 8)
	pdf.SetXY(splitX, cY)
	pdf.CellFormat(63, cLine, "TELAAH RESEP", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 7)
	
	getCheck := func(b bool) string {
		if b { return "X" }
		return " "
	}
	
	telaahItems := []string{
		fmt.Sprintf("[ %s ] Lengkap Identitas Pasien", getCheck(presReview.PatientIdentityCheck)),
		fmt.Sprintf("[ %s ] Lengkap Nama & Paraf Dokter", getCheck(presReview.DoctorNameSignCheck)),
		fmt.Sprintf("[ %s ] Tanggal Resep", getCheck(presReview.PrescriptionDateCheck)),
		fmt.Sprintf("[ %s ] Ada Nama Obat, Bentuk & Kekuatan", getCheck(presReview.MedicineDataCheck)),
		fmt.Sprintf("[ %s ] Ada Dosis & Jumlah Obat", getCheck(presReview.DoseCheck)),
		fmt.Sprintf("[ %s ] Ada Cara Pemakaian", getCheck(presReview.AdministrationRouteCheck)),
		fmt.Sprintf("[ %s ] Interaksi Obat", getCheck(presReview.DrugInteractionCheck)),
		fmt.Sprintf("[ %s ] Duplikasi", getCheck(presReview.DuplicationCheck)),
		fmt.Sprintf("[ %s ] Kontra Indikasi", getCheck(presReview.ContraindicationCheck)),
		fmt.Sprintf("[ %s ] Alergi / Reaksi Obat Yg Tdk Diinginkan", getCheck(presReview.AllergyCheck)),
	}
	cY += cLine
	for _, ti := range telaahItems {
		pdf.SetXY(splitX+2, cY)
		pdf.CellFormat(60, 3.5, ti, "", 1, "L", false, 0, "")
		cY += 3.5
	}
	pdf.Line(splitX, cY+2, 138, cY+2)
	
	// Verifikasi Akhir
	cY += 6
	pdf.SetFont("Arial", "BU", 8)
	pdf.SetXY(splitX, cY)
	pdf.CellFormat(63, cLine, "VERIFIKASI AKHIR", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 7)
	verifItems := []string{
		fmt.Sprintf("[ %s ] Benar Pasien", getCheck(presReview.FinalPatientCheck)),
		fmt.Sprintf("[ %s ] Benar Obat", getCheck(presReview.FinalMedicineCheck)),
		fmt.Sprintf("[ %s ] Benar Dosis", getCheck(presReview.FinalDoseCheck)),
		fmt.Sprintf("[ %s ] Benar Waktu Pemberian", getCheck(presReview.FinalTimeCheck)),
		fmt.Sprintf("[ %s ] Benar Rute Pemberian", getCheck(presReview.FinalRouteCheck)),
	}
	cY += cLine
	for _, vi := range verifItems {
		pdf.SetXY(splitX+2, cY)
		pdf.CellFormat(60, 3.5, vi, "", 1, "L", false, 0, "")
		cY += 3.5
	}
	pdf.Line(splitX, cY+2, 138, cY+2)

	// PIO
	cY += 6
	pdf.SetFont("Arial", "BU", 8)
	pdf.SetXY(splitX, cY)
	pdf.CellFormat(63, cLine, "PIO", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 7)
	pioItems := []string{
		fmt.Sprintf("[ %s ] Nama Obat", getCheck(presReview.PIONameCheck)),
		fmt.Sprintf("[ %s ] Cara Pakai", getCheck(presReview.PIOUsageCheck)),
		fmt.Sprintf("[ %s ] Kegunaan", getCheck(presReview.PIOBenefitCheck)),
		fmt.Sprintf("[ %s ] Penyimpanan", getCheck(presReview.PIOStorageCheck)),
		fmt.Sprintf("[ %s ] Lain-lain", getCheck(presReview.PIOOtherCheck)),
	}
	cY += cLine
	for _, pi := range pioItems {
		pdf.SetXY(splitX+2, cY)
		pdf.CellFormat(60, 3.5, pi, "", 1, "L", false, 0, "")
		cY += 3.5
	}

	// Bottom Signatures & Times
	sigH := 30.0
	bY := y + availH - sigH
	midB := 75.0 // Match splitX
	pdf.Line(midB, y, midB, bY) // vertical split in middle section
	pdf.Line(10, bY, 138, bY) // horizontal line above bottom signatures
	pdf.Line(midB, bY, midB, bY+sigH) // vertical split in bottom section
	
	pharmacistName := ""
	patientName := ""
	pharmacistTitle := ""
	patientTitle := ""

	sigLookups := []signatureLookup{{models.DocTypePrescription, order.ID}}
	
	if leftLog, signed := findSignatureLogBySlot("left", sigLookups...); signed {
		pharmacistName = resolveSignedUserName(leftLog, "Petugas Farmasi")
		if title := signatureLabelFromMeta(leftLog); title != "" {
			pharmacistTitle = title
		}
		meta := parseSignatureMeta(leftLog.Notes)
		if meta.image == "" {
			addSignatureQR(pdf, leftLog, 10 + 65.0/2.0, bY+(sigH/2.0), 16.0, fmt.Sprintf("default_%s_%d_left", models.DocTypePrescription, order.ID))
		}
	}
	
	if rightLog, signed := findSignatureLogBySlot("right", sigLookups...); signed {
		patientName = resolveSignedUserName(rightLog, "Pasien")
		if title := signatureLabelFromMeta(rightLog); title != "" {
			patientTitle = title
		}
		meta := parseSignatureMeta(rightLog.Notes)
		if meta.image == "" {
			addSignatureQR(pdf, rightLog, midB + 63.0/2.0, bY+(sigH/2.0), 16.0, fmt.Sprintf("default_%s_%d_right", models.DocTypePrescription, order.ID))
		}
	}

	pdf.SetFont("Arial", "", 7)
	if pharmacistTitle != "" || pharmacistName != "" {
		pdf.SetXY(10, bY+2)
		pdf.CellFormat(65, 4, pharmacistTitle, "", 1, "C", false, 0, "")
		pdf.SetXY(10, bY+sigH-6)
		pdf.CellFormat(65, 4, pharmacistName, "", 1, "C", false, 0, "")
	}

	if patientTitle != "" || patientName != "" {
		pdf.SetXY(midB, bY+2)
		pdf.CellFormat(63, 4, patientTitle, "", 1, "C", false, 0, "")
		pdf.SetXY(midB, bY+sigH-6)
		pdf.CellFormat(63, 4, patientName, "", 1, "C", false, 0, "")
	}

	// Footer timestamps (placed below the outer box)
	waktuMasuk := order.CreatedAt.Format("15:04")
	pdf.SetXY(10, y+availH+1.0)
	pdf.SetFont("Arial", "I", 6)
	pdf.CellFormat(65, 3, "Jam Resep Masuk: "+waktuMasuk, "", 0, "L", false, 0, "")
	
	waktuKeluar := "-"
	if order.DeliveredAt != nil {
		waktuKeluar = order.DeliveredAt.Format("15:04")
	}
	pdf.SetXY(midB, y+availH+1.0)
	pdf.CellFormat(63, 3, "Jam Penyerahan Obat: "+waktuKeluar, "", 0, "L", false, 0, "")

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
	addDualSignature(pdf, hospitalInfo.City, doctorName, models.DocTypeLabResult, order.ID)

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

	pdf.AddPage()
	addHeader(pdf, info, "HASIL PEMERIKSAAN LABORATORIUM", "")

	// Patient & Order Info Table
	addProcedureOrderInfoTable(pdf, patient, &order)

	// Results Table Header
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(230, 230, 230)
	pdf.CellFormat(60, 7, "Pemeriksaan / Parameter", "TB", 0, "C", true, 0, "")
	pdf.CellFormat(35, 7, "Hasil", "TB", 0, "C", true, 0, "")
	pdf.CellFormat(20, 7, "Satuan", "TB", 0, "C", true, 0, "")
	pdf.CellFormat(45, 7, "Nilai Rujukan", "TB", 0, "C", true, 0, "")
	pdf.CellFormat(20, 7, "Ket", "TB", 1, "C", true, 0, "")

	for _, item := range activeItems {
		// Category / Procedure name row
		pdf.SetDashPattern([]float64{}, 0) // Solid
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(245, 245, 245)
		pdf.CellFormat(180, 6, strings.ToUpper(item.Procedure.Name), "B", 1, "L", true, 0, "")

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

			pdf.SetDashPattern([]float64{1, 1}, 0) // Dashed
			pdf.CellFormat(60, 6, "  "+paramName, "B", 0, "L", false, 0, "")
			pdf.CellFormat(35, 6, formatNumericString(result.Value), "B", 0, "C", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
			pdf.CellFormat(20, 6, unit, "B", 0, "C", false, 0, "")
			pdf.CellFormat(45, 6, formatNumericString(refRange), "B", 0, "C", false, 0, "")

			// Status with color
			if result.IsCritical || result.IsHigh {
				pdf.SetTextColor(255, 0, 0)
			} else if result.IsLow {
				pdf.SetTextColor(0, 0, 255)
			}
			pdf.CellFormat(20, 6, status, "B", 1, "C", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
		}

		// Notes if any
		if item.Notes != "" {
			pdf.SetDashPattern([]float64{}, 0) // Solid
			pdf.SetFont("Arial", "B", 9)
			pdf.CellFormat(60, 5, "Catatan:", "", 0, "L", false, 0, "")
			pdf.SetFont("Arial", "", 9)
			pdf.CellFormat(120, 5, item.Notes, "", 1, "L", false, 0, "")
			// bottom border
			pdf.CellFormat(180, 0, "", "T", 1, "L", false, 0, "")
		}
	}
	pdf.SetDashPattern([]float64{}, 0) // Reset to solid



	// Signature section (digital-aware: reads signature log for lab_result)
	performedByName := ""
	if len(activeItems) > 0 && activeItems[0].PerformedBy != nil {
		performedByName = resolveAssignedUserNameFromEmployee(activeItems[0].PerformedBy, performedByName)
	} else if order.PerformedBy != nil {
		performedByName = resolveAssignedUserNameFromEmployee(order.PerformedBy, performedByName)
	}
	addDualSignature(pdf, info.City, performedByName, models.DocTypeLabResult, order.ID)

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
	addDualSignature(pdf, info.City, performedByName, models.DocTypeLabResult, order.ID)

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

	pdf.AddPage()
	addHeader(pdf, info, "HASIL PEMERIKSAAN RADIOLOGI", "")

	// Patient & Order Info Table
	addProcedureOrderInfoTable(pdf, patient, &order)

	// Results Table Header
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(230, 230, 230)
	pdf.CellFormat(60, 7, "Pemeriksaan / Parameter", "TB", 0, "C", true, 0, "")
	pdf.CellFormat(120, 7, "Hasil", "TB", 1, "C", true, 0, "")

	for _, item := range activeItems {
		// Procedure name
		procedureName := "-"
		if item.Procedure != nil {
			procedureName = item.Procedure.Name
		}
		
		pdf.SetDashPattern([]float64{}, 0) // Solid
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(245, 245, 245)
		pdf.CellFormat(180, 6, strings.ToUpper(procedureName), "B", 1, "L", true, 0, "")

		pdf.SetFont("Arial", "", 9)
		for _, result := range item.Results {
			paramName := "-"
			if result.ProcedureParameter != nil {
				paramName = result.ProcedureParameter.Name
			}
			value := "-"
			if result.Value != "" {
				value = result.Value
			}
			
			pdf.SetDashPattern([]float64{1, 1}, 0) // Dashed
			pdf.CellFormat(60, 6, "  "+paramName, "B", 0, "L", false, 0, "")
			pdf.CellFormat(120, 6, value, "B", 1, "L", false, 0, "")
		}

		if item.Notes != "" {
			pdf.SetDashPattern([]float64{}, 0) // Solid
			pdf.SetFont("Arial", "B", 9)
			pdf.CellFormat(60, 5, "Catatan:", "", 0, "L", false, 0, "")
			pdf.SetFont("Arial", "", 9)
			pdf.CellFormat(120, 5, item.Notes, "", 1, "L", false, 0, "")
			pdf.CellFormat(180, 0, "", "T", 1, "L", false, 0, "")
		}
	}
	pdf.SetDashPattern([]float64{}, 0) // Reset to solid



	// Signature section (digital-aware: reads signature log for radiology_result)
	performedByName := ""
	if len(activeItems) > 0 && activeItems[0].PerformedBy != nil {
		performedByName = resolveAssignedUserNameFromEmployee(activeItems[0].PerformedBy, performedByName)
	} else if order.PerformedBy != nil {
		performedByName = resolveAssignedUserNameFromEmployee(order.PerformedBy, performedByName)
	}
	addDualSignature(pdf, info.City, performedByName, models.DocTypeRadiologyResult, order.ID)

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
	addDualSignature(pdf, info.City, performedByName, models.DocTypeRadiologyResult, order.ID)

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
	doctorName := "-"
	if order.SurgeonDoctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.SurgeonDoctor, doctorName)
	}
	if order.OrderType == models.ProcedureOrderTypeConsultation {
		docType = models.DocTypeConsultationResult
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
		addDualSignature(pdf, hospitalInfo.City, doctorName, docType, order.ID,
			signatureLookup{DocType: models.DocTypeOperativeReport, DocID: order.ID})
	} else {
		addDualSignature(pdf, hospitalInfo.City, doctorName, docType, order.ID)
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
