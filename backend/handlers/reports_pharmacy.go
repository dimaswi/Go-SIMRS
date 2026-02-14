package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"

	"github.com/gin-gonic/gin"
)

// ====================================================================
// CATEGORY E: LAPORAN FARMASI
// ====================================================================

// --- E1: Resep Harian ---

type PharmacyDailyRow struct {
	Tanggal    string `json:"tanggal"`
	TotalResep int64  `json:"total_resep"`
	Pending    int64  `json:"pending"`
	Disiapkan  int64  `json:"disiapkan"`
	Diserahkan int64  `json:"diserahkan"`
	Dibatalkan int64  `json:"dibatalkan"`
	Racikan    int64  `json:"racikan"`
	NonRacikan int64  `json:"non_racikan"`
}

func ReportPharmacyDaily(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []PharmacyDailyRow
	db.Raw(`
		SELECT
			TO_CHAR(mo.created_at, 'YYYY-MM-DD') AS tanggal,
			COUNT(*) AS total_resep,
			COUNT(*) FILTER (WHERE mo.status = 'pending') AS pending,
			COUNT(*) FILTER (WHERE mo.status IN ('preparing','ready')) AS disiapkan,
			COUNT(*) FILTER (WHERE mo.status = 'delivered') AS diserahkan,
			COUNT(*) FILTER (WHERE mo.status = 'cancelled') AS dibatalkan,
			COUNT(*) FILTER (WHERE mo.prescription_type = 'racikan') AS racikan,
			COUNT(*) FILTER (WHERE mo.prescription_type != 'racikan') AS non_racikan
		FROM medicine_orders mo
		WHERE mo.deleted_at IS NULL AND mo.created_at BETWEEN ? AND ?
		GROUP BY tanggal ORDER BY tanggal
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Resep Harian")
		sheet := "Resep Harian"
		headers := []string{"Tanggal", "Total Resep", "Pending", "Disiapkan", "Diserahkan", "Dibatalkan", "Racikan", "Non-Racikan"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.TotalResep)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Pending)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Disiapkan)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Diserahkan)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Dibatalkan)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.Racikan)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.NonRacikan)
		}
		f.SetColWidth(sheet, "A", "H", 14)
		SendExcel(c, f, "laporan_resep_harian")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- E2: Obat Terbanyak Diresepkan ---

type TopMedicineRow struct {
	KodeObat  string `json:"kode_obat"`
	NamaObat  string `json:"nama_obat"`
	Satuan    string `json:"satuan"`
	JumlahQty int64  `json:"jumlah_qty"`
	JumlahRx  int64  `json:"jumlah_rx"`
}

func ReportTopMedicines(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB
	limit := c.DefaultQuery("limit", "30")

	var rows []TopMedicineRow
	db.Raw(`
		SELECT m.code AS kode_obat, m.name AS nama_obat, m.unit AS satuan,
			COALESCE(SUM(moi.quantity), 0) AS jumlah_qty,
			COUNT(DISTINCT moi.medicine_order_id) AS jumlah_rx
		FROM medicine_order_items moi
		JOIN medicines m ON m.id = moi.medicine_id
		JOIN medicine_orders mo ON mo.id = moi.medicine_order_id
		WHERE moi.deleted_at IS NULL AND mo.deleted_at IS NULL
		  AND mo.created_at BETWEEN ? AND ?
		  AND moi.status != 'cancelled'
		GROUP BY m.code, m.name, m.unit
		ORDER BY jumlah_qty DESC
		LIMIT ?
	`, dr.StartDate, dr.EndDate, limit).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Obat Terbanyak")
		sheet := "Obat Terbanyak"
		headers := []string{"No", "Kode Obat", "Nama Obat", "Satuan", "Jumlah Diresepkan", "Jumlah Resep"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), i+1)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.KodeObat)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NamaObat)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Satuan)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.JumlahQty)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.JumlahRx)
		}
		f.SetColWidth(sheet, "A", "A", 5)
		f.SetColWidth(sheet, "B", "B", 14)
		f.SetColWidth(sheet, "C", "C", 40)
		f.SetColWidth(sheet, "D", "D", 10)
		f.SetColWidth(sheet, "E", "F", 18)
		SendExcel(c, f, "laporan_obat_terbanyak")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- E3: Resep Per Dokter ---

type PharmacyByDoctorRow struct {
	NamaDokter   string `json:"nama_dokter"`
	Spesialisasi string `json:"spesialisasi"`
	JumlahResep  int64  `json:"jumlah_resep"`
	JumlahItem   int64  `json:"jumlah_item"`
}

func ReportPharmacyByDoctor(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []PharmacyByDoctorRow
	db.Raw(`
		SELECT e.nama_lengkap AS nama_dokter,
			COALESCE(e.spesialisasi, '-') AS spesialisasi,
			COUNT(DISTINCT mo.id) AS jumlah_resep,
			COUNT(moi.id) AS jumlah_item
		FROM medicine_orders mo
		JOIN employees e ON e.id = mo.prescriber_id
		LEFT JOIN medicine_order_items moi ON moi.medicine_order_id = mo.id AND moi.deleted_at IS NULL
		WHERE mo.deleted_at IS NULL AND mo.created_at BETWEEN ? AND ?
		GROUP BY e.nama_lengkap, e.spesialisasi
		ORDER BY jumlah_resep DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Resep Per Dokter")
		sheet := "Resep Per Dokter"
		headers := []string{"Nama Dokter", "Spesialisasi", "Jumlah Resep", "Jumlah Item"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaDokter)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Spesialisasi)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.JumlahResep)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.JumlahItem)
		}
		f.SetColWidth(sheet, "A", "A", 30)
		f.SetColWidth(sheet, "B", "B", 20)
		f.SetColWidth(sheet, "C", "D", 14)
		SendExcel(c, f, "laporan_resep_per_dokter")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- E4: Resep Per Depo Farmasi ---

