package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"

	"github.com/gin-gonic/gin"
)

// ====================================================================
// CATEGORY I: LAPORAN KEMENKES / RL (Rekam Laporan)
// ====================================================================

// --- I1: RL 1.2 – Fasilitas Tempat Tidur ---

type RL12Row struct {
	RuangPerawatan string `json:"ruang_perawatan"`
	Kelas          string `json:"kelas"`
	TotalBed       int64  `json:"total_bed"`
	BedTerisi      int64  `json:"bed_terisi"`
	BedKosong      int64  `json:"bed_kosong"`
	Persentase     string `json:"persentase"`
}

func ReportRL12BedFacility(c *gin.Context) {
	db := database.DB

	var rows []RL12Row
	db.Raw(`
		SELECT r.name AS ruang_perawatan,
			CASE
				WHEN r.room_class = 'vvip' THEN 'VVIP'
				WHEN r.room_class = 'vip' THEN 'VIP'
				WHEN r.room_class = 'kelas_1' THEN 'Kelas I'
				WHEN r.room_class = 'kelas_2' THEN 'Kelas II'
				WHEN r.room_class = 'kelas_3' THEN 'Kelas III'
				ELSE COALESCE(r.room_class, '-')
			END AS kelas,
			COUNT(bd.id) AS total_bed,
			COUNT(bd.id) FILTER (WHERE EXISTS (
				SELECT 1 FROM visits v
				WHERE v.bed_id = bd.id AND v.status = 'in_progress'
				  AND v.visit_type = 'inpatient' AND v.deleted_at IS NULL
			)) AS bed_terisi,
			COUNT(bd.id) - COUNT(bd.id) FILTER (WHERE EXISTS (
				SELECT 1 FROM visits v
				WHERE v.bed_id = bd.id AND v.status = 'in_progress'
				  AND v.visit_type = 'inpatient' AND v.deleted_at IS NULL
			)) AS bed_kosong,
			CASE WHEN COUNT(bd.id) > 0
				THEN ROUND(
					COUNT(bd.id) FILTER (WHERE EXISTS (
						SELECT 1 FROM visits v
						WHERE v.bed_id = bd.id AND v.status = 'in_progress'
						  AND v.visit_type = 'inpatient' AND v.deleted_at IS NULL
					))::numeric * 100 / COUNT(bd.id), 1
				)::text || '%'
				ELSE '0%'
			END AS persentase
		FROM rooms r
		JOIN room_units ru ON ru.room_id = r.id AND ru.deleted_at IS NULL
		JOIN beds bd ON bd.room_unit_id = ru.id AND bd.deleted_at IS NULL
		WHERE r.deleted_at IS NULL AND r.has_bed = true
		GROUP BY r.name, r.room_class
		ORDER BY r.name
	`).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("RL 1.2 Tempat Tidur")
		sheet := "RL 1.2 Tempat Tidur"
		headers := []string{"Ruang Perawatan", "Kelas", "Total TT", "Terisi", "Kosong", "% Terisi"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.RuangPerawatan)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Kelas)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.TotalBed)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.BedTerisi)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.BedKosong)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Persentase)
		}
		f.SetColWidth(sheet, "A", "A", 25)
		f.SetColWidth(sheet, "B", "F", 14)
		SendExcel(c, f, "laporan_rl12_tempat_tidur")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- I2: RL 3.1 – 10 Penyakit Terbesar Rawat Jalan ---

type TopDiseaseRow struct {
	Ranking    int    `json:"ranking"`
	ICD10Code  string `json:"icd10_code"`
	ICD10Name  string `json:"icd10_name"`
	Jumlah     int64  `json:"jumlah"`
	LakiLaki   int64  `json:"laki_laki"`
	Perempuan  int64  `json:"perempuan"`
	BaruLaki   int64  `json:"baru_laki"`
	BaruWanita int64  `json:"baru_wanita"`
	LamaLaki   int64  `json:"lama_laki"`
	LamaWanita int64  `json:"lama_wanita"`
}

