package handlers

import (
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ===========================================================================
// MEDICAL RECORD ARCHIVE HANDLERS
// ===========================================================================

// GetArchives returns paginated list of medical record archives
func GetArchives(c *gin.Context) {
	var archives []models.MedicalRecordArchive
	db := database.DB

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	// Filters
	status := c.Query("status")
	location := c.Query("location")
	search := c.Query("search")
	isDigitized := c.Query("is_digitized")
	overdueOnly := c.Query("overdue_only")

	query := db.Model(&models.MedicalRecordArchive{})

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if location != "" {
		query = query.Where("location = ?", location)
	}
	if search != "" {
		query = query.Where("no_rm ILIKE ? OR location_code ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if isDigitized == "true" {
		query = query.Where("is_digitized = true")
	} else if isDigitized == "false" {
		query = query.Where("is_digitized = false")
	}
	if overdueOnly == "true" {
		query = query.Where("scheduled_archive_date < ?", time.Now())
	}

	var total int64
	query.Count(&total)

	if err := query.
		Preload("Patient").
		Order("last_visit_date DESC NULLS LAST").
		Offset(offset).
		Limit(limit).
		Find(&archives).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       archives,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + int64(limit) - 1) / int64(limit),
	})
}

// GetArchiveByID returns a single archive by ID
func GetArchiveByID(c *gin.Context) {
	id := c.Param("id")
	var archive models.MedicalRecordArchive

	if err := database.DB.
		Preload("Patient").
		Preload("CreatedBy").
		Preload("UpdatedBy").
		Preload("DigitizedBy").
		First(&archive, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Archive not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, archive)
}

// GetArchiveByPatient returns archive for a specific patient
func GetArchiveByPatient(c *gin.Context) {
	patientID := c.Param("patientId")
	var archive models.MedicalRecordArchive

	if err := database.DB.
		Preload("Patient").
		Where("patient_id = ?", patientID).
		First(&archive).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Archive not found for this patient"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, archive)
}

// CreateOrUpdateArchive creates or updates an archive record
func CreateOrUpdateArchive(c *gin.Context) {
	var input models.MedicalRecordArchive
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	uid := userID.(uint)

	// Check if archive already exists for this patient
	var existing models.MedicalRecordArchive
	err := database.DB.Where("patient_id = ?", input.PatientID).First(&existing).Error

	if err == gorm.ErrRecordNotFound {
		// Create new
		input.CreatedByID = &uid
		input.UpdatedByID = &uid
		if err := database.DB.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, input)
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update existing
	input.ID = existing.ID
	input.UpdatedByID = &uid
	if err := database.DB.Model(&existing).Updates(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, input)
}

