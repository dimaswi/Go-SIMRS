package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"

	"github.com/gin-gonic/gin"
)

// ====================================================================
// CATEGORY H: LAPORAN SDM (Sumber Daya Manusia)
// ====================================================================

// --- H1: Rekap Pegawai ---

type EmployeeSummaryRow struct {
	TipeKaryawan      string `json:"tipe_karyawan"`
	StatusKepegawaian string `json:"status_kepegawaian"`
	Jumlah            int64  `json:"jumlah"`
	Laki              int64  `json:"laki"`
	Perempuan         int64  `json:"perempuan"`
}

func ReportEmployeeSummary(c *gin.Context) {
	db := database.DB

	var rows []EmployeeSummaryRow
	db.Raw(`
		SELECT e.tipe_karyawan, e.status_kepegawaian,
			COUNT(*) AS jumlah,
			COUNT(*) FILTER (WHERE e.jenis_kelamin = 'L') AS laki,
			COUNT(*) FILTER (WHERE e.jenis_kelamin = 'P') AS perempuan
		FROM employees e
		WHERE e.deleted_at IS NULL AND e.tanggal_keluar IS NULL
		GROUP BY e.tipe_karyawan, e.status_kepegawaian
		ORDER BY e.tipe_karyawan, e.status_kepegawaian
	`).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Rekap Pegawai")
		sheet := "Rekap Pegawai"
		headers := []string{"Tipe Karyawan", "Status Kepegawaian", "Jumlah", "Laki-laki", "Perempuan"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.TipeKaryawan)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.StatusKepegawaian)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Laki)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Perempuan)
		}
		f.SetColWidth(sheet, "A", "B", 22)
		f.SetColWidth(sheet, "C", "E", 12)
		SendExcel(c, f, "laporan_rekap_pegawai")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- H2: Daftar Dokter & Spesialis ---

type DoctorListRow struct {
	NamaLengkap       string `json:"nama_lengkap"`
	Spesialisasi      string `json:"spesialisasi"`
	NoSTR             string `json:"no_str"`
	MasaBerlakuSTR    string `json:"masa_berlaku_str"`
	NoSIP             string `json:"no_sip"`
	MasaBerlakuSIP    string `json:"masa_berlaku_sip"`
	StatusKepegawaian string `json:"status_kepegawaian"`
	StatusSTR         string `json:"status_str"`
}

func ReportDoctorList(c *gin.Context) {
	db := database.DB

	var rows []DoctorListRow
	db.Raw(`
		SELECT e.nama_lengkap,
			COALESCE(e.spesialisasi, 'Umum') AS spesialisasi,
			COALESCE(e.no_str, '-') AS no_str,
			COALESCE(TO_CHAR(e.masa_berlaku_str, 'YYYY-MM-DD'), '-') AS masa_berlaku_str,
			COALESCE(e.no_sip, '-') AS no_sip,
			COALESCE(TO_CHAR(e.masa_berlaku_sip, 'YYYY-MM-DD'), '-') AS masa_berlaku_sip,
			e.status_kepegawaian,
			CASE
				WHEN e.masa_berlaku_str IS NULL THEN 'Belum Diisi'
				WHEN e.masa_berlaku_str < NOW() THEN 'Kadaluarsa'
				WHEN e.masa_berlaku_str < NOW() + INTERVAL '90 days' THEN 'Segera Habis'
				ELSE 'Aktif'
			END AS status_str
		FROM employees e
		WHERE e.deleted_at IS NULL AND e.tanggal_keluar IS NULL
		  AND e.tipe_karyawan = 'Dokter'
		ORDER BY e.spesialisasi, e.nama_lengkap
	`).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Daftar Dokter")
		sheet := "Daftar Dokter"
		headers := []string{"Nama Lengkap", "Spesialisasi", "No STR", "Berlaku STR", "No SIP", "Berlaku SIP", "Status Pegawai", "Status STR"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaLengkap)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Spesialisasi)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NoSTR)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.MasaBerlakuSTR)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.NoSIP)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.MasaBerlakuSIP)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.StatusKepegawaian)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.StatusSTR)
		}
		f.SetColWidth(sheet, "A", "A", 30)
		f.SetColWidth(sheet, "B", "B", 20)
		f.SetColWidth(sheet, "C", "C", 18)
		f.SetColWidth(sheet, "D", "D", 14)
		f.SetColWidth(sheet, "E", "E", 18)
		f.SetColWidth(sheet, "F", "H", 14)
		SendExcel(c, f, "laporan_daftar_dokter")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- H3: STR/SIP Akan Habis ---

type LicenseExpiryRow struct {
	NamaLengkap  string `json:"nama_lengkap"`
	TipeKaryawan string `json:"tipe_karyawan"`
	Spesialisasi string `json:"spesialisasi"`
	JenisSurat   string `json:"jenis_surat"`
	NomorSurat   string `json:"nomor_surat"`
	TglBerlaku   string `json:"tgl_berlaku"`
	SisaHari     int    `json:"sisa_hari"`
	Status       string `json:"status"`
}

