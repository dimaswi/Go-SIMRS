package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ==========================================
// MEDICINE HANDLERS
// ==========================================

func resolveMedicineCurrentStock(medicineID uint, fallback int) int {
	var total int64
	database.DB.Model(&models.RoomMedicine{}).
		Where("medicine_id = ?", medicineID).
		Select("COALESCE(SUM(quantity), 0)").
		Scan(&total)

	if total > 0 {
		return int(total)
	}

	return fallback
}

type medicineTraceabilityStats struct {
	TotalStock        int `json:"total_stock"`
	RoomCount         int `json:"room_count"`
	PurchaseCount     int `json:"purchase_count"`
	RequestCount      int `json:"request_count"`
	DistributionCount int `json:"distribution_count"`
	PatientUsageCount int `json:"patient_usage_count"`
}

type medicineTraceabilityRoomStock struct {
	RoomID      uint   `json:"room_id"`
	RoomName    string `json:"room_name"`
	RoomCode    string `json:"room_code"`
	Quantity    int    `json:"quantity"`
	MinQuantity int    `json:"min_quantity"`
	Notes       string `json:"notes,omitempty"`
}

type medicineTraceabilityPurchase struct {
	PurchaseID        uint       `json:"purchase_id"`
	PurchaseNumber    string     `json:"purchase_number"`
	Status            string     `json:"status"`
	SupplierName      string     `json:"supplier_name"`
	DestinationRoom   string     `json:"destination_room"`
	OrderDate         *time.Time `json:"order_date,omitempty"`
	ReceivedDate      *time.Time `json:"received_date,omitempty"`
	InvoiceNumber     string     `json:"invoice_number"`
	PaymentStatus     string     `json:"payment_status"`
	QuantityOrdered   int        `json:"quantity_ordered"`
	QuantityReceived  int        `json:"quantity_received"`
	Unit              string     `json:"unit"`
	UnitPrice         float64    `json:"unit_price"`
	TotalPrice        float64    `json:"total_price"`
	BatchNumber       string     `json:"batch_number,omitempty"`
	ExpiryDate        *time.Time `json:"expiry_date,omitempty"`
	RecordedBy        string     `json:"recorded_by,omitempty"`
	RemainingQuantity int        `json:"remaining_quantity"`
}

type medicineTraceabilityRequest struct {
	RequestID                     uint       `json:"request_id"`
	RequestNumber                 string     `json:"request_number"`
	Status                        string     `json:"status"`
	Priority                      string     `json:"priority"`
	RequestDate                   time.Time  `json:"request_date"`
	RequiredDate                  *time.Time `json:"required_date,omitempty"`
	FromRoom                      string     `json:"from_room"`
	ToRoom                        string     `json:"to_room"`
	RequestedBy                   string     `json:"requested_by,omitempty"`
	QuantityRequested             int        `json:"quantity_requested"`
	QuantityApproved              int        `json:"quantity_approved"`
	QuantityFulfilled             int        `json:"quantity_fulfilled"`
	QuantityRemainingApproval     int        `json:"quantity_remaining_approval"`
	QuantityRemainingDistribution int        `json:"quantity_remaining_distribution"`
	Notes                         string     `json:"notes,omitempty"`
}

type medicineTraceabilityDistribution struct {
	DistributionID     uint       `json:"distribution_id"`
	DistributionNumber string     `json:"distribution_number"`
	Status             string     `json:"status"`
	DistributionDate   time.Time  `json:"distribution_date"`
	FromRoom           string     `json:"from_room"`
	ToRoom             string     `json:"to_room"`
	RequestNumber      string     `json:"request_number,omitempty"`
	DistributedBy      string     `json:"distributed_by,omitempty"`
	ReceivedBy         string     `json:"received_by,omitempty"`
	ReceivedDate       *time.Time `json:"received_date,omitempty"`
	QuantitySent       int        `json:"quantity_sent"`
	Unit               string     `json:"unit"`
	Notes              string     `json:"notes,omitempty"`
}

type medicineTraceabilityAdministration struct {
	ScheduledAt    time.Time  `json:"scheduled_at"`
	Status         string     `json:"status"`
	AdministeredAt *time.Time `json:"administered_at,omitempty"`
	ReasonCode     string     `json:"reason_code,omitempty"`
	ReasonDetail   string     `json:"reason_detail,omitempty"`
	Notes          string     `json:"notes,omitempty"`
}

