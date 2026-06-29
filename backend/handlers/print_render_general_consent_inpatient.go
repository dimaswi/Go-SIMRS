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

	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(0, 10, "PERSETUJUAN UMUM (GENERAL CONSENT)", "", 1, "C", false, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "", 10)
	pdf.MultiCell(0, 6, "PENGAJUAN KELUHAN, Saya menyatakan bahwa saya telah menerima informasi tentang adanya tata cara mengajukan dan mengatasi keluhan terkait pelayanan medis yang diberikan terhadap diri saya. Saya setuju untuk mengikuti tata cara mengajukan keluhan sesuai prosedur yang ada.", "", "J", false)
	pdf.Ln(2)

	pdf.MultiCell(0, 6, "KEWAJIBAN PEMBAYARAN, Saya menyatakan sebagai wali/pasien bersedia membayar seluruh biaya pelayanan sesuai pelayanan yang diberikan. Saya juga memahami bahwa :\n1. Apabila saya tidak memberikan atau mencabut persetujuan pembukaan rahasia kedokteran kepada pihak asuransi/penjamin, maka seluruh biaya pelayanan menjadi tanggung jawab saya pribadi.\n2. Apabila diperlukan proses hukum untuk penagihan biaya pelayanan, maka seluruh biaya yang timbul akibat proses tersebut menjadi tanggung jawab saya.", "", "J", false)
	pdf.Ln(2)

	pdf.SetFont("Arial", "B", 10)
	pdf.MultiCell(0, 6, "SAYA TELAH MEMBACA DAN SEPENUHNYA SETUJU dengan pernyataan yang terdapat dalam formulir ini dan saya menandatanganinya tanpa paksaan dan dengan kesadaran penuh.", "", "J", false)
	pdf.Ln(5)

	// Signature Section Page 1
	addDualSignature(pdf, hospitalInfo.City, "", docType, parsedID)

	// Page 2
	pdf.AddPage()
	addHeader(pdf, hospitalInfo, "PERSETUJUAN UMUM (GENERAL CONSENT)", "RM-03")
	addPatientInfoTable(pdf, visit.Registration.Patient, &visit)

	pdf.SetFont("Arial", "B", 11)
	pdf.MultiCell(0, 6, "KEWAJIBAN PASIEN, HAK PASIEN DAN KELUARGA, DAN HAK KLINIK RAWAT INAP UTAMA MUHAMMADIYAH KEDUNGADEM", "", "C", false)
	pdf.Ln(3)

	pdf.SetFont("Arial", "", 9)
	pdf.MultiCell(0, 5, "KEWAJIBAN PASIEN\nDalam menerima pelayanan dari Klinik Rawat Inap Utama Muhammadiyah Kedungadem, pasien mempunyai kewajiban :\n1. Mematuhi peraturan yang berlaku di Klinik.\n2. Menggunakan fasilitas secara bertanggung jawab.\n3. Menghormati hak-hak pasien lain, pengunjung dan hak tenaga kesehatan serta petugas lainnya.\n4. Memberikan informasi yang jujur, lengkap dan akurat sesuai kemampuan dan pengetahuannya tentang masalah kesehatannya.\n5. Memberikan informasi mengenai kemampuan finansial dan jaminan kesehatan yang dimilikinya.\n6. Mematuhi rencana terapi yang direkomendasikan oleh tenaga kesehatan.\n7. Menerima segala konsekuensi atas keputusan pribadinya untuk menolak rencana terapi.\n8. Memberikan imbalan jasa atas pelayanan yang diterima.", "", "J", false)
	pdf.Ln(2)

	pdf.MultiCell(0, 5, "HAK PASIEN DAN KELUARGA\nSetiap pasien mempunyai hak :\n1. Memperoleh informasi mengenai tata tertib dan peraturan yang berlaku.\n2. Memperoleh informasi tentang hak dan kewajiban pasien.\n3. Memperoleh layanan yang manusiawi, adil jujur dan tanpa diskriminasi.\n4. Memperoleh layanan kesehatan yang bermutu.\n5. Memperoleh layanan kesehatan yang efektif dan efisien.\n6. Mengajukan pengaduan atas kualitas pelayanan yang didapatkan.\n7. Memilih dokter, dokter gigi dan kelas perawatan sesuai dengan keinginannya.\n8. Meminta konsultasi tentang penyakit yang dideritanya kepada dokter lain.\n9. Mendapatkan Privasi dan kerahasiaan penyakit yang diderita termasuk data-data medisnya.\n10. Mendapat informasi yang meliputi diagnosis dan tata cara tindakan medis, tujuan, alternatif, resiko dan komplikasi, prognosis serta perkiraan biaya.\n11. Memberikan persetujuan atau penolakan atas tindakan yang dilakukan oleh tenaga kesehatan.\n12. Didampingi keluarganya dalam keadaan kritis.\n13. Menjalankan ibadah sesuai Agama atau kepercayaan yang dianutnya.\n14. Memperoleh keamanan dan keselamatan dirinya.\n15. Mengajukan usul, saran, perbaikan atas perlakuan Klinik terhadap dirinya.\n16. Menolak pelayanan bimbingan rohani yang tidak sesuai dengan Agama dan Kepercayaan yang dianutnya.\n17. Menggugat dan / atau menuntut Klinik apabila memberikan pelayanan yang tidak sesuai dengan standart.\n18. Mengeluhkan pelayanan Klinik yang tidak sesuai dengan standart.", "", "J", false)
	pdf.Ln(2)

	pdf.MultiCell(0, 5, "PERATURAN KLINIK\n1. Dilarang merokok di lingkungan Klinik Rawat Inap Utama Muhammadiyah Kedungadem.\n2. Dilarang menggunakan sarana dan prasarana yang tidak sesuai dengan peruntukannya.\n3. Dilarang membuat kegaduhan atau keributan yang dapat mengganggu pasien.\n4. Dilarang memasuki area dengan tanda dilarang masuk atau hanya khusus bagi karyawan.", "", "J", false)
	pdf.Ln(2)

	pdf.SetFont("Arial", "B", 9)
	pdf.MultiCell(0, 5, "Dengan ini saya menyatakan telah memahami hak dan kewajiban serta peraturan Klinik Rawat Inap Utama Muhammadiyah Kedungadem dan mematuhi peraturan tersebut selama mendapat pelayanan di Klinik Rawat Inap Utama Muhammadiyah Kedungadem.", "", "J", false)
	pdf.Ln(5)

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
