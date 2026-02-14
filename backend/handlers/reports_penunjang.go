package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"

	"github.com/gin-gonic/gin"
)

// ====================================================================
// CATEGORY F: LAPORAN PENUNJANG (Lab & Radiologi)
// ====================================================================

// --- F1: Order Penunjang Harian ---

type PenunjangDailyRow struct {
	Tanggal      string `json:"tanggal"`
	TotalOrder   int64  `json:"total_order"`
	Laboratorium int64  `json:"laboratorium"`
	Radiologi    int64  `json:"radiologi"`
	Konsultasi   int64  `json:"konsultasi"`
	Operasi      int64  `json:"operasi"`
	Completed    int64  `json:"completed"`
	Pending      int64  `json:"pending"`
}

func ReportPenunjangDaily(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []PenunjangDailyRow
	db.Raw(`
		SELECT
			TO_CHAR(po.created_at, 'YYYY-MM-DD') AS tanggal,
			COUNT(*) AS total_order,
			COUNT(*) FILTER (WHERE po.order_type = 'laboratory') AS laboratorium,
			COUNT(*) FILTER (WHERE po.order_type = 'radiology') AS radiologi,
			COUNT(*) FILTER (WHERE po.order_type = 'consultation') AS konsultasi,
			COUNT(*) FILTER (WHERE po.order_type = 'surgery') AS operasi,
			COUNT(*) FILTER (WHERE po.status = 'completed') AS completed,
			COUNT(*) FILTER (WHERE po.status IN ('pending','in_progress')) AS pending
		FROM procedure_orders po
		WHERE po.deleted_at IS NULL AND po.created_at BETWEEN ? AND ?
		GROUP BY tanggal ORDER BY tanggal
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Order Penunjang Harian")
		sheet := "Order Penunjang Harian"
		headers := []string{"Tanggal", "Total", "Lab", "Radiologi", "Konsultasi", "Operasi", "Selesai", "Pending"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.TotalOrder)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Laboratorium)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Radiologi)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Konsultasi)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Operasi)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.Completed)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.Pending)
		}
		f.SetColWidth(sheet, "A", "H", 14)
		SendExcel(c, f, "laporan_penunjang_harian")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- F2: Pemeriksaan Lab Terbanyak ---

type TopLabRow struct {
	NamaPemeriksaan string `json:"nama_pemeriksaan"`
	Jumlah          int64  `json:"jumlah"`
	Completed       int64  `json:"completed"`
}

func ReportTopLabExams(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB
	limit := c.DefaultQuery("limit", "20")

	var rows []TopLabRow
	db.Raw(`
		SELECT pr.name AS nama_pemeriksaan,
			COUNT(*) AS jumlah,
			COUNT(*) FILTER (WHERE poi.status = 'completed') AS completed
		FROM procedure_order_items poi
		JOIN procedure_orders po ON po.id = poi.procedure_order_id
		JOIN procedures pr ON pr.id = poi.procedure_id
		WHERE poi.deleted_at IS NULL AND po.deleted_at IS NULL
		  AND po.order_type = 'laboratory'
		  AND po.created_at BETWEEN ? AND ?
		GROUP BY pr.name ORDER BY jumlah DESC LIMIT ?
	`, dr.StartDate, dr.EndDate, limit).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Lab Terbanyak")
		sheet := "Lab Terbanyak"
		headers := []string{"No", "Nama Pemeriksaan", "Jumlah", "Selesai"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), i+1)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaPemeriksaan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Completed)
		}
		f.SetColWidth(sheet, "A", "A", 5)
		f.SetColWidth(sheet, "B", "B", 40)
		f.SetColWidth(sheet, "C", "D", 12)
		SendExcel(c, f, "laporan_lab_terbanyak")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- F3: Pemeriksaan Radiologi Terbanyak ---

func ReportTopRadiologyExams(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB
	limit := c.DefaultQuery("limit", "20")

	var rows []TopLabRow // Reuse same struct
	db.Raw(`
		SELECT pr.name AS nama_pemeriksaan,
			COUNT(*) AS jumlah,
			COUNT(*) FILTER (WHERE poi.status = 'completed') AS completed
		FROM procedure_order_items poi
		JOIN procedure_orders po ON po.id = poi.procedure_order_id
		JOIN procedures pr ON pr.id = poi.procedure_id
		WHERE poi.deleted_at IS NULL AND po.deleted_at IS NULL
		  AND po.order_type = 'radiology'
		  AND po.created_at BETWEEN ? AND ?
		GROUP BY pr.name ORDER BY jumlah DESC LIMIT ?
	`, dr.StartDate, dr.EndDate, limit).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Radiologi Terbanyak")
		sheet := "Radiologi Terbanyak"
		headers := []string{"No", "Nama Pemeriksaan", "Jumlah", "Selesai"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), i+1)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaPemeriksaan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Completed)
		}
		f.SetColWidth(sheet, "A", "A", 5)
		f.SetColWidth(sheet, "B", "B", 40)
		f.SetColWidth(sheet, "C", "D", 12)
		SendExcel(c, f, "laporan_radiologi_terbanyak")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- F4: Hasil Kritis ---

type CriticalResultRow struct {
	Tanggal         string `json:"tanggal"`
	NamaPasien      string `json:"nama_pasien"`
	NamaPemeriksaan string `json:"nama_pemeriksaan"`
	Hasil           string `json:"hasil"`
	OrderType       string `json:"order_type"`
	NamaRuangan     string `json:"nama_ruangan"`
	NamaDokter      string `json:"nama_dokter"`
}

func ReportCriticalResults(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []CriticalResultRow
	db.Raw(`
		SELECT TO_CHAR(po.completed_at, 'YYYY-MM-DD HH24:MI') AS tanggal,
			p.nama_lengkap AS nama_pasien,
			pr.name AS nama_pemeriksaan,
			COALESCE(por.value, '-') AS hasil,
			po.order_type,
			rm.name AS nama_ruangan,
			COALESCE(e.nama_lengkap, '-') AS nama_dokter
		FROM procedure_order_results por
		JOIN procedure_order_items poi ON poi.id = por.procedure_order_item_id
		JOIN procedure_orders po ON po.id = poi.procedure_order_id
		JOIN procedures pr ON pr.id = poi.procedure_id
		JOIN registrations r ON r.id = po.registration_id
		JOIN patients p ON p.id = r.patient_id
		LEFT JOIN rooms rm ON rm.id = po.target_room_id
		LEFT JOIN employees e ON e.id = po.ordered_by_id
		WHERE por.deleted_at IS NULL AND poi.deleted_at IS NULL AND po.deleted_at IS NULL
		  AND (por.is_critical = true OR po.is_critical = true)
		  AND po.created_at BETWEEN ? AND ?
		ORDER BY po.completed_at DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Hasil Kritis")
		sheet := "Hasil Kritis"
		headers := []string{"Tanggal", "Nama Pasien", "Pemeriksaan", "Hasil", "Tipe", "Ruangan", "Dokter"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaPasien)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NamaPemeriksaan)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Hasil)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.OrderType)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.NamaRuangan)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.NamaDokter)
		}
		f.SetColWidth(sheet, "A", "A", 18)
		f.SetColWidth(sheet, "B", "B", 25)
		f.SetColWidth(sheet, "C", "C", 30)
		f.SetColWidth(sheet, "D", "D", 20)
		f.SetColWidth(sheet, "E", "G", 18)
		SendExcel(c, f, "laporan_hasil_kritis")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- F5: Waktu Tunggu Penunjang (TAT) ---

