package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// ====================================================================
// CATEGORY B: LAPORAN BPJS
// ====================================================================

// --- B1: Kunjungan BPJS Harian ---

type BPJSDailyRow struct {
	Tanggal    string `json:"tanggal"`
	RawatJalan int64  `json:"rawat_jalan"`
	RawatInap  int64  `json:"rawat_inap"`
	IGD        int64  `json:"igd"`
	Total      int64  `json:"total"`
}

func ReportBPJSDailyVisits(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []BPJSDailyRow
	db.Raw(`
		SELECT
			TO_CHAR(r.registration_date, 'YYYY-MM-DD') AS tanggal,
			COUNT(*) FILTER (WHERE r.registration_type = 'outpatient') AS rawat_jalan,
			COUNT(*) FILTER (WHERE r.registration_type = 'inpatient') AS rawat_inap,
			COUNT(*) FILTER (WHERE r.registration_type = 'emergency') AS igd,
			COUNT(*) AS total
		FROM registrations r
		WHERE r.deleted_at IS NULL AND r.payment_method = 'bpjs'
		  AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled')
		GROUP BY tanggal ORDER BY tanggal
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Kunjungan BPJS")
		sheet := "Kunjungan BPJS"
		headers := []string{"Tanggal", "Rawat Jalan", "Rawat Inap", "IGD", "Total"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.RawatJalan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.RawatInap)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.IGD)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Total)
		}
		f.SetColWidth(sheet, "A", "E", 14)
		SendExcel(c, f, "laporan_kunjungan_bpjs")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- B2: SEP Report ---

type SEPReportRow struct {
	NoSEP        string `json:"no_sep"`
	TglSEP       string `json:"tgl_sep"`
	NoKartu      string `json:"no_kartu"`
	NamaPasien   string `json:"nama_pasien"`
	JnsPelayanan string `json:"jns_pelayanan"`
	KodePoli     string `json:"kode_poli"`
	NamaPoli     string `json:"nama_poli"`
	DiagAwal     string `json:"diag_awal"`
	NamaDiagnosa string `json:"nama_diagnosa"`
	NamaDPJP     string `json:"nama_dpjp"`
	AsalRujukan  string `json:"asal_rujukan"`
	NamaRujukan  string `json:"nama_rujukan"`
}

func ReportSEP(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []SEPReportRow
	db.Raw(`
		SELECT s.no_sep, s.tgl_sep, s.no_kartu, s.nama_pasien,
			CASE WHEN s.jns_pelayanan = '1' THEN 'Rawat Inap'
			     WHEN s.jns_pelayanan = '2' THEN 'Rawat Jalan' ELSE s.jns_pelayanan END AS jns_pelayanan,
			s.kode_poli, s.nama_poli, s.diag_awal, s.nama_diagnosa, s.nama_dpjp,
			CASE WHEN s.asal_rujukan = '1' THEN 'Faskes 1'
			     WHEN s.asal_rujukan = '2' THEN 'Faskes 2' ELSE s.asal_rujukan END AS asal_rujukan,
			COALESCE(s.nama_rujukan, '-') AS nama_rujukan
		FROM sep s
		WHERE s.deleted_at IS NULL AND s.tgl_sep BETWEEN ? AND ?
		ORDER BY s.tgl_sep DESC, s.no_sep
	`, dr.StartDate.Format("2006-01-02"), dr.EndDate.Format("2006-01-02")).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Data SEP")
		sheet := "Data SEP"
		headers := []string{"No SEP", "Tgl SEP", "No Kartu", "Nama Pasien", "Jenis Pelayanan", "Kode Poli", "Nama Poli", "Diag Awal", "Nama Diagnosa", "DPJP", "Asal Rujukan", "Nama Perujuk"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NoSEP)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.TglSEP)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NoKartu)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.NamaPasien)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.JnsPelayanan)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.KodePoli)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.NamaPoli)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.DiagAwal)
			f.SetCellValue(sheet, fmt.Sprintf("I%d", r), row.NamaDiagnosa)
			f.SetCellValue(sheet, fmt.Sprintf("J%d", r), row.NamaDPJP)
			f.SetCellValue(sheet, fmt.Sprintf("K%d", r), row.AsalRujukan)
			f.SetCellValue(sheet, fmt.Sprintf("L%d", r), row.NamaRujukan)
		}
		f.SetColWidth(sheet, "A", "A", 20)
		f.SetColWidth(sheet, "B", "C", 14)
		f.SetColWidth(sheet, "D", "D", 25)
		f.SetColWidth(sheet, "E", "G", 18)
		f.SetColWidth(sheet, "H", "H", 12)
		f.SetColWidth(sheet, "I", "I", 35)
		f.SetColWidth(sheet, "J", "J", 25)
		f.SetColWidth(sheet, "K", "L", 20)
		SendExcel(c, f, "laporan_sep")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- B3: Surat Kontrol ---

type SuratKontrolReportRow struct {
	NoSuratKontrol    string `json:"no_surat_kontrol"`
	TglRencanaKontrol string `json:"tgl_rencana_kontrol"`
	NoKartu           string `json:"no_kartu"`
	Nama              string `json:"nama"`
	NamaPoli          string `json:"nama_poli"`
	NamaDokter        string `json:"nama_dokter"`
	NamaDiagnosa      string `json:"nama_diagnosa"`
	IsPRB             bool   `json:"is_prb"`
	Status            string `json:"status"`
}

func ReportSuratKontrol(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []SuratKontrolReportRow
	db.Raw(`
		SELECT sk.no_surat_kontrol, sk.tgl_rencana_kontrol, sk.no_kartu,
			sk.nama, sk.nama_poli, sk.nama_dokter, sk.nama_diagnosa,
			sk.is_prb, sk.status
		FROM surat_kontrol sk
		WHERE sk.deleted_at IS NULL
		  AND sk.tgl_rencana_kontrol BETWEEN ? AND ?
		ORDER BY sk.tgl_rencana_kontrol DESC
	`, dr.StartDate.Format("2006-01-02"), dr.EndDate.Format("2006-01-02")).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Surat Kontrol")
		sheet := "Surat Kontrol"
		headers := []string{"No Surat Kontrol", "Tgl Rencana", "No Kartu", "Nama", "Poli", "Dokter", "Diagnosa", "PRB", "Status"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NoSuratKontrol)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.TglRencanaKontrol)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NoKartu)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Nama)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.NamaPoli)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.NamaDokter)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.NamaDiagnosa)
			prbStr := "Tidak"
			if row.IsPRB {
				prbStr = "Ya"
			}
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), prbStr)
			f.SetCellValue(sheet, fmt.Sprintf("I%d", r), row.Status)
		}
		f.SetColWidth(sheet, "A", "A", 20)
		f.SetColWidth(sheet, "B", "C", 14)
		f.SetColWidth(sheet, "D", "D", 25)
		f.SetColWidth(sheet, "E", "G", 20)
		f.SetColWidth(sheet, "H", "I", 10)
		SendExcel(c, f, "laporan_surat_kontrol")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- B4: Antrean BPJS Online (Mobile JKN) ---

type AntreanBPJSRow struct {
	Tanggal      string `json:"tanggal"`
	TotalBooking int64  `json:"total_booking"`
	CheckIn      int64  `json:"checkin"`
	Dilayani     int64  `json:"dilayani"`
	Selesai      int64  `json:"selesai"`
	Batal        int64  `json:"batal"`
	JKN          int64  `json:"jkn"`
	NonJKN       int64  `json:"non_jkn"`
}

func ReportAntreanBPJS(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []AntreanBPJSRow
	db.Raw(`
		SELECT
			TO_CHAR(bq.tanggal_periksa, 'YYYY-MM-DD') AS tanggal,
			COUNT(*) AS total_booking,
			COUNT(*) FILTER (WHERE bq.status IN ('checkin','dipanggil','dilayani','selesai')) AS checkin,
			COUNT(*) FILTER (WHERE bq.status IN ('dilayani','selesai')) AS dilayani,
			COUNT(*) FILTER (WHERE bq.status = 'selesai') AS selesai,
			COUNT(*) FILTER (WHERE bq.status = 'batal') AS batal,
			COUNT(*) FILTER (WHERE bq.jenis_pasien = 'JKN') AS jkn,
			COUNT(*) FILTER (WHERE bq.jenis_pasien != 'JKN' OR bq.jenis_pasien IS NULL) AS non_jkn
		FROM bpjs_queues bq
		WHERE bq.deleted_at IS NULL AND bq.tanggal_periksa BETWEEN ? AND ?
		GROUP BY tanggal ORDER BY tanggal
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Antrean BPJS")
		sheet := "Antrean BPJS"
		headers := []string{"Tanggal", "Total Booking", "Check-in", "Dilayani", "Selesai", "Batal", "JKN", "Non-JKN"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.TotalBooking)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.CheckIn)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Dilayani)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Selesai)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Batal)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.JKN)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.NonJKN)
		}
		f.SetColWidth(sheet, "A", "H", 14)
		SendExcel(c, f, "laporan_antrean_bpjs")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- B5: E-Klaim / INA-CBG ---

