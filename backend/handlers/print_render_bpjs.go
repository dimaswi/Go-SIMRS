package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
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

func addBPJSDocSignatureImpl(pdf *gofpdf.Fpdf, city, doctorName, label, docNumber string, createdAt time.Time) {
	checkPageBreak(pdf, signatureHeight)

	pdf.SetY(pdf.GetY() + 10)

	// Date from document creation
	dateStr := formatDateIndonesian(createdAt)
	if city != "" {
		dateStr = city + ", " + dateStr
	}

	// Generate deterministic hash from document data
	hashInput := fmt.Sprintf("%s|%s|%s", docNumber, doctorName, createdAt.Format(time.RFC3339))
	hashBytes := sha256.Sum256([]byte(hashInput))
	docHash := hex.EncodeToString(hashBytes[:])

	sigAreaWidth := 70.0
	sigAreaX := marginLeft + contentWidth - sigAreaWidth

	// City and Date
	pdf.SetFont("Arial", "", 10)
	pdf.SetX(sigAreaX)
	pdf.CellFormat(sigAreaWidth, 6, dateStr, "", 1, "C", false, 0, "")

	// Label
	pdf.SetX(sigAreaX)
	pdf.CellFormat(sigAreaWidth, 6, label+",", "", 1, "C", false, 0, "")

	// QR code in signature space (always rendered)
	qrSize := 20.0
	spaceStartY := pdf.GetY()

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5173"
	}
	verifyURL := fmt.Sprintf("%s/verify/%s", appURL, docHash[:32])
	qrImgBytes := generateQRCode(verifyURL)

	if qrImgBytes != nil {
		imgName := fmt.Sprintf("qr_bpjs_%s", docNumber)
		reader := bytes.NewReader(qrImgBytes)
		pdf.RegisterImageReader(imgName, "PNG", reader)

		qrX := sigAreaX + (sigAreaWidth-qrSize)/2
		qrY := spaceStartY + (25-qrSize)/2
		pdf.Image(imgName, qrX, qrY, qrSize, qrSize, false, "PNG", 0, "")

		addLogoOverlayOnQR(pdf, qrX, qrY, qrSize)
	}

	pdf.SetY(spaceStartY + 25)

	// Doctor name with underline
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(sigAreaX)
	pdf.CellFormat(sigAreaWidth, 6, doctorName, "B", 1, "C", false, 0, "")

	// === FOOTER: Digital validation at bottom of page ===
	footerY := pageHeight - marginBottom - 20

	// Separator line
	pdf.SetDrawColor(180, 180, 180)
	pdf.SetLineWidth(0.3)
	pdf.Line(marginLeft, footerY, marginLeft+contentWidth, footerY)
	pdf.SetDrawColor(0, 0, 0)

	footerY += 2

	// Small QR code in footer
	footerQRSize := 15.0
	footerQRBytes := generateQRCode(verifyURL)
	if footerQRBytes != nil {
		fImgName := fmt.Sprintf("qrf_bpjs_%s", docNumber)
		fReader := bytes.NewReader(footerQRBytes)
		pdf.RegisterImageReader(fImgName, "PNG", fReader)
		pdf.Image(fImgName, marginLeft, footerY, footerQRSize, footerQRSize, false, "PNG", 0, "")
		addLogoOverlayOnQR(pdf, marginLeft, footerY, footerQRSize)
	}

	// Verification text next to QR
	textX := marginLeft + footerQRSize + 3
	pdf.SetFont("Arial", "I", 7)
	pdf.SetTextColor(34, 139, 34)
	pdf.SetXY(textX, footerY)
	pdf.CellFormat(0, 3.5, "Dokumen ini diterbitkan secara elektronik oleh sistem BPJS", "", 1, "L", false, 0, "")
	pdf.SetTextColor(80, 80, 80)
	pdf.SetFont("Arial", "", 6)
	pdf.SetXY(textX, footerY+3.5)
	pdf.CellFormat(0, 3, fmt.Sprintf("Ditandatangani oleh: %s  |  %s", doctorName, createdAt.Format("02/01/2006 15:04 WIB")), "", 1, "L", false, 0, "")
	pdf.SetXY(textX, footerY+6.5)
	pdf.CellFormat(0, 3, fmt.Sprintf("No. Dokumen: %s", docNumber), "", 1, "L", false, 0, "")
	pdf.SetXY(textX, footerY+9.5)
	pdf.CellFormat(0, 3, fmt.Sprintf("Hash: %s", truncateText(docHash, 40)), "", 1, "L", false, 0, "")
	pdf.SetTextColor(0, 0, 0)
}

