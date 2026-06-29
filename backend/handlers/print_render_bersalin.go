package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
)

// printBersalinRecordImpl generates the PDF for Bersalin Form
func printBersalinRecordImpl(c *gin.Context, isRMDup bool) {
	var id string
	var docType string
	var parsedID uint

	if isRMDup {
		id = c.Param("rmDuplicateId")
		docType = models.DocTypeRMDupBersalin
	} else {
		id = c.Param("visitId")
		docType = models.DocTypeBersalin
	}

	pid, _ := strconv.ParseUint(id, 10, 32)
	parsedID = uint(pid)

	if pdfData, fileName, found := getCachedPDF(docType, parsedID); found {
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, "application/pdf", pdfData)
		return
	}

	// Load Visit
	var visit models.Visit
	if isRMDup {
		// Get from RM Duplicate table to get the visit mapping
		var rmDup models.EKlaimRMDuplicate
		if err := database.DB.First(&rmDup, parsedID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "RMDuplicate tidak ditemukan"})
			return
		}
		if err := database.DB.Preload("Registration.Patient").Preload("Room").Preload("Doctor").First(&visit, rmDup.VisitID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
			return
		}
	} else {
		if err := database.DB.Preload("Registration.Patient").Preload("Room").Preload("Doctor").First(&visit, parsedID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
			return
		}
	}

	// Load Bersalin Record
	var bersalin models.BersalinRecord
	query := clinicalVisitQuery(c, visit.ID)
	if isRMDup {
		query = database.DB.Where("casemix_eklaim_id = ?", parsedID)
	} else {
		query = query.Where("visit_id = ?", parsedID)
	}
	
	err := query.Preload("RecordedBy").First(&bersalin).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rekam Medis Bersalin tidak ditemukan"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	// Initialize PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	addHeader(pdf, hospitalInfo, "CATATAN PERSALINAN & PARTOGRAF", "MR.47")
	addPatientInfoTable(pdf, patient, &visit)

	// A. ASESMEN AWAL
	addTableHeader(pdf, "A. ASESMEN AWAL & KELUHAN")
	addTableRow(pdf, "Jam Kedatangan", bersalin.JamDatang, 45)
	addTableRow(pdf, "Jam Pengkajian", bersalin.JamPengkajian, 45)
	addTableRow(pdf, "Jenis Anamnesis", bersalin.AnamnesisType, 45)
	addTableRow(pdf, "Keluhan Utama", safeString(bersalin.KeluhanUtama), 45)
	addTableEnd(pdf)

	// Parse JSON data loosely
	var fisik map[string]interface{}
	if len(bersalin.PemeriksaanFisikJSON) > 0 {
		json.Unmarshal(bersalin.PemeriksaanFisikJSON, &fisik)
	}

	var riwayat map[string]interface{}
	if len(bersalin.RiwayatMedisJSON) > 0 {
		json.Unmarshal(bersalin.RiwayatMedisJSON, &riwayat)
	}

	// B. RIWAYAT MEDIS
	addTableHeader(pdf, "B. RIWAYAT KESEHATAN")
	r, _ := riwayat["riwayat_penyakit"].(string)
	addTableRow(pdf, "Riwayat Penyakit", safeString(r), 45)

	g, _ := riwayat["gravida"].(string)
	p, _ := riwayat["para"].(string)
	a, _ := riwayat["abortus"].(string)
	obsStatus := ""
	if g != "" || p != "" || a != "" {
		obsStatus = fmt.Sprintf("G: %s, P: %s, A: %s", g, p, a)
	}
	addTableRow(pdf, "Status Obstetrik", safeString(obsStatus), 45)

	hpht, _ := riwayat["hpht"].(string)
	hpl, _ := riwayat["hpl"].(string)
	hphthpl := ""
	if hpht != "" || hpl != "" {
		hphthpl = fmt.Sprintf("HPHT: %s, HPL: %v", hpht, hpl)
	}
	addTableRow(pdf, "HPHT / HPL", safeString(hphthpl), 45)
	addTableEnd(pdf)

	// C. PEMERIKSAAN FISIK
	addTableHeader(pdf, "C. PEMERIKSAAN FISIK UMUM")
	td, _ := fisik["tekanan_darah"].(string)
	nadi, _ := fisik["nadi"]
	suhu, _ := fisik["suhu"]
	pernapasan, _ := fisik["pernapasan"]
	tandaVital := ""
	if td != "" {
		tandaVital = fmt.Sprintf("TD: %s mmHg, Nadi: %v x/mnt, Suhu: %v C, RR: %v x/mnt", td, nadi, suhu, pernapasan)
	}
	addTableRow(pdf, "Tanda Vital", safeString(tandaVital), 45)

	tff, _ := fisik["tinggi_fundus"].(string)
	addTableRow(pdf, "Tinggi Fundus Uteri", safeString(tff), 45)

	djj, _ := fisik["djj"].(string)
	addTableRow(pdf, "Denyut Jantung Janin", safeString(djj), 45)
	addTableEnd(pdf)

	// D. PARTOGRAF / OBSERVASI
	checkPageBreak(pdf, 20)
	addTableHeader(pdf, "D. OBSERVASI PARTOGRAF")
	
	// Print ketuban & mules
	addTableRow(pdf, "Ketuban Pecah Sejak", safeString(bersalin.KetubanPecahJam), 45)
	addTableRow(pdf, "Mules Sejak", safeString(bersalin.MulesSejakJam), 45)

	var observasi []map[string]interface{}
	if len(bersalin.LembarObservasiJSON) > 0 {
		json.Unmarshal(bersalin.LembarObservasiJSON, &observasi)
	}

	if len(observasi) > 0 {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(30, 6, "Tgl/Jam", "1", 0, "C", true, 0, "")
		pdf.CellFormat(45, 6, "Cairan/Obat", "1", 0, "C", true, 0, "")
		pdf.CellFormat(20, 6, "His", "1", 0, "C", true, 0, "")
		pdf.CellFormat(20, 6, "DJJ", "1", 0, "C", true, 0, "")
		pdf.CellFormat(65, 6, "Keterangan", "1", 1, "C", true, 0, "")

		pdf.SetFont("Arial", "", 8)
		for _, obs := range observasi {
			checkPageBreak(pdf, 8)
			tglJam, _ := obs["tanggal_jam"].(string)
			tglJam = strings.ReplaceAll(tglJam, "T", " ")
			cairan, _ := obs["cairan"].(string)
			his, _ := obs["his"].(string)
			djj, _ := obs["djj"].(string)
			ket, _ := obs["keterangan"].(string)
			
			pdf.CellFormat(30, 6, safeString(tglJam), "1", 0, "C", false, 0, "")
			pdf.CellFormat(45, 6, safeString(cairan), "1", 0, "C", false, 0, "")
			pdf.CellFormat(20, 6, safeString(his), "1", 0, "C", false, 0, "")
			pdf.CellFormat(20, 6, safeString(djj), "1", 0, "C", false, 0, "")
			pdf.CellFormat(65, 6, safeString(ket), "1", 1, "L", false, 0, "")
		}
	}

	var partograf []map[string]interface{}
	if len(bersalin.PartografDataJSON) > 0 {
		json.Unmarshal(bersalin.PartografDataJSON, &partograf)
	}

	if len(partograf) > 0 {
		pdf.SetFont("Arial", "B", 7)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(15, 6, "Waktu", "1", 0, "C", true, 0, "")
		pdf.CellFormat(12, 6, "DJJ", "1", 0, "C", true, 0, "")
		pdf.CellFormat(15, 6, "Ket/Pyp", "1", 0, "C", true, 0, "")
		pdf.CellFormat(16, 6, "Pmb/Trn", "1", 0, "C", true, 0, "")
		pdf.CellFormat(18, 6, "Kntr(J/D)", "1", 0, "C", true, 0, "")
		pdf.CellFormat(34, 6, "Oksit/Obat", "1", 0, "C", true, 0, "")
		pdf.CellFormat(35, 6, "TD/Nadi/Sh", "1", 0, "C", true, 0, "")
		pdf.CellFormat(35, 6, "Urin(V/P/A)", "1", 1, "C", true, 0, "")

		pdf.SetFont("Arial", "", 7)
		for _, p := range partograf {
			checkPageBreak(pdf, 8)
			wkt, _ := p["waktu"].(string)
			djj, _ := p["djj"].(string)
			airKet, _ := p["air_ketuban"].(string)
			peny, _ := p["penyusupan"].(string)
			pemb, _ := p["pembukaan"].(string)
			turun, _ := p["turunnya_kepala"].(string)
			kJumlah, _ := p["kontraksi_jumlah"].(string)
			kDurasi, _ := p["kontraksi_durasi"].(string)
			oksit, _ := p["oksitosin"].(string)
			obat, _ := p["obat_cairan"].(string)
			td, _ := p["tekanan_darah"].(string)
			nadi, _ := p["nadi"].(string)
			suhu, _ := p["suhu"].(string)
			uVol, _ := p["urin_volume"].(string)
			uProt, _ := p["urin_protein"].(string)
			uAstn, _ := p["urin_aseton"].(string)

			ketPyp := safeString(airKet) + "/" + safeString(peny)
			pmbTrn := safeString(pemb) + "/" + safeString(turun)
			kontr := safeString(kJumlah) + "/" + safeString(kDurasi)
			oksitObat := safeString(oksit) + "/" + safeString(obat)
			ttv := safeString(td) + "/" + safeString(nadi) + "/" + safeString(suhu)
			urin := safeString(uVol) + "/" + safeString(uProt) + "/" + safeString(uAstn)
			
			pdf.CellFormat(15, 6, safeString(wkt), "1", 0, "C", false, 0, "")
			pdf.CellFormat(12, 6, safeString(djj), "1", 0, "C", false, 0, "")
			pdf.CellFormat(15, 6, ketPyp, "1", 0, "C", false, 0, "")
			pdf.CellFormat(16, 6, pmbTrn, "1", 0, "C", false, 0, "")
			pdf.CellFormat(18, 6, kontr, "1", 0, "C", false, 0, "")
			pdf.CellFormat(34, 6, oksitObat, "1", 0, "C", false, 0, "")
			pdf.CellFormat(35, 6, ttv, "1", 0, "C", false, 0, "")
			pdf.CellFormat(35, 6, urin, "1", 1, "C", false, 0, "")
		}
	}

	var lapTindakan map[string]interface{}
	if len(bersalin.LaporanTindakanJSON) > 0 {
		json.Unmarshal(bersalin.LaporanTindakanJSON, &lapTindakan)
		ket, _ := lapTindakan["keterangan"].(string)
		if ket != "" {
			pdf.Ln(4)
			addTableHeader(pdf, "LAPORAN TINDAKAN PERSALINAN")
			pdf.SetFont("Arial", "", 9)
			pdf.SetDrawColor(0, 0, 0)
			pdf.MultiCell(190, 5, ket, "1", "L", false)
		}
	}
	pdf.Ln(4)

	// E. CATATAN PERSALINAN
	checkPageBreak(pdf, 20)
	addTableHeader(pdf, "E. CATATAN PERSALINAN")
	
	var kala1 map[string]interface{}
	k1_ket := ""
	if len(bersalin.CatatanKala1JSON) > 0 {
		json.Unmarshal(bersalin.CatatanKala1JSON, &kala1)
		k1_ket, _ = kala1["keterangan"].(string)
	}
	addTableRow(pdf, "Kala I", safeString(k1_ket), 45)

	var kala2 map[string]interface{}
	k2_ket := ""
	if len(bersalin.CatatanKala2JSON) > 0 {
		json.Unmarshal(bersalin.CatatanKala2JSON, &kala2)
		k2_ket, _ = kala2["keterangan"].(string)
	}
	addTableRow(pdf, "Kala II", safeString(k2_ket), 45)

	var kala3 map[string]interface{}
	k3_ket := ""
	if len(bersalin.CatatanKala3JSON) > 0 {
		json.Unmarshal(bersalin.CatatanKala3JSON, &kala3)
		k3_ket, _ = kala3["keterangan"].(string)
	}
	addTableRow(pdf, "Kala III", safeString(k3_ket), 45)

	var kala4 map[string]interface{}
	k4_ket := ""
	if len(bersalin.PemantauanKala4JSON) > 0 {
		json.Unmarshal(bersalin.PemantauanKala4JSON, &kala4)
		k4_ket, _ = kala4["keterangan"].(string)
	}
	addTableRow(pdf, "Kala IV", safeString(k4_ket), 45)
	addTableEnd(pdf)

	// F. BAYI BARU LAHIR
	checkPageBreak(pdf, 20)
	addTableHeader(pdf, "F. BAYI BARU LAHIR")
	
	var bayi map[string]interface{}
	jk := ""
	cacat := ""
	bb := ""
	pb := ""
	apgar := ""
	if len(bersalin.BayiBaruLahirJSON) > 0 {
		json.Unmarshal(bersalin.BayiBaruLahirJSON, &bayi)
		jk, _ = bayi["jenis_kelamin"].(string)
		cacat, _ = bayi["cacat_bawaan"].(string)
		if cacat == "Ya" {
			cacatKet, _ := bayi["cacat_bawaan_ket"].(string)
			cacat = fmt.Sprintf("Ya (%v)", cacatKet)
		} else if cacat == "" {
			cacat = "Tidak ada"
		}
		if bayi["berat_badan"] != nil {
			bb = fmt.Sprintf("%v", bayi["berat_badan"])
		}
		if bayi["panjang_badan"] != nil {
			pb = fmt.Sprintf("%v", bayi["panjang_badan"])
		}
		if as1, ok := bayi["apgar_score_1"].(string); ok && as1 != "" {
			apgar = fmt.Sprintf("1 Menit: %v, 5 Menit: %v, 10 Menit: %v", as1, bayi["apgar_score_5"], bayi["apgar_score_10"])
		}
	}

	addTableRow(pdf, "Jenis Kelamin", safeString(jk), 45)
	
	bbpb := ""
	if bb != "" || pb != "" {
		bbpb = fmt.Sprintf("Berat Badan: %s gram, Panjang Badan: %s cm", safeString(bb), safeString(pb))
	}
	addTableRow(pdf, "Berat / Panjang", safeString(bbpb), 45)
	addTableRow(pdf, "APGAR Score", safeString(apgar), 45)
	addTableRow(pdf, "Cacat Bawaan", safeString(cacat), 45)
	
	addTableEnd(pdf)

	pdf.Ln(10)

	// Signature Section
	// Get signature status
	signerName := ""
	if bersalin.RecordedBy != nil {
		signerName = bersalin.RecordedBy.FullName
	}

	addDualSignature(pdf, hospitalInfo.City, signerName, docType, parsedID)

	// Save to buffer
	var buf bytes.Buffer
	err = pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat PDF"})
		return
	}

	contentData := buf.Bytes()
	fileName := fmt.Sprintf("MR47_Bersalin_%s.pdf", patient.NoRM)

	// Save to cache
	go storeCachedPDF(docType, parsedID, contentData, fileName)

	// Send to client
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
	c.Data(http.StatusOK, "application/pdf", contentData)
}
