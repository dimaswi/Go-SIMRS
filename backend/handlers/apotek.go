package handlers

import (
	"fmt"
	"net/http"
	bpjsService "starter/backend/services/bpjs"

	"github.com/gin-gonic/gin"
)

func newApotekClient(c *gin.Context) (*bpjsService.ApotekClient, bool) {
	client, err := bpjsService.NewApotekClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menginisialisasi Apotek client: %v", err)})
		return nil, false
	}
	return client, true
}

func apotekRequestError(c *gin.Context, action string, err error) {
	c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("%s: %v", action, err)})
}

func ApotekGetReferensiDPHO(c *gin.Context) {
	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, cached, err := client.GetReferensiDPHO()
	if err != nil {
		apotekRequestError(c, "Gagal mengambil referensi DPHO", err)
		return
	}

	response := gin.H{"data": data}
	if cached {
		response["cached"] = true
		response["warning"] = "Data DPHO menggunakan cache lokal karena server BPJS sedang timeout"
	}

	c.JSON(http.StatusOK, response)
}

func ApotekGetReferensiPoli(c *gin.Context) {
	parameter := c.Param("parameter")
	if parameter == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parameter wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.GetReferensiPoli(parameter)
	if err != nil {
		apotekRequestError(c, "Gagal mengambil referensi poli", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekGetFasilitasKesehatan(c *gin.Context) {
	jenisFaskes := c.Param("jenisFaskes")
	namaFaskes := c.Param("namaFaskes")
	if jenisFaskes == "" || namaFaskes == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "jenisFaskes dan namaFaskes wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.GetFasilitasKesehatan(jenisFaskes, namaFaskes)
	if err != nil {
		apotekRequestError(c, "Gagal mengambil fasilitas kesehatan", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekGetSettingApotek(c *gin.Context) {
	kodeApotek := c.Param("kodeApotek")
	if kodeApotek == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kodeApotek wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.GetSettingApotek(kodeApotek)
	if err != nil {
		apotekRequestError(c, "Gagal mengambil setting apotek", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekGetSpesialistik(c *gin.Context) {
	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.GetSpesialistik()
	if err != nil {
		apotekRequestError(c, "Gagal mengambil referensi spesialistik", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekGetReferensiObat(c *gin.Context) {
	kodeJenisObat := c.Query("kodeJenisObat")
	tglResep := c.Query("tglResep")
	filter := c.Query("filter")

	if tglResep == "" {
		tglResep = c.Param("tglResep")
	}
	if kodeJenisObat == "" {
		kodeJenisObat = c.Param("kodeJenisObat")
	}
	if filter == "" {
		filter = c.Param("filter")
	}

	if tglResep == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tglResep wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.GetReferensiObat(kodeJenisObat, tglResep, filter)
	if err != nil {
		apotekRequestError(c, "Gagal mengambil referensi obat", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekInsertObatNonRacikan(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request body wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.InsertObatNonRacikan(payload)
	if err != nil {
		apotekRequestError(c, "Gagal insert obat non racikan", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekInsertObatRacikan(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request body wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.InsertObatRacikan(payload)
	if err != nil {
		apotekRequestError(c, "Gagal insert obat racikan", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekUpdateStokObat(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request body wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.UpdateStokObat(payload)
	if err != nil {
		apotekRequestError(c, "Gagal update stok obat", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekHapusPelayananObat(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request body wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.HapusPelayananObat(payload)
	if err != nil {
		apotekRequestError(c, "Gagal hapus pelayanan obat", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekGetDaftarPelayananObat(c *gin.Context) {
	noKunjungan := c.Param("noKunjungan")
	if noKunjungan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "noKunjungan wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.GetDaftarPelayananObat(noKunjungan)
	if err != nil {
		apotekRequestError(c, "Gagal mengambil daftar pelayanan obat", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekGetRiwayatPelayananObat(c *gin.Context) {
	tglAwal := c.Param("tglAwal")
	tglAkhir := c.Param("tglAkhir")
	noKartu := c.Param("noKartu")
	if tglAwal == "" || tglAkhir == "" || noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tglAwal, tglAkhir, dan noKartu wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.GetRiwayatPelayananObat(tglAwal, tglAkhir, noKartu)
	if err != nil {
		apotekRequestError(c, "Gagal mengambil riwayat pelayanan obat", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekSimpanResep(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request body wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.SimpanResep(payload)
	if err != nil {
		apotekRequestError(c, "Gagal simpan resep", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekHapusResep(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request body wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.HapusResep(payload)
	if err != nil {
		apotekRequestError(c, "Gagal hapus resep", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekDaftarResep(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request body wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.DaftarResep(payload)
	if err != nil {
		apotekRequestError(c, "Gagal mengambil daftar resep", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekCariKunjunganBySEP(c *gin.Context) {
	noSEP := c.Param("noSEP")
	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "noSEP wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.CariKunjunganBySEP(noSEP)
	if err != nil {
		apotekRequestError(c, "Gagal mencari kunjungan berdasarkan SEP", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekGetDataKlaim(c *gin.Context) {
	bulan := c.Param("bulan")
	tahun := c.Param("tahun")
	jenisObat := c.Param("jenisObat")
	status := c.Param("status")
	if bulan == "" || tahun == "" || jenisObat == "" || status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bulan, tahun, jenisObat, dan status wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.GetDataKlaim(bulan, tahun, jenisObat, status)
	if err != nil {
		apotekRequestError(c, "Gagal mengambil data klaim", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func ApotekGetRekapPesertaPRB(c *gin.Context) {
	tahun := c.Param("tahun")
	bulan := c.Param("bulan")
	if tahun == "" || bulan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tahun dan bulan wajib diisi"})
		return
	}

	client, ok := newApotekClient(c)
	if !ok {
		return
	}

	data, err := client.GetRekapPesertaPRB(tahun, bulan)
	if err != nil {
		apotekRequestError(c, "Gagal mengambil rekap peserta PRB", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}