func ReportLicenseExpiry(c *gin.Context) {
	db := database.DB

	var rows []LicenseExpiryRow
	db.Raw(`
		SELECT * FROM (
			SELECT e.nama_lengkap, e.tipe_karyawan,
				COALESCE(e.spesialisasi, '-') AS spesialisasi,
				'STR' AS jenis_surat,
				COALESCE(e.no_str, '-') AS nomor_surat,
				TO_CHAR(e.masa_berlaku_str, 'YYYY-MM-DD') AS tgl_berlaku,
				(e.masa_berlaku_str::date - CURRENT_DATE) AS sisa_hari,
				CASE
					WHEN e.masa_berlaku_str < NOW() THEN 'Kadaluarsa'
					WHEN e.masa_berlaku_str < NOW() + INTERVAL '90 days' THEN 'Segera Habis'
					ELSE 'Aktif'
				END AS status
			FROM employees e
			WHERE e.deleted_at IS NULL AND e.tanggal_keluar IS NULL
			  AND e.masa_berlaku_str IS NOT NULL
			  AND e.masa_berlaku_str < NOW() + INTERVAL '180 days'
			UNION ALL
			SELECT e.nama_lengkap, e.tipe_karyawan,
				COALESCE(e.spesialisasi, '-') AS spesialisasi,
				'SIP' AS jenis_surat,
				COALESCE(e.no_sip, '-') AS nomor_surat,
				TO_CHAR(e.masa_berlaku_sip, 'YYYY-MM-DD') AS tgl_berlaku,
				(e.masa_berlaku_sip::date - CURRENT_DATE) AS sisa_hari,
				CASE
					WHEN e.masa_berlaku_sip < NOW() THEN 'Kadaluarsa'
					WHEN e.masa_berlaku_sip < NOW() + INTERVAL '90 days' THEN 'Segera Habis'
					ELSE 'Aktif'
				END AS status
			FROM employees e
			WHERE e.deleted_at IS NULL AND e.tanggal_keluar IS NULL
			  AND e.masa_berlaku_sip IS NOT NULL
			  AND e.masa_berlaku_sip < NOW() + INTERVAL '180 days'
		) combined ORDER BY sisa_hari ASC
	`).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("STR SIP Expiry")
		sheet := "STR SIP Expiry"
		headers := []string{"Nama", "Tipe", "Spesialisasi", "Jenis Surat", "Nomor", "Tgl Berlaku", "Sisa Hari", "Status"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaLengkap)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.TipeKaryawan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Spesialisasi)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.JenisSurat)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.NomorSurat)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.TglBerlaku)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.SisaHari)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.Status)
		}
		f.SetColWidth(sheet, "A", "A", 30)
		f.SetColWidth(sheet, "B", "D", 16)
		f.SetColWidth(sheet, "E", "F", 18)
		f.SetColWidth(sheet, "G", "H", 12)
		SendExcel(c, f, "laporan_str_sip_expiry")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- H4: Beban Kerja Dokter ---

type DoctorWorkloadRow struct {
	NamaDokter   string  `json:"nama_dokter"`
	Spesialisasi string  `json:"spesialisasi"`
	JumlahPasien int64   `json:"jumlah_pasien"`
	RawatJalan   int64   `json:"rawat_jalan"`
	RawatInap    int64   `json:"rawat_inap"`
	AvgPerHari   float64 `json:"avg_per_hari"`
}

func ReportDoctorWorkload(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	periodDays := int(dr.EndDate.Sub(dr.StartDate).Hours()/24) + 1

	var rows []DoctorWorkloadRow
	db.Raw(`
		SELECT e.nama_lengkap AS nama_dokter,
			COALESCE(e.spesialisasi, 'Umum') AS spesialisasi,
			COUNT(DISTINCT r.id) AS jumlah_pasien,
			COUNT(DISTINCT r.id) FILTER (WHERE r.registration_type = 'outpatient') AS rawat_jalan,
			COUNT(DISTINCT r.id) FILTER (WHERE r.registration_type = 'inpatient') AS rawat_inap,
			ROUND(COUNT(DISTINCT r.id)::numeric / NULLIF(?, 0), 1) AS avg_per_hari
		FROM registrations r
		JOIN employees e ON e.id = r.doctor_id
		WHERE r.deleted_at IS NULL AND r.doctor_id IS NOT NULL
		  AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled')
		GROUP BY e.nama_lengkap, e.spesialisasi
		ORDER BY jumlah_pasien DESC
	`, periodDays, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Beban Kerja Dokter")
		sheet := "Beban Kerja Dokter"
		headers := []string{"Nama Dokter", "Spesialisasi", "Total Pasien", "Rawat Jalan", "Rawat Inap", "Rata-rata/Hari"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaDokter)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Spesialisasi)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.JumlahPasien)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.RawatJalan)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.RawatInap)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.AvgPerHari)
		}
		f.SetColWidth(sheet, "A", "A", 30)
		f.SetColWidth(sheet, "B", "B", 20)
		f.SetColWidth(sheet, "C", "F", 14)
		SendExcel(c, f, "laporan_beban_kerja_dokter")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
