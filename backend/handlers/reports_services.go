package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"

	"github.com/gin-gonic/gin"
)

const serviceReportBaseCTE = `
	billing_map AS (
		SELECT registration_id, MAX(patient_class) AS patient_class
		FROM billings
		WHERE deleted_at IS NULL
		GROUP BY registration_id
	),
	service_events AS (
		SELECT
			COALESCE(vp.performed_at::date, vp.created_at::date) AS event_date,
			p.no_rm AS no_rm,
			p.nama_lengkap AS nama_pasien,
			CASE
				WHEN p.jenis_kelamin = 'L' THEN 'Laki-laki'
				WHEN p.jenis_kelamin = 'P' THEN 'Perempuan'
				ELSE '-'
			END AS jenis_kelamin,
			CASE
				WHEN r.payment_method = 'bpjs' THEN 'BPJS'
				WHEN r.payment_method = 'cash' THEN 'Umum/Cash'
				WHEN r.payment_method = 'insurance' THEN 'Asuransi'
				WHEN r.payment_method = 'debit' THEN 'Debit'
				WHEN r.payment_method = 'credit' THEN 'Kredit'
				WHEN r.payment_method = 'transfer' THEN 'Transfer'
				ELSE COALESCE(r.payment_method, 'Lainnya')
			END AS payment_method,
			CASE
				WHEN COALESCE(bm.patient_class, v.inpatient_class, 'non_kelas') = 'kelas_3' THEN 'Kelas III'
				WHEN COALESCE(bm.patient_class, v.inpatient_class, 'non_kelas') = 'kelas_2' THEN 'Kelas II'
				WHEN COALESCE(bm.patient_class, v.inpatient_class, 'non_kelas') = 'kelas_1' THEN 'Kelas I'
				WHEN COALESCE(bm.patient_class, v.inpatient_class, 'non_kelas') = 'vip' THEN 'VIP'
				WHEN COALESCE(bm.patient_class, v.inpatient_class, 'non_kelas') = 'vvip' THEN 'VVIP'
				WHEN COALESCE(bm.patient_class, v.inpatient_class, 'non_kelas') = 'hcu' THEN 'HCU'
				WHEN COALESCE(bm.patient_class, v.inpatient_class, 'non_kelas') = 'intensif' THEN 'Intensif'
				WHEN COALESCE(bm.patient_class, v.inpatient_class, 'non_kelas') = 'isolasi' THEN 'Isolasi'
				ELSE 'Non Kelas'
			END AS patient_class,
			COALESCE(pr.name, '-') AS tindakan,
			COALESCE(NULLIF(pr.procedure_group, ''), '-') AS kelompok,
			COALESCE(NULLIF(pr.specialty, ''), '-') AS spesialisasi,
			COALESCE(rm.name, '-') AS ruangan,
			COALESCE(e.nama_lengkap, '-') AS dokter,
			CASE
				WHEN COALESCE(pr.service_type, rm.service_type) = 'rawat_jalan' THEN 'Rawat Jalan'
				WHEN COALESCE(pr.service_type, rm.service_type) = 'rawat_inap' THEN 'Rawat Inap'
				WHEN COALESCE(pr.service_type, rm.service_type) = 'gawat_darurat' THEN 'Gawat Darurat'
				WHEN COALESCE(pr.service_type, rm.service_type) = 'penunjang' THEN 'Penunjang Medis'
				WHEN COALESCE(pr.service_type, rm.service_type) = 'farmasi' THEN 'Farmasi'
				ELSE COALESCE(pr.service_type, rm.service_type, '-')
			END AS service_type,
			'Tindakan Langsung' AS sumber,
			COALESCE(vp.status, 'pending') AS status,
			NULL::text AS order_type,
			NULL::timestamp AS scheduled_at
		FROM visit_procedures vp
		JOIN visits v ON v.id = vp.visit_id AND v.deleted_at IS NULL
		JOIN registrations r ON r.id = v.registration_id AND r.deleted_at IS NULL
		JOIN patients p ON p.id = r.patient_id AND p.deleted_at IS NULL
		LEFT JOIN procedures pr ON pr.id = vp.procedure_id AND pr.deleted_at IS NULL
		LEFT JOIN rooms rm ON rm.id = v.room_id AND rm.deleted_at IS NULL
		LEFT JOIN employees e ON e.id = v.doctor_id AND e.deleted_at IS NULL
		LEFT JOIN billing_map bm ON bm.registration_id = r.id
		WHERE vp.deleted_at IS NULL
		  AND COALESCE(vp.performed_at::date, vp.created_at::date) BETWEEN ? AND ?
		  AND COALESCE(vp.status, '') <> 'cancelled'

		UNION ALL

		SELECT
			COALESCE(po.completed_at::date, poi.completed_at::date, po.scheduled_date::date, po.created_at::date) AS event_date,
			p.no_rm AS no_rm,
			p.nama_lengkap AS nama_pasien,
			CASE
				WHEN p.jenis_kelamin = 'L' THEN 'Laki-laki'
				WHEN p.jenis_kelamin = 'P' THEN 'Perempuan'
				ELSE '-'
			END AS jenis_kelamin,
			CASE
				WHEN r.payment_method = 'bpjs' THEN 'BPJS'
				WHEN r.payment_method = 'cash' THEN 'Umum/Cash'
				WHEN r.payment_method = 'insurance' THEN 'Asuransi'
				WHEN r.payment_method = 'debit' THEN 'Debit'
				WHEN r.payment_method = 'credit' THEN 'Kredit'
				WHEN r.payment_method = 'transfer' THEN 'Transfer'
				ELSE COALESCE(r.payment_method, 'Lainnya')
			END AS payment_method,
			CASE
				WHEN COALESCE(bm.patient_class, 'non_kelas') = 'kelas_3' THEN 'Kelas III'
				WHEN COALESCE(bm.patient_class, 'non_kelas') = 'kelas_2' THEN 'Kelas II'
				WHEN COALESCE(bm.patient_class, 'non_kelas') = 'kelas_1' THEN 'Kelas I'
				WHEN COALESCE(bm.patient_class, 'non_kelas') = 'vip' THEN 'VIP'
				WHEN COALESCE(bm.patient_class, 'non_kelas') = 'vvip' THEN 'VVIP'
				WHEN COALESCE(bm.patient_class, 'non_kelas') = 'hcu' THEN 'HCU'
				WHEN COALESCE(bm.patient_class, 'non_kelas') = 'intensif' THEN 'Intensif'
				WHEN COALESCE(bm.patient_class, 'non_kelas') = 'isolasi' THEN 'Isolasi'
				ELSE 'Non Kelas'
			END AS patient_class,
			COALESCE(pr.name, '-') AS tindakan,
			COALESCE(NULLIF(pr.procedure_group, ''), '-') AS kelompok,
			COALESCE(NULLIF(pr.specialty, ''), '-') AS spesialisasi,
			COALESCE(rm.name, '-') AS ruangan,
			COALESCE(sd.nama_lengkap, ob.nama_lengkap, '-') AS dokter,
			CASE
				WHEN po.order_type = 'laboratory' THEN 'Laboratorium'
				WHEN po.order_type = 'radiology' THEN 'Radiologi'
				WHEN po.order_type = 'consultation' THEN 'Konsultasi'
				WHEN po.order_type = 'surgery' THEN 'Operasi'
				ELSE COALESCE(po.order_type, '-')
			END AS service_type,
			CASE
				WHEN po.order_type = 'surgery' THEN 'Order Operasi'
				WHEN po.order_type = 'laboratory' THEN 'Order Laboratorium'
				WHEN po.order_type = 'radiology' THEN 'Order Radiologi'
				WHEN po.order_type = 'consultation' THEN 'Order Konsultasi'
				ELSE 'Order Tindakan'
			END AS sumber,
			COALESCE(poi.status, po.status, 'pending') AS status,
			po.order_type AS order_type,
			po.scheduled_date AS scheduled_at
		FROM procedure_order_items poi
		JOIN procedure_orders po ON po.id = poi.procedure_order_id AND po.deleted_at IS NULL
		JOIN registrations r ON r.id = po.registration_id AND r.deleted_at IS NULL
		JOIN patients p ON p.id = r.patient_id AND p.deleted_at IS NULL
		LEFT JOIN procedures pr ON pr.id = poi.procedure_id AND pr.deleted_at IS NULL
		LEFT JOIN rooms rm ON rm.id = po.target_room_id AND rm.deleted_at IS NULL
		LEFT JOIN employees sd ON sd.id = po.surgeon_doctor_id AND sd.deleted_at IS NULL
		LEFT JOIN employees ob ON ob.id = po.ordered_by_id AND ob.deleted_at IS NULL
		LEFT JOIN billing_map bm ON bm.registration_id = r.id
		WHERE poi.deleted_at IS NULL
		  AND COALESCE(po.completed_at::date, poi.completed_at::date, po.scheduled_date::date, po.created_at::date) BETWEEN ? AND ?
		  AND COALESCE(poi.status, po.status, '') <> 'cancelled'
	)
`