// UpdateArchiveLocation updates the physical location of an archive
func UpdateArchiveLocation(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Location     models.ArchiveLocation `json:"location"`
		LocationCode string                 `json:"location_code"`
		ShelfNumber  string                 `json:"shelf_number"`
		BoxNumber    string                 `json:"box_number"`
		Notes        string                 `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var archive models.MedicalRecordArchive
	if err := database.DB.First(&archive, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Archive not found"})
		return
	}

	userID, _ := c.Get("userID")
	uid := userID.(uint)

	// Record the movement
	movement := models.ArchiveMovement{
		ArchiveID:        archive.ID,
		NoRM:             archive.NoRM,
		MovementType:     "transfer",
		FromLocation:     archive.Location,
		FromLocationCode: archive.LocationCode,
		ToLocation:       input.Location,
		ToLocationCode:   input.LocationCode,
		BorrowedAt:       time.Now(),
		ProcessedByID:    &uid,
		Status:           "completed",
		Notes:            input.Notes,
	}

	if err := database.DB.Create(&movement).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update archive location
	updates := map[string]interface{}{
		"location":      input.Location,
		"location_code": input.LocationCode,
		"shelf_number":  input.ShelfNumber,
		"box_number":    input.BoxNumber,
		"updated_by_id": uid,
	}

	if err := database.DB.Model(&archive).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Location updated successfully"})
}

// BorrowArchive records borrowing of a physical archive
func BorrowArchive(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		BorrowedByID   *uint  `json:"borrowed_by_id"`
		BorrowedByName string `json:"borrowed_by_name"`
		BorrowReason   string `json:"borrow_reason"`
		DueDays        int    `json:"due_days"`
		Notes          string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var archive models.MedicalRecordArchive
	if err := database.DB.First(&archive, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Archive not found"})
		return
	}

	userID, _ := c.Get("userID")
	uid := userID.(uint)

	// Default due days
	dueDays := input.DueDays
	if dueDays == 0 {
		dueDays = 3
	}
	dueDate := time.Now().AddDate(0, 0, dueDays)

	movement := models.ArchiveMovement{
		ArchiveID:      archive.ID,
		NoRM:           archive.NoRM,
		MovementType:   "borrow",
		BorrowedByID:   input.BorrowedByID,
		BorrowedByName: input.BorrowedByName,
		BorrowReason:   input.BorrowReason,
		BorrowedAt:     time.Now(),
		DueDate:        &dueDate,
		ProcessedByID:  &uid,
		Status:         "active",
		Notes:          input.Notes,
	}

	if err := database.DB.Create(&movement).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update last access date
	now := time.Now()
	database.DB.Model(&archive).Update("last_access_date", now)

	c.JSON(http.StatusCreated, movement)
}

// ReturnArchive records return of a borrowed archive
func ReturnArchive(c *gin.Context) {
	_ = c.Param("id") // archive ID from URL, validated via movement
	var input struct {
		MovementID uint   `json:"movement_id" binding:"required"`
		Notes      string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var movement models.ArchiveMovement
	if err := database.DB.First(&movement, input.MovementID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Movement not found"})
		return
	}

	if movement.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This record has already been returned"})
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"returned_at": now,
		"status":      "returned",
		"notes":       input.Notes,
	}

	if err := database.DB.Model(&movement).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Archive returned successfully"})
}

// GetArchiveMovements returns movement history for an archive
func GetArchiveMovements(c *gin.Context) {
	id := c.Param("id")
	var movements []models.ArchiveMovement

	if err := database.DB.
		Preload("BorrowedBy").
		Preload("ProcessedBy").
		Where("archive_id = ?", id).
		Order("created_at DESC").
		Find(&movements).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movements)
}

// GetBorrowedArchives returns list of currently borrowed archives
func GetBorrowedArchives(c *gin.Context) {
	var movements []models.ArchiveMovement

	query := database.DB.
		Preload("Archive").
		Preload("Archive.Patient").
		Preload("BorrowedBy").
		Where("movement_type = ? AND status = ?", "borrow", "active")

	overdueOnly := c.Query("overdue_only")
	if overdueOnly == "true" {
		query = query.Where("due_date < ?", time.Now())
	}

	if err := query.Order("due_date ASC").Find(&movements).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movements)
}

// GetArchiveStatistics returns statistics about the archive
func GetArchiveStatistics(c *gin.Context) {
	var stats struct {
		TotalRecords      int64 `json:"total_records"`
		ActiveRecords     int64 `json:"active_records"`
		InactiveRecords   int64 `json:"inactive_records"`
		ArchivedRecords   int64 `json:"archived_records"`
		DigitizedRecords  int64 `json:"digitized_records"`
		BorrowedRecords   int64 `json:"borrowed_records"`
		OverdueRecords    int64 `json:"overdue_records"`
		DueForArchival    int64 `json:"due_for_archival"`
		DueForDestruction int64 `json:"due_for_destruction"`
	}

	db := database.DB

	db.Model(&models.MedicalRecordArchive{}).Count(&stats.TotalRecords)
	db.Model(&models.MedicalRecordArchive{}).Where("status = ?", "active").Count(&stats.ActiveRecords)
	db.Model(&models.MedicalRecordArchive{}).Where("status = ?", "inactive").Count(&stats.InactiveRecords)
	db.Model(&models.MedicalRecordArchive{}).Where("status = ?", "archived").Count(&stats.ArchivedRecords)
	db.Model(&models.MedicalRecordArchive{}).Where("is_digitized = true").Count(&stats.DigitizedRecords)
	db.Model(&models.ArchiveMovement{}).Where("movement_type = ? AND status = ?", "borrow", "active").Count(&stats.BorrowedRecords)
	db.Model(&models.ArchiveMovement{}).Where("movement_type = ? AND status = ? AND due_date < ?", "borrow", "active", time.Now()).Count(&stats.OverdueRecords)
	db.Model(&models.MedicalRecordArchive{}).Where("scheduled_archive_date < ? AND status = ?", time.Now(), "active").Count(&stats.DueForArchival)
	db.Model(&models.MedicalRecordArchive{}).Where("scheduled_destroy_date < ? AND status = ?", time.Now(), "archived").Count(&stats.DueForDestruction)

	c.JSON(http.StatusOK, stats)
}

// ===========================================================================
// ARCHIVE DESTRUCTION HANDLERS
// ===========================================================================

// ProposeDestruction creates a new destruction batch proposal
func ProposeDestruction(c *gin.Context) {
	var input struct {
		DestructionDate time.Time `json:"destruction_date" binding:"required"`
		DestructionType string    `json:"destruction_type" binding:"required"`
		ArchiveIDs      []uint    `json:"archive_ids" binding:"required"`
		Notes           string    `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	uid := userID.(uint)

	// Generate batch number
	batchNumber := "DES-" + time.Now().Format("20060102") + "-" + strconv.FormatInt(time.Now().Unix()%10000, 10)

	destruction := models.ArchiveDestruction{
		BatchNumber:     batchNumber,
		DestructionDate: input.DestructionDate,
		DestructionType: input.DestructionType,
		TotalRecords:    len(input.ArchiveIDs),
		ProposedByID:    &uid,
		ProposedAt:      time.Now(),
		Status:          "proposed",
		Notes:           input.Notes,
	}

	tx := database.DB.Begin()

	if err := tx.Create(&destruction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create destruction items
	for _, archiveID := range input.ArchiveIDs {
		var archive models.MedicalRecordArchive
		if err := tx.Preload("Patient").First(&archive, archiveID).Error; err != nil {
			continue
		}

		item := models.ArchiveDestructionItem{
			DestructionID: destruction.ID,
			ArchiveID:     archiveID,
			NoRM:          archive.NoRM,
			PatientName:   archive.Patient.NamaLengkap,
			LastVisit:     archive.LastVisitDate,
			TotalPages:    archive.TotalPages,
		}

		tx.Create(&item)
	}

	tx.Commit()

	c.JSON(http.StatusCreated, destruction)
}

// ApproveDestruction approves a destruction batch
func ApproveDestruction(c *gin.Context) {
	id := c.Param("id")
	var destruction models.ArchiveDestruction

	if err := database.DB.First(&destruction, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Destruction batch not found"})
		return
	}

	if destruction.Status != "proposed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only proposed batches can be approved"})
		return
	}

	userID, _ := c.Get("userID")
	uid := userID.(uint)
	now := time.Now()

	updates := map[string]interface{}{
		"approved_by_id": uid,
		"approved_at":    now,
		"status":         "approved",
	}

	if err := database.DB.Model(&destruction).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Destruction batch approved"})
}