func ReportRL31TopDiseasesOutpatient(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []TopDiseaseRow
	db.Raw(`
		SELECT ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS ranking,
			d.icd10_code, d.icd10_name,
			COUNT(*) AS jumlah,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'L') AS laki_laki,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'P') AS perempuan,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'L' AND reg.is_follow_up = false) AS baru_laki,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'P' AND reg.is_follow_up = false) AS baru_wanita,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'L' AND reg.is_follow_up = true) AS lama_laki,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'P' AND reg.is_follow_up = true) AS lama_wanita
		FROM diagnoses d
		JOIN visits v ON v.id = d.visit_id
		JOIN registrations reg ON reg.id = v.registration_id
		JOIN patients p ON p.id = reg.patient_id
		WHERE d.deleted_at IS NULL AND v.deleted_at IS NULL AND reg.deleted_at IS NULL
		  AND reg.registration_type = 'outpatient'
		  AND reg.registration_date BETWEEN ? AND ?
		GROUP BY d.icd10_code, d.icd10_name
		ORDER BY jumlah DESC
		LIMIT 10
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("RL 3.1 Rawat Jalan")
		sheet := "RL 3.1 Rawat Jalan"
		headers := []string{"No", "Kode ICD-10", "Nama Penyakit", "Jumlah", "Laki-laki", "Perempuan", "Baru L", "Baru P", "Lama L", "Lama P"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Ranking)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.ICD10Code)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.ICD10Name)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.LakiLaki)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Perempuan)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.BaruLaki)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.BaruWanita)
			f.SetCellValue(sheet, fmt.Sprintf("I%d", r), row.LamaLaki)
			f.SetCellValue(sheet, fmt.Sprintf("J%d", r), row.LamaWanita)
		}
		f.SetColWidth(sheet, "A", "A", 6)
		f.SetColWidth(sheet, "B", "B", 14)
		f.SetColWidth(sheet, "C", "C", 40)
		f.SetColWidth(sheet, "D", "J", 12)
		SendExcel(c, f, "laporan_rl31_top_diseases_rajal")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- I3: RL 3.2 – 10 Penyakit Terbesar Rawat Inap ---

func ReportRL32TopDiseasesInpatient(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []TopDiseaseRow
	db.Raw(`
		SELECT ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS ranking,
			d.icd10_code, d.icd10_name,
			COUNT(*) AS jumlah,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'L') AS laki_laki,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'P') AS perempuan,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'L' AND reg.is_follow_up = false) AS baru_laki,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'P' AND reg.is_follow_up = false) AS baru_wanita,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'L' AND reg.is_follow_up = true) AS lama_laki,
			COUNT(*) FILTER (WHERE p.jenis_kelamin = 'P' AND reg.is_follow_up = true) AS lama_wanita
		FROM diagnoses d
		JOIN visits v ON v.id = d.visit_id
		JOIN registrations reg ON reg.id = v.registration_id
		JOIN patients p ON p.id = reg.patient_id
		WHERE d.deleted_at IS NULL AND v.deleted_at IS NULL AND reg.deleted_at IS NULL
		  AND reg.registration_type = 'inpatient'
		  AND reg.registration_date BETWEEN ? AND ?
		GROUP BY d.icd10_code, d.icd10_name
		ORDER BY jumlah DESC
		LIMIT 10
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("RL 3.2 Rawat Inap")
		sheet := "RL 3.2 Rawat Inap"
		headers := []string{"No", "Kode ICD-10", "Nama Penyakit", "Jumlah", "Laki-laki", "Perempuan", "Baru L", "Baru P", "Lama L", "Lama P"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Ranking)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.ICD10Code)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.ICD10Name)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.LakiLaki)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Perempuan)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.BaruLaki)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.BaruWanita)
			f.SetCellValue(sheet, fmt.Sprintf("I%d", r), row.LamaLaki)
			f.SetCellValue(sheet, fmt.Sprintf("J%d", r), row.LamaWanita)
		}
		f.SetColWidth(sheet, "A", "A", 6)
		f.SetColWidth(sheet, "B", "B", 14)
		f.SetColWidth(sheet, "C", "C", 40)
		f.SetColWidth(sheet, "D", "J", 12)
		SendExcel(c, f, "laporan_rl32_top_diseases_ranap")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- I4: RL 4A – Kunjungan per Jenis Pelayanan ---

type RL4ARow struct {
	Bulan       string `json:"bulan"`
	RawatJalan  int64  `json:"rawat_jalan"`
	RawatInap   int64  `json:"rawat_inap"`
	IGD         int64  `json:"igd"`
	TotalPasien int64  `json:"total_pasien"`
	PasienBaru  int64  `json:"pasien_baru"`
	PasienLama  int64  `json:"pasien_lama"`
}

