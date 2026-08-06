package handlers

import (
	"bytes"
	"fmt"
	"image/png"
	"os"
	"path/filepath"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	qrcode "github.com/skip2/go-qrcode"
	"gorm.io/gorm"
)

// resolveSignedUserName returns signer employee name when available,
// then falls back to signer snapshot in signature log.
func resolveSignedUserName(sig models.SignatureLog, fallback string) string {
	meta := parseSignatureMeta(sig.Notes)
	if meta.role == "kosong" {
		return fallback
	}
	if meta.role == "pasien" && strings.TrimSpace(meta.name) != "" {
		return meta.name
	}

	if sig.SignerEmployeeID != nil {
		var emp models.Employee
		if err := database.DB.Select("nama_lengkap").Where("id = ?", *sig.SignerEmployeeID).First(&emp).Error; err == nil {
			if name := strings.TrimSpace(emp.NamaLengkap); name != "" {
				return name
			}
		}
	}

	if name := strings.TrimSpace(sig.SignerName); name != "" {
		return name
	}

	return fallback
}

type signatureMetaInfo struct {
	role     string
	location string
	date     string
	name     string
	image    string
}

func parseSignatureMeta(notes string) signatureMetaInfo {
	out := signatureMetaInfo{}
	n := strings.TrimSpace(notes)
	start := strings.LastIndex(n, "signature_meta[")
	if start < 0 {
		return out
	}
	chunk := n[start+len("signature_meta["):]
	end := strings.Index(chunk, "]")
	if end < 0 {
		return out
	}
	for _, part := range strings.Split(chunk[:end], ";") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		k := strings.ToLower(strings.TrimSpace(kv[0]))
		v := strings.TrimSpace(kv[1])
		switch k {
		case "role":
			out.role = strings.ToLower(v)
		case "location":
			out.location = v
		case "date":
			out.date = v
		case "name":
			out.name = v
		case "image":
			out.image = v
		}
	}
	return out
}

func signatureLabelFromMeta(sig models.SignatureLog) string {
	meta := parseSignatureMeta(sig.Notes)
	
	if meta.role == "pasien" {
		if sig.DocumentType == "general_consent_inpatient" || sig.DocumentType == "general_consent" || sig.DocumentType == "informed_consent" || strings.HasPrefix(sig.DocumentType, "rm_dup_general_consent") {
			return "Penanggung Jawab"
		}
	}

	switch meta.role {
	case "pasien":
		return "Pasien"
	case "wali":
		return "Wali"
	case "perawat":
		return "Perawat"
	case "dpjp":
		return "Dokter DPJP"
	case "dokter_dpjp":
		return "Dokter DPJP"
	case "dokter":
		return "Dokter"
	case "petugas":
		return "Petugas"
	case "kosong", "left", "right":
		return ""
	default:
		// Fallback to title-casing the role if it exists, rather than returning empty
		if meta.role != "" {
			return strings.Title(strings.ReplaceAll(meta.role, "_", " "))
		}
		return ""
	}
}

// signatureLookup is an alternate document_type + document_id pair for signature lookup.
type signatureLookup struct {
	DocType string
	DocID   uint
}

