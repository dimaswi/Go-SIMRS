package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
)

func PrintGeneralConsentInpatient(c *gin.Context) {
	printGeneralConsentInpatientImpl(c, false)
}

func printGeneralConsentInpatientImpl(c *gin.Context, isRMDup bool) {
	var id string
	var docType string
	var parsedID uint

	if isRMDup {
		id = c.Param("rmDuplicateId")
		docType = "rm_dup_general_consent_inpatient"
	} else {
		id = c.Param("visitId")
		docType = "general_consent_inpatient"
	}

	pid, _ := strconv.ParseUint(id, 10, 32)
	parsedID = uint(pid)

	if pdfData, fileName, found := getCachedPDF(docType, parsedID); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	var visit models.Visit
	if isRMDup {
		var rmDup models.EKlaimRMDuplicate
		if err := database.DB.First(&rmDup, parsedID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "RMDuplicate tidak ditemukan"})
			return
		}
		if err := database.DB.Preload("Registration.Patient").Preload("Room").Preload("Doctor").First(&visit, rmDup.VisitID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
			return
		}
	} else {
		if err := database.DB.Preload("Registration.Patient").Preload("Room").Preload("Doctor").First(&visit, parsedID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
			return
		}
	}

	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 15)
	
	// Page 1
	pdf.AddPage()
	addHeader(pdf, hospitalInfo, "PERSETUJUAN UMUM (GENERAL CONSENT)", "RM-03")

	// Box Patient Info
	addPatientInfoTable(pdf, visit.Registration.Patient, &visit)

	var gci models.GeneralConsentInpatient
	database.DB.Where("visit_id = ?", visit.ID).First(&gci)

	pdf.Ln(4)

	// Data Penanggung Jawab Box
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(220, 220, 220)
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.3)
	
	contentWidth := 180.0 // approx A4 width minus margins (210 - 15 - 15)
	col1 := 40.0
	col2 := 50.0
	col3 := 35.0
	col4 := 55.0
	rowHeight := 6.0

	pdf.CellFormat(contentWidth, 6, " DATA PENANGGUNG JAWAB (YANG MENYATAKAN)", "1", 1, "L", true, 0, "")
	pdf.SetLineWidth(0.2)
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(245, 245, 245)

	// Row 1: Nama | Umur
	pdf.CellFormat(col1, rowHeight, " Nama Lengkap", "1", 0, "L", true, 0, "")
	pdf.SetFont("Arial", "B", 9)
	valPjNama := gci.PjNama
	if valPjNama == "" {
		valPjNama = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+truncateText(valPjNama, 25), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(col3, rowHeight, " Umur", "1", 0, "L", true, 0, "")
	valPjUmur := "-"
	if gci.PjUmur > 0 {
		valPjUmur = fmt.Sprintf("%d Tahun", gci.PjUmur)
	}
	pdf.CellFormat(col4, rowHeight, " "+valPjUmur, "1", 1, "L", false, 0, "")

	// Row 2: No Identitas | JK
	pdf.CellFormat(col1, rowHeight, " No. Identitas (KTP)", "1", 0, "L", true, 0, "")
	valPjId := gci.PjNoIdentitas
	if valPjId == "" {
		valPjId = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+valPjId, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Jenis Kelamin", "1", 0, "L", true, 0, "")
	valPjJk := gci.PjJenisKelamin
	if valPjJk == "" {
		valPjJk = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+valPjJk, "1", 1, "L", false, 0, "")

	// Row 3: Alamat
	pdf.CellFormat(col1, rowHeight, " Alamat", "1", 0, "L", true, 0, "")
	valPjAlamat := gci.PjAlamat
	if valPjAlamat == "" {
		valPjAlamat = "-"
	}
	pdf.CellFormat(col2+col3+col4, rowHeight, " "+truncateText(valPjAlamat, 68), "1", 1, "L", false, 0, "")

	// Row 4: No Telepon | Hubungan
	pdf.CellFormat(col1, rowHeight, " No. Telepon", "1", 0, "L", true, 0, "")
	valPjTelp := gci.PjNoTelp
	if valPjTelp == "" {
		valPjTelp = "-"
	}
	pdf.CellFormat(col2, rowHeight, " "+valPjTelp, "1", 0, "L", false, 0, "")
	pdf.CellFormat(col3, rowHeight, " Hubungan", "1", 0, "L", true, 0, "")
	valPjHub := gci.PjHubungan
	if valPjHub == "" {
		valPjHub = "-"
	}
	pdf.CellFormat(col4, rowHeight, " "+truncateText(valPjHub, 28), "1", 1, "L", false, 0, "")

	pdf.Ln(4)

	pdf.SetFont("Arial", "B", 11)
	pdf.MultiCell(0, 5, "KEWAJIBAN PASIEN, HAK PASIEN DAN KELUARGA, DAN HAK KLINIK RAWAT INAP UTAMA MUHAMMADIYAH KEDUNGADEM", "", "L", false)
	pdf.Ln(2)

	pdf.SetFont("Arial", "", 9)
	pdf.MultiCell(0, 4, "KEWAJIBAN PASIEN (Berdasarkan Permenkes No. 4 Tahun 2018 Pasal 26 tentang kewajiban Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan Kewajiban pasien) Dalam menerima pelayanan dari Klinik Rawat Inap Utama Muhammadiyah Kedungadem, pasien mempunyai kewajiban :\n1. Mematuhi peraturan yang berlaku di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.\n2. Menggunakan fasilitas Klinik Rawat Inap Utama Muhammadiyah Kedungadem secara bertanggung jawab.\n3. Menghormati hak-hak pasien lain, pengunjung dan hak tenaga kesehatan serta petugas lainnya yang bekerja di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.\n4. Memberikan informasi yang jujur, lengkap dan akurat sesuai kemampuan dan pengetahuannya tentang masalah kesehatannya.\n5. Memberikan informasi mengenai kemampuan finansial dan jaminan kesehatan yang dimilikinya.\n6. Mematuhi rencana terapi yang direkomendasikan oleh tenaga kesehatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan disetujui oleh pasien yang bersangkutan setelah mendapatkan penjelasan sesuai ketentuan peraturan perundang-undangan.\n7. Menerima segala konsekuensi atas keputusan pribadinya untuk menolak rencana terapi yang direkomendasikan oleh tenaga kesehatan dan/atau tidak mematuhi petunjuk yang diberikan oleh tenaga kesehatan dalam rangka penyembuhan penyakit atau masalah kesehatannya dan\n8. Memberikan imbalan jasa atas pelayanan yang diterima.", "", "J", false)
	pdf.Ln(1)

	pdf.MultiCell(0, 4, "HAK PASIEN DAN KELUARGA (Berdasarkan UU No. 44 Tahun 2009 Pasal 32 Tentang hak pasien dan keluarga dan Peraturan Menteri Kesehatan Republik Indonesia No. 4 Tahun 2018 Tentang kewajiban Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan Kewajiban Pasien).\nSetiap pasien mempunyai hak :\n1. Memperoleh informasi mengenai tata tertib dan peraturan yang berlaku di Klinik Rawat Inap Utama Muhammadiyah Kedungadem\n2. Memperoleh informasi tentang hak dan kewajiban pasien.\n3. Memperoleh layanan yang manusiawi, adil jujur dan tanpa diskriminasi.\n4. Memperoleh layanan kesehatan yang bermutu sesuai dengan standart profesi dan standart prosedur operasional.\n5. Memperoleh layanan kesehatan yang efektif dan efisien sehingga terhindar dari kerugian fisik dan materi.\n6. Mengajukan pengaduan atas kualitas pelayanan yang didapatkan.\n7. Memilih dokter, dokter gigi dan kelas perawatan sesuai dengan keinginannya dan peraturan yang berlaku di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.\n8. Meminta konsultasi tentang penyakit yang dideritanya kepada dokter lain yang mempunyai surat ijin praktek (SIP) baik di dalam maupun diluar Klinik Rawat Inap Utama Muhammadiyah Kedungadem.\n9. Mendapatkan Privasi dan kerahasiaan penyakit yang diderita termasuk data-data medisnya.\n10. Mendapat informasi yang meliputi diagnosis dan tata cara tindakan medis, tujuan tindakan medis, alternatif tindakan, resiko dan komplikasi yang mungkin terjadi, dan prognosis terhadap tindakan yang dilakukan serta perkiraan biaya pengobatan.\n11. Memberikan persetujuan atau penolakan atas tindakan yang dilakukan oleh tenaga kesehatan terhadap penyakit yang dideritanya.\n12. Didampingi keluarganya dalam keadaan kritis.\n13. Menjalankan ibadah sesuai Agama atau kepercayaan yang dianutnya selama hal itu tidak mengganggu pasien lain.\n14. Memperoleh keamanan dan keselamatan dirinya selama dalam perawatan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.\n15. Mengajukan usul, saran, perbaikan atas perlakuan Klinik Rawat Inap Utama Muhammadiyah Kedungadem terhadap dirinya.\n16. Menolak pelayanan bimbingan rohani yang tidak sesuai dengan Agama dan Kepercayaan yang dianutnya.\n17. Menggugat dan / atau menuntut Klinik Rawat Inap Utama Muhammadiyah Kedungadem memberikan pelayanan yang tidak sesuai dengan standart baik secara perdata ataupun pidana dan\n18. Mengeluhkan pelayanan Klinik Rawat Inap Utama Muhammadiyah Kedungadem yang tidak sesuai dengan standart pelayanan melalui media cetak dan elektronik sesuai dengan ketentuan peraturan perundang-undangan.", "", "J", false)
	pdf.Ln(1)

	pdf.SetFont("Arial", "B", 9)
	pdf.MultiCell(0, 4, "PERATURAN KLINIK RAWAT INAP UTAMA MUHAMMADIYAH KEDUNGADEM.\n1. Dilarang merokok di lingkungan Klinik Rawat Inap Utama Muhammadiyah Kedungadem.\n2. Dilarang menggunakan sarana dan prasarana Klinik Rawat Inap Utama Muhammadiyah Kedungadem yang tidak sesuai dengan peruntukannya.\n3. Dilarang membuat kegaduhan atau keributan yang dapat mengganggu pasien.\n4. Dilarang memasuki area dengan tanda dilarang masuk atau hanya khusus bagi karyawan.", "", "J", false)
	pdf.Ln(2)

	pdf.SetFont("Arial", "", 9)
	pdf.MultiCell(0, 4, "Dengan ini saya menyatakan telah memahami hak dan kewajiban serta peraturan Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan mematuhi peraturan tersebut selama mendapat pelayanan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.", "", "J", false)
	pdf.Ln(3)

	// Signature Section Page 2
	addDualSignature(pdf, hospitalInfo.City, "", docType, parsedID)

	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	pdfData := buf.Bytes()
	fileName := fmt.Sprintf("persetujuan_rawat_inap_%s.pdf", visit.Registration.Patient.NoRM)
	
	go storeCachedPDF(docType, parsedID, pdfData, fileName)

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
	c.Data(http.StatusOK, "application/pdf", pdfData)
}
