package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	bpjsService "starter/backend/services/bpjs"
	"strconv"

	"github.com/gin-gonic/gin"
)

// AplicareGetRefKelas mengambil referensi kelas kamar dari BPJS Aplicare
func AplicareGetRefKelas(c *gin.Context) {
	client, err := bpjsService.NewAplicareClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menginisialisasi Aplicare client: %v", err)})
		return
	}

	items, err := client.GetRefKelas()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal mengambil referensi kelas: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

// AplicareReadBed membaca ketersediaan tempat tidur dari BPJS Aplicare
func AplicareReadBed(c *gin.Context) {
	startStr := c.DefaultQuery("start", "1")
	limitStr := c.DefaultQuery("limit", "100")

	start, _ := strconv.Atoi(startStr)
	limit, _ := strconv.Atoi(limitStr)
	if start < 1 {
		start = 1
	}
	if limit < 1 {
		limit = 100
	}

	client, err := bpjsService.NewAplicareClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menginisialisasi Aplicare client: %v", err)})
		return
	}

	items, err := client.ReadBed(start, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal membaca data tempat tidur: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

// AplicareCreateRoom mendaftarkan ruangan ke BPJS Aplicare
func AplicareCreateRoom(c *gin.Context) {
	var input struct {
		RoomID uint `json:"room_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room_id wajib diisi"})
		return
	}

	// Load room dari database
	var room models.Room
	if err := database.DB.First(&room, input.RoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	if !room.HasBed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan ini tidak memiliki tempat tidur"})
		return
	}

	// Compute bed stats
	room.ComputeBedStats(database.DB)

	client, err := bpjsService.NewAplicareClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menginisialisasi Aplicare client: %v", err)})
		return
	}

	kodeKelas := room.KodeKelasBPJS
	if kodeKelas == "" {
		kodeKelas = bpjsService.MapRoomClassToAplicare(room.RoomClass)
	}

	req := bpjsService.AplicareBedRequest{
		KodeKelas:          kodeKelas,
		KodeRuang:          room.Code,
		NamaRuang:          room.Name,
		Kapasitas:          strconv.Itoa(room.TotalBeds),
		Tersedia:           strconv.Itoa(room.AvailableBeds),
		TersediaPria:       "0",
		TersediaWanita:     "0",
		TersediaPriaWanita: "0",
	}

	if err := client.CreateBed(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal mendaftarkan ruangan ke Aplicare: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Ruangan %s berhasil didaftarkan ke Aplicare", room.Name),
		"data":    req,
	})
}

// AplicareUpdateRoom mengupdate ketersediaan tempat tidur secara manual
func AplicareUpdateRoom(c *gin.Context) {
	var input struct {
		RoomID uint `json:"room_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room_id wajib diisi"})
		return
	}

	var room models.Room
	if err := database.DB.First(&room, input.RoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	if !room.HasBed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan ini tidak memiliki tempat tidur"})
		return
	}

	room.ComputeBedStats(database.DB)

	client, err := bpjsService.NewAplicareClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menginisialisasi Aplicare client: %v", err)})
		return
	}

	kodeKelas := room.KodeKelasBPJS
	if kodeKelas == "" {
		kodeKelas = bpjsService.MapRoomClassToAplicare(room.RoomClass)
	}

	req := bpjsService.AplicareBedRequest{
		KodeKelas:          kodeKelas,
		KodeRuang:          room.Code,
		NamaRuang:          room.Name,
		Kapasitas:          strconv.Itoa(room.TotalBeds),
		Tersedia:           strconv.Itoa(room.AvailableBeds),
		TersediaPria:       "0",
		TersediaWanita:     "0",
		TersediaPriaWanita: "0",
	}

	if err := client.UpdateBed(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal mengupdate ke Aplicare: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Ketersediaan tempat tidur ruangan %s berhasil diupdate", room.Name),
		"data":    req,
	})
}

// AplicareDeleteRoom menghapus ruangan dari BPJS Aplicare
func AplicareDeleteRoom(c *gin.Context) {
	var input struct {
		KodeKelas string `json:"kode_kelas" binding:"required"`
		KodeRuang string `json:"kode_ruang" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kode_kelas dan kode_ruang wajib diisi"})
		return
	}

	client, err := bpjsService.NewAplicareClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menginisialisasi Aplicare client: %v", err)})
		return
	}

	if err := client.DeleteBed(input.KodeKelas, input.KodeRuang); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menghapus ruangan dari Aplicare: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Ruangan %s kelas %s berhasil dihapus dari Aplicare", input.KodeRuang, input.KodeKelas),
	})
}

// AplicareGetRooms mengambil daftar ruangan rawat inap SIMRS yang memiliki bed
func AplicareGetRooms(c *gin.Context) {
	var rooms []models.Room
	if err := database.DB.Where("has_bed = ? AND is_active = ?", true, true).
		Order("name ASC").
		Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data ruangan"})
		return
	}

	// Compute bed stats for each room
	for i := range rooms {
		rooms[i].ComputeBedStats(database.DB)
	}

	c.JSON(http.StatusOK, gin.H{"data": rooms})
}