// ExecuteDestruction executes an approved destruction batch
func ExecuteDestruction(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		Witness1Name      string `json:"witness1_name"`
		Witness1Role      string `json:"witness1_role"`
		Witness2Name      string `json:"witness2_name"`
		Witness2Role      string `json:"witness2_role"`
		BeritaAcaraNumber string `json:"berita_acara_number"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var destruction models.ArchiveDestruction
	if err := database.DB.First(&destruction, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Destruction batch not found"})
		return
	}

	if destruction.Status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only approved batches can be executed"})
		return
	}

	userID, _ := c.Get("userID")
	uid := userID.(uint)
	now := time.Now()

	tx := database.DB.Begin()

	// Update destruction record
	updates := map[string]interface{}{
		"executed_by_id":      uid,
		"executed_at":         now,
		"status":              "executed",
		"witness1_name":       input.Witness1Name,
		"witness1_role":       input.Witness1Role,
		"witness2_name":       input.Witness2Name,
		"witness2_role":       input.Witness2Role,
		"berita_acara_number": input.BeritaAcaraNumber,
	}

	if err := tx.Model(&destruction).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get destruction items and update archives
	var items []models.ArchiveDestructionItem
	tx.Where("destruction_id = ?", destruction.ID).Find(&items)

	for _, item := range items {
		tx.Model(&models.MedicalRecordArchive{}).
			Where("id = ?", item.ArchiveID).
			Update("status", models.ArchiveStatusDestroyed)
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "Destruction executed successfully"})
}

// GetDestructions returns list of destruction batches
func GetDestructions(c *gin.Context) {
	var destructions []models.ArchiveDestruction

	status := c.Query("status")
	query := database.DB.
		Preload("ProposedBy").
		Preload("ApprovedBy").
		Preload("ExecutedBy")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Order("created_at DESC").Find(&destructions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, destructions)
}

// GetDestructionItems returns items in a destruction batch
func GetDestructionItems(c *gin.Context) {
	id := c.Param("id")
	var items []models.ArchiveDestructionItem

	if err := database.DB.
		Preload("Archive").
		Where("destruction_id = ?", id).
		Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, items)
}

// SyncArchiveFromVisits creates/updates archive records based on patient visits
func SyncArchiveFromVisits(c *gin.Context) {
	// This is a maintenance job that should be run periodically
	// to keep archive records in sync with patient visits

	var patients []struct {
		PatientID     uint
		NoRM          string
		TotalVisits   int64
		LastVisitDate *time.Time
	}

	// Get all patients with their visit stats
	database.DB.Raw(`
		SELECT 
			p.id as patient_id,
			p.no_rm,
			COUNT(DISTINCT v.id) as total_visits,
			MAX(v.start_time) as last_visit_date
		FROM patients p
		LEFT JOIN registrations r ON r.patient_id = p.id
		LEFT JOIN visits v ON v.registration_id = r.id
		WHERE p.deleted_at IS NULL
		GROUP BY p.id, p.no_rm
	`).Scan(&patients)

	created := 0
	updated := 0

	for _, p := range patients {
		var archive models.MedicalRecordArchive
		err := database.DB.Where("patient_id = ?", p.PatientID).First(&archive).Error

		if err == gorm.ErrRecordNotFound {
			// Create new archive record
			archive = models.MedicalRecordArchive{
				PatientID:     p.PatientID,
				NoRM:          p.NoRM,
				Status:        models.ArchiveStatusActive,
				Location:      models.ArchiveLocationActive,
				TotalVisits:   int(p.TotalVisits),
				LastVisitDate: p.LastVisitDate,
			}
			database.DB.Create(&archive)
			created++
		} else if err == nil {
			// Update existing
			archive.TotalVisits = int(p.TotalVisits)
			archive.LastVisitDate = p.LastVisitDate

			// Calculate inactivity
			if p.LastVisitDate != nil {
				months := int(time.Since(*p.LastVisitDate).Hours() / 24 / 30)
				archive.InactivityMonths = months

				// Auto-mark as inactive if threshold exceeded
				if months >= 24 && archive.Status == models.ArchiveStatusActive {
					archive.Status = models.ArchiveStatusInactive
				}
			}

			database.DB.Save(&archive)
			updated++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Sync completed",
		"created": created,
		"updated": updated,
	})
}
