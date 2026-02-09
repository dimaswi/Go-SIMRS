package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"
)

// formatInpatientClass converts kelas_1 etc to display format
func formatInpatientClass(class string) string {
	classMap := map[string]string{
		"kelas_1":   "Kelas 1",
		"kelas_2":   "Kelas 2",
		"kelas_3":   "Kelas 3",
		"non_kelas": "Non Kelas",
		"vip":       "VIP",
		"vvip":      "VVIP",
		"hcu":       "HCU",
		"intensif":  "Intensif",
		"isolasi":   "Isolasi",
		"icu":       "ICU",
		"nicu":      "NICU",
		"picu":      "PICU",
	}
	if label, ok := classMap[class]; ok {
		return label
	}
	if class == "" {
		return "-"
	}
	return class
}

// formatDateIndonesian formats date to Indonesian format (e.g. "31 Januari 2026")
func formatDateIndonesian(t time.Time) string {
	months := []string{
		"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
		"Juli", "Agustus", "September", "Oktober", "November", "Desember",
	}
	return fmt.Sprintf("%d %s %d", t.Day(), months[t.Month()], t.Year())
}

// formatDateTimeIndonesian formats datetime to Indonesian format (e.g. "31 Januari 2026, 14:30 WIB")
func formatDateTimeIndonesian(t time.Time) string {
	months := []string{
		"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
		"Juli", "Agustus", "September", "Oktober", "November", "Desember",
	}
	return fmt.Sprintf("%d %s %d, %02d:%02d WIB", t.Day(), months[t.Month()], t.Year(), t.Hour(), t.Minute())
}

// HospitalInfo untuk header dokumen
type HospitalInfo struct {
	Name     string
	SubTitle string
	Type     string
	Address  string
	City     string
	Phone    string
	Fax      string
	Email    string
	Website  string
	Logo     string
	BPJSLogo string
}

// getHospitalInfo mengambil informasi rumah sakit dari settings
func getHospitalInfo() HospitalInfo {
	var settings []models.Setting
	database.DB.Find(&settings)

	info := HospitalInfo{}
	for _, s := range settings {
		switch s.Key {
		case "hospital_name":
			info.Name = s.Value
		case "app_subtitle":
			info.SubTitle = s.Value
		case "hospital_type":
			info.Type = s.Value
		case "hospital_address":
			info.Address = s.Value
		case "hospital_city":
			info.City = s.Value
		case "hospital_phone":
			info.Phone = s.Value
		case "hospital_fax":
			info.Fax = s.Value
		case "hospital_email":
			info.Email = s.Value
		case "hospital_website":
			info.Website = s.Value
		case "app_logo":
			info.Logo = s.Value
		case "bpjs_logo":
			info.BPJSLogo = s.Value
		}
	}
	return info
}

// addHeader menambahkan kop surat ke PDF
func addHeader(pdf *gofpdf.Fpdf, info HospitalInfo, title string, subtitle string) {
	pdf.SetFont("Arial", "", 10)

	// Logo - di sebelah kiri, ukuran lebih kecil
	logoWidth := 15.0
	logoPath := ""
	if info.Logo != "" {
		// Remove leading slash and /uploads prefix if exists
		logoFile := strings.TrimPrefix(info.Logo, "/")
		logoFile = strings.TrimPrefix(logoFile, "uploads/")
		logoPath = filepath.Join("uploads", logoFile)

		// Check if file exists
		if _, err := os.Stat(logoPath); err == nil {
			// Get image type from extension
			ext := strings.ToLower(filepath.Ext(logoPath))
			imgType := ""
			switch ext {
			case ".png":
				imgType = "PNG"
			case ".jpg", ".jpeg":
				imgType = "JPG"
			}
			if imgType != "" {
				pdf.Image(logoPath, marginLeft, 10, logoWidth, logoWidth, false, imgType, 0, "")
			}
		}
	}

	// Hospital name - setelah logo
	textStartX := marginLeft + logoWidth + 3
	textWidth := contentWidth - logoWidth - 3
	pdf.SetFont("Arial", "B", 12)
	pdf.SetXY(textStartX, 10)
	pdf.CellFormat(textWidth, 5, strings.ToUpper(info.Name), "", 1, "C", false, 0, "")

	// Address
	pdf.SetFont("Arial", "", 8)
	pdf.SetXY(textStartX, 15)
	address := info.Address
	if info.City != "" {
		address += ", " + info.City
	}
	pdf.CellFormat(textWidth, 4, address, "", 1, "C", false, 0, "")

	// Contact info
	pdf.SetXY(textStartX, 19)
	contact := []string{}
	if info.Phone != "" {
		contact = append(contact, "Telp: "+info.Phone)
	}
	if info.Fax != "" {
		contact = append(contact, "Fax: "+info.Fax)
	}
	if info.Email != "" {
		contact = append(contact, info.Email)
	}
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(textWidth, 4, strings.Join(contact, " | "), "", 1, "C", false, 0, "")

	// Website
	if info.Website != "" {
		pdf.SetXY(textStartX, 23)
		pdf.CellFormat(textWidth, 4, info.Website, "", 1, "C", false, 0, "")
	}

	// Double line
	pdf.SetY(30)
	pdf.SetLineWidth(0.8)
	pdf.Line(15, 30, 195, 30)
	pdf.SetLineWidth(0.3)
	pdf.Line(15, 31, 195, 31)

	// Title
	if title != "" {
		pdf.SetY(35)
		pdf.SetFont("Arial", "BU", 12)
		pdf.CellFormat(0, 6, strings.ToUpper(title), "", 1, "C", false, 0, "")

		if subtitle != "" {
			pdf.SetFont("Arial", "", 10)
			pdf.CellFormat(0, 5, subtitle, "", 1, "C", false, 0, "")
		}
	}

	pdf.SetY(pdf.GetY() + 5)
}

// addThermalHeader menambahkan kop surat ke PDF thermal (100mm width)
func addThermalHeader(pdf *gofpdf.Fpdf, info HospitalInfo, title string) float64 {
	marginL := 3.0
	contentW := 94.0 // 100 - 6 margin
	startY := 3.0

	// Logo - di sebelah kiri
	logoWidth := 12.0
	logoPath := ""
	if info.Logo != "" {
		logoFile := strings.TrimPrefix(info.Logo, "/")
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
				pdf.Image(logoPath, marginL, startY, logoWidth, logoWidth, false, imgType, 0, "")
			}
		}
	}

	// Hospital name - setelah logo, full width untuk nama panjang
	textStartX := marginL + logoWidth + 2
	textWidth := contentW - logoWidth - 2
	pdf.SetFont("Arial", "B", 8)
	pdf.SetXY(textStartX, startY+1)
	// MultiCell untuk nama RS yang panjang bisa wrap
	pdf.MultiCell(textWidth, 3.5, info.Name, "", "C", false)

	// Address - full width di bawah nama
	pdf.SetFont("Arial", "", 6)
	address := info.Address
	if info.City != "" {
		address += ", " + info.City
	}
	pdf.SetX(textStartX)
	pdf.MultiCell(textWidth, 3, address, "", "C", false)

	// Contact info
	contact := ""
	if info.Phone != "" {
		contact = "Telp: " + info.Phone
	}
	pdf.SetX(textStartX)
	pdf.CellFormat(textWidth, 3, contact, "", 1, "C", false, 0, "")

	// Double line - posisi setelah logo selesai
	lineY := startY + logoWidth + 2
	if pdf.GetY() > lineY {
		lineY = pdf.GetY() + 1
	}
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.5)
	pdf.Line(marginL, lineY, marginL+contentW, lineY)
	pdf.SetLineWidth(0.2)
	pdf.Line(marginL, lineY+0.8, marginL+contentW, lineY+0.8)

	// Title (if any)
	currentY := lineY + 2.5
	if title != "" {
		pdf.SetY(currentY)
		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(0, 5, strings.ToUpper(title), "", 1, "C", false, 0, "")
		currentY = pdf.GetY() + 1
	}

	return currentY
}

// addHeaderLandscape menambahkan kop surat ke PDF dalam mode landscape (A4 = 297x210mm)
func addHeaderLandscape(pdf *gofpdf.Fpdf, info HospitalInfo, title string, subtitle string) {
	marginL := 10.0
	contentW := 277.0 // 297 - 10 - 10

	pdf.SetFont("Arial", "", 10)

	// Logo - di sebelah kiri
	logoWidth := 15.0
	logoPath := ""
	if info.Logo != "" {
		logoFile := strings.TrimPrefix(info.Logo, "/")
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
				pdf.Image(logoPath, marginL, 8, logoWidth, logoWidth, false, imgType, 0, "")
			}
		}
	}

	// Hospital name
	textStartX := marginL + logoWidth + 3
	textWidth := contentW - logoWidth - 3
	pdf.SetFont("Arial", "B", 12)
	pdf.SetXY(textStartX, 8)
	pdf.CellFormat(textWidth, 5, strings.ToUpper(info.Name), "", 1, "C", false, 0, "")

	// Address
	pdf.SetFont("Arial", "", 8)
	pdf.SetXY(textStartX, 13)
	address := info.Address
	if info.City != "" {
		address += ", " + info.City
	}
	pdf.CellFormat(textWidth, 4, address, "", 1, "C", false, 0, "")

	// Contact
	pdf.SetXY(textStartX, 17)
	contact := []string{}
	if info.Phone != "" {
		contact = append(contact, "Telp: "+info.Phone)
	}
	if info.Email != "" {
		contact = append(contact, info.Email)
	}
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(textWidth, 4, strings.Join(contact, " | "), "", 1, "C", false, 0, "")

	// Double line
	pdf.SetY(25)
	pdf.SetLineWidth(0.8)
	pdf.Line(marginL, 25, marginL+contentW, 25)
	pdf.SetLineWidth(0.3)
	pdf.Line(marginL, 26, marginL+contentW, 26)

	// Title
	if title != "" {
		pdf.SetY(29)
		pdf.SetFont("Arial", "BU", 11)
		pdf.CellFormat(0, 5, strings.ToUpper(title), "", 1, "C", false, 0, "")
		if subtitle != "" {
			pdf.SetFont("Arial", "", 9)
			pdf.CellFormat(0, 4, subtitle, "", 1, "C", false, 0, "")
		}
	}

	pdf.SetY(pdf.GetY() + 3)
}