// addSignature menambahkan area tanda tangan - selalu di tengah/kanan.
// Jika sudah ditandatangani digital, QR code di area TTD + footer validasi di bawah halaman terakhir.
// altLookups: optional alternate document_type+document_id pairs to check (e.g. rm_dup_* types).
func addSignature(pdf *gofpdf.Fpdf, city, doctorName, patientLabel, docType string, docID uint, altLookups ...signatureLookup) {
	dateStr := formatDateIndonesian(time.Now())
	if city != "" {
		dateStr = city + ", " + dateStr
	}

	lookups := append([]signatureLookup{}, altLookups...)
	if docType != "" && docID > 0 {
		lookups = append(lookups, signatureLookup{docType, docID})
	}

	signatureLog, isSigned := findSignatureLog(lookups...)
	rmDuplicateSignature := hasRMDuplicateSignatureLookup(lookups...)
	if rmDuplicateSignature {
		leftLog, leftSigned := findSignatureLogBySlot("left", lookups...)
		rightLog, rightSigned := findSignatureLogBySlot("right", lookups...)
		leftHasField := leftSigned && strings.TrimSpace(signatureLabelFromMeta(leftLog)) != ""
		rightHasField := rightSigned && strings.TrimSpace(signatureLabelFromMeta(rightLog)) != ""
		if !leftHasField && !rightHasField {
			return
		}
		isSigned = leftHasField || rightHasField
		if rightHasField {
			signatureLog = rightLog
		} else if leftHasField {
			signatureLog = leftLog
		}
	}
	if isSigned {
		signedDate := formatDateIndonesian(signatureLog.SignedAt)
		if city != "" {
			dateStr = city + ", " + signedDate
		} else {
			dateStr = signedDate
		}
		doctorName = resolveSignedUserName(signatureLog, doctorName)
	}

	if !isSigned {
		return
	}

	requiredHeight := signatureHeight + footerHeight
	checkPageBreak(pdf, requiredHeight)

	pdf.SetY(pdf.GetY() + 10)
	startY := pdf.GetY()
	
	slotW := 70.0
	pageW, _ := pdf.GetPageSize()
	rightX := pageW - 12 - slotW // Right align with 12 unit margin
	
	pdf.SetXY(rightX, startY)
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(slotW, 6, dateStr, "", 1, "C", false, 0, "")
	
	pdf.SetXY(rightX, startY+6)
	pdf.CellFormat(slotW, 6, patientLabel, "", 1, "C", false, 0, "")
	
	if isSigned {
		meta := parseSignatureMeta(signatureLog.Notes)
		pdf.SetFont("Arial", "I", 8)
		pdf.SetTextColor(80, 80, 80)
		pdf.SetXY(rightX, startY+12)
		if meta.image == "" {
			addSignatureQR(pdf, signatureLog, rightX+slotW/2, startY+24, 16.0, "default_"+docType+fmt.Sprintf("_%d", docID))
		} else {
			// Physical signature image (Patient)
			imgPath := strings.TrimPrefix(meta.image, "/")
			if _, err := os.Stat(imgPath); err == nil {
				// draw 30x15 signature image
				imgW, imgH := 30.0, 15.0
				pdf.Image(imgPath, rightX+(slotW-imgW)/2, startY+20, imgW, imgH, false, "PNG", 0, "")
			}
		}
		pdf.SetTextColor(0, 0, 0)
	}
	
	pdf.SetFont("Arial", "B", 10)
	pdf.SetXY(rightX, startY+34)
	pdf.CellFormat(slotW, 6, doctorName, "B", 1, "C", false, 0, "")
	
	pdf.SetY(startY + 44)

	addDigitalSignatureFooter(pdf, signatureLog, docType, docID)
}