type PenunjangTATRow struct {
	OrderType   string  `json:"order_type"`
	NamaRuangan string  `json:"nama_ruangan"`
	AvgTATMenit float64 `json:"avg_tat_menit"`
	MinTATMenit float64 `json:"min_tat_menit"`
	MaxTATMenit float64 `json:"max_tat_menit"`
	JumlahOrder int64   `json:"jumlah_order"`
}

func ReportPenunjangTAT(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []PenunjangTATRow
	db.Raw(`
		SELECT po.order_type,
			rm.name AS nama_ruangan,
			ROUND(AVG(EXTRACT(EPOCH FROM (po.completed_at - po.created_at)) / 60)::numeric, 1) AS avg_tat_menit,
			ROUND(MIN(EXTRACT(EPOCH FROM (po.completed_at - po.created_at)) / 60)::numeric, 1) AS min_tat_menit,
			ROUND(MAX(EXTRACT(EPOCH FROM (po.completed_at - po.created_at)) / 60)::numeric, 1) AS max_tat_menit,
			COUNT(*) AS jumlah_order
		FROM procedure_orders po
		JOIN rooms rm ON rm.id = po.target_room_id
		WHERE po.deleted_at IS NULL AND po.completed_at IS NOT NULL
		  AND po.created_at BETWEEN ? AND ?
		GROUP BY po.order_type, rm.name ORDER BY po.order_type, avg_tat_menit
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("TAT Penunjang")
		sheet := "TAT Penunjang"
		headers := []string{"Tipe Order", "Ruangan", "Rata-rata (menit)", "Tercepat (menit)", "Terlama (menit)", "Jumlah"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.OrderType)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaRuangan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.AvgTATMenit)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.MinTATMenit)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.MaxTATMenit)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.JumlahOrder)
		}
		f.SetColWidth(sheet, "A", "A", 14)
		f.SetColWidth(sheet, "B", "B", 25)
		f.SetColWidth(sheet, "C", "F", 18)
		SendExcel(c, f, "laporan_tat_penunjang")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
