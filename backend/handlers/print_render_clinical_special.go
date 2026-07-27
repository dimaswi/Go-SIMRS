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

func printPatientLabelImpl(c *gin.Context) {
	patientID := c.Param("patientId")
	copies := 4 // default copies (jumlah halaman, masing-masing 2 label)

	// Parse copies from query
	if c.Query("copies") != "" {
		fmt.Sscanf(c.Query("copies"), "%d", &copies)
		if copies < 1 {
			copies = 1
		}
		if copies > 20 {
			copies = 20
		}
	}

	// Load patient
	var patient models.Patient
	if err := database.DB.First(&patient, patientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	// Create PDF - Custom paper: 80mm width x 20mm height
	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr: "mm",
		Size:    gofpdf.SizeType{Wd: 80, Ht: 20},
	})
	pdf.SetMargins(1, 1, 1)
	pdf.SetAutoPageBreak(false, 0)

	// Label dimensions: 2 columns, each ~38mm wide x 18mm high
	labelWidth := 38.0
	labelHeight := 18.0
	gapX := 2.0
	startX := 1.0
	startY := 1.0

	// Each page has 2 labels (2 columns x 1 row)
	for i := 0; i < copies; i++ {
		pdf.AddPage()

		// Print 2 labels per page
		for col := 0; col < 2; col++ {
			x := startX + float64(col)*(labelWidth+gapX)
			y := startY

			// Draw label border (dashed)
			pdf.SetDrawColor(180, 180, 180)
			pdf.SetDashPattern([]float64{1, 1}, 0)
			pdf.Rect(x, y, labelWidth, labelHeight, "D")
			pdf.SetDashPattern([]float64{}, 0)

			// Content
			contentX := x + 1.5
			contentY := y + 0.5

			// Patient name
			pdf.SetFont("Arial", "B", 8)
			pdf.SetXY(contentX, contentY)
			name := patient.NamaLengkap
			if len(name) > 18 {
				name = name[:18] + "..."
			}
			pdf.CellFormat(labelWidth-3, 3.5, name, "", 1, "", false, 0, "")

			// No RM
			pdf.SetXY(contentX, contentY+3.5)
			pdf.SetFont("Arial", "B", 7)
			pdf.CellFormat(labelWidth-3, 3, "RM: "+patient.NoRM, "", 1, "", false, 0, "")

			// Birth date and age
			pdf.SetXY(contentX, contentY+6.5)
			pdf.SetFont("Arial", "", 6)
			birthInfo := "-"
			if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
				age := calculateAgeYears(patient.TanggalLahir.Time)
				birthInfo = fmt.Sprintf("%s (%d th)", patient.TanggalLahir.Format("02-01-2006"), age)
			}
			pdf.CellFormat(labelWidth-3, 2.5, birthInfo, "", 1, "", false, 0, "")

			// Gender and blood type
			pdf.SetXY(contentX, contentY+9)
			gender := string(patient.JenisKelamin)
			bloodType := string(patient.GolonganDarah)
			if bloodType == "" {
				bloodType = "-"
			}
			pdf.CellFormat(labelWidth-3, 2.5, gender+" | "+bloodType, "", 1, "", false, 0, "")

			// Check if patient has allergies
			var allergyCount int64
			database.DB.Model(&models.PatientAllergy{}).Where("patient_id = ? AND is_active = ?", patient.ID, true).Count(&allergyCount)
			if allergyCount > 0 {
				pdf.SetXY(contentX, contentY+12)
				pdf.SetFont("Arial", "B", 5)
				pdf.SetTextColor(198, 40, 40)
				pdf.SetFillColor(255, 235, 238)
				pdf.CellFormat(labelWidth-3, 2.5, "!! ALERGI !!", "", 0, "C", true, 0, "")
				pdf.SetTextColor(0, 0, 0)
			}
		}
	}

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Label_%s.pdf", patient.NoRM)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

func printTriageFormImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	rmDuplicateID := c.Query("rm_duplicate_id")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	// Cache check
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupTriage, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		vid, _ := strconv.ParseUint(visitID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeTriage, uint(vid)); found {
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

	// Triage data fields (either from RMDuplicate or original triage table)
	var (
		arrivalMode      string
		triageComplaint  string
		triageLevel      string
		airway           string
		airwayNote       string
		breathing        string
		breathingNote    string
		breathingRate    string
		circulation      string
		circulationNote  string
		crt              string
		bloodPressure    string
		heartRate        string
		temperature      string
		oxygenSaturation string
		painMethod       string
		painScale        int
		painLocation     string
		consciousness    string
		gcsE             int
		gcsV             int
		gcsM             int
		triageAssessment string
		immediateActions string
		triagerName      string
	)

	// Load from clinicalDB (either Main DB or Casemix DB)
	var triage models.Triage
	visitIDUint, _ := strconv.ParseUint(visitID, 10, 64)
	err := clinicalVisitQuery(c, uint(visitIDUint)).Preload("TriagedBy").First(&triage).Error
	if err == nil {
		arrivalMode = triage.ArrivalMode
		triageComplaint = triage.TriageComplaint
		triageLevel = triage.TriageLevel
		airway = triage.Airway
		airwayNote = triage.AirwayNote
		breathing = triage.Breathing
		breathingNote = triage.BreathingNote
		breathingRate = triage.BreathingRate
		circulation = triage.Circulation
		circulationNote = triage.CirculationNote
		crt = triage.CRT
		bloodPressure = triage.BloodPressure
		heartRate = triage.HeartRate
		temperature = triage.Temperature
		oxygenSaturation = triage.OxygenSaturation
		painMethod = triage.PainMethod
		painScale = triage.PainScale
		painLocation = triage.PainLocation
		consciousness = triage.Consciousness
		gcsE = triage.GCSE
		gcsV = triage.GCSV
		gcsM = triage.GCSM
		triageAssessment = triage.TriageAssessment
		immediateActions = triage.ImmediateActions
		if triage.TriagedBy != nil {
			triagerName = triage.TriagedBy.FullName
		}
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "FORMULIR TRIAGE UGD", "")

	// Patient Info
	addPatientInfoTable(pdf, patient, &visit)

	// Triage Info Section
	addTableHeader(pdf, "A. INFORMASI KEDATANGAN")
	arrivalModeDisplay := strings.ReplaceAll(arrivalMode, "_", " ")
	arrivalModeDisplay = strings.Title(strings.ToLower(arrivalModeDisplay))
	addTableRow(pdf, "Cara Datang", safeString(arrivalModeDisplay), 45)
	addTableRow(pdf, "Keluhan Utama", safeString(triageComplaint), 45)
	triageLevelDisplay := triageLevel
	if triageLevelDisplay != "" {
		triageLevelText := map[string]string{
			"0": "Level 0 - DOA",
			"1": "Level 1 - Resusitasi",
			"2": "Level 2 - Emergent",
			"3": "Level 3 - Urgent",
			"4": "Level 4 - Less Urgent",
			"5": "Level 5 - Non-Urgent",
		}
		if text, ok := triageLevelText[triageLevelDisplay]; ok {
			triageLevelDisplay = text
		} else {
			triageLevelDisplay = "Level " + triageLevelDisplay
		}
	}
	addTableRow(pdf, "Level Triage", safeString(triageLevelDisplay), 45)

	// Visual priority banner (color-coded) to make triage urgency easier to scan.
	bannerR, bannerG, bannerB := 107, 114, 128 // neutral gray
	textR, textG, textB := 255, 255, 255
	switch triageLevel {
	case "0": // DOA
		bannerR, bannerG, bannerB = 17, 24, 39
	case "1": // Resusitasi
		bannerR, bannerG, bannerB = 220, 38, 38
	case "2": // Emergent
		bannerR, bannerG, bannerB = 234, 88, 12
	case "3": // Urgent
		bannerR, bannerG, bannerB = 217, 119, 6
	case "4": // Less urgent
		bannerR, bannerG, bannerB = 22, 163, 74
	case "5": // Non urgent
		bannerR, bannerG, bannerB = 37, 99, 235
	}
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(bannerR, bannerG, bannerB)
	pdf.SetTextColor(textR, textG, textB)
	pdf.CellFormat(contentWidth, 7, "PRIORITAS TRIAGE: "+safeString(triageLevelDisplay), "1", 1, "C", true, 0, "")
	pdf.SetTextColor(0, 0, 0)

	// Show full color triage matrix and mark selected level.
	triageLevels := []struct {
		Code       string
		Label      string
		Indication string
		R, G, B    int
	}{
		{Code: "0", Label: "DOA", Indication: "Death on Arrival / tanpa tanda vital", R: 17, G: 24, B: 39},
		{Code: "1", Label: "Resusitasi", Indication: "Kondisi kritis, tindakan segera", R: 220, G: 38, B: 38},
		{Code: "2", Label: "Emergent", Indication: "Mengancam nyawa, prioritas sangat tinggi", R: 234, G: 88, B: 12},
		{Code: "3", Label: "Urgent", Indication: "Perlu penanganan cepat", R: 217, G: 119, B: 6},
		{Code: "4", Label: "Less Urgent", Indication: "Stabil, dapat menunggu terbatas", R: 22, G: 163, B: 74},
		{Code: "5", Label: "Non-Urgent", Indication: "Tidak gawat, pelayanan rutin", R: 37, G: 99, B: 235},
	}

	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(24, 6, "Level", "1", 0, "C", true, 0, "")
	pdf.CellFormat(58, 6, "Kategori", "1", 0, "C", true, 0, "")
	pdf.CellFormat(74, 6, "Indikasi Klinis", "1", 0, "C", true, 0, "")
	pdf.CellFormat(24, 6, "Checklist", "1", 1, "C", true, 0, "")

	pdf.SetFont("Arial", "", 8)
	for _, lvl := range triageLevels {
		checkMark := "[ ]"
		isSelected := false
		if triageLevel == lvl.Code {
			checkMark = "[v] TERPILIH"
			isSelected = true
		}

		pdf.SetFillColor(lvl.R, lvl.G, lvl.B)
		pdf.SetTextColor(255, 255, 255)
		pdf.CellFormat(24, 6, "L"+lvl.Code, "1", 0, "C", true, 0, "")

		pdf.SetFillColor(255, 255, 255)
		pdf.SetTextColor(0, 0, 0)
		pdf.CellFormat(58, 6, lvl.Label, "1", 0, "L", false, 0, "")
		pdf.CellFormat(74, 6, lvl.Indication, "1", 0, "L", false, 0, "")
		if isSelected {
			pdf.SetFillColor(220, 252, 231)
			pdf.SetTextColor(22, 101, 52)
			pdf.CellFormat(24, 6, checkMark, "1", 1, "C", true, 0, "")
		} else {
			pdf.SetTextColor(90, 90, 90)
			pdf.CellFormat(24, 6, checkMark, "1", 1, "C", false, 0, "")
		}
	}
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "I", 7)
	pdf.CellFormat(contentWidth, 4.5, "Keterangan: [v] TERPILIH = level triage aktif pada kunjungan ini", "1", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	addTableEnd(pdf)

	// Priority interpretation block (without adding new schema fields)
	responseTarget := "Belum terdefinisi"
	serviceZone := "Area observasi"
	priorityNote := "Perlu validasi klinis lanjutan"
	switch triageLevel {
	case "0":
		responseTarget = "Segera (Immediate)"
		serviceZone = "Area Resusitasi / Konfirmasi DOA"
		priorityNote = "Prioritas absolut"
	case "1":
		responseTarget = "Segera (0 menit)"
		serviceZone = "Ruang Resusitasi"
		priorityNote = "Prioritas absolut"
	case "2":
		responseTarget = "<= 10 menit"
		serviceZone = "Zona Emergensi"
		priorityNote = "Prioritas sangat tinggi"
	case "3":
		responseTarget = "<= 30 menit"
		serviceZone = "Zona Urgent"
		priorityNote = "Prioritas tinggi"
	case "4":
		responseTarget = "<= 60 menit"
		serviceZone = "Zona Observasi"
		priorityNote = "Prioritas sedang"
	case "5":
		responseTarget = "<= 120 menit"
		serviceZone = "Zona Non-Urgent"
		priorityNote = "Prioritas rendah"
	}

	addTableHeader(pdf, "A1. RINGKASAN PRIORITAS TRIAGE")
	addTableRow(pdf, "Target Waktu Respons", responseTarget, 55)
	addTableRow(pdf, "Zona Pelayanan", serviceZone, 55)
	addTableRow(pdf, "Status Prioritas", priorityNote, 55)
	addTableEnd(pdf)

	// Quick risk checklist derived from existing triage values.
	firstInt := func(s string) int {
		digits := ""
		for _, ch := range s {
			if ch >= '0' && ch <= '9' {
				digits += string(ch)
			} else if digits != "" {
				break
			}
		}
		if digits == "" {
			return 0
		}
		n, err := strconv.Atoi(digits)
		if err != nil {
			return 0
		}
		return n
	}
	containsAny := func(value string, keys ...string) bool {
		v := strings.ToLower(value)
		for _, k := range keys {
			if strings.Contains(v, k) {
				return true
			}
		}
		return false
	}
	normalizeDisplay := func(value string) string {
		normalized := strings.ReplaceAll(safeString(value), "_", " ")
		normalized = strings.Title(strings.ToLower(normalized))
		return normalized
	}

	spo2Value := firstInt(oxygenSaturation)
	gcsTotalForRisk := gcsE + gcsV + gcsM
	riskItems := []struct {
		Item   string
		Risk   bool
		Reason string
	}{
		{Item: "Gangguan Airway", Risk: containsAny(airway, "obstruct", "sumbat", "henti", "stridor"), Reason: normalizeDisplay(airway)},
		{Item: "Gangguan Breathing", Risk: containsAny(breathing, "sesak", "distress", "apnea", "assisted"), Reason: normalizeDisplay(breathing)},
		{Item: "Gangguan Sirkulasi", Risk: containsAny(circulation, "shock", "syok", "buruk", "lemah"), Reason: normalizeDisplay(circulation)},
		{Item: "Penurunan Kesadaran (GCS < 13)", Risk: gcsTotalForRisk > 0 && gcsTotalForRisk < 13, Reason: fmt.Sprintf("GCS %d", gcsTotalForRisk)},
		{Item: "Hipoksemia (SpO2 < 94)", Risk: spo2Value > 0 && spo2Value < 94, Reason: safeString(oxygenSaturation) + "%"},
		{Item: "Nyeri Berat (>= 7)", Risk: painScale >= 7, Reason: fmt.Sprintf("%d/10", painScale)},
	}

	addTableHeader(pdf, "A2. CHECKLIST RISIKO CEPAT")
	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(95, 6, "Parameter", "1", 0, "C", true, 0, "")
	pdf.CellFormat(22, 6, "Status", "1", 0, "C", true, 0, "")
	pdf.CellFormat(63, 6, "Keterangan", "1", 1, "C", true, 0, "")
	pdf.SetFont("Arial", "", 8)

	for _, r := range riskItems {
		statusMark := "[ ]"
		statusLabel := "TIDAK"
		if r.Risk {
			statusMark = "[x]"
			statusLabel = "YA"
		}

		pdf.SetTextColor(0, 0, 0)
		pdf.CellFormat(95, 6, r.Item, "1", 0, "L", false, 0, "")
		if r.Risk {
			pdf.SetFillColor(254, 226, 226)
			pdf.SetTextColor(185, 28, 28)
		} else {
			pdf.SetFillColor(220, 252, 231)
			pdf.SetTextColor(22, 101, 52)
		}
		pdf.CellFormat(22, 6, statusMark+" "+statusLabel, "1", 0, "C", true, 0, "")
		pdf.SetTextColor(0, 0, 0)
		pdf.CellFormat(63, 6, truncateText(r.Reason, 42), "1", 1, "L", false, 0, "")
	}
	pdf.SetTextColor(0, 0, 0)
	addTableEnd(pdf)

	riskCount := 0
	for _, item := range riskItems {
		if item.Risk {
			riskCount++
		}
	}

	// Operational decision mini-protocol (derived from existing triage values only).
	// Reserve space so A3 block doesn't get awkwardly cut at page bottom.
	checkPageBreak(pdf, 60)
	addTableHeader(pdf, "A3. ALGORITMA KEPUTUSAN TRIAGE")

	protocolRows := []struct {
		Code   string
		Level  string
		Action string
		SLA    string
		Zone   string
	}{
		{Code: "0", Level: "DOA", Action: "Konfirmasi tanda kematian / alur DOA", SLA: "Immediate", Zone: "Resus/DOA"},
		{Code: "1", Level: "Resusitasi", Action: "Aktifkan tim resusitasi, ABC stabilisasi", SLA: "0 menit", Zone: "Resusitasi"},
		{Code: "2", Level: "Emergent", Action: "Dokter evaluasi segera, monitor ketat", SLA: "<= 10 menit", Zone: "Emergensi"},
		{Code: "3", Level: "Urgent", Action: "Observasi aktif + reassessment berkala", SLA: "<= 30 menit", Zone: "Urgent"},
		{Code: "4", Level: "Less Urgent", Action: "Tatalaksana simptomatik, observasi", SLA: "<= 60 menit", Zone: "Observasi"},
		{Code: "5", Level: "Non-Urgent", Action: "Pelayanan rutin / alur non-gawat", SLA: "<= 120 menit", Zone: "Non-Urgent"},
	}

	printA3TableHeader := func() {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(16, 6, "Aktif", "1", 0, "C", true, 0, "")
		pdf.CellFormat(30, 6, "Level", "1", 0, "C", true, 0, "")
		pdf.CellFormat(72, 6, "Aksi Operasional", "1", 0, "C", true, 0, "")
		pdf.CellFormat(30, 6, "SLA", "1", 0, "C", true, 0, "")
		pdf.CellFormat(32, 6, "Zona", "1", 1, "C", true, 0, "")
		pdf.SetFont("Arial", "", 8)
	}

	printA3TableHeader()

	for _, row := range protocolRows {
		if checkPageBreak(pdf, 8) {
			addTableHeader(pdf, "A3. ALGORITMA KEPUTUSAN TRIAGE (Lanjutan)")
			printA3TableHeader()
		}

		active := "[ ]"
		isSelected := row.Code == triageLevel
		if isSelected {
			active = "[v]"
			pdf.SetFillColor(220, 252, 231)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		pdf.CellFormat(16, 6, active, "1", 0, "C", isSelected, 0, "")
		pdf.CellFormat(30, 6, "L"+row.Code+" - "+row.Level, "1", 0, "L", isSelected, 0, "")
		pdf.CellFormat(72, 6, row.Action, "1", 0, "L", isSelected, 0, "")
		pdf.CellFormat(30, 6, row.SLA, "1", 0, "C", isSelected, 0, "")
		pdf.CellFormat(32, 6, row.Zone, "1", 1, "L", isSelected, 0, "")
	}

	reAssessmentText := "Ulang triage bila kondisi berubah atau setelah intervensi"
	if triageLevel == "1" || triageLevel == "2" || riskCount >= 2 {
		reAssessmentText = "Re-assessment ketat tiap 5-15 menit sampai stabil"
	} else if triageLevel == "3" {
		reAssessmentText = "Re-assessment tiap 30 menit atau jika ada perburukan"
	}

	checkPageBreak(pdf, 8)

	pdf.SetFont("Arial", "I", 7)
	pdf.CellFormat(contentWidth, 5, fmt.Sprintf("Ringkasan: Level %s aktif, Risiko Positif %d, %s", safeString(triageLevel), riskCount, reAssessmentText), "1", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	addTableEnd(pdf)

	// Primary Survey (ABC)
	addTableHeader(pdf, "B. PRIMARY SURVEY (ABC)")
	airwayDisplay := strings.ReplaceAll(safeString(airway), "_", " ")
	airwayDisplay = strings.Title(strings.ToLower(airwayDisplay))
	if airwayNote != "" {
		airwayDisplay += " - " + airwayNote
	}
	addTableRow(pdf, "Airway", airwayDisplay, 45)
	breathingDisplay := strings.ReplaceAll(safeString(breathing), "_", " ")
	breathingDisplay = strings.Title(strings.ToLower(breathingDisplay))
	if breathingNote != "" {
		breathingDisplay += " - " + breathingNote
	}
	addTableRow(pdf, "Breathing", breathingDisplay, 45)
	if breathingRate != "" {
		addTableRow(pdf, "Frekuensi Napas", breathingRate+" x/menit", 45)
	}
	circulationDisplay := strings.ReplaceAll(safeString(circulation), "_", " ")
	circulationDisplay = strings.Title(strings.ToLower(circulationDisplay))
	if circulationNote != "" {
		circulationDisplay += " - " + circulationNote
	}
	addTableRow(pdf, "Circulation", circulationDisplay, 45)
	addTableEnd(pdf)

	// Neurological
	addTableHeader(pdf, "C. STATUS NEUROLOGIS")
	gcsTotal := gcsE + gcsV + gcsM
	gcsStr := fmt.Sprintf("E%d V%d M%d = %d", gcsE, gcsV, gcsM, gcsTotal)
	addTableRow(pdf, "GCS (E/V/M)", gcsStr, 45)
	if consciousness != "" {
		addTableRow(pdf, "Kesadaran", safeString(consciousness), 45)
	}
	addTableEnd(pdf)

	// Vital Signs
	addTableHeader(pdf, "D. TANDA VITAL")
	if bloodPressure != "" {
		addTableRow(pdf, "Tekanan Darah", safeString(bloodPressure)+" mmHg", 45)
	}
	if heartRate != "" {
		addTableRow(pdf, "Nadi", safeString(heartRate)+" x/menit", 45)
	}
	if temperature != "" {
		addTableRow(pdf, "Suhu", safeString(temperature)+" C", 45)
	}
	if oxygenSaturation != "" {
		addTableRow(pdf, "SpO2", safeString(oxygenSaturation)+" %%", 45)
	}
	if painMethod != "" {
		painMethodDisplay := strings.ReplaceAll(safeString(painMethod), "_", " ")
		painMethodDisplay = strings.Title(strings.ToLower(painMethodDisplay))
		addTableRow(pdf, "Metode Nyeri", painMethodDisplay, 45)
	}

	// Color-coded pain scale severity for faster clinical interpretation.
	if painScale >= 7 {
		pdf.SetTextColor(220, 38, 38)
	} else if painScale >= 4 {
		pdf.SetTextColor(217, 119, 6)
	} else {
		pdf.SetTextColor(22, 163, 74)
	}
	painScaleDisplay := fmt.Sprintf("%d/10", painScale)
	if painLocation != "" {
		painScaleDisplay += " | Lokasi: " + formatEnumDisplay(painLocation)
	}
	addTableRow(pdf, "Skala/Lokasi Nyeri", painScaleDisplay, 45)
	pdf.SetTextColor(0, 0, 0)
	addTableEnd(pdf)

	// Secondary Survey (peripheral perfusion)
	if crt != "" {
		addTableHeader(pdf, "E. SURVEI SEKUNDER")
		if crt != "" {
			addTableRow(pdf, "CRT", safeString(crt), 45)
		}
		addTableEnd(pdf)
	}

	// Assessment
	addTableHeader(pdf, "F. ASESMEN & TINDAKAN SEGERA")
	addTableMultiRow(pdf, "Asesmen Triage", safeString(triageAssessment), 45)
	addTableMultiRow(pdf, "Tindakan Segera", safeString(immediateActions), 45)
	addTableEnd(pdf)

	// Signature
	if triagerName == "" {
		triagerName = "-"
	}
	addDualSignature(pdf, hospitalInfo.City, triagerName, models.DocTypeTriage, visit.ID,
		rmDupSignatureLookup(c, models.DocTypeRMDupTriage))

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Triage_%s.pdf", visit.VisitNumber)
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupTriage, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupTriage, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeTriage, visit.ID}); isSigned {
			go storeCachedPDF(models.DocTypeTriage, visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

func printBedTransferImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}
	vid, _ := strconv.ParseUint(visitID, 10, 32)
	rmDupCacheIDStr := c.Query("rm_duplicate_id")

	// Cache check (signed documents only)
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupBedTransfer, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		if pdfData, fileName, found := getCachedPDF(models.DocTypeBedTransfer, uint(vid)); found {
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

	// Load Bed Transfer records
	clinicalDB := getClinicalDB(c)
	var transfers []models.BedTransfer
	if err := clinicalDB.
		Preload("FromRoom").Preload("FromBed").
		Preload("ToRoom").Preload("ToBed").
		Preload("CreatedBy").
		Where("visit_id = ?", visitID).
		Order("transfer_date ASC").
		Find(&transfers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data mutasi pasien"})
		return
	}

	if len(transfers) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data mutasi pasien tidak ditemukan"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "LEMBAR MUTASI PASIEN", "")

	// Patient Info
	addPatientInfoTable(pdf, patient, &visit)

	// Transfer Records
	addTableHeader(pdf, "RIWAYAT MUTASI / PINDAH KAMAR")

	for i, t := range transfers {
		checkPageBreak(pdf, 40)

		// Transfer number
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(contentWidth, 6, fmt.Sprintf(" Mutasi #%d - %s", i+1, formatDateIndonesian(t.TransferDate)), "1", 1, "L", true, 0, "")

		pdf.SetFont("Arial", "", 9)
		// From
		fromRoom := "-"
		fromBed := "-"
		if t.FromRoom != nil {
			fromRoom = t.FromRoom.Name
		}
		if t.FromBed != nil {
			fromBed = t.FromBed.BedNumber
		}
		addTableRow(pdf, "Dari Ruangan", fmt.Sprintf("%s - Bed %s", fromRoom, fromBed), 45)

		// To
		toRoom := "-"
		toBed := "-"
		if t.ToRoom != nil {
			toRoom = t.ToRoom.Name
		}
		if t.ToBed != nil {
			toBed = t.ToBed.BedNumber
		}
		addTableRow(pdf, "Ke Ruangan", fmt.Sprintf("%s - Bed %s", toRoom, toBed), 45)

		// Transfer type
		transferType := t.TransferType
		switch transferType {
		case "upgrade":
			transferType = "Naik Kelas"
		case "downgrade":
			transferType = "Turun Kelas"
		case "medical":
			transferType = "Kebutuhan Medis"
		case "request":
			transferType = "Permintaan Pasien"
		}
		addTableRow(pdf, "Jenis Transfer", safeString(transferType), 45)

		if t.OldInpatientClass != "" || t.NewInpatientClass != "" {
			// Map class IDs to display names
			classMap := map[string]string{
				"vvip":      "VVIP",
				"vip":       "VIP",
				"kelas_1":   "Kelas 1",
				"kelas_2":   "Kelas 2",
				"kelas_3":   "Kelas 3",
				"icu":       "ICU",
				"nicu":      "NICU",
				"picu":      "PICU",
				"non_kelas": "Non Kelas",
			}
			oldClass := t.OldInpatientClass
			newClass := t.NewInpatientClass
			if text, ok := classMap[oldClass]; ok {
				oldClass = text
			}
			if text, ok := classMap[newClass]; ok {
				newClass = text
			}
			classChange := fmt.Sprintf("%s ke %s", safeString(oldClass), safeString(newClass))
			addTableRow(pdf, "Perubahan Kelas", classChange, 45)
		}

		if t.TransferReason != "" {
			addTableMultiRow(pdf, "Alasan", t.TransferReason, 45)
		}

		if t.Notes != "" {
			addTableMultiRow(pdf, "Catatan", t.Notes, 45)
		}

		// Officer
		officer := "-"
		if t.CreatedBy != nil {
			officer = t.CreatedBy.FullName
		}
		addTableRow(pdf, "Petugas", officer, 45)

		pdf.SetY(pdf.GetY() + 3)
	}

	// Document-level signature (for cetakan TTD)
	btDoctorName := "-"
	if visit.Doctor != nil {
		btDoctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, btDoctorName)
	}
	addDualSignature(pdf, hospitalInfo.City, btDoctorName, models.DocTypeBedTransfer, visit.ID,
		rmDupSignatureLookup(c, models.DocTypeRMDupBedTransfer))

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Mutasi_Pasien_%s.pdf", visit.VisitNumber)
	if rmDupCacheIDStr != "" {
		rmDupID, _ := strconv.ParseUint(rmDupCacheIDStr, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupBedTransfer, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupBedTransfer, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeBedTransfer, visit.ID}); isSigned {
			go storeCachedPDF(models.DocTypeBedTransfer, visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintUnitTransfer prints the outpatient/emergency unit transfer sheet
// GET /api/print/unit-transfer/:visitId
func printUnitTransferImpl(c *gin.Context) {
	visitID := c.Param("visitId")

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

	// Load unit transfer records
	var transfers []models.UnitTransfer
	if err := database.DB.
		Preload("FromRoom").
		Preload("FromDoctor").
		Preload("ToRoom").
		Preload("ToDoctor").
		Preload("CreatedBy").
		Where("visit_id = ?", visitID).
		Order("transfer_date ASC").
		Find(&transfers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data mutasi unit"})
		return
	}

	if len(transfers) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data mutasi unit tidak ditemukan"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "LEMBAR MUTASI UNIT", "")

	// Patient Info
	addPatientInfoTable(pdf, patient, &visit)

	// Transfer Records
	addTableHeader(pdf, "RIWAYAT MUTASI UNIT / RUANGAN")

	for i, t := range transfers {
		checkPageBreak(pdf, 45)

		// Transfer number
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(contentWidth, 6, fmt.Sprintf(" Mutasi Unit #%d - %s", i+1, formatDateTimeIndonesian(t.TransferDate)), "1", 1, "L", true, 0, "")

		pdf.SetFont("Arial", "", 9)

		fromRoom := "-"
		if t.FromRoom != nil {
			fromRoom = t.FromRoom.Name
		}
		toRoom := "-"
		if t.ToRoom != nil {
			toRoom = t.ToRoom.Name
		}
		addTableRow(pdf, "Dari Unit", fromRoom, 45)
		addTableRow(pdf, "Ke Unit", toRoom, 45)

		fromDoctor := "-"
		if t.FromDoctor != nil {
			fromDoctor = resolveAssignedUserNameFromEmployee(t.FromDoctor, fromDoctor)
		}
		toDoctor := "-"
		if t.ToDoctor != nil {
			toDoctor = resolveAssignedUserNameFromEmployee(t.ToDoctor, toDoctor)
		}
		addTableRow(pdf, "Dokter Asal", fromDoctor, 45)
		addTableRow(pdf, "Dokter Tujuan", toDoctor, 45)

		if t.TransferReason != "" {
			addTableMultiRow(pdf, "Alasan", t.TransferReason, 45)
		}
		if t.Notes != "" {
			addTableMultiRow(pdf, "Catatan", t.Notes, 45)
		}

		officer := "-"
		if t.CreatedBy != nil {
			officer = t.CreatedBy.FullName
		}
		addTableRow(pdf, "Petugas", officer, 45)

		pdf.SetY(pdf.GetY() + 3)
	}

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addDualSignature(pdf, hospitalInfo.City, doctorName, "", 0)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Mutasi_Unit_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

func printReferralLetterImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	// Cache check
	rmDuplicateID := c.Query("rm_duplicate_id")
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupReferral, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		vid, _ := strconv.ParseUint(visitID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeReferralLetter, uint(vid)); found {
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

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Load disposition with referral data
	var disposition models.Disposition
	if err := clinicalVisitQuery(c, visitID).Where("disposition_type = ?", "rujuk").First(&disposition).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data rujukan tidak ditemukan. Pastikan disposisi pasien adalah 'Rujuk'."})
		return
	}

	// Load diagnoses
	var diagnoses []models.Diagnosis
	clinicalVisitQuery(c, visitID).Find(&diagnoses)

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "SURAT RUJUKAN", "")

	// Nomor Surat dan Tanggal
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(contentWidth, 6, "Nomor: "+visit.VisitNumber+"/RUJ/"+time.Now().Format("01/2006"), "", 1, "L", false, 0, "")
	pdf.CellFormat(contentWidth, 6, "Lampiran: -", "", 1, "L", false, 0, "")
	pdf.CellFormat(contentWidth, 6, "Perihal: Rujukan Pasien", "", 1, "L", false, 0, "")
	pdf.Ln(5)

	// Kepada
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(contentWidth, 6, "Kepada Yth.", "", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(contentWidth, 6, safeString(disposition.ReferralFacility), "", 1, "L", false, 0, "")
	if disposition.ReferralSpecialist != "" {
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(contentWidth, 6, "Bagian: "+disposition.ReferralSpecialist, "", 1, "L", false, 0, "")
	}
	if disposition.ReferralAddress != "" {
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(contentWidth, 6, "di "+disposition.ReferralAddress, "", 1, "L", false, 0, "")
	}
	pdf.Ln(5)

	// Opening
	pdf.SetFont("Arial", "", 10)
	pdf.MultiCell(contentWidth, 5, "Dengan hormat,\nBersama ini kami rujuk pasien dengan data sebagai berikut:", "", "L", false)
	pdf.Ln(3)

	// Patient Data
	addTableHeader(pdf, "DATA PASIEN")
	addTableRow(pdf, "Nama Lengkap", patient.NamaLengkap, 40)
	addTableRow(pdf, "No. Rekam Medis", patient.NoRM, 40)
	// Format birth date and age
	birthDateStr := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDateStr = formatDateIndonesian(patient.TanggalLahir.Time) + " (" + fmt.Sprintf("%d", calculateAgeYears(patient.TanggalLahir.Time)) + " tahun)"
	}
	addTableRow(pdf, "Tanggal Lahir", birthDateStr, 40)
	// Format gender
	genderStr := string(patient.JenisKelamin)
	if genderStr == "L" {
		genderStr = "Laki-laki"
	} else if genderStr == "P" {
		genderStr = "Perempuan"
	}
	addTableRow(pdf, "Jenis Kelamin", genderStr, 40)
	addTableRow(pdf, "NIK", safeString(patient.NIK), 40)
	addTableRow(pdf, "Alamat", safeString(patient.AlamatKTP), 40)
	addTableRow(pdf, "No. HP", safeString(patient.NoHP), 40)
	addTableEnd(pdf)

	// Referral Info
	addTableHeader(pdf, "INFORMASI RUJUKAN")
	// Format urgency
	urgencyDisplay := disposition.ReferralUrgency
	urgencyMap := map[string]string{"cito": "CITO", "urgent": "Urgent", "elektif": "Elektif"}
	if text, ok := urgencyMap[urgencyDisplay]; ok {
		urgencyDisplay = text
	}
	addTableRow(pdf, "Urgensi", safeString(urgencyDisplay), 40)
	addTableMultiRow(pdf, "Alasan Rujukan", safeString(disposition.ReferralReason), 40)
	addTableEnd(pdf)

	// Diagnosis
	if len(diagnoses) > 0 || disposition.ReferralDiagnosis != "" {
		addTableHeader(pdf, "DIAGNOSIS")
		if disposition.ReferralDiagnosis != "" {
			addTableFullRow(pdf, disposition.ReferralDiagnosis, false)
		} else {
			for _, dx := range diagnoses {
				dxType := "Sekunder"
				if dx.Type == "primary" {
					dxType = "Primer"
				}
				dxStr := fmt.Sprintf("%s - %s (%s)", dx.ICD10Code, dx.ICD10Name, dxType)
				addTableFullRow(pdf, dxStr, false)
			}
		}
		addTableEnd(pdf)
	}

	// Therapy given
	if disposition.ReferralTherapy != "" {
		addTableHeader(pdf, "TERAPI YANG SUDAH DIBERIKAN")
		addTableFullRow(pdf, disposition.ReferralTherapy, false)
		addTableEnd(pdf)
	}

	// Lab results
	if disposition.ReferralLabResult != "" {
		addTableHeader(pdf, "HASIL PEMERIKSAAN PENUNJANG")
		addTableFullRow(pdf, disposition.ReferralLabResult, false)
		addTableEnd(pdf)
	}

	// Additional notes
	if disposition.ReferralNotes != "" {
		addTableHeader(pdf, "CATATAN")
		addTableFullRow(pdf, disposition.ReferralNotes, false)
		addTableEnd(pdf)
	}

	// Closing
	pdf.Ln(5)
	pdf.SetFont("Arial", "", 10)
	pdf.MultiCell(contentWidth, 5, "Demikian surat rujukan ini kami buat, atas perhatian dan kerjasamanya kami ucapkan terima kasih.", "", "L", false)

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addDualSignature(pdf, hospitalInfo.City, doctorName, models.DocTypeReferralLetter, visit.ID,
		rmDupSignatureLookup(c, models.DocTypeRMDupReferral))

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Rujukan_%s.pdf", visit.VisitNumber)
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupReferral, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupReferral, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeReferralLetter, visit.ID}); isSigned {
			go storeCachedPDF(models.DocTypeReferralLetter, visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintInpatientCertificate prints inpatient certificate (Surat Keterangan Rawat Inap)
// GET /api/print/inpatient-certificate/:visitId
func printInpatientCertificateImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	// Cache check
	rmDuplicateID := c.Query("rm_duplicate_id")
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupInpatientCert, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		vid, _ := strconv.ParseUint(visitID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeInpatientCert, uint(vid)); found {
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
		Preload("Bed.RoomUnit").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Validate this is an inpatient visit
	if visit.AdmissionTime == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bukan kunjungan rawat inap"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Load primary diagnosis
	var diagnosis models.Diagnosis
	clinicalVisitQuery(c, visitID).Where("type = ?", "primary").First(&diagnosis)

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "SURAT KETERANGAN RAWAT INAP", "")

	// Nomor Surat
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(contentWidth, 6, "Nomor: "+visit.VisitNumber+"/SKR/"+time.Now().Format("01/2006"), "", 1, "C", false, 0, "")
	pdf.Ln(8)

	// Opening
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(contentWidth, 6, "Yang bertanda tangan di bawah ini, Dokter pada "+hospitalInfo.Name+", menerangkan bahwa:", "", "L", false)
	pdf.Ln(5)

	// Patient Data Table
	addTableHeader(pdf, "DATA PASIEN")
	addTableRow(pdf, "Nama Lengkap", patient.NamaLengkap, 45)
	addTableRow(pdf, "No. Rekam Medis", patient.NoRM, 45)
	// Format birth date and age
	birthDateStr := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDateStr = formatDateIndonesian(patient.TanggalLahir.Time) + " (" + fmt.Sprintf("%d", calculateAgeYears(patient.TanggalLahir.Time)) + " tahun)"
	}
	addTableRow(pdf, "Tanggal Lahir", birthDateStr, 45)
	// Format gender
	genderStr := string(patient.JenisKelamin)
	if genderStr == "L" {
		genderStr = "Laki-laki"
	} else if genderStr == "P" {
		genderStr = "Perempuan"
	}
	addTableRow(pdf, "Jenis Kelamin", genderStr, 45)
	addTableRow(pdf, "NIK", safeString(patient.NIK), 45)
	addTableRow(pdf, "Alamat", safeString(patient.AlamatKTP), 45)
	addTableEnd(pdf)

	// Inpatient Data
	addTableHeader(pdf, "DATA RAWAT INAP")

	// Admission time
	admissionStr := "-"
	if visit.AdmissionTime != nil {
		admissionStr = formatDateIndonesian(*visit.AdmissionTime) + ", " + visit.AdmissionTime.Format("15:04") + " WIB"
	}
	addTableRow(pdf, "Tanggal Masuk", admissionStr, 45)

	// Discharge time
	dischargeStr := "Masih dalam perawatan"
	if visit.DischargeTime != nil {
		dischargeStr = formatDateIndonesian(*visit.DischargeTime) + ", " + visit.DischargeTime.Format("15:04") + " WIB"
	}
	addTableRow(pdf, "Tanggal Keluar", dischargeStr, 45)

	// Duration
	durationStr := "-"
	if visit.DischargeTime != nil && visit.AdmissionTime != nil {
		duration := visit.DischargeTime.Sub(*visit.AdmissionTime)
		days := int(duration.Hours() / 24)
		if days == 0 {
			days = 1
		}
		durationStr = fmt.Sprintf("%d hari", days)
	} else if visit.InpatientDays > 0 {
		durationStr = fmt.Sprintf("%d hari", visit.InpatientDays)
	}
	addTableRow(pdf, "Lama Rawat", durationStr, 45)

	// Room
	roomStr := "-"
	if visit.Room != nil {
		roomStr = visit.Room.Name
	}
	addTableRow(pdf, "Ruangan", roomStr, 45)

	// Bed
	bedStr := "-"
	if visit.Bed != nil {
		bedStr = visit.Bed.BedNumber
		if visit.Bed.RoomUnit != nil {
			bedStr = visit.Bed.RoomUnit.Name + " - " + bedStr
		}
	}
	addTableRow(pdf, "Tempat Tidur", bedStr, 45)

	// Class
	classDisplay := visit.InpatientClass
	classMap := map[string]string{
		"vvip":    "VVIP",
		"vip":     "VIP",
		"kelas_1": "Kelas 1",
		"kelas_2": "Kelas 2",
		"kelas_3": "Kelas 3",
		"icu":     "ICU",
		"nicu":    "NICU",
		"picu":    "PICU",
	}
	if text, ok := classMap[classDisplay]; ok {
		classDisplay = text
	}
	addTableRow(pdf, "Kelas", safeString(classDisplay), 45)

	// Diagnosis
	if diagnosis.ID > 0 {
		dxStr := diagnosis.ICD10Code + " - " + diagnosis.ICD10Name
		addTableRow(pdf, "Diagnosis", dxStr, 45)
	}

	// Doctor
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addTableRow(pdf, "Dokter Penanggung Jawab", doctorName, 45)
	addTableEnd(pdf)

	// Closing
	pdf.Ln(5)
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(contentWidth, 6, "Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.", "", "L", false)

	// Signature
	doctorName = "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addDualSignature(pdf, hospitalInfo.City, doctorName, models.DocTypeInpatientCert, visit.ID,
		rmDupSignatureLookup(c, models.DocTypeRMDupInpatientCert))

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Keterangan_Rawat_Inap_%s.pdf", visit.VisitNumber)
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupInpatientCert, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupInpatientCert, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeInpatientCert, visit.ID}); isSigned {
			go storeCachedPDF(models.DocTypeInpatientCert, visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}
