package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	bpjsService "starter/backend/services/bpjs"
	"strconv"
	"strings"

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
		RoomID               uint   `json:"room_id" binding:"required"`
		KodeKelas            string `json:"kodekelas"`
		KodeRuang            string `json:"koderuang"`
		NamaRuang            string `json:"namaruang"`
		Kapasitas            string `json:"kapasitas"`
		Tersedia             string `json:"tersedia"`
		TersediaPria         string `json:"tersediapria"`
		TersediaWanita       string `json:"tersediawanita"`
		TersediaPriaWanita   string `json:"tersediapriawanita"`
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

	// Compute bed stats per unit (Kamar)
	unitStats := room.ComputeBedStatsByUnit(database.DB)

	client, err := bpjsService.NewAplicareClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menginisialisasi Aplicare client: %v", err)})
		return
	}

	var successResponses []bpjsService.AplicareBedRequest
	var errors []string

	for _, stat := range unitStats {
		kodeKelas := bpjsService.MapRoomClassToAplicare(stat.Class)

		unitCode := stat.UnitCode
		if unitCode == "" {
			unitCode = fmt.Sprintf("%s-%d", room.Code, stat.UnitID)
		}

		if len(unitCode) > 10 {
			unitCode = unitCode[:10]
		}

		req := bpjsService.AplicareBedRequest{
			KodeKelas:          kodeKelas,
			KodeRuang:          unitCode,
			NamaRuang:          stat.UnitName,
			Kapasitas:          strconv.Itoa(stat.TotalBeds),
			Tersedia:           strconv.Itoa(stat.AvailableBeds),
			TersediaPria:       "0",
			TersediaWanita:     "0",
			TersediaPriaWanita: "0",
		}

		// override if specific values provided in request payload
		if input.KodeKelas != "" {
			req.KodeKelas = input.KodeKelas
		}
		if input.KodeRuang != "" {
			req.KodeRuang = input.KodeRuang
		}
		if input.NamaRuang != "" {
			req.NamaRuang = input.NamaRuang
		}
		if input.Kapasitas != "" {
			req.Kapasitas = input.Kapasitas
		}
		if input.Tersedia != "" {
			req.Tersedia = input.Tersedia
		}
		if input.TersediaPria != "" {
			req.TersediaPria = input.TersediaPria
		}
		if input.TersediaWanita != "" {
			req.TersediaWanita = input.TersediaWanita
		}
		if input.TersediaPriaWanita != "" {
			req.TersediaPriaWanita = input.TersediaPriaWanita
		}

		var missingFields []string
		if req.KodeKelas == "" {
			missingFields = append(missingFields, "KodeKelas")
		}
		if req.KodeRuang == "" {
			missingFields = append(missingFields, "KodeRuang")
		}
		if req.NamaRuang == "" {
			missingFields = append(missingFields, "NamaRuang")
		}
		if req.Kapasitas == "" {
			missingFields = append(missingFields, "Kapasitas")
		}
		if req.Tersedia == "" {
			missingFields = append(missingFields, "Tersedia")
		}

		if len(missingFields) > 0 {
			errors = append(errors, fmt.Sprintf("Field request Aplicare belum lengkap (%s) untuk kamar %s (kelas %s)", strings.Join(missingFields, ", "), stat.UnitName, stat.Class))
			continue
		}

		if err := client.CreateBed(req); err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "sudah ada") {
				if updateErr := client.UpdateBed(req); updateErr != nil {
					errors = append(errors, fmt.Sprintf("Gagal mendaftarkan kamar %s: %v (update fallback failed: %v)", stat.UnitName, err, updateErr))
				} else {
					successResponses = append(successResponses, req)
				}
			} else {
				errors = append(errors, fmt.Sprintf("Gagal mendaftarkan kamar %s: %v", stat.UnitName, err))
			}
		} else {
			successResponses = append(successResponses, req)
		}
	}

	if len(errors) > 0 && len(successResponses) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": strings.Join(errors, ", ")})
		return
	}

	message := fmt.Sprintf("Berhasil mendaftarkan %d kelas ruangan %s ke Aplicare", len(successResponses), room.Name)
	if len(errors) > 0 {
		message += fmt.Sprintf(" (dengan %d error: %s)", len(errors), strings.Join(errors, ", "))
	}

	c.JSON(http.StatusOK, gin.H{
		"message": message,
		"data":    successResponses,
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

	unitStats := room.ComputeBedStatsByUnit(database.DB)

	client, err := bpjsService.NewAplicareClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menginisialisasi Aplicare client: %v", err)})
		return
	}

	var successResponses []bpjsService.AplicareBedRequest
	var errors []string

	for _, stat := range unitStats {
		kodeKelas := bpjsService.MapRoomClassToAplicare(stat.Class)

		kodeRuang := stat.UnitCode
		if kodeRuang == "" {
			kodeRuang = fmt.Sprintf("%s-%d", room.Code, stat.UnitID)
		}
		
		// BPJS Aplicare implicitly truncates KodeRuang to 10 characters
		if len(kodeRuang) > 10 {
			kodeRuang = kodeRuang[:10]
		}

		namaRuang := stat.UnitName
		if namaRuang == "" {
			namaRuang = room.Name
		}

		req := bpjsService.AplicareBedRequest{
			KodeKelas:          kodeKelas,
			KodeRuang:          kodeRuang,
			NamaRuang:          namaRuang,
			Kapasitas:          strconv.Itoa(stat.TotalBeds),
			Tersedia:           strconv.Itoa(stat.AvailableBeds),
			TersediaPria:       "0",
			TersediaWanita:     "0",
			TersediaPriaWanita: "0",
		}

		if err := client.UpdateBed(req); err != nil {
			errStr := strings.ToLower(err.Error())
			if strings.Contains(errStr, "tidak ditemukan") || strings.Contains(errStr, "data tidak ada") {
				if createErr := client.CreateBed(req); createErr != nil {
					errors = append(errors, fmt.Sprintf("Gagal mengupdate kamar %s: %v (create fallback failed: %v)", stat.UnitName, err, createErr))
				} else {
					successResponses = append(successResponses, req)
				}
			} else {
				errors = append(errors, fmt.Sprintf("Gagal mengupdate kamar %s: %v", stat.UnitName, err))
			}
		} else {
			successResponses = append(successResponses, req)
		}
	}

	if len(errors) > 0 && len(successResponses) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": strings.Join(errors, ", ")})
		return
	}

	message := fmt.Sprintf("Ketersediaan tempat tidur %d kelas ruangan %s berhasil diupdate", len(successResponses), room.Name)
	if len(errors) > 0 {
		message += fmt.Sprintf(" (dengan %d error: %s)", len(errors), strings.Join(errors, ", "))
	}

	c.JSON(http.StatusOK, gin.H{
		"message": message,
		"data":    successResponses,
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
	if err := database.DB.Preload("Units").Where("has_bed = ? AND is_active = ?", true, true).
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
