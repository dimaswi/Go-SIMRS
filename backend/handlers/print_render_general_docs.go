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

func printInformedConsentImpl(c *gin.Context) {
	patientID, err := strconv.Atoi(c.Param("patientId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}
	if visitIDStr := c.Query("visit_id"); visitIDStr != "" {
		if visitUint, parseErr := strconv.ParseUint(visitIDStr, 10, 32); parseErr == nil {
			prepareCasemixPrintData(c, uint(visitUint))
		}
	}

	// Cache check
	rmDuplicateID := c.Query("rm_duplicate_id")
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupConsent, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		if pdfData, fileName, found := getCachedPDF(models.DocTypeInformedConsent, uint(patientID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	var patient models.Patient
	if err := database.DB.First(&patient, patientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	// Get the logged-in user who prints this document
	staffName := ""
	if userID, exists := c.Get("user_id"); exists {
		var user models.User
		if err := database.DB.First(&user, userID).Error; err == nil {
			staffName = user.FullName
		}
	}

	info := getHospitalInfo()

	// Create A4 PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(true, marginBottom)
	pdf.AddPage()

	// KOP Header
	addHeader(pdf, info, "FORMULIR PERSETUJUAN UMUM", "(GENERAL CONSENT)")

	// Patient Info Section
	labelW := 40.0
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA PASIEN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)

	col1 := 40.0
	col2 := 50.0
	col3 := 35.0
	col4 := 55.0

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
	pdf.CellFormat(col2, rowHeight, " "+truncateText(patient.NamaLengkap, 25), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowHeight, " Tanggal Lahir", "1", 0, "L", true, 0, "")
	birthDate := "-"
	age := ""
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = patient.TanggalLahir.Format("02-01-2006")
		age = fmt.Sprintf(" (%d th)", calculateAgeYears(patient.TanggalLahir.Time))
	}
	pdf.CellFormat(col4, rowHeight, " "+birthDate+age, "1", 1, "L", false, 0, "")

	// Row 3: Alamat (full width)
	pdf.CellFormat(col1, rowHeight, " Alamat", "1", 0, "L", true, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+truncateText(alamat, 68), "1", 1, "L", false, 0, "")

	// Row 4: No HP | Penanggung Jawab
	pdf.CellFormat(col1, rowHeight, " No. HP", "1", 0, "L", true, 0, "")
	phone := patient.NoHP
	if phone == "" {
		phone = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+phone, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Penanggung Jawab", "1", 0, "L", true, 0, "")
	pj := patient.NamaPenanggungJawab
	if pj == "" {
		pj = "-"
	}
	hubPj := patient.HubunganPenanggungJawab
	if hubPj != "" {
		pj = pj + " (" + hubPj + ")"
	}
	pdf.CellFormat(col4, rowHeight, " "+truncateText(pj, 28), "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 4)
	_ = labelW // suppress unused warning

	// Consent Body
	pdf.SetFont("Arial", "", 9)
	lineH := 4.5

	// Introduction
	introText := "Yang bertanda tangan di bawah ini, saya selaku pasien/wali dari pasien tersebut di atas, dengan ini menyatakan PERSETUJUAN terhadap hal-hal sebagai berikut:"
	pdf.MultiCell(contentWidth, lineH, introText, "", "J", false)
	pdf.SetY(pdf.GetY() + 2)

	// Consent items
	type consentItem struct {
		title   string
		content string
	}

	items := []consentItem{
		{
			title:   "Persetujuan Pelayanan Kesehatan",
			content: "Saya menyetujui untuk menerima pelayanan kesehatan berupa pemeriksaan fisik, pemeriksaan penunjang (laboratorium, radiologi, dan pemeriksaan diagnostik lainnya), serta tindakan medis dan keperawatan yang diperlukan sesuai dengan standar profesi dan standar prosedur operasional yang berlaku di rumah sakit ini.",
		},
		{
			title:   "Persetujuan Perekaman dan Pendokumentasian Medis",
			content: "Saya menyetujui perekaman/pencatatan informasi mengenai riwayat kesehatan, hasil pemeriksaan, diagnosis, pengobatan/tindakan medis, dan informasi kesehatan lainnya ke dalam rekam medis pasien. Saya memahami bahwa rekam medis tersebut merupakan milik rumah sakit dan akan dijaga kerahasiaannya sesuai dengan peraturan perundang-undangan yang berlaku.",
		},
		{
			title:   "Hak dan Kewajiban Pasien",
			content: "Saya telah menerima penjelasan mengenai hak dan kewajiban pasien sesuai dengan Undang-Undang Nomor 44 Tahun 2009 tentang Rumah Sakit dan peraturan terkait lainnya, termasuk: (a) hak memperoleh informasi tentang diagnosis, tindakan medis, dan alternatif pengobatan; (b) hak memberikan persetujuan atau menolak tindakan medis; (c) hak atas privasi dan kerahasiaan penyakit; (d) hak memperoleh keamanan dan keselamatan selama perawatan; serta (e) kewajiban memberikan informasi yang lengkap dan jujur tentang masalah kesehatannya.",
		},
		{
			title:   "Pelepasan Informasi / Kerahasiaan Medis",
			content: "Saya menyetujui pelepasan informasi medis kepada pihak-pihak yang berwenang sesuai dengan ketentuan peraturan perundang-undangan, termasuk namun tidak terbatas pada: (a) pihak penjamin biaya perawatan (BPJS Kesehatan/asuransi); (b) pihak berwenang sesuai ketentuan hukum; dan (c) tenaga kesehatan lain yang terlibat dalam perawatan pasien. Selain pihak tersebut, pelepasan informasi medis hanya dapat dilakukan dengan persetujuan tertulis dari pasien/wali pasien.",
		},
		{
			title:   "Privasi dan Kerahasiaan",
			content: "Saya memahami bahwa rumah sakit menjamin privasi dan kerahasiaan seluruh informasi kesehatan pasien. Setiap petugas rumah sakit yang memiliki akses terhadap informasi medis pasien terikat kewajiban menjaga kerahasiaan sesuai dengan sumpah profesi dan kode etik masing-masing.",
		},
		{
			title:   "Tanggung Jawab Pembiayaan",
			content: "Saya bertanggung jawab atas seluruh biaya pelayanan kesehatan yang diterima pasien di rumah sakit ini. Apabila pasien merupakan peserta jaminan kesehatan (BPJS/asuransi), saya bertanggung jawab atas selisih biaya yang tidak ditanggung oleh penjamin. Saya memahami bahwa biaya dapat berubah sesuai dengan pelayanan yang diberikan.",
		},
		{
			title:   "Barang Berharga / Valuables",
			content: "Saya memahami bahwa rumah sakit tidak bertanggung jawab atas kehilangan atau kerusakan barang berharga milik pasien (uang, perhiasan, perangkat elektronik, dan barang berharga lainnya) selama pasien berada di lingkungan rumah sakit, kecuali barang tersebut dititipkan secara resmi kepada petugas yang ditunjuk.",
		},
		{
			title:   "Persetujuan Tata Tertib Rumah Sakit",
			content: "Saya bersedia mematuhi seluruh tata tertib dan peraturan yang berlaku di rumah sakit ini, termasuk jam besuk, larangan merokok, ketentuan penunggu pasien, dan peraturan lainnya demi kenyamanan dan keselamatan bersama.",
		},
	}

	for i, item := range items {
		checkPageBreak(pdf, 20)

		// Numbered title
		pdf.SetFont("Arial", "B", 9)
		titleText := fmt.Sprintf("%d. %s", i+1, item.title)
		pdf.MultiCell(contentWidth, lineH, titleText, "", "L", false)

		// Content - indented
		pdf.SetFont("Arial", "", 9)
		pdf.SetX(marginLeft + 5)
		pdf.MultiCell(contentWidth-5, lineH, item.content, "", "J", false)
		pdf.SetY(pdf.GetY() + 2)
	}

	// Closing statement
	checkPageBreak(pdf, 80)
	pdf.SetY(pdf.GetY() + 3)
	pdf.SetFont("Arial", "", 9)
	closingText := "Dengan menandatangani formulir ini, saya menyatakan bahwa saya telah membaca, memahami, dan menyetujui seluruh isi persetujuan umum di atas. Saya juga menyatakan bahwa informasi yang saya berikan adalah benar dan dapat dipertanggungjawabkan."
	pdf.MultiCell(contentWidth, lineH, closingText, "", "J", false)

	// Signature Area
	checkPageBreak(pdf, 65)
	pdf.SetY(pdf.GetY() + 8)

	// Date
	dateStr := formatDateIndonesian(time.Now())
	city := info.City
	if city == "" {
		city = "Jakarta" // fallback
	}
	locationDate := city + ", " + dateStr

	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(contentWidth, lineH, locationDate, "", 1, "R", false, 0, "")
	pdf.SetY(pdf.GetY() + 3)

	// Two column signatures (dynamic from document-signature settings)
	sigWidth := 80.0
	gap := contentWidth - sigWidth*2
	startY := pdf.GetY()
	columnSlots := []string{"patient", "nurse"} // default layout
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

	patientName := patient.NamaLengkap
	if patientName == "" {
		patientName = "(...................................)"
	}

	// Override staff name if signed via rm_dup
	consentSigLog, consentIsSigned := findSignatureLog(
		rmDupSignatureLookup(c, models.DocTypeRMDupConsent),
		signatureLookup{models.DocTypeInformedConsent, patient.ID},
	)
	if consentIsSigned {
		staffName = resolveSignedUserName(consentSigLog, staffName)
	}
	if strings.TrimSpace(staffName) == "" {
		staffName = "(...................................)"
	}

	type consentSlotRender struct {
		title  string
		sub    string
		name   string
		signed bool
		log    models.SignatureLog
	}
	resolveConsentSlot := func(slot string) consentSlotRender {
		switch strings.TrimSpace(strings.ToLower(slot)) {
		case "patient":
			return consentSlotRender{
				title: "Yang Menyatakan,",
				sub:   "Pasien / Wali *)",
				name:  patientName,
			}
		case "doctor_dpjp":
			return consentSlotRender{
				title:  "Dokter Penanggung Jawab,",
				sub:    "",
				name:   staffName,
				signed: consentIsSigned,
				log:    consentSigLog,
			}
		case "nurse":
			return consentSlotRender{
				title:  "Petugas Rumah Sakit,",
				sub:    "",
				name:   staffName,
				signed: consentIsSigned,
				log:    consentSigLog,
			}
		default:
			return consentSlotRender{}
		}
	}
	left := resolveConsentSlot(columnSlots[0])
	right := resolveConsentSlot(columnSlots[1])
	left.title = "Slot 1 (Kiri),"
	right.title = "Slot 2 (Kanan),"

	// Left column
	pdf.SetXY(marginLeft, startY)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(sigWidth, lineH, left.title, "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.SetX(marginLeft)
	pdf.CellFormat(sigWidth, lineH, strings.TrimSpace(left.sub), "", 1, "C", false, 0, "")
	if left.signed {
		addSignatureQR(pdf, left.log, marginLeft+sigWidth/2, startY+lineH+12, 16.0, fmt.Sprintf("consent_left_%d", patient.ID))
	}
	pdf.SetY(startY + 35)
	pdf.SetX(marginLeft)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(sigWidth, lineH, left.name, "T", 1, "C", false, 0, "")

	// Right column
	rightSigX := marginLeft + sigWidth + gap
	pdf.SetXY(rightSigX, startY)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(sigWidth, lineH, right.title, "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.SetXY(rightSigX, startY+lineH)
	pdf.CellFormat(sigWidth, lineH, strings.TrimSpace(right.sub), "", 1, "C", false, 0, "")
	if right.signed {
		addSignatureQR(pdf, right.log, rightSigX+sigWidth/2, startY+lineH+12, 16.0, fmt.Sprintf("consent_right_%d", patient.ID))
	}

	// Signature space
	pdf.SetXY(rightSigX, startY+35)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(sigWidth, lineH, right.name, "T", 1, "C", false, 0, "")

	// Footer note
	pdf.SetY(pdf.GetY() + 5)
	pdf.SetFont("Arial", "I", 7)
	pdf.CellFormat(contentWidth, 3, "*) Coret yang tidak perlu. Wali menandatangani apabila pasien tidak mampu/belum cukup umur.", "", 1, "L", false, 0, "")

	// Digital signature footer
	if consentIsSigned {
		addDigitalSignatureFooter(pdf, consentSigLog, models.DocTypeInformedConsent, patient.ID)
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Informed_Consent_%s.pdf", patient.NoRM)
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupConsent, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupConsent, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if consentIsSigned {
			go storeCachedPDF(models.DocTypeInformedConsent, patient.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintAdmissionDischargeSummary generates MR.1 - Ringkasan Masuk dan Keluar Pasien
// Uses registrationId to track the full patient journey across all visits
func printAdmissionDischargeSummaryImpl(c *gin.Context) {
	registrationID := c.Param("registrationId")
	if visitIDStr := c.Query("visit_id"); visitIDStr != "" {
		if visitUint, parseErr := strconv.ParseUint(visitIDStr, 10, 32); parseErr == nil {
			prepareCasemixPrintData(c, uint(visitUint))
		}
	}

	// Cache check
	rmDuplicateID := c.Query("rm_duplicate_id")
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupAdmission, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		rid, _ := strconv.ParseUint(registrationID, 10, 32)
		if pdfData, fileName, found := getCachedPDF("admission_discharge_reg", uint(rid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	// Load registration with patient
	var registration models.Registration
	if err := database.DB.
		Preload("Patient").
		Preload("DestinationRoom").
		Preload("Doctor").
		First(&registration, registrationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}
	if registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}
	patient := registration.Patient

	// Optional visit_id filter — if provided, show only that visit's MR.1
	filterVisitID := c.Query("visit_id")

	// Load ALL visits under this registration, ordered by creation time
	var visits []models.Visit
	database.DB.Where("registration_id = ?", registrationID).
		Preload("Room").
		Preload("Doctor").
		Preload("Bed.RoomUnit").
		Order("created_at ASC").
		Find(&visits)

	if len(visits) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No visits found for this registration"})
		return
	}

	// If a specific visit_id is requested, filter visits to only include that one
	var singleVisitMode bool
	if filterVisitID != "" {
		var filtered []models.Visit
		for _, v := range visits {
			if fmt.Sprintf("%d", v.ID) == filterVisitID {
				filtered = append(filtered, v)
				break
			}
		}
		if len(filtered) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found in this registration"})
			return
		}
		visits = filtered
		singleVisitMode = true
	}

	// Collect all visit IDs for aggregated queries
	visitIDs := make([]uint, len(visits))
	for i, v := range visits {
		visitIDs[i] = v.ID
	}

	// Load discharge medicine orders (from any visit under registration)
	var dischargeMedicineOrders []models.MedicineOrder
	applyCasemixEklaimScope(c, getClinicalDB(c).Where("source_visit_id IN ? AND status <> ? AND is_casemix = ?", visitIDs, models.OrderStatusCancelled, useCasemixClinicalData(c))).
		Where("(fulfillment_type = ?) OR (COALESCE(fulfillment_type, '') = '' AND prescription_type = ?)", models.FulfillmentTypeTakeHome, "discharge").
		Preload("Items.Medicine").Find(&dischargeMedicineOrders)

	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// KOP Header
	subtitle := "(MR.1)"
	if singleVisitMode && len(visits) > 0 {
		mvLbl := visits[0].VisitType
		switch visits[0].VisitType {
		case "outpatient", "consultation":
			mvLbl = "Rawat Jalan"
		case "inpatient":
			mvLbl = "Rawat Inap"
		case "emergency":
			mvLbl = "Gawat Darurat (IGD)"
		}
		subtitle = "(MR.1 - " + mvLbl + ")"
	}
	addHeader(pdf, hospitalInfo, "RINGKASAN MASUK DAN KELUAR", subtitle)

	// =================== DATA PASIEN ===================
	col1 := 35.0
	col2 := 55.0
	col3 := 35.0
	col4 := 55.0

	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA PASIEN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)

	// Row 1: No RM | Jenis Kelamin
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

	// Row 3: NIK | Gol Darah
	pdf.CellFormat(col1, rowHeight, " NIK", "1", 0, "L", true, 0, "")
	nik := patient.NIK
	if nik == "" {
		nik = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+nik, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Gol. Darah", "1", 0, "L", true, 0, "")
	bloodType := string(patient.GolonganDarah)
	if bloodType == "" {
		bloodType = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+bloodType, "1", 1, "L", false, 0, "")

	// Row 4: Alamat (full width)
	pdf.CellFormat(col1, rowHeight, " Alamat", "1", 0, "L", true, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+truncateText(alamat, 72), "1", 1, "L", false, 0, "")

	// Row 5: No HP | Penanggung Jawab
	pdf.CellFormat(col1, rowHeight, " No. HP", "1", 0, "L", true, 0, "")
	phone := patient.NoHP
	if phone == "" {
		phone = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+phone, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Penanggung Jawab", "1", 0, "L", true, 0, "")
	pj := patient.NamaPenanggungJawab
	if pj == "" {
		pj = "-"
	}
	hubPj := patient.HubunganPenanggungJawab
	if hubPj != "" {
		pj = pj + " (" + hubPj + ")"
	}
	pdf.CellFormat(col4, rowHeight, " "+truncateText(pj, 28), "1", 1, "L", false, 0, "")

	// Row 6: Jaminan | No BPJS
	pdf.CellFormat(col1, rowHeight, " Jaminan", "1", 0, "L", true, 0, "")
	jaminan := string(patient.JenisJaminan)
	if jaminan == "" {
		jaminan = "Umum"
	}
	payMethod := registration.PaymentMethod
	if payMethod != "" {
		jaminan = strings.ToUpper(payMethod)
	}
	pdf.CellFormat(col2, rowHeight, " "+jaminan, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " No. BPJS/Asuransi", "1", 0, "L", true, 0, "")
	noBpjs := registration.BPJSNumber
	if noBpjs == "" {
		noBpjs = patient.NoBPJS
	}
	if noBpjs == "" {
		noBpjs = registration.InsuranceNumber
	}
	if noBpjs == "" {
		noBpjs = patient.NoPolisAsuransi
	}
	if noBpjs == "" {
		noBpjs = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+noBpjs, "1", 1, "L", false, 0, "")

	// Row 7: No Registrasi
	pdf.CellFormat(col1, rowHeight, " No. Registrasi", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(col2, rowHeight, " "+registration.RegistrationNumber, "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowHeight, " Jumlah Kunjungan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col4, rowHeight, fmt.Sprintf(" %d kunjungan", len(visits)), "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 2)

	// =================== FILTER MAIN VISITS ===================
	// Main visit types: emergency, consultation/outpatient, inpatient
	var mainVisits []models.Visit
	for _, v := range visits {
		switch v.VisitType {
		case "emergency", "consultation", "outpatient", "inpatient":
			mainVisits = append(mainVisits, v)
		}
	}
	if len(mainVisits) == 0 {
		// Fallback: use all visits
		mainVisits = visits
	}

	// =================== ALUR PELAYANAN (PERJALANAN KUNJUNGAN) ===================
	if !singleVisitMode {
		checkPageBreak(pdf, 20)
		addTableHeader(pdf, "ALUR PELAYANAN")
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(235, 235, 235)
		noW := 10.0
		kunjW := 30.0
		tipeW := 30.0
		ruangW := 40.0
		dokterW := 40.0
		tglW := 30.0
		pdf.CellFormat(noW, rowHeight, " No", "1", 0, "C", true, 0, "")
		pdf.CellFormat(kunjW, rowHeight, " No. Kunjungan", "1", 0, "L", true, 0, "")
		pdf.CellFormat(tipeW, rowHeight, " Jenis", "1", 0, "L", true, 0, "")
		pdf.CellFormat(ruangW, rowHeight, " Ruangan", "1", 0, "L", true, 0, "")
		pdf.CellFormat(dokterW, rowHeight, " Dokter", "1", 0, "L", true, 0, "")
		pdf.CellFormat(tglW, rowHeight, " Status", "1", 1, "L", true, 0, "")
		pdf.SetFont("Arial", "", 8)

		for i, v := range visits {
			checkPageBreak(pdf, 6)
			vType := v.VisitType
			switch v.VisitType {
			case "outpatient", "consultation":
				vType = "Rajal"
			case "inpatient":
				vType = "Ranap"
			case "emergency":
				vType = "IGD"
			case "pharmacy":
				vType = "Farmasi"
			case "lab", "laboratory":
				vType = "Lab"
			case "radiology":
				vType = "Radiologi"
			}
			vRoom := "-"
			if v.Room != nil {
				vRoom = v.Room.Name
			}
			vDoctor := "-"
			if v.Doctor != nil {
				vDoctor = resolveAssignedUserNameFromEmployee(v.Doctor, vDoctor)
			}
			vStatus := v.Status
			switch v.Status {
			case "completed":
				vStatus = "Selesai"
			case "in_progress":
				vStatus = "Berlangsung"
			case "waiting":
				vStatus = "Menunggu"
			case "cancelled":
				vStatus = "Batal"
			}
			pdf.CellFormat(noW, rowHeight, fmt.Sprintf(" %d", i+1), "1", 0, "C", false, 0, "")
			pdf.CellFormat(kunjW, rowHeight, " "+truncateText(v.VisitNumber, 14), "1", 0, "L", false, 0, "")
			pdf.CellFormat(tipeW, rowHeight, " "+vType, "1", 0, "L", false, 0, "")
			pdf.CellFormat(ruangW, rowHeight, " "+truncateText(vRoom, 18), "1", 0, "L", false, 0, "")
			pdf.CellFormat(dokterW, rowHeight, " "+truncateText(vDoctor, 18), "1", 0, "L", false, 0, "")
			pdf.CellFormat(tglW, rowHeight, " "+vStatus, "1", 1, "L", false, 0, "")
		}
		addTableEnd(pdf)
	} // end !singleVisitMode

	// =================== PER-VISIT DETAIL SECTIONS ===================
	lastMainDoctor := "-"
	for mvIdx, mv := range mainVisits {
		// Visit type label
		mvTypeLabel := mv.VisitType
		switch mv.VisitType {
		case "outpatient", "consultation":
			mvTypeLabel = "RAWAT JALAN"
		case "inpatient":
			mvTypeLabel = "RAWAT INAP"
		case "emergency":
			mvTypeLabel = "GAWAT DARURAT (IGD)"
		}

		sectionTitle := mvTypeLabel
		if !singleVisitMode {
			sectionTitle = fmt.Sprintf("PELAYANAN %d: %s", mvIdx+1, mvTypeLabel)
		}

		// ---- Section Header (colored) ----
		checkPageBreak(pdf, 50)
		pdf.SetY(pdf.GetY() + 3)
		pdf.SetFont("Arial", "B", 10)
		pdf.SetFillColor(60, 60, 60) // dark gray header
		pdf.SetTextColor(255, 255, 255)
		pdf.SetDrawColor(60, 60, 60)
		pdf.SetLineWidth(0.3)
		pdf.CellFormat(contentWidth, 7, " "+sectionTitle, "1", 1, "L", true, 0, "")
		pdf.SetTextColor(0, 0, 0)
		pdf.SetDrawColor(0, 0, 0)
		pdf.SetLineWidth(0.2)
		pdf.SetFont("Arial", "", 9)

		// ---- Load per-visit medical data ----
		var mvAnamnesis models.Anamnesis
		clinicalVisitQuery(c, mv.ID).First(&mvAnamnesis)

		var mvPhysicalExam models.PhysicalExamination
		clinicalVisitQuery(c, mv.ID).First(&mvPhysicalExam)

		var mvDiagnoses []models.Diagnosis
		clinicalVisitQuery(c, mv.ID).Order("type ASC, created_at ASC").Find(&mvDiagnoses)

		var mvDisposition models.Disposition
		clinicalVisitQuery(c, mv.ID).First(&mvDisposition)

		var mvVisitProcedures []models.VisitProcedure
		clinicalVisitQuery(c, mv.ID).Preload("Procedure").Find(&mvVisitProcedures)

		var mvProcedureOrders []models.ProcedureOrder
		clinicalSourceVisitQuery(c, mv.ID).Find(&mvProcedureOrders)

		var mvMedicineOrders []models.MedicineOrder
		clinicalSourceVisitQuery(c, mv.ID).Where("status <> ?", models.OrderStatusCancelled).
			Where("(COALESCE(fulfillment_type, '') != ?) AND (prescription_type IS NULL OR prescription_type != ?)", models.FulfillmentTypeTakeHome, "discharge").
			Preload("Items.Medicine").Find(&mvMedicineOrders)

		// ---- DATA MASUK ----
		addTableHeader(pdf, "DATA MASUK")

		// Tanggal & Jam Masuk
		admitDate := "-"
		if mv.CheckInTime != nil {
			admitDate = formatDateTimeIndonesian(*mv.CheckInTime)
		} else if mv.StartTime != nil {
			admitDate = formatDateTimeIndonesian(*mv.StartTime)
		} else if mv.AdmissionTime != nil {
			admitDate = formatDateTimeIndonesian(*mv.AdmissionTime)
		} else {
			admitDate = formatDateTimeIndonesian(mv.CreatedAt)
		}
		addTableRow(pdf, "Tanggal & Jam Masuk", admitDate, 40)

		// Ruangan
		mvRoom := "-"
		if mv.Room != nil {
			mvRoom = mv.Room.Name
		}
		addTableRow(pdf, "Ruangan", mvRoom, 40)

		// Tempat Tidur & Kelas (for inpatient)
		if mv.Bed != nil {
			bedInfo := "Bed " + mv.Bed.BedNumber
			if mv.Bed.RoomUnit != nil {
				bedInfo = mv.Bed.RoomUnit.Name + " - " + bedInfo
			}
			addTableRow(pdf, "Tempat Tidur", bedInfo, 40)
		}
		if mv.InpatientClass != "" {
			addTableRow(pdf, "Kelas Rawat", formatInpatientClass(mv.InpatientClass), 40)
		}

		// DPJP
		mvDoctor := "-"
		if mv.Doctor != nil {
			mvDoctor = resolveAssignedUserNameFromEmployee(mv.Doctor, mvDoctor)
			lastMainDoctor = mvDoctor
		} else if registration.Doctor != nil {
			mvDoctor = resolveAssignedUserNameFromEmployee(registration.Doctor, mvDoctor)
			lastMainDoctor = mvDoctor
		}
		addTableRow(pdf, "DPJP", mvDoctor, 40)

		// Keluhan Utama
		chiefComplaint := "-"
		if mvAnamnesis.ID > 0 && mvAnamnesis.ChiefComplaint != "" {
			chiefComplaint = mvAnamnesis.ChiefComplaint
		} else if mv.Complaint != "" {
			chiefComplaint = mv.Complaint
		} else if registration.Complaint != "" {
			chiefComplaint = registration.Complaint
		}
		addTableMultiRow(pdf, "Keluhan Utama", chiefComplaint, 40)

		// Riwayat Penyakit
		if mvAnamnesis.ID > 0 && mvAnamnesis.HistoryOfPresentIllness != "" {
			addTableMultiRow(pdf, "Riwayat Penyakit", mvAnamnesis.HistoryOfPresentIllness, 40)
		}

		// Alergi (only on first visit)
		if mvIdx == 0 {
			allergyText := "-"
			if mvAnamnesis.ID > 0 && mvAnamnesis.Allergies != "" {
				allergyText = mvAnamnesis.Allergies
			} else {
				allergyParts := []string{}
				if patient.AlergiObat != "" {
					allergyParts = append(allergyParts, "Obat: "+patient.AlergiObat)
				}
				if patient.AlergiMakanan != "" {
					allergyParts = append(allergyParts, "Makanan: "+patient.AlergiMakanan)
				}
				if patient.AlergiLainnya != "" {
					allergyParts = append(allergyParts, "Lainnya: "+patient.AlergiLainnya)
				}
				if len(allergyParts) > 0 {
					allergyText = strings.Join(allergyParts, "; ")
				}
			}
			addTableRow(pdf, "Alergi", allergyText, 40)
		}

		// Diagnosis Masuk
		diagMasuk := "-"
		for _, d := range mvDiagnoses {
			if d.Type == "primary" {
				diagMasuk = d.ICD10Code + " - " + d.ICD10Name
				break
			}
		}
		if diagMasuk == "-" && registration.Complaint != "" && mvIdx == 0 {
			diagMasuk = registration.Complaint
		}
		addTableMultiRow(pdf, "Diagnosis Masuk", diagMasuk, 40)
		addTableEnd(pdf)

		// ---- PEMERIKSAAN FISIK ----
		checkPageBreak(pdf, 25)
		addTableHeader(pdf, "PEMERIKSAAN FISIK")
		if mvPhysicalExam.ID > 0 {
			addTableRow(pdf, "Keadaan Umum", safeString(mvPhysicalExam.GeneralCondition), 40)
			addTableRow(pdf, "Kesadaran", safeString(mvPhysicalExam.Consciousness), 40)

			vitalSigns := []string{}
			if mvPhysicalExam.BloodPressure != "" {
				vitalSigns = append(vitalSigns, "TD: "+mvPhysicalExam.BloodPressure+" mmHg")
			}
			if mvPhysicalExam.HeartRate != "" {
				vitalSigns = append(vitalSigns, "Nadi: "+mvPhysicalExam.HeartRate+" x/mnt")
			}
			if mvPhysicalExam.RespiratoryRate != "" {
				vitalSigns = append(vitalSigns, "RR: "+mvPhysicalExam.RespiratoryRate+" x/mnt")
			}
			if mvPhysicalExam.Temperature != "" {
				vitalSigns = append(vitalSigns, "Suhu: "+mvPhysicalExam.Temperature+" C")
			}
			if mvPhysicalExam.OxygenSaturation != "" {
				vitalSigns = append(vitalSigns, "SpO2: "+mvPhysicalExam.OxygenSaturation+"%")
			}
			if len(vitalSigns) > 0 {
				addTableRow(pdf, "Tanda Vital", strings.Join(vitalSigns, " | "), 40)
			}

			anthro := []string{}
			if mvPhysicalExam.Weight != "" {
				anthro = append(anthro, "BB: "+mvPhysicalExam.Weight+" kg")
			}
			if mvPhysicalExam.Height != "" {
				anthro = append(anthro, "TB: "+mvPhysicalExam.Height+" cm")
			}
			if len(anthro) > 0 {
				addTableRow(pdf, "Antropometri", strings.Join(anthro, " | "), 40)
			}
		} else {
			addTableFullRow(pdf, "Tidak ada data pemeriksaan fisik", false)
		}
		addTableEnd(pdf)

		// ---- DIAGNOSIS ----
		checkPageBreak(pdf, 15)
		addTableHeader(pdf, "DIAGNOSIS")
		if len(mvDiagnoses) > 0 {
			for _, diag := range mvDiagnoses {
				diagType := ""
				switch diag.Type {
				case "primary":
					diagType = "[Utama] "
				case "secondary":
					diagType = "[Sekunder] "
				case "complication":
					diagType = "[Komplikasi] "
				}
				addTableFullRow(pdf, fmt.Sprintf("%s%s - %s", diagType, diag.ICD10Code, diag.ICD10Name), false)
			}
		} else {
			addTableFullRow(pdf, "Belum ada diagnosis", false)
		}
		addTableEnd(pdf)

		// ---- TINDAKAN / PROSEDUR ----
		checkPageBreak(pdf, 15)
		addTableHeader(pdf, "TINDAKAN / PROSEDUR")
		hasTindakan := false
		for _, vp := range mvVisitProcedures {
			procName := "-"
			if vp.Procedure != nil {
				procName = vp.Procedure.Name
			}
			dateStr := ""
			if vp.PerformedAt != nil {
				dateStr = " (" + vp.PerformedAt.Format("02-01-2006") + ")"
			}
			addTableFullRow(pdf, procName+dateStr, false)
			hasTindakan = true
		}
		for _, po := range mvProcedureOrders {
			if po.OrderType == "surgery" && po.Status == "completed" {
				dateStr := ""
				if po.CompletedAt != nil {
					dateStr = " (" + po.CompletedAt.Format("02-01-2006") + ")"
				}
				addTableFullRow(pdf, "[Operasi] "+po.ClinicalNotes+dateStr, false)
				hasTindakan = true
			}
		}
		if !hasTindakan {
			addTableFullRow(pdf, "Tidak ada tindakan", false)
		}
		addTableEnd(pdf)

		// ---- HASIL PENUNJANG ----
		hasPenunjang := false
		for _, po := range mvProcedureOrders {
			if (po.OrderType == "laboratory" || po.OrderType == "radiology") && po.ResultSummary != "" {
				hasPenunjang = true
				break
			}
		}
		if hasPenunjang {
			checkPageBreak(pdf, 15)
			addTableHeader(pdf, "HASIL PENUNJANG")
			for _, po := range mvProcedureOrders {
				if (po.OrderType == "laboratory" || po.OrderType == "radiology") && po.ResultSummary != "" {
					orderLabel := "[Lab] "
					if po.OrderType == "radiology" {
						orderLabel = "[Radiologi] "
					}
					addTableFullRow(pdf, orderLabel+po.ResultSummary, false)
				}
			}
			addTableEnd(pdf)
		}

		// ---- TERAPI / PENGOBATAN ----
		checkPageBreak(pdf, 15)
		addTableHeader(pdf, "TERAPI / PENGOBATAN")
		hasMedicine := false
		for _, mo := range mvMedicineOrders {
			for _, item := range mo.Items {
				medName := "-"
				if item.Medicine != nil {
					medName = item.Medicine.Name
				}
				detail := medName
				if item.Dosage != "" {
					detail += " " + item.Dosage
				}
				if item.Frequency != "" {
					detail += " " + item.Frequency
				}
				addTableFullRow(pdf, detail, false)
				hasMedicine = true
			}
		}
		if !hasMedicine {
			addTableFullRow(pdf, "Tidak ada data terapi", false)
		}
		addTableEnd(pdf)

		// ---- DATA KELUAR ----
		checkPageBreak(pdf, 30)
		addTableHeader(pdf, "DATA KELUAR")

		// Tanggal & Jam Keluar
		dischargeDate := "-"
		if mv.DischargeTime != nil {
			dischargeDate = formatDateTimeIndonesian(*mv.DischargeTime)
		} else if mv.EndTime != nil {
			dischargeDate = formatDateTimeIndonesian(*mv.EndTime)
		}
		addTableRow(pdf, "Tanggal & Jam Keluar", dischargeDate, 40)

		// Lama Rawat per-visit
		mvLos := "-"
		var mvStartT *time.Time
		if mv.CheckInTime != nil {
			mvStartT = mv.CheckInTime
		} else if mv.StartTime != nil {
			mvStartT = mv.StartTime
		} else if mv.AdmissionTime != nil {
			mvStartT = mv.AdmissionTime
		} else {
			mvStartT = &mv.CreatedAt
		}
		var mvEndT *time.Time
		if mv.DischargeTime != nil {
			mvEndT = mv.DischargeTime
		} else if mv.EndTime != nil {
			mvEndT = mv.EndTime
		}
		if mvStartT != nil && mvEndT != nil {
			duration := mvEndT.Sub(*mvStartT)
			days := int(duration.Hours() / 24)
			if days < 1 {
				hours := int(duration.Hours())
				if hours < 1 {
					minutes := int(duration.Minutes())
					mvLos = fmt.Sprintf("%d menit", minutes)
				} else {
					mvLos = fmt.Sprintf("%d jam", hours)
				}
			} else {
				mvLos = fmt.Sprintf("%d hari", days)
			}
		}
		addTableRow(pdf, "Lama Rawat", mvLos, 40)

		// Kondisi Keluar
		mvKondisi := "-"
		if mvDisposition.ID > 0 {
			if mvDisposition.DischargeCondition != "" {
				mvKondisi = mvDisposition.DischargeCondition
			} else if mvDisposition.DischargeStatus != "" {
				mvKondisi = mvDisposition.DischargeStatus
			}
		}
		addTableRow(pdf, "Kondisi Keluar", mvKondisi, 40)

		// Cara Keluar
		mvCaraKeluar := "-"
		if mvDisposition.ID > 0 && mvDisposition.DispositionType != "" {
			switch mvDisposition.DispositionType {
			case "pulang":
				mvCaraKeluar = "Pulang (Sembuh/Membaik)"
			case "rawat_inap":
				mvCaraKeluar = "Rawat Inap"
			case "rujuk":
				mvCaraKeluar = "Dirujuk ke " + safeString(mvDisposition.ReferralFacility)
			case "meninggal":
				mvCaraKeluar = "Meninggal"
			case "aps":
				mvCaraKeluar = "Atas Permintaan Sendiri (APS)"
			case "dod":
				mvCaraKeluar = "Meninggal (DOD)"
			default:
				mvCaraKeluar = mvDisposition.DispositionType
			}
		}
		addTableRow(pdf, "Cara Keluar", mvCaraKeluar, 40)

		// Diagnosis Akhir
		mvDiagAkhir := "-"
		for i := len(mvDiagnoses) - 1; i >= 0; i-- {
			if mvDiagnoses[i].Type == "primary" {
				mvDiagAkhir = mvDiagnoses[i].ICD10Code + " - " + mvDiagnoses[i].ICD10Name
				break
			}
		}
		addTableMultiRow(pdf, "Diagnosis Akhir", mvDiagAkhir, 40)
		addTableEnd(pdf)
	} // end per-visit loop

	// =================== TOTAL LAMA RAWAT ===================
	if len(mainVisits) > 1 {
		checkPageBreak(pdf, 15)
		pdf.SetY(pdf.GetY() + 2)
		addTableHeader(pdf, "RINGKASAN TOTAL")
		// Total lama rawat from first main visit entry to last main visit exit
		totalLos := "-"
		firstMV := mainVisits[0]
		lastMV := mainVisits[len(mainVisits)-1]
		var totalStart *time.Time
		if firstMV.CheckInTime != nil {
			totalStart = firstMV.CheckInTime
		} else if firstMV.StartTime != nil {
			totalStart = firstMV.StartTime
		} else if firstMV.AdmissionTime != nil {
			totalStart = firstMV.AdmissionTime
		} else {
			totalStart = &firstMV.CreatedAt
		}
		var totalEnd *time.Time
		if lastMV.DischargeTime != nil {
			totalEnd = lastMV.DischargeTime
		} else if lastMV.EndTime != nil {
			totalEnd = lastMV.EndTime
		} else if registration.DischargedAt != nil {
			totalEnd = registration.DischargedAt
		}
		if totalStart != nil && totalEnd != nil {
			duration := totalEnd.Sub(*totalStart)
			days := int(duration.Hours() / 24)
			if days < 1 {
				hours := int(duration.Hours())
				if hours < 1 {
					minutes := int(duration.Minutes())
					totalLos = fmt.Sprintf("%d menit", minutes)
				} else {
					totalLos = fmt.Sprintf("%d jam", hours)
				}
			} else {
				totalLos = fmt.Sprintf("%d hari", days)
			}
		}
		addTableRow(pdf, "Total Lama Perawatan", totalLos, 40)
		addTableRow(pdf, "Jumlah Pelayanan Utama", fmt.Sprintf("%d pelayanan", len(mainVisits)), 40)
		addTableEnd(pdf)
	}

	// =================== OBAT PULANG ===================
	checkPageBreak(pdf, 20)
	addTableHeader(pdf, "OBAT PULANG")
	hasObatPulang := false
	if len(dischargeMedicineOrders) > 0 {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(235, 235, 235)
		obatNoW := 10.0
		namaW := 65.0
		dosisW := 35.0
		frekW := 35.0
		instrW := 35.0
		pdf.CellFormat(obatNoW, rowHeight, " No", "1", 0, "C", true, 0, "")
		pdf.CellFormat(namaW, rowHeight, " Nama Obat", "1", 0, "L", true, 0, "")
		pdf.CellFormat(dosisW, rowHeight, " Dosis", "1", 0, "L", true, 0, "")
		pdf.CellFormat(frekW, rowHeight, " Frekuensi", "1", 0, "L", true, 0, "")
		pdf.CellFormat(instrW, rowHeight, " Instruksi", "1", 1, "L", true, 0, "")
		pdf.SetFont("Arial", "", 8)

		no := 1
		for _, mo := range dischargeMedicineOrders {
			for _, item := range mo.Items {
				checkPageBreak(pdf, 6)
				medName := "-"
				if item.Medicine != nil {
					medName = item.Medicine.Name
				}
				pdf.CellFormat(obatNoW, rowHeight, fmt.Sprintf(" %d", no), "1", 0, "C", false, 0, "")
				pdf.CellFormat(namaW, rowHeight, " "+truncateText(medName, 32), "1", 0, "L", false, 0, "")
				pdf.CellFormat(dosisW, rowHeight, " "+truncateText(item.Dosage, 16), "1", 0, "L", false, 0, "")
				pdf.CellFormat(frekW, rowHeight, " "+truncateText(item.Frequency, 16), "1", 0, "L", false, 0, "")
				pdf.CellFormat(instrW, rowHeight, " "+truncateText(item.Instructions, 16), "1", 1, "L", false, 0, "")
				no++
				hasObatPulang = true
			}
		}
	}
	if !hasObatPulang {
		addTableFullRow(pdf, "Tidak ada obat pulang", false)
	}
	addTableEnd(pdf)

	// =================== INSTRUKSI PULANG ===================
	// Find disposition from last main visit that has one
	var finalDisposition models.Disposition
	for i := len(mainVisits) - 1; i >= 0; i-- {
		clinicalVisitQuery(c, mainVisits[i].ID).First(&finalDisposition)
		if finalDisposition.ID > 0 {
			break
		}
	}
	checkPageBreak(pdf, 20)
	addTableHeader(pdf, "INSTRUKSI PULANG / TINDAK LANJUT")
	if finalDisposition.ID > 0 && finalDisposition.DischargeInstruction != "" {
		addTableMultiRow(pdf, "Instruksi", finalDisposition.DischargeInstruction, 40)
	} else {
		addTableFullRow(pdf, "-", false)
	}
	if finalDisposition.ID > 0 && finalDisposition.FollowUpDate != nil {
		addTableRow(pdf, "Jadwal Kontrol", formatDateIndonesian(*finalDisposition.FollowUpDate), 40)
	}
	if finalDisposition.ID > 0 && finalDisposition.FollowUpInstruction != "" {
		addTableMultiRow(pdf, "Catatan Kontrol", finalDisposition.FollowUpInstruction, 40)
	}
	addTableEnd(pdf)

	// =================== TANDA TANGAN ===================
	lastVisitID := uint(0)
	if len(mainVisits) > 0 {
		lastVisitID = mainVisits[len(mainVisits)-1].ID
	}
	addDualSignature(pdf, hospitalInfo.City, lastMainDoctor, models.DocTypeVisitResume, lastVisitID,
		rmDupSignatureLookup(c, models.DocTypeRMDupAdmission))

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("MR1_Ringkasan_Masuk_Keluar_%s_%s.pdf", patient.NoRM, registration.RegistrationNumber)
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupAdmission, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupAdmission, uint(rmDupID), buf.Bytes(), filename)
		}
	} else if lastVisitID > 0 {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeVisitResume, lastVisitID}); isSigned {
			go storeCachedPDF("admission_discharge_reg", registration.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintRegistrationReceipt generates Bukti Registrasi / Tanda Pendaftaran
func printRegistrationReceiptImpl(c *gin.Context) {
	registrationID := c.Param("registrationId")

	// Cache check
	rmDuplicateID := c.Query("rm_duplicate_id")
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupRegistration, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		rid, _ := strconv.ParseUint(registrationID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRegistration, uint(rid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	var registration models.Registration
	if err := database.DB.
		Preload("Patient").
		Preload("DestinationRoom").
		Preload("Doctor").
		Preload("RegisteredBy").
		First(&registration, registrationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}
	if registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}
	patient := registration.Patient

	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// KOP Header
	addHeader(pdf, hospitalInfo, "BUKTI REGISTRASI / TANDA PENDAFTARAN", "")

	// =================== DATA PASIEN ===================
	col1 := 40.0
	col2 := 50.0
	col3 := 40.0
	col4 := 50.0

	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA PASIEN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)

	// Row 1: No RM | Jenis Kelamin
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
	pdf.CellFormat(col2, rowHeight, " "+truncateText(patient.NamaLengkap, 25), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowHeight, " Tanggal Lahir", "1", 0, "L", true, 0, "")
	birthDate := "-"
	age := ""
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = patient.TanggalLahir.Format("02-01-2006")
		age = fmt.Sprintf(" (%d th)", calculateAgeYears(patient.TanggalLahir.Time))
	}
	pdf.CellFormat(col4, rowHeight, " "+birthDate+age, "1", 1, "L", false, 0, "")

	// Row 3: NIK | Gol Darah
	pdf.CellFormat(col1, rowHeight, " NIK", "1", 0, "L", true, 0, "")
	nik := patient.NIK
	if nik == "" {
		nik = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+nik, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Gol. Darah", "1", 0, "L", true, 0, "")
	bloodType := string(patient.GolonganDarah)
	if bloodType == "" {
		bloodType = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+bloodType, "1", 1, "L", false, 0, "")

	// Row 4: Tempat Lahir | Agama
	pdf.CellFormat(col1, rowHeight, " Tempat Lahir", "1", 0, "L", true, 0, "")
	tempatLahir := patient.TempatLahir
	if tempatLahir == "" {
		tempatLahir = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+tempatLahir, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Agama", "1", 0, "L", true, 0, "")
	agama := patient.Agama
	if agama == "" {
		agama = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+agama, "1", 1, "L", false, 0, "")

	// Row 5: Alamat
	pdf.CellFormat(col1, rowHeight, " Alamat", "1", 0, "L", true, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = patient.AlamatDomisili
	}
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+truncateText(alamat, 70), "1", 1, "L", false, 0, "")

	// Row 6: Kelurahan/Kecamatan | Kota
	kelurahan := patient.KelurahanKTP
	if kelurahan == "" {
		kelurahan = patient.KelurahanDomisili
	}
	kecamatan := patient.KecamatanKTP
	if kecamatan == "" {
		kecamatan = patient.KecamatanDomisili
	}
	kelKec := "-"
	if kelurahan != "" || kecamatan != "" {
		parts := []string{}
		if kelurahan != "" {
			parts = append(parts, kelurahan)
		}
		if kecamatan != "" {
			parts = append(parts, kecamatan)
		}
		kelKec = strings.Join(parts, ", ")
	}
	pdf.CellFormat(col1, rowHeight, " Kel./Kec.", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2, rowHeight, " "+truncateText(kelKec, 25), "1", 0, "L", false, 0, "")
	kota := patient.KotaKTP
	if kota == "" {
		kota = patient.KotaDomisili
	}
	if kota == "" {
		kota = "-"
	}
	pdf.CellFormat(col3, rowHeight, " Kota/Kab.", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col4, rowHeight, " "+kota, "1", 1, "L", false, 0, "")

	// Row 7: No. HP | Pekerjaan
	pdf.CellFormat(col1, rowHeight, " No. HP", "1", 0, "L", true, 0, "")
	phone := patient.NoHP
	if phone == "" {
		phone = patient.NoTelepon
	}
	if phone == "" {
		phone = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+phone, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Pekerjaan", "1", 0, "L", true, 0, "")
	pekerjaan := patient.Pekerjaan
	if pekerjaan == "" {
		pekerjaan = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+pekerjaan, "1", 1, "L", false, 0, "")

	// Row 8: Status Perkawinan | Pendidikan
	pdf.CellFormat(col1, rowHeight, " Status Perkawinan", "1", 0, "L", true, 0, "")
	statusKawin := patient.StatusPerkawinan
	if statusKawin == "" {
		statusKawin = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+statusKawin, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Pendidikan", "1", 0, "L", true, 0, "")
	pendidikan := patient.PendidikanTerakhir
	if pendidikan == "" {
		pendidikan = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+pendidikan, "1", 1, "L", false, 0, "")

	// Row 9: Penanggung Jawab | Hub. dgn Pasien
	pdf.CellFormat(col1, rowHeight, " Penanggung Jawab", "1", 0, "L", true, 0, "")
	pj := patient.NamaPenanggungJawab
	if pj == "" {
		pj = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+truncateText(pj, 25), "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Hub. dgn Pasien", "1", 0, "L", true, 0, "")
	hubPj := patient.HubunganPenanggungJawab
	if hubPj == "" {
		hubPj = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+hubPj, "1", 1, "L", false, 0, "")

	// Row 10: Telp. Penanggung Jawab | Alamat PJ
	pdf.CellFormat(col1, rowHeight, " Telp. Peng. Jawab", "1", 0, "L", true, 0, "")
	telpPJ := patient.TeleponPenanggungJawab
	if telpPJ == "" {
		telpPJ = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+telpPJ, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Alamat Peng. Jawab", "1", 0, "L", true, 0, "")
	alamatPJ := patient.AlamatPenanggungJawab
	if alamatPJ == "" {
		alamatPJ = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+truncateText(alamatPJ, 25), "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 3)

	// =================== DATA REGISTRASI ===================
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA REGISTRASI", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)

	// No. Registrasi
	pdf.CellFormat(col1, rowHeight, " No. Registrasi", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(col2, rowHeight, " "+registration.RegistrationNumber, "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowHeight, " Tanggal Daftar", "1", 0, "L", true, 0, "")
	regDate := formatDateIndonesian(registration.RegistrationDate)
	pdf.CellFormat(col4, rowHeight, " "+regDate, "1", 1, "L", false, 0, "")

	// Tipe Layanan | Ruangan Tujuan
	regType := registration.RegistrationType
	switch registration.RegistrationType {
	case "outpatient":
		regType = "Rawat Jalan"
	case "inpatient":
		regType = "Rawat Inap"
	case "emergency":
		regType = "Gawat Darurat (IGD)"
	}
	pdf.CellFormat(col1, rowHeight, " Tipe Layanan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2, rowHeight, " "+regType, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Ruangan Tujuan", "1", 0, "L", true, 0, "")
	roomName := "-"
	if registration.DestinationRoom != nil {
		roomName = registration.DestinationRoom.Name
	}
	pdf.CellFormat(col4, rowHeight, " "+roomName, "1", 1, "L", false, 0, "")

	// Dokter | Status
	pdf.CellFormat(col1, rowHeight, " Dokter", "1", 0, "L", true, 0, "")
	doctorName := "-"
	if registration.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(registration.Doctor, doctorName)
	}
	pdf.CellFormat(col2, rowHeight, " "+truncateText(doctorName, 25), "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Status", "1", 0, "L", true, 0, "")
	regStatus := registration.Status
	switch registration.Status {
	case "registered":
		regStatus = "Terdaftar"
	case "scheduled":
		regStatus = "Dijadwalkan"
	case "in_queue":
		regStatus = "Dalam Antrian"
	case "in_progress":
		regStatus = "Berlangsung"
	case "completed":
		regStatus = "Selesai"
	case "discharged":
		regStatus = "Dipulangkan"
	case "cancelled":
		regStatus = "Dibatalkan"
	case "no_show":
		regStatus = "Tidak Hadir"
	}
	pdf.CellFormat(col4, rowHeight, " "+regStatus, "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 3)

	// =================== DATA PEMBAYARAN ===================
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA PEMBAYARAN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)

	// Metode Pembayaran
	payMethod := registration.PaymentMethod
	payLabel := "Tunai (Cash)"
	switch payMethod {
	case "bpjs":
		payLabel = "BPJS Kesehatan"
	case "insurance":
		payLabel = "Asuransi"
	case "cash":
		payLabel = "Tunai (Cash)"
	default:
		if payMethod != "" {
			payLabel = strings.ToUpper(payMethod)
		}
	}
	pdf.CellFormat(col1, rowHeight, " Metode Pembayaran", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+payLabel, "1", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)

	// BPJS details
	if payMethod == "bpjs" {
		noBpjs := registration.BPJSNumber
		if noBpjs == "" {
			noBpjs = patient.NoBPJS
		}
		if noBpjs == "" {
			noBpjs = "-"
		}
		pdf.CellFormat(col1, rowHeight, " No. BPJS", "1", 0, "L", true, 0, "")
		pdf.CellFormat(col2, rowHeight, " "+noBpjs, "1", 0, "L", false, 0, "")
		pdf.CellFormat(col3, rowHeight, " Kelas BPJS", "1", 0, "L", true, 0, "")
		kelasBpjs := patient.KelasBPJS
		if kelasBpjs == "" {
			kelasBpjs = "-"
		}
		pdf.CellFormat(col4, rowHeight, " "+kelasBpjs, "1", 1, "L", false, 0, "")

		// SEP
		pdf.CellFormat(col1, rowHeight, " No. SEP", "1", 0, "L", true, 0, "")
		sepNo := registration.SEPNumber
		if sepNo == "" {
			sepNo = "-"
		}
		pdf.CellFormat(col2, rowHeight, " "+sepNo, "1", 0, "L", false, 0, "")
		pdf.CellFormat(col3, rowHeight, " No. Rujukan", "1", 0, "L", true, 0, "")
		noRujukan := registration.NoRujukan
		if noRujukan == "" {
			noRujukan = "-"
		}
		pdf.CellFormat(col4, rowHeight, " "+noRujukan, "1", 1, "L", false, 0, "")

		// Faskes & tgl rujukan
		pdf.CellFormat(col1, rowHeight, " Asal Rujukan", "1", 0, "L", true, 0, "")
		asalRujukan := "-"
		switch registration.AsalRujukan {
		case "1":
			asalRujukan = "Faskes Tingkat 1"
		case "2":
			asalRujukan = "Faskes Tingkat 2"
		default:
			if registration.AsalRujukan != "" {
				asalRujukan = registration.AsalRujukan
			}
		}
		pdf.CellFormat(col2, rowHeight, " "+asalRujukan, "1", 0, "L", false, 0, "")
		pdf.CellFormat(col3, rowHeight, " Tgl. Rujukan", "1", 0, "L", true, 0, "")
		tglRujukan := registration.TglRujukan
		if tglRujukan == "" {
			tglRujukan = "-"
		}
		pdf.CellFormat(col4, rowHeight, " "+tglRujukan, "1", 1, "L", false, 0, "")
	}

	// Insurance details
	if payMethod == "insurance" {
		pdf.CellFormat(col1, rowHeight, " Nama Asuransi", "1", 0, "L", true, 0, "")
		insName := registration.InsuranceName
		if insName == "" {
			insName = patient.NamaAsuransi
		}
		if insName == "" {
			insName = "-"
		}
		pdf.CellFormat(col2, rowHeight, " "+insName, "1", 0, "L", false, 0, "")
		pdf.CellFormat(col3, rowHeight, " No. Polis", "1", 0, "L", true, 0, "")
		insNumber := registration.InsuranceNumber
		if insNumber == "" {
			insNumber = patient.NoPolisAsuransi
		}
		if insNumber == "" {
			insNumber = "-"
		}
		pdf.CellFormat(col4, rowHeight, " "+insNumber, "1", 1, "L", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 3)

	// =================== KELUHAN ===================
	if registration.Complaint != "" {
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(220, 220, 220)
		pdf.SetLineWidth(0.3)
		pdf.CellFormat(contentWidth, 6, " KELUHAN / CATATAN", "1", 1, "L", true, 0, "")
		pdf.SetLineWidth(0.2)
		pdf.SetFont("Arial", "", 9)
		pdf.SetFillColor(255, 255, 255)

		// Multi-line complaint
		lines := pdf.SplitLines([]byte(registration.Complaint), contentWidth-4)
		for _, line := range lines {
			pdf.CellFormat(contentWidth, 5, " "+string(line), "LR", 1, "L", false, 0, "")
		}
		// Bottom border
		pdf.CellFormat(contentWidth, 0.5, "", "T", 1, "", false, 0, "")
	}

	if registration.Notes != "" {
		pdf.SetY(pdf.GetY() + 1)
		pdf.SetFont("Arial", "I", 8)
		pdf.CellFormat(contentWidth, 5, " Catatan: "+registration.Notes, "", 1, "L", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 5)

	// =================== INFO PETUGAS ===================
	pdf.SetFont("Arial", "", 8)
	pdf.SetTextColor(100, 100, 100)
	registeredBy := "-"
	if registration.RegisteredBy != nil {
		registeredBy = registration.RegisteredBy.FullName
	}
	regTime := registration.CreatedAt.Format("02-01-2006 15:04")
	pdf.CellFormat(contentWidth, 4, fmt.Sprintf("Didaftarkan oleh: %s  |  Waktu: %s WIB", registeredBy, regTime), "", 1, "L", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	pdf.SetY(pdf.GetY() + 5)

	// =================== TANDA TANGAN ===================
	// Check for digital signature
	sigLog, isSigned := findSignatureLog(
		rmDupSignatureLookup(c, models.DocTypeRMDupRegistration),
		signatureLookup{models.DocTypeRegistration, registration.ID},
	)
	if isSigned {
		registeredBy = resolveSignedUserName(sigLog, registeredBy)
	}

	signY := pdf.GetY()
	signColWidth := contentWidth / 2

	sigDateStr := formatDateIndonesian(registration.CreatedAt)
	if isSigned {
		sigDateStr = formatDateIndonesian(sigLog.SignedAt)
	}

	columnSlots := []string{"nurse", "patient"} // default layout for registration receipt
	for _, rule := range loadDocumentSignatureRules() {
		if rule.DocumentType != models.DocTypeRegistration || len(rule.Slots) == 0 {
			continue
		}
		columnSlots = append([]string{}, rule.Slots...)
		break
	}
	if len(columnSlots) < 2 {
		columnSlots = append(columnSlots, "none")
	}

	type regSlotRender struct {
		label  string
		name   string
		signed bool
	}
	resolveRegSlot := func(slot string) regSlotRender {
		switch strings.TrimSpace(strings.ToLower(slot)) {
		case "nurse":
			return regSlotRender{label: "Petugas Pendaftaran", name: "( " + registeredBy + " )", signed: isSigned}
		case "doctor_dpjp":
			return regSlotRender{label: "Dokter DPJP", name: "( " + doctorName + " )", signed: isSigned}
		case "patient":
			return regSlotRender{label: "Pasien / Keluarga Pasien", name: "( " + patient.NamaLengkap + " )", signed: false}
		default:
			return regSlotRender{label: "", name: "", signed: false}
		}
	}
	left := resolveRegSlot(columnSlots[0])
	right := resolveRegSlot(columnSlots[1])

	pdf.SetFont("Arial", "", 9)
	pdf.SetXY(marginLeft, signY)
	pdf.CellFormat(signColWidth, 5, hospitalInfo.City+", "+sigDateStr, "", 1, "C", false, 0, "")

	// Left column
	pdf.SetXY(marginLeft, signY+5)
	pdf.CellFormat(signColWidth, 5, "Slot 1 (Kiri)", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft, signY+10)
	pdf.CellFormat(signColWidth, 5, left.label, "", 1, "C", false, 0, "")

	// QR code in left signature area if signed
	if left.signed {
		addSignatureQR(pdf, sigLog, marginLeft+signColWidth/2, signY+20, 18.0, fmt.Sprintf("reg_%d", registration.ID))
	}

	pdf.SetXY(marginLeft, signY+30)
	pdf.CellFormat(signColWidth, 5, left.name, "", 1, "C", false, 0, "")

	// Right column
	pdf.SetXY(marginLeft+signColWidth, signY+5)
	pdf.CellFormat(signColWidth, 5, "Slot 2 (Kanan)", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft+signColWidth, signY+10)
	pdf.CellFormat(signColWidth, 5, right.label, "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft+signColWidth, signY+30)
	pdf.CellFormat(signColWidth, 5, right.name, "", 1, "C", false, 0, "")

	// Dashed line for signatures
	pdf.SetDrawColor(150, 150, 150)
	pdf.SetDashPattern([]float64{1, 1}, 0)
	lineLeft := marginLeft + 15
	lineRight := marginLeft + signColWidth - 15
	pdf.Line(lineLeft, signY+29, lineRight, signY+29)
	lineLeft2 := marginLeft + signColWidth + 15
	lineRight2 := marginLeft + contentWidth - 15
	pdf.Line(lineLeft2, signY+29, lineRight2, signY+29)
	pdf.SetDashPattern([]float64{}, 0)
	pdf.SetDrawColor(0, 0, 0)

	// SIP info if signed
	if isSigned && sigLog.SignerSIP != "" {
		pdf.SetFont("Arial", "", 7)
		pdf.SetXY(marginLeft, signY+35)
		pdf.CellFormat(signColWidth, 4, "SIP: "+sigLog.SignerSIP, "", 1, "C", false, 0, "")
	}

	// Footer note
	pdf.SetY(signY + 40)
	pdf.SetFont("Arial", "I", 7)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(contentWidth, 4, "* Dokumen ini merupakan bukti pendaftaran yang sah. Harap dibawa saat kunjungan.", "", 1, "C", false, 0, "")
	pdf.CellFormat(contentWidth, 4, "* Dicetak secara otomatis oleh sistem SIMRS.", "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	// Digital signature footer
	if isSigned {
		addDigitalSignatureFooter(pdf, sigLog, models.DocTypeRegistration, registration.ID)
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Bukti_Registrasi_%s_%s.pdf", patient.NoRM, registration.RegistrationNumber)
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupRegistration, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupRegistration, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if isSigned {
			go storeCachedPDF(models.DocTypeRegistration, registration.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintDPJPRequest generates PDF for Formulir Permohonan DPJP (Dokter Penanggung Jawab Pasien)
func printInformedConsentReceiptImpl(c *gin.Context) {
	visitID := c.Param("visitId")

	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Registration.DestinationRoom").
		Preload("Registration.Doctor").
		Preload("Room").
		Preload("Doctor").
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

	roomName := "-"
	if visit.Room != nil {
		roomName = visit.Room.Name
	}

	// Load diagnoses for this visit
	var diagnoses []models.Diagnosis
	clinicalVisitQuery(c, visit.ID).Order("type ASC, id ASC").Find(&diagnoses)

	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(true, marginBottom)
	pdf.AddPage()

	addHeader(pdf, hospitalInfo, "BUKTI PEMBERIAN INFORMASI", "DAN PERSETUJUAN TINDAKAN MEDIS (INFORMED CONSENT)")

	// DATA PASIEN
	col1 := 40.0
	col2 := 50.0
	col3 := 35.0
	col4 := 55.0

	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(0, 0, 0)
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

	// Row 4: No HP | Penanggung Jawab
	phone := patient.NoHP
	if phone == "" {
		phone = "-"
	}
	pdf.CellFormat(col1, rowHeight, " No. HP", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2, rowHeight, " "+phone, "1", 0, "L", false, 0, "")
	pj := patient.NamaPenanggungJawab
	if pj == "" {
		pj = "-"
	}
	hubPj := patient.HubunganPenanggungJawab
	if hubPj != "" {
		pj = pj + " (" + hubPj + ")"
	}
	pdf.CellFormat(col3, rowHeight, " Penanggung Jawab", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col4, rowHeight, " "+truncateText(pj, 28), "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 3)

	// DATA PELAYANAN
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA PELAYANAN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)

	pdf.CellFormat(col1, rowHeight, " No. Kunjungan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2, rowHeight, " "+visit.VisitNumber, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Jenis Pelayanan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col4, rowHeight, " "+visitTypeLabel, "1", 1, "L", false, 0, "")

	pdf.CellFormat(col1, rowHeight, " Ruangan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2, rowHeight, " "+truncateText(roomName, 28), "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " DPJP", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col4, rowHeight, " "+truncateText(dpjpName, 28), "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 3)

	// INFORMASI JAMINAN / PEMBAYARAN
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(60, 60, 60)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetDrawColor(60, 60, 60)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " INFORMASI JAMINAN / PEMBAYARAN", "1", 1, "L", true, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 8)

	// Payment rules per type
	switch strings.ToLower(registration.PaymentMethod) {
	case "bpjs":
		bpjsRules := []string{
			"1. Pelayanan kesehatan dijamin sesuai dengan ketentuan program JKN-KIS yang berlaku.",
			"2. Pasien wajib membawa kartu BPJS Kesehatan dan identitas (KTP) yang masih berlaku.",
			"3. Pelayanan mengikuti prosedur rujukan berjenjang sesuai ketentuan BPJS Kesehatan.",
			"4. Obat yang diberikan sesuai Formularium Nasional (FORNAS) yang berlaku.",
			"5. Tindakan medis di luar ketentuan BPJS menjadi tanggung jawab pasien/keluarga.",
			"6. Kenaikan kelas perawatan di atas hak kelas menjadi tanggung jawab pasien.",
			"7. Pasien berhak mendapatkan informasi tentang cakupan manfaat JKN-KIS.",
		}
		for _, rule := range bpjsRules {
			checkPageBreak(pdf, 5)
			pdf.MultiCell(contentWidth, 4.5, " "+rule, "", "L", false)
		}
	case "insurance":
		insuranceRules := []string{
			"1. Pelayanan kesehatan dijamin sesuai dengan polis asuransi yang dimiliki pasien.",
			"2. Pasien wajib membawa kartu asuransi dan identitas yang masih berlaku.",
			"3. Klaim asuransi akan diproses sesuai prosedur perusahaan asuransi terkait.",
			"4. Selisih biaya di luar cakupan polis menjadi tanggung jawab pasien/keluarga.",
			"5. Pasien bertanggung jawab atas kelebihan biaya yang tidak ditanggung asuransi.",
			"6. Pasien berhak mendapatkan informasi tentang cakupan manfaat asuransi.",
		}
		for _, rule := range insuranceRules {
			checkPageBreak(pdf, 5)
			pdf.MultiCell(contentWidth, 4.5, " "+rule, "", "L", false)
		}
	default: // umum / cash
		cashRules := []string{
			"1. Seluruh biaya pelayanan kesehatan menjadi tanggung jawab pasien/keluarga.",
			"2. Pembayaran dilakukan sesuai tarif rumah sakit yang berlaku.",
			"3. Pasien berhak mendapatkan rincian biaya pelayanan sebelum dan sesudah tindakan.",
			"4. Pembayaran dapat dilakukan secara tunai, kartu debit, atau kartu kredit.",
			"5. Pasien berhak mendapatkan kuitansi/bukti pembayaran yang sah.",
			"6. Estimasi biaya dapat berubah sesuai kondisi klinis dan tindakan yang diperlukan.",
		}
		for _, rule := range cashRules {
			checkPageBreak(pdf, 5)
			pdf.MultiCell(contentWidth, 4.5, " "+rule, "", "L", false)
		}
	}

	pdf.SetFont("Arial", "", 9)
	pdf.SetY(pdf.GetY() + 3)

	// ISI INFORMASI YANG DIBERIKAN
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(60, 60, 60)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetDrawColor(60, 60, 60)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " INFORMASI YANG TELAH DIBERIKAN", "1", 1, "L", true, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.2)

	pdf.SetFont("Arial", "", 9)
	infoItems := []struct {
		No   string
		Item string
	}{
		{"1", "Diagnosis dan kondisi pasien"},
		{"2", "Rencana tindakan / terapi yang akan dilakukan"},
		{"3", "Tujuan tindakan / terapi"},
		{"4", "Alternatif tindakan lain dan risikonya"},
		{"5", "Risiko dan komplikasi yang mungkin terjadi"},
		{"6", "Prognosis / perkiraan hasil pengobatan"},
		{"7", "Perkiraan biaya yang diperlukan"},
	}

	noW := 10.0
	itemW := contentWidth - noW - 30
	checkW := 30.0

	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(235, 235, 235)
	pdf.CellFormat(noW, rowHeight, " No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(itemW, rowHeight, " Jenis Informasi", "1", 0, "L", true, 0, "")
	pdf.CellFormat(checkW, rowHeight, " Diberikan", "1", 1, "C", true, 0, "")
	pdf.SetFont("Arial", "", 9)

	for _, item := range infoItems {
		pdf.CellFormat(noW, rowHeight, " "+item.No, "1", 0, "C", false, 0, "")
		pdf.CellFormat(itemW, rowHeight, " "+item.Item, "1", 0, "L", false, 0, "")
		// Checkbox checked
		pdf.CellFormat(checkW, rowHeight, " [v]", "1", 1, "C", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 3)

	// PERNYATAAN
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " PERNYATAAN PASIEN / KELUARGA", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)

	pdf.SetY(pdf.GetY() + 2)
	pdf.MultiCell(contentWidth, 5, "Dengan ini saya menyatakan bahwa saya telah menerima dan memahami penjelasan informasi mengenai kondisi, rencana tindakan medis, risiko, komplikasi, alternatif dan biaya yang diperlukan sebagaimana tercantum di atas.", "", "L", false)

	pdf.SetY(pdf.GetY() + 2)
	pdf.MultiCell(contentWidth, 5, "Berdasarkan informasi tersebut, dengan penuh kesadaran dan tanpa paksaan, saya:", "", "L", false)

	pdf.SetY(pdf.GetY() + 2)
	pdf.SetFont("Arial", "", 9)
	cbSize := 4.0

	// Option 1: Menyetujui
	cbX := marginLeft + 5
	cbY := pdf.GetY()
	pdf.Rect(cbX, cbY+0.5, cbSize, cbSize, "D")
	pdf.SetXY(cbX+cbSize+3, cbY)
	pdf.CellFormat(contentWidth-cbSize-8, 5, "MENYETUJUI untuk dilakukan tindakan medis sebagaimana telah dijelaskan di atas", "", 1, "L", false, 0, "")

	// Option 2: Menolak
	cbY2 := pdf.GetY() + 1
	pdf.Rect(cbX, cbY2+0.5, cbSize, cbSize, "D")
	pdf.SetXY(cbX+cbSize+3, cbY2)
	pdf.CellFormat(contentWidth-cbSize-8, 5, "MENOLAK untuk dilakukan tindakan medis sebagaimana telah dijelaskan di atas", "", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 8)

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
				label: "DPJP / Dokter",
				name:  "( " + truncateText(dpjpName, 22) + " )",
			}
		case "nurse":
			return staticSlotRender{
				label: "Saksi / Petugas",
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
	pdf.CellFormat(signColWidth, 5, "DPJP / Dokter", "", 1, "C", false, 0, "")
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
	pdf.SetDrawColor(0, 0, 0)

	// Footer
	pdf.SetY(signY + 36)
	pdf.SetFont("Arial", "I", 7)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(contentWidth, 4, "* Formulir ini merupakan bukti pemberian informasi dan persetujuan tindakan medis yang sah.", "", 1, "C", false, 0, "")
	pdf.CellFormat(contentWidth, 4, "* Dicetak secara otomatis oleh sistem SIMRS.", "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Informed_Consent_%s_%s.pdf", patient.NoRM, visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintSEP generates SEP (Surat Eligibilitas Peserta) PDF
func printSEPImpl(c *gin.Context) {
	sepID := c.Param("sepId")

	var sep models.SEP
	if err := database.DB.
		Preload("Patient").
		Preload("Registration").
		Preload("Visit").
		First(&sep, sepID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Initialize PDF with Landscape orientation
	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Page dimensions for Landscape A4 (297mm x 210mm)
	pageWidth := 297.0
	pageHeight := 210.0
	margin := 10.0
	contentWidth := pageWidth - (2 * margin)

	hospitalInfo := getHospitalInfo()

	// === HEADER SECTION ===
	logoHeight := 14.0
	logoWidth := 75.0
	logoX := margin
	if hospitalInfo.BPJSLogo != "" {
		logoFile := strings.TrimPrefix(hospitalInfo.BPJSLogo, "/")
		logoFile = strings.TrimPrefix(logoFile, "uploads/")
		logoPath := filepath.Join("uploads", logoFile)

		if _, err := os.Stat(logoPath); err == nil {
			ext := strings.ToLower(filepath.Ext(logoPath))
			var imgType string
			switch ext {
			case ".jpg", ".jpeg":
				imgType = "JPG"
			case ".png":
				imgType = "PNG"
			default:
				imgType = ""
			}

			if imgType != "" {
				pdf.Image(logoPath, margin, margin, logoWidth, logoHeight, false, imgType, 0, "")
				logoX = margin + logoWidth + 3
			}
		}
	}

	// Line 1: "SURAT ELIGIBILITAS PESERTA"
	pdf.SetFont("Arial", "", 14)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetXY(logoX, margin+2)
	pdf.CellFormat(contentWidth-(logoX-margin), 6, "SURAT ELIGIBILITAS PESERTA", "", 1, "L", false, 0, "")

	// Line 2: Hospital name
	rsName := hospitalInfo.SubTitle
	if rsName == "" {
		rsName = hospitalInfo.Name
	}
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetXY(logoX, margin+9)
	pdf.CellFormat(contentWidth-(logoX-margin), 5, strings.ToUpper(rsName), "", 1, "L", false, 0, "")

	// === 2 COLUMN LAYOUT ===
	startY := margin + logoHeight + 4
	colWidth := contentWidth / 2
	col1X := margin
	col2X := margin + colWidth

	// Row height & font size — enlarged to fill A4
	rowH := 5.5
	fontSize := 10.0
	labelW := 42.0
	valueW := colWidth - labelW

	// Helper function for field with label: value format (NO BOLD)
	addField := func(x, y, labelWidth, valueWidth float64, label, value string) float64 {
		pdf.SetFont("Arial", "", fontSize)
		pdf.SetXY(x, y)
		pdf.CellFormat(labelWidth, rowH, label, "", 0, "L", false, 0, "")
		pdf.SetX(x + labelWidth)
		pdf.CellFormat(valueWidth, rowH, ": "+value, "", 0, "L", false, 0, "")
		return y + rowH
	}

	currentY := startY

	// === LEFT COLUMN ===
	currentY = addField(col1X, currentY, labelW, valueW, "No. SEP", sep.NoSEP)

	// Tgl. SEP
	tglSEP := sep.TglSEP
	if tglSEP != "" {
		if t, err := ParseLocalDate(tglSEP); err == nil {
			tglSEP = t.Format("02-01-2006")
		}
	}
	currentY = addField(col1X, currentY, labelW, valueW, "Tgl. SEP", tglSEP)

	// No. Kartu (with MR)
	noKartu := sep.NoKartu
	if noKartu == "" {
		noKartu = "-"
	}
	noMR := sep.NoMR
	if noMR == "" && sep.Patient != nil {
		noMR = sep.Patient.NoRM
	}
	if noMR != "" {
		noKartu = noKartu + " ( MR. " + noMR + " )"
	}
	currentY = addField(col1X, currentY, labelW, valueW, "No. Kartu", noKartu)

	// Nama Peserta
	namaPasien := sep.NamaPasien
	if namaPasien == "" && sep.Patient != nil {
		namaPasien = sep.Patient.NamaLengkap
	}
	currentY = addField(col1X, currentY, labelW, valueW, "Nama Peserta", namaPasien)

	// Tgl. Lahir + Kelamin
	tglLahir := sep.TglLahir
	if tglLahir == "" && sep.Patient != nil && sep.Patient.TanggalLahir != nil {
		tglLahir = sep.Patient.TanggalLahir.Time.Format("02-01-2006")
	} else if tglLahir != "" {
		if t, err := ParseLocalDate(tglLahir); err == nil {
			tglLahir = t.Format("02-01-2006")
		}
	}
	jenisKelamin := sep.JenisKelamin
	if jenisKelamin == "" && sep.Patient != nil {
		if sep.Patient.JenisKelamin == "L" {
			jenisKelamin = "Laki-laki"
		} else if sep.Patient.JenisKelamin == "P" {
			jenisKelamin = "Perempuan"
		}
	}
	tglLahirKelamin := tglLahir + "  Kelamin : " + jenisKelamin
	currentY = addField(col1X, currentY, labelW, valueW, "Tgl. Lahir", tglLahirKelamin)

	// No. Telepon
	noTelp := sep.NoTelp
	if noTelp == "" && sep.Patient != nil {
		noTelp = sep.Patient.NoTelepon
	}
	if noTelp == "" {
		noTelp = "-"
	}
	currentY = addField(col1X, currentY, labelW, valueW, "No. Telepon", noTelp)

	// Sub/Spesialis
	subSpesialis := sep.NamaPoli
	if subSpesialis == "" {
		subSpesialis = "-"
	}
	currentY = addField(col1X, currentY, labelW, valueW, "Sub/Spesialis", subSpesialis)

	// Dokter
	namaDokter := sep.NamaDPJP
	if namaDokter == "" {
		namaDokter = "-"
	}
	currentY = addField(col1X, currentY, labelW, valueW, "Dokter", namaDokter)

	// Faskes Perujuk
	faskesPerujuk := sep.NamaRujukan
	if faskesPerujuk == "" {
		faskesPerujuk = "-"
	}
	currentY = addField(col1X, currentY, labelW, valueW, "Faskes Perujuk", faskesPerujuk)

	// Diagnosa Awal
	diagnosa := sep.DiagAwal
	if sep.NamaDiagnosa != "" {
		diagnosa = diagnosa + " (" + sep.NamaDiagnosa + ")"
	}
	if diagnosa == "" {
		diagnosa = "-"
	}
	currentY = addField(col1X, currentY, labelW, valueW, "Diagnosa Awal", diagnosa)

	// === RIGHT COLUMN ===
	currentYRight := startY

	// Peserta (Jenis Peserta BPJS - from catatan if available)
	peserta := "-"
	currentYRight = addField(col2X, currentYRight, labelW, valueW, "Peserta", peserta)

	// Skip row to align with Tgl. SEP on left
	currentYRight += rowH

	// Jns. Rawat
	jnsRawat := "-"
	if sep.JnsPelayanan == "1" {
		jnsRawat = "Rawat Inap"
	} else if sep.JnsPelayanan == "2" {
		jnsRawat = "Rawat Jalan"
	}
	currentYRight = addField(col2X, currentYRight, labelW, valueW, "Jns. Rawat", jnsRawat)

	// Jns. Kunjungan
	jnsKunjungan := "-"
	if sep.TujuanKunj == "0" {
		jnsKunjungan = "Normal"
	} else if sep.TujuanKunj == "1" {
		jnsKunjungan = "Prosedur"
	} else if sep.TujuanKunj == "2" {
		jnsKunjungan = "Konsul Dokter"
	}
	currentYRight = addField(col2X, currentYRight, labelW, valueW, "Jns. Kunjungan", jnsKunjungan)

	// Prosedur
	prosedur := "-"
	if sep.FlagProcedure == "1" {
		prosedur = "Berkelanjutan"
	} else if sep.FlagProcedure == "0" {
		prosedur = "Tidak Berkelanjutan"
	}
	currentYRight = addField(col2X, currentYRight, labelW, valueW, "Prosedur", prosedur)

	// Assesment plyn
	assessmentPlyn := "-"
	if sep.AssesmentPel != "" {
		switch sep.AssesmentPel {
		case "1":
			assessmentPlyn = "Poli tidak tersedia"
		case "2":
			assessmentPlyn = "Jam Poli berakhir"
		case "3":
			assessmentPlyn = "Dokter tidak praktek"
		case "4":
			assessmentPlyn = "Atas Instruksi RS"
		case "5":
			assessmentPlyn = "Tujuan Kontrol"
		}
	}
	currentYRight = addField(col2X, currentYRight, labelW, valueW, "Assesment plyn", assessmentPlyn)

	// Poli Perujuk
	poliPerujuk := sep.KodePoli
	if poliPerujuk == "" {
		poliPerujuk = "-"
	}
	currentYRight = addField(col2X, currentYRight, labelW, valueW, "Poli Perujuk", poliPerujuk)

	// Kelas Hak
	kelasHak := sep.KlsRawatHak
	if kelasHak == "" {
		kelasHak = "-"
	} else if kelasHak == "1" {
		kelasHak = "KELAS I"
	} else if kelasHak == "2" {
		kelasHak = "KELAS II"
	} else if kelasHak == "3" {
		kelasHak = "KELAS III"
	}
	currentYRight = addField(col2X, currentYRight, labelW, valueW, "Kelas Hak", kelasHak)

	// Kelas Rawat
	kelasRawat := sep.KlsRawatNaik
	if kelasRawat == "" {
		kelasRawat = kelasHak
	} else {
		switch kelasRawat {
		case "1":
			kelasRawat = "VVIP"
		case "2":
			kelasRawat = "VIP"
		case "3":
			kelasRawat = "Kelas I"
		case "4":
			kelasRawat = "Kelas II"
		case "5":
			kelasRawat = "Kelas III"
		case "6":
			kelasRawat = "ICCU"
		case "7":
			kelasRawat = "ICU"
		case "8":
			kelasRawat = "Diatas Kelas 1"
		}
	}
	currentYRight = addField(col2X, currentYRight, labelW, valueW, "Kelas Rawat", kelasRawat)

	// Penjamin (Pembiayaan naik kelas)
	penjamin := ""
	if sep.Pembiayaan != "" {
		switch sep.Pembiayaan {
		case "1":
			penjamin = "Pribadi"
		case "2":
			penjamin = "Pemberi Kerja"
		case "3":
			penjamin = "Asuransi Kesehatan Tambahan"
		}
	}
	currentYRight = addField(col2X, currentYRight, labelW, valueW, "Penjamin", penjamin)

	// === CATATAN SECTION ===
	catatanY := currentY + 3
	if currentYRight+3 > catatanY {
		catatanY = currentYRight + 3
	}

	// "Catatan" label as field row
	pdf.SetFont("Arial", "", fontSize)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetXY(margin, catatanY)
	pdf.CellFormat(labelW, rowH, "Catatan", "", 0, "L", false, 0, "")
	pdf.SetX(margin + labelW)
	pdf.CellFormat(10, rowH, ":", "", 0, "L", false, 0, "")

	// "Pasien/Keluarga Pasien" on right same line
	pdf.SetFont("Arial", "", fontSize)
	pdf.SetXY(col2X+colWidth-55, catatanY)
	pdf.CellFormat(55, rowH, "Pasien/Keluarga Pasien", "", 0, "R", false, 0, "")
	catatanY += rowH

	// Notes
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 8)
	pdf.SetXY(margin, catatanY)
	pdf.MultiCell(contentWidth*0.55, 3.5,
		"* Saya Menyetujui BPJS Kesehatan menggunakan Informasi Media pasien jika diperlukan.\n"+
			"* SEP bukan sebagai bukti penjamin peserta.\n"+
			"** Dengan diterbitkannya SEP ini, Peserta rawat inap telah mendapatkan informasi dan menempati\n"+
			"  kelas rawat sesuai hak kelasnya (terkecuali kelas penuh atau naik kelas sesuai aturan yang berlaku)",
		"", "L", false)

	// Signature line on right
	notesEndY := pdf.GetY()
	sigLineY := catatanY + 15
	if sigLineY < notesEndY+2 {
		sigLineY = notesEndY + 2
	}
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", fontSize)
	pdf.SetXY(col2X+colWidth-55, sigLineY)
	pdf.CellFormat(55, rowH, "___________________", "", 0, "C", false, 0, "")

	// Cetakan Ke 1
	catatanEndY := sigLineY + rowH + 1
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 8)
	pdf.SetXY(margin, catatanEndY)
	printDate := time.Now().Format("02-01-2006 15:04:05")
	pdf.CellFormat(contentWidth/2, 4, "*Cetakan Ke 1 "+printDate, "", 0, "L", false, 0, "")

	_ = pageHeight
	pdf.SetTextColor(0, 0, 0)
	pdf.SetDrawColor(0, 0, 0)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("SEP_%s_%s.pdf", sep.NoSEP, sep.TglSEP)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// ===========================================================================
// NUTRITION ETIKET (100mm width thermal)
// ===========================================================================

// PrintNutritionEtiket generates a food label/etiket PDF for a nutrition order