type medicineTraceabilityAdministrationSummary struct {
	ScheduledCount        int                                  `json:"scheduled_count"`
	GivenCount            int                                  `json:"given_count"`
	HeldCount             int                                  `json:"held_count"`
	SkippedCount          int                                  `json:"skipped_count"`
	RefusedCount          int                                  `json:"refused_count"`
	UnavailableCount      int                                  `json:"unavailable_count"`
	LastAdministeredAt    *time.Time                           `json:"last_administered_at,omitempty"`
	RecentAdministrations []medicineTraceabilityAdministration `json:"recent_administrations"`
}

type medicineTraceabilityPatientUsage struct {
	OrderItemID           uint                                      `json:"order_item_id"`
	OrderID               uint                                      `json:"order_id"`
	OrderNumber           string                                    `json:"order_number"`
	OrderStatus           string                                    `json:"order_status"`
	ItemStatus            string                                    `json:"item_status"`
	OrderedAt             time.Time                                 `json:"ordered_at"`
	DeliveredAt           *time.Time                                `json:"delivered_at,omitempty"`
	PatientName           string                                    `json:"patient_name"`
	PatientNoRM           string                                    `json:"patient_no_rm"`
	RegistrationNumber    string                                    `json:"registration_number"`
	SourceRoom            string                                    `json:"source_room"`
	PharmacyRoom          string                                    `json:"pharmacy_room"`
	PrescriberName        string                                    `json:"prescriber_name,omitempty"`
	FulfillmentType       string                                    `json:"fulfillment_type"`
	Priority              string                                    `json:"priority"`
	QuantityOrdered       int                                       `json:"quantity_ordered"`
	QuantityDispensed     int                                       `json:"quantity_dispensed"`
	QuantityReturned      int                                       `json:"quantity_returned"`
	Unit                  string                                    `json:"unit"`
	Dosage                string                                    `json:"dosage,omitempty"`
	Frequency             string                                    `json:"frequency,omitempty"`
	Route                 string                                    `json:"route,omitempty"`
	Duration              string                                    `json:"duration,omitempty"`
	Instructions          string                                    `json:"instructions,omitempty"`
	AdministrationSummary medicineTraceabilityAdministrationSummary `json:"administration_summary"`
}

type medicineTraceabilityResponse struct {
	Medicine      models.Medicine                    `json:"medicine"`
	Stats         medicineTraceabilityStats          `json:"stats"`
	RoomStocks    []medicineTraceabilityRoomStock    `json:"room_stocks"`
	Purchases     []medicineTraceabilityPurchase     `json:"purchases"`
	Requests      []medicineTraceabilityRequest      `json:"requests"`
	Distributions []medicineTraceabilityDistribution `json:"distributions"`
	PatientUsages []medicineTraceabilityPatientUsage `json:"patient_usages"`
}

func userDisplayName(user *models.User) string {
	if user == nil {
		return ""
	}
	if strings.TrimSpace(user.FullName) != "" {
		return strings.TrimSpace(user.FullName)
	}
	return strings.TrimSpace(user.Username)
}

func employeeDisplayName(employee *models.Employee) string {
	if employee == nil {
		return ""
	}
	return strings.TrimSpace(employee.NamaLengkap)
}

func roomDisplayName(room *models.Room) string {
	if room == nil {
		return "-"
	}
	name := strings.TrimSpace(room.Name)
	code := strings.TrimSpace(room.Code)
	if name != "" && code != "" {
		return name + " (" + code + ")"
	}
	if name != "" {
		return name
	}
	if code != "" {
		return code
	}
	return "-"
}