type EKlaimReportRow struct {
	NoSEP        string  `json:"no_sep"`
	NamaPasien   string  `json:"nama_pasien"`
	TglMasuk     string  `json:"tgl_masuk"`
	TglPulang    string  `json:"tgl_pulang"`
	JenisRawat   string  `json:"jenis_rawat"`
	State        string  `json:"state"`
	TotalTarifRS float64 `json:"total_tarif_rs"`
	InaCBGCode   string  `json:"inacbg_code"`
	InaCBGTariff float64 `json:"inacbg_tariff"`
	Selisih      float64 `json:"selisih"`
}

func ReportEKlaim(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []EKlaimReportRow
	db.Raw(`
		SELECT ek.no_sep,
			COALESCE(p.nama_lengkap, '-') AS nama_pasien,
			TO_CHAR(ek.tgl_masuk, 'YYYY-MM-DD') AS tgl_masuk,
			TO_CHAR(ek.tgl_pulang, 'YYYY-MM-DD') AS tgl_pulang,
			CASE WHEN ek.jenis_rawat = '1' THEN 'Rawat Jalan'
			     WHEN ek.jenis_rawat = '2' THEN 'Rawat Inap'
			     WHEN ek.jenis_rawat = '3' THEN 'IGD' ELSE ek.jenis_rawat END AS jenis_rawat,
			ek.state::text AS state,
			ek.total_tarif_rs,
			COALESCE(ek.inacbg_code, '-') AS inacbg_code,
			ek.inacbg_tariff,
			(ek.inacbg_tariff - ek.total_tarif_rs) AS selisih
		FROM e_klaims ek
		LEFT JOIN visits v ON v.id = ek.visit_id
		LEFT JOIN registrations r ON r.id = v.registration_id
		LEFT JOIN patients p ON p.id = r.patient_id
		WHERE ek.deleted_at IS NULL AND ek.tgl_masuk BETWEEN ? AND ?
		ORDER BY ek.tgl_masuk DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	// Summary
	var summary struct {
		TotalKasus   int64   `json:"total_kasus"`
		TotalTarifRS float64 `json:"total_tarif_rs"`
		TotalINACBG  float64 `json:"total_inacbg"`
		TotalSelisih float64 `json:"total_selisih"`
	}
	db.Raw(`
		SELECT COUNT(*) AS total_kasus,
			COALESCE(SUM(total_tarif_rs), 0) AS total_tarif_rs,
			COALESCE(SUM(inacbg_tariff), 0) AS total_inacbg,
			COALESCE(SUM(inacbg_tariff - total_tarif_rs), 0) AS total_selisih
		FROM e_klaims WHERE deleted_at IS NULL AND tgl_masuk BETWEEN ? AND ?
	`, dr.StartDate, dr.EndDate).Scan(&summary)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("E-Klaim")
		sheet := "E-Klaim"
		headers := []string{"No SEP", "Nama Pasien", "Tgl Masuk", "Tgl Pulang", "Jenis Rawat", "Status", "Tarif RS", "Kode INA-CBG", "Tarif INA-CBG", "Selisih"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NoSEP)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaPasien)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.TglMasuk)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.TglPulang)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.JenisRawat)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.State)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.TotalTarifRS)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.InaCBGCode)
			f.SetCellValue(sheet, fmt.Sprintf("I%d", r), row.InaCBGTariff)
			f.SetCellValue(sheet, fmt.Sprintf("J%d", r), row.Selisih)
			for col := 7; col <= 10; col++ {
				cell, _ := excelize.CoordinatesToCellName(col, r)
				f.SetCellStyle(sheet, cell, cell, styles.MoneyStyle)
			}
		}
		f.SetColWidth(sheet, "A", "A", 20)
		f.SetColWidth(sheet, "B", "B", 25)
		f.SetColWidth(sheet, "C", "F", 14)
		f.SetColWidth(sheet, "G", "J", 18)
		SendExcel(c, f, "laporan_eklaim")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows, "summary": summary})
}

// --- B6: Rekapitulasi BPJS per Poli ---

type BPJSByPoliRow struct {
	KodePoli string `json:"kode_poli"`
	NamaPoli string `json:"nama_poli"`
	Jumlah   int64  `json:"jumlah"`
	SEPCount int64  `json:"sep_count"`
}

func ReportBPJSByPoli(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []BPJSByPoliRow
	db.Raw(`
		SELECT rm.code AS kode_poli, rm.name AS nama_poli,
			COUNT(DISTINCT r.id) AS jumlah,
			COUNT(DISTINCT s.id) AS sep_count
		FROM registrations r
		JOIN rooms rm ON rm.id = r.destination_room_id
		LEFT JOIN sep s ON s.registration_id = r.id AND s.deleted_at IS NULL
		WHERE r.deleted_at IS NULL AND r.payment_method = 'bpjs'
		  AND r.registration_date BETWEEN ? AND ? AND r.status NOT IN ('cancelled')
		GROUP BY rm.code, rm.name ORDER BY jumlah DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("BPJS per Poli")
		sheet := "BPJS per Poli"
		headers := []string{"Kode Poli", "Nama Poli", "Jumlah Kunjungan", "Jumlah SEP"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.KodePoli)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaPoli)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.SEPCount)
		}
		f.SetColWidth(sheet, "A", "A", 12)
		f.SetColWidth(sheet, "B", "B", 30)
		f.SetColWidth(sheet, "C", "D", 18)
		SendExcel(c, f, "laporan_bpjs_per_poli")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