type ServiceVolumePerPatientRow struct {
	NoRM         string `json:"no_rm"`
	NamaPasien   string `json:"nama_pasien"`
	JenisKelamin string `json:"jenis_kelamin"`
	Jumlah       int64  `json:"jumlah"`
	Selesai      int64  `json:"selesai"`
	Terakhir     string `json:"terakhir"`
}

func ReportServiceVolumePerPatient(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []ServiceVolumePerPatientRow
	db.Raw(fmt.Sprintf(`
		WITH %s
		SELECT
			no_rm,
			nama_pasien,
			jenis_kelamin,
			COUNT(*) AS jumlah,
			COUNT(*) FILTER (WHERE status = 'completed') AS selesai,
			TO_CHAR(MAX(event_date), 'YYYY-MM-DD') AS terakhir
		FROM service_events
		GROUP BY no_rm, nama_pasien, jenis_kelamin
		ORDER BY jumlah DESC, nama_pasien ASC
		LIMIT 100
	`, serviceReportBaseCTE), dr.StartDate, dr.EndDate, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Volume Per Pasien")
		sheet := "Volume Per Pasien"
		headers := []string{"No RM", "Pasien", "Jenis Kelamin", "Jumlah", "Selesai", "Terakhir"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NoRM)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaPasien)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.JenisKelamin)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Selesai)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Terakhir)
		}
		f.SetColWidth(sheet, "A", "A", 14)
		f.SetColWidth(sheet, "B", "B", 28)
		f.SetColWidth(sheet, "C", "C", 14)
		f.SetColWidth(sheet, "D", "F", 12)
		SendExcel(c, f, "laporan_layanan_per_pasien")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