// GetMedicineTraceability returns a consolidated logistics and patient trace for one medicine.
func GetMedicineTraceability(c *gin.Context) {
	id := c.Param("id")

	var medicine models.Medicine
	if err := database.DB.First(&medicine, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	medicine.CurrentStock = resolveMedicineCurrentStock(medicine.ID, medicine.CurrentStock)

	var roomMedicines []models.RoomMedicine
	if err := database.DB.
		Preload("Room").
		Where("medicine_id = ?", medicine.ID).
		Order("quantity DESC, room_id ASC").
		Find(&roomMedicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room medicine trace"})
		return
	}

	roomStocks := make([]medicineTraceabilityRoomStock, 0, len(roomMedicines))
	for _, roomMedicine := range roomMedicines {
		roomStocks = append(roomStocks, medicineTraceabilityRoomStock{
			RoomID:      roomMedicine.RoomID,
			RoomName:    strings.TrimSpace(roomMedicine.Room.Name),
			RoomCode:    strings.TrimSpace(roomMedicine.Room.Code),
			Quantity:    roomMedicine.Quantity,
			MinQuantity: roomMedicine.MinQuantity,
			Notes:       strings.TrimSpace(roomMedicine.Notes),
		})
	}

	var purchaseItems []models.PurchaseItem
	if err := database.DB.
		Preload("Purchase.ToRoom").
		Preload("Purchase.CreatedBy").
		Where("medicine_id = ?", medicine.ID).
		Order("created_at DESC").
		Limit(20).
		Find(&purchaseItems).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch purchase trace"})
		return
	}

	purchases := make([]medicineTraceabilityPurchase, 0, len(purchaseItems))
	for _, item := range purchaseItems {
		purchase := item.Purchase
		if purchase == nil {
			continue
		}
		purchases = append(purchases, medicineTraceabilityPurchase{
			PurchaseID:        purchase.ID,
			PurchaseNumber:    strings.TrimSpace(purchase.PurchaseNumber),
			Status:            strings.TrimSpace(purchase.Status),
			SupplierName:      strings.TrimSpace(purchase.SupplierName),
			DestinationRoom:   roomDisplayName(purchase.ToRoom),
			OrderDate:         purchase.OrderDate,
			ReceivedDate:      purchase.ReceivedDate,
			InvoiceNumber:     strings.TrimSpace(purchase.InvoiceNumber),
			PaymentStatus:     strings.TrimSpace(purchase.PaymentStatus),
			QuantityOrdered:   item.QuantityOrdered,
			QuantityReceived:  item.QuantityReceived,
			Unit:              strings.TrimSpace(item.Unit),
			UnitPrice:         item.UnitPrice,
			TotalPrice:        item.TotalPrice,
			BatchNumber:       strings.TrimSpace(item.BatchNumber),
			ExpiryDate:        item.ExpiryDate,
			RecordedBy:        userDisplayName(purchase.CreatedBy),
			RemainingQuantity: item.QuantityOrdered - item.QuantityReceived,
		})
	}

	var requestItems []models.StockRequestItem
	if err := database.DB.
		Preload("StockRequest.FromRoom").
		Preload("StockRequest.ToRoom").
		Preload("StockRequest.RequestedBy").
		Where("medicine_id = ?", medicine.ID).
		Order("created_at DESC").
		Limit(20).
		Find(&requestItems).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch request trace"})
		return
	}

	requests := make([]medicineTraceabilityRequest, 0, len(requestItems))
	for _, item := range requestItems {
		request := item.StockRequest
		if request == nil {
			continue
		}
		remainingApproval := item.QuantityRequested - item.QuantityApproved
		if remainingApproval < 0 {
			remainingApproval = 0
		}
		remainingDistribution := item.QuantityApproved - item.QuantityFulfilled
		if remainingDistribution < 0 {
			remainingDistribution = 0
		}
		requests = append(requests, medicineTraceabilityRequest{
			RequestID:                     request.ID,
			RequestNumber:                 strings.TrimSpace(request.RequestNumber),
			Status:                        strings.TrimSpace(request.Status),
			Priority:                      strings.TrimSpace(request.Priority),
			RequestDate:                   request.RequestDate,
			RequiredDate:                  request.RequiredDate,
			FromRoom:                      roomDisplayName(request.FromRoom),
			ToRoom:                        roomDisplayName(request.ToRoom),
			RequestedBy:                   userDisplayName(request.RequestedBy),
			QuantityRequested:             item.QuantityRequested,
			QuantityApproved:              item.QuantityApproved,
			QuantityFulfilled:             item.QuantityFulfilled,
			QuantityRemainingApproval:     remainingApproval,
			QuantityRemainingDistribution: remainingDistribution,
			Notes:                         strings.TrimSpace(item.Notes),
		})
	}

	var distributionItems []models.StockDistributionItem
	if err := database.DB.
		Preload("StockDistribution.FromRoom").
		Preload("StockDistribution.ToRoom").
		Preload("StockDistribution.StockRequest").
		Preload("StockDistribution.DistributedBy").
		Preload("StockDistribution.ReceivedBy").
		Where("medicine_id = ?", medicine.ID).
		Order("created_at DESC").
		Limit(20).
		Find(&distributionItems).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch distribution trace"})
		return
	}

	distributions := make([]medicineTraceabilityDistribution, 0, len(distributionItems))
	for _, item := range distributionItems {
		distribution := item.StockDistribution
		if distribution == nil {
			continue
		}
		requestNumber := ""
		if distribution.StockRequest != nil {
			requestNumber = strings.TrimSpace(distribution.StockRequest.RequestNumber)
		}
		distributions = append(distributions, medicineTraceabilityDistribution{
			DistributionID:     distribution.ID,
			DistributionNumber: strings.TrimSpace(distribution.DistributionNumber),
			Status:             strings.TrimSpace(distribution.Status),
			DistributionDate:   distribution.DistributionDate,
			FromRoom:           roomDisplayName(distribution.FromRoom),
			ToRoom:             roomDisplayName(distribution.ToRoom),
			RequestNumber:      requestNumber,
			DistributedBy:      userDisplayName(distribution.DistributedBy),
			ReceivedBy:         userDisplayName(distribution.ReceivedBy),
			ReceivedDate:       distribution.ReceivedDate,
			QuantitySent:       item.Quantity,
			Unit:               strings.TrimSpace(item.Unit),
			Notes:              strings.TrimSpace(item.Notes),
		})
	}

	var orderItems []models.MedicineOrderItem
	if err := database.DB.
		Preload("MedicineOrder.Registration.Patient").
		Preload("MedicineOrder.SourceRoom").
		Preload("MedicineOrder.PharmacyRoom").
		Preload("MedicineOrder.Prescriber").
		Where("medicine_id = ?", medicine.ID).
		Order("created_at DESC").
		Limit(20).
		Find(&orderItems).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch patient usage trace"})
		return
	}

	orderItemIDs := make([]uint, 0, len(orderItems))
	for _, item := range orderItems {
		orderItemIDs = append(orderItemIDs, item.ID)
	}

	timesheetByItem := map[uint][]models.MedicineAdministrationTimesheet{}
	if len(orderItemIDs) > 0 {
		var timesheets []models.MedicineAdministrationTimesheet
		if err := database.DB.
			Where("medicine_order_item_id IN ?", orderItemIDs).
			Order("scheduled_at DESC").
			Find(&timesheets).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicine administration trace"})
			return
		}
		for _, timesheet := range timesheets {
			timesheetByItem[timesheet.MedicineOrderItemID] = append(timesheetByItem[timesheet.MedicineOrderItemID], timesheet)
		}
	}

	patientUsages := make([]medicineTraceabilityPatientUsage, 0, len(orderItems))
	for _, item := range orderItems {
		order := item.MedicineOrder
		if order == nil {
			continue
		}

		summary := medicineTraceabilityAdministrationSummary{
			RecentAdministrations: []medicineTraceabilityAdministration{},
		}
		for index, timesheet := range timesheetByItem[item.ID] {
			summary.ScheduledCount++
			switch timesheet.Status {
			case models.TimesheetStatusGiven:
				summary.GivenCount++
				if timesheet.AdministeredAt != nil && (summary.LastAdministeredAt == nil || timesheet.AdministeredAt.After(*summary.LastAdministeredAt)) {
					summary.LastAdministeredAt = timesheet.AdministeredAt
				}
			case models.TimesheetStatusHeld:
				summary.HeldCount++
			case models.TimesheetStatusSkipped:
				summary.SkippedCount++
			case models.TimesheetStatusRefused:
				summary.RefusedCount++
			case models.TimesheetStatusUnavailable:
				summary.UnavailableCount++
			}

			if index < 5 {
				summary.RecentAdministrations = append(summary.RecentAdministrations, medicineTraceabilityAdministration{
					ScheduledAt:    timesheet.ScheduledAt,
					Status:         strings.TrimSpace(timesheet.Status),
					AdministeredAt: timesheet.AdministeredAt,
					ReasonCode:     strings.TrimSpace(timesheet.ReasonCode),
					ReasonDetail:   strings.TrimSpace(timesheet.ReasonDetail),
					Notes:          strings.TrimSpace(timesheet.Notes),
				})
			}
		}

		patientName := "-"
		patientNoRM := "-"
		registrationNumber := "-"
		if order.Registration != nil {
			registrationNumber = strings.TrimSpace(order.Registration.RegistrationNumber)
			if order.Registration.Patient != nil {
				if strings.TrimSpace(order.Registration.Patient.NamaLengkap) != "" {
					patientName = strings.TrimSpace(order.Registration.Patient.NamaLengkap)
				}
				if strings.TrimSpace(order.Registration.Patient.NoRM) != "" {
					patientNoRM = strings.TrimSpace(order.Registration.Patient.NoRM)
				}
			}
		}

		patientUsages = append(patientUsages, medicineTraceabilityPatientUsage{
			OrderItemID:           item.ID,
			OrderID:               order.ID,
			OrderNumber:           strings.TrimSpace(order.OrderNumber),
			OrderStatus:           strings.TrimSpace(order.Status),
			ItemStatus:            strings.TrimSpace(item.Status),
			OrderedAt:             item.CreatedAt,
			DeliveredAt:           item.DispensedAt,
			PatientName:           patientName,
			PatientNoRM:           patientNoRM,
			RegistrationNumber:    registrationNumber,
			SourceRoom:            roomDisplayName(order.SourceRoom),
			PharmacyRoom:          roomDisplayName(order.PharmacyRoom),
			PrescriberName:        employeeDisplayName(order.Prescriber),
			FulfillmentType:       strings.TrimSpace(order.FulfillmentType),
			Priority:              strings.TrimSpace(order.Priority),
			QuantityOrdered:       item.Quantity,
			QuantityDispensed:     item.DispensedQty,
			QuantityReturned:      item.ReturnedQty,
			Unit:                  strings.TrimSpace(item.Unit),
			Dosage:                strings.TrimSpace(item.Dosage),
			Frequency:             strings.TrimSpace(item.Frequency),
			Route:                 strings.TrimSpace(item.Route),
			Duration:              strings.TrimSpace(item.Duration),
			Instructions:          strings.TrimSpace(item.Instructions),
			AdministrationSummary: summary,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": medicineTraceabilityResponse{
		Medicine: medicine,
		Stats: medicineTraceabilityStats{
			TotalStock:        medicine.CurrentStock,
			RoomCount:         len(roomStocks),
			PurchaseCount:     len(purchases),
			RequestCount:      len(requests),
			DistributionCount: len(distributions),
			PatientUsageCount: len(patientUsages),
		},
		RoomStocks:    roomStocks,
		Purchases:     purchases,
		Requests:      requests,
		Distributions: distributions,
		PatientUsages: patientUsages,
	}})
}

// GetMedicines returns all medicines with pagination and search
func GetMedicines(c *gin.Context) {
	var medicines []models.Medicine
	var total int64

	// Get pagination params
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	category := c.Query("category")
	medicineType := c.Query("type")
	form := c.Query("form")
	isActive := c.Query("is_active")

	offset := (page - 1) * limit

	query := database.DB.Model(&models.Medicine{})

	// Apply search filter
	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(generic_name) LIKE ? OR LOWER(manufacturer) LIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern,
		)
	}

	// Apply category filter
	if category != "" {
		query = query.Where("category = ?", category)
	}

	// Apply type filter
	if medicineType != "" {
		query = query.Where("type = ?", medicineType)
	}

	// Apply form filter
	if form != "" {
		query = query.Where("form = ?", form)
	}

	// Apply is_active filter
	if isActive != "" {
		query = query.Where("is_active = ?", isActive == "true")
	}

	// Count total
	query.Count(&total)

	// Get paginated data
	if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&medicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicines"})
		return
	}

	for i := range medicines {
		medicines[i].CurrentStock = resolveMedicineCurrentStock(medicines[i].ID, medicines[i].CurrentStock)
	}

	c.JSON(http.StatusOK, gin.H{
		"data": medicines,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetMedicine returns a single medicine by ID
func GetMedicine(c *gin.Context) {
	id := c.Param("id")

	var medicine models.Medicine
	if err := database.DB.First(&medicine, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	medicine.CurrentStock = resolveMedicineCurrentStock(medicine.ID, medicine.CurrentStock)

	c.JSON(http.StatusOK, gin.H{"data": medicine})
}

// CreateMedicine creates a new medicine
func CreateMedicine(c *gin.Context) {
	var input models.Medicine
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate required fields
	if input.Name == "" || input.Category == "" || input.Form == "" || input.Unit == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name, Category, Form, and Unit are required"})
		return
	}

	input.Unit = strings.TrimSpace(input.Unit)
	input.UnitLarge = strings.TrimSpace(input.UnitLarge)
	if input.LargeToSmallFactor < 1 {
		input.LargeToSmallFactor = 1
	}
	if input.UnitLarge == "" {
		input.LargeToSmallFactor = 1
	}

	code, err := generateDateCode(&models.Medicine{}, "MED")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate medicine code"})
		return
	}
	input.Code = code

	// Set default values
	if input.Type == "" {
		input.Type = models.MedicineTypeOTC
	}
	input.IsActive = true

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create medicine"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": input, "message": "Medicine created successfully"})
}