// addPatientInfoTableLandscape menambahkan info pasien dalam format table untuk landscape
func addPatientInfoTableLandscape(pdf *gofpdf.Fpdf, patient *models.Patient, visit *models.Visit) {
	contentW := 277.0 // 297 - 10 - 10
	rowH := 5.0

	pdf.SetFont("Arial", "", 9)
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.2)

	// Column widths for landscape: 40 | 98 | 40 | 99 = 277
	col1 := 40.0
	col2 := 98.0
	col3 := 40.0
	col4 := 99.0

	// Patient Info Header
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentW, 6, " DATA PASIEN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)

	// Row 1: No RM | Gender
	pdf.SetFillColor(245, 245, 245)
	pdf.CellFormat(col1, rowH, " No. RM", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(col2, rowH, " "+patient.NoRM, "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowH, " Jenis Kelamin", "1", 0, "L", true, 0, "")
	gender := string(patient.JenisKelamin)
	if gender == "L" {
		gender = "Laki-laki"
	} else if gender == "P" {
		gender = "Perempuan"
	}
	pdf.CellFormat(col4, rowH, " "+gender, "1", 1, "L", false, 0, "")

	// Row 2: Nama | Gol Darah
	pdf.CellFormat(col1, rowH, " Nama Lengkap", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(col2, rowH, " "+patient.NamaLengkap, "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowH, " Gol. Darah", "1", 0, "L", true, 0, "")
	bloodType := string(patient.GolonganDarah)
	if bloodType == "" {
		bloodType = "-"
	}
	if patient.Rhesus != "" {
		bloodType += " " + string(patient.Rhesus)
	}
	pdf.CellFormat(col4, rowH, " "+bloodType, "1", 1, "L", false, 0, "")

	// Row 3: TTL | No HP
	pdf.CellFormat(col1, rowH, " Tanggal Lahir", "1", 0, "L", true, 0, "")
	birthDate := "-"
	age := ""
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = patient.TanggalLahir.Format("02-01-2006")
		age = fmt.Sprintf(" (%d tahun)", calculateAgeYears(patient.TanggalLahir.Time))
	}
	pdf.CellFormat(col2, rowH, " "+birthDate+age, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowH, " No. HP", "1", 0, "L", true, 0, "")
	phone := safeString(patient.NoHP)
	if phone == "" {
		phone = "-"
	}
	pdf.CellFormat(col4, rowH, " "+phone, "1", 1, "L", false, 0, "")

	// Row 4: Ruangan | Dokter
	roomName := "-"
	if visit != nil && visit.Room != nil {
		roomName = visit.Room.Name
	}
	pdf.CellFormat(col1, rowH, " Ruangan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2, rowH, " "+roomName, "1", 0, "L", false, 0, "")
	doctorName := "-"
	if visit != nil && visit.Doctor != nil {
		doctorName = visit.Doctor.NamaLengkap
	}
	pdf.CellFormat(col3, rowH, " Dokter", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col4, rowH, " "+doctorName, "1", 1, "L", false, 0, "")

	// Row 5: Tanggal Kunjungan
	visitDate := "-"
	if visit != nil && visit.StartTime != nil {
		visitDate = formatDateIndonesian(*visit.StartTime) + ", " + visit.StartTime.Format("15:04")
	}
	pdf.CellFormat(col1, rowH, " Tgl Kunjungan", "1", 0, "L", true, 0, "")
	pdf.CellFormat(col2+col3+col4, rowH, " "+visitDate, "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 3)
}

// addPatientInfo menambahkan info pasien dalam format table
func addPatientInfoTable(pdf *gofpdf.Fpdf, patient *models.Patient, visit *models.Visit) {
	pdf.SetFont("Arial", "", 9)
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.2)

	// Column widths: 35 | 55 | 35 | 55 = 180
	col1 := 35.0
	col2 := 55.0
	col3 := 35.0
	col4 := 55.0

	// Patient Info Header
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA PASIEN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)

	// Row 1: No RM | Gender
	pdf.SetFillColor(245, 245, 245)
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

	// Row 2: Nama | Gol Darah
	pdf.CellFormat(col1, rowHeight, " Nama Lengkap", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(col2, rowHeight, " "+truncateText(patient.NamaLengkap, 28), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowHeight, " Gol. Darah", "1", 0, "L", true, 0, "")
	bloodType := string(patient.GolonganDarah)
	if bloodType == "" {
		bloodType = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+bloodType, "1", 1, "L", false, 0, "")

	// Row 3: TTL | No HP
	pdf.CellFormat(col1, rowHeight, " Tanggal Lahir", "1", 0, "L", true, 0, "")
	birthDate := "-"
	age := ""
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = patient.TanggalLahir.Format("02-01-2006")
		age = fmt.Sprintf(" (%d th)", calculateAgeYears(patient.TanggalLahir.Time))
	}
	pdf.CellFormat(col2, rowHeight, " "+birthDate+age, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " No. HP", "1", 0, "L", true, 0, "")
	phone := patient.NoHP
	if phone == "" {
		phone = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+phone, "1", 1, "L", false, 0, "")

	// Row 4: NIK | Penanggung Jawab
	pdf.CellFormat(col1, rowHeight, " NIK", "1", 0, "L", true, 0, "")
	nik := patient.NIK
	if nik == "" {
		nik = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+nik, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Penanggung Jawab", "1", 0, "L", true, 0, "")
	pj := patient.NamaPenanggungJawab
	if pj == "" {
		pj = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+truncateText(pj, 28), "1", 1, "L", false, 0, "")

	// Row 5: Alamat (full width)
	pdf.CellFormat(col1, rowHeight, " Alamat", "1", 0, "L", true, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+truncateText(alamat, 72), "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 2)

	// Visit info
	if visit != nil {
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(220, 220, 220)
		pdf.SetLineWidth(0.3)
		pdf.CellFormat(contentWidth, 6, " DATA KUNJUNGAN", "1", 1, "L", true, 0, "")
		pdf.SetLineWidth(0.2)
		pdf.SetFont("Arial", "", 9)

		pdf.SetFillColor(245, 245, 245)
		// Row 1: No Kunjungan | Ruangan
		pdf.CellFormat(col1, rowHeight, " No. Kunjungan", "1", 0, "L", true, 0, "")
		pdf.SetFont("Arial", "B", 9)
		pdf.CellFormat(col2, rowHeight, " "+visit.VisitNumber, "1", 0, "L", false, 0, "")
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(col3, rowHeight, " Ruangan", "1", 0, "L", true, 0, "")
		roomName := "-"
		if visit.Room != nil {
			roomName = visit.Room.Name
		}
		pdf.CellFormat(col4, rowHeight, " "+truncateText(roomName, 28), "1", 1, "L", false, 0, "")

		// Row 2: Tanggal | Dokter
		pdf.CellFormat(col1, rowHeight, " Tgl Kunjungan", "1", 0, "L", true, 0, "")
		visitDate := "-"
		if visit.StartTime != nil {
			visitDate = visit.StartTime.Format("02-01-2006")
		}
		pdf.CellFormat(col2, rowHeight, " "+visitDate, "1", 0, "L", false, 0, "")
		pdf.CellFormat(col3, rowHeight, " Dokter", "1", 0, "L", true, 0, "")
		doctorName := "-"
		if visit.Doctor != nil {
			doctorName = visit.Doctor.NamaLengkap
		}
		pdf.CellFormat(col4, rowHeight, " "+truncateText(doctorName, 28), "1", 1, "L", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 3)
}

// addProcedureOrderInfoTable menambahkan info pasien dan order dalam format table untuk procedure order
func addProcedureOrderInfoTable(pdf *gofpdf.Fpdf, patient *models.Patient, order *models.ProcedureOrder) {
	pdf.SetFont("Arial", "", 9)
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.2)

	// Column widths: 35 | 55 | 35 | 55 = 180
	col1 := 35.0
	col2 := 55.0
	col3 := 35.0
	col4 := 55.0

	// Patient Info Header
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " DATA PASIEN", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)

	// Row 1: No RM | Gender
	pdf.SetFillColor(245, 245, 245)
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

	// Row 2: Nama | Gol Darah
	pdf.CellFormat(col1, rowHeight, " Nama Lengkap", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(col2, rowHeight, " "+truncateText(patient.NamaLengkap, 28), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowHeight, " Gol. Darah", "1", 0, "L", true, 0, "")
	bloodType := string(patient.GolonganDarah)
	if bloodType == "" {
		bloodType = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+bloodType, "1", 1, "L", false, 0, "")

	// Row 3: TTL | No HP
	pdf.CellFormat(col1, rowHeight, " Tanggal Lahir", "1", 0, "L", true, 0, "")
	birthDate := "-"
	age := ""
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = patient.TanggalLahir.Format("02-01-2006")
		age = fmt.Sprintf(" (%d th)", calculateAgeYears(patient.TanggalLahir.Time))
	}
	pdf.CellFormat(col2, rowHeight, " "+birthDate+age, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " No. HP", "1", 0, "L", true, 0, "")
	phone := patient.NoHP
	if phone == "" {
		phone = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+phone, "1", 1, "L", false, 0, "")

	// Row 4: Alamat (full width)
	pdf.CellFormat(col1, rowHeight, " Alamat", "1", 0, "L", true, 0, "")
	alamat := patient.AlamatKTP
	if alamat == "" {
		alamat = "-"
	}
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+truncateText(alamat, 72), "1", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 2)

	// Order info
	if order != nil {
		pdf.SetFont("Arial", "B", 9)
		pdf.SetFillColor(220, 220, 220)
		pdf.SetLineWidth(0.3)
		pdf.CellFormat(contentWidth, 6, " DATA ORDER", "1", 1, "L", true, 0, "")
		pdf.SetLineWidth(0.2)
		pdf.SetFont("Arial", "", 9)

		pdf.SetFillColor(245, 245, 245)
		// Row 1: No Order | Tgl Order
		pdf.CellFormat(col1, rowHeight, " No. Order", "1", 0, "L", true, 0, "")
		pdf.SetFont("Arial", "B", 9)
		pdf.CellFormat(col2, rowHeight, " "+order.OrderNumber, "1", 0, "L", false, 0, "")
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(col3, rowHeight, " Tgl Order", "1", 0, "L", true, 0, "")
		orderDate := formatDateIndonesian(order.CreatedAt) + ", " + order.CreatedAt.Format("15:04")
		pdf.CellFormat(col4, rowHeight, " "+orderDate, "1", 1, "L", false, 0, "")

		// Row 2: Ruang Asal | Dokter Pengirim
		pdf.CellFormat(col1, rowHeight, " Ruang Asal", "1", 0, "L", true, 0, "")
		roomName := "-"
		if order.SourceRoom != nil {
			roomName = order.SourceRoom.Name
		}
		pdf.CellFormat(col2, rowHeight, " "+truncateText(roomName, 28), "1", 0, "L", false, 0, "")
		pdf.CellFormat(col3, rowHeight, " Dokter Pengirim", "1", 0, "L", true, 0, "")
		doctorName := "-"
		if order.OrderedBy != nil {
			doctorName = order.OrderedBy.NamaLengkap
		}
		pdf.CellFormat(col4, rowHeight, " "+truncateText(doctorName, 28), "1", 1, "L", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 3)
}

// Constants for page layout
const (
	pageWidth       = 210.0
	pageHeight      = 297.0
	marginLeft      = 15.0
	marginRight     = 15.0
	marginTop       = 15.0
	marginBottom    = 15.0
	contentWidth    = pageWidth - marginLeft - marginRight // 180mm
	signatureHeight = 45.0                                 // Space needed for signature area
	rowHeight       = 5.0                                  // Standard row height
)

// checkPageBreak checks if we need a new page and adds one if necessary
func checkPageBreak(pdf *gofpdf.Fpdf, requiredHeight float64) bool {
	availableHeight := pageHeight - marginBottom - pdf.GetY()
	if availableHeight < requiredHeight {
		pdf.AddPage()
		return true
	}
	return false
}

// addTableHeader adds a section header in table style
func addTableHeader(pdf *gofpdf.Fpdf, title string) {
	checkPageBreak(pdf, 10)
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.3)
	pdf.CellFormat(contentWidth, 6, " "+title, "1", 1, "L", true, 0, "")
}

// addTableRow adds a label-value row in table style with auto-height for long text
func addTableRow(pdf *gofpdf.Fpdf, label, value string, labelWidth float64) {
	pdf.SetFont("Arial", "", 9)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.2)

	valueWidth := contentWidth - labelWidth
	padding := 2.0
	lineHeight := 4.5

	// Split value text into wrapped lines using the available width
	wrappedLines := pdf.SplitLines([]byte(value), valueWidth-padding)
	if len(wrappedLines) == 0 {
		wrappedLines = [][]byte{[]byte(value)}
	}

	// Calculate total row height
	totalHeight := float64(len(wrappedLines)) * lineHeight
	if totalHeight < rowHeight {
		totalHeight = rowHeight
	}

	// Check page break — move the entire row to new page if it doesn't fit
	if pdf.GetY()+totalHeight > pageHeight-marginBottom {
		pdf.AddPage()
	}

	startX := marginLeft
	startY := pdf.GetY()

	// Draw label cell (filled background + border)
	pdf.SetFillColor(245, 245, 245)
	pdf.Rect(startX, startY, labelWidth, totalHeight, "FD")
	// Vertically center the label text
	labelY := startY + (totalHeight-lineHeight)/2
	pdf.SetXY(startX+1, labelY)
	pdf.CellFormat(labelWidth-2, lineHeight, label, "", 0, "L", false, 0, "")

	// Draw value cell border
	pdf.Rect(startX+labelWidth, startY, valueWidth, totalHeight, "D")
	// Write each wrapped line manually (no MultiCell = no auto page break)
	for i, line := range wrappedLines {
		pdf.SetXY(startX+labelWidth+1, startY+0.5+float64(i)*lineHeight)
		pdf.CellFormat(valueWidth-padding, lineHeight, string(line), "", 0, "L", false, 0, "")
	}

	// Set Y for next row
	pdf.SetY(startY + totalHeight)
}

// addTableMultiRow adds a label-value row with multiline value (supports both \n and word wrapping)
func addTableMultiRow(pdf *gofpdf.Fpdf, label, value string, labelWidth float64) {
	if value == "" {
		value = "Tidak ada"
	}

	pdf.SetFont("Arial", "", 9)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.2)

	valueWidth := contentWidth - labelWidth
	padding := 2.0
	lineHeight := 4.5

	// Build all rendered lines: split by \n first, then word-wrap each paragraph
	var allLines []string
	paragraphs := strings.Split(value, "\n")
	for _, para := range paragraphs {
		if para == "" {
			allLines = append(allLines, "")
			continue
		}
		wrapped := pdf.SplitLines([]byte(para), valueWidth-padding)
		if len(wrapped) == 0 {
			allLines = append(allLines, para)
		} else {
			for _, wl := range wrapped {
				allLines = append(allLines, string(wl))
			}
		}
	}
	if len(allLines) == 0 {
		allLines = []string{value}
	}

	height := float64(len(allLines)) * lineHeight
	if height < rowHeight {
		height = rowHeight
	}

	// Page break check — move entire row to new page
	if pdf.GetY()+height > pageHeight-marginBottom {
		pdf.AddPage()
	}

	startY := pdf.GetY()

	// Label cell with fill
	pdf.SetFillColor(245, 245, 245)
	pdf.Rect(marginLeft, startY, labelWidth, height, "FD")
	labelY := startY + (height-lineHeight)/2
	pdf.SetXY(marginLeft+1, labelY)
	pdf.CellFormat(labelWidth-2, lineHeight, label, "", 0, "L", false, 0, "")

	// Value cell border
	pdf.Rect(marginLeft+labelWidth, startY, valueWidth, height, "D")
	// Write each line manually
	for i, line := range allLines {
		pdf.SetXY(marginLeft+labelWidth+1, startY+0.5+float64(i)*lineHeight)
		pdf.CellFormat(valueWidth-padding, lineHeight, line, "", 0, "L", false, 0, "")
	}

	// Set position for next row
	pdf.SetY(startY + height)
}

// addTableFullRow adds a full-width row with auto-height for long text
func addTableFullRow(pdf *gofpdf.Fpdf, value string, isBold bool, color ...int) {
	if value == "" {
		value = "-"
	}

	if isBold {
		pdf.SetFont("Arial", "B", 9)
	} else {
		pdf.SetFont("Arial", "", 9)
	}

	padding := 2.0
	lineHeight := 4.5

	// Split text into wrapped lines
	wrappedLines := pdf.SplitLines([]byte(value), contentWidth-padding)
	if len(wrappedLines) == 0 {
		wrappedLines = [][]byte{[]byte(value)}
	}

	totalHeight := float64(len(wrappedLines)) * lineHeight
	if totalHeight < rowHeight {
		totalHeight = rowHeight
	}

	// Check page break for the entire row
	if pdf.GetY()+totalHeight > pageHeight-marginBottom {
		pdf.AddPage()
	}

	if len(color) >= 3 {
		pdf.SetTextColor(color[0], color[1], color[2])
	}

	startY := pdf.GetY()

	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.2)

	// Draw cell border
	pdf.Rect(marginLeft, startY, contentWidth, totalHeight, "D")
	// Write each line manually (no MultiCell = no auto page break)
	for i, line := range wrappedLines {
		pdf.SetXY(marginLeft+1, startY+0.5+float64(i)*lineHeight)
		pdf.CellFormat(contentWidth-padding, lineHeight, string(line), "", 0, "L", false, 0, "")
	}

	if len(color) >= 3 {
		pdf.SetTextColor(0, 0, 0)
	}

	// Set Y for next row
	pdf.SetY(startY + totalHeight)
}

// addTableEnd adds spacing after a table section
func addTableEnd(pdf *gofpdf.Fpdf) {
	pdf.SetY(pdf.GetY() + 3)
}

// addSignature menambahkan area tanda tangan dalam format sederhana
// Hanya menampilkan kota, tanggal (Indonesia) dan nama dokter
func addSignature(pdf *gofpdf.Fpdf, city, doctorName, patientLabel string) {
	// Check if we have enough space for signature
	checkPageBreak(pdf, signatureHeight)

	pdf.SetY(pdf.GetY() + 10)

	// Date in Indonesian
	dateStr := formatDateIndonesian(time.Now())
	if city != "" {
		dateStr = city + ", " + dateStr
	}

	// Simple signature area - right aligned
	pdf.SetFont("Arial", "", 10)

	// City and Date
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, dateStr, "", 1, "C", false, 0, "")

	// Label (Dokter Pemeriksa)
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, "Dokter Pemeriksa,", "", 1, "C", false, 0, "")

	// Signature space (25mm)
	pdf.SetY(pdf.GetY() + 25)

	// Doctor name with underline
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, doctorName, "B", 1, "C", false, 0, "")
}

