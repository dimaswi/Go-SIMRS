package handlers

import (
	"fmt"
	"github.com/jung-kurt/gofpdf"
	"os"
	"path/filepath"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
)

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
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
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
			doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
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
			doctorName = resolveAssignedUserNameFromEmployee(order.OrderedBy, doctorName)
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
	signatureHeight = 55.0                                 // Space needed for signature area (increased for QR)
	footerHeight    = 20.0                                 // Space used by digital signature footer block
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

// addHighlightedTableRow adds a bold, lightly shaded row for important summary signals.
func addHighlightedTableRow(pdf *gofpdf.Fpdf, label, value string, labelWidth float64, fillR, fillG, fillB, textR, textG, textB int) {
	pdf.SetFont("Arial", "B", 9)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.2)

	valueWidth := contentWidth - labelWidth
	maxTextWidth := valueWidth - 2
	if maxTextWidth < 10 {
		maxTextWidth = valueWidth
	}

	lines := pdf.SplitLines([]byte(safeString(value)), maxTextWidth)
	lineCount := len(lines)
	if lineCount < 1 {
		lineCount = 1
	}
	height := float64(lineCount) * rowHeight
	if height < rowHeight {
		height = rowHeight
	}

	if pdf.GetY()+height > pageHeight-marginBottom {
		pdf.AddPage()
	}

	startY := pdf.GetY()
	pdf.SetFillColor(fillR, fillG, fillB)
	pdf.Rect(marginLeft, startY, labelWidth, height, "FD")
	pdf.Rect(marginLeft+labelWidth, startY, valueWidth, height, "FD")

	pdf.SetTextColor(textR, textG, textB)
	pdf.SetXY(marginLeft+1, startY+0.5)
	pdf.CellFormat(labelWidth-2, rowHeight, label, "", 0, "L", false, 0, "")

	pdf.SetXY(marginLeft+labelWidth+1, startY+0.5)
	pdf.MultiCell(valueWidth-2, rowHeight, safeString(value), "", "L", false)

	pdf.SetY(startY + height)
	pdf.SetTextColor(0, 0, 0)
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

// resolveAssignedUserNameFromEmployee returns assigned employee full name.
func resolveAssignedUserNameFromEmployee(emp *models.Employee, fallback string) string {
	if emp == nil {
		return fallback
	}

	if name := strings.TrimSpace(emp.NamaLengkap); name != "" {
		return name
	}

	return fallback
}

// addRMOrderInfoTable renders patient + order info table from EKlaimRMOrder data
func addRMOrderInfoTable(pdf *gofpdf.Fpdf, patient *models.Patient, rmOrder *models.EKlaimRMOrder, visit *models.Visit) {
	// Use FakeDate if available (user-set date), otherwise fall back to CreatedAt
	orderDate := rmOrder.CreatedAt
	if rmOrder.FakeDate != nil {
		orderDate = *rmOrder.FakeDate
	}

	// Generate order number if empty
	orderNumber := rmOrder.OrderNumber
	if orderNumber == "" {
		typeLabel := "ORD"
		switch rmOrder.OrderType {
		case "laboratory":
			typeLabel = "LAB"
		case "radiology":
			typeLabel = "RAD"
		case "surgery":
			typeLabel = "OPR"
		case "consultation":
			typeLabel = "KON"
		}
		orderNumber = fmt.Sprintf("%s%s%d", typeLabel, orderDate.Format("02012006"), rmOrder.ID)
	}

	fakeOrder := &models.ProcedureOrder{
		OrderNumber: orderNumber,
		CreatedAt:   orderDate,
	}
	if visit != nil && visit.Room != nil {
		fakeOrder.SourceRoom = visit.Room
	}
	if visit != nil && visit.Doctor != nil {
		fakeOrder.OrderedBy = visit.Doctor
	}
	addProcedureOrderInfoTable(pdf, patient, fakeOrder)
}

// PrintRMDuplicateLabOrder generates PDF for lab order request from RM Duplicate data
