package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

const billingEffectiveDateSQL = "COALESCE(b.paid_at, b.finalized_at, b.generated_at, b.created_at)"

func billingStatusFilterSQL() string {
	return "b.status IN ('pending', 'partial', 'paid')"
}

func billingPaymentMethodCaseSQL(column string) string {
	return fmt.Sprintf(`
		CASE
			WHEN %s = 'bpjs' THEN 'BPJS'
			WHEN %s = 'cash' THEN 'Umum/Cash'
			WHEN %s = 'insurance' THEN 'Asuransi'
			WHEN %s = 'debit' THEN 'Debit'
			WHEN %s = 'credit' THEN 'Kredit'
			WHEN %s = 'transfer' THEN 'Transfer'
			ELSE COALESCE(%s, 'Lainnya')
		END
	`, column, column, column, column, column, column, column)
}

// ====================================================================
// CATEGORY C: LAPORAN KEUANGAN / BILLING
// ====================================================================

// --- C1: Pendapatan Harian ---

type RevenueRow struct {
	Tanggal       string  `json:"tanggal"`
	TotalTagihan  float64 `json:"total_tagihan"`
	TotalBayar    float64 `json:"total_bayar"`
	TotalPiutang  float64 `json:"total_piutang"`
	JumlahBilling int64   `json:"jumlah_billing"`
}

func ReportDailyRevenue(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []RevenueRow
	db.Raw(fmt.Sprintf(`
		SELECT
			TO_CHAR(%s, 'YYYY-MM-DD') AS tanggal,
			COALESCE(SUM(b.final_amount), 0) AS total_tagihan,
			COALESCE(SUM(b.paid_amount), 0) AS total_bayar,
			COALESCE(SUM(b.remaining_amount), 0) AS total_piutang,
			COUNT(*) AS jumlah_billing
		FROM billings b
		WHERE b.deleted_at IS NULL AND %s
		  AND %s BETWEEN ? AND ?
		GROUP BY tanggal ORDER BY tanggal
	`, billingEffectiveDateSQL, billingStatusFilterSQL(), billingEffectiveDateSQL), dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Pendapatan Harian")
		sheet := "Pendapatan Harian"
		headers := []string{"Tanggal", "Total Tagihan", "Total Bayar", "Total Piutang", "Jumlah Billing"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.TotalTagihan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.TotalBayar)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.TotalPiutang)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.JumlahBilling)
			for col := 2; col <= 4; col++ {
				cell, _ := excelize.CoordinatesToCellName(col, r)
				f.SetCellStyle(sheet, cell, cell, styles.MoneyStyle)
			}
		}
		f.SetColWidth(sheet, "A", "A", 14)
		f.SetColWidth(sheet, "B", "D", 18)
		f.SetColWidth(sheet, "E", "E", 15)
		SendExcel(c, f, "laporan_pendapatan_harian")
		return
	}

	// Add summary
	var summary struct {
		TotalTagihan  float64 `json:"total_tagihan"`
		TotalBayar    float64 `json:"total_bayar"`
		TotalPiutang  float64 `json:"total_piutang"`
		JumlahBilling int64   `json:"jumlah_billing"`
	}
	db.Raw(fmt.Sprintf(`
		SELECT COALESCE(SUM(final_amount),0) AS total_tagihan,
			COALESCE(SUM(paid_amount),0) AS total_bayar,
			COALESCE(SUM(remaining_amount),0) AS total_piutang,
			COUNT(*) AS jumlah_billing
		FROM billings b
		WHERE b.deleted_at IS NULL AND %s
		  AND %s BETWEEN ? AND ?
	`, billingStatusFilterSQL(), billingEffectiveDateSQL), dr.StartDate, dr.EndDate).Scan(&summary)

	c.JSON(http.StatusOK, gin.H{"data": rows, "summary": summary})
}

// --- C2: Pendapatan Per Metode Bayar ---

type RevenueByPaymentRow struct {
	MetodeBayar  string  `json:"metode_bayar"`
	TotalTagihan float64 `json:"total_tagihan"`
	TotalBayar   float64 `json:"total_bayar"`
	Jumlah       int64   `json:"jumlah"`
}

func ReportRevenueByPayment(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []RevenueByPaymentRow
	db.Raw(fmt.Sprintf(`
		SELECT
			%s AS metode_bayar,
			COALESCE(SUM(b.final_amount), 0) AS total_tagihan,
			COALESCE(SUM(b.paid_amount), 0) AS total_bayar,
			COUNT(*) AS jumlah
		FROM billings b
		WHERE b.deleted_at IS NULL AND %s
		  AND %s BETWEEN ? AND ?
		GROUP BY metode_bayar ORDER BY total_bayar DESC
	`, billingPaymentMethodCaseSQL("b.payment_method"), billingStatusFilterSQL(), billingEffectiveDateSQL), dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Pendapatan Per Metode Bayar")
		sheet := "Pendapatan Per Metode Bayar"
		headers := []string{"Metode Bayar", "Total Tagihan", "Total Bayar", "Jumlah"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.MetodeBayar)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.TotalTagihan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.TotalBayar)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Jumlah)
			for col := 2; col <= 3; col++ {
				cell, _ := excelize.CoordinatesToCellName(col, r)
				f.SetCellStyle(sheet, cell, cell, styles.MoneyStyle)
			}
		}
		f.SetColWidth(sheet, "A", "A", 18)
		f.SetColWidth(sheet, "B", "C", 18)
		f.SetColWidth(sheet, "D", "D", 12)
		SendExcel(c, f, "laporan_pendapatan_per_metode_bayar")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- C3: Pendapatan Per Ruangan ---

type RevenueByRoomRow struct {
	NamaRuangan  string  `json:"nama_ruangan"`
	ServiceType  string  `json:"service_type"`
	TotalTagihan float64 `json:"total_tagihan"`
	TotalBayar   float64 `json:"total_bayar"`
	Jumlah       int64   `json:"jumlah"`
}

func ReportRevenueByRoom(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []RevenueByRoomRow
	db.Raw(fmt.Sprintf(`
		SELECT rm.name AS nama_ruangan,
			CASE
				WHEN rm.service_type = 'rawat_jalan' THEN 'Rawat Jalan'
				WHEN rm.service_type = 'rawat_inap' THEN 'Rawat Inap'
				WHEN rm.service_type = 'gawat_darurat' THEN 'Gawat Darurat'
				WHEN rm.service_type = 'penunjang' THEN 'Penunjang'
				ELSE COALESCE(rm.service_type, '-')
			END AS service_type,
			COALESCE(SUM(b.final_amount), 0) AS total_tagihan,
			COALESCE(SUM(b.paid_amount), 0) AS total_bayar,
			COUNT(*) AS jumlah
		FROM billings b
		JOIN visits v ON v.id = b.visit_id
		JOIN rooms rm ON rm.id = v.room_id
		WHERE b.deleted_at IS NULL AND %s
		  AND %s BETWEEN ? AND ?
		GROUP BY rm.name, rm.service_type ORDER BY total_tagihan DESC
	`, billingStatusFilterSQL(), billingEffectiveDateSQL), dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Pendapatan Per Ruangan")
		sheet := "Pendapatan Per Ruangan"
		headers := []string{"Nama Ruangan", "Tipe Layanan", "Total Tagihan", "Total Bayar", "Jumlah"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaRuangan)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.ServiceType)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.TotalTagihan)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.TotalBayar)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Jumlah)
			for col := 3; col <= 4; col++ {
				cell, _ := excelize.CoordinatesToCellName(col, r)
				f.SetCellStyle(sheet, cell, cell, styles.MoneyStyle)
			}
		}
		f.SetColWidth(sheet, "A", "A", 30)
		f.SetColWidth(sheet, "B", "B", 15)
		f.SetColWidth(sheet, "C", "D", 18)
		f.SetColWidth(sheet, "E", "E", 10)
		SendExcel(c, f, "laporan_pendapatan_per_ruangan")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- C4: Pendapatan Per Dokter ---

type RevenueByDoctorRow struct {
	NamaDokter   string  `json:"nama_dokter"`
	Spesialisasi string  `json:"spesialisasi"`
	TotalTagihan float64 `json:"total_tagihan"`
	TotalBayar   float64 `json:"total_bayar"`
	Jumlah       int64   `json:"jumlah"`
}

func ReportRevenueByDoctor(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []RevenueByDoctorRow
	db.Raw(fmt.Sprintf(`
		SELECT e.nama_lengkap AS nama_dokter,
			COALESCE(e.spesialisasi, '-') AS spesialisasi,
			COALESCE(SUM(b.final_amount), 0) AS total_tagihan,
			COALESCE(SUM(b.paid_amount), 0) AS total_bayar,
			COUNT(*) AS jumlah
		FROM billings b
		JOIN visits v ON v.id = b.visit_id
		JOIN employees e ON e.id = v.doctor_id
		WHERE b.deleted_at IS NULL AND %s
		  AND %s BETWEEN ? AND ? AND v.doctor_id IS NOT NULL
		GROUP BY e.nama_lengkap, e.spesialisasi ORDER BY total_tagihan DESC
	`, billingStatusFilterSQL(), billingEffectiveDateSQL), dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Pendapatan Per Dokter")
		sheet := "Pendapatan Per Dokter"
		headers := []string{"Nama Dokter", "Spesialisasi", "Total Tagihan", "Total Bayar", "Jumlah"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaDokter)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Spesialisasi)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.TotalTagihan)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.TotalBayar)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Jumlah)
			for col := 3; col <= 4; col++ {
				cell, _ := excelize.CoordinatesToCellName(col, r)
				f.SetCellStyle(sheet, cell, cell, styles.MoneyStyle)
			}
		}
		f.SetColWidth(sheet, "A", "A", 30)
		f.SetColWidth(sheet, "B", "B", 20)
		f.SetColWidth(sheet, "C", "D", 18)
		f.SetColWidth(sheet, "E", "E", 10)
		SendExcel(c, f, "laporan_pendapatan_per_dokter")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- C5: Piutang Pasien ---

type ReceivablesRow struct {
	BillingNumber string  `json:"billing_number"`
	NamaPasien    string  `json:"nama_pasien"`
	NoRM          string  `json:"no_rm"`
	MetodeBayar   string  `json:"metode_bayar"`
	TotalTagihan  float64 `json:"total_tagihan"`
	TotalBayar    float64 `json:"total_bayar"`
	SisaPiutang   float64 `json:"sisa_piutang"`
	TglBilling    string  `json:"tgl_billing"`
	UmurHari      int     `json:"umur_hari"`
	Status        string  `json:"status"`
}

func ReportReceivables(c *gin.Context) {
	db := database.DB

	var rows []ReceivablesRow
	db.Raw(fmt.Sprintf(`
		SELECT b.billing_number,
			COALESCE(p.nama_lengkap, '-') AS nama_pasien,
			COALESCE(p.no_rm, '-') AS no_rm,
			%s AS metode_bayar,
			b.final_amount AS total_tagihan,
			b.paid_amount AS total_bayar,
			b.remaining_amount AS sisa_piutang,
			TO_CHAR(%s, 'YYYY-MM-DD') AS tgl_billing,
			GREATEST(DATE_PART('day', NOW() - %s), 0)::int AS umur_hari,
			b.status
		FROM billings b
		JOIN registrations r ON r.id = b.registration_id
		JOIN patients p ON p.id = r.patient_id
		WHERE b.deleted_at IS NULL AND b.remaining_amount > 0
		  AND b.status IN ('pending', 'partial')
		ORDER BY b.remaining_amount DESC
	`, billingPaymentMethodCaseSQL("b.payment_method"), billingEffectiveDateSQL, billingEffectiveDateSQL)).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Piutang Pasien")
		sheet := "Piutang Pasien"
		headers := []string{"No Billing", "Nama Pasien", "No RM", "Metode Bayar", "Total Tagihan", "Total Bayar", "Sisa Piutang", "Tgl Billing", "Umur Hari", "Status"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.BillingNumber)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaPasien)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NoRM)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.MetodeBayar)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.TotalTagihan)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.TotalBayar)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.SisaPiutang)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.TglBilling)
			f.SetCellValue(sheet, fmt.Sprintf("I%d", r), row.UmurHari)
			f.SetCellValue(sheet, fmt.Sprintf("J%d", r), row.Status)
			for col := 5; col <= 7; col++ {
				cell, _ := excelize.CoordinatesToCellName(col, r)
				f.SetCellStyle(sheet, cell, cell, styles.MoneyStyle)
			}
		}
		f.SetColWidth(sheet, "A", "A", 20)
		f.SetColWidth(sheet, "B", "B", 25)
		f.SetColWidth(sheet, "C", "D", 14)
		f.SetColWidth(sheet, "E", "G", 18)
		f.SetColWidth(sheet, "H", "J", 14)
		SendExcel(c, f, "laporan_piutang_pasien")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- C6: Rincian Billing Item Per Tipe ---

type BillingItemTypeRow struct {
	ItemType   string  `json:"item_type"`
	Jumlah     int64   `json:"jumlah"`
	TotalNilai float64 `json:"total_nilai"`
}

func ReportBillingByItemType(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []BillingItemTypeRow
	db.Raw(fmt.Sprintf(`
		SELECT
			CASE
				WHEN bi.item_type = 'registration' THEN 'Pendaftaran'
				WHEN bi.item_type = 'procedure' THEN 'Tindakan'
				WHEN bi.item_type = 'radiology' THEN 'Radiologi'
				WHEN bi.item_type = 'laboratory' THEN 'Laboratorium'
				WHEN bi.item_type = 'consultation' THEN 'Konsultasi'
				WHEN bi.item_type = 'medicine' THEN 'Obat'
				WHEN bi.item_type = 'room' THEN 'Kamar'
				ELSE 'Lainnya'
			END AS item_type,
			COUNT(*) AS jumlah,
			COALESCE(SUM(bi.subtotal), 0) AS total_nilai
		FROM billing_items bi
		JOIN billings b ON b.id = bi.billing_id
		WHERE bi.deleted_at IS NULL AND b.deleted_at IS NULL AND %s
		  AND %s BETWEEN ? AND ?
		GROUP BY bi.item_type ORDER BY total_nilai DESC
	`, billingStatusFilterSQL(), billingEffectiveDateSQL), dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Billing Per Tipe")
		sheet := "Billing Per Tipe"
		headers := []string{"Tipe Item", "Jumlah", "Total Nilai"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.ItemType)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.TotalNilai)
			cell, _ := excelize.CoordinatesToCellName(3, r)
			f.SetCellStyle(sheet, cell, cell, styles.MoneyStyle)
		}
		f.SetColWidth(sheet, "A", "A", 18)
		f.SetColWidth(sheet, "B", "B", 12)
		f.SetColWidth(sheet, "C", "C", 18)
		SendExcel(c, f, "laporan_billing_per_tipe")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