// ===========================================================================
// SPRI (Surat Perintah Rawat Inap) PDF
// ===========================================================================

// PrintSPRI generates PDF for Surat Perintah Rawat Inap
func printSPRIImpl(c *gin.Context) {
	spriID := c.Param("spriId")

	var spri models.SPRI
	if err := database.DB.Preload("Visit.Doctor").First(&spri, spriID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "SPRI tidak ditemukan"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	hospitalInfo := getHospitalInfo()

	// Create PDF - Portrait A4
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "Surat Perintah Rawat Inap (SPRI)", "No: "+spri.NoSPRI)

	// === DATA PESERTA ===
	pdf.SetY(pdf.GetY() + 5)
	addTableHeader(pdf, "DATA PESERTA")

	labelW := 50.0

	addTableRow(pdf, "Nama Peserta", spri.Nama, labelW)
	addTableRow(pdf, "No. Kartu BPJS", spri.NoKartu, labelW)

	kelamin := spri.Kelamin
	if kelamin == "L" || kelamin == "1" {
		kelamin = "Laki-laki"
	} else if kelamin == "P" || kelamin == "2" {
		kelamin = "Perempuan"
	}
	addTableRow(pdf, "Jenis Kelamin", kelamin, labelW)

	tglLahir := spri.TglLahir
	if tglLahir != "" {
		if t, err := ParseLocalDate(tglLahir); err == nil {
			tglLahir = formatDateIndonesian(t)
		}
	}
	addTableRow(pdf, "Tanggal Lahir", tglLahir, labelW)

	addTableEnd(pdf)

	// === RENCANA RAWAT INAP ===
	addTableHeader(pdf, "RENCANA RAWAT INAP")

	tglTerbit := formatDateIndonesian(spri.CreatedAt)
	addTableRow(pdf, "Tanggal Terbit", tglTerbit, labelW)

	tglKontrol := spri.TglRencanaKontrol
	if tglKontrol != "" {
		if t, err := ParseLocalDate(tglKontrol); err == nil {
			tglKontrol = formatDateIndonesian(t)
		}
	}
	addTableRow(pdf, "Tgl Rencana Masuk", tglKontrol, labelW)

	poli := spri.NamaPoli
	if poli == "" {
		poli = spri.KodePoli
	}
	addTableRow(pdf, "Poli / Ruangan", poli, labelW)

	dokter := spri.NamaDokter
	if dokter == "" {
		dokter = spri.KodeDokter
	}
	addTableRow(pdf, "Dokter DPJP", dokter, labelW)
	addTableRow(pdf, "Diagnosa", spri.NamaDiagnosa, labelW)

	addTableEnd(pdf)

	// === SIGNATURE (DPJP from Visit) ===
	dpjpName := "-"
	if spri.Visit != nil && spri.Visit.Doctor != nil {
		dpjpName = resolveAssignedUserNameFromEmployee(spri.Visit.Doctor, dpjpName)
	} else if spri.NamaDokter != "" {
		dpjpName = spri.NamaDokter
	}
	addDualSignature(pdf, hospitalInfo.City, dpjpName, models.DocTypeSPRI, spri.ID)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate PDF"})
		return
	}

	filename := fmt.Sprintf("SPRI_%s.pdf", spri.NoSPRI)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// ===========================================================================
