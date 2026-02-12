package handlers

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ===========================================================================
// BUILDING (GEDUNG) CRUD
// ===========================================================================

// GetBuildings returns all buildings with computed bed stats
func GetBuildings(c *gin.Context) {
	var buildings []models.Building

	db := database.DB.Where("1=1")

	if isActive := c.Query("is_active"); isActive != "" {
		db = db.Where("is_active = ?", isActive == "true")
	}

	if search := c.Query("search"); search != "" {
		db = db.Where("LOWER(name) LIKE ? OR LOWER(code) LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	if err := db.Order("name ASC").Find(&buildings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data gedung"})
		return
	}

	// Compute bed stats per building
	type BuildingStats struct {
		BuildingID    uint `json:"building_id"`
		TotalRooms    int  `json:"total_rooms"`
		TotalBeds     int  `json:"total_beds"`
		AvailableBeds int  `json:"available_beds"`
	}

	var stats []BuildingStats
	database.DB.Raw(`
		SELECT r.building_id,
			COUNT(DISTINCT r.id) as total_rooms,
			COUNT(b.id) as total_beds,
			COUNT(CASE WHEN b.status = 'available' THEN 1 END) as available_beds
		FROM rooms r
		LEFT JOIN room_units ru ON ru.room_id = r.id AND ru.deleted_at IS NULL
		LEFT JOIN beds b ON b.room_unit_id = ru.id AND b.deleted_at IS NULL
		WHERE r.building_id IS NOT NULL AND r.deleted_at IS NULL AND r.has_bed = true
		GROUP BY r.building_id
	`).Scan(&stats)

	statsMap := make(map[uint]BuildingStats)
	for _, s := range stats {
		statsMap[s.BuildingID] = s
	}

	type BuildingResponse struct {
		models.Building
		TotalRooms    int `json:"total_rooms"`
		TotalBeds     int `json:"total_beds"`
		AvailableBeds int `json:"available_beds"`
	}

	var result []BuildingResponse
	for _, b := range buildings {
		s := statsMap[b.ID]
		result = append(result, BuildingResponse{
			Building:      b,
			TotalRooms:    s.TotalRooms,
			TotalBeds:     s.TotalBeds,
			AvailableBeds: s.AvailableBeds,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetBuilding returns a single building with rooms
func GetBuilding(c *gin.Context) {
	id := c.Param("id")

	var building models.Building
	if err := database.DB.First(&building, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gedung tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": building})
}

// CreateBuilding creates a new building
func CreateBuilding(c *gin.Context) {
	var input struct {
		Code        string `json:"code" binding:"required"`
		Name        string `json:"name" binding:"required"`
		TotalFloors int    `json:"total_floors"`
		Description string `json:"description"`
		Color       string `json:"color"`
		PositionX   int    `json:"position_x"`
		PositionY   int    `json:"position_y"`
		Width       int    `json:"width"`
		Height      int    `json:"height"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check unique code
	var existing models.Building
	if err := database.DB.Where("code = ?", input.Code).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode gedung sudah digunakan"})
		return
	}

	building := models.Building{
		Code:        input.Code,
		Name:        input.Name,
		TotalFloors: input.TotalFloors,
		Description: input.Description,
		Color:       input.Color,
		IsActive:    true,
		PositionX:   input.PositionX,
		PositionY:   input.PositionY,
		Width:       input.Width,
		Height:      input.Height,
	}

	if building.TotalFloors == 0 {
		building.TotalFloors = 1
	}
	if building.Width == 0 {
		building.Width = 400
	}
	if building.Height == 0 {
		building.Height = 300
	}
	if building.Color == "" {
		building.Color = "#e3f2fd"
	}

	if err := database.DB.Create(&building).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat gedung"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": building, "message": "Gedung berhasil dibuat"})
}

// UpdateBuilding updates a building
func UpdateBuilding(c *gin.Context) {
	id := c.Param("id")

	var building models.Building
	if err := database.DB.First(&building, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gedung tidak ditemukan"})
		return
	}

	var input struct {
		Code        string `json:"code"`
		Name        string `json:"name"`
		TotalFloors int    `json:"total_floors"`
		Description string `json:"description"`
		Color       string `json:"color"`
		IsActive    *bool  `json:"is_active"`
		PositionX   *int   `json:"position_x"`
		PositionY   *int   `json:"position_y"`
		Width       *int   `json:"width"`
		Height      *int   `json:"height"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check unique code if changed
	if input.Code != "" && input.Code != building.Code {
		var existing models.Building
		if err := database.DB.Where("code = ? AND id != ?", input.Code, building.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode gedung sudah digunakan"})
			return
		}
		building.Code = input.Code
	}

	if input.Name != "" {
		building.Name = input.Name
	}
	if input.TotalFloors > 0 {
		building.TotalFloors = input.TotalFloors
	}
	if input.Description != "" {
		building.Description = input.Description
	}
	if input.Color != "" {
		building.Color = input.Color
	}
	if input.IsActive != nil {
		building.IsActive = *input.IsActive
	}
	if input.PositionX != nil {
		building.PositionX = *input.PositionX
	}
	if input.PositionY != nil {
		building.PositionY = *input.PositionY
	}
	if input.Width != nil {
		building.Width = *input.Width
	}
	if input.Height != nil {
		building.Height = *input.Height
	}

	if err := database.DB.Save(&building).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate gedung"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": building, "message": "Gedung berhasil diupdate"})
}

// DeleteBuilding soft-deletes a building
func DeleteBuilding(c *gin.Context) {
	id := c.Param("id")

	var building models.Building
	if err := database.DB.First(&building, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gedung tidak ditemukan"})
		return
	}

	// Check if building has rooms assigned
	var roomCount int64
	database.DB.Model(&models.Room{}).Where("building_id = ?", id).Count(&roomCount)
	if roomCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gedung masih memiliki ruangan. Pindahkan ruangan terlebih dahulu."})
		return
	}

	if err := database.DB.Delete(&building).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus gedung"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Gedung berhasil dihapus"})
}

