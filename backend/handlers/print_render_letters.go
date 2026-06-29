package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
)

func printSickLetterImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	days := 1
	startDate := time.Now()
	var letterNumber string
	var purpose string
	var institution string
	var notes string
	var letterID uint

	if letterIDStr := c.Query("letter_id"); letterIDStr != "" {
		lid, _ := strconv.ParseUint(letterIDStr, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeSickLetter, uint(lid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}

		var sickLetter models.SickLetter
		if err := database.DB.Preload("IssuedBy").First(&sickLetter, letterIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Sick letter not found"})
			return
		}
		letterID = sickLetter.ID
		days = sickLetter.Days
		startDate = sickLetter.StartDate
		letterNumber = sickLetter.LetterNumber
		purpose = sickLetter.Purpose
		institution = sickLetter.Institution
		notes = sickLetter.Notes
	} else {
		if c.Query("days") != "" {
			fmt.Sscanf(c.Query("days"), "%d", &days)
		}
		if c.Query("start_date") != "" {
			if t, err := ParseLocalDate(c.Query("start_date")); err == nil {
				startDate = t
			}
		}
	}

	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").Preload("Doctor").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	headerSubtitle := ""
	if letterNumber != "" {
		headerSubtitle = "No: " + letterNumber
	}
	addHeader(pdf, hospitalInfo, "Surat Keterangan Sakit", headerSubtitle)

	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(0, 6, "Yang bertanda tangan di bawah ini menerangkan bahwa:", "", "", false)
	pdf.SetY(pdf.GetY() + 5)

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(40, 6, "Nama", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, patient.NamaLengkap, "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(40, 6, "Tanggal Lahir", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	birthDate := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = formatDateIndonesian(patient.TanggalLahir.Time)
	}
	pdf.CellFormat(0, 6, birthDate, "", 1, "", false, 0, "")

	pdf.CellFormat(40, 6, "NIK", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	nik := patient.NIK
	if nik == "" {
		nik = "-"
	}
	pdf.CellFormat(0, 6, nik, "", 1, "", false, 0, "")

	pdf.CellFormat(40, 6, "Alamat", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(0, 6, truncateText(alamat, 60), "", 1, "", false, 0, "")

	if institution != "" {
		pdf.CellFormat(40, 6, "Instansi", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, institution, "", 1, "", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 5)

	endDate := startDate.AddDate(0, 0, days-1)
	dateRange := formatDateIndonesian(startDate)
	if days > 1 {
		dateRange += " s/d " + formatDateIndonesian(endDate)
	}

	statement := fmt.Sprintf(
		"Berdasarkan pemeriksaan yang dilakukan pada tanggal %s, yang bersangkutan dinyatakan sakit dan memerlukan istirahat selama %d (%s) hari, terhitung mulai tanggal %s.",
		formatDateIndonesian(*visit.StartTime),
		days,
		numberToWords(days),
		dateRange,
	)
	pdf.MultiCell(0, 6, statement, "", "", false)

	pdf.SetY(pdf.GetY() + 5)

	purposeText := "Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya."
	if purpose != "" {
		purposeText = "Demikian surat keterangan ini dibuat dengan sebenarnya " + purpose + "."
	}
	pdf.MultiCell(0, 6, purposeText, "", "", false)

	if notes != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.SetFont("Arial", "I", 10)
		pdf.MultiCell(0, 5, "Catatan: "+notes, "", "", false)
		pdf.SetFont("Arial", "", 11)
	}

	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "Dokter Pemeriksa", models.DocTypeSickLetter, letterID)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Sakit_%s.pdf", patient.NoRM)
	if letterID > 0 {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeSickLetter, letterID}); isSigned {
			go storeCachedPDF(models.DocTypeSickLetter, letterID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

func printDeathCertificateImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	certificateIDStr := c.Query("certificate_id")
	if certificateIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "certificate_id is required"})
		return
	}

	cid, _ := strconv.ParseUint(certificateIDStr, 10, 32)
	if pdfData, fileName, found := getCachedPDF(models.DocTypeDeathCertificate, uint(cid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	var certificate models.DeathCertificate
	if err := database.DB.Preload("IssuedBy").First(&certificate, certificateIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Death certificate not found"})
		return
	}

	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	if certificate.VisitID != uint(visitIDUint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Certificate does not belong to this visit"})
		return
	}

	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").Preload("Doctor").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	headerSubtitle := ""
	if certificate.CertificateNumber != "" {
		headerSubtitle = "No: " + certificate.CertificateNumber
	}
	addHeader(pdf, hospitalInfo, "Surat Keterangan Kematian", headerSubtitle)

	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 11)

	deathTypeLabel := "Meninggal"
	switch certificate.DeathType {
	case "doa":
		deathTypeLabel = "DOA (Dead on Arrival)"
	case "dod":
		deathTypeLabel = "DOD (Death on Departure)"
	case "inpatient_death":
		deathTypeLabel = "Meninggal saat Rawat Inap"
	}

	pdf.MultiCell(0, 6, "Yang bertanda tangan di bawah ini menerangkan bahwa:", "", "", false)
	pdf.SetY(pdf.GetY() + 5)

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(50, 6, "Nama", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, patient.NamaLengkap, "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(50, 6, "Tanggal Lahir", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	birthDate := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = formatDateIndonesian(patient.TanggalLahir.Time)
	}
	pdf.CellFormat(0, 6, birthDate, "", 1, "", false, 0, "")

	pdf.CellFormat(50, 6, "NIK", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	nik := patient.NIK
	if nik == "" {
		nik = "-"
	}
	pdf.CellFormat(0, 6, nik, "", 1, "", false, 0, "")

	pdf.CellFormat(50, 6, "Alamat", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(0, 6, truncateText(alamat, 55), "", 1, "", false, 0, "")

	pdf.SetY(pdf.GetY() + 5)
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, "Telah meninggal dunia dengan keterangan sebagai berikut:", "", 1, "", false, 0, "")
	pdf.SetFont("Arial", "", 11)
	pdf.SetY(pdf.GetY() + 3)

	deathDateTimeStr := "-"
	if !certificate.DeathDateTime.IsZero() {
		deathDateTimeStr = formatDateTimeIndonesian(certificate.DeathDateTime)
	}
	pdf.CellFormat(50, 6, "Waktu Kematian", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(0, 6, deathDateTimeStr, "", 1, "", false, 0, "")

	if certificate.DeathLocation != "" {
		pdf.CellFormat(50, 6, "Lokasi Kematian", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.DeathLocation, "", 1, "", false, 0, "")
	}

	pdf.CellFormat(50, 6, "Jenis Kematian", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(0, 6, deathTypeLabel, "", 1, "", false, 0, "")

	if certificate.PrimaryCauseCode != "" || certificate.PrimaryCauseName != "" {
		pdf.CellFormat(50, 6, "Penyebab Utama", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		causeText := certificate.PrimaryCauseName
		if certificate.PrimaryCauseCode != "" {
			causeText = certificate.PrimaryCauseCode + " - " + certificate.PrimaryCauseName
		}
		pdf.CellFormat(0, 6, truncateText(causeText, 55), "", 1, "", false, 0, "")
	}

	if certificate.SecondaryCauseCode != "" || certificate.SecondaryCauseName != "" {
		pdf.CellFormat(50, 6, "Penyebab Sekunder", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		causeText := certificate.SecondaryCauseName
		if certificate.SecondaryCauseCode != "" {
			causeText = certificate.SecondaryCauseCode + " - " + certificate.SecondaryCauseName
		}
		pdf.CellFormat(0, 6, truncateText(causeText, 55), "", 1, "", false, 0, "")
	}

	if certificate.MannerOfDeath != "" {
		mannerLabel := certificate.MannerOfDeath
		switch certificate.MannerOfDeath {
		case "natural":
			mannerLabel = "Alamiah"
		case "accident":
			mannerLabel = "Kecelakaan"
		case "suicide":
			mannerLabel = "Bunuh Diri"
		case "homicide":
			mannerLabel = "Pembunuhan"
		case "undetermined":
			mannerLabel = "Tidak Dapat Ditentukan"
		case "pending":
			mannerLabel = "Menunggu Investigasi"
		}
		pdf.CellFormat(50, 6, "Cara Kematian", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, mannerLabel, "", 1, "", false, 0, "")
	}

	if certificate.DurationOfIllness != "" {
		pdf.CellFormat(50, 6, "Lama Sakit", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.DurationOfIllness, "", 1, "", false, 0, "")
	}
	if certificate.DeclaringDoctorName != "" {
		pdf.CellFormat(50, 6, "Dokter yang Menyatakan", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.DeclaringDoctorName, "", 1, "", false, 0, "")
	}
	if certificate.WitnessName != "" {
		witnessInfo := certificate.WitnessName
		if certificate.WitnessRelation != "" {
			witnessInfo += " (" + certificate.WitnessRelation + ")"
		}
		pdf.CellFormat(50, 6, "Saksi", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, witnessInfo, "", 1, "", false, 0, "")
	}
	if certificate.Notes != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.SetFont("Arial", "I", 10)
		pdf.MultiCell(0, 5, "Catatan: "+certificate.Notes, "", "", false)
		pdf.SetFont("Arial", "", 11)
	}

	pdf.SetY(pdf.GetY() + 5)
	pdf.MultiCell(0, 6, "Demikian surat keterangan kematian ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.", "", "", false)

	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "Dokter Pemeriksa", models.DocTypeDeathCertificate, certificate.ID)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Kematian_%s.pdf", patient.NoRM)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeDeathCertificate, certificate.ID}); isSigned {
		go storeCachedPDF(models.DocTypeDeathCertificate, certificate.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

func printHealthCertificateImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	certificateIDStr := c.Query("certificate_id")
	if certificateIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "certificate_id is required"})
		return
	}

	cid, _ := strconv.ParseUint(certificateIDStr, 10, 32)
	if pdfData, fileName, found := getCachedPDF(models.DocTypeHealthCertificate, uint(cid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	var certificate models.HealthCertificate
	if err := database.DB.Preload("IssuedBy").First(&certificate, certificateIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Health certificate not found"})
		return
	}

	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	if certificate.VisitID != uint(visitIDUint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Certificate does not belong to this visit"})
		return
	}

	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").Preload("Doctor").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	headerSubtitle := ""
	if certificate.LetterNumber != "" {
		headerSubtitle = "No: " + certificate.LetterNumber
	}
	addHeader(pdf, hospitalInfo, "Surat Keterangan Sehat", headerSubtitle)

	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(0, 6, "Yang bertanda tangan di bawah ini menerangkan bahwa:", "", "", false)
	pdf.SetY(pdf.GetY() + 5)

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(40, 6, "Nama", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, patient.NamaLengkap, "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(40, 6, "Tanggal Lahir", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	birthDate := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = formatDateIndonesian(patient.TanggalLahir.Time)
	}
	pdf.CellFormat(0, 6, birthDate, "", 1, "", false, 0, "")

	pdf.CellFormat(40, 6, "NIK", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	nik := patient.NIK
	if nik == "" {
		nik = "-"
	}
	pdf.CellFormat(0, 6, nik, "", 1, "", false, 0, "")

	pdf.CellFormat(40, 6, "Alamat", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(0, 6, truncateText(alamat, 60), "", 1, "", false, 0, "")

	if certificate.Institution != "" {
		pdf.CellFormat(40, 6, "Instansi", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.Institution, "", 1, "", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 5)
	examDateStr := formatDateIndonesian(certificate.ExamDate)
	resultText := "dalam keadaan sehat"
	if certificate.Result == "sehat_dengan_catatan" {
		resultText = "dalam keadaan sehat dengan catatan"
	}
	statement := fmt.Sprintf("Berdasarkan pemeriksaan yang dilakukan pada tanggal %s, yang bersangkutan dinyatakan %s.", examDateStr, resultText)
	pdf.MultiCell(0, 6, statement, "", "", false)

	if certificate.Result == "sehat_dengan_catatan" && certificate.Notes != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.SetFont("Arial", "I", 10)
		pdf.MultiCell(0, 5, "Catatan: "+certificate.Notes, "", "", false)
		pdf.SetFont("Arial", "", 11)
	}

	pdf.SetY(pdf.GetY() + 5)
	purposeText := "Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya."
	if certificate.Purpose != "" {
		purposeText = "Demikian surat keterangan ini dibuat dengan sebenarnya " + certificate.Purpose + "."
	}
	pdf.MultiCell(0, 6, purposeText, "", "", false)

	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "Dokter Pemeriksa", models.DocTypeHealthCertificate, certificate.ID)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Sehat_%s.pdf", patient.NoRM)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeHealthCertificate, certificate.ID}); isSigned {
		go storeCachedPDF(models.DocTypeHealthCertificate, certificate.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

func printBirthCertificateImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	certificateIDStr := c.Query("certificate_id")
	if certificateIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "certificate_id is required"})
		return
	}

	cid, _ := strconv.ParseUint(certificateIDStr, 10, 32)
	if pdfData, fileName, found := getCachedPDF(models.DocTypeBirthCertificate, uint(cid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	var certificate models.BirthCertificate
	if err := database.DB.Preload("IssuedBy").First(&certificate, certificateIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Birth certificate not found"})
		return
	}

	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	if certificate.VisitID != uint(visitIDUint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Certificate does not belong to this visit"})
		return
	}

	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").Preload("Doctor").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	headerSubtitle := ""
	if certificate.LetterNumber != "" {
		headerSubtitle = "No: " + certificate.LetterNumber
	}
	addHeader(pdf, hospitalInfo, "Surat Keterangan Kelahiran", headerSubtitle)

	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(0, 6, "Yang bertanda tangan di bawah ini menerangkan bahwa telah lahir seorang bayi dengan keterangan sebagai berikut:", "", "", false)
	pdf.SetY(pdf.GetY() + 5)

	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, "Data Bayi:", "", 1, "", false, 0, "")
	pdf.SetFont("Arial", "", 11)
	pdf.SetY(pdf.GetY() + 2)

	babyName := certificate.BabyName
	if babyName == "" {
		if patient.NamaLengkap != "" {
			babyName = "By Ny. " + patient.NamaLengkap
		} else {
			babyName = "Belum diberi nama"
		}
	}
	pdf.CellFormat(50, 6, "Nama Bayi", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, babyName, "", 1, "", false, 0, "")
	pdf.SetFont("Arial", "", 11)

	genderLabel := "Laki-laki"
	if certificate.Gender == "perempuan" {
		genderLabel = "Perempuan"
	}
	pdf.CellFormat(50, 6, "Jenis Kelamin", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(0, 6, genderLabel, "", 1, "", false, 0, "")

	birthDateStr := formatDateIndonesian(certificate.BirthDate)
	if certificate.BirthTime != "" {
		birthDateStr += " pukul " + certificate.BirthTime + " WIB"
	}
	pdf.CellFormat(50, 6, "Tanggal/Waktu Lahir", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(0, 6, birthDateStr, "", 1, "", false, 0, "")

	if certificate.BirthWeight > 0 {
		pdf.CellFormat(50, 6, "Berat Lahir", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, fmt.Sprintf("%.0f gram", certificate.BirthWeight), "", 1, "", false, 0, "")
	}
	if certificate.BirthLength > 0 {
		pdf.CellFormat(50, 6, "Panjang Lahir", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, fmt.Sprintf("%.0f cm", certificate.BirthLength), "", 1, "", false, 0, "")
	}

	birthMethodLabel := certificate.BirthMethod
	switch certificate.BirthMethod {
	case "normal":
		birthMethodLabel = "Normal / Spontan"
	case "sectio_caesarea":
		birthMethodLabel = "Sectio Caesarea"
	case "vakum":
		birthMethodLabel = "Vakum Ekstraksi"
	case "forcep":
		birthMethodLabel = "Forcep"
	}
	if birthMethodLabel != "" {
		pdf.CellFormat(50, 6, "Metode Persalinan", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, birthMethodLabel, "", 1, "", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 5)
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, "Data Orang Tua:", "", 1, "", false, 0, "")
	pdf.SetFont("Arial", "", 11)
	pdf.SetY(pdf.GetY() + 2)

	pdf.CellFormat(50, 6, "Nama Ibu", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	motherName := certificate.MotherName
	if motherName == "" {
		motherName = patient.NamaLengkap
	}
	pdf.CellFormat(0, 6, motherName, "", 1, "", false, 0, "")

	if certificate.FatherName != "" {
		pdf.CellFormat(50, 6, "Nama Ayah", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.FatherName, "", 1, "", false, 0, "")
	}
	if certificate.Notes != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.SetFont("Arial", "I", 10)
		pdf.MultiCell(0, 5, "Catatan: "+certificate.Notes, "", "", false)
		pdf.SetFont("Arial", "", 11)
	}

	pdf.SetY(pdf.GetY() + 5)
	pdf.MultiCell(0, 6, "Demikian surat keterangan kelahiran ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.", "", "", false)

	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "Dokter Penolong", models.DocTypeBirthCertificate, certificate.ID)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Kelahiran_%s.pdf", patient.NoRM)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeBirthCertificate, certificate.ID}); isSigned {
		go storeCachedPDF(models.DocTypeBirthCertificate, certificate.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

func printLeaveCertificateImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	certificateIDStr := c.Query("certificate_id")
	if certificateIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "certificate_id is required"})
		return
	}

	cid, _ := strconv.ParseUint(certificateIDStr, 10, 32)
	if pdfData, fileName, found := getCachedPDF(models.DocTypeLeaveCertificate, uint(cid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	var certificate models.LeaveCertificate
	if err := database.DB.Preload("IssuedBy").First(&certificate, certificateIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Leave certificate not found"})
		return
	}

	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	if certificate.VisitID != uint(visitIDUint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Certificate does not belong to this visit"})
		return
	}

	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").Preload("Doctor").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	headerSubtitle := ""
	if certificate.LetterNumber != "" {
		headerSubtitle = "No: " + certificate.LetterNumber
	}
	addHeader(pdf, hospitalInfo, "Surat Keterangan Cuti", headerSubtitle)

	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(0, 6, "Yang bertanda tangan di bawah ini menerangkan bahwa:", "", "", false)
	pdf.SetY(pdf.GetY() + 5)

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(40, 6, "Nama", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, patient.NamaLengkap, "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(40, 6, "Tanggal Lahir", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	birthDate := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = formatDateIndonesian(patient.TanggalLahir.Time)
	}
	pdf.CellFormat(0, 6, birthDate, "", 1, "", false, 0, "")

	pdf.CellFormat(40, 6, "NIK", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	nik := patient.NIK
	if nik == "" {
		nik = "-"
	}
	pdf.CellFormat(0, 6, nik, "", 1, "", false, 0, "")

	pdf.CellFormat(40, 6, "Alamat", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(0, 6, truncateText(alamat, 60), "", 1, "", false, 0, "")

	if certificate.Institution != "" {
		pdf.CellFormat(40, 6, "Instansi", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.Institution, "", 1, "", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 5)

	leaveTypeLabel := certificate.LeaveType
	switch certificate.LeaveType {
	case "sakit":
		leaveTypeLabel = "Cuti Sakit"
	case "hamil":
		leaveTypeLabel = "Cuti Hamil"
	case "melahirkan":
		leaveTypeLabel = "Cuti Melahirkan"
	case "lainnya":
		leaveTypeLabel = "Cuti Lainnya"
	}

	dateRange := formatDateIndonesian(certificate.StartDate) + " s/d " + formatDateIndonesian(certificate.EndDate)
	statement := fmt.Sprintf("Memerlukan %s selama %d (%s) hari, terhitung mulai tanggal %s.", leaveTypeLabel, certificate.Days, numberToWords(certificate.Days), dateRange)
	pdf.MultiCell(0, 6, statement, "", "", false)

	if certificate.Reason != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.CellFormat(40, 6, "Alasan", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.Reason, "", 1, "", false, 0, "")
	}
	if certificate.Diagnosis != "" {
		pdf.CellFormat(40, 6, "Diagnosis", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, truncateText(certificate.Diagnosis, 60), "", 1, "", false, 0, "")
	}
	if certificate.Notes != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.SetFont("Arial", "I", 10)
		pdf.MultiCell(0, 5, "Catatan: "+certificate.Notes, "", "", false)
		pdf.SetFont("Arial", "", 11)
	}

	pdf.SetY(pdf.GetY() + 5)
	pdf.MultiCell(0, 6, "Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.", "", "", false)

	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "Dokter Pemeriksa", models.DocTypeLeaveCertificate, certificate.ID)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Cuti_%s.pdf", patient.NoRM)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeLeaveCertificate, certificate.ID}); isSigned {
		go storeCachedPDF(models.DocTypeLeaveCertificate, certificate.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

func printMCUCertificateImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	certificateIDStr := c.Query("certificate_id")
	if certificateIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "certificate_id is required"})
		return
	}

	cid, _ := strconv.ParseUint(certificateIDStr, 10, 32)
	if pdfData, fileName, found := getCachedPDF(models.DocTypeMCUCertificate, uint(cid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	var certificate models.MCUCertificate
	if err := database.DB.Preload("IssuedBy").First(&certificate, certificateIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "MCU certificate not found"})
		return
	}

	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	if certificate.VisitID != uint(visitIDUint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Certificate does not belong to this visit"})
		return
	}

	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").Preload("Doctor").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	headerSubtitle := ""
	if certificate.LetterNumber != "" {
		headerSubtitle = "No: " + certificate.LetterNumber
	}
	addHeader(pdf, hospitalInfo, "Surat Keterangan Medical Check-Up", headerSubtitle)

	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(0, 6, "Yang bertanda tangan di bawah ini menerangkan bahwa:", "", "", false)
	pdf.SetY(pdf.GetY() + 5)

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(40, 6, "Nama", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, patient.NamaLengkap, "", 1, "", false, 0, "")

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(40, 6, "Tanggal Lahir", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	birthDate := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = formatDateIndonesian(patient.TanggalLahir.Time)
	}
	pdf.CellFormat(0, 6, birthDate, "", 1, "", false, 0, "")

	pdf.CellFormat(40, 6, "NIK", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	nik := patient.NIK
	if nik == "" {
		nik = "-"
	}
	pdf.CellFormat(0, 6, nik, "", 1, "", false, 0, "")

	pdf.CellFormat(40, 6, "Alamat", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(0, 6, truncateText(alamat, 60), "", 1, "", false, 0, "")

	if certificate.Institution != "" {
		pdf.CellFormat(40, 6, "Instansi", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.Institution, "", 1, "", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 5)
	examDateStr := formatDateIndonesian(certificate.ExamDate)
	statement := fmt.Sprintf("Telah dilakukan pemeriksaan kesehatan (Medical Check-Up) pada tanggal %s", examDateStr)
	if certificate.Purpose != "" {
		statement += " untuk keperluan " + certificate.Purpose
	}
	statement += "."
	pdf.MultiCell(0, 6, statement, "", "", false)

	pdf.SetY(pdf.GetY() + 5)

	conclusionLabel := certificate.Conclusion
	switch certificate.Conclusion {
	case "layak":
		conclusionLabel = "LAYAK"
	case "tidak_layak":
		conclusionLabel = "TIDAK LAYAK"
	case "layak_dengan_catatan":
		conclusionLabel = "LAYAK DENGAN CATATAN"
	}

	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(40, 6, "Kesimpulan", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, conclusionLabel, "", 1, "", false, 0, "")
	pdf.SetFont("Arial", "", 11)

	if certificate.Recommendation != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.CellFormat(40, 6, "Rekomendasi", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		startX := pdf.GetX()
		startY := pdf.GetY()
		pdf.SetLeftMargin(startX)
		pdf.MultiCell(0, 6, certificate.Recommendation, "", "", false)
		pdf.SetLeftMargin(15)
		_ = startY
	}
	if certificate.Notes != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.SetFont("Arial", "I", 10)
		pdf.MultiCell(0, 5, "Catatan: "+certificate.Notes, "", "", false)
		pdf.SetFont("Arial", "", 11)
	}

	pdf.SetY(pdf.GetY() + 5)
	pdf.MultiCell(0, 6, "Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.", "", "", false)

	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "Dokter Pemeriksa", models.DocTypeMCUCertificate, certificate.ID)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_MCU_%s.pdf", patient.NoRM)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeMCUCertificate, certificate.ID}); isSigned {
		go storeCachedPDF(models.DocTypeMCUCertificate, certificate.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}
