package handlers

import (
	"net/http"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

// GetBersalinRecord retrieves Bersalin (Partus) record for a visit
func GetBersalinRecord(c *gin.Context) {
	visitID := c.Param("id")

	var record models.BersalinRecord
	if err := scopedRMQuery(c, visitID).Preload("RecordedBy").First(&record).Error; err != nil {
		// Return empty object if not found
		c.JSON(http.StatusOK, gin.H{"visit_id": visitID})
		return
	}

	c.JSON(http.StatusOK, record)
}

// SaveBersalinRecord saves or updates Bersalin (Partus) record
func SaveBersalinRecord(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		JamDatang           string         `json:"jam_datang"`
		JamPengkajian       string         `json:"jam_pengkajian"`
		AnamnesisType       string         `json:"anamnesis_type"`
		KeluhanUtama        string         `json:"keluhan_utama"`
		PemeriksaanFisik    datatypes.JSON `json:"pemeriksaan_fisik"`
		Genetalia           datatypes.JSON `json:"genetalia"`
		SkorNorton          int            `json:"skor_norton"`
		SkorMust            int            `json:"skor_must"`
		SkorBarthel         int            `json:"skor_barthel"`
		SkorMorse           int            `json:"skor_morse"`
		Nyeri               datatypes.JSON `json:"nyeri"`
		Edukasi             datatypes.JSON `json:"edukasi"`
		RiwayatMedis        datatypes.JSON `json:"riwayat_medis"`
		RencanaAsuhan       datatypes.JSON `json:"rencana_asuhan"`
		KetubanPecahJam     string         `json:"ketuban_pecah_jam"`
		MulesSejakJam       string         `json:"mules_sejak_jam"`
		LembarObservasi     datatypes.JSON `json:"lembar_observasi"`
		PartografData       datatypes.JSON `json:"partograf_data"`
		LaporanTindakan     datatypes.JSON `json:"laporan_tindakan"`
		CatatanKala1        datatypes.JSON `json:"catatan_kala_1"`
		CatatanKala2        datatypes.JSON `json:"catatan_kala_2"`
		CatatanKala3        datatypes.JSON `json:"catatan_kala_3"`
		BayiBaruLahir       datatypes.JSON `json:"bayi_baru_lahir"`
		PemantauanKala4     datatypes.JSON `json:"pemantauan_kala_4"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	var record models.BersalinRecord
	err := scopedRMQuery(c, visitID).First(&record).Error

	var recorderID *uint
	if userID > 0 {
		recorderID = &userID
	}

	if err != nil {
		record = models.BersalinRecord{
			VisitID:         visit.ID,
			IsCasemix:       c.Query("is_casemix") == "true",
			CasemixEklaimID: getCasemixEklaimID(c),
			RecordedByID:    recorderID,
		}
	} else if recorderID != nil {
		record.RecordedByID = recorderID
	}

	record.JamDatang = input.JamDatang
	record.JamPengkajian = input.JamPengkajian
	record.AnamnesisType = input.AnamnesisType
	record.KeluhanUtama = input.KeluhanUtama

	// Set JSON fields if they are not nil or empty
	if len(input.PemeriksaanFisik) > 0 {
		record.PemeriksaanFisikJSON = input.PemeriksaanFisik
	}
	if len(input.Genetalia) > 0 {
		record.GenetaliaJSON = input.Genetalia
	}
	record.SkorNorton = input.SkorNorton
	record.SkorMust = input.SkorMust
	record.SkorBarthel = input.SkorBarthel
	record.SkorMorse = input.SkorMorse

	if len(input.Nyeri) > 0 {
		record.NyeriJSON = input.Nyeri
	}
	if len(input.Edukasi) > 0 {
		record.EdukasiJSON = input.Edukasi
	}
	if len(input.RiwayatMedis) > 0 {
		record.RiwayatMedisJSON = input.RiwayatMedis
	}
	if len(input.RencanaAsuhan) > 0 {
		record.RencanaAsuhanJSON = input.RencanaAsuhan
	}
	
	record.KetubanPecahJam = input.KetubanPecahJam
	record.MulesSejakJam = input.MulesSejakJam

	if len(input.LembarObservasi) > 0 {
		record.LembarObservasiJSON = input.LembarObservasi
	}
	if len(input.PartografData) > 0 {
		record.PartografDataJSON = input.PartografData
	}
	if len(input.LaporanTindakan) > 0 {
		record.LaporanTindakanJSON = input.LaporanTindakan
	}
	if len(input.CatatanKala1) > 0 {
		record.CatatanKala1JSON = input.CatatanKala1
	}
	if len(input.CatatanKala2) > 0 {
		record.CatatanKala2JSON = input.CatatanKala2
	}
	if len(input.CatatanKala3) > 0 {
		record.CatatanKala3JSON = input.CatatanKala3
	}
	if len(input.BayiBaruLahir) > 0 {
		record.BayiBaruLahirJSON = input.BayiBaruLahir
	}
	if len(input.PemantauanKala4) > 0 {
		record.PemantauanKala4JSON = input.PemantauanKala4
	}

	if err := database.DB.Save(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	invalidatePDFCache(models.DocTypeBersalin, visit.ID)

	c.JSON(http.StatusOK, record)
}