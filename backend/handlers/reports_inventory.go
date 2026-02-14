package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"

	"github.com/gin-gonic/gin"
)

// ====================================================================
// CATEGORY G: LAPORAN INVENTARIS
// ====================================================================

// --- G1: Stok Obat Per Depo ---

type MedicineStockRow struct {
	NamaDepo    string  `json:"nama_depo"`
	KodeObat    string  `json:"kode_obat"`
	NamaObat    string  `json:"nama_obat"`
	Satuan      string  `json:"satuan"`
	StokSaat    int     `json:"stok_saat_ini"`
	StokMin     int     `json:"stok_min"`
	HargaSatuan float64 `json:"harga_satuan"`
	NilaiStok   float64 `json:"nilai_stok"`
	Status      string  `json:"status"`
}

func ReportMedicineStock(c *gin.Context) {
	db := database.DB
	depo := c.Query("depo") // filter by room name

	query := `
		SELECT rm.name AS nama_depo, m.code AS kode_obat, m.name AS nama_obat,
			m.unit AS satuan, rmm.quantity AS stok_saat_ini,
			rmm.min_quantity AS stok_min,
			m.selling_price AS harga_satuan,
			(rmm.quantity * m.selling_price) AS nilai_stok,
			CASE
				WHEN rmm.quantity <= 0 THEN 'Habis'
				WHEN rmm.quantity <= rmm.min_quantity THEN 'Kurang'
				ELSE 'Cukup'
			END AS status
		FROM room_medicines rmm
		JOIN rooms rm ON rm.id = rmm.room_id
		JOIN medicines m ON m.id = rmm.medicine_id
		WHERE rmm.deleted_at IS NULL AND m.deleted_at IS NULL
	`
	args := []interface{}{}
	if depo != "" {
		query += " AND rm.name ILIKE ?"
		args = append(args, "%"+depo+"%")
	}
	query += " ORDER BY rm.name, m.name"

	var rows []MedicineStockRow
	db.Raw(query, args...).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Stok Obat")
		sheet := "Stok Obat"
		headers := []string{"Depo", "Kode Obat", "Nama Obat", "Satuan", "Stok", "Min", "Harga Satuan", "Nilai Stok", "Status"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaDepo)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.KodeObat)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NamaObat)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Satuan)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.StokSaat)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.StokMin)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.HargaSatuan)
			f.SetCellValue(sheet, fmt.Sprintf("H%d", r), row.NilaiStok)
			f.SetCellValue(sheet, fmt.Sprintf("I%d", r), row.Status)
		}
		f.SetColWidth(sheet, "A", "A", 25)
		f.SetColWidth(sheet, "B", "B", 14)
		f.SetColWidth(sheet, "C", "C", 35)
		f.SetColWidth(sheet, "D", "D", 10)
		f.SetColWidth(sheet, "E", "F", 10)
		f.SetColWidth(sheet, "G", "H", 16)
		f.SetColWidth(sheet, "I", "I", 10)
		SendExcel(c, f, "laporan_stok_obat")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- G2: Obat Kadaluarsa ---

type ExpiredMedicineRow struct {
	KodeObat      string `json:"kode_obat"`
	NamaObat      string `json:"nama_obat"`
	NoBatch       string `json:"no_batch"`
	TglKadaluarsa string `json:"tgl_kadaluarsa"`
	Sisa          int    `json:"sisa"`
	Lokasi        string `json:"lokasi"`
}

func ReportExpiredMedicines(c *gin.Context) {
	db := database.DB

	var rows []ExpiredMedicineRow
	db.Raw(`
		SELECT m.code AS kode_obat, m.name AS nama_obat,
			COALESCE(mb.batch_number, '-') AS no_batch,
			TO_CHAR(mb.expiry_date, 'YYYY-MM-DD') AS tgl_kadaluarsa,
			mb.remaining_qty AS sisa,
			COALESCE(mb.location, '-') AS lokasi
		FROM medicine_batches mb
		JOIN medicines m ON m.id = mb.medicine_id
		WHERE mb.deleted_at IS NULL AND m.deleted_at IS NULL
		  AND mb.expiry_date <= NOW() + INTERVAL '90 days'
		  AND mb.remaining_qty > 0
		ORDER BY mb.expiry_date ASC
	`).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Obat Kadaluarsa")
		sheet := "Obat Kadaluarsa"
		headers := []string{"Kode Obat", "Nama Obat", "No Batch", "Tgl Kadaluarsa", "Sisa Stok", "Lokasi"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.KodeObat)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaObat)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NoBatch)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.TglKadaluarsa)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Sisa)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Lokasi)
		}
		f.SetColWidth(sheet, "A", "A", 14)
		f.SetColWidth(sheet, "B", "B", 35)
		f.SetColWidth(sheet, "C", "D", 16)
		f.SetColWidth(sheet, "E", "E", 10)
		f.SetColWidth(sheet, "F", "F", 25)
		SendExcel(c, f, "laporan_obat_kadaluarsa")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- G3: Stok Inventaris Per Ruangan ---

type InventoryStockRow struct {
	NamaRuangan string `json:"nama_ruangan"`
	KodeBarang  string `json:"kode_barang"`
	NamaBarang  string `json:"nama_barang"`
	Kategori    string `json:"kategori"`
	StokSaat    int    `json:"stok_saat_ini"`
}

func ReportInventoryStock(c *gin.Context) {
	db := database.DB

	var rows []InventoryStockRow
	db.Raw(`
		SELECT rm.name AS nama_ruangan,
			inv.code AS kode_barang, inv.name AS nama_barang,
			inv.category AS kategori,
			COALESCE(ri.quantity, 0) AS stok_saat_ini
		FROM room_inventories ri
		JOIN rooms rm ON rm.id = ri.room_id
		JOIN inventories inv ON inv.id = ri.inventory_id
		WHERE ri.deleted_at IS NULL AND inv.deleted_at IS NULL
		ORDER BY rm.name, inv.name
	`).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Stok Inventaris")
		sheet := "Stok Inventaris"
		headers := []string{"Ruangan", "Kode", "Nama Barang", "Kategori", "Stok"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NamaRuangan)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.KodeBarang)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NamaBarang)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Kategori)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.StokSaat)
		}
		f.SetColWidth(sheet, "A", "A", 25)
		f.SetColWidth(sheet, "B", "B", 14)
		f.SetColWidth(sheet, "C", "C", 35)
		f.SetColWidth(sheet, "D", "D", 15)
		f.SetColWidth(sheet, "E", "E", 10)
		SendExcel(c, f, "laporan_stok_inventaris")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// --- G4: Mutasi Stok Obat ---

type StockMutationRow struct {
	Tanggal    string `json:"tanggal"`
	KodeObat   string `json:"kode_obat"`
	NamaObat   string `json:"nama_obat"`
	Tipe       string `json:"tipe"` // masuk/keluar
	Jumlah     int    `json:"jumlah"`
	Keterangan string `json:"keterangan"`
	NamaDepo   string `json:"nama_depo"`
}

func ReportStockMutations(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []StockMutationRow
	db.Raw(`
		SELECT TO_CHAR(st.created_at, 'YYYY-MM-DD HH24:MI') AS tanggal,
			m.code AS kode_obat, m.name AS nama_obat,
			st.transaction_type AS tipe,
			st.quantity AS jumlah,
			COALESCE(st.reason, st.notes, '-') AS keterangan,
			COALESCE(rm.name, '-') AS nama_depo
		FROM medicine_transactions st
		JOIN medicines m ON m.id = st.medicine_id
		LEFT JOIN rooms rm ON rm.id = st.to_room_id
		WHERE st.deleted_at IS NULL AND st.created_at BETWEEN ? AND ?
		ORDER BY st.created_at DESC
		LIMIT 1000
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Mutasi Stok")
		sheet := "Mutasi Stok"
		headers := []string{"Tanggal", "Kode Obat", "Nama Obat", "Tipe", "Jumlah", "Keterangan", "Depo"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.KodeObat)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.NamaObat)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Tipe)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Keterangan)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.NamaDepo)
		}
		f.SetColWidth(sheet, "A", "A", 18)
		f.SetColWidth(sheet, "B", "B", 14)
		f.SetColWidth(sheet, "C", "C", 35)
		f.SetColWidth(sheet, "D", "D", 12)
		f.SetColWidth(sheet, "E", "E", 10)
		f.SetColWidth(sheet, "F", "F", 30)
		f.SetColWidth(sheet, "G", "G", 25)
		SendExcel(c, f, "laporan_mutasi_stok")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