type ServiceVolumeSummaryRow struct {
	Tanggal    string `json:"tanggal"`
	Jumlah     int64  `json:"jumlah"`
	Selesai    int64  `json:"selesai"`
	PasienUnik int64  `json:"pasien_unik"`
}

func ReportServiceVolumeSummary(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []ServiceVolumeSummaryRow
	db.Raw(fmt.Sprintf(`
		WITH %s
		SELECT
			TO_CHAR(event_date, 'YYYY-MM-DD') AS tanggal,
			COUNT(*) AS jumlah,
			COUNT(*) FILTER (WHERE status = 'completed') AS selesai,
			COUNT(DISTINCT no_rm) AS pasien_unik
		FROM service_events
		GROUP BY event_date
		ORDER BY event_date
	`, serviceReportBaseCTE), dr.StartDate, dr.EndDate, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Volume Rekap")
		sheet := "Volume Rekap"
		headers := []string{"Tanggal", "Jumlah", "Selesai", "Pasien Unik"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Selesai)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.PasienUnik)
		}
		f.SetColWidth(sheet, "A", "A", 14)
		f.SetColWidth(sheet, "B", "D", 14)
		SendExcel(c, f, "laporan_volume_tindakan_rekap")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

type ServiceByPaymentRow struct {
	PaymentMethod string  `json:"payment_method"`
	Jumlah        int64   `json:"jumlah"`
	Persentase    float64 `json:"persentase"`
}

