package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"

	"github.com/gin-gonic/gin"
)

// ====================================================================
// CATEGORY D: LAPORAN RAWAT INAP
// ====================================================================

// --- D1: Indikator Rawat Inap (BOR, ALOS, BTO, TOI, GDR, NDR) ---

type InpatientIndicators struct {
	TotalBeds       int64   `json:"total_beds"`
	OccupiedDays    int64   `json:"occupied_days"`
	TotalDischarges int64   `json:"total_discharges"`
	TotalDeaths     int64   `json:"total_deaths"`
	DeathsLess48h   int64   `json:"deaths_less_48h"`
	PeriodDays      int     `json:"period_days"`
	BOR             float64 `json:"bor"`  // Bed Occupancy Rate
	ALOS            float64 `json:"alos"` // Average Length of Stay
	BTO             float64 `json:"bto"`  // Bed Turn Over
	TOI             float64 `json:"toi"`  // Turn Over Interval
	GDR             float64 `json:"gdr"`  // Gross Death Rate (‰)
	NDR             float64 `json:"ndr"`  // Net Death Rate (‰)
}

func ReportInpatientIndicators(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	periodDays := int(dr.EndDate.Sub(dr.StartDate).Hours()/24) + 1

	var ind InpatientIndicators
	ind.PeriodDays = periodDays

	// Total beds
	db.Raw(`SELECT COUNT(*) FROM beds WHERE deleted_at IS NULL AND status != 'maintenance'`).Scan(&ind.TotalBeds)

	// Occupied days (total inpatient days in period)
	db.Raw(`
		SELECT COALESCE(SUM(v.inpatient_days), 0)
		FROM visits v
		JOIN registrations r ON r.id = v.registration_id
		WHERE v.deleted_at IS NULL AND v.visit_type = 'inpatient'
		  AND r.registration_date BETWEEN ? AND ?
	`, dr.StartDate, dr.EndDate).Scan(&ind.OccupiedDays)

	// Total discharges
	db.Raw(`
		SELECT COUNT(*)
		FROM visits v
		JOIN registrations r ON r.id = v.registration_id
		WHERE v.deleted_at IS NULL AND v.visit_type = 'inpatient'
		  AND v.discharge_time IS NOT NULL
		  AND r.registration_date BETWEEN ? AND ?
	`, dr.StartDate, dr.EndDate).Scan(&ind.TotalDischarges)

	// Deaths (from e_klaims jenis_keluar)
	db.Raw(`
		SELECT
			COUNT(*) FILTER (WHERE ek.jenis_keluar IN ('4','5','6')) AS total_deaths,
			COUNT(*) FILTER (WHERE ek.jenis_keluar = '5') AS deaths_less_48h
		FROM eklaims ek WHERE ek.deleted_at IS NULL AND ek.tgl_masuk BETWEEN ? AND ?
	`, dr.StartDate, dr.EndDate).Row().Scan(&ind.TotalDeaths, &ind.DeathsLess48h)

	// Calculate indicators
	if ind.TotalBeds > 0 && periodDays > 0 {
		ind.BOR = float64(ind.OccupiedDays) / float64(ind.TotalBeds*int64(periodDays)) * 100
	}
	if ind.TotalDischarges > 0 {
		ind.ALOS = float64(ind.OccupiedDays) / float64(ind.TotalDischarges)
		ind.BTO = float64(ind.TotalDischarges) / float64(ind.TotalBeds)
		if ind.BTO > 0 {
			ind.TOI = (float64(ind.TotalBeds*int64(periodDays)) - float64(ind.OccupiedDays)) / float64(ind.TotalDischarges)
		}
		ind.GDR = float64(ind.TotalDeaths) / float64(ind.TotalDischarges) * 1000
		deathsGe48h := ind.TotalDeaths - ind.DeathsLess48h
		ind.NDR = float64(deathsGe48h) / float64(ind.TotalDischarges) * 1000
	}

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Indikator Rawat Inap")
		sheet := "Indikator Rawat Inap"
		headers := []string{"Indikator", "Nilai", "Standar Depkes"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)

		data := [][]interface{}{
			{"Total Tempat Tidur", ind.TotalBeds, "-"},
			{"Hari Perawatan", ind.OccupiedDays, "-"},
			{"Jumlah Pasien Keluar (Hidup+Meninggal)", ind.TotalDischarges, "-"},
			{"Jumlah Kematian", ind.TotalDeaths, "-"},
			{"BOR (%)", fmt.Sprintf("%.2f%%", ind.BOR), "60-85%"},
			{"ALOS (hari)", fmt.Sprintf("%.2f", ind.ALOS), "6-9 hari"},
			{"BTO (kali)", fmt.Sprintf("%.2f", ind.BTO), "40-50 kali/tahun"},
			{"TOI (hari)", fmt.Sprintf("%.2f", ind.TOI), "1-3 hari"},
			{"GDR (‰)", fmt.Sprintf("%.2f‰", ind.GDR), "≤ 45‰"},
			{"NDR (‰)", fmt.Sprintf("%.2f‰", ind.NDR), "≤ 25‰"},
		}
		for i, d := range data {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), d[0])
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), d[1])
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), d[2])
		}
		f.SetColWidth(sheet, "A", "A", 40)
		f.SetColWidth(sheet, "B", "C", 18)
		SendExcel(c, f, "laporan_indikator_rawat_inap")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ind})
}

