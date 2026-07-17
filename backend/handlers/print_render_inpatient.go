package handlers

import (
	"bytes"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"
)

func printCPPTImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	// Cache check
	rmDupCacheIDStr := c.Query("rm_duplicate_id")
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupCPPT, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		vid, _ := strconv.ParseUint(visitID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeCPPT, uint(vid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	// Load visit with relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	var cpptRecords []models.CPPT
	if err := clinicalVisitQuery(c, visitID).Preload("CreatedBy").Preload("VerifiedBy").
		Order("record_date ASC").
		Find(&cpptRecords).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data CPPT"})
		return
	}

	for i := range cpptRecords {
		cpptRecords[i].CPPTFormat = normalizeCPPTFormatForPrint(cpptRecords[i].CPPTFormat)
	}

	dominantFormat := models.CPPTFormatSOAP
	if len(cpptRecords) > 0 {
		dominantFormat = cpptRecords[0].CPPTFormat
	}
	mixedCPPTFormat := false
	for _, cppt := range cpptRecords {
		if cppt.CPPTFormat != dominantFormat {
			mixedCPPTFormat = true
			break
		}
	}
	cpptFieldHeaders := cpptFormatHeaders(dominantFormat, mixedCPPTFormat)

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Create PDF - Landscape A4
	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header dengan logo dan kop surat
	addHeaderLandscape(pdf, hospitalInfo, "Catatan Perkembangan Pasien Terintegrasi (CPPT)", visit.VisitNumber)

	// Patient info - format table lengkap
	addPatientInfoTableLandscape(pdf, patient, &visit)

	// Table Header
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.3)

	// Column widths for landscape A4 - MUST = 277mm (same as DATA PASIEN)
	colDate := 24.0
	colProf := 18.0
	colSOAP := 45.0 // 45*4 = 180
	colVital := 30.0
	colSign := 25.0
	// Total = 24+18+180+30+25 = 277

	pdf.CellFormat(colDate, 7, "Tanggal/Jam", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colProf, 7, "Prof/Format", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSOAP, 7, cpptFieldHeaders[0], "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSOAP, 7, cpptFieldHeaders[1], "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSOAP, 7, cpptFieldHeaders[2], "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSOAP, 7, cpptFieldHeaders[3], "1", 0, "C", true, 0, "")
	pdf.CellFormat(colVital, 7, "TTV", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSign, 7, "TTD", "1", 1, "C", true, 0, "")
	pdf.SetLineWidth(0.2)

	// Table Rows
	pdf.SetFont("Arial", "", 9)
	marginL := 10.0

	if len(cpptRecords) == 0 {
		totalWidth := colDate + colProf + (colSOAP * 4) + colVital + colSign
		pdf.SetFont("Arial", "I", 9)
		pdf.CellFormat(totalWidth, 15, "Belum ada catatan CPPT untuk kunjungan ini", "1", 1, "C", false, 0, "")
	}

	for _, cppt := range cpptRecords {
		dateStr := cppt.RecordDate.Format("02/01/06 15:04")
		profStr := fmt.Sprintf("%s\n%s", truncateText(cppt.Profession, 14), strings.ToUpper(cppt.CPPTFormat))
		soapFields := buildCPPTFieldTextsForPrint(cppt, mixedCPPTFormat)

		vitalParts := []string{}
		if strings.TrimSpace(cppt.BloodPressure) != "" {
			vitalParts = append(vitalParts, "TD:"+cppt.BloodPressure)
		}
		if cppt.HeartRate > 0 {
			vitalParts = append(vitalParts, fmt.Sprintf("N:%d x/m", cppt.HeartRate))
		}
		if cppt.RespiratoryRate > 0 {
			vitalParts = append(vitalParts, fmt.Sprintf("RR:%d x/m", cppt.RespiratoryRate))
		}
		if strings.TrimSpace(cppt.Temperature) != "" {
			vitalParts = append(vitalParts, "S:"+cppt.Temperature+" C")
		}
		if cppt.OxygenSaturation > 0 {
			vitalParts = append(vitalParts, fmt.Sprintf("SpO2:%d%%", cppt.OxygenSaturation))
		}
		if cppt.PainScale > 0 {
			vitalParts = append(vitalParts, fmt.Sprintf("Nyeri:%d/10", cppt.PainScale))
		}
		vitalStr := "-"
		if len(vitalParts) > 0 {
			vitalStr = strings.Join(vitalParts, "\n")
		}

		signName := "-"
		if cppt.CreatedBy != nil {
			signName = truncateText(cppt.CreatedBy.FullName, 20)
		}
		signStatus := "Pending"
		if cppt.IsVerified {
			signStatus = "Verified"
		}
		signCellText := signName + "\n" + signStatus

		// Calculate row height based on all cell contents
		maxLines := 1
		lineCandidates := []struct {
			text  string
			width float64
		}{
			{text: dateStr, width: colDate - 2},
			{text: profStr, width: colProf - 2},
			{text: soapFields[0], width: colSOAP - 2},
			{text: soapFields[1], width: colSOAP - 2},
			{text: soapFields[2], width: colSOAP - 2},
			{text: soapFields[3], width: colSOAP - 2},
			{text: vitalStr, width: colVital - 2},
			{text: signCellText, width: colSign - 2},
		}
		for _, candidate := range lineCandidates {
			lines := len(pdf.SplitLines([]byte(candidate.text), candidate.width))
			if lines > maxLines {
				maxLines = lines
			}
		}
		rowH := float64(maxLines) * 3.8
		if rowH < 15 {
			rowH = 15
		}
		if rowH > 70 {
			rowH = 70
		}

		// Check page break
		if pdf.GetY()+rowH > 190 {
			pdf.AddPage()
			// Repeat header
			pdf.SetFont("Arial", "B", 9)
			pdf.SetFillColor(220, 220, 220)
			pdf.SetDrawColor(100, 100, 100)
			pdf.CellFormat(colDate, 7, "Tanggal/Jam", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colProf, 7, "Prof/Format", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSOAP, 7, cpptFieldHeaders[0], "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSOAP, 7, cpptFieldHeaders[1], "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSOAP, 7, cpptFieldHeaders[2], "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSOAP, 7, cpptFieldHeaders[3], "1", 0, "C", true, 0, "")
			pdf.CellFormat(colVital, 7, "TTV", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSign, 7, "TTD", "1", 1, "C", true, 0, "")
			pdf.SetFont("Arial", "", 9)
		}

		startY := pdf.GetY()
		pdf.Rect(marginL, startY, colDate, rowH, "D")
		pdf.SetXY(marginL+1, startY+1)
		pdf.MultiCell(colDate-2, 3, dateStr, "", "L", false)

		// Profession and format
		x := marginL + colDate
		pdf.Rect(x, startY, colProf, rowH, "D")
		pdf.SetXY(x+1, startY+1)
		pdf.MultiCell(colProf-2, 3, profStr, "", "L", false)

		// CPPT fields according to selected format
		x += colProf
		for _, text := range soapFields {
			pdf.Rect(x, startY, colSOAP, rowH, "D")
			pdf.SetXY(x+1, startY+1)
			pdf.MultiCell(colSOAP-2, 3, text, "", "L", false)
			x += colSOAP
		}

		// Vital Signs
		pdf.Rect(x, startY, colVital, rowH, "D")
		pdf.SetXY(x+1, startY+1)
		pdf.MultiCell(colVital-2, 3, vitalStr, "", "L", false)
		x += colVital

		// Signature
		pdf.Rect(x, startY, colSign, rowH, "D")
		pdf.SetXY(x+1, startY+1)
		pdf.MultiCell(colSign-2, 3, signCellText, "", "L", false)

		pdf.SetY(startY + rowH)
	}

	// Document-level signature (for cetakan TTD)
	cpptDoctorName := "-"
	if visit.Doctor != nil {
		cpptDoctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, cpptDoctorName)
	}
	addSignature(pdf, hospitalInfo.City, cpptDoctorName, "DPJP", models.DocTypeCPPT, visit.ID,
		rmDupSignatureLookup(c, models.DocTypeRMDupCPPT))

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("CPPT_%s.pdf", visit.VisitNumber)
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupCPPT, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupCPPT, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeCPPT, visit.ID}); isSigned {
			go storeCachedPDF(models.DocTypeCPPT, visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintNursingCare prints the nursing care documentation (D2)
// GET /api/print/nursing-care/:visitId
func printNursingCareImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	// Cache check
	rmDupCacheIDStr := c.Query("rm_duplicate_id")
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupNursingCare, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		vid, _ := strconv.ParseUint(visitID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeNursingCare, uint(vid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	// Load visit with relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	var nursingCares []models.NursingCare
	if err := clinicalVisitQuery(c, visitID).Preload("CreatedBy").
		Order("record_date ASC").
		Find(&nursingCares).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data asuhan keperawatan"})
		return
	}

	if len(nursingCares) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data asuhan keperawatan tidak ditemukan"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)

	for i, nc := range nursingCares {
		if i > 0 {
			pdf.AddPage()
		} else {
			pdf.AddPage()
		}

		// Header
		addHeader(pdf, hospitalInfo, "ASUHAN KEPERAWATAN", "SDKI - SLKI - SIKI")

		// Patient Info Table (consistent format)
		addPatientInfoTable(pdf, patient, &visit)

		// Shift and Date info
		pdf.SetFont("Arial", "B", 9)
		shiftText := fmt.Sprintf("Shift: %s", safeString(nc.ShiftType))
		dateText := fmt.Sprintf("Tanggal Pencatatan: %s", formatDateIndonesian(nc.RecordDate))
		pdf.CellFormat(contentWidth, 6, dateText+" | "+shiftText, "1", 1, "L", false, 0, "")
		pdf.SetY(pdf.GetY() + 2)

		// Pengkajian
		addTableHeader(pdf, "A. PENGKAJIAN")
		addTableMultiRow(pdf, "Keluhan Utama", safeString(nc.ChiefComplaint), 45)
		if nc.PainScale > 0 {
			painStr := fmt.Sprintf("Skala %d/10 - %s", nc.PainScale, safeString(nc.PainAssessment))
			addTableRow(pdf, "Nyeri", painStr, 45)
		}
		addTableRow(pdf, "Kesadaran", safeString(nc.ConsciousnessLevel), 45)
		addTableRow(pdf, "Status Fungsional", safeString(nc.FunctionalStatus), 45)
		if nc.FallRiskScore > 0 {
			fallStr := fmt.Sprintf("Skor %d - %s", nc.FallRiskScore, safeString(nc.FallRiskAssessment))
			addTableRow(pdf, "Risiko Jatuh", fallStr, 45)
		}
		if nc.BloodPressure != "" || nc.HeartRate > 0 {
			vitalStr := fmt.Sprintf("TD: %s\nN: %d x/m\nRR: %d x/m\nS: %s C\nSpO2: %d persen",
				safeString(nc.BloodPressure), nc.HeartRate, nc.RespiratoryRate,
				safeString(nc.Temperature), nc.OxygenSaturation)
			addTableMultiRow(pdf, "Tanda Vital", vitalStr, 45)
		}
		addTableEnd(pdf)

		// SDKI - Diagnosis Keperawatan
		addTableHeader(pdf, "B. DIAGNOSIS KEPERAWATAN (SDKI)")
		if nc.NursingDiagnosisCode != "" {
			addTableRow(pdf, "Kode SDKI", nc.NursingDiagnosisCode, 45)
		}
		addTableMultiRow(pdf, "Diagnosis", safeString(nc.NursingDiagnosis), 45)
		addTableMultiRow(pdf, "Etiologi", safeString(nc.ProblemEtiology), 45)
		addTableMultiRow(pdf, "Tanda & Gejala", safeString(nc.SignsSymptoms), 45)
		addTableEnd(pdf)

		// SLKI - Luaran
		addTableHeader(pdf, "C. LUARAN KEPERAWATAN (SLKI)")
		if nc.NursingOutcomeCode != "" {
			addTableRow(pdf, "Kode SLKI", nc.NursingOutcomeCode, 45)
		}
		addTableMultiRow(pdf, "Luaran", safeString(nc.NursingOutcome), 45)
		addTableMultiRow(pdf, "Indikator", safeString(nc.OutcomeIndicators), 45)
		addTableRow(pdf, "Target", safeString(nc.OutcomeTarget), 45)
		addTableEnd(pdf)

		// SIKI - Intervensi
		addTableHeader(pdf, "D. INTERVENSI KEPERAWATAN (SIKI)")
		if nc.NursingInterventionCode != "" {
			addTableRow(pdf, "Kode SIKI", nc.NursingInterventionCode, 45)
		}
		addTableMultiRow(pdf, "Intervensi", safeString(nc.NursingIntervention), 45)
		if nc.ObservationActions != "" {
			addTableMultiRow(pdf, "Tindakan Observasi", nc.ObservationActions, 45)
		}
		if nc.TherapeuticActions != "" {
			addTableMultiRow(pdf, "Tindakan Terapeutik", nc.TherapeuticActions, 45)
		}
		if nc.EducationActions != "" {
			addTableMultiRow(pdf, "Tindakan Edukasi", nc.EducationActions, 45)
		}
		if nc.CollaborationActions != "" {
			addTableMultiRow(pdf, "Tindakan Kolaborasi", nc.CollaborationActions, 45)
		}
		addTableEnd(pdf)

		// Implementasi
		if nc.Implementation != "" {
			addTableHeader(pdf, "E. IMPLEMENTASI")
			addTableMultiRow(pdf, "Tindakan", nc.Implementation, 45)
			if !nc.ImplementationTime.IsZero() {
				addTableRow(pdf, "Waktu", formatDateIndonesian(nc.ImplementationTime)+", "+nc.ImplementationTime.Format("15:04"), 45)
			}
			addTableMultiRow(pdf, "Respon Pasien", safeString(nc.PatientResponse), 45)
			addTableEnd(pdf)
		}

		// Evaluasi
		addTableHeader(pdf, "F. EVALUASI (SOAP)")
		addTableMultiRow(pdf, "S (Subjective)", safeString(nc.EvaluationSubjective), 45)
		addTableMultiRow(pdf, "O (Objective)", safeString(nc.EvaluationObjective), 45)
		addTableMultiRow(pdf, "A (Analysis)", safeString(nc.EvaluationAnalysis), 45)
		addTableMultiRow(pdf, "P (Planning)", safeString(nc.EvaluationPlanning), 45)
		statusStr := nc.ProblemStatus
		switch statusStr {
		case "teratasi":
			statusStr = "Teratasi"
		case "teratasi_sebagian":
			statusStr = "Teratasi Sebagian"
		case "belum_teratasi":
			statusStr = "Belum Teratasi"
		}
		addTableRow(pdf, "Status Masalah", safeString(statusStr), 45)
		addTableEnd(pdf)

		// Signature (dynamic columns based on document-signature settings)
		nurseName := "-"
		if nc.CreatedBy != nil {
			nurseName = nc.CreatedBy.FullName
		}
		doctorName := "-"
		if visit.Doctor != nil {
			doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
		}
		patientName := safeString(patient.NamaLengkap)
		if strings.TrimSpace(patientName) == "" {
			patientName = "-"
		}
		ncLookups := []signatureLookup{
			rmDupSignatureLookup(c, models.DocTypeRMDupNursingCare),
			{models.DocTypeNursingCare, visit.ID},
		}
		doctorSigLog, doctorSigned := findSignatureLogBySlot("doctor_dpjp", ncLookups...)
		nurseSigLog, nurseSigned := findSignatureLogBySlot("nurse", ncLookups...)
		anySigned := doctorSigned || nurseSigned

		if doctorSigned {
			doctorName = resolveSignedUserName(doctorSigLog, doctorName)
		}
		if nurseSigned {
			nurseName = resolveSignedUserName(nurseSigLog, nurseName)
		}

		pdf.SetY(pdf.GetY() + 5)
		pdf.SetFont("Arial", "", 10)

		// Two signature columns
		signWidth := 70.0
		leftX := marginLeft
		rightX := marginLeft + contentWidth - signWidth
		startY := pdf.GetY()
		columnSlots := []string{"doctor_dpjp", "nurse"} // default layout
		for _, rule := range loadDocumentSignatureRules() {
			if rule.DocumentType != models.DocTypeNursingCare || len(rule.Slots) == 0 {
				continue
			}
			columnSlots = append([]string{}, rule.Slots...)
			break
		}
		if len(columnSlots) < 2 {
			columnSlots = append(columnSlots, "none")
		}

		type slotRender struct {
			label  string
			name   string
			signed bool
			log    models.SignatureLog
		}
		resolveSlot := func(slot string) slotRender {
			switch strings.TrimSpace(strings.ToLower(slot)) {
			case "doctor_dpjp":
				return slotRender{
					label:  "Dokter Penanggung Jawab,",
					name:   doctorName,
					signed: doctorSigned,
					log:    doctorSigLog,
				}
			case "nurse":
				return slotRender{
					label:  "Perawat,",
					name:   nurseName,
					signed: nurseSigned,
					log:    nurseSigLog,
				}
			case "patient":
				return slotRender{
					label:  "Pasien,",
					name:   patientName,
					signed: false,
				}
			default:
				return slotRender{
					label:  "",
					name:   "",
					signed: false,
				}
			}
		}

		left := resolveSlot(columnSlots[0])
		right := resolveSlot(columnSlots[1])
		if left.signed {
			left.label = signatureLabelFromMeta(left.log)
		}
		if right.signed {
			right.label = signatureLabelFromMeta(right.log)
		}

		// Left column
		pdf.SetXY(leftX, startY)
		pdf.CellFormat(signWidth, 6, hospitalInfo.City+", "+formatDateIndonesian(nc.RecordDate), "", 1, "C", false, 0, "")
		pdf.SetXY(leftX, startY+6)
		pdf.CellFormat(signWidth, 6, left.label, "", 1, "C", false, 0, "")
		if left.signed {
			addSignatureQR(pdf, left.log, leftX+signWidth/2, startY+22, 16.0, fmt.Sprintf("nc_left_%d", nc.ID))
		}
		pdf.SetY(startY + 34)
		pdf.SetFont("Arial", "B", 10)
		pdf.SetX(leftX)
		pdf.CellFormat(signWidth, 6, left.name, "B", 1, "C", false, 0, "")

		// Right column
		pdf.SetFont("Arial", "", 10)
		pdf.SetXY(rightX, startY)
		pdf.CellFormat(signWidth, 6, hospitalInfo.City+", "+formatDateIndonesian(nc.RecordDate), "", 1, "C", false, 0, "")
		pdf.SetXY(rightX, startY+6)
		pdf.CellFormat(signWidth, 6, right.label, "", 1, "C", false, 0, "")
		if right.signed {
			addSignatureQR(pdf, right.log, rightX+signWidth/2, startY+22, 16.0, fmt.Sprintf("nc_right_%d", nc.ID))
		}
		pdf.SetY(startY + 34)
		pdf.SetFont("Arial", "B", 10)
		pdf.SetX(rightX)
		pdf.CellFormat(signWidth, 6, right.name, "B", 1, "C", false, 0, "")

		// Digital signature footer
		if anySigned {
			// Prefer showing nurse signature footer when available, otherwise doctor.
			if nurseSigned {
				addDigitalSignatureFooter(pdf, nurseSigLog, models.DocTypeNursingCare, visit.ID)
			} else {
				addDigitalSignatureFooter(pdf, doctorSigLog, models.DocTypeNursingCare, visit.ID)
			}
		}
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Asuhan_Keperawatan_%s.pdf", visit.VisitNumber)
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupNursingCare, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupNursingCare, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeNursingCare, visit.ID}); isSigned {
			go storeCachedPDF(models.DocTypeNursingCare, visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintFluidBalance prints the fluid balance sheet (D3)
// GET /api/print/fluid-balance/:visitId
func printFluidBalanceImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	// Cache check
	rmDupCacheIDStr := c.Query("rm_duplicate_id")
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupFluidBalance, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		vid, _ := strconv.ParseUint(visitID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeFluidBalance, uint(vid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	// Load visit with relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	var fluidBalances []models.FluidBalance
	if err := clinicalVisitQuery(c, visitID).Preload("CreatedBy").
		Order("record_date ASC").
		Find(&fluidBalances).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data balance cairan"})
		return
	}

	if len(fluidBalances) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data balance cairan tidak ditemukan"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Create PDF - Landscape
	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header dengan logo dan kop surat
	addHeaderLandscape(pdf, hospitalInfo, "Catatan Balance Cairan", visit.VisitNumber)

	// Patient info - format table lengkap
	addPatientInfoTableLandscape(pdf, patient, &visit)

	// Table Header - Font 9 sama dengan identitas pasien
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.3)

	// Column widths (277mm total - SAMA dengan DATA PASIEN)
	// Perkecil intake/output agar Petugas lebih lebar
	colDate := 20.0
	colShift := 13.0
	colIntake := 20.0 // 4 cols = 80
	colOutput := 20.0 // 5 cols = 100
	colBalance := 17.0
	colSign := 47.0
	// Total: 20 + 13 + 80 + 100 + 17 + 47 = 277mm

	// Header Row 1 - Group headers
	pdf.CellFormat(colDate, 6, "Tanggal", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colShift, 6, "Shift", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colIntake*4, 6, "INTAKE (ml)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colOutput*5, 6, "OUTPUT (ml)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colBalance, 6, "Balance", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSign, 6, "Petugas", "1", 1, "C", true, 0, "")

	// Header Row 2 - Sub columns
	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(235, 235, 235)
	pdf.CellFormat(colDate, 5, "", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colShift, 5, "", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colIntake, 5, "Oral", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colIntake, 5, "Parenter", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colIntake, 5, "Enteral", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colIntake, 5, "Total", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colOutput, 5, "Urine", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colOutput, 5, "Feses", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colOutput, 5, "Drain", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colOutput, 5, "Muntah", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colOutput, 5, "IWL", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colBalance, 5, "(ml)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSign, 5, "", "1", 1, "C", true, 0, "")

	// Data rows - Font 9
	pdf.SetFont("Arial", "", 9)
	pdf.SetLineWidth(0.2)
	for _, fb := range fluidBalances {
		rowH := 7.0 // Tinggi row lebih besar untuk font 9

		// Check page break
		if pdf.GetY()+rowH > 190 {
			pdf.AddPage()
			// Repeat header
			pdf.SetFont("Arial", "B", 9)
			pdf.SetFillColor(220, 220, 220)
			pdf.CellFormat(colDate, 6, "Tanggal", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colShift, 6, "Shift", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colIntake, 6, "Oral", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colIntake, 6, "Parent.", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colIntake, 6, "Enter.", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colIntake, 6, "Total", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colOutput, 6, "Urine", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colOutput, 6, "Feses", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colOutput, 6, "Drain", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colOutput, 6, "Muntah", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colOutput, 6, "IWL", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colBalance, 6, "Balance", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSign, 6, "Petugas", "1", 1, "C", true, 0, "")
			pdf.SetFont("Arial", "", 9)
		}

		// Calculate totals using actual model fields
		intakeOral := fb.OralDrink + fb.OralFood + fb.OralMedicine
		intakeIV := fb.IVFluid + fb.IVMedicine + fb.BloodProduct
		intakeEnteral := fb.EnteralFeed
		intakeTotal := intakeOral + intakeIV + intakeEnteral + fb.OtherIntake
		outputTotal := fb.UrineAmount + fb.FecesAmount + fb.DrainAmount + fb.VomitAmount + fb.IWL + fb.OtherOutput
		balance := intakeTotal - outputTotal

		pdf.CellFormat(colDate, rowH, fb.RecordDate.Format("02/01/06"), "1", 0, "C", false, 0, "")
		pdf.CellFormat(colShift, rowH, safeString(fb.ShiftType), "1", 0, "C", false, 0, "")
		// Intake
		pdf.CellFormat(colIntake, rowH, fmt.Sprintf("%.0f", intakeOral), "1", 0, "C", false, 0, "")
		pdf.CellFormat(colIntake, rowH, fmt.Sprintf("%.0f", intakeIV), "1", 0, "C", false, 0, "")
		pdf.CellFormat(colIntake, rowH, fmt.Sprintf("%.0f", intakeEnteral), "1", 0, "C", false, 0, "")
		pdf.SetFont("Arial", "B", 9)
		pdf.CellFormat(colIntake, rowH, fmt.Sprintf("%.0f", intakeTotal), "1", 0, "C", false, 0, "")
		pdf.SetFont("Arial", "", 9)
		// Output - warna merah
		pdf.SetTextColor(255, 0, 0)
		pdf.CellFormat(colOutput, rowH, fmt.Sprintf("%.0f", fb.UrineAmount), "1", 0, "C", false, 0, "")
		pdf.CellFormat(colOutput, rowH, fmt.Sprintf("%.0f", fb.FecesAmount), "1", 0, "C", false, 0, "")
		pdf.CellFormat(colOutput, rowH, fmt.Sprintf("%.0f", fb.DrainAmount), "1", 0, "C", false, 0, "")
		pdf.CellFormat(colOutput, rowH, fmt.Sprintf("%.0f", fb.VomitAmount), "1", 0, "C", false, 0, "")
		pdf.CellFormat(colOutput, rowH, fmt.Sprintf("%.0f", fb.IWL), "1", 0, "C", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
		// Balance - color based on positive/negative
		balanceStr := fmt.Sprintf("%+.0f", balance)
		if balance >= 0 {
			pdf.SetTextColor(0, 128, 0) // Green
		} else {
			pdf.SetTextColor(255, 0, 0) // Red
		}
		pdf.SetFont("Arial", "B", 9)
		pdf.CellFormat(colBalance, rowH, balanceStr, "1", 0, "C", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
		pdf.SetFont("Arial", "", 9)
		// Signature - kolom lebih lebar, tidak perlu truncate
		signName := ""
		if fb.CreatedBy != nil {
			signName = fb.CreatedBy.FullName
		}
		pdf.CellFormat(colSign, rowH, signName, "1", 1, "L", false, 0, "")
	}

	// Signature block (2 slot: kiri/kanan) - konsisten dengan alur TTD slot.
	fbLookups := []signatureLookup{
		rmDupSignatureLookup(c, models.DocTypeRMDupFluidBalance),
		signatureLookup{models.DocTypeFluidBalance, visit.ID},
		signatureLookup{models.DocTypeCPPT, visit.ID}, // legacy fallback from old implementation
	}
	leftSigLog, leftSigned := findSignatureLogBySlot("left", fbLookups...)
	rightSigLog, rightSigned := findSignatureLogBySlot("right", fbLookups...)

	leftName := "(............................)"
	rightName := "(............................)"
	leftLabel := ""
	rightLabel := ""
	if leftSigned {
		leftName = resolveSignedUserName(leftSigLog, leftName)
		leftLabel = signatureLabelFromMeta(leftSigLog)
	}
	if rightSigned {
		rightName = resolveSignedUserName(rightSigLog, rightName)
		rightLabel = signatureLabelFromMeta(rightSigLog)
	}

	pdf.SetY(pdf.GetY() + 10)
	sigStartY := pdf.GetY()
	pdf.SetFont("Arial", "", 10)

	slotW := 70.0
	leftX := 10.0 + 120.0
	rightX := leftX + slotW + 10.0
	dateLabel := hospitalInfo.City + ", " + formatDateIndonesian(fluidBalances[len(fluidBalances)-1].RecordDate)

	// Left slot
	pdf.SetXY(leftX, sigStartY)
	pdf.CellFormat(slotW, 6, dateLabel, "", 1, "C", false, 0, "")
	pdf.SetXY(leftX, sigStartY+6)
	pdf.CellFormat(slotW, 6, leftLabel, "", 1, "C", false, 0, "")
	if leftSigned {
		addSignatureQR(pdf, leftSigLog, leftX+slotW/2, sigStartY+22, 16.0, fmt.Sprintf("fb_left_%d", visit.ID))
	}
	pdf.SetY(sigStartY + 34)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(leftX)
	pdf.CellFormat(slotW, 6, leftName, "B", 1, "C", false, 0, "")

	// Right slot
	pdf.SetFont("Arial", "", 10)
	pdf.SetXY(rightX, sigStartY)
	pdf.CellFormat(slotW, 6, dateLabel, "", 1, "C", false, 0, "")
	pdf.SetXY(rightX, sigStartY+6)
	pdf.CellFormat(slotW, 6, rightLabel, "", 1, "C", false, 0, "")
	if rightSigned {
		addSignatureQR(pdf, rightSigLog, rightX+slotW/2, sigStartY+22, 16.0, fmt.Sprintf("fb_right_%d", visit.ID))
	}
	pdf.SetY(sigStartY + 34)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(rightX)
	pdf.CellFormat(slotW, 6, rightName, "B", 1, "C", false, 0, "")

	// Digital footer: pilih slot kanan dulu, fallback kiri, lalu legacy.
	if rightSigned {
		addDigitalSignatureFooter(pdf, rightSigLog, models.DocTypeFluidBalance, visit.ID)
	} else if leftSigned {
		addDigitalSignatureFooter(pdf, leftSigLog, models.DocTypeFluidBalance, visit.ID)
	} else if legacyLog, ok := findSignatureLog(fbLookups...); ok {
		addDigitalSignatureFooter(pdf, legacyLog, models.DocTypeFluidBalance, visit.ID)
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Balance_Cairan_%s.pdf", visit.VisitNumber)
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupFluidBalance, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupFluidBalance, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeFluidBalance, visit.ID}, signatureLookup{models.DocTypeCPPT, visit.ID}); isSigned {
			go storeCachedPDF(models.DocTypeFluidBalance, visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintBedTransfer prints the patient transfer/mutation sheet (D4)
// GET /api/print/bed-transfer/:visitId
func printVitalSignChartImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}
	vid, _ := strconv.ParseUint(visitID, 10, 32)

	// Cache check for RM duplicate mode
	rmDupCacheIDStr := c.Query("rm_duplicate_id")
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupVitalSign, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		if pdfData, fileName, found := getCachedPDF(models.DocTypeVitalSign, uint(vid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	// Load visit with relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Load CPPT records that have vital sign data - from RM duplicate if rm_duplicate_id provided
	var cppts []models.CPPT
	rmDupIDStr := c.Query("rm_duplicate_id")
	if rmDupIDStr != "" {
		var rmDupCPPTs []models.EKlaimRMCPPT
		if err := database.DB.
			Where("rm_duplicate_id = ?", rmDupIDStr).
			Order("sequence ASC, record_date ASC").
			Find(&rmDupCPPTs).Error; err == nil {
			for _, rmc := range rmDupCPPTs {
				if rmc.BloodPressure == "" && rmc.HeartRate == 0 && rmc.Temperature == "" && rmc.OxygenSaturation == 0 && rmc.PainScale == 0 {
					continue
				}
				t, _ := time.Parse("2006-01-02T15:04", rmc.RecordDate)
				if t.IsZero() {
					t, _ = time.Parse("2006-01-02 15:04:05", rmc.RecordDate)
				}
				staffName := rmc.StaffName
				if staffName == "" {
					staffName = rmc.CreatedByName
				}
				cppts = append(cppts, models.CPPT{
					RecordDate:       t,
					Profession:       rmc.Profession,
					BloodPressure:    rmc.BloodPressure,
					HeartRate:        rmc.HeartRate,
					RespiratoryRate:  rmc.RespiratoryRate,
					Temperature:      rmc.Temperature,
					OxygenSaturation: rmc.OxygenSaturation,
					PainScale:        rmc.PainScale,
					CreatedBy:        &models.User{FullName: staffName},
				})
			}
		}
	}
	if len(cppts) == 0 && rmDupIDStr == "" {
		if err := database.DB.Preload("CreatedBy").
			Where("visit_id = ? AND is_casemix = ?", visitID, false).
			Where("(blood_pressure != '' AND blood_pressure IS NOT NULL) OR heart_rate > 0 OR respiratory_rate > 0 OR (temperature != '' AND temperature IS NOT NULL) OR oxygen_saturation > 0 OR pain_scale > 0").
			Order("record_date ASC").
			Find(&cppts).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data tanda vital dari CPPT"})
			return
		}
	}

	if len(cppts) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tanda vital tidak ditemukan di CPPT"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Create PDF - Landscape
	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header dengan logo dan kop surat
	addHeaderLandscape(pdf, hospitalInfo, "Grafik Tanda Vital / Observasi", visit.VisitNumber)

	// Patient info - format table lengkap
	addPatientInfoTableLandscape(pdf, patient, &visit)

	// Table Header
	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(100, 100, 100)

	// Column widths (277mm total)
	colTime := 35.0
	colBP := 30.0
	colHR := 25.0
	colRR := 25.0
	colTemp := 25.0
	colSpO2 := 25.0
	colPain := 25.0
	colProf := 30.0
	colSign := 57.0

	pdf.CellFormat(colTime, 7, "Waktu", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colBP, 7, "TD (mmHg)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colHR, 7, "Nadi (x/m)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colRR, 7, "RR (x/m)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colTemp, 7, "Suhu (°C)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSpO2, 7, "SpO2 (%)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colPain, 7, "Nyeri", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colProf, 7, "Profesi", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSign, 7, "Petugas", "1", 1, "C", true, 0, "")

	// Data rows
	pdf.SetFont("Arial", "", 8)
	for _, cppt := range cppts {
		rowH := 6.0

		// Check page break
		if pdf.GetY()+rowH > 190 {
			pdf.AddPage()
			// Repeat header
			pdf.SetFont("Arial", "B", 8)
			pdf.SetFillColor(220, 220, 220)
			pdf.CellFormat(colTime, 7, "Waktu", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colBP, 7, "TD (mmHg)", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colHR, 7, "Nadi (x/m)", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colRR, 7, "RR (x/m)", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colTemp, 7, "Suhu (°C)", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSpO2, 7, "SpO2 (%)", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colPain, 7, "Nyeri", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colProf, 7, "Profesi", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSign, 7, "Petugas", "1", 1, "C", true, 0, "")
			pdf.SetFont("Arial", "", 8)
		}

		// Time
		timeStr := cppt.RecordDate.Format("02/01 15:04")
		pdf.CellFormat(colTime, rowH, timeStr, "1", 0, "C", false, 0, "")

		// Blood Pressure
		pdf.CellFormat(colBP, rowH, safeString(cppt.BloodPressure), "1", 0, "C", false, 0, "")

		// Heart Rate
		hrStr := "-"
		if cppt.HeartRate > 0 {
			hrStr = fmt.Sprintf("%d", cppt.HeartRate)
		}
		pdf.CellFormat(colHR, rowH, hrStr, "1", 0, "C", false, 0, "")

		// Respiratory Rate
		rrStr := "-"
		if cppt.RespiratoryRate > 0 {
			rrStr = fmt.Sprintf("%d", cppt.RespiratoryRate)
		}
		pdf.CellFormat(colRR, rowH, rrStr, "1", 0, "C", false, 0, "")

		// Temperature
		pdf.CellFormat(colTemp, rowH, safeString(cppt.Temperature), "1", 0, "C", false, 0, "")

		// SpO2
		spo2Str := "-"
		if cppt.OxygenSaturation > 0 {
			spo2Str = fmt.Sprintf("%d", cppt.OxygenSaturation)
		}
		pdf.CellFormat(colSpO2, rowH, spo2Str, "1", 0, "C", false, 0, "")

		// Pain Scale
		painStr := "-"
		if cppt.PainScale > 0 {
			painStr = fmt.Sprintf("%d/10", cppt.PainScale)
		}
		pdf.CellFormat(colPain, rowH, painStr, "1", 0, "C", false, 0, "")

		// Profession
		profStr := "-"
		if cppt.Profession != "" {
			profStr = truncateText(cppt.Profession, 15)
		}
		pdf.CellFormat(colProf, rowH, profStr, "1", 0, "C", false, 0, "")

		// Officer
		officer := "-"
		if cppt.CreatedBy != nil {
			officer = truncateText(cppt.CreatedBy.FullName, 30)
		}
		pdf.CellFormat(colSign, rowH, officer, "1", 1, "C", false, 0, "")
	}

	// Document-level signature (for cetakan TTD)
	vsDoctorName := "-"
	if visit.Doctor != nil {
		vsDoctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, vsDoctorName)
	}
	addSignature(pdf, hospitalInfo.City, vsDoctorName, "Perawat", models.DocTypeVitalSign, visit.ID,
		rmDupSignatureLookup(c, models.DocTypeRMDupVitalSign))

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Vital_Sign_%s.pdf", visit.VisitNumber)
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupVitalSign, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupVitalSign, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeVitalSign, visit.ID}); isSigned {
			go storeCachedPDF(models.DocTypeVitalSign, visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// GetAvailableDocs returns which document types have data for a given visit
// GET /api/print/available-docs/:visitId
