package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// ====================================================================
// CATEGORY A: LAPORAN KUNJUNGAN & PASIEN
// ====================================================================

// --- A1: Kunjungan Harian ---

type DailyVisitRow struct {
	Tanggal    string `json:"tanggal"`
	RawatJalan int64  `json:"rawat_jalan"`
	RawatInap  int64  `json:"rawat_inap"`
	IGD        int64  `json:"igd"`
	Total      int64  `json:"total"`
}

func ReportDailyVisits(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []DailyVisitRow
	db.Raw(`
		SELECT
			TO_CHAR(r.registration_date, 'YYYY-MM-DD') AS tanggal,
			COUNT(*) FILTER (WHERE r.registration_type = 'outpatient') AS rawat_jalan,
			COUNT(*) FILTER (WHERE r.registration_type = 'inpatient') AS rawat_inap,
			COUNT(*) FILTER (WHERE r.registration_type = 'emergency') AS igd,
			COUNT(*) AS total
		FROM registrations r
		WHERE r.deleted_at IS NULL
		  AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled')
		GROUP BY TO_CHAR(r.registration_date, 'YYYY-MM-DD')
		ORDER BY tanggal
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Kunjungan Harian")
		headers := []string{"Tanggal", "Rawat Jalan", "Rawat Inap", "IGD", "Total"}
		WriteExcelHeader(f, "Kunjungan Harian", headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue("Kunjungan Harian", fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue("Kunjungan Harian", fmt.Sprintf("B%d", r), row.RawatJalan)
			f.SetCellValue("Kunjungan Harian", fmt.Sprintf("C%d", r), row.RawatInap)
			f.SetCellValue("Kunjungan Harian", fmt.Sprintf("D%d", r), row.IGD)
			f.SetCellValue("Kunjungan Harian", fmt.Sprintf("E%d", r), row.Total)
			for col := 1; col <= 5; col++ {
				cell, _ := excelize.CoordinatesToCellName(col, r)
				if col >= 2 {
					f.SetCellStyle("Kunjungan Harian", cell, cell, styles.NumberStyle)
				} else {
					f.SetCellStyle("Kunjungan Harian", cell, cell, styles.DataStyle)
				}
			}
		}
		f.SetColWidth("Kunjungan Harian", "A", "A", 14)
		f.SetColWidth("Kunjungan Harian", "B", "E", 14)
		SendExcel(c, f, "laporan_kunjungan_harian")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows, "start_date": dr.StartDate.Format("2006-01-02"), "end_date": dr.EndDate.Format("2006-01-02")})
}

// --- A2: Kunjungan Per Poli/Ruangan ---

type VisitByRoomRow struct {
	RoomID      uint   `json:"room_id"`
	KodeRuangan string `json:"kode_ruangan"`
	NamaRuangan string `json:"nama_ruangan"`
	ServiceType string `json:"service_type"`
	Jumlah      int64  `json:"jumlah"`
	Laki        int64  `json:"laki"`
	Perempuan   int64  `json:"perempuan"`
	BaruCount   int64  `json:"baru"`
	LamaCount   int64  `json:"lama"`
}

func ReportVisitsByRoom(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []VisitByRoomRow
	db.Raw(`
		SELECT
			rm.id AS room_id,
			rm.code AS kode_ruangan,
			rm.name AS nama_ruangan,
			rm.service_type,
			COUNT(DISTINCT r.id) AS jumlah,
			COUNT(DISTINCT r.id) FILTER (WHERE p.jenis_kelamin = 'L') AS laki,
			COUNT(DISTINCT r.id) FILTER (WHERE p.jenis_kelamin = 'P') AS perempuan,
			COUNT(DISTINCT r.id) FILTER (WHERE r.visit_number = 1) AS baru_count,
			COUNT(DISTINCT r.id) FILTER (WHERE r.visit_number > 1) AS lama_count
		FROM registrations r
		JOIN patients p ON p.id = r.patient_id
		JOIN rooms rm ON rm.id = r.destination_room_id
		WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled')
		GROUP BY rm.id, rm.code, rm.name, rm.service_type
		ORDER BY jumlah DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Kunjungan Per Poli")
		headers := []string{"Kode", "Nama Ruangan", "Tipe", "Jumlah", "Laki-laki", "Perempuan", "Baru", "Lama"}
		WriteExcelHeader(f, "Kunjungan Per Poli", headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue("Kunjungan Per Poli", fmt.Sprintf("A%d", r), row.KodeRuangan)
			f.SetCellValue("Kunjungan Per Poli", fmt.Sprintf("B%d", r), row.NamaRuangan)
			f.SetCellValue("Kunjungan Per Poli", fmt.Sprintf("C%d", r), row.ServiceType)
			f.SetCellValue("Kunjungan Per Poli", fmt.Sprintf("D%d", r), row.Jumlah)
			f.SetCellValue("Kunjungan Per Poli", fmt.Sprintf("E%d", r), row.Laki)
			f.SetCellValue("Kunjungan Per Poli", fmt.Sprintf("F%d", r), row.Perempuan)
			f.SetCellValue("Kunjungan Per Poli", fmt.Sprintf("G%d", r), row.BaruCount)
			f.SetCellValue("Kunjungan Per Poli", fmt.Sprintf("H%d", r), row.LamaCount)
		}
		f.SetColWidth("Kunjungan Per Poli", "A", "A", 10)
		f.SetColWidth("Kunjungan Per Poli", "B", "B", 30)
		f.SetColWidth("Kunjungan Per Poli", "C", "C", 15)
		f.SetColWidth("Kunjungan Per Poli", "D", "H", 12)
		SendExcel(c, f, "laporan_kunjungan_per_poli")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows, "start_date": dr.StartDate.Format("2006-01-02"), "end_date": dr.EndDate.Format("2006-01-02")})
}