// --- D2: Sensus Harian Rawat Inap ---

type InpatientCensusRow struct {
	NamaRuangan string  `json:"nama_ruangan"`
	RoomClass   string  `json:"room_class"`
	TotalBed    int64   `json:"total_bed"`
	Terisi      int64   `json:"terisi"`
	Kosong      int64   `json:"kosong"`
	BOR         float64 `json:"bor"`
}

func ReportInpatientCensus(c *gin.Context) {
	db := database.DB

	var rows []InpatientCensusRow
	db.Raw(`
		SELECT rm.name AS nama_ruangan,
			CASE
				WHEN rm.room_class = 'vvip' THEN 'VVIP'
				WHEN rm.room_class = 'vip' THEN 'VIP'
				WHEN rm.room_class = 'kelas_1' THEN 'Kelas I'
				WHEN rm.room_class = 'kelas_2' THEN 'Kelas II'
				WHEN rm.room_class = 'kelas_3' THEN 'Kelas III'
				ELSE COALESCE(rm.room_class, '-')
			END AS room_class,
			COUNT(DISTINCT bd.id) AS total_bed,
			COUNT(DISTINCT bd.id) FILTER (WHERE bd.status = 'occupied') AS terisi,
			COUNT(DISTINCT bd.id) FILTER (WHERE bd.status = 'available') AS kosong,
			CASE WHEN COUNT(DISTINCT bd.id) > 0
				THEN ROUND(COUNT(DISTINCT bd.id) FILTER (WHERE bd.status = 'occupied')::numeric * 100 / COUNT(DISTINCT bd.id), 2)
				ELSE 0 END AS bor
		FROM rooms rm
		JOIN room_units ru ON ru.room_id = rm.id AND ru.deleted_at IS NULL
		JOIN beds bd ON bd.room_unit_id = ru.id AND bd.deleted_at IS NULL
		WHERE rm.deleted_at IS NULL AND rm.has_bed = true
		GROUP BY rm.name, rm.room_class ORDER BY rm.name
	`).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Sensus Rawat Inap")
		sheet := "Sensus Rawat Inap"
		headers := []string{"Nama Ruangan", "Kelas", "Total Bed", "Terisi", "Kosong", "BOR (%)"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaRuangan)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.RoomClass)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.TotalBed)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Terisi)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Kosong)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.BOR)
		}
		f.SetColWidth(sheet, "A", "A", 25)
		f.SetColWidth(sheet, "B", "B", 12)
		f.SetColWidth(sheet, "C", "F", 12)
		SendExcel(c, f, "laporan_sensus_rawat_inap")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- D3: Daftar Pasien Rawat Inap ---

type InpatientListRow struct {
	NoRM         string `json:"no_rm"`
	NamaPasien   string `json:"nama_pasien"`
	JenisKelamin string `json:"jenis_kelamin"`
	NamaRuangan  string `json:"nama_ruangan"`
	NamaBed      string `json:"nama_bed"`
	DokterDPJP   string `json:"dokter_dpjp"`
	TglMasuk     string `json:"tgl_masuk"`
	TglKeluar    string `json:"tgl_keluar"`
	LOS          int    `json:"los"`
	MetodeBayar  string `json:"metode_bayar"`
	Status       string `json:"status"`
}