func calculateAgeYears(birthDate time.Time) int {
	today := time.Now()
	years := today.Year() - birthDate.Year()
	if today.YearDay() < birthDate.YearDay() {
		years--
	}
	return years
}

func truncateText(text string, maxLen int) string {
	if len(text) <= maxLen {
		return text
	}
	return text[:maxLen-3] + "..."
}

func safeString(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

// PrintOutpatientResume generates PDF for outpatient resume
func PrintOutpatientResume(c *gin.Context) {
	visitID := c.Param("visitId")

	// Load visit with all relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
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

	// Load anamnesis (connected directly to visit)
	var anamnesis models.Anamnesis
	database.DB.Where("visit_id = ?", visitID).First(&anamnesis)

	// Load physical exam
	var physicalExam models.PhysicalExamination
	database.DB.Where("visit_id = ?", visitID).First(&physicalExam)

	// Load diagnoses (multiple per visit)
	var diagnoses []models.Diagnosis
	database.DB.Where("visit_id = ?", visitID).Find(&diagnoses)

	// Load assessment plan
	var assessmentPlan models.AssessmentPlan
	database.DB.Where("visit_id = ?", visitID).First(&assessmentPlan)

	// Load disposition
	var disposition models.Disposition
	database.DB.Where("visit_id = ?", visitID).First(&disposition)

	// Load medicine orders
	var medicineOrders []models.MedicineOrder
	database.DB.Where("source_visit_id = ?", visitID).Preload("Items.Medicine").Find(&medicineOrders)

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Determine title based on visit type
	resumeTitle := "Resume Medis Rawat Jalan"
	// Check visit type first
	if visit.VisitType == "UGD" {
		resumeTitle = "Resume Medis UGD"
	} else if visit.VisitType == "Rawat Inap" {
		resumeTitle = "Resume Medis Rawat Inap"
	} else if visit.Room != nil {
		// Fallback to room type
		roomType := visit.Room.RoomType
		if roomType == "igd" || roomType == "ugd" || roomType == "emergency" {
			resumeTitle = "Resume Medis UGD"
		} else if roomType == "inpatient" || roomType == "rawat_inap" {
			resumeTitle = "Resume Medis Rawat Inap"
		}
	}

	// Header
	addHeader(pdf, hospitalInfo, resumeTitle, visit.VisitNumber)

	// Patient info table
	addPatientInfoTable(pdf, patient, &visit)

	// Anamnesis Section
	addTableHeader(pdf, "ANAMNESIS")
	if anamnesis.ID > 0 {
		addTableRow(pdf, "Keluhan Utama", safeString(anamnesis.ChiefComplaint), 40)
		addTableRow(pdf, "Riwayat Penyakit", safeString(anamnesis.HistoryOfPresentIllness), 40)
		if anamnesis.Allergies != "" {
			pdf.SetFont("Arial", "B", 9)
			pdf.SetTextColor(220, 53, 69)
			pdf.SetDrawColor(180, 180, 180)
			pdf.CellFormat(40, rowHeight, " Alergi", "LB", 0, "L", false, 0, "")
			pdf.CellFormat(contentWidth-40, rowHeight, anamnesis.Allergies, "RB", 1, "L", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
		}
	} else {
		addTableFullRow(pdf, "Tidak ada data anamnesis", false)
	}
	addTableEnd(pdf)

	// Physical Examination Section
	addTableHeader(pdf, "PEMERIKSAAN FISIK")
	if physicalExam.ID > 0 {
		addTableRow(pdf, "Keadaan Umum", safeString(physicalExam.GeneralCondition), 40)
		addTableRow(pdf, "Kesadaran", safeString(physicalExam.Consciousness), 40)

		// Vital Signs - each in separate row
		if physicalExam.BloodPressure != "" {
			addTableRow(pdf, "Tekanan Darah", physicalExam.BloodPressure+" mmHg", 40)
		}
		if physicalExam.HeartRate != "" {
			addTableRow(pdf, "Nadi", physicalExam.HeartRate+" x/menit", 40)
		}
		if physicalExam.RespiratoryRate != "" {
			addTableRow(pdf, "Frekuensi Napas", physicalExam.RespiratoryRate+" x/menit", 40)
		}
		if physicalExam.Temperature != "" {
			addTableRow(pdf, "Suhu", physicalExam.Temperature+" C", 40)
		}
		if physicalExam.OxygenSaturation != "" {
			addTableRow(pdf, "SpO2", physicalExam.OxygenSaturation+" %", 40)
		}
		if physicalExam.Weight != "" {
			addTableRow(pdf, "Berat Badan", physicalExam.Weight+" kg", 40)
		}
		if physicalExam.Height != "" {
			addTableRow(pdf, "Tinggi Badan", physicalExam.Height+" cm", 40)
		}
		// Pemeriksaan Fisik per Sistem Organ
		if physicalExam.Head != "" {
			addTableRow(pdf, "Kepala", physicalExam.Head, 40)
		}
		if physicalExam.Eyes != "" {
			addTableRow(pdf, "Mata", physicalExam.Eyes, 40)
		}
		if physicalExam.Ears != "" {
			addTableRow(pdf, "Telinga", physicalExam.Ears, 40)
		}
		if physicalExam.Nose != "" {
			addTableRow(pdf, "Hidung", physicalExam.Nose, 40)
		}
		if physicalExam.Throat != "" {
			addTableRow(pdf, "Tenggorokan", physicalExam.Throat, 40)
		}
		if physicalExam.ENT != "" {
			addTableRow(pdf, "THT", physicalExam.ENT, 40)
		}
		if physicalExam.Neck != "" {
			addTableRow(pdf, "Leher", physicalExam.Neck, 40)
		}
		if physicalExam.Chest != "" {
			addTableRow(pdf, "Dada", physicalExam.Chest, 40)
		}
		if physicalExam.Thorax != "" {
			addTableRow(pdf, "Thorax", physicalExam.Thorax, 40)
		}
		if physicalExam.Heart != "" {
			addTableRow(pdf, "Jantung", physicalExam.Heart, 40)
		}
		if physicalExam.Cardiac != "" {
			addTableRow(pdf, "Kardiak", physicalExam.Cardiac, 40)
		}
		if physicalExam.Lungs != "" {
			addTableRow(pdf, "Paru", physicalExam.Lungs, 40)
		}
		if physicalExam.Pulmonary != "" {
			addTableRow(pdf, "Pulmoner", physicalExam.Pulmonary, 40)
		}
		if physicalExam.Abdomen != "" {
			addTableRow(pdf, "Abdomen", physicalExam.Abdomen, 40)
		}
		if physicalExam.Extremities != "" {
			addTableRow(pdf, "Ekstremitas", physicalExam.Extremities, 40)
		}
		if physicalExam.Skin != "" {
			addTableRow(pdf, "Kulit", physicalExam.Skin, 40)
		}
		if physicalExam.Neurological != "" {
			addTableRow(pdf, "Neurologis", physicalExam.Neurological, 40)
		}
		if physicalExam.Musculoskel != "" {
			addTableRow(pdf, "Muskuloskeletal", physicalExam.Musculoskel, 40)
		}
		if physicalExam.Genitourinary != "" {
			addTableRow(pdf, "Genitourinari", physicalExam.Genitourinary, 40)
		}
		if physicalExam.OtherFindings != "" {
			addTableRow(pdf, "Temuan Lain", physicalExam.OtherFindings, 40)
		}
		// ECG
		if physicalExam.ECGPerformed {
			if physicalExam.ECGResult != "" {
				addTableRow(pdf, "Hasil EKG", physicalExam.ECGResult, 40)
			}
			if physicalExam.ECGInterpretation != "" {
				addTableRow(pdf, "Interpretasi EKG", physicalExam.ECGInterpretation, 40)
			}
			if physicalExam.ECGNotes != "" {
				addTableRow(pdf, "Catatan EKG", physicalExam.ECGNotes, 40)
			}
		}
	} else {
		addTableFullRow(pdf, "Tidak ada data pemeriksaan fisik", false)
	}
	addTableEnd(pdf)

	// Diagnosis Section
	addTableHeader(pdf, "DIAGNOSIS")
	if len(diagnoses) > 0 {
		for _, diag := range diagnoses {
			diagType := ""
			if diag.Type == "primary" {
				diagType = "[Utama] "
			}
			addTableFullRow(pdf, fmt.Sprintf("%s%s - %s", diagType, diag.ICD10Code, diag.ICD10Name), false)
		}
	} else {
		addTableFullRow(pdf, "Tidak ada diagnosis", false)
	}
	addTableEnd(pdf)

	// Medications Section
	addTableHeader(pdf, "TERAPI / RESEP")
	hasMeds := false
	for _, order := range medicineOrders {
		if len(order.Items) > 0 {
			hasMeds = true
			break
		}
	}
	if hasMeds {
		// Medicine table header
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(245, 245, 245)
		pdf.SetDrawColor(180, 180, 180)
		pdf.CellFormat(10, rowHeight, "No", "1", 0, "C", true, 0, "")
		pdf.CellFormat(70, rowHeight, "Nama Obat", "1", 0, "C", true, 0, "")
		pdf.CellFormat(25, rowHeight, "Dosis", "1", 0, "C", true, 0, "")
		pdf.CellFormat(25, rowHeight, "Frekuensi", "1", 0, "C", true, 0, "")
		pdf.CellFormat(50, rowHeight, "Instruksi", "1", 1, "C", true, 0, "")

		pdf.SetFont("Arial", "", 8)
		no := 1
		for _, order := range medicineOrders {
			for _, item := range order.Items {
				checkPageBreak(pdf, rowHeight)
				medName := ""
				if item.Medicine != nil {
					medName = item.Medicine.Name
				}
				pdf.CellFormat(10, rowHeight, fmt.Sprintf("%d", no), "1", 0, "C", false, 0, "")
				pdf.CellFormat(70, rowHeight, truncateText(medName, 40), "1", 0, "", false, 0, "")
				pdf.CellFormat(25, rowHeight, item.Dosage, "1", 0, "C", false, 0, "")
				pdf.CellFormat(25, rowHeight, item.Frequency, "1", 0, "C", false, 0, "")
				pdf.CellFormat(50, rowHeight, truncateText(item.Instructions, 28), "1", 1, "", false, 0, "")
				no++
			}
		}
	} else {
		addTableFullRow(pdf, "Tidak ada resep obat", false)
	}
	addTableEnd(pdf)

	// Assessment Plan Section
	addTableHeader(pdf, "RENCANA")
	if assessmentPlan.ID > 0 {
		hasRencana := false
		if assessmentPlan.MedicationPlan != "" {
			addTableMultiRow(pdf, "Rencana Obat", assessmentPlan.MedicationPlan, 40)
			hasRencana = true
		}
		if assessmentPlan.DietPlan != "" {
			addTableMultiRow(pdf, "Rencana Diet", assessmentPlan.DietPlan, 40)
			hasRencana = true
		}
		if assessmentPlan.ActivityPlan != "" {
			addTableMultiRow(pdf, "Rencana Aktivitas", assessmentPlan.ActivityPlan, 40)
			hasRencana = true
		}
		if assessmentPlan.EducationPlan != "" {
			addTableMultiRow(pdf, "Rencana Edukasi", assessmentPlan.EducationPlan, 40)
			hasRencana = true
		}
		if assessmentPlan.ProcedurePlan != "" {
			addTableMultiRow(pdf, "Rencana Tindakan", assessmentPlan.ProcedurePlan, 40)
			hasRencana = true
		}
		if assessmentPlan.ConsultationPlan != "" {
			addTableMultiRow(pdf, "Rencana Konsultasi", assessmentPlan.ConsultationPlan, 40)
			hasRencana = true
		}
		if assessmentPlan.Prognosis != "" {
			addTableRow(pdf, "Prognosis", assessmentPlan.Prognosis, 40)
			hasRencana = true
		}
		if !hasRencana {
			addTableFullRow(pdf, "Tidak ada rencana", false)
		}
	} else {
		addTableFullRow(pdf, "Tidak ada rencana", false)
	}
	addTableEnd(pdf)

	// Disposition Section
	addTableHeader(pdf, "DISPOSISI")
	if disposition.ID > 0 {
		// Format disposition type to readable text
		dispType := disposition.DispositionType
		dispTypeDisplay := map[string]string{
			"pulang":     "Pulang",
			"rawat_inap": "Rawat Inap",
			"rujuk":      "Rujuk",
			"meninggal":  "Meninggal",
			"aps":        "APS (Atas Permintaan Sendiri)",
			"dod":        "DOA (Death on Arrival)",
		}
		if text, ok := dispTypeDisplay[dispType]; ok {
			dispType = text
		}
		addTableRow(pdf, "Status", dispType, 40)

		// Show discharge status if available
		if disposition.DischargeStatus != "" {
			statusDisplay := map[string]string{
				"sembuh":       "Sembuh",
				"membaik":      "Membaik",
				"belum_sembuh": "Belum Sembuh",
				"pulang_paksa": "Pulang Paksa",
			}
			status := disposition.DischargeStatus
			if text, ok := statusDisplay[status]; ok {
				status = text
			}
			addTableRow(pdf, "Kondisi Pulang", status, 40)
		}

		// Show admission info if rawat inap
		if disposition.DispositionType == "rawat_inap" {
			if disposition.AdmissionWard != "" {
				addTableRow(pdf, "Ruang Rawat Inap", disposition.AdmissionWard, 40)
			}
			if disposition.AdmissionReason != "" {
				addTableMultiRow(pdf, "Alasan Rawat Inap", disposition.AdmissionReason, 40)
			}
		}

		// Show referral info if rujuk
		if disposition.DispositionType == "rujuk" {
			if disposition.ReferralFacility != "" {
				addTableRow(pdf, "Tujuan Rujuk", disposition.ReferralFacility, 40)
			}
			if disposition.ReferralReason != "" {
				addTableMultiRow(pdf, "Alasan Rujuk", disposition.ReferralReason, 40)
			}
		}

		// Instructions
		if disposition.DischargeInstruction != "" {
			addTableMultiRow(pdf, "Instruksi Pulang", disposition.DischargeInstruction, 40)
		}
		if disposition.DischargeMedication != "" {
			addTableMultiRow(pdf, "Obat Pulang", disposition.DischargeMedication, 40)
		}

		// Follow up
		if disposition.FollowUpDate != nil {
			addTableRow(pdf, "Jadwal Kontrol", formatDateIndonesian(*disposition.FollowUpDate), 40)
		}
		if disposition.FollowUpInstruction != "" {
			addTableMultiRow(pdf, "Instruksi Kontrol", disposition.FollowUpInstruction, 40)
		}
	} else {
		addTableFullRow(pdf, "-", false)
	}
	addTableEnd(pdf)

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = visit.Doctor.NamaLengkap
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "Pasien/Keluarga")

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Resume_Medis_%s_%s.pdf", patient.NoRM, visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintPatientLabel generates PDF for patient labels
// Kertas: 80mm x 20mm, 2 kolom (2 label per halaman)
func PrintPatientLabel(c *gin.Context) {
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

// PrintInpatientResume generates PDF for inpatient resume
func PrintInpatientResume(c *gin.Context) {
	visitID := c.Param("visitId")

	// Load visit with all relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
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

	// Load anamnesis
	var anamnesis models.Anamnesis
	database.DB.Where("visit_id = ?", visitID).First(&anamnesis)

	// Load physical exam
	var physicalExam models.PhysicalExamination
	database.DB.Where("visit_id = ?", visitID).First(&physicalExam)

	// Load diagnoses (directly from visit)
	var diagnoses []models.Diagnosis
	database.DB.Where("visit_id = ?", visitID).Find(&diagnoses)

	// Load disposition
	var disposition models.Disposition
	database.DB.Where("visit_id = ?", visitID).First(&disposition)

	// Load medicine orders (discharge medications)
	var medicineOrders []models.MedicineOrder
	database.DB.Where("source_visit_id = ? AND prescription_type = ?", visitID, "discharge").
		Preload("Items.Medicine").Find(&medicineOrders)

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "Resume Medis Rawat Inap", visit.VisitNumber)

	// Patient info
	addPatientInfoTable(pdf, patient, &visit)

	// Admission & Discharge info
	addTableHeader(pdf, "INFORMASI RAWAT INAP")
	admitDate := "-"
	if visit.StartTime != nil {
		admitDate = formatDateIndonesian(*visit.StartTime) + ", " + visit.StartTime.Format("15:04")
	}
	addTableRow(pdf, "Tanggal Masuk", admitDate, 40)

	dischargeDate := "-"
	if visit.EndTime != nil {
		dischargeDate = formatDateIndonesian(*visit.EndTime) + ", " + visit.EndTime.Format("15:04")
	}
	addTableRow(pdf, "Tanggal Keluar", dischargeDate, 40)

	// Calculate LOS
	los := 0
	if visit.StartTime != nil && visit.EndTime != nil {
		duration := visit.EndTime.Sub(*visit.StartTime)
		los = int(duration.Hours() / 24)
		if los < 1 {
			los = 1
		}
	}
	addTableRow(pdf, "Lama Rawat", fmt.Sprintf("%d hari", los), 40)
	addTableEnd(pdf)

	// Anamnesis Section
	addTableHeader(pdf, "ANAMNESIS")
	if anamnesis.ID > 0 {
		addTableRow(pdf, "Keluhan Utama", safeString(anamnesis.ChiefComplaint), 40)
		addTableRow(pdf, "Riwayat Penyakit", safeString(anamnesis.HistoryOfPresentIllness), 40)
		if anamnesis.Allergies != "" {
			pdf.SetFont("Arial", "B", 9)
			pdf.SetTextColor(220, 53, 69)
			pdf.SetDrawColor(0, 0, 0)
			pdf.CellFormat(40, rowHeight, " Alergi", "LB", 0, "L", false, 0, "")
			pdf.CellFormat(contentWidth-40, rowHeight, anamnesis.Allergies, "RB", 1, "L", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
		}
	} else {
		addTableFullRow(pdf, "Tidak ada data anamnesis", false)
	}
	addTableEnd(pdf)

	// Physical Examination Section
	addTableHeader(pdf, "PEMERIKSAAN FISIK")
	if physicalExam.ID > 0 {
		addTableRow(pdf, "Keadaan Umum", safeString(physicalExam.GeneralCondition), 40)
		addTableRow(pdf, "Kesadaran", safeString(physicalExam.Consciousness), 40)
		if physicalExam.BloodPressure != "" {
			addTableRow(pdf, "Tekanan Darah", physicalExam.BloodPressure+" mmHg", 40)
		}
		if physicalExam.HeartRate != "" {
			addTableRow(pdf, "Nadi", physicalExam.HeartRate+" x/menit", 40)
		}
		if physicalExam.RespiratoryRate != "" {
			addTableRow(pdf, "Frekuensi Napas", physicalExam.RespiratoryRate+" x/menit", 40)
		}
		if physicalExam.Temperature != "" {
			addTableRow(pdf, "Suhu", physicalExam.Temperature+" C", 40)
		}
		if physicalExam.OxygenSaturation != "" {
			addTableRow(pdf, "SpO2", physicalExam.OxygenSaturation+" persen", 40)
		}
		if physicalExam.Weight != "" {
			addTableRow(pdf, "Berat Badan", physicalExam.Weight+" kg", 40)
		}
		if physicalExam.Height != "" {
			addTableRow(pdf, "Tinggi Badan", physicalExam.Height+" cm", 40)
		}
		// Pemeriksaan Fisik per Sistem Organ
		if physicalExam.Head != "" {
			addTableRow(pdf, "Kepala", physicalExam.Head, 40)
		}
		if physicalExam.Eyes != "" {
			addTableRow(pdf, "Mata", physicalExam.Eyes, 40)
		}
		if physicalExam.Ears != "" {
			addTableRow(pdf, "Telinga", physicalExam.Ears, 40)
		}
		if physicalExam.Nose != "" {
			addTableRow(pdf, "Hidung", physicalExam.Nose, 40)
		}
		if physicalExam.Throat != "" {
			addTableRow(pdf, "Tenggorokan", physicalExam.Throat, 40)
		}
		if physicalExam.ENT != "" {
			addTableRow(pdf, "THT", physicalExam.ENT, 40)
		}
		if physicalExam.Neck != "" {
			addTableRow(pdf, "Leher", physicalExam.Neck, 40)
		}
		if physicalExam.Chest != "" {
			addTableRow(pdf, "Dada", physicalExam.Chest, 40)
		}
		if physicalExam.Thorax != "" {
			addTableRow(pdf, "Thorax", physicalExam.Thorax, 40)
		}
		if physicalExam.Heart != "" {
			addTableRow(pdf, "Jantung", physicalExam.Heart, 40)
		}
		if physicalExam.Cardiac != "" {
			addTableRow(pdf, "Kardiak", physicalExam.Cardiac, 40)
		}
		if physicalExam.Lungs != "" {
			addTableRow(pdf, "Paru", physicalExam.Lungs, 40)
		}
		if physicalExam.Pulmonary != "" {
			addTableRow(pdf, "Pulmoner", physicalExam.Pulmonary, 40)
		}
		if physicalExam.Abdomen != "" {
			addTableRow(pdf, "Abdomen", physicalExam.Abdomen, 40)
		}
		if physicalExam.Extremities != "" {
			addTableRow(pdf, "Ekstremitas", physicalExam.Extremities, 40)
		}
		if physicalExam.Skin != "" {
			addTableRow(pdf, "Kulit", physicalExam.Skin, 40)
		}
		if physicalExam.Neurological != "" {
			addTableRow(pdf, "Neurologis", physicalExam.Neurological, 40)
		}
		if physicalExam.Musculoskel != "" {
			addTableRow(pdf, "Muskuloskeletal", physicalExam.Musculoskel, 40)
		}
		if physicalExam.Genitourinary != "" {
			addTableRow(pdf, "Genitourinari", physicalExam.Genitourinary, 40)
		}
		if physicalExam.OtherFindings != "" {
			addTableRow(pdf, "Temuan Lain", physicalExam.OtherFindings, 40)
		}
	} else {
		addTableFullRow(pdf, "Tidak ada data pemeriksaan fisik", false)
	}
	addTableEnd(pdf)

	// Final Diagnosis
	addTableHeader(pdf, "DIAGNOSIS AKHIR")
	if len(diagnoses) > 0 {
		for _, diag := range diagnoses {
			diagType := ""
			if diag.Type == "primary" {
				diagType = "[Utama] "
			}
			addTableFullRow(pdf, fmt.Sprintf("%s%s - %s", diagType, diag.ICD10Code, diag.ICD10Name), false)
		}
	} else {
		addTableFullRow(pdf, "Tidak ada diagnosis", false)
	}
	addTableEnd(pdf)

	// Discharge Status
	addTableHeader(pdf, "STATUS KELUAR")
	if disposition.ID > 0 {
		addTableRow(pdf, "Disposisi", safeString(disposition.DispositionType), 40)
		addTableRow(pdf, "Kondisi Keluar", safeString(disposition.DischargeStatus), 40)
	} else {
		addTableFullRow(pdf, "-", false)
	}
	addTableEnd(pdf)

	// Discharge Medications
	addTableHeader(pdf, "OBAT PULANG")
	hasMeds := false
	for _, order := range medicineOrders {
		if len(order.Items) > 0 {
			hasMeds = true
			break
		}
	}
	if hasMeds {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(245, 245, 245)
		pdf.SetDrawColor(180, 180, 180)
		pdf.CellFormat(10, rowHeight, "No", "1", 0, "C", true, 0, "")
		pdf.CellFormat(70, rowHeight, "Nama Obat", "1", 0, "C", true, 0, "")
		pdf.CellFormat(25, rowHeight, "Dosis", "1", 0, "C", true, 0, "")
		pdf.CellFormat(25, rowHeight, "Frekuensi", "1", 0, "C", true, 0, "")
		pdf.CellFormat(50, rowHeight, "Instruksi", "1", 1, "C", true, 0, "")

		pdf.SetFont("Arial", "", 8)
		no := 1
		for _, order := range medicineOrders {
			for _, item := range order.Items {
				checkPageBreak(pdf, rowHeight)
				medName := ""
				if item.Medicine != nil {
					medName = item.Medicine.Name
				}
				pdf.CellFormat(10, rowHeight, fmt.Sprintf("%d", no), "1", 0, "C", false, 0, "")
				pdf.CellFormat(70, rowHeight, truncateText(medName, 40), "1", 0, "", false, 0, "")
				pdf.CellFormat(25, rowHeight, item.Dosage, "1", 0, "C", false, 0, "")
				pdf.CellFormat(25, rowHeight, item.Frequency, "1", 0, "C", false, 0, "")
				pdf.CellFormat(50, rowHeight, truncateText(item.Instructions, 28), "1", 1, "", false, 0, "")
				no++
			}
		}
	} else {
		addTableFullRow(pdf, "Tidak ada obat pulang", false)
	}
	addTableEnd(pdf)

	// Discharge Instructions
	addTableHeader(pdf, "INSTRUKSI PULANG")
	if disposition.ID > 0 && disposition.DischargeInstruction != "" {
		addTableFullRow(pdf, disposition.DischargeInstruction, false)
	} else {
		addTableFullRow(pdf, "-", false)
	}
	if disposition.ID > 0 && disposition.FollowUpDate != nil {
		addTableRow(pdf, "Jadwal Kontrol", formatDateIndonesian(*disposition.FollowUpDate), 40)
	}
	addTableEnd(pdf)

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = visit.Doctor.NamaLengkap
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "Pasien/Keluarga")

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Resume_Ranap_%s_%s.pdf", patient.NoRM, visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintSickLetter generates PDF for sick letter
func PrintSickLetter(c *gin.Context) {
	visitID := c.Param("visitId")
	days := 1
	startDate := time.Now()
	var letterNumber string
	var reason string
	var purpose string
	var institution string
	var notes string

	// Check if letter_id is provided (load from saved record)
	if letterIDStr := c.Query("letter_id"); letterIDStr != "" {
		var sickLetter models.SickLetter
		if err := database.DB.
			Preload("IssuedBy").
			First(&sickLetter, letterIDStr).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Sick letter not found"})
			return
		}
		days = sickLetter.Days
		startDate = sickLetter.StartDate
		letterNumber = sickLetter.LetterNumber
		reason = sickLetter.Reason
		purpose = sickLetter.Purpose
		institution = sickLetter.Institution
		notes = sickLetter.Notes
	} else {
		// Parse query params (legacy mode)
		if c.Query("days") != "" {
			fmt.Sscanf(c.Query("days"), "%d", &days)
		}
		if c.Query("start_date") != "" {
			if t, err := time.Parse("2006-01-02", c.Query("start_date")); err == nil {
				startDate = t
			}
		}
	}

	// Load visit
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
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

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header with letter number if available
	headerSubtitle := ""
	if letterNumber != "" {
		headerSubtitle = "No: " + letterNumber
	}
	addHeader(pdf, hospitalInfo, "Surat Keterangan Sakit", headerSubtitle)

	// Body
	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 11)

	// Intro
	pdf.MultiCell(0, 6, "Yang bertanda tangan di bawah ini menerangkan bahwa:", "", "", false)
	pdf.SetY(pdf.GetY() + 5)

	// Patient details
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

	// Institution if provided
	if institution != "" {
		pdf.CellFormat(40, 6, "Instansi", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, institution, "", 1, "", false, 0, "")
	}

	pdf.SetY(pdf.GetY() + 5)

	// Statement
	endDate := startDate.AddDate(0, 0, days-1)
	dateRange := formatDateIndonesian(startDate)
	if days > 1 {
		dateRange += " s/d " + formatDateIndonesian(endDate)
	}

	pdf.SetFont("Arial", "", 11)

	// Build statement with reason if available
	var statement string
	if reason != "" {
		statement = fmt.Sprintf("Berdasarkan pemeriksaan yang dilakukan pada tanggal %s, yang bersangkutan dinyatakan sakit dengan keluhan %s dan memerlukan istirahat selama %d (%s) hari, terhitung mulai tanggal %s.",
			formatDateIndonesian(*visit.StartTime),
			reason,
			days,
			numberToWords(days),
			dateRange,
		)
	} else {
		statement = fmt.Sprintf("Berdasarkan pemeriksaan yang dilakukan pada tanggal %s, yang bersangkutan dinyatakan sakit dan memerlukan istirahat selama %d (%s) hari, terhitung mulai tanggal %s.",
			formatDateIndonesian(*visit.StartTime),
			days,
			numberToWords(days),
			dateRange,
		)
	}
	pdf.MultiCell(0, 6, statement, "", "", false)

	pdf.SetY(pdf.GetY() + 5)

	// Purpose text
	purposeText := "Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya."
	if purpose != "" {
		purposeText = "Demikian surat keterangan ini dibuat dengan sebenarnya " + purpose + "."
	}
	pdf.MultiCell(0, 6, purposeText, "", "", false)

	// Notes if provided
	if notes != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.SetFont("Arial", "I", 10)
		pdf.MultiCell(0, 5, "Catatan: "+notes, "", "", false)
		pdf.SetFont("Arial", "", 11)
	}

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = visit.Doctor.NamaLengkap
	}
	pdf.SetY(pdf.GetY() + 15)
	pdf.SetX(130)
	pdf.CellFormat(60, 5, hospitalInfo.City+", "+formatDateIndonesian(time.Now()), "", 1, "C", false, 0, "")
	pdf.SetX(130)
	pdf.CellFormat(60, 5, "Dokter Pemeriksa,", "", 1, "C", false, 0, "")
	pdf.SetY(pdf.GetY() + 20)
	pdf.SetX(130)
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(60, 5, doctorName, "", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Sakit_%s.pdf", patient.NoRM)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

func numberToWords(n int) string {
	words := []string{"", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh"}
	if n >= 1 && n <= 10 {
		return words[n]
	}
	return fmt.Sprintf("%d", n)
}

// PrintDeathCertificate generates PDF for death certificate
func PrintDeathCertificate(c *gin.Context) {
	visitID := c.Param("visitId")
	certificateIDStr := c.Query("certificate_id")

	if certificateIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "certificate_id is required"})
		return
	}

	// Load death certificate
	var certificate models.DeathCertificate
	if err := database.DB.
		Preload("IssuedBy").
		First(&certificate, certificateIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Death certificate not found"})
		return
	}

	// Verify certificate belongs to this visit
	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	if certificate.VisitID != uint(visitIDUint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Certificate does not belong to this visit"})
		return
	}

	// Load visit
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
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

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	headerSubtitle := ""
	if certificate.CertificateNumber != "" {
		headerSubtitle = "No: " + certificate.CertificateNumber
	}
	addHeader(pdf, hospitalInfo, "Surat Keterangan Kematian", headerSubtitle)

	// Body
	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 11)

	// Death type label
	deathTypeLabel := "Meninggal"
	switch certificate.DeathType {
	case "doa":
		deathTypeLabel = "DOA (Dead on Arrival)"
	case "dod":
		deathTypeLabel = "DOD (Death on Departure)"
	case "inpatient_death":
		deathTypeLabel = "Meninggal saat Rawat Inap"
	}

	// Intro
	pdf.MultiCell(0, 6, "Yang bertanda tangan di bawah ini menerangkan bahwa:", "", "", false)
	pdf.SetY(pdf.GetY() + 5)

	// Patient details
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

	// Death information
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 6, "Telah meninggal dunia dengan keterangan sebagai berikut:", "", 1, "", false, 0, "")
	pdf.SetFont("Arial", "", 11)
	pdf.SetY(pdf.GetY() + 3)

	// Death datetime
	deathDateTimeStr := "-"
	if !certificate.DeathDateTime.IsZero() {
		deathDateTimeStr = formatDateTimeIndonesian(certificate.DeathDateTime)
	}
	pdf.CellFormat(50, 6, "Waktu Kematian", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(0, 6, deathDateTimeStr, "", 1, "", false, 0, "")

	// Death location
	if certificate.DeathLocation != "" {
		pdf.CellFormat(50, 6, "Lokasi Kematian", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.DeathLocation, "", 1, "", false, 0, "")
	}

	// Death type
	pdf.CellFormat(50, 6, "Jenis Kematian", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.CellFormat(0, 6, deathTypeLabel, "", 1, "", false, 0, "")

	// Primary cause
	if certificate.PrimaryCauseCode != "" || certificate.PrimaryCauseName != "" {
		pdf.CellFormat(50, 6, "Penyebab Utama", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		causeText := certificate.PrimaryCauseName
		if certificate.PrimaryCauseCode != "" {
			causeText = certificate.PrimaryCauseCode + " - " + certificate.PrimaryCauseName
		}
		pdf.CellFormat(0, 6, truncateText(causeText, 55), "", 1, "", false, 0, "")
	}

	// Secondary cause
	if certificate.SecondaryCauseCode != "" || certificate.SecondaryCauseName != "" {
		pdf.CellFormat(50, 6, "Penyebab Sekunder", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		causeText := certificate.SecondaryCauseName
		if certificate.SecondaryCauseCode != "" {
			causeText = certificate.SecondaryCauseCode + " - " + certificate.SecondaryCauseName
		}
		pdf.CellFormat(0, 6, truncateText(causeText, 55), "", 1, "", false, 0, "")
	}

	// Manner of death
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

	// Duration of illness
	if certificate.DurationOfIllness != "" {
		pdf.CellFormat(50, 6, "Lama Sakit", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.DurationOfIllness, "", 1, "", false, 0, "")
	}

	// Declaring doctor
	if certificate.DeclaringDoctorName != "" {
		pdf.CellFormat(50, 6, "Dokter yang Menyatakan", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, certificate.DeclaringDoctorName, "", 1, "", false, 0, "")
	}

	// Witness
	if certificate.WitnessName != "" {
		witnessInfo := certificate.WitnessName
		if certificate.WitnessRelation != "" {
			witnessInfo += " (" + certificate.WitnessRelation + ")"
		}
		pdf.CellFormat(50, 6, "Saksi", "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, witnessInfo, "", 1, "", false, 0, "")
	}

	// Notes
	if certificate.Notes != "" {
		pdf.SetY(pdf.GetY() + 3)
		pdf.SetFont("Arial", "I", 10)
		pdf.MultiCell(0, 5, "Catatan: "+certificate.Notes, "", "", false)
		pdf.SetFont("Arial", "", 11)
	}

	pdf.SetY(pdf.GetY() + 5)
	pdf.MultiCell(0, 6, "Demikian surat keterangan kematian ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.", "", "", false)

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = visit.Doctor.NamaLengkap
	}
	pdf.SetY(pdf.GetY() + 15)
	pdf.SetX(130)
	pdf.CellFormat(60, 5, hospitalInfo.City+", "+formatDateIndonesian(time.Now()), "", 1, "C", false, 0, "")
	pdf.SetX(130)
	pdf.CellFormat(60, 5, "Dokter Pemeriksa,", "", 1, "C", false, 0, "")
	pdf.SetY(pdf.GetY() + 20)
	pdf.SetX(130)
	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(60, 5, doctorName, "", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Kematian_%s.pdf", patient.NoRM)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintPrescription generates PDF for prescription
func PrintPrescription(c *gin.Context) {
	orderID := c.Param("orderId")

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
		qty := fmt.Sprintf("%d", item.Quantity)
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
		doctorName = visit.Doctor.NamaLengkap
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "")

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Resep_%s.pdf", order.OrderNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintLabOrder generates PDF for lab order
func PrintLabOrder(c *gin.Context) {
	orderID := c.Param("orderId")

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
		doctorName = visit.Doctor.NamaLengkap
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "")

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Order_Lab_%s.pdf", order.OrderNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintLabResult generates PDF for lab result
func PrintLabResult(c *gin.Context) {
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
				normalRange = fmt.Sprintf("%.2f - %.2f", param.NormalMin, param.NormalMax)
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
// GET /api/print/triage/:visitId
func PrintTriageForm(c *gin.Context) {
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

	// Load Triage
	var triage models.Triage
	if err := database.DB.Preload("TriagedBy").Where("visit_id = ?", visitID).First(&triage).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data triage tidak ditemukan"})
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
	addHeader(pdf, hospitalInfo, "FORMULIR TRIAGE UGD", "")

	// Patient Info
	addPatientInfoTable(pdf, patient, &visit)

	// Triage Info Section
	addTableHeader(pdf, "A. INFORMASI KEDATANGAN")
	// Format arrival mode to proper case
	arrivalModeDisplay := strings.ReplaceAll(triage.ArrivalMode, "_", " ")
	arrivalModeDisplay = strings.Title(strings.ToLower(arrivalModeDisplay))
	addTableRow(pdf, "Cara Datang", safeString(arrivalModeDisplay), 45)
	addTableRow(pdf, "Keluhan Utama", safeString(triage.TriageComplaint), 45)
	triageLevel := triage.TriageLevel
	if triageLevel != "" {
		triageLevelText := map[string]string{
			"0": "Level 0 - DOA",
			"1": "Level 1 - Resusitasi",
			"2": "Level 2 - Emergent",
			"3": "Level 3 - Urgent",
			"4": "Level 4 - Less Urgent",
			"5": "Level 5 - Non-Urgent",
		}
		if text, ok := triageLevelText[triageLevel]; ok {
			triageLevel = text
		} else {
			triageLevel = "Level " + triageLevel
		}
	}
	addTableRow(pdf, "Level Triage", safeString(triageLevel), 45)
	addTableEnd(pdf)

	// Primary Survey (ABC)
	addTableHeader(pdf, "B. PRIMARY SURVEY (ABC)")
	// Format to proper case
	airwayDisplay := strings.Title(strings.ToLower(safeString(triage.Airway)))
	if triage.AirwayNote != "" {
		airwayDisplay += " - " + triage.AirwayNote
	}
	addTableRow(pdf, "Airway", airwayDisplay, 45)
	breathingDisplay := strings.Title(strings.ToLower(safeString(triage.Breathing)))
	if triage.BreathingNote != "" {
		breathingDisplay += " - " + triage.BreathingNote
	}
	addTableRow(pdf, "Breathing", breathingDisplay, 45)
	if triage.BreathingRate != "" {
		addTableRow(pdf, "Frekuensi Napas", triage.BreathingRate+" x/menit", 45)
	}
	circulationDisplay := strings.Title(strings.ToLower(safeString(triage.Circulation)))
	if triage.CirculationNote != "" {
		circulationDisplay += " - " + triage.CirculationNote
	}
	addTableRow(pdf, "Circulation", circulationDisplay, 45)
	if triage.Akral != "" {
		addTableRow(pdf, "Akral", triage.Akral, 45)
	}
	if triage.CRT != "" {
		addTableRow(pdf, "CRT", triage.CRT, 45)
	}
	addTableEnd(pdf)

	// Neurological - GCS only (Kesadaran & Pupil tidak ada di form)
	addTableHeader(pdf, "C. STATUS NEUROLOGIS")
	gcsTotal := triage.GCSE + triage.GCSV + triage.GCSM
	gcsStr := fmt.Sprintf("E%d V%d M%d = %d", triage.GCSE, triage.GCSV, triage.GCSM, gcsTotal)
	addTableRow(pdf, "GCS (E/V/M)", gcsStr, 45)
	addTableEnd(pdf)

	// Vital Signs
	addTableHeader(pdf, "D. TANDA VITAL")
	addTableRow(pdf, "Tekanan Darah", safeString(triage.BloodPressure)+" mmHg", 45)
	addTableRow(pdf, "Nadi", safeString(triage.HeartRate)+" x/menit", 45)
	addTableRow(pdf, "Suhu", safeString(triage.Temperature)+" C", 45)
	addTableRow(pdf, "SpO2", safeString(triage.OxygenSaturation)+" %%", 45)
	addTableRow(pdf, "Skala Nyeri", fmt.Sprintf("%d/10", triage.PainScale), 45)
	addTableEnd(pdf)

	// Assessment
	addTableHeader(pdf, "E. ASESMEN & TINDAKAN SEGERA")
	addTableMultiRow(pdf, "Asesmen Triage", safeString(triage.TriageAssessment), 45)
	addTableMultiRow(pdf, "Tindakan Segera", safeString(triage.ImmediateActions), 45)
	addTableEnd(pdf)

	// Signature
	triagerName := "-"
	if triage.TriagedBy != nil {
		triagerName = triage.TriagedBy.FullName
	}
	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 10)
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, hospitalInfo.City+", "+formatDateIndonesian(triage.CreatedAt), "", 1, "C", false, 0, "")
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, "Petugas Triage,", "", 1, "C", false, 0, "")
	pdf.SetY(pdf.GetY() + 25)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, triagerName, "B", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Triage_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintEmergencySummary prints the emergency department summary (C2)
// GET /api/print/emergency-summary/:visitId
func PrintEmergencySummary(c *gin.Context) {
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

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Load medical record components
	var triage models.Triage
	database.DB.Where("visit_id = ?", visitID).First(&triage)

	var anamnesis models.Anamnesis
	database.DB.Where("visit_id = ?", visitID).First(&anamnesis)

	var physicalExam models.PhysicalExamination
	database.DB.Where("visit_id = ?", visitID).First(&physicalExam)

	var diagnoses []models.Diagnosis
	database.DB.Where("visit_id = ?", visitID).Find(&diagnoses)

	var disposition models.Disposition
	database.DB.Where("visit_id = ?", visitID).First(&disposition)

	var medicineOrders []models.MedicineOrder
	database.DB.Preload("Items.Medicine").Where("source_visit_id = ?", visitID).Find(&medicineOrders)

	var procedureOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ?", visitID).Find(&procedureOrders)

	var visitProcedures []models.VisitProcedure
	database.DB.Preload("Procedure").Where("visit_id = ?", visitID).Find(&visitProcedures)

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "RINGKASAN PELAYANAN UGD", "")

	// Patient Info
	addPatientInfoTable(pdf, patient, &visit)

	// Triage Summary
	if triage.ID > 0 {
		addTableHeader(pdf, "A. TRIAGE")
		addTableRow(pdf, "Cara Datang", safeString(triage.ArrivalMode), 45)
		addTableRow(pdf, "Keluhan", safeString(triage.TriageComplaint), 45)
		if triage.TriageLevel != "" {
			addTableRow(pdf, "Level Triage", "Level "+triage.TriageLevel, 45)
		}
		gcsStr := fmt.Sprintf("E%d V%d M%d = %d", triage.GCSE, triage.GCSV, triage.GCSM, triage.GCSE+triage.GCSV+triage.GCSM)
		addTableRow(pdf, "GCS", gcsStr, 45)
		vitalStr := fmt.Sprintf("TD: %s, N: %s, S: %s, SpO2: %s",
			safeString(triage.BloodPressure), safeString(triage.HeartRate),
			safeString(triage.Temperature), safeString(triage.OxygenSaturation))
		addTableRow(pdf, "Tanda Vital", vitalStr, 45)
		addTableEnd(pdf)
	}

	// Anamnesis
	if anamnesis.ID > 0 {
		addTableHeader(pdf, "B. ANAMNESIS")
		addTableMultiRow(pdf, "Keluhan Utama", safeString(anamnesis.ChiefComplaint), 45)
		addTableMultiRow(pdf, "Riwayat Penyakit Sekarang", safeString(anamnesis.HistoryOfPresentIllness), 45)
		if anamnesis.PastMedicalHistory != "" {
			addTableMultiRow(pdf, "Riwayat Penyakit Dahulu", anamnesis.PastMedicalHistory, 45)
		}
		if anamnesis.Allergies != "" {
			addTableRow(pdf, "Alergi", anamnesis.Allergies, 45)
		}
		addTableEnd(pdf)
	}

	// Physical Examination
	if physicalExam.ID > 0 {
		addTableHeader(pdf, "C. PEMERIKSAAN FISIK")
		addTableRow(pdf, "Keadaan Umum", safeString(physicalExam.GeneralCondition), 45)
		addTableRow(pdf, "Kesadaran", safeString(physicalExam.Consciousness), 45)
		vitalStr := fmt.Sprintf("TD: %s, N: %s, RR: %s, S: %s, SpO2: %s",
			safeString(physicalExam.BloodPressure), safeString(physicalExam.HeartRate),
			safeString(physicalExam.RespiratoryRate), safeString(physicalExam.Temperature),
			safeString(physicalExam.OxygenSaturation))
		addTableRow(pdf, "Tanda Vital", vitalStr, 45)
		addTableEnd(pdf)
	}

	// Diagnosis
	if len(diagnoses) > 0 {
		addTableHeader(pdf, "D. DIAGNOSIS")
		for i, dx := range diagnoses {
			dxType := "Sekunder"
			if dx.Type == "primary" {
				dxType = "Primer"
			}
			dxStr := fmt.Sprintf("%d. %s - %s (%s)", i+1, dx.ICD10Code, dx.ICD10Name, dxType)
			addTableFullRow(pdf, dxStr, false)
		}
		addTableEnd(pdf)
	}

	// Procedures
	if len(visitProcedures) > 0 {
		addTableHeader(pdf, "E. TINDAKAN YANG DILAKUKAN")
		for _, vp := range visitProcedures {
			procName := "-"
			if vp.Procedure != nil {
				procName = vp.Procedure.Name
			}
			addTableFullRow(pdf, "• "+procName, false)
		}
		addTableEnd(pdf)
	}

	// Medications
	if len(medicineOrders) > 0 {
		addTableHeader(pdf, "F. TERAPI / OBAT")
		for _, mo := range medicineOrders {
			for _, item := range mo.Items {
				medName := "-"
				if item.Medicine != nil {
					medName = item.Medicine.Name
				}
				medStr := fmt.Sprintf("• %s - %s %s x %d", medName, item.Dosage, item.Frequency, item.Quantity)
				addTableFullRow(pdf, medStr, false)
			}
		}
		addTableEnd(pdf)
	}

	// Disposition
	if disposition.ID > 0 {
		addTableHeader(pdf, "G. DISPOSISI")
		dispType := disposition.DispositionType
		switch dispType {
		case "pulang":
			dispType = "Pulang"
		case "rawat_inap":
			dispType = "Rawat Inap"
		case "rujuk":
			dispType = "Rujuk"
		case "meninggal":
			dispType = "Meninggal"
		case "aps":
			dispType = "APS (Atas Permintaan Sendiri)"
		}
		addTableRow(pdf, "Keputusan", dispType, 45)
		if disposition.DischargeStatus != "" {
			addTableRow(pdf, "Status Pulang", disposition.DischargeStatus, 45)
		}
		if disposition.DischargeInstruction != "" {
			addTableMultiRow(pdf, "Instruksi", disposition.DischargeInstruction, 45)
		}
		if disposition.FollowUpDate != nil {
			addTableRow(pdf, "Kontrol Ulang", formatDateIndonesian(*disposition.FollowUpDate), 45)
		}
		if disposition.ReferralFacility != "" {
			addTableRow(pdf, "Tujuan Rujuk", disposition.ReferralFacility, 45)
		}
		addTableEnd(pdf)
	}

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = visit.Doctor.NamaLengkap
	}
	addSignature(pdf, hospitalInfo.City, doctorName, "Dokter Jaga UGD")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Ringkasan_UGD_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// ===========================================================================
// D. CETAKAN RAWAT INAP
// ===========================================================================

// PrintCPPT prints the integrated patient progress notes (D1)
// GET /api/print/cppt/:visitId
func PrintCPPT(c *gin.Context) {
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

	// Load CPPT records
	var cpptRecords []models.CPPT
	if err := database.DB.Preload("CreatedBy").Preload("VerifiedBy").
		Where("visit_id = ?", visitID).
		Order("record_date ASC").
		Find(&cpptRecords).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data CPPT"})
		return
	}

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
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.3)

	// Column widths for landscape A4 - MUST = 277mm (same as DATA PASIEN)
	colDate := 24.0
	colProf := 18.0
	colSOAP := 45.0 // 45*4 = 180
	colVital := 30.0
	colSign := 25.0
	// Total = 24+18+180+30+25 = 277

	pdf.CellFormat(colDate, 7, "Tanggal/Jam", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colProf, 7, "Profesi", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSOAP, 7, "Subjective", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSOAP, 7, "Objective", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSOAP, 7, "Assessment", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSOAP, 7, "Plan", "1", 0, "C", true, 0, "")
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
		// Calculate row height based on content - minimum 15mm for readability
		maxLines := 1
		sLines := len(pdf.SplitLines([]byte(cppt.Subjective), colSOAP-2))
		oLines := len(pdf.SplitLines([]byte(cppt.Objective), colSOAP-2))
		aLines := len(pdf.SplitLines([]byte(cppt.Assessment), colSOAP-2))
		pLines := len(pdf.SplitLines([]byte(cppt.Plan), colSOAP-2))
		for _, l := range []int{sLines, oLines, aLines, pLines} {
			if l > maxLines {
				maxLines = l
			}
		}
		rowH := float64(maxLines) * 4.5
		if rowH < 15 {
			rowH = 15
		}
		if rowH > 60 {
			rowH = 60
		}

		// Check page break
		if pdf.GetY()+rowH > 190 {
			pdf.AddPage()
			// Repeat header
			pdf.SetFont("Arial", "B", 9)
			pdf.SetFillColor(220, 220, 220)
			pdf.SetDrawColor(0, 0, 0)
			pdf.CellFormat(colDate, 7, "Tanggal/Jam", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colProf, 7, "Profesi", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSOAP, 7, "Subjective", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSOAP, 7, "Objective", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSOAP, 7, "Assessment", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSOAP, 7, "Plan", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colVital, 7, "TTV", "1", 0, "C", true, 0, "")
			pdf.CellFormat(colSign, 7, "TTD", "1", 1, "C", true, 0, "")
			pdf.SetFont("Arial", "", 9)
		}

		startY := pdf.GetY()

		// Date
		dateStr := cppt.RecordDate.Format("02/01/06 15:04")
		pdf.Rect(marginL, startY, colDate, rowH, "D")
		pdf.SetXY(marginL+1, startY+1)
		pdf.MultiCell(colDate-2, 3, dateStr, "", "L", false)

		// Profession
		x := marginL + colDate
		pdf.Rect(x, startY, colProf, rowH, "D")
		pdf.SetXY(x+1, startY+1)
		pdf.MultiCell(colProf-2, 3, truncateText(cppt.Profession, 15), "", "L", false)

		// SOAP fields
		x += colProf
		soapFields := []string{
			truncateText(cppt.Subjective, 200),
			truncateText(cppt.Objective, 200),
			truncateText(cppt.Assessment, 200),
			truncateText(cppt.Plan, 200),
		}
		for _, text := range soapFields {
			pdf.Rect(x, startY, colSOAP, rowH, "D")
			pdf.SetXY(x+1, startY+1)
			pdf.MultiCell(colSOAP-2, 3, text, "", "L", false)
			x += colSOAP
		}

		// Vital Signs - format dengan newline
		vitalStr := fmt.Sprintf("TD:%s\nN:%d x/m\nS:%s C", safeString(cppt.BloodPressure), cppt.HeartRate, safeString(cppt.Temperature))
		pdf.Rect(x, startY, colVital, rowH, "D")
		pdf.SetXY(x+1, startY+1)
		pdf.MultiCell(colVital-2, 3, vitalStr, "", "L", false)
		x += colVital

		// Signature
		signName := "-"
		if cppt.CreatedBy != nil {
			signName = truncateText(cppt.CreatedBy.FullName, 20)
		}
		if cppt.IsVerified {
			signName += "*"
		}
		pdf.Rect(x, startY, colSign, rowH, "D")
		pdf.SetXY(x+1, startY+1)
		pdf.MultiCell(colSign-2, 3, signName, "", "L", false)

		pdf.SetY(startY + rowH)
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("CPPT_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintNursingCare prints the nursing care documentation (D2)
// GET /api/print/nursing-care/:visitId
func PrintNursingCare(c *gin.Context) {
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

	// Load Nursing Care records
	var nursingCares []models.NursingCare
	if err := database.DB.Preload("CreatedBy").
		Where("visit_id = ?", visitID).
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

		// Signature
		nurseName := "-"
		if nc.CreatedBy != nil {
			nurseName = nc.CreatedBy.FullName
		}
		doctorName := "-"
		if visit.Doctor != nil {
			doctorName = visit.Doctor.NamaLengkap
		}
		pdf.SetY(pdf.GetY() + 5)
		pdf.SetFont("Arial", "", 10)

		// Two signature columns
		signWidth := 70.0
		leftX := marginLeft
		rightX := marginLeft + contentWidth - signWidth
		startY := pdf.GetY()

		// Doctor column (left)
		pdf.SetXY(leftX, startY)
		pdf.CellFormat(signWidth, 6, hospitalInfo.City+", "+formatDateIndonesian(nc.RecordDate), "", 1, "C", false, 0, "")
		pdf.SetX(leftX)
		pdf.CellFormat(signWidth, 6, "Dokter Penanggung Jawab,", "", 1, "C", false, 0, "")
		pdf.SetY(pdf.GetY() + 20)
		pdf.SetFont("Arial", "B", 10)
		pdf.SetX(leftX)
		pdf.CellFormat(signWidth, 6, doctorName, "B", 1, "C", false, 0, "")

		// Nurse column (right)
		pdf.SetFont("Arial", "", 10)
		pdf.SetXY(rightX, startY)
		pdf.CellFormat(signWidth, 6, hospitalInfo.City+", "+formatDateIndonesian(nc.RecordDate), "", 1, "C", false, 0, "")
		pdf.SetX(rightX)
		pdf.CellFormat(signWidth, 6, "Perawat,", "", 1, "C", false, 0, "")
		pdf.SetY(startY + 26)
		pdf.SetFont("Arial", "B", 10)
		pdf.SetX(rightX)
		pdf.CellFormat(signWidth, 6, nurseName, "B", 1, "C", false, 0, "")
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Asuhan_Keperawatan_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintFluidBalance prints the fluid balance sheet (D3)
// GET /api/print/fluid-balance/:visitId
func PrintFluidBalance(c *gin.Context) {
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

	// Load Fluid Balance records
	var fluidBalances []models.FluidBalance
	if err := database.DB.Preload("CreatedBy").
		Where("visit_id = ?", visitID).
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
	pdf.SetDrawColor(0, 0, 0)
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

	// Doctor Signature at bottom
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = visit.Doctor.NamaLengkap
	}
	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 10)
	pdf.SetX(277 - 70) // Right side for landscape
	pdf.CellFormat(70, 6, hospitalInfo.City+", "+formatDateIndonesian(fluidBalances[len(fluidBalances)-1].RecordDate), "", 1, "C", false, 0, "")
	pdf.SetX(277 - 70)
	pdf.CellFormat(70, 6, "Dokter Penanggung Jawab,", "", 1, "C", false, 0, "")
	pdf.SetY(pdf.GetY() + 15)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(277 - 70)
	pdf.CellFormat(70, 6, doctorName, "B", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Balance_Cairan_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintBedTransfer prints the patient transfer/mutation sheet (D4)
// GET /api/print/bed-transfer/:visitId
func PrintBedTransfer(c *gin.Context) {
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

	// Load Bed Transfer records
	var transfers []models.BedTransfer
	if err := database.DB.
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

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Mutasi_Pasien_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintVitalSignChart prints the vital sign observation chart (D5)
// Data sourced from CPPT records which contain vital sign measurements
// GET /api/print/vital-sign-chart/:visitId
func PrintVitalSignChart(c *gin.Context) {
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

	// Load CPPT records that have vital sign data
	var cppts []models.CPPT
	if err := database.DB.Preload("CreatedBy").
		Where("visit_id = ?", visitID).
		Where("(blood_pressure != '' AND blood_pressure IS NOT NULL) OR heart_rate > 0 OR respiratory_rate > 0 OR (temperature != '' AND temperature IS NOT NULL) OR oxygen_saturation > 0 OR pain_scale > 0").
		Order("record_date ASC").
		Find(&cppts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data tanda vital dari CPPT"})
		return
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

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Vital_Sign_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// GetAvailableDocs returns which document types have data for a given visit
// GET /api/print/available-docs/:visitId
func GetAvailableDocs(c *gin.Context) {
	visitID := c.Param("visitId")

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	docs := []string{}

	// Resume - always available
	docs = append(docs, "resume")

	// Triage (UGD)
	var triageCount int64
	database.DB.Model(&models.Triage{}).Where("visit_id = ?", visitID).Count(&triageCount)
	if triageCount > 0 {
		docs = append(docs, "triage")
		docs = append(docs, "emergency_summary")
	}

	// CPPT
	var cpptCount int64
	database.DB.Model(&models.CPPT{}).Where("visit_id = ?", visitID).Count(&cpptCount)
	if cpptCount > 0 {
		docs = append(docs, "cppt")
	}

	// Nursing Care
	var nursingCount int64
	database.DB.Model(&models.NursingCare{}).Where("visit_id = ?", visitID).Count(&nursingCount)
	if nursingCount > 0 {
		docs = append(docs, "nursing_care")
	}

	// Fluid Balance
	var fluidCount int64
	database.DB.Model(&models.FluidBalance{}).Where("visit_id = ?", visitID).Count(&fluidCount)
	if fluidCount > 0 {
		docs = append(docs, "fluid_balance")
	}

	// Bed Transfer
	var transferCount int64
	database.DB.Model(&models.BedTransfer{}).Where("visit_id = ?", visitID).Count(&transferCount)
	if transferCount > 0 {
		docs = append(docs, "bed_transfer")
	}

	// Vital Sign Chart (from CPPT with vital signs)
	var vitalCount int64
	database.DB.Model(&models.CPPT{}).
		Where("visit_id = ?", visitID).
		Where("(blood_pressure != '' AND blood_pressure IS NOT NULL) OR heart_rate > 0 OR respiratory_rate > 0 OR (temperature != '' AND temperature IS NOT NULL) OR oxygen_saturation > 0 OR pain_scale > 0").
		Count(&vitalCount)
	if vitalCount > 0 {
		docs = append(docs, "vital_sign_chart")
	}

	// Referral Letter (disposition type = rujuk)
	var referralCount int64
	database.DB.Model(&models.Disposition{}).Where("visit_id = ? AND disposition_type = ?", visitID, "rujuk").Count(&referralCount)
	if referralCount > 0 {
		docs = append(docs, "referral_letter")
	}

	// Inpatient Certificate (has admission_time)
	if visit.AdmissionTime != nil {
		docs = append(docs, "inpatient_certificate")
	}

	c.JSON(http.StatusOK, gin.H{"available_docs": docs})
}

// PrintReferralLetter prints referral letter (Surat Rujukan)
// GET /api/print/referral-letter/:visitId
func PrintReferralLetter(c *gin.Context) {
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

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Load disposition with referral data
	var disposition models.Disposition
	if err := database.DB.Where("visit_id = ? AND disposition_type = ?", visitID, "rujuk").First(&disposition).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data rujukan tidak ditemukan. Pastikan disposisi pasien adalah 'Rujuk'."})
		return
	}

	// Load diagnoses
	var diagnoses []models.Diagnosis
	database.DB.Where("visit_id = ?", visitID).Find(&diagnoses)

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
		doctorName = visit.Doctor.NamaLengkap
	}
	pdf.SetY(pdf.GetY() + 10)
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, hospitalInfo.City+", "+formatDateIndonesian(time.Now()), "", 1, "C", false, 0, "")
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, "Dokter yang merujuk,", "", 1, "C", false, 0, "")
	pdf.SetY(pdf.GetY() + 25)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, doctorName, "B", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Rujukan_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintInpatientCertificate prints inpatient certificate (Surat Keterangan Rawat Inap)
// GET /api/print/inpatient-certificate/:visitId
func PrintInpatientCertificate(c *gin.Context) {
	visitID := c.Param("visitId")

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
	database.DB.Where("visit_id = ? AND type = ?", visitID, "primary").First(&diagnosis)

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
		doctorName = visit.Doctor.NamaLengkap
	}
	addTableRow(pdf, "Dokter Penanggung Jawab", doctorName, 45)
	addTableEnd(pdf)

	// Closing
	pdf.Ln(5)
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(contentWidth, 6, "Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.", "", "L", false)

	// Signature
	pdf.SetY(pdf.GetY() + 10)
	pdf.SetFont("Arial", "", 10)
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, hospitalInfo.City+", "+formatDateIndonesian(time.Now()), "", 1, "C", false, 0, "")
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, "Dokter yang merawat,", "", 1, "C", false, 0, "")
	pdf.SetY(pdf.GetY() + 25)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(marginLeft + contentWidth - 70)
	pdf.CellFormat(70, 6, doctorName, "B", 1, "C", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Surat_Keterangan_Rawat_Inap_%s.pdf", visit.VisitNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// ===========================================================================
// E7. TIKET ANTRIAN RUANGAN (100mm Thermal)
// ===========================================================================

// PrintQueueTicket generates a thermal queue ticket (100mm x 80mm)
func PrintQueueTicket(c *gin.Context) {
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

// PrintRegistrationTicket generates a queue ticket based on registration ID
func PrintRegistrationTicket(c *gin.Context) {
	registrationID := c.Param("registrationId")

	// Load registration with relations
	var registration models.Registration
	if err := database.DB.
		Preload("Patient").
		Preload("Queue").
		Preload("DestinationRoom").
		Preload("Doctor").
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

	// Queue Number
	queueNumber := "-"
	if registration.Queue != nil && registration.Queue.QueueNumber != "" {
		queueNumber = registration.Queue.QueueNumber
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

// PrintMedicineLabel generates a thermal medicine label (100mm x 40mm)
func PrintMedicineLabel(c *gin.Context) {
	itemID := c.Param("itemId")

	var item models.MedicineOrderItem
	if err := database.DB.
		Preload("Medicine").
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
	pdf := generateMedicineLabelPDF([]models.MedicineOrderItem{item}, patientName, noRM)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	medicineName := "Obat"
	if item.Medicine != nil {
		medicineName = item.Medicine.Name
	}
	filename := fmt.Sprintf("Etiket_%s.pdf", strings.ReplaceAll(medicineName, " ", "_"))
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintMedicineLabels generates thermal medicine labels for all items in an order (100mm x 40mm each)
func PrintMedicineLabels(c *gin.Context) {
	orderID := c.Param("orderId")

	var order models.MedicineOrder
	if err := database.DB.
		Preload("Items.Medicine").
		Preload("Registration.Patient").
		First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	if len(order.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No items in order"})
		return
	}

	// Get patient info from order
	patientName := "-"
	noRM := "-"
	if order.Registration != nil && order.Registration.Patient != nil {
		patientName = order.Registration.Patient.NamaLengkap
		noRM = order.Registration.Patient.NoRM
	}

	// Generate labels for all items
	pdf := generateMedicineLabelPDF(order.Items, patientName, noRM)

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

// generateMedicineLabelPDF creates a PDF with medicine labels (each item on separate page)
func generateMedicineLabelPDF(items []models.MedicineOrderItem, patientName, noRM string) *gofpdf.Fpdf {
	// Get hospital info for header
	hospitalInfo := getHospitalInfo()

	// Create custom size PDF (100mm x 60mm per page)
	pageWidth := 100.0
	pageHeight := 60.0

	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr: "mm",
		Size:    gofpdf.SizeType{Wd: pageWidth, Ht: pageHeight},
	})
	pdf.SetMargins(3, 3, 3)
	pdf.SetAutoPageBreak(false, 0)

	contentWidth := 94.0
	marginL := 3.0

	for _, item := range items {
		// Skip cancelled items
		if item.Status == models.ItemStatusCancelled {
			continue
		}
		// Add new page for each medicine
		pdf.AddPage()

		// Border box
		pdf.SetDrawColor(0, 0, 0)
		pdf.SetLineWidth(0.3)
		pdf.Rect(marginL, 3, contentWidth, pageHeight-6, "D")

		// === KOP HEADER (same style as queue ticket) ===
		headerStartY := 4.0

		// Logo - di sebelah kiri
		logoWidth := 10.0
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
					pdf.Image(logoPath, marginL+1, headerStartY, logoWidth, logoWidth, false, imgType, 0, "")
				}
			}
		}

		// Hospital name - setelah logo, use MultiCell for wrapping
		textStartX := marginL + 1 + logoWidth + 2
		textWidth := contentWidth - logoWidth - 4
		pdf.SetFont("Arial", "B", 7)
		pdf.SetXY(textStartX, headerStartY)
		pdf.MultiCell(textWidth, 3, hospitalInfo.Name, "", "C", false)

		// Address
		pdf.SetFont("Arial", "", 5)
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

		// Double line after header
		lineY := headerStartY + logoWidth + 1
		pdf.SetDrawColor(0, 0, 0)
		pdf.SetLineWidth(0.4)
		pdf.Line(marginL+1, lineY, marginL+contentWidth-1, lineY)
		pdf.SetLineWidth(0.15)
		pdf.Line(marginL+1, lineY+0.5, marginL+contentWidth-1, lineY+0.5)

		// === PATIENT INFO ===
		// Row 1: Patient name | No. RM
		pdf.SetY(lineY + 2)
		pdf.SetX(marginL + 4)
		pdf.SetFont("Arial", "B", 9)
		pdf.CellFormat(55, 4, truncateString(patientName, 25), "", 0, "L", false, 0, "")
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(33, 4, noRM, "", 1, "R", false, 0, "")

		// Divider line
		pdf.SetDrawColor(100, 100, 100)
		pdf.Line(marginL+1, pdf.GetY()+0.5, marginL+contentWidth-1, pdf.GetY()+0.5)

		// Row 2: Medicine name (large)
		pdf.SetY(pdf.GetY() + 1.5)
		pdf.SetX(marginL + 4)
		medicineName := "-"
		if item.Medicine != nil {
			medicineName = strings.ToUpper(item.Medicine.Name)
		}
		pdf.SetFont("Arial", "B", 12)
		pdf.CellFormat(contentWidth-8, 6, truncateString(medicineName, 32), "", 1, "L", false, 0, "")

		// Divider line
		pdf.SetDrawColor(100, 100, 100)
		pdf.Line(marginL+1, pdf.GetY(), marginL+contentWidth-1, pdf.GetY())

		// Row 3: Dosage and instructions
		pdf.SetY(pdf.GetY() + 1)
		pdf.SetX(marginL + 4)
		dosageInfo := ""
		if item.Dosage != "" {
			dosageInfo = item.Dosage
		}
		if item.Unit != "" {
			dosageInfo += " " + item.Unit
		}
		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(contentWidth-8, 5, dosageInfo, "", 1, "L", false, 0, "")

		// Instructions
		pdf.SetX(marginL + 4)
		instructions := item.Instructions
		if instructions == "" {
			// Format default based on route
			if item.Route != "" {
				routeMap := map[string]string{
					"oral":          "Diminum",
					"topikal":       "Dioleskan",
					"injeksi":       "Disuntikkan",
					"sublingual":    "Di bawah lidah",
					"inhalasi":      "Dihirup",
					"rektal":        "Lewat dubur",
					"tetes_mata":    "Diteteskan ke mata",
					"tetes_telinga": "Diteteskan ke telinga",
				}
				if r, ok := routeMap[item.Route]; ok {
					instructions = r
				}
			}
		}
		// Check for special instructions
		if strings.Contains(strings.ToLower(instructions), "sebelum makan") || strings.Contains(strings.ToLower(item.Route), "ac") {
			pdf.SetFont("Arial", "B", 9)
			pdf.SetTextColor(200, 0, 0)
			pdf.CellFormat(contentWidth-8, 4, "SEBELUM MAKAN", "", 1, "L", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
		} else if instructions != "" {
			pdf.SetFont("Arial", "", 9)
			pdf.CellFormat(contentWidth-8, 4, truncateString(instructions, 42), "", 1, "L", false, 0, "")
		}

		// Divider line
		pdf.SetDrawColor(100, 100, 100)
		pdf.Line(marginL+1, pdf.GetY()+0.5, marginL+contentWidth-1, pdf.GetY()+0.5)

		// Row 4: Date | Quantity
		pdf.SetY(pdf.GetY() + 1.5)
		pdf.SetX(marginL + 4)
		pdf.SetFont("Arial", "", 8)
		pdf.CellFormat(45, 4, formatDateIndonesian(time.Now()), "", 0, "L", false, 0, "")
		qtyInfo := fmt.Sprintf("%d %s", item.Quantity, item.Unit)
		pdf.SetFont("Arial", "B", 9)
		pdf.CellFormat(43, 4, qtyInfo, "", 1, "R", false, 0, "")
	}

	return pdf
}

// truncateString truncates a string to max length with ellipsis
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// ===========================================================================
// F3. RESEP OBAT THERMAL (100mm width)
// ===========================================================================

// PrintPrescriptionThermal generates a thermal prescription (100mm width) for patient
func PrintPrescriptionThermal(c *gin.Context) {
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
		doctorName = order.SourceVisit.Doctor.NamaLengkap
	} else if order.Prescriber != nil {
		doctorName = order.Prescriber.NamaLengkap
	}

	// Get pharmacist/petugas info - prefer DeliveredBy, then ReviewedBy
	pharmacistName := ""
	if order.DeliveredBy != nil {
		pharmacistName = order.DeliveredBy.NamaLengkap
	} else if order.ReviewedBy != nil {
		pharmacistName = order.ReviewedBy.NamaLengkap
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
	pdf.SetDrawColor(0, 0, 0)
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
	pdf.SetDrawColor(0, 0, 0)
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
		qtyInfo := fmt.Sprintf("Jumlah: %d %s", item.Quantity, item.Unit)
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
	pdf.SetDrawColor(0, 0, 0)
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
func PrintLaboratoryResult(c *gin.Context) {
	id := c.Param("id")

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
					refRange = fmt.Sprintf("%.2f - %.2f", result.ProcedureParameter.NormalMin, result.ProcedureParameter.NormalMax)
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
			pdf.CellFormat(35, 6, result.Value, "1", 0, "C", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
			pdf.CellFormat(20, 6, unit, "1", 0, "C", false, 0, "")
			pdf.CellFormat(45, 6, refRange, "1", 0, "C", false, 0, "")

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

		// Signature section
		pdf.Ln(10)
		signY := pdf.GetY()

		// Examination date
		pdf.SetFont("Arial", "", 9)
		examDate := formatDateIndonesian(order.CreatedAt)
		if item.CompletedAt != nil {
			examDate = formatDateIndonesian(*item.CompletedAt)
		}
		pdf.CellFormat(0, 5, fmt.Sprintf("Tanggal Pemeriksaan: %s", examDate), "", 1, "L", false, 0, "")
		pdf.Ln(2)

		// Petugas
		pdf.SetXY(marginLeft+120, signY+5)
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(60, 5, "Petugas Pemeriksa,", "", 1, "C", false, 0, "")

		pdf.SetXY(marginLeft+120, signY+25)
		performedByName := ""
		if item.PerformedBy != nil {
			performedByName = item.PerformedBy.NamaLengkap
		}
		pdf.SetFont("Arial", "BU", 9)
		pdf.CellFormat(60, 5, performedByName, "", 1, "C", false, 0, "")

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
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintLaboratoryResultItem prints a single laboratory result item
func PrintLaboratoryResultItem(c *gin.Context) {
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
				refRange = fmt.Sprintf("%.2f - %.2f", result.ProcedureParameter.NormalMin, result.ProcedureParameter.NormalMax)
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
		pdf.CellFormat(35, 6, result.Value, "1", 0, "C", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
		pdf.CellFormat(20, 6, unit, "1", 0, "C", false, 0, "")
		pdf.CellFormat(45, 6, refRange, "1", 0, "C", false, 0, "")

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

	// Signature section
	pdf.Ln(10)
	signY := pdf.GetY()

	// Examination date
	pdf.SetFont("Arial", "", 9)
	examDate := formatDateIndonesian(order.CreatedAt)
	if item.CompletedAt != nil {
		examDate = formatDateIndonesian(*item.CompletedAt)
	}
	pdf.CellFormat(0, 5, fmt.Sprintf("Tanggal Pemeriksaan: %s", examDate), "", 1, "L", false, 0, "")
	pdf.Ln(2)

	// Petugas
	pdf.SetXY(marginLeft+120, signY+5)
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(60, 5, "Petugas Pemeriksa,", "", 1, "C", false, 0, "")

	pdf.SetXY(marginLeft+120, signY+25)
	performedByName := ""
	if item.PerformedBy != nil {
		performedByName = item.PerformedBy.NamaLengkap
	}
	pdf.SetFont("Arial", "BU", 9)
	pdf.CellFormat(60, 5, performedByName, "", 1, "C", false, 0, "")

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
func PrintRadiologyResult(c *gin.Context) {
	id := c.Param("id")

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

		// Signature section
		pdf.Ln(10)
		signY := pdf.GetY()

		// Examination date
		pdf.SetFont("Arial", "", 9)
		examDate := formatDateIndonesian(order.CreatedAt)
		if item.CompletedAt != nil {
			examDate = formatDateIndonesian(*item.CompletedAt)
		}
		pdf.CellFormat(0, 5, fmt.Sprintf("Tanggal Pemeriksaan: %s", examDate), "", 1, "L", false, 0, "")
		pdf.Ln(2)

		// Petugas
		pdf.SetXY(marginLeft+120, signY+5)
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(60, 5, "Petugas Pemeriksa,", "", 1, "C", false, 0, "")

		pdf.SetXY(marginLeft+120, signY+25)
		performedByName := ""
		if item.PerformedBy != nil {
			performedByName = item.PerformedBy.NamaLengkap
		}
		pdf.SetFont("Arial", "BU", 9)
		pdf.CellFormat(60, 5, performedByName, "", 1, "C", false, 0, "")

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
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintRadiologyResultItem prints a single radiology result item
func PrintRadiologyResultItem(c *gin.Context) {
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

	// Signature section
	pdf.Ln(10)
	signY := pdf.GetY()

	// Examination date
	pdf.SetFont("Arial", "", 9)
	examDate := formatDateIndonesian(order.CreatedAt)
	if item.CompletedAt != nil {
		examDate = formatDateIndonesian(*item.CompletedAt)
	}
	pdf.CellFormat(0, 5, fmt.Sprintf("Tanggal Pemeriksaan: %s", examDate), "", 1, "L", false, 0, "")
	pdf.Ln(2)

	// Petugas
	pdf.SetXY(marginLeft+120, signY+5)
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(60, 5, "Petugas Pemeriksa,", "", 1, "C", false, 0, "")

	pdf.SetXY(marginLeft+120, signY+25)
	performedByName := ""
	if item.PerformedBy != nil {
		performedByName = item.PerformedBy.NamaLengkap
	}
	pdf.SetFont("Arial", "BU", 9)
	pdf.CellFormat(60, 5, performedByName, "", 1, "C", false, 0, "")

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
func PrintBilling(c *gin.Context) {
	billingID := c.Param("billingId")

	// Load billing with all relations
	var billing models.Billing
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Room").
		Preload("Visit.Doctor").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("Items").
		Preload("Payments").
		Preload("Payments.Cashier").
		Preload("GeneratedBy").
		Preload("FinalizedBy").
		First(&billing, billingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Billing not found"})
		return
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
	addHeader(pdf, hospitalInfo, "KWITANSI / INVOICE", "No: "+billing.BillingNumber)

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

	// Group items by type
	itemTypes := []string{"registration", "procedure", "radiology", "laboratory", "medicine", "room", "other"}
	itemTypeLabels := map[string]string{
		"registration": "Pendaftaran",
		"procedure":    "Tindakan",
		"radiology":    "Radiologi",
		"laboratory":   "Laboratorium",
		"medicine":     "Obat",
		"room":         "Kamar",
		"other":        "Lain-lain",
	}

	// Table Body
	pdf.SetFont("Arial", "", 9)
	no := 1
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
		pdf.CellFormat(180, 6, itemTypeLabels[itemType], "1", 1, "L", true, 0, "")
		pdf.SetFont("Arial", "", 9)

		for _, item := range typeItems {
			pdf.CellFormat(10, 6, fmt.Sprintf("%d", no), "1", 0, "C", false, 0, "")

			// Handle long description with MultiCell
			desc := truncateText(item.Description, 50)
			pdf.CellFormat(80, 6, desc, "1", 0, "L", false, 0, "")

			pdf.CellFormat(15, 6, fmt.Sprintf("%d", item.Quantity), "1", 0, "C", false, 0, "")
			pdf.CellFormat(35, 6, formatCurrency(item.UnitPrice), "1", 0, "R", false, 0, "")
			pdf.CellFormat(40, 6, formatCurrency(item.Subtotal), "1", 1, "R", false, 0, "")
			no++
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
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// formatCurrency formats number to Indonesian currency format
func formatCurrency(amount float64) string {
	// Simple formatting: Rp 1.000.000
	return fmt.Sprintf("Rp %s", formatNumber(amount))
}

// formatNumber formats number with thousand separator
func formatNumber(num float64) string {
	// Convert to int for display (no decimals for IDR)
	intNum := int64(num)
	if intNum < 0 {
		return "-" + formatNumber(-num)
	}

	str := fmt.Sprintf("%d", intNum)
	n := len(str)
	if n <= 3 {
		return str
	}

	// Add thousand separators
	var result []byte
	for i, c := range str {
		if i > 0 && (n-i)%3 == 0 {
			result = append(result, '.')
		}
		result = append(result, byte(c))
	}
	return string(result)
}

// PrintInformedConsent generates PDF for General Consent / Persetujuan Umum
func PrintInformedConsent(c *gin.Context) {
	patientID, err := strconv.Atoi(c.Param("patientId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
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

	// Two column signatures
	sigWidth := 80.0
	gap := contentWidth - sigWidth*2
	startY := pdf.GetY()

	// Left: Pasien/Wali
	pdf.SetXY(marginLeft, startY)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(sigWidth, lineH, "Yang Menyatakan,", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.SetX(marginLeft)
	pdf.CellFormat(sigWidth, lineH, "Pasien / Wali *)", "", 1, "C", false, 0, "")

	// Signature space
	pdf.SetY(startY + 35)
	pdf.SetX(marginLeft)
	pdf.SetFont("Arial", "B", 9)
	patientName := patient.NamaLengkap
	if patientName == "" {
		patientName = "(...................................)"
	}
	pdf.CellFormat(sigWidth, lineH, patientName, "T", 1, "C", false, 0, "")

	// Right: Petugas RS
	pdf.SetXY(marginLeft+sigWidth+gap, startY)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(sigWidth, lineH, "Petugas Rumah Sakit,", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.SetXY(marginLeft+sigWidth+gap, startY+lineH)
	pdf.CellFormat(sigWidth, lineH, "", "", 1, "C", false, 0, "")

	// Signature space
	pdf.SetXY(marginLeft+sigWidth+gap, startY+35)
	pdf.SetFont("Arial", "B", 9)
	staffLabel := "(...................................)"
	if staffName != "" {
		staffLabel = staffName
	}
	pdf.CellFormat(sigWidth, lineH, staffLabel, "T", 1, "C", false, 0, "")

	// Footer note
	pdf.SetY(pdf.GetY() + 5)
	pdf.SetFont("Arial", "I", 7)
	pdf.CellFormat(contentWidth, 3, "*) Coret yang tidak perlu. Wali menandatangani apabila pasien tidak mampu/belum cukup umur.", "", 1, "L", false, 0, "")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Informed_Consent_%s.pdf", patient.NoRM)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintAdmissionDischargeSummary generates MR.1 - Ringkasan Masuk dan Keluar Pasien
// Uses registrationId to track the full patient journey across all visits
func PrintAdmissionDischargeSummary(c *gin.Context) {
	registrationID := c.Param("registrationId")

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
	database.DB.Where("source_visit_id IN ? AND prescription_type = ?", visitIDs, "discharge").
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
				vDoctor = v.Doctor.NamaLengkap
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
		database.DB.Where("visit_id = ?", mv.ID).First(&mvAnamnesis)

		var mvPhysicalExam models.PhysicalExamination
		database.DB.Where("visit_id = ?", mv.ID).First(&mvPhysicalExam)

		var mvDiagnoses []models.Diagnosis
		database.DB.Where("visit_id = ?", mv.ID).Order("type ASC, created_at ASC").Find(&mvDiagnoses)

		var mvDisposition models.Disposition
		database.DB.Where("visit_id = ?", mv.ID).First(&mvDisposition)

		var mvVisitProcedures []models.VisitProcedure
		database.DB.Where("visit_id = ?", mv.ID).Preload("Procedure").Find(&mvVisitProcedures)

		var mvProcedureOrders []models.ProcedureOrder
		database.DB.Where("source_visit_id = ?", mv.ID).Find(&mvProcedureOrders)

		var mvMedicineOrders []models.MedicineOrder
		database.DB.Where("source_visit_id = ? AND (prescription_type IS NULL OR prescription_type != ?)", mv.ID, "discharge").
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
			mvDoctor = mv.Doctor.NamaLengkap
			lastMainDoctor = mvDoctor
		} else if registration.Doctor != nil {
			mvDoctor = registration.Doctor.NamaLengkap
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
		database.DB.Where("visit_id = ?", mainVisits[i].ID).First(&finalDisposition)
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
	addSignature(pdf, hospitalInfo.City, lastMainDoctor, "Pasien/Keluarga")

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("MR1_Ringkasan_Masuk_Keluar_%s_%s.pdf", patient.NoRM, registration.RegistrationNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintRegistrationReceipt generates Bukti Registrasi / Tanda Pendaftaran
func PrintRegistrationReceipt(c *gin.Context) {
	registrationID := c.Param("registrationId")

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
		doctorName = registration.Doctor.NamaLengkap
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
	signY := pdf.GetY()
	signColWidth := contentWidth / 2

	pdf.SetFont("Arial", "", 9)
	pdf.SetXY(marginLeft, signY)
	pdf.CellFormat(signColWidth, 5, hospitalInfo.City+", "+formatDateIndonesian(registration.CreatedAt), "", 1, "C", false, 0, "")

	// Left: Petugas Pendaftaran
	pdf.SetXY(marginLeft, signY+5)
	pdf.CellFormat(signColWidth, 5, "Petugas Pendaftaran", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft, signY+30)
	pdf.CellFormat(signColWidth, 5, "( "+registeredBy+" )", "", 1, "C", false, 0, "")

	// Right: Pasien/Keluarga Pasien
	pdf.SetXY(marginLeft+signColWidth, signY+5)
	pdf.CellFormat(signColWidth, 5, "Pasien / Keluarga Pasien", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft+signColWidth, signY+30)
	pdf.CellFormat(signColWidth, 5, "( "+patient.NamaLengkap+" )", "", 1, "C", false, 0, "")

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

	// Footer note
	pdf.SetY(signY + 38)
	pdf.SetFont("Arial", "I", 7)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(contentWidth, 4, "* Dokumen ini merupakan bukti pendaftaran yang sah. Harap dibawa saat kunjungan.", "", 1, "C", false, 0, "")
	pdf.CellFormat(contentWidth, 4, "* Dicetak secara otomatis oleh sistem SIMRS.", "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Bukti_Registrasi_%s_%s.pdf", patient.NoRM, registration.RegistrationNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintDPJPRequest generates PDF for Formulir Permohonan DPJP (Dokter Penanggung Jawab Pasien)
func PrintDPJPRequest(c *gin.Context) {
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
		dpjpName = visit.Doctor.NamaLengkap
	} else if registration.Doctor != nil {
		dpjpName = registration.Doctor.NamaLengkap
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
	pdf.SetDrawColor(0, 0, 0)
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

	pdf.SetFont("Arial", "", 9)
	dateStr := hospitalInfo.City + ", " + formatDateIndonesian(time.Now())
	pdf.CellFormat(contentWidth, 5, dateStr, "", 1, "C", false, 0, "")

	pdf.SetY(pdf.GetY() + 2)
	signY = pdf.GetY()

	// Col 1: Pasien / Keluarga
	pdf.SetXY(marginLeft, signY)
	pdf.CellFormat(signColWidth, 5, "Pasien / Keluarga Pasien", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft, signY+28)
	pdf.CellFormat(signColWidth, 5, "( "+truncateText(patient.NamaLengkap, 22)+" )", "", 1, "C", false, 0, "")

	// Col 2: Perawat
	pdf.SetXY(marginLeft+signColWidth, signY)
	pdf.CellFormat(signColWidth, 5, "Perawat / Petugas", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft+signColWidth, signY+28)
	pdf.CellFormat(signColWidth, 5, "( ................................ )", "", 1, "C", false, 0, "")

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
	pdf.SetDrawColor(0, 0, 0)

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
func PrintInformedConsentReceipt(c *gin.Context) {
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
		dpjpName = visit.Doctor.NamaLengkap
	} else if registration.Doctor != nil {
		dpjpName = registration.Doctor.NamaLengkap
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
	database.DB.Where("visit_id = ?", visit.ID).Order("type ASC, id ASC").Find(&diagnoses)

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

	pdf.SetFont("Arial", "", 9)
	dateStr := hospitalInfo.City + ", " + formatDateIndonesian(time.Now())
	pdf.CellFormat(contentWidth, 5, dateStr, "", 1, "C", false, 0, "")

	pdf.SetY(pdf.GetY() + 2)
	signY = pdf.GetY()

	// Col 1: Pasien / Keluarga
	pdf.SetXY(marginLeft, signY)
	pdf.CellFormat(signColWidth, 5, "Pasien / Keluarga Pasien", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft, signY+28)
	pdf.CellFormat(signColWidth, 5, "( "+truncateText(patient.NamaLengkap, 22)+" )", "", 1, "C", false, 0, "")

	// Col 2: Saksi
	pdf.SetXY(marginLeft+signColWidth, signY)
	pdf.CellFormat(signColWidth, 5, "Saksi", "", 1, "C", false, 0, "")
	pdf.SetXY(marginLeft+signColWidth, signY+28)
	pdf.CellFormat(signColWidth, 5, "( ................................ )", "", 1, "C", false, 0, "")

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
func PrintSEP(c *gin.Context) {
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
		if t, err := time.Parse("2006-01-02", tglSEP); err == nil {
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
		if t, err := time.Parse("2006-01-02", tglLahir); err == nil {
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