// --- A3: Kunjungan Per Dokter ---

type VisitByDoctorRow struct {
	DoctorID     uint   `json:"doctor_id"`
	NamaDokter   string `json:"nama_dokter"`
	Spesialisasi string `json:"spesialisasi"`
	Jumlah       int64  `json:"jumlah"`
	RawatJalan   int64  `json:"rawat_jalan"`
	RawatInap    int64  `json:"rawat_inap"`
	IGD          int64  `json:"igd"`
}

func ReportVisitsByDoctor(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []VisitByDoctorRow
	db.Raw(`
		SELECT
			e.id AS doctor_id,
			e.nama_lengkap AS nama_dokter,
			COALESCE(e.spesialisasi, '-') AS spesialisasi,
			COUNT(DISTINCT r.id) AS jumlah,
			COUNT(DISTINCT r.id) FILTER (WHERE r.registration_type = 'outpatient') AS rawat_jalan,
			COUNT(DISTINCT r.id) FILTER (WHERE r.registration_type = 'inpatient') AS rawat_inap,
			COUNT(DISTINCT r.id) FILTER (WHERE r.registration_type = 'emergency') AS igd
		FROM registrations r
		JOIN employees e ON e.id = r.doctor_id
		WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled') AND r.doctor_id IS NOT NULL
		GROUP BY e.id, e.nama_lengkap, e.spesialisasi
		ORDER BY jumlah DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Kunjungan Per Dokter")
		headers := []string{"Nama Dokter", "Spesialisasi", "Jumlah", "Rawat Jalan", "Rawat Inap", "IGD"}
		WriteExcelHeader(f, "Kunjungan Per Dokter", headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue("Kunjungan Per Dokter", fmt.Sprintf("A%d", r), row.NamaDokter)
			f.SetCellValue("Kunjungan Per Dokter", fmt.Sprintf("B%d", r), row.Spesialisasi)
			f.SetCellValue("Kunjungan Per Dokter", fmt.Sprintf("C%d", r), row.Jumlah)
			f.SetCellValue("Kunjungan Per Dokter", fmt.Sprintf("D%d", r), row.RawatJalan)
			f.SetCellValue("Kunjungan Per Dokter", fmt.Sprintf("E%d", r), row.RawatInap)
			f.SetCellValue("Kunjungan Per Dokter", fmt.Sprintf("F%d", r), row.IGD)
		}
		f.SetColWidth("Kunjungan Per Dokter", "A", "A", 30)
		f.SetColWidth("Kunjungan Per Dokter", "B", "B", 20)
		f.SetColWidth("Kunjungan Per Dokter", "C", "F", 14)
		SendExcel(c, f, "laporan_kunjungan_per_dokter")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- A4: Demografi Pasien ---

type DemographicRow struct {
	Kategori string `json:"kategori"`
	Nilai    string `json:"nilai"`
	Jumlah   int64  `json:"jumlah"`
}

func ReportPatientDemographics(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	// Gender breakdown
	var genderRows []DemographicRow
	db.Raw(`
		SELECT 'Jenis Kelamin' AS kategori,
			CASE WHEN p.jenis_kelamin = 'L' THEN 'Laki-laki'
			     WHEN p.jenis_kelamin = 'P' THEN 'Perempuan'
			     ELSE 'Tidak Diketahui' END AS nilai,
			COUNT(DISTINCT r.patient_id) AS jumlah
		FROM registrations r
		JOIN patients p ON p.id = r.patient_id
		WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled')
		GROUP BY p.jenis_kelamin ORDER BY jumlah DESC
	`, dr.StartDate, dr.EndDate).Scan(&genderRows)

	// Age group breakdown
	var ageRows []DemographicRow
	db.Raw(`
		SELECT 'Kelompok Umur' AS kategori,
			CASE
				WHEN EXTRACT(YEAR FROM AGE(NOW(), p.tanggal_lahir)) < 1 THEN '< 1 tahun'
				WHEN EXTRACT(YEAR FROM AGE(NOW(), p.tanggal_lahir)) BETWEEN 1 AND 4 THEN '1-4 tahun'
				WHEN EXTRACT(YEAR FROM AGE(NOW(), p.tanggal_lahir)) BETWEEN 5 AND 14 THEN '5-14 tahun'
				WHEN EXTRACT(YEAR FROM AGE(NOW(), p.tanggal_lahir)) BETWEEN 15 AND 24 THEN '15-24 tahun'
				WHEN EXTRACT(YEAR FROM AGE(NOW(), p.tanggal_lahir)) BETWEEN 25 AND 44 THEN '25-44 tahun'
				WHEN EXTRACT(YEAR FROM AGE(NOW(), p.tanggal_lahir)) BETWEEN 45 AND 64 THEN '45-64 tahun'
				WHEN EXTRACT(YEAR FROM AGE(NOW(), p.tanggal_lahir)) >= 65 THEN '≥ 65 tahun'
				ELSE 'Tidak Diketahui'
			END AS nilai,
			COUNT(DISTINCT r.patient_id) AS jumlah
		FROM registrations r
		JOIN patients p ON p.id = r.patient_id
		WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled') AND p.tanggal_lahir IS NOT NULL
		GROUP BY nilai ORDER BY MIN(EXTRACT(YEAR FROM AGE(NOW(), p.tanggal_lahir)))
	`, dr.StartDate, dr.EndDate).Scan(&ageRows)

	// Payment method breakdown
	var paymentRows []DemographicRow
	db.Raw(`
		SELECT 'Metode Pembayaran' AS kategori,
			CASE
				WHEN r.payment_method = 'bpjs' THEN 'BPJS'
				WHEN r.payment_method = 'cash' THEN 'Umum/Cash'
				WHEN r.payment_method = 'insurance' THEN 'Asuransi'
				ELSE COALESCE(r.payment_method, 'Lainnya')
			END AS nilai,
			COUNT(*) AS jumlah
		FROM registrations r
		WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled')
		GROUP BY nilai ORDER BY jumlah DESC
	`, dr.StartDate, dr.EndDate).Scan(&paymentRows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Demografi Pasien")
		sheet := "Demografi Pasien"
		headers := []string{"Kategori", "Nilai", "Jumlah"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		row := 2
		allRows := append(append(genderRows, ageRows...), paymentRows...)
		for _, d := range allRows {
			f.SetCellValue(sheet, fmt.Sprintf("A%d", row), d.Kategori)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", row), d.Nilai)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", row), d.Jumlah)
			row++
		}
		f.SetColWidth(sheet, "A", "A", 20)
		f.SetColWidth(sheet, "B", "B", 25)
		f.SetColWidth(sheet, "C", "C", 12)
		SendExcel(c, f, "laporan_demografi_pasien")
		return
	}

	allRows := append(append(genderRows, ageRows...), paymentRows...)
	c.JSON(http.StatusOK, gin.H{"data": allRows})
}

// --- A5: Sebaran Wilayah Pasien ---

type PatientRegionRow struct {
	Provinsi  string `json:"provinsi"`
	Kabupaten string `json:"kabupaten"`
	Kecamatan string `json:"kecamatan"`
	Jumlah    int64  `json:"jumlah"`
}

func ReportPatientRegions(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB
	level := c.DefaultQuery("level", "kabupaten") // provinsi, kabupaten, kecamatan

	var rows []PatientRegionRow
	var query string

	switch level {
	case "provinsi":
		query = `
			SELECT COALESCE(p.provinsi_domisili, p.provinsi_ktp, 'Tidak Diketahui') AS provinsi,
				'' AS kabupaten, '' AS kecamatan,
				COUNT(DISTINCT r.patient_id) AS jumlah
			FROM registrations r
			JOIN patients p ON p.id = r.patient_id
			WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ? AND r.status NOT IN ('cancelled')
			GROUP BY provinsi ORDER BY jumlah DESC`
	case "kecamatan":
		query = `
			SELECT COALESCE(p.provinsi_domisili, p.provinsi_ktp, 'Tidak Diketahui') AS provinsi,
				COALESCE(p.kota_domisili, p.kota_ktp, '-') AS kabupaten,
				COALESCE(p.kecamatan_domisili, p.kecamatan_ktp, '-') AS kecamatan,
				COUNT(DISTINCT r.patient_id) AS jumlah
			FROM registrations r
			JOIN patients p ON p.id = r.patient_id
			WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ? AND r.status NOT IN ('cancelled')
			GROUP BY provinsi, kabupaten, kecamatan ORDER BY jumlah DESC`
	default: // kabupaten
		query = `
			SELECT COALESCE(p.provinsi_domisili, p.provinsi_ktp, 'Tidak Diketahui') AS provinsi,
				COALESCE(p.kota_domisili, p.kota_ktp, '-') AS kabupaten,
				'' AS kecamatan,
				COUNT(DISTINCT r.patient_id) AS jumlah
			FROM registrations r
			JOIN patients p ON p.id = r.patient_id
			WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ? AND r.status NOT IN ('cancelled')
			GROUP BY provinsi, kabupaten ORDER BY jumlah DESC`
	}

	db.Raw(query, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Sebaran Wilayah")
		sheet := "Sebaran Wilayah"
		headers := []string{"Provinsi", "Kabupaten", "Kecamatan", "Jumlah"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Provinsi)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Kabupaten)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Kecamatan)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Jumlah)
		}
		f.SetColWidth(sheet, "A", "C", 25)
		f.SetColWidth(sheet, "D", "D", 12)
		SendExcel(c, f, "laporan_sebaran_wilayah")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows, "level": level})
}

// --- A6: Top 10 Diagnosa ---

type TopDiagnosisRow struct {
	KodeICD10 string `json:"kode_icd10"`
	Nama      string `json:"nama"`
	Jumlah    int64  `json:"jumlah"`
	Laki      int64  `json:"laki"`
	Perempuan int64  `json:"perempuan"`
}

func ReportTopDiagnoses(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB
	limit := c.DefaultQuery("limit", "20")

	var rows []TopDiagnosisRow
	db.Raw(`
		SELECT d.icd10_code AS kode_icd10,
			COALESCE(d.icd10_name, '-') AS nama,
			COUNT(*) AS jumlah,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'L') AS laki,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'P') AS perempuan
		FROM diagnoses d
		JOIN visits v ON v.id = d.visit_id
		JOIN registrations r ON r.id = v.registration_id
		JOIN patients p ON p.id = r.patient_id
		WHERE d.deleted_at IS NULL AND v.deleted_at IS NULL
		  AND r.registration_date BETWEEN ? AND ?
		  AND d.icd10_code IS NOT NULL AND d.icd10_code != ''
		GROUP BY d.icd10_code, nama
		ORDER BY jumlah DESC
		LIMIT ?
	`, dr.StartDate, dr.EndDate, limit).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Top Diagnosa")
		sheet := "Top Diagnosa"
		headers := []string{"No", "Kode ICD-10", "Nama Diagnosa", "Jumlah", "Laki-laki", "Perempuan"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), i+1)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.KodeICD10)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Nama)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Laki)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Perempuan)
		}
		f.SetColWidth(sheet, "A", "A", 5)
		f.SetColWidth(sheet, "B", "B", 14)
		f.SetColWidth(sheet, "C", "C", 50)
		f.SetColWidth(sheet, "D", "F", 12)
		SendExcel(c, f, "laporan_top_diagnosa")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- A7: Pasien Baru vs Lama ---

type NewVsOldRow struct {
	Tanggal    string `json:"tanggal"`
	PasienBaru int64  `json:"pasien_baru"`
	PasienLama int64  `json:"pasien_lama"`
	Total      int64  `json:"total"`
}

func ReportNewVsOldPatients(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []NewVsOldRow
	db.Raw(`
		SELECT
			TO_CHAR(r.registration_date, 'YYYY-MM-DD') AS tanggal,
			COUNT(*) FILTER (WHERE r.visit_number = 1) AS pasien_baru,
			COUNT(*) FILTER (WHERE r.visit_number > 1) AS pasien_lama,
			COUNT(*) AS total
		FROM registrations r
		WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled')
		GROUP BY tanggal ORDER BY tanggal
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Pasien Baru vs Lama")
		sheet := "Pasien Baru vs Lama"
		headers := []string{"Tanggal", "Pasien Baru", "Pasien Lama", "Total"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.PasienBaru)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.PasienLama)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Total)
		}
		f.SetColWidth(sheet, "A", "D", 14)
		SendExcel(c, f, "laporan_pasien_baru_vs_lama")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- A8: Cara Bayar ---