func drawUniversalTwoSignatureSlots(pdf *gofpdf.Fpdf, city, dateStr, docType string, docID uint, lookups ...signatureLookup) {
	leftX := marginLeft + 10
	slotW := 70.0
	gap := 30.0
	rightX := leftX + slotW + gap
	startY := pdf.GetY()

	leftLog, leftSigned := findSignatureLogBySlot("left", lookups...)
	rightLog, rightSigned := findSignatureLogBySlot("right", lookups...)
	rmDuplicateSignature := hasRMDuplicateSignatureLookup(lookups...)

	drawSlot := func(x float64, title, fallbackName, slot string, sig models.SignatureLog, signed bool) {
		pdf.SetXY(x, startY)
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(slotW, 6, dateStr, "", 1, "C", false, 0, "")
		pdf.SetXY(x, startY+6)
		pdf.CellFormat(slotW, 6, title, "", 1, "C", false, 0, "")
		if signed {
			meta := parseSignatureMeta(sig.Notes)
			pdf.SetFont("Arial", "I", 8)
			pdf.SetTextColor(80, 80, 80)
			pdf.SetXY(x, startY+12)
			
			if meta.image == "" {
				addSignatureQR(pdf, sig, x+slotW/2, startY+24, 16.0, fmt.Sprintf("%s_%s_%d", slot, docType, docID))
			} else {
				imgPath := strings.TrimPrefix(meta.image, "/")
				if _, err := os.Stat(imgPath); err == nil {
					imgW, imgH := 30.0, 15.0
					pdf.Image(imgPath, x+(slotW-imgW)/2, startY+20, imgW, imgH, false, "PNG", 0, "")
				}
			}
			pdf.SetTextColor(0, 0, 0)
		}
		name := fallbackName
		if signed {
			name = resolveSignedUserName(sig, fallbackName)
		}
		pdf.SetFont("Arial", "B", 10)
		pdf.SetXY(x, startY+34)
		pdf.CellFormat(slotW, 6, name, "B", 1, "C", false, 0, "")
	}

	leftTitle := "Pasien"
	rightTitle := "Dokter DPJP"
	if docType == "general_consent_inpatient" || docType == "general_consent" || strings.HasPrefix(docType, "rm_dup_general_consent") {
		leftTitle = "Petugas"
		rightTitle = "Penanggung Jawab Pasien"
	}

	leftName := "(............................)"
	rightName := "(............................)"
	if leftSigned {
		if t := signatureLabelFromMeta(leftLog); t != "" {
			leftTitle = t
		}
	}
	if rightSigned {
		if t := signatureLabelFromMeta(rightLog); t != "" {
			rightTitle = t
		}
	}

	if rmDuplicateSignature {
		leftHasField := leftSigned && strings.TrimSpace(leftTitle) != ""
		rightHasField := rightSigned && strings.TrimSpace(rightTitle) != ""
		if !leftHasField && !rightHasField {
			return
		}
		if leftHasField {
			drawSlot(leftX, leftTitle, leftName, "left", leftLog, leftSigned)
		}
		if rightHasField {
			drawSlot(rightX, rightTitle, rightName, "right", rightLog, rightSigned)
		}
		pdf.SetY(startY + 44)
		return
	}

	// Only draw slots that are actually signed
	if !leftSigned && !rightSigned {
		return
	}
	if leftSigned {
		drawSlot(leftX, leftTitle, leftName, "left", leftLog, leftSigned)
	}
	if rightSigned {
		drawSlot(rightX, rightTitle, rightName, "right", rightLog, rightSigned)
	}
	pdf.SetY(startY + 44)
}

func hasRMDuplicateSignatureLookup(lookups ...signatureLookup) bool {
	for _, lk := range lookups {
		if strings.HasPrefix(strings.TrimSpace(lk.DocType), "rm_dup_") {
			return true
		}
	}
	return false
}

// addDualSignature menambahkan area tanda tangan ganda: Pasien/Keluarga di kiri, Dokter di kanan.
func addDualSignature(pdf *gofpdf.Fpdf, city, doctorName, docType string, docID uint, altLookups ...signatureLookup) {
	dateStr := formatDateIndonesian(time.Now())
	if city != "" {
		dateStr = city + ", " + dateStr
	}

	lookups := append([]signatureLookup{}, altLookups...)
	if docType != "" && docID > 0 {
		lookups = append(lookups, signatureLookup{docType, docID})
	}

	signatureLog, isSigned := findSignatureLog(lookups...)
	rmDuplicateSignature := hasRMDuplicateSignatureLookup(lookups...)
	if rmDuplicateSignature {
		leftLog, leftSigned := findSignatureLogBySlot("left", lookups...)
		rightLog, rightSigned := findSignatureLogBySlot("right", lookups...)
		leftHasField := leftSigned && strings.TrimSpace(signatureLabelFromMeta(leftLog)) != ""
		rightHasField := rightSigned && strings.TrimSpace(signatureLabelFromMeta(rightLog)) != ""
		if !leftHasField && !rightHasField {
			return
		}
		isSigned = leftHasField || rightHasField
		if rightHasField {
			signatureLog = rightLog
		} else if leftHasField {
			signatureLog = leftLog
		}
	}
	if isSigned {
		signedDate := formatDateIndonesian(signatureLog.SignedAt)
		if city != "" {
			dateStr = city + ", " + signedDate
		} else {
			dateStr = signedDate
		}
		doctorName = resolveSignedUserName(signatureLog, doctorName)
	}

	requiredHeight := signatureHeight
	if isSigned {
		requiredHeight += footerHeight
	}
	checkPageBreak(pdf, requiredHeight)

	pdf.SetY(pdf.GetY() + 10)
	if rmDuplicateSignature {
		drawUniversalTwoSignatureSlots(pdf, city, dateStr, docType, docID, lookups...)
		if isSigned {
			addDigitalSignatureFooter(pdf, signatureLog, docType, docID)
		}
		return
	}

	// For standard dual signatures, use the universal slots method which respects the empty-when-unsigned rule.
	drawUniversalTwoSignatureSlots(pdf, city, dateStr, docType, docID, lookups...)
	if isSigned {
		addDigitalSignatureFooter(pdf, signatureLog, docType, docID)
	}
}