// UpdateMedicine updates an existing medicine
func UpdateMedicine(c *gin.Context) {
	id := c.Param("id")

	var medicine models.Medicine
	if err := database.DB.First(&medicine, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	var input models.Medicine
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"name":         input.Name,
		"generic_name": input.GenericName,
		"description":  input.Description,
		"category":     input.Category,
		"type":         input.Type,
		"form":         input.Form,
		"strength":     input.Strength,
		"unit":         strings.TrimSpace(input.Unit),
		"unit_large":   strings.TrimSpace(input.UnitLarge),
		"large_to_small_factor": func() int {
			if strings.TrimSpace(input.UnitLarge) == "" {
				return 1
			}
			if input.LargeToSmallFactor < 1 {
				return 1
			}
			return input.LargeToSmallFactor
		}(),
		"manufacturer":     input.Manufacturer,
		"min_stock":        input.MinStock,
		"max_stock":        input.MaxStock,
		"purchase_price":   input.PurchasePrice,
		"selling_price":    input.SellingPrice,
		"dpho_kode_obat":   strings.TrimSpace(input.DPHOKodeObat),
		"dpho_nama_obat":   strings.TrimSpace(input.DPHONamaObat),
		"indication":       input.Indication,
		"contraindication": input.Contraindication,
		"side_effects":     input.SideEffects,
		"dosage":           input.Dosage,
		"interaction":      input.Interaction,
		"storage_info":     input.StorageInfo,
		"is_active":        input.IsActive,
		"require_recipe":   input.RequireRecipe,
		"notes":            input.Notes,
		"image_url":        input.ImageURL,
	}

	if err := database.DB.Model(&medicine).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update medicine"})
		return
	}

	// Reload data
	database.DB.First(&medicine, id)

	c.JSON(http.StatusOK, gin.H{"data": medicine, "message": "Medicine updated successfully"})
}