type PaymentMethodRow struct {
	MetodeBayar string  `json:"metode_bayar"`
	Jumlah      int64   `json:"jumlah"`
	Persentase  float64 `json:"persentase"`
}

func ReportPaymentMethods(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var total int64
	db.Model(&models.Registration{}).Where("deleted_at IS NULL AND registration_date BETWEEN ? AND ? AND status NOT IN ('cancelled')", dr.StartDate, dr.EndDate).Count(&total)

	var rows []PaymentMethodRow
	db.Raw(`
		SELECT
			CASE
				WHEN r.payment_method = 'bpjs' THEN 'BPJS'
				WHEN r.payment_method = 'cash' THEN 'Umum/Cash'
				WHEN r.payment_method = 'insurance' THEN 'Asuransi'
				ELSE COALESCE(r.payment_method, 'Lainnya')
			END AS metode_bayar,
			COUNT(*) AS jumlah,
			ROUND(COUNT(*)::numeric * 100.0 / NULLIF(?, 0), 2) AS persentase
		FROM registrations r
		WHERE r.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled')
		GROUP BY metode_bayar ORDER BY jumlah DESC
	`, total, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Cara Bayar")
		sheet := "Cara Bayar"
		headers := []string{"Metode Bayar", "Jumlah", "Persentase (%)"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.MetodeBayar)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Persentase)
		}
		f.SetColWidth(sheet, "A", "A", 20)
		f.SetColWidth(sheet, "B", "C", 14)
		SendExcel(c, f, "laporan_cara_bayar")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows, "total": total})
}