// ===========================================================================
// FLOOR PLAN LAYOUT — Get full layout data for interactive map
// ===========================================================================

// GetFloorPlanLayout returns complete floor plan data (buildings + rooms + units + beds with positions)
func GetFloorPlanLayout(c *gin.Context) {
	// Optional filter by building
	buildingID := c.Query("building_id")
	floor := c.Query("floor")

	var buildings []models.Building
	bQuery := database.DB.Where("is_active = true").Order("name ASC")
	if buildingID != "" {
		bQuery = bQuery.Where("id = ?", buildingID)
	}
	if err := bQuery.Find(&buildings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data gedung"})
		return
	}

	type BedData struct {
		ID             uint               `json:"id"`
		BedNumber      string             `json:"bed_number"`
		BedType        string             `json:"bed_type"`
		Status         string             `json:"status"`
		PositionX      int                `json:"position_x"`
		PositionY      int                `json:"position_y"`
		Width          int                `json:"width"`
		Height         int                `json:"height"`
		CurrentPatient *models.BedPatient `json:"current_patient,omitempty"`
	}

	type UnitData struct {
		ID        uint      `json:"id"`
		Code      string    `json:"code"`
		Name      string    `json:"name"`
		Floor     int       `json:"floor"`
		Capacity  int       `json:"capacity"`
		PositionX int       `json:"position_x"`
		PositionY int       `json:"position_y"`
		Width     int       `json:"width"`
		Height    int       `json:"height"`
		Beds      []BedData `json:"beds"`
	}

	type RoomData struct {
		ID          uint       `json:"id"`
		Code        string     `json:"code"`
		Name        string     `json:"name"`
		ServiceType string     `json:"service_type"`
		RoomType    string     `json:"room_type"`
		RoomClass   string     `json:"room_class"`
		TotalFloors int        `json:"total_floors"`
		Units       []UnitData `json:"units"`
	}

	type BuildingData struct {
		ID          uint       `json:"id"`
		Code        string     `json:"code"`
		Name        string     `json:"name"`
		TotalFloors int        `json:"total_floors"`
		Color       string     `json:"color"`
		PositionX   int        `json:"position_x"`
		PositionY   int        `json:"position_y"`
		Width       int        `json:"width"`
		Height      int        `json:"height"`
		Rooms       []RoomData `json:"rooms"`
	}

	var result []BuildingData

	for _, b := range buildings {
		bd := BuildingData{
			ID:          b.ID,
			Code:        b.Code,
			Name:        b.Name,
			TotalFloors: b.TotalFloors,
			Color:       b.Color,
			PositionX:   b.PositionX,
			PositionY:   b.PositionY,
			Width:       b.Width,
			Height:      b.Height,
		}

		// Get rooms for this building (only rooms with beds for floor plan)
		var rooms []models.Room
		rQuery := database.DB.Where("building_id = ? AND is_active = true AND has_bed = true", b.ID).
			Order("name ASC")
		rQuery.Find(&rooms)

		for _, r := range rooms {
			rd := RoomData{
				ID:          r.ID,
				Code:        r.Code,
				Name:        r.Name,
				ServiceType: r.ServiceType,
				RoomType:    r.RoomType,
				RoomClass:   r.RoomClass,
				TotalFloors: r.TotalFloors,
			}

			// Get units (kamar) for this room
			var units []models.RoomUnit
			uQuery := database.DB.Where("room_id = ? AND is_active = true", r.ID).
				Preload("Beds").
				Order("floor ASC, code ASC")
			if floor != "" {
				uQuery = uQuery.Where("floor = ?", floor)
			}
			uQuery.Find(&units)

			for _, u := range units {
				ud := UnitData{
					ID:        u.ID,
					Code:      u.Code,
					Name:      u.Name,
					Floor:     u.Floor,
					Capacity:  u.Capacity,
					PositionX: u.PositionX,
					PositionY: u.PositionY,
					Width:     u.Width,
					Height:    u.Height,
				}

				// Process beds with patient data
				for _, bed := range u.Beds {
					bedData := BedData{
						ID:        bed.ID,
						BedNumber: bed.BedNumber,
						BedType:   bed.BedType,
						Status:    bed.Status,
						PositionX: bed.PositionX,
						PositionY: bed.PositionY,
						Width:     bed.Width,
						Height:    bed.Height,
					}

					// If bed is occupied, load patient info
					if bed.Status == "occupied" {
						bedData.CurrentPatient = loadBedPatientForFloorPlan(bed.ID)
					}

					ud.Beds = append(ud.Beds, bedData)
				}

				rd.Units = append(rd.Units, ud)
			}

			bd.Rooms = append(bd.Rooms, rd)
		}

		result = append(result, bd)
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// loadBedPatientForFloorPlan loads current patient information for an occupied bed
func loadBedPatientForFloorPlan(bedID uint) *models.BedPatient {
	var visit models.Visit
	err := database.DB.
		Where("bed_id = ? AND status IN ?", bedID, []string{"in_progress", "waiting"}).
		Preload("Registration.Patient").
		Preload("Doctor").
		Preload("Room").
		First(&visit).Error
	if err != nil {
		return nil
	}

	if visit.Registration == nil || visit.Registration.Patient == nil {
		return nil
	}

	patient := visit.Registration.Patient
	bp := &models.BedPatient{
		Name:                patient.NamaLengkap,
		MedicalRecordNumber: patient.NoRM,
		NIK:                 patient.NIK,
		Gender:              string(patient.JenisKelamin),
		InsuranceType:       string(patient.JenisJaminan),
		InsuranceNumber:     patient.NoBPJS,
		AdmissionDate:       visit.AdmissionTime,
		VisitID:             visit.ID,
		PatientID:           patient.ID,
	}

	if patient.TanggalLahir != nil {
		birthTime := patient.TanggalLahir.Time
		bp.BirthDate = &birthTime
		age := time.Now().Year() - birthTime.Year()
		if time.Now().YearDay() < birthTime.YearDay() {
			age--
		}
		bp.Age = age
	}

	if visit.Doctor != nil {
		bp.DoctorName = visit.Doctor.NamaLengkap
	}
	if visit.Room != nil {
		bp.RoomName = visit.Room.Name
	}

	// Get primary diagnosis
	var diagnosis models.Diagnosis
	if err := database.DB.Where("visit_id = ? AND type = 'primary'", visit.ID).First(&diagnosis).Error; err == nil {
		bp.Diagnosis = diagnosis.ICD10Code + " - " + diagnosis.ICD10Name
	}

	return bp
}

// ===========================================================================
// SAVE FLOOR PLAN LAYOUT — Batch save positions and sizes
// ===========================================================================

// SaveFloorPlanLayout batch saves position/size for buildings, units, and beds
func SaveFloorPlanLayout(c *gin.Context) {
	var input struct {
		Buildings []struct {
			ID        uint `json:"id" binding:"required"`
			PositionX int  `json:"position_x"`
			PositionY int  `json:"position_y"`
			Width     int  `json:"width"`
			Height    int  `json:"height"`
		} `json:"buildings"`
		Units []struct {
			ID        uint `json:"id" binding:"required"`
			PositionX int  `json:"position_x"`
			PositionY int  `json:"position_y"`
			Width     int  `json:"width"`
			Height    int  `json:"height"`
		} `json:"units"`
		Beds []struct {
			ID        uint `json:"id" binding:"required"`
			PositionX int  `json:"position_x"`
			PositionY int  `json:"position_y"`
			Width     int  `json:"width"`
			Height    int  `json:"height"`
		} `json:"beds"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.DB.Begin()

	// Update building positions
	for _, b := range input.Buildings {
		if err := tx.Model(&models.Building{}).Where("id = ?", b.ID).Updates(map[string]interface{}{
			"position_x": b.PositionX,
			"position_y": b.PositionY,
			"width":      b.Width,
			"height":     b.Height,
		}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan posisi gedung"})
			return
		}
	}

	// Update unit positions
	for _, u := range input.Units {
		if err := tx.Model(&models.RoomUnit{}).Where("id = ?", u.ID).Updates(map[string]interface{}{
			"position_x": u.PositionX,
			"position_y": u.PositionY,
			"width":      u.Width,
			"height":     u.Height,
		}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan posisi kamar"})
			return
		}
	}

	// Update bed positions
	for _, b := range input.Beds {
		if err := tx.Model(&models.Bed{}).Where("id = ?", b.ID).Updates(map[string]interface{}{
			"position_x": b.PositionX,
			"position_y": b.PositionY,
			"width":      b.Width,
			"height":     b.Height,
		}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan posisi bed"})
			return
		}
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Layout berhasil disimpan"})
}

// ===========================================================================
// BEDSIDE SUMMARY — Aggregated view for doctor bedside visit
// ===========================================================================

// GetBedsideSummary returns aggregated patient data for bedside view
func GetBedsideSummary(c *gin.Context) {
	visitID := c.Param("id")

	// Load visit with all relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		Preload("Bed.RoomUnit.Room").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Verify this is an inpatient visit
	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bedside view hanya untuk rawat inap"})
		return
	}

	var patientID uint
	if visit.Registration != nil && visit.Registration.Patient != nil {
		patientID = visit.Registration.Patient.ID
	}

	// 1. Patient Allergies
	var allergies []models.PatientAllergy
	if patientID > 0 {
		database.DB.Where("patient_id = ? AND is_active = true", patientID).
			Order("criticality DESC, category ASC").
			Find(&allergies)
	}

	// 2. Diagnoses
	var diagnoses []models.Diagnosis
	database.DB.Where("visit_id = ?", visitID).
		Preload("DiagnosedBy").
		Order("type ASC, created_at ASC").
		Find(&diagnoses)

	// 3. Last 5 CPPT entries
	var cppts []models.CPPT
	database.DB.Where("visit_id = ?", visitID).
		Preload("CreatedBy").
		Preload("VerifiedBy").
		Order("record_date DESC, created_at DESC").
		Limit(5).
		Find(&cppts)

	// 4. Active Medicine Orders
	var medicineOrders []models.MedicineOrder
	database.DB.Where("source_visit_id = ? AND status IN ?", visitID, []string{"pending", "reviewed", "dispensed", "partial"}).
		Preload("Items.Medicine").
		Preload("Prescriber").
		Order("created_at DESC").
		Find(&medicineOrders)

	// 5. Lab/Radiology Results (last 5 completed)
	var procedureOrders []models.ProcedureOrder
	database.DB.Where("source_visit_id = ? AND status IN ?", visitID, []string{"completed", "partial"}).
		Preload("Items.Procedure").
		Preload("Items.Results").
		Order("created_at DESC").
		Limit(5).
		Find(&procedureOrders)

	// 6. Fluid Balance (last 24h summary)
	yesterday := time.Now().Add(-24 * time.Hour)
	var fluidBalances []models.FluidBalance
	database.DB.Where("visit_id = ? AND record_date >= ?", visitID, yesterday).
		Order("record_date DESC").
		Find(&fluidBalances)

	// Calculate fluid balance summary
	var totalIntake, totalOutput float64
	for _, fb := range fluidBalances {
		totalIntake += fb.TotalIntake
		totalOutput += fb.TotalOutput
	}

	// 7. Latest vital signs (from CPPT or VitalSign table)
	var latestVitals *models.VitalSign
	var vs models.VitalSign
	if err := database.DB.Where("visit_id = ?", visitID).
		Order("measured_at DESC").
		First(&vs).Error; err == nil {
		latestVitals = &vs
	}

	// 8. Vital sign trend (last 7 readings)
	var vitalTrend []models.VitalSign
	database.DB.Where("visit_id = ?", visitID).
		Order("measured_at DESC").
		Limit(7).
		Find(&vitalTrend)

	// 9. Anamnesis (for chief complaint)
	var anamnesis models.Anamnesis
	database.DB.Where("visit_id = ?", visitID).First(&anamnesis)

	// 10. Assessment Plan
	var assessmentPlan models.AssessmentPlan
	database.DB.Where("visit_id = ?", visitID).First(&assessmentPlan)

	// 11. Calculate days of stay
	var daysOfStay int
	if visit.AdmissionTime != nil {
		daysOfStay = int(math.Ceil(time.Since(*visit.AdmissionTime).Hours() / 24))
		if daysOfStay < 1 {
			daysOfStay = 1
		}
	}

	// Build response
	response := gin.H{
		"visit":            visit,
		"allergies":        allergies,
		"diagnoses":        diagnoses,
		"cppts":            cppts,
		"medicine_orders":  medicineOrders,
		"procedure_orders": procedureOrders,
		"fluid_balance": gin.H{
			"records":      fluidBalances,
			"total_intake": totalIntake,
			"total_output": totalOutput,
			"balance":      totalIntake - totalOutput,
		},
		"latest_vitals":   latestVitals,
		"vital_trend":     vitalTrend,
		"anamnesis":       anamnesis,
		"assessment_plan": assessmentPlan,
		"days_of_stay":    daysOfStay,
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
}

// ===========================================================================
// ASSIGN ROOM TO BUILDING
// ===========================================================================

// AssignRoomToBuilding assigns a room to a building
func AssignRoomToBuilding(c *gin.Context) {
	buildingID := c.Param("id")

	var input struct {
		RoomID uint `json:"room_id" binding:"required"`
		Floor  int  `json:"floor"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Floor == 0 {
		input.Floor = 1
	}

	// Verify building exists
	var building models.Building
	if err := database.DB.First(&building, buildingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gedung tidak ditemukan"})
		return
	}

	// Verify room exists
	var room models.Room
	if err := database.DB.First(&room, input.RoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	bID, _ := strconv.ParseUint(buildingID, 10, 32)
	bIDUint := uint(bID)
	room.BuildingID = &bIDUint

	if err := database.DB.Save(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal assign ruangan ke gedung"})
		return
	}

	// Update floor for all units in this room
	if err := database.DB.Model(&models.RoomUnit{}).Where("room_id = ?", room.ID).Update("floor", input.Floor).Error; err != nil {
		// Non-fatal: room assigned but floor update failed
		c.JSON(http.StatusOK, gin.H{"data": room, "message": "Ruangan berhasil di-assign, namun gagal set lantai"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": room, "message": "Ruangan berhasil di-assign ke gedung"})
}

// UnassignRoomFromBuilding removes a room from a building
func UnassignRoomFromBuilding(c *gin.Context) {
	roomID := c.Param("room_id")

	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	room.BuildingID = nil
	if err := database.DB.Save(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal unassign ruangan dari gedung"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ruangan berhasil di-unassign dari gedung"})
}

// GetBuildingRooms returns all rooms assigned to a building
func GetBuildingRooms(c *gin.Context) {
	buildingID := c.Param("id")
	floorParam := c.Query("floor")

	var rooms []models.Room
	query := database.DB.Where("building_id = ? AND is_active = true", buildingID)

	// Filter by has_bed if specified
	if hasBed := c.Query("has_bed"); hasBed == "true" {
		query = query.Where("has_bed = true")
	}

	if err := query.Preload("Units", func(db *gorm.DB) *gorm.DB {
		q := db.Where("is_active = true").Order("floor ASC, code ASC")
		if floorParam != "" {
			q = q.Where("floor = ?", floorParam)
		}
		return q
	}).Preload("Units.Beds").
		Order("name ASC").
		Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data ruangan"})
		return
	}

	// Compute bed stats per room
	for i := range rooms {
		rooms[i].ComputeBedStats(database.DB)
	}

	c.JSON(http.StatusOK, gin.H{"data": rooms})
}