// DeleteMedicine deletes a medicine (soft delete)
func DeleteMedicine(c *gin.Context) {
	id := c.Param("id")

	var medicine models.Medicine
	if err := database.DB.First(&medicine, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	// Check if medicine is assigned to any room
	var roomMedicineCount int64
	database.DB.Model(&models.RoomMedicine{}).Where("medicine_id = ?", id).Count(&roomMedicineCount)
	if roomMedicineCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete medicine that is assigned to rooms. Remove from rooms first."})
		return
	}

	if err := database.DB.Delete(&medicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete medicine"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Medicine deleted successfully"})
}

// GetMedicineCategories returns all medicine categories from master data
func GetMedicineCategories(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryMedicineCategory, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicine categories"})
		return
	}

	categories := make([]map[string]string, len(masterData))
	for i, data := range masterData {
		categories[i] = map[string]string{"value": data.Code, "label": data.Name}
	}
	c.JSON(http.StatusOK, gin.H{"data": categories})
}

// GetMedicineTypes returns all medicine types from master data
func GetMedicineTypes(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryMedicineType, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicine types"})
		return
	}

	types := make([]map[string]string, len(masterData))
	for i, data := range masterData {
		types[i] = map[string]string{"value": data.Code, "label": data.Name}
	}
	c.JSON(http.StatusOK, gin.H{"data": types})
}