// --- A9: Rujukan Masuk ---

type ReferralRow struct {
	AsalRujukan string `json:"asal_rujukan"`
	NamaRujukan string `json:"nama_rujukan"`
	Jumlah      int64  `json:"jumlah"`
}

func ReportReferrals(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []ReferralRow
	db.Raw(`
		SELECT
			CASE WHEN s.asal_rujukan = '1' THEN 'Faskes Tingkat 1'
			     WHEN s.asal_rujukan = '2' THEN 'Faskes Tingkat 2'
			     ELSE COALESCE(s.asal_rujukan, 'Tidak Diketahui') END AS asal_rujukan,
			COALESCE(s.nama_rujukan, '-') AS nama_rujukan,
			COUNT(*) AS jumlah
		FROM sep s
		JOIN registrations r ON r.id = s.registration_id
		WHERE s.deleted_at IS NULL AND r.registration_date BETWEEN ? AND ?
		GROUP BY s.asal_rujukan, s.nama_rujukan
		ORDER BY jumlah DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Rujukan Masuk")
		sheet := "Rujukan Masuk"
		headers := []string{"Asal Rujukan", "Nama Faskes Perujuk", "Jumlah"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.AsalRujukan)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaRujukan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Jumlah)
		}
		f.SetColWidth(sheet, "A", "A", 20)
		f.SetColWidth(sheet, "B", "B", 40)
		f.SetColWidth(sheet, "C", "C", 12)
		SendExcel(c, f, "laporan_rujukan_masuk")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// ParseDateRangeForReport is an alias that also adds time context to the response
func addPeriodInfo(c *gin.Context, data interface{}) {
	dr := ParseDateRange(c)
	c.JSON(http.StatusOK, gin.H{
		"data":       data,
		"start_date": dr.StartDate.Format("2006-01-02"),
		"end_date":   dr.EndDate.Format(time.DateOnly),
	})
}