// rmDupSignatureLookup builds a signatureLookup for rm_duplicate context from query param.
func rmDupSignatureLookup(c *gin.Context, rmDupDocType string) signatureLookup {
	rmDupIDStr := c.Query("rm_duplicate_id")
	if rmDupIDStr == "" {
		return signatureLookup{}
	}
	rmDupID, err := strconv.ParseUint(rmDupIDStr, 10, 32)
	if err != nil || rmDupID == 0 {
		return signatureLookup{}
	}
	return signatureLookup{DocType: rmDupDocType, DocID: uint(rmDupID)}
}

// sigLookupFromQuery extracts optional sig_type & sig_id query params as alternate signature lookup.
func sigLookupFromQuery(c *gin.Context) signatureLookup {
	sigType := c.Query("sig_type")
	sigIDStr := c.Query("sig_id")
	if sigType == "" || sigIDStr == "" {
		return signatureLookup{}
	}
	sigID, err := strconv.ParseUint(sigIDStr, 10, 32)
	if err != nil || sigID == 0 {
		return signatureLookup{}
	}
	return signatureLookup{DocType: sigType, DocID: uint(sigID)}
}

// findSignatureLog looks up signature from multiple lookups, returns log and isSigned.
func findSignatureLog(lookups ...signatureLookup) (models.SignatureLog, bool) {
	var signatureLog models.SignatureLog
	for _, lk := range lookups {
		if lk.DocType == "" || lk.DocID == 0 {
			continue
		}

		rules := loadDocumentSignatureRules()
		for _, rule := range rules {
			if rule.DocumentType != lk.DocType || len(rule.Slots) == 0 {
				continue
			}
			for _, slot := range rule.Slots {
				if slotLog, ok := findSignatureLogBySlot(slot, lk); ok {
					return slotLog, true
				}
			}
			break
		}

		var docSig models.DocumentSignature
		sigDB := database.DB
		if strings.HasPrefix(lk.DocType, "rm_dup_") {
			sigDB = database.CasemixDB
		}

		if err := sigDB.
			Where("document_type = ? AND document_id = ?", lk.DocType, lk.DocID).
			First(&docSig).Error; err == nil && docSig.SignedAt != nil && docSig.SignatureHash != "" {
			if err := sigDB.
				Where("signature_hash = ? AND action = ?", docSig.SignatureHash, models.SignActionSign).
				Order("signed_at DESC").
				First(&signatureLog).Error; err == nil {
				return signatureLog, true
			}

			if err := sigDB.
				Where("document_type = ? AND document_id = ? AND action = ?", lk.DocType, lk.DocID, models.SignActionSign).
				Order("signed_at DESC").
				First(&signatureLog).Error; err == nil {
				return signatureLog, true
			}
		}
	}
	return signatureLog, false
}

func signatureDBForDocType(docType string) *gorm.DB {
	if strings.HasPrefix(docType, "rm_dup_") && database.CasemixDB != nil {
		return database.CasemixDB
	}
	return database.DB
}