func ReportServiceByPayment(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []ServiceByPaymentRow
	db.Raw(fmt.Sprintf(`
		WITH %s
		SELECT
			payment_method,
			COUNT(*) AS jumlah,
			ROUND((COUNT(*)::numeric * 100.0) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS persentase
		FROM service_events
		GROUP BY payment_method
		ORDER BY jumlah DESC
	`, serviceReportBaseCTE), dr.StartDate, dr.EndDate, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Layanan Per Cara Bayar")
		sheet := "Layanan Per Cara Bayar"
		headers := []string{"Cara Bayar", "Jumlah", "Persentase"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.PaymentMethod)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Persentase)
		}
		f.SetColWidth(sheet, "A", "A", 20)
		f.SetColWidth(sheet, "B", "C", 14)
		SendExcel(c, f, "laporan_layanan_per_cara_bayar")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

type ServiceByClassRow struct {
	Kelas      string  `json:"kelas"`
	Jumlah     int64   `json:"jumlah"`
	Persentase float64 `json:"persentase"`
}

func ReportServiceByClass(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []ServiceByClassRow
	db.Raw(fmt.Sprintf(`
		WITH %s
		SELECT
			patient_class AS kelas,
			COUNT(*) AS jumlah,
			ROUND((COUNT(*)::numeric * 100.0) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS persentase
		FROM service_events
		GROUP BY patient_class
		ORDER BY jumlah DESC
	`, serviceReportBaseCTE), dr.StartDate, dr.EndDate, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Layanan Per Kelas")
		sheet := "Layanan Per Kelas"
		headers := []string{"Kelas", "Jumlah", "Persentase"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Kelas)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Jumlah)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Persentase)
		}
		f.SetColWidth(sheet, "A", "A", 18)
		f.SetColWidth(sheet, "B", "C", 14)
		SendExcel(c, f, "laporan_layanan_per_kelas")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

type SurgeryPatientRow struct {
	NoRM        string `json:"no_rm"`
	NamaPasien  string `json:"nama_pasien"`
	Tindakan    string `json:"tindakan"`
	DokterBedah string `json:"dokter_bedah"`
	Ruangan     string `json:"ruangan"`
	Jadwal      string `json:"jadwal"`
	Status      string `json:"status"`
}