func ReportInpatientList(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []InpatientListRow
	db.Raw(`
		SELECT p.no_rm, p.nama_lengkap AS nama_pasien,
			CASE WHEN p.jenis_kelamin = 'L' THEN 'Laki-laki' ELSE 'Perempuan' END AS jenis_kelamin,
			rm.name AS nama_ruangan,
			COALESCE(bd.bed_number, '-') AS nama_bed,
			COALESCE(e.nama_lengkap, '-') AS dokter_dpjp,
			TO_CHAR(v.admission_time, 'YYYY-MM-DD HH24:MI') AS tgl_masuk,
			COALESCE(TO_CHAR(v.discharge_time, 'YYYY-MM-DD HH24:MI'), 'Masih Rawat') AS tgl_keluar,
			v.inpatient_days AS los,
			r.payment_method AS metode_bayar,
			v.status
		FROM visits v
		JOIN registrations r ON r.id = v.registration_id
		JOIN patients p ON p.id = r.patient_id
		JOIN rooms rm ON rm.id = v.room_id
		LEFT JOIN beds bd ON bd.id = v.bed_id
		LEFT JOIN employees e ON e.id = v.doctor_id
		WHERE v.deleted_at IS NULL AND v.visit_type = 'inpatient'
		  AND r.registration_date BETWEEN ? AND ?
		ORDER BY v.admission_time DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Daftar Rawat Inap")
		sheet := "Daftar Rawat Inap"
		headers := []string{"No RM", "Nama Pasien", "JK", "Ruangan", "Bed", "DPJP", "Tgl Masuk", "Tgl Keluar", "LOS", "Bayar", "Status"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NoRM)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaPasien)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.JenisKelamin)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.NamaRuangan)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.NamaBed)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.DokterDPJP)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.TglMasuk)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.TglKeluar)
			f.SetCellValue(sheet, fmt.Sprintf("I%d", r), row.LOS)
			f.SetCellValue(sheet, fmt.Sprintf("J%d", r), row.MetodeBayar)
			f.SetCellValue(sheet, fmt.Sprintf("K%d", r), row.Status)
		}
		f.SetColWidth(sheet, "A", "A", 12)
		f.SetColWidth(sheet, "B", "B", 25)
		f.SetColWidth(sheet, "C", "C", 12)
		f.SetColWidth(sheet, "D", "F", 20)
		f.SetColWidth(sheet, "G", "H", 18)
		f.SetColWidth(sheet, "I", "K", 10)
		SendExcel(c, f, "laporan_daftar_rawat_inap")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- D4: Rekap Rawat Inap Per Ruangan ---

type InpatientByRoomRow struct {
	NamaRuangan  string  `json:"nama_ruangan"`
	RoomClass    string  `json:"room_class"`
	JumlahMasuk  int64   `json:"jumlah_masuk"`
	JumlahKeluar int64   `json:"jumlah_keluar"`
	MasihRawat   int64   `json:"masih_rawat"`
	RataRataLOS  float64 `json:"rata_rata_los"`
}

func ReportInpatientByRoom(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []InpatientByRoomRow
	db.Raw(`
		SELECT rm.name AS nama_ruangan,
			CASE
				WHEN rm.room_class = 'vvip' THEN 'VVIP'
				WHEN rm.room_class = 'vip' THEN 'VIP'
				WHEN rm.room_class = 'kelas_1' THEN 'Kelas I'
				WHEN rm.room_class = 'kelas_2' THEN 'Kelas II'
				WHEN rm.room_class = 'kelas_3' THEN 'Kelas III'
				ELSE COALESCE(rm.room_class, '-')
			END AS room_class,
			COUNT(*) AS jumlah_masuk,
			COUNT(*) FILTER (WHERE v.discharge_time IS NOT NULL) AS jumlah_keluar,
			COUNT(*) FILTER (WHERE v.discharge_time IS NULL AND v.status != 'cancelled') AS masih_rawat,
			COALESCE(AVG(v.inpatient_days) FILTER (WHERE v.discharge_time IS NOT NULL), 0) AS rata_rata_los
		FROM visits v
		JOIN registrations r ON r.id = v.registration_id
		JOIN rooms rm ON rm.id = v.room_id
		WHERE v.deleted_at IS NULL AND v.visit_type = 'inpatient'
		  AND r.registration_date BETWEEN ? AND ?
		GROUP BY rm.name, rm.room_class ORDER BY jumlah_masuk DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Rawat Inap Per Ruangan")
		sheet := "Rawat Inap Per Ruangan"
		headers := []string{"Ruangan", "Kelas", "Masuk", "Keluar", "Masih Rawat", "Rata-rata LOS"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaRuangan)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.RoomClass)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.JumlahMasuk)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.JumlahKeluar)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.MasihRawat)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), fmt.Sprintf("%.1f", row.RataRataLOS))
		}
		f.SetColWidth(sheet, "A", "A", 25)
		f.SetColWidth(sheet, "B", "F", 14)
		SendExcel(c, f, "laporan_rawat_inap_per_ruangan")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