// findSignatureLogBySlot resolves active signature by slot key (e.g. doctor_dpjp, nurse).
func findSignatureLogBySlot(slot string, lookups ...signatureLookup) (models.SignatureLog, bool) {
	var signatureLog models.SignatureLog
	slot = canonicalSignatureSlot(slot)
	if slot == "" {
		return signatureLog, false
	}

	for _, lk := range lookups {
		if strings.TrimSpace(lk.DocType) == "" || lk.DocID == 0 {
			continue
		}

		sigDB := signatureDBForDocType(lk.DocType)
		var signerState models.DocumentSignatureSigner
		
		var keys []string
		if slot == "left" {
			keys = []string{"left", "left:%", "patient", "patient:%", "pasien", "pasien:%", "nurse", "nurse:%", "perawat", "perawat:%"}
		} else if slot == "right" {
			keys = []string{"right", "right:%", "doctor_dpjp", "doctor_dpjp:%", "dokter", "dokter:%", "dpjp", "dpjp:%"}
		} else {
			keys = []string{slot, slot+":%"}
		}

		var args []interface{}
		args = append(args, lk.DocType, lk.DocID)
		
		placeholders := []string{}
		for _, k := range keys {
			if strings.HasSuffix(k, "%") {
				placeholders = append(placeholders, "signer_key LIKE ?")
			} else {
				placeholders = append(placeholders, "signer_key = ?")
			}
			args = append(args, k)
		}
		
		queryStr := fmt.Sprintf("document_type = ? AND document_id = ? AND (%s) AND signed_at IS NOT NULL AND is_active = ?", strings.Join(placeholders, " OR "))
		args = append(args, true)

		if err := sigDB.
			Where(queryStr, args...).
			Order("updated_at DESC").
			First(&signerState).Error; err != nil {
			continue
		}

		if strings.TrimSpace(signerState.SignatureHash) == "" {
			continue
		}

		if err := sigDB.
			Where("signature_hash = ? AND action = ?", signerState.SignatureHash, models.SignActionSign).
			Order("signed_at DESC").
			First(&signatureLog).Error; err == nil {
			return signatureLog, true
		}
	}

	return signatureLog, false
}

func canonicalSignatureSlot(slot string) string {
	switch strings.ToLower(strings.TrimSpace(slot)) {
	case "1", "left", "kiri":
		return "left"
	case "2", "right", "kanan":
		return "right"
	default:
		return strings.ToLower(strings.TrimSpace(slot))
	}
}

// addSignatureQR renders a QR code at the given position for a signed document.
func addSignatureQR(pdf *gofpdf.Fpdf, sigLog models.SignatureLog, centerX, centerY, qrSize float64, imgSuffix string) {
	meta := parseSignatureMeta(sigLog.Notes)
	if meta.role == "pasien" || meta.role == "kosong" {
		return
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5173"
	}
	verifyURL := fmt.Sprintf("%s/verify/%s", appURL, sigLog.SignatureHash)
	qrImgBytes := generateQRCode(verifyURL)
	if qrImgBytes != nil {
		imgName := fmt.Sprintf("qr_%s", imgSuffix)
		reader := bytes.NewReader(qrImgBytes)
		pdf.RegisterImageReader(imgName, "PNG", reader)
		qrX := centerX - qrSize/2
		qrY := centerY - qrSize/2
		pdf.Image(imgName, qrX, qrY, qrSize, qrSize, false, "PNG", 0, "")
		addLogoOverlayOnQR(pdf, qrX, qrY, qrSize)
	}
}