func ReportRL4AVisitsByType(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []RL4ARow
	db.Raw(`
		SELECT TO_CHAR(r.registration_date, 'YYYY-MM') AS bulan,
			COUNT(*) FILTER (WHERE r.registration_type = 'outpatient') AS rawat_jalan,
			COUNT(*) FILTER (WHERE r.registration_type = 'inpatient') AS rawat_inap,
			COUNT(*) FILTER (WHERE r.registration_type = 'emergency') AS igd,
			COUNT(*) AS total_pasien,
			COUNT(*) FILTER (WHERE r.is_follow_up = false) AS pasien_baru,
			COUNT(*) FILTER (WHERE r.is_follow_up = true) AS pasien_lama
		FROM registrations r
		WHERE r.deleted_at IS NULL
		  AND r.registration_date BETWEEN ? AND ?
		  AND r.status NOT IN ('cancelled')
		GROUP BY TO_CHAR(r.registration_date, 'YYYY-MM')
		ORDER BY bulan
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("RL 4A Kunjungan")
		sheet := "RL 4A Kunjungan"
		headers := []string{"Bulan", "Rawat Jalan", "Rawat Inap", "IGD", "Total", "Pasien Baru", "Pasien Lama"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Bulan)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.RawatJalan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.RawatInap)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.IGD)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.TotalPasien)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.PasienBaru)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.PasienLama)
		}
		f.SetColWidth(sheet, "A", "A", 14)
		f.SetColWidth(sheet, "B", "G", 14)
		SendExcel(c, f, "laporan_rl4a_kunjungan")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- I5: RL 5.1 – Ketenagaan (Jumlah Pegawai per Jenis) ---

type RL51Row struct {
	TipeKaryawan string `json:"tipe_karyawan"`
	PNS          int64  `json:"pns"`
	Kontrak      int64  `json:"kontrak"`
	Honorer      int64  `json:"honorer"`
	Magang       int64  `json:"magang"`
	Lainnya      int64  `json:"lainnya"`
	Total        int64  `json:"total"`
}

func ReportRL51Workforce(c *gin.Context) {
	db := database.DB

	var rows []RL51Row
	db.Raw(`
		SELECT e.tipe_karyawan,
			COUNT(*) FILTER (WHERE e.status_kepegawaian = 'PNS') AS pns,
			COUNT(*) FILTER (WHERE e.status_kepegawaian = 'Kontrak') AS kontrak,
			COUNT(*) FILTER (WHERE e.status_kepegawaian = 'Honorer') AS honorer,
			COUNT(*) FILTER (WHERE e.status_kepegawaian = 'Magang') AS magang,
			COUNT(*) FILTER (WHERE e.status_kepegawaian NOT IN ('PNS','Kontrak','Honorer','Magang')) AS lainnya,
			COUNT(*) AS total
		FROM employees e
		WHERE e.deleted_at IS NULL AND e.tanggal_keluar IS NULL
		GROUP BY e.tipe_karyawan
		ORDER BY total DESC
	`).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("RL 5.1 Ketenagaan")
		sheet := "RL 5.1 Ketenagaan"
		headers := []string{"Tipe Karyawan", "PNS", "Kontrak", "Honorer", "Magang", "Lainnya", "Total"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.TipeKaryawan)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.PNS)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Kontrak)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Honorer)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Magang)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Lainnya)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.Total)
		}
		f.SetColWidth(sheet, "A", "A", 22)
		f.SetColWidth(sheet, "B", "G", 12)
		SendExcel(c, f, "laporan_rl51_ketenagaan")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- I6: Indikator Mutu Pelayanan ---

type QualityIndicatorRow struct {
	Indikator string `json:"indikator"`
	Nilai     string `json:"nilai"`
	Standar   string `json:"standar"`
	Status    string `json:"status"`
}

func ReportQualityIndicators(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	type Stats struct {
		TotalRanap        int64 `json:"total_ranap"`
		TotalHariRawat    int64 `json:"total_hari_rawat"`
		TotalBed          int64 `json:"total_bed"`
		PasienMeninggal48 int64 `json:"pasien_meninggal_48"`
		PasienMeninggalGT int64 `json:"pasien_meninggal_gt"`
		TotalMeninggal    int64 `json:"total_meninggal"`
		PasienKembali     int64 `json:"pasien_kembali"`
	}

	var stats Stats
	periodDays := int(dr.EndDate.Sub(dr.StartDate).Hours()/24) + 1

	// Total bed
	db.Raw(`SELECT COUNT(*) FROM beds bd JOIN room_units ru ON ru.id = bd.room_unit_id JOIN rooms r ON r.id = ru.room_id WHERE r.deleted_at IS NULL AND ru.deleted_at IS NULL AND bd.deleted_at IS NULL AND r.has_bed = true`).Scan(&stats.TotalBed)

	// Inpatient stats
	db.Raw(`
		SELECT
			COUNT(*) AS total_ranap,
			COALESCE(SUM(GREATEST(v.inpatient_days, 1)), 0) AS total_hari_rawat,
			COUNT(*) FILTER (WHERE dp.discharge_condition = 'meninggal_lt_48' OR dp.disposition_type = 'meninggal' AND EXTRACT(EPOCH FROM (v.discharge_time - v.admission_time)) / 3600 < 48) AS pasien_meninggal_48,
			COUNT(*) FILTER (WHERE dp.discharge_condition = 'meninggal_gt_48' OR dp.disposition_type = 'meninggal' AND EXTRACT(EPOCH FROM (v.discharge_time - v.admission_time)) / 3600 >= 48) AS pasien_meninggal_gt,
			COUNT(*) FILTER (WHERE dp.disposition_type = 'meninggal' OR dp.discharge_condition IN ('meninggal_lt_48','meninggal_gt_48')) AS total_meninggal
		FROM visits v
		JOIN registrations r ON r.id = v.registration_id
		LEFT JOIN dispositions dp ON dp.visit_id = v.id AND dp.deleted_at IS NULL
		WHERE v.deleted_at IS NULL AND r.deleted_at IS NULL
		  AND v.visit_type = 'inpatient'
		  AND r.registration_date BETWEEN ? AND ?
	`, dr.StartDate, dr.EndDate).Scan(&stats)

	// Build indicators
	var indicators []QualityIndicatorRow

	// BOR
	bor := float64(0)
	if stats.TotalBed > 0 && periodDays > 0 {
		bor = float64(stats.TotalHariRawat) / (float64(stats.TotalBed) * float64(periodDays)) * 100
	}
	borStatus := "Kurang"
	if bor >= 60 && bor <= 85 {
		borStatus = "Ideal"
	} else if bor > 85 {
		borStatus = "Tinggi"
	}
	indicators = append(indicators, QualityIndicatorRow{"BOR (Bed Occupancy Rate)", fmt.Sprintf("%.1f%%", bor), "60-85%", borStatus})

	// ALOS
	alos := float64(0)
	if stats.TotalRanap > 0 {
		alos = float64(stats.TotalHariRawat) / float64(stats.TotalRanap)
	}
	alosStatus := "Ideal"
	if alos > 9 || (alos > 0 && alos < 3) {
		alosStatus = "Kurang"
	}
	indicators = append(indicators, QualityIndicatorRow{"ALOS (Average Length of Stay)", fmt.Sprintf("%.1f hari", alos), "6-9 hari", alosStatus})

	// BTO
	bto := float64(0)
	if stats.TotalBed > 0 {
		bto = float64(stats.TotalRanap) / float64(stats.TotalBed)
	}
	btoStatus := "Ideal"
	if bto < 40 || bto > 50 {
		btoStatus = "Kurang"
	}
	indicators = append(indicators, QualityIndicatorRow{"BTO (Bed Turn Over)", fmt.Sprintf("%.1f kali", bto), "40-50 kali", btoStatus})

	// TOI
	toi := float64(0)
	if stats.TotalRanap > 0 && bto > 0 {
		toi = (float64(stats.TotalBed)*float64(periodDays) - float64(stats.TotalHariRawat)) / float64(stats.TotalRanap)
	}
	toiStatus := "Ideal"
	if toi < 1 || toi > 3 {
		toiStatus = "Kurang"
	}
	indicators = append(indicators, QualityIndicatorRow{"TOI (Turn Over Interval)", fmt.Sprintf("%.1f hari", toi), "1-3 hari", toiStatus})

	// GDR
	gdr := float64(0)
	if stats.TotalRanap > 0 {
		gdr = float64(stats.TotalMeninggal) / float64(stats.TotalRanap) * 1000
	}
	gdrStatus := "Ideal"
	if gdr > 45 {
		gdrStatus = "Tinggi"
	}
	indicators = append(indicators, QualityIndicatorRow{"GDR (Gross Death Rate)", fmt.Sprintf("%.1f ‰", gdr), "≤ 45 ‰", gdrStatus})

	// NDR
	ndr := float64(0)
	if stats.TotalRanap > 0 {
		ndr = float64(stats.PasienMeninggalGT) / float64(stats.TotalRanap) * 1000
	}
	ndrStatus := "Ideal"
	if ndr > 25 {
		ndrStatus = "Tinggi"
	}
	indicators = append(indicators, QualityIndicatorRow{"NDR (Net Death Rate)", fmt.Sprintf("%.1f ‰", ndr), "≤ 25 ‰", ndrStatus})

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Indikator Mutu")
		sheet := "Indikator Mutu"
		headers := []string{"Indikator", "Nilai", "Standar", "Status"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range indicators {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Indikator)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Nilai)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Standar)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Status)
		}
		f.SetColWidth(sheet, "A", "A", 35)
		f.SetColWidth(sheet, "B", "D", 16)
		SendExcel(c, f, "laporan_indikator_mutu")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": indicators})
}