// SURAT KONTROL / SKDP (Surat Keterangan Dokter Penanggungjawab) PDF
// ===========================================================================

// PrintSuratKontrol generates PDF for Surat Kontrol Rawat Jalan
func printSuratKontrolImpl(c *gin.Context) {
	skID := c.Param("suratKontrolId")

	// Cache check
	sid, _ := strconv.ParseUint(skID, 10, 32)
	if pdfData, fileName, found := getCachedPDF(models.DocTypeSuratKontrol, uint(sid)); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	var sk models.SuratKontrol
	if err := database.DB.Preload("Visit.Doctor").First(&sk, skID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Surat Kontrol tidak ditemukan"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	hospitalInfo := getHospitalInfo()

	// Create PDF - Portrait A4
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// === WATERMARK: Logo BPJS diagonal miring ke kanan, full halaman ===
	if hospitalInfo.BPJSLogo != "" {
		logoFile := strings.TrimPrefix(hospitalInfo.BPJSLogo, "/")
		logoFile = strings.TrimPrefix(logoFile, "uploads/")
		logoPath := filepath.Join("uploads", logoFile)
		if _, err := os.Stat(logoPath); err == nil {
			ext := strings.ToLower(filepath.Ext(logoPath))
			imgType := "PNG"
			if ext == ".jpg" || ext == ".jpeg" {
				imgType = "JPG"
			}
			// Diagonal A4: sqrt(210^2 + 297^2) ≈ 363mm, dikecilkan 60% = ~218mm
			wmW := 218.0
			wmH := 36.0 // tinggi proporsional 60%
			// Pusatkan di tengah halaman sebelum rotasi
			centerX := 210.0 / 2
			centerY := 297.0 / 2
			wmX := centerX - wmW/2
			wmY := centerY - wmH/2

			pdf.SetAlpha(0.07, "Normal")
			pdf.TransformBegin()
			// Rotate +45 derajat (miring ke kiri atas), pivot di tengah halaman
			pdf.TransformRotate(45, centerX, centerY)
			pdf.Image(logoPath, wmX, wmY, wmW, wmH, false, imgType, 0, "")
			pdf.TransformEnd()
			pdf.SetAlpha(1.0, "Normal")
		}
	}


	// Header — subtitle includes PRB badge text if applicable
	subtitle := "No: " + sk.NoSuratKontrol
	if sk.IsPRB {
		subtitle += "  |  Program Rujuk Balik (PRB)"
	}

	// Generate QR code data sebelum addHeader supaya bisa dipakai setelahnya
	qrData := fmt.Sprintf(`{"type": "checkin", "no_surat_kontrol": "%s"}`, sk.NoSuratKontrol)
	qrImgBytes := generateQRCode(qrData)
	qrImgName := fmt.Sprintf("qr_sk_%s", sk.NoSuratKontrol)
	if qrImgBytes != nil {
		reader := bytes.NewReader(qrImgBytes)
		pdf.RegisterImageReader(qrImgName, "PNG", reader)
	}

	addHeader(pdf, hospitalInfo, "Surat Kontrol Rawat Jalan (SKDP)", subtitle)

	// QR Code di pojok kanan, sejajar area judul SKDP
	afterHeaderY := pdf.GetY()
	qrSize := 18.0
	qrX := 210.0 - 15.0 - qrSize // margin kanan 15mm
	qrTitleY := afterHeaderY - 20.0
	if qrTitleY < 32 {
		qrTitleY = 32
	}

	if qrImgBytes != nil {
		pdf.Image(qrImgName, qrX, qrTitleY, qrSize, qrSize, false, "PNG", 0, "")
		// Label kecil di bawah QR
		pdf.SetFont("Arial", "I", 6)
		pdf.SetTextColor(120, 120, 120)
		pdf.SetXY(qrX-2, qrTitleY+qrSize+0.5)
		pdf.SetTextColor(0, 0, 0)
	}

	// Kembalikan posisi Y ke setelah header
	pdf.SetY(afterHeaderY)

	// === DATA PESERTA ===
	pdf.SetY(pdf.GetY() + 5)
	addTableHeader(pdf, "DATA PESERTA")

	labelW := 50.0

	addTableRow(pdf, "Nama Peserta", sk.Nama, labelW)
	addTableRow(pdf, "No. Kartu BPJS", sk.NoKartu, labelW)
	addTableRow(pdf, "No. SEP", sk.NoSEP, labelW)

	kelamin := sk.Kelamin
	if kelamin == "L" || kelamin == "1" {
		kelamin = "Laki-laki"
	} else if kelamin == "P" || kelamin == "2" {
		kelamin = "Perempuan"
	}
	addTableRow(pdf, "Jenis Kelamin", kelamin, labelW)

	tglLahir := sk.TglLahir
	if tglLahir != "" {
		if t, err := ParseLocalDate(tglLahir); err == nil {
			tglLahir = formatDateIndonesian(t)
		}
	}
	addTableRow(pdf, "Tanggal Lahir", tglLahir, labelW)

	addTableEnd(pdf)

	// === RENCANA KONTROL ===
	addTableHeader(pdf, "RENCANA KONTROL")

	tglTerbit := formatDateIndonesian(sk.CreatedAt)
	addTableRow(pdf, "Tanggal Terbit", tglTerbit, labelW)

	tglKontrol := sk.TglRencanaKontrol
	if tglKontrol != "" {
		if t, err := ParseLocalDate(tglKontrol); err == nil {
			tglKontrol = formatDateIndonesian(t)
		}
	}
	addTableRow(pdf, "Tgl Rencana Kontrol", tglKontrol, labelW)

	poli := sk.NamaPoli
	if poli == "" {
		poli = sk.KodePoli
	}
	addTableRow(pdf, "Poli Tujuan", poli, labelW)

	dokter := sk.NamaDokter
	if dokter == "" {
		dokter = sk.KodeDokter
	}
	addTableRow(pdf, "Dokter DPJP", dokter, labelW)
	addTableRow(pdf, "Diagnosa", sk.NamaDiagnosa, labelW)

	// PRB section if applicable
	if sk.IsPRB {
		prbStatus := sk.NamaStatusPRB
		if prbStatus == "" {
			prbStatus = sk.KdStatusPRB
		}
		addTableRow(pdf, "Program PRB", prbStatus, labelW)
	}

	addTableEnd(pdf)

	// === SIGNATURE (DPJP from Visit) ===
	dpjpName := "-"
	if sk.Visit != nil && sk.Visit.Doctor != nil {
		dpjpName = resolveAssignedUserNameFromEmployee(sk.Visit.Doctor, dpjpName)
	} else if sk.NamaDokter != "" {
		dpjpName = sk.NamaDokter
	}
	addDualSignature(pdf, hospitalInfo.City, dpjpName, models.DocTypeSuratKontrol, sk.ID)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate PDF"})
		return
	}

	filename := fmt.Sprintf("SuratKontrol_%s.pdf", sk.NoSuratKontrol)
	if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeSuratKontrol, sk.ID}); isSigned {
		go storeCachedPDF(models.DocTypeSuratKontrol, sk.ID, buf.Bytes(), filename)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintSuratKontrolSIMRS generates PDF for general SIMRS follow-up control (non-BPJS)
func printSuratKontrolSIMRSImpl(c *gin.Context) {
	registrationID := c.Param("registrationId")

	var reg models.Registration
	if err := database.DB.
		Preload("Patient").
		Preload("DestinationRoom").
		Preload("Doctor").
		Preload("SourceVisit").
		First(&reg, registrationID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Jadwal kontrol SIMRS tidak ditemukan"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	if !reg.IsFollowUp {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registrasi ini bukan jadwal kontrol"})
		return
	}

	if reg.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak ditemukan"})
		return
	}

	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	subtitle := "No: " + reg.RegistrationNumber
	addHeader(pdf, hospitalInfo, "Surat Kontrol Umum (SIMRS)", subtitle)

	pdf.SetY(pdf.GetY() + 5)
	addTableHeader(pdf, "DATA PASIEN")

	labelW := 50.0
	addTableRow(pdf, "Nama Pasien", reg.Patient.NamaLengkap, labelW)
	addTableRow(pdf, "No. RM", reg.Patient.NoRM, labelW)
	addTableRow(pdf, "No. BPJS", reg.Patient.NoBPJS, labelW)

	tglLahir := "-"
	if reg.Patient.TanggalLahir != nil && !reg.Patient.TanggalLahir.IsZero() {
		tglLahir = formatDateIndonesian(reg.Patient.TanggalLahir.Time)
	}
	addTableRow(pdf, "Tanggal Lahir", tglLahir, labelW)

	kelamin := string(reg.Patient.JenisKelamin)
	if kelamin == "L" || kelamin == "male" {
		kelamin = "Laki-laki"
	} else if kelamin == "P" || kelamin == "female" {
		kelamin = "Perempuan"
	}
	addTableRow(pdf, "Jenis Kelamin", kelamin, labelW)
	addTableEnd(pdf)

	addTableHeader(pdf, "JADWAL KONTROL")
	addTableRow(pdf, "No. Registrasi", reg.RegistrationNumber, labelW)

	tglKontrol := "-"
	if reg.ScheduledDate != nil && !reg.ScheduledDate.IsZero() {
		tglKontrol = formatDateIndonesian(reg.ScheduledDate.UTC())
	}
	addTableRow(pdf, "Tanggal Kontrol", tglKontrol, labelW)

	namaPoli := "-"
	if reg.DestinationRoom != nil {
		namaPoli = reg.DestinationRoom.Name
	}
	addTableRow(pdf, "Poli Tujuan", namaPoli, labelW)

	namaDokter := "-"
	if reg.Doctor != nil {
		namaDokter = resolveAssignedUserNameFromEmployee(reg.Doctor, namaDokter)
	}
	addTableRow(pdf, "Dokter Tujuan", namaDokter, labelW)
	addTableRow(pdf, "Keluhan", reg.Complaint, labelW)
	addTableEnd(pdf)

	pdf.SetY(pdf.GetY() + 5)
	pdf.SetFont("Arial", "", 10)
	pdf.MultiCell(0, 5, "Surat ini merupakan jadwal kontrol pasien yang dibuat di sistem SIMRS.", "", "L", false)

	// Add QR Code
	qrData := fmt.Sprintf(`{"type": "checkin", "reg_id": %d, "reg_no": "%s"}`, reg.ID, reg.RegistrationNumber)
	qrImgBytes := generateQRCode(qrData)
	if qrImgBytes != nil {
		imgName := fmt.Sprintf("qr_simrs_%s", reg.RegistrationNumber)
		reader := bytes.NewReader(qrImgBytes)
		pdf.RegisterImageReader(imgName, "PNG", reader)
		
		qrY := pdf.GetY() + 2
		pdf.Image(imgName, 15, qrY, 20, 20, false, "PNG", 0, "")
		pdf.SetXY(38, qrY+8)
		pdf.SetFont("Arial", "I", 8)
		pdf.SetTextColor(100, 100, 100)
		pdf.SetTextColor(0, 0, 0)
		pdf.SetY(qrY + 25)
	}

	addSignature(pdf, hospitalInfo.City, namaDokter, "Dokter Pemeriksa", "", 0)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Kontrol_SIMRS_%s.pdf", reg.RegistrationNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintRMDuplicatePrescription generates PDF for prescription from RM Duplicate medicine items
// GET /api/print/rm-duplicate/prescription/:rmOrderId