// addLogoOverlayOnQR overlays the hospital logo directly on the PDF, centered on the QR code.
func addLogoOverlayOnQR(pdf *gofpdf.Fpdf, qrX, qrY, qrSize float64) {
	var logoSetting models.Setting
	if err := database.DB.Where("key = ?", "app_logo").First(&logoSetting).Error; err != nil || logoSetting.Value == "" {
		return
	}

	logoFile := strings.TrimPrefix(logoSetting.Value, "/")
	logoFile = strings.TrimPrefix(logoFile, "uploads/")
	logoPath := filepath.Join("uploads", logoFile)

	if _, err := os.Stat(logoPath); err != nil {
		return
	}

	ext := strings.ToLower(filepath.Ext(logoPath))
	imgType := ""
	switch ext {
	case ".png":
		imgType = "PNG"
	case ".jpg", ".jpeg":
		imgType = "JPG"
	default:
		return
	}

	logoSize := qrSize * 0.20
	bgPadding := 0.3
	centerX := qrX + qrSize/2
	centerY := qrY + qrSize/2

	pdf.SetFillColor(255, 255, 255)
	pdf.Rect(
		centerX-logoSize/2-bgPadding,
		centerY-logoSize/2-bgPadding,
		logoSize+bgPadding*2,
		logoSize+bgPadding*2,
		"F",
	)
	pdf.SetFillColor(0, 0, 0)
	pdf.Image(logoPath, centerX-logoSize/2, centerY-logoSize/2, logoSize, logoSize, false, imgType, 0, "")
}

// addDigitalSignatureFooter menambahkan footer validasi tanda tangan digital.
func addDigitalSignatureFooter(pdf *gofpdf.Fpdf, signatureLog models.SignatureLog, docType string, docID uint) {
	footerY := pageHeight - marginBottom - footerHeight

	if pdf.GetY() > footerY-2 {
		pdf.AddPage()
		footerY = pageHeight - marginBottom - footerHeight
	}

	pdf.SetDrawColor(180, 180, 180)
	pdf.SetLineWidth(0.3)
	pdf.Line(marginLeft, footerY, marginLeft+contentWidth, footerY)
	pdf.SetDrawColor(100, 100, 100)

	footerY += 2

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5173"
	}
	verifyURL := fmt.Sprintf("%s/verify/%s", appURL, signatureLog.SignatureHash)

	qrSize := 15.0
	qrImgBytes := generateQRCode(verifyURL)
	if qrImgBytes != nil {
		imgName := fmt.Sprintf("qrf_%s_%d", docType, docID)
		reader := bytes.NewReader(qrImgBytes)
		pdf.RegisterImageReader(imgName, "PNG", reader)
		pdf.Image(imgName, marginLeft, footerY, qrSize, qrSize, false, "PNG", 0, "")
		addLogoOverlayOnQR(pdf, marginLeft, footerY, qrSize)
	}

	textX := marginLeft + qrSize + 3
	pdf.SetFont("Arial", "I", 7)
	pdf.SetTextColor(34, 139, 34)
	pdf.SetXY(textX, footerY)
	pdf.CellFormat(0, 3.5, "Dokumen ini telah ditandatangani secara digital", "", 1, "L", false, 0, "")
	pdf.SetTextColor(80, 80, 80)
	pdf.SetFont("Arial", "", 6)
	pdf.SetXY(textX, footerY+3.5)
	signedTimeStr := signatureLog.SignedAt.Format("02/01/2006 15:04 WIB")
	pdf.CellFormat(0, 3, fmt.Sprintf("Ditandatangani oleh: %s  |  %s", resolveSignedUserName(signatureLog, "-"), signedTimeStr), "", 1, "L", false, 0, "")
	pdf.SetXY(textX, footerY+6.5)
	pdf.CellFormat(0, 3, fmt.Sprintf("Hash: %s", truncateText(signatureLog.SignatureHash, 40)), "", 1, "L", false, 0, "")
	pdf.SetXY(textX, footerY+9.5)
	pdf.CellFormat(0, 3, fmt.Sprintf("Verifikasi: %s", verifyURL), "", 1, "L", false, 0, "")
	pdf.SetTextColor(0, 0, 0)
}

// generateQRCode generates a plain QR code PNG.
func generateQRCode(content string) []byte {
	qr, err := qrcode.New(content, qrcode.Medium)
	if err != nil {
		return nil
	}
	qr.DisableBorder = true
	qrImg := qr.Image(256)

	var buf bytes.Buffer
	if err := png.Encode(&buf, qrImg); err != nil {
		return nil
	}
	return buf.Bytes()
}