type PharmacyByDepoRow struct {
	NamaDepo    string `json:"nama_depo"`
	JumlahResep int64  `json:"jumlah_resep"`
	Delivered   int64  `json:"delivered"`
	Pending     int64  `json:"pending"`
}

func ReportPharmacyByDepo(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []PharmacyByDepoRow
	db.Raw(`
		SELECT rm.name AS nama_depo,
			COUNT(*) AS jumlah_resep,
			COUNT(*) FILTER (WHERE mo.status = 'delivered') AS delivered,
			COUNT(*) FILTER (WHERE mo.status IN ('pending','preparing','ready')) AS pending
		FROM medicine_orders mo
		JOIN rooms rm ON rm.id = mo.pharmacy_room_id
		WHERE mo.deleted_at IS NULL AND mo.created_at BETWEEN ? AND ?
		GROUP BY rm.name ORDER BY jumlah_resep DESC
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Resep Per Depo")
		sheet := "Resep Per Depo"
		headers := []string{"Nama Depo", "Jumlah Resep", "Diserahkan", "Pending"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaDepo)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.JumlahResep)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Delivered)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Pending)
		}
		f.SetColWidth(sheet, "A", "A", 30)
		f.SetColWidth(sheet, "B", "D", 14)
		SendExcel(c, f, "laporan_resep_per_depo")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- E5: Waktu Tunggu Farmasi (TAT) ---

type PharmacyTATRow struct {
	NamaDepo    string  `json:"nama_depo"`
	AvgTATMenit float64 `json:"avg_tat_menit"`
	MinTATMenit float64 `json:"min_tat_menit"`
	MaxTATMenit float64 `json:"max_tat_menit"`
	JumlahResep int64   `json:"jumlah_resep"`
}

func ReportPharmacyTAT(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []PharmacyTATRow
	db.Raw(`
		SELECT rm.name AS nama_depo,
			ROUND(AVG(EXTRACT(EPOCH FROM (mo.delivered_at - mo.created_at)) / 60)::numeric, 1) AS avg_tat_menit,
			ROUND(MIN(EXTRACT(EPOCH FROM (mo.delivered_at - mo.created_at)) / 60)::numeric, 1) AS min_tat_menit,
			ROUND(MAX(EXTRACT(EPOCH FROM (mo.delivered_at - mo.created_at)) / 60)::numeric, 1) AS max_tat_menit,
			COUNT(*) AS jumlah_resep
		FROM medicine_orders mo
		JOIN rooms rm ON rm.id = mo.pharmacy_room_id
		WHERE mo.deleted_at IS NULL AND mo.delivered_at IS NOT NULL
		  AND mo.created_at BETWEEN ? AND ?
		GROUP BY rm.name ORDER BY avg_tat_menit
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("TAT Farmasi")
		sheet := "TAT Farmasi"
		headers := []string{"Depo Farmasi", "Rata-rata (menit)", "Tercepat (menit)", "Terlama (menit)", "Jumlah Resep"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaDepo)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.AvgTATMenit)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.MinTATMenit)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.MaxTATMenit)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.JumlahResep)
		}
		f.SetColWidth(sheet, "A", "A", 25)
		f.SetColWidth(sheet, "B", "E", 18)
		SendExcel(c, f, "laporan_tat_farmasi")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