func ReportServiceSurgeryPatients(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []SurgeryPatientRow
	db.Raw(`
		SELECT
			p.no_rm AS no_rm,
			p.nama_lengkap AS nama_pasien,
			COALESCE(pr.name, '-') AS tindakan,
			COALESCE(sd.nama_lengkap, ob.nama_lengkap, '-') AS dokter_bedah,
			COALESCE(rm.name, '-') AS ruangan,
			TO_CHAR(po.scheduled_date, 'YYYY-MM-DD HH24:MI') AS jadwal,
			COALESCE(poi.status, po.status, 'pending') AS status
		FROM procedure_order_items poi
		JOIN procedure_orders po ON po.id = poi.procedure_order_id AND po.deleted_at IS NULL
		JOIN registrations r ON r.id = po.registration_id AND r.deleted_at IS NULL
		JOIN patients p ON p.id = r.patient_id AND p.deleted_at IS NULL
		LEFT JOIN procedures pr ON pr.id = poi.procedure_id AND pr.deleted_at IS NULL
		LEFT JOIN rooms rm ON rm.id = po.target_room_id AND rm.deleted_at IS NULL
		LEFT JOIN employees sd ON sd.id = po.surgeon_doctor_id AND sd.deleted_at IS NULL
		LEFT JOIN employees ob ON ob.id = po.ordered_by_id AND ob.deleted_at IS NULL
		WHERE poi.deleted_at IS NULL
		  AND po.order_type = 'surgery'
		  AND COALESCE(po.completed_at::date, poi.completed_at::date, po.scheduled_date::date, po.created_at::date) BETWEEN ? AND ?
		ORDER BY po.scheduled_date DESC NULLS LAST, p.nama_lengkap ASC
		LIMIT 100
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Pasien Operasi")
		sheet := "Pasien Operasi"
		headers := []string{"No RM", "Pasien", "Tindakan", "Dokter Bedah", "Ruangan", "Jadwal", "Status"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.NoRM)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.NamaPasien)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Tindakan)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.DokterBedah)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Ruangan)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Jadwal)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", r), row.Status)
		}
		f.SetColWidth(sheet, "A", "A", 14)
		f.SetColWidth(sheet, "B", "D", 24)
		f.SetColWidth(sheet, "E", "G", 18)
		SendExcel(c, f, "laporan_pasien_operasi")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

type SurgeryScheduleRow struct {
	Tanggal string `json:"tanggal"`
	Ruangan string `json:"ruangan"`
	Total   int64  `json:"total"`
	Pending int64  `json:"pending"`
	Selesai int64  `json:"selesai"`
	Batal   int64  `json:"batal"`
}

func ReportServiceSurgerySchedule(c *gin.Context) {
	dr := ParseDateRange(c)
	db := database.DB

	var rows []SurgeryScheduleRow
	db.Raw(`
		SELECT
			TO_CHAR(COALESCE(po.scheduled_date::date, po.created_at::date), 'YYYY-MM-DD') AS tanggal,
			COALESCE(rm.name, '-') AS ruangan,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE COALESCE(poi.status, po.status, 'pending') IN ('pending', 'in_progress')) AS pending,
			COUNT(*) FILTER (WHERE COALESCE(poi.status, po.status, 'pending') = 'completed') AS selesai,
			COUNT(*) FILTER (WHERE COALESCE(poi.status, po.status, 'pending') = 'cancelled') AS batal
		FROM procedure_order_items poi
		JOIN procedure_orders po ON po.id = poi.procedure_order_id AND po.deleted_at IS NULL
		LEFT JOIN rooms rm ON rm.id = po.target_room_id AND rm.deleted_at IS NULL
		WHERE poi.deleted_at IS NULL
		  AND po.order_type = 'surgery'
		  AND COALESCE(po.completed_at::date, poi.completed_at::date, po.scheduled_date::date, po.created_at::date) BETWEEN ? AND ?
		GROUP BY COALESCE(po.scheduled_date::date, po.created_at::date), COALESCE(rm.name, '-')
		ORDER BY tanggal, ruangan
	`, dr.StartDate, dr.EndDate).Scan(&rows)

	if IsExcelExport(c) {
		f, styles, _ := NewExcelFile("Jadwal Operasi")
		sheet := "Jadwal Operasi"
		headers := []string{"Tanggal", "Ruangan", "Total", "Pending", "Selesai", "Batal"}
		WriteExcelHeader(f, sheet, headers, styles.HeaderStyle)
		for i, row := range rows {
			r := i + 2
			f.SetCellValue(sheet, fmt.Sprintf("A%d", r), row.Tanggal)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", r), row.Ruangan)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", r), row.Total)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", r), row.Pending)
			f.SetCellValue(sheet, fmt.Sprintf("E%d", r), row.Selesai)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", r), row.Batal)
		}
		f.SetColWidth(sheet, "A", "A", 14)
		f.SetColWidth(sheet, "B", "B", 24)
		f.SetColWidth(sheet, "C", "F", 12)
		SendExcel(c, f, "laporan_jadwal_operasi")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}