// GetMedicineForms returns all medicine forms from master data
func GetMedicineForms(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryMedicineForm, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicine forms"})
		return
	}

	forms := make([]map[string]string, len(masterData))
	for i, data := range masterData {
		forms[i] = map[string]string{"value": data.Code, "label": data.Name}
	}
	c.JSON(http.StatusOK, gin.H{"data": forms})
}

// GetMedicineUnits returns all medicine units from master data
func GetMedicineUnits(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryMedicineUnit, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicine units"})
		return
	}

	units := make([]map[string]string, len(masterData))
	for i, data := range masterData {
		units[i] = map[string]string{"value": data.Code, "label": data.Name}
	}
	c.JSON(http.StatusOK, gin.H{"data": units})
}

// ==========================================
// ROOM MEDICINE HANDLERS
// ==========================================

// GetRoomMedicines returns all medicines assigned to a room
func GetRoomMedicines(c *gin.Context) {
	roomID := c.Param("id")

	var roomMedicines []models.RoomMedicine
	if err := database.DB.
		Preload("Medicine").
		Where("room_id = ?", roomID).
		Find(&roomMedicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room medicines"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roomMedicines})
}

// AssignMedicineToRoom assigns a medicine to a room
func AssignMedicineToRoom(c *gin.Context) {
	roomID := c.Param("id")

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	var input struct {
		MedicineID  uint   `json:"medicine_id" binding:"required"`
		Quantity    int    `json:"quantity"`
		MinQuantity int    `json:"min_quantity"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if medicine exists
	var medicine models.Medicine
	if err := database.DB.First(&medicine, input.MedicineID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	// Check if already assigned
	var existing models.RoomMedicine
	if err := database.DB.Where("room_id = ? AND medicine_id = ?", roomID, input.MedicineID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Medicine already assigned to this room"})
		return
	}

	// Create assignment
	roomIDUint, _ := strconv.ParseUint(roomID, 10, 32)
	roomMedicine := models.RoomMedicine{
		RoomID:      uint(roomIDUint),
		MedicineID:  input.MedicineID,
		Quantity:    input.Quantity,
		MinQuantity: input.MinQuantity,
		Notes:       input.Notes,
	}

	if err := database.DB.Create(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign medicine to room"})
		return
	}

	// Load medicine data
	database.DB.Preload("Medicine").First(&roomMedicine, roomMedicine.ID)

	c.JSON(http.StatusCreated, gin.H{"data": roomMedicine, "message": "Medicine assigned to room successfully"})
}

// UpdateRoomMedicine updates a medicine assignment in a room
func UpdateRoomMedicine(c *gin.Context) {
	roomID := c.Param("id")
	medicineID := c.Param("medicineId")

	var roomMedicine models.RoomMedicine
	if err := database.DB.Where("room_id = ? AND medicine_id = ?", roomID, medicineID).First(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room medicine assignment not found"})
		return
	}

	var input struct {
		Quantity    int    `json:"quantity"`
		MinQuantity int    `json:"min_quantity"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"quantity":     input.Quantity,
		"min_quantity": input.MinQuantity,
		"notes":        input.Notes,
	}

	if err := database.DB.Model(&roomMedicine).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room medicine"})
		return
	}

	// Reload data with medicine info
	database.DB.Preload("Medicine").First(&roomMedicine, roomMedicine.ID)

	c.JSON(http.StatusOK, gin.H{"data": roomMedicine, "message": "Room medicine updated successfully"})
}

// RemoveMedicineFromRoom removes a medicine assignment from a room
func RemoveMedicineFromRoom(c *gin.Context) {
	roomID := c.Param("id")
	medicineID := c.Param("medicineId")

	var roomMedicine models.RoomMedicine
	if err := database.DB.Where("room_id = ? AND medicine_id = ?", roomID, medicineID).First(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room medicine assignment not found"})
		return
	}

	if err := database.DB.Delete(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove medicine from room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Medicine removed from room successfully"})
}
