package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// ==================== Purchase Handlers ====================

type CreatePurchaseInput struct {
	SupplierID      *uint                     `json:"supplier_id"`
	SupplierName    string                    `json:"supplier_name"`
	SupplierContact string                    `json:"supplier_contact"`
	ToRoomID        uint                      `json:"to_room_id" binding:"required"`
	InvoiceNumber   string                    `json:"invoice_number"`
	InvoiceDate     string                    `json:"invoice_date"`
	PaymentMethod   string                    `json:"payment_method"`
	PaymentTermDays int                       `json:"payment_term_days"`
	DueDate         string                    `json:"due_date"`
	Notes           string                    `json:"notes"`
	Items           []CreatePurchaseItemInput `json:"items" binding:"required,min=1"`
}

type CreatePurchaseItemInput struct {
	InventoryID      *uint   `json:"inventory_id"`
	MedicineID       *uint   `json:"medicine_id"`
	QuantityOrdered  int     `json:"quantity_ordered"`
	QuantityLarge    *int    `json:"quantity_large"`
	QuantitySmall    *int    `json:"quantity_small"`
	UnitLarge        string  `json:"unit_large"`
	UnitSmall        string  `json:"unit_small"`
	ConversionFactor int     `json:"conversion_factor"`
	UnitPrice        float64 `json:"unit_price"`
	DiscountPercent  float64 `json:"discount_percent"`
	DiscountAmount   float64 `json:"discount_amount"`
	TaxPercent       float64 `json:"tax_percent"`
	TaxAmount        float64 `json:"tax_amount"`
	BatchNumber      string  `json:"batch_number"`
	ExpiryDate       string  `json:"expiry_date"`
	Unit             string  `json:"unit"`
	Notes            string  `json:"notes"`
}

type UpdatePurchaseInput struct {
	SupplierID      *uint                      `json:"supplier_id"`
	SupplierName    *string                    `json:"supplier_name"`
	SupplierContact *string                    `json:"supplier_contact"`
	InvoiceNumber   *string                    `json:"invoice_number"`
	InvoiceDate     *string                    `json:"invoice_date"`
	PaymentMethod   *string                    `json:"payment_method"`
	PaymentTermDays *int                       `json:"payment_term_days"`
	DueDate         *string                    `json:"due_date"`
	Notes           *string                    `json:"notes"`
	Items           *[]CreatePurchaseItemInput `json:"items"`
}

type ReceivePurchaseInput struct {
	Items []ReceivePurchaseItemInput `json:"items" binding:"required,min=1"`
	Notes string                     `json:"notes"`
}

type RecordPurchasePaymentInput struct {
	Amount          float64 `json:"amount" binding:"required,gt=0"`
	PaymentDate     string  `json:"payment_date"`
	PaymentMethod   string  `json:"payment_method"`
	ReferenceNumber string  `json:"reference_number"`
	Notes           string  `json:"notes"`
}

type ReceivePurchaseItemInput struct {
	ID                    uint   `json:"id" binding:"required"`
	QuantityReceived      *int   `json:"quantity_received"`
	QuantityLargeReceived *int   `json:"quantity_large_received"`
	QuantitySmallReceived *int   `json:"quantity_small_received"`
	BatchNumber           string `json:"batch_number"`
	ExpiryDate            string `json:"expiry_date"`
}

func parseOptionalLocalDate(s string) (*time.Time, error) {
	if strings.TrimSpace(s) == "" {
		return nil, nil
	}
	parsed, err := ParseLocalDate(strings.TrimSpace(s))
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func normalizePurchasePaymentMethod(method string) string {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case models.PurchasePaymentMethodCash,
		models.PurchasePaymentMethodTransfer,
		models.PurchasePaymentMethodCredit,
		models.PurchasePaymentMethodCOD,
		models.PurchasePaymentMethodCBD,
		models.PurchasePaymentMethodConsignment,
		models.PurchasePaymentMethodInstallment:
		return strings.ToLower(strings.TrimSpace(method))
	default:
		return models.PurchasePaymentMethodCredit
	}
}

func derivePurchaseDueDate(invoiceDate *time.Time, explicitDueDate *time.Time, paymentMethod string, termDays int, fallback time.Time) *time.Time {
	if explicitDueDate != nil {
		dueDate := time.Date(explicitDueDate.Year(), explicitDueDate.Month(), explicitDueDate.Day(), 0, 0, 0, 0, explicitDueDate.Location())
		return &dueDate
	}

	baseDate := fallback
	if invoiceDate != nil {
		baseDate = *invoiceDate
	}
	baseDate = time.Date(baseDate.Year(), baseDate.Month(), baseDate.Day(), 0, 0, 0, 0, baseDate.Location())

	switch paymentMethod {
	case models.PurchasePaymentMethodCredit, models.PurchasePaymentMethodInstallment, models.PurchasePaymentMethodConsignment:
		dueDate := baseDate.AddDate(0, 0, termDays)
		return &dueDate
	case models.PurchasePaymentMethodCash, models.PurchasePaymentMethodCOD, models.PurchasePaymentMethodCBD:
		dueDate := baseDate
		return &dueDate
	default:
		if termDays > 0 {
			dueDate := baseDate.AddDate(0, 0, termDays)
			return &dueDate
		}
		return nil
	}
}

func derivePurchasePaymentStatus(totalAmount, paidAmount float64, dueDate *time.Time, now time.Time) string {
	remaining := totalAmount - paidAmount
	if remaining <= 0.0001 {
		return models.PurchasePaymentStatusPaid
	}
	if dueDate != nil {
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		compareDate := time.Date(dueDate.Year(), dueDate.Month(), dueDate.Day(), 0, 0, 0, 0, dueDate.Location())
		if today.After(compareDate) {
			return models.PurchasePaymentStatusOverdue
		}
	}
	if paidAmount > 0.0001 {
		return models.PurchasePaymentStatusPartial
	}
	return models.PurchasePaymentStatusUnpaid
}

func calculatePurchaseItemCommercials(input CreatePurchaseItemInput) (discountPercent float64, discountAmount float64, taxPercent float64, taxAmount float64, totalPrice float64) {
	baseAmount := float64(input.QuantityOrdered) * input.UnitPrice
	if baseAmount <= 0 {
		return 0, 0, 0, 0, 0
	}

	discountPercent = input.DiscountPercent
	discountAmount = input.DiscountAmount
	if discountAmount <= 0 && discountPercent > 0 {
		discountAmount = (baseAmount * discountPercent) / 100
	}
	if discountPercent <= 0 && discountAmount > 0 {
		discountPercent = (discountAmount / baseAmount) * 100
	}
	if discountAmount < 0 {
		discountAmount = 0
	}
	if discountAmount > baseAmount {
		discountAmount = baseAmount
	}

	taxableBase := baseAmount - discountAmount
	taxPercent = input.TaxPercent
	taxAmount = input.TaxAmount
	if taxAmount <= 0 && taxPercent > 0 {
		taxAmount = (taxableBase * taxPercent) / 100
	}
	if taxPercent <= 0 && taxAmount > 0 && taxableBase > 0 {
		taxPercent = (taxAmount / taxableBase) * 100
	}
	if taxAmount < 0 {
		taxAmount = 0
	}

	totalPrice = taxableBase + taxAmount
	if totalPrice < 0 {
		totalPrice = 0
	}

	return discountPercent, discountAmount, taxPercent, taxAmount, totalPrice
}

type preparedPurchaseItem struct {
	Input            CreatePurchaseItemInput
	QuantityOrdered  int
	QuantityLarge    int
	QuantitySmall    int
	UnitLarge        string
	UnitSmall        string
	ConversionFactor int
	Unit             string
	DiscountPercent  float64
	DiscountAmount   float64
	TaxPercent       float64
	TaxAmount        float64
	TotalPrice       float64
	ExpiryDate       *time.Time
}

func clampNonNegative(value int) int {
	if value < 0 {
		return 0
	}
	return value
}

func resolvePurchaseItemQuantity(item CreatePurchaseItemInput) (qtyLarge int, qtySmall int) {
	if item.QuantityLarge != nil || item.QuantitySmall != nil {
		if item.QuantityLarge != nil {
			qtyLarge = clampNonNegative(*item.QuantityLarge)
		}
		if item.QuantitySmall != nil {
			qtySmall = clampNonNegative(*item.QuantitySmall)
		}
		return qtyLarge, qtySmall
	}

	qtySmall = clampNonNegative(item.QuantityOrdered)
	return 0, qtySmall
}

func preparePurchaseItem(item CreatePurchaseItemInput) (preparedPurchaseItem, error) {
	prepared := preparedPurchaseItem{
		Input:            item,
		UnitLarge:        strings.TrimSpace(item.UnitLarge),
		UnitSmall:        strings.TrimSpace(item.UnitSmall),
		Unit:             strings.TrimSpace(item.Unit),
		ConversionFactor: item.ConversionFactor,
	}

	if (item.MedicineID == nil || *item.MedicineID == 0) && (item.InventoryID == nil || *item.InventoryID == 0) {
		return prepared, fmt.Errorf("item pembelian harus memilih obat atau inventaris")
	}

	if prepared.ConversionFactor < 1 {
		prepared.ConversionFactor = 1
	}

	prepared.QuantityLarge, prepared.QuantitySmall = resolvePurchaseItemQuantity(item)

	if item.MedicineID != nil && *item.MedicineID > 0 {
		var medicine models.Medicine
		if err := database.DB.Select("id", "unit", "unit_large", "large_to_small_factor", "is_active").First(&medicine, *item.MedicineID).Error; err != nil {
			return prepared, fmt.Errorf("obat tidak ditemukan")
		}
		if !medicine.IsActive {
			return prepared, fmt.Errorf("obat dengan ID %d berstatus non-aktif", medicine.ID)
		}

		if prepared.UnitSmall == "" {
			prepared.UnitSmall = strings.TrimSpace(medicine.Unit)
		}
		if prepared.UnitLarge == "" {
			prepared.UnitLarge = strings.TrimSpace(medicine.UnitLarge)
		}
		if item.ConversionFactor < 1 && medicine.LargeToSmallFactor > 1 {
			prepared.ConversionFactor = medicine.LargeToSmallFactor
		}
	} else if item.InventoryID != nil && *item.InventoryID > 0 {
		var inventory models.Inventory
		if err := database.DB.Select("id", "unit", "is_active").First(&inventory, *item.InventoryID).Error; err == nil {
			if !inventory.IsActive {
				return prepared, fmt.Errorf("inventaris dengan ID %d berstatus non-aktif", inventory.ID)
			}
			if prepared.UnitSmall == "" {
				prepared.UnitSmall = strings.TrimSpace(inventory.Unit)
			}
		}
	}

	prepared.QuantityOrdered = (prepared.QuantityLarge * prepared.ConversionFactor) + prepared.QuantitySmall
	if prepared.QuantityOrdered <= 0 {
		return prepared, fmt.Errorf("qty item harus lebih dari 0")
	}

	if prepared.UnitSmall == "" {
		prepared.UnitSmall = "pcs"
	}
	if prepared.Unit == "" {
		prepared.Unit = prepared.UnitSmall
	}

	prepared.Input.QuantityOrdered = prepared.QuantityOrdered
	prepared.DiscountPercent, prepared.DiscountAmount, prepared.TaxPercent, prepared.TaxAmount, prepared.TotalPrice = calculatePurchaseItemCommercials(prepared.Input)

	expiryDate, err := parseOptionalLocalDate(item.ExpiryDate)
	if err != nil {
		return prepared, fmt.Errorf("format tanggal kedaluwarsa item tidak valid")
	}
	prepared.ExpiryDate = expiryDate

	return prepared, nil
}

func resolveReceivingQuantity(item models.PurchaseItem, input ReceivePurchaseItemInput) int {
	if input.QuantityLargeReceived != nil || input.QuantitySmallReceived != nil {
		qtyLarge := 0
		qtySmall := 0
		if input.QuantityLargeReceived != nil {
			qtyLarge = clampNonNegative(*input.QuantityLargeReceived)
		}
		if input.QuantitySmallReceived != nil {
			qtySmall = clampNonNegative(*input.QuantitySmallReceived)
		}
		factor := item.ConversionFactor
		if factor < 1 {
			factor = 1
		}
		return (qtyLarge * factor) + qtySmall
	}

	if input.QuantityReceived == nil {
		return 0
	}
	return clampNonNegative(*input.QuantityReceived)
}

func generatePurchasePaymentNumber() string {
	var count int64
	database.DB.Model(&models.PurchasePayment{}).
		Where("created_at >= ?", time.Now().Format("2006-01-01")).
		Count(&count)
	return fmt.Sprintf("PPAY-%s-%04d", time.Now().Format("2006"), count+1)
}

func derivePurchaseReceiptStatus(purchase *models.Purchase) string {
	if purchase == nil {
		return "draft"
	}

	switch purchase.Status {
	case "draft", "pending", "cancelled":
		return purchase.Status
	}

	if len(purchase.Items) == 0 {
		return purchase.Status
	}

	hasReceived := false
	allReceived := true
	for _, item := range purchase.Items {
		if item.QuantityReceived > 0 {
			hasReceived = true
		}
		if item.QuantityReceived < item.QuantityOrdered {
			allReceived = false
		}
	}

	if allReceived {
		return "received"
	}
	if hasReceived {
		return "partial"
	}
	return "ordered"
}

func syncPurchaseReceiptStatus(purchase *models.Purchase) {
	if purchase == nil {
		return
	}

	nextStatus := derivePurchaseReceiptStatus(purchase)
	if nextStatus == "" || nextStatus == purchase.Status {
		return
	}

	purchase.Status = nextStatus
	_ = database.DB.Model(&models.Purchase{}).Where("id = ?", purchase.ID).Update("status", nextStatus).Error
}

// GetPurchases godoc
// @Summary Get all purchases
// @Description Get all purchases with pagination and filters
// @Tags Purchases
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Param status query string false "Filter by status"
// @Param to_room_id query int false "Filter by destination room"
// @Success 200 {object} map[string]interface{}
// @Router /purchases [get]
func GetPurchases(c *gin.Context) {
	var purchases []models.Purchase
	query := database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if paymentStatus := c.Query("payment_status"); paymentStatus != "" {
		query = query.Where("payment_status = ?", paymentStatus)
	}
	if toRoomID := c.Query("to_room_id"); toRoomID != "" {
		query = query.Where("to_room_id = ?", toRoomID)
	}
	if c.Query("overdue") == "true" {
		today := time.Now().Format("2006-01-02")
		query = query.Where("due_date IS NOT NULL AND due_date < ? AND payment_status <> ?", today, models.PurchasePaymentStatusPaid)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.Purchase{}).Count(&total)

	query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&purchases)
	for index := range purchases {
		syncPurchaseReceiptStatus(&purchases[index])
	}

	c.JSON(http.StatusOK, gin.H{
		"data": purchases,
		"meta": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"total_page": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetPurchase godoc
// @Summary Get a purchase by ID
// @Description Get purchase details by ID
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id} [get]
func GetPurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("ApprovedBy").Preload("ReceivedBy").
		Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").Preload("Payments").Preload("Payments.RecordedBy").
		First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	syncPurchaseReceiptStatus(&purchase)

	c.JSON(http.StatusOK, gin.H{"data": purchase})
}

// CreatePurchase godoc
// @Summary Create a new purchase
// @Description Create a new purchase order
// @Tags Purchases
// @Accept json
// @Produce json
// @Param input body CreatePurchaseInput true "Purchase data"
// @Success 201 {object} map[string]interface{}
// @Router /purchases [post]
func CreatePurchase(c *gin.Context) {
	var input CreatePurchaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Generate purchase number
	var count int64
	database.DB.Model(&models.Purchase{}).Count(&count)
	purchaseNumber := fmt.Sprintf("PO-%s-%04d", time.Now().Format("2006"), count+1)

	if input.PaymentTermDays < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Termin pembayaran tidak boleh negatif"})
		return
	}

	invoiceDate, err := parseOptionalLocalDate(input.InvoiceDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal faktur tidak valid"})
		return
	}

	explicitDueDate, err := parseOptionalLocalDate(input.DueDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal jatuh tempo tidak valid"})
		return
	}

	paymentMethod := normalizePurchasePaymentMethod(input.PaymentMethod)

	// Determine purchase type
	purchaseType := "inventory"
	if len(input.Items) > 0 && input.Items[0].MedicineID != nil {
		purchaseType = "medicine"
	}

	// Normalize items and calculate total
	preparedItems := make([]preparedPurchaseItem, 0, len(input.Items))
	var totalAmount float64
	for _, itemInput := range input.Items {
		prepared, err := preparePurchaseItem(itemInput)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		preparedItems = append(preparedItems, prepared)
		totalAmount += prepared.TotalPrice
	}

	now := time.Now()
	dueDate := derivePurchaseDueDate(invoiceDate, explicitDueDate, paymentMethod, input.PaymentTermDays, now)

	purchase := models.Purchase{
		PurchaseNumber:  purchaseNumber,
		PurchaseType:    purchaseType,
		SupplierID:      input.SupplierID,
		SupplierName:    input.SupplierName,
		SupplierContact: input.SupplierContact,
		ToRoomID:        input.ToRoomID,
		Status:          "draft",
		InvoiceNumber:   strings.TrimSpace(input.InvoiceNumber),
		InvoiceDate:     invoiceDate,
		PaymentMethod:   paymentMethod,
		PaymentTermDays: input.PaymentTermDays,
		DueDate:         dueDate,
		TotalAmount:     totalAmount,
		PaidAmount:      0,
		RemainingAmount: totalAmount,
		PaymentStatus:   derivePurchasePaymentStatus(totalAmount, 0, dueDate, now),
		CreatedByID:     userID.(uint),
		Notes:           input.Notes,
	}

	tx := database.DB.Begin()

	if err := tx.Create(&purchase).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create purchase"})
		return
	}

	// Create items
	for _, prepared := range preparedItems {
		itemInput := prepared.Input
		item := models.PurchaseItem{
			PurchaseID:            purchase.ID,
			InventoryID:           itemInput.InventoryID,
			MedicineID:            itemInput.MedicineID,
			QuantityLargeOrdered:  prepared.QuantityLarge,
			QuantitySmallOrdered:  prepared.QuantitySmall,
			QuantityOrdered:       prepared.QuantityOrdered,
			QuantityLargeReceived: 0,
			QuantitySmallReceived: 0,
			QuantityReceived:      0,
			UnitLarge:             prepared.UnitLarge,
			UnitSmall:             prepared.UnitSmall,
			ConversionFactor:      prepared.ConversionFactor,
			Unit:                  prepared.Unit,
			UnitPrice:             itemInput.UnitPrice,
			DiscountPercent:       prepared.DiscountPercent,
			DiscountAmount:        prepared.DiscountAmount,
			TaxPercent:            prepared.TaxPercent,
			TaxAmount:             prepared.TaxAmount,
			TotalPrice:            prepared.TotalPrice,
			BatchNumber:           strings.TrimSpace(itemInput.BatchNumber),
			ExpiryDate:            prepared.ExpiryDate,
			Notes:                 itemInput.Notes,
		}
		if err := tx.Create(&item).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create purchase item"})
			return
		}
	}

	tx.Commit()

	// Reload with associations
	database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("Items").Preload("Payments").Preload("Payments.RecordedBy").
		Preload("Items.Inventory").Preload("Items.Medicine").First(&purchase, purchase.ID)

	c.JSON(http.StatusCreated, gin.H{"data": purchase})
}

// UpdatePurchase godoc
// @Summary Update a purchase
// @Description Update purchase details (only pending status)
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Param input body UpdatePurchaseInput true "Update data"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id} [put]
func UpdatePurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pembelian yang dibatalkan tidak dapat diperbarui"})
		return
	}

	var input UpdatePurchaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.PaymentTermDays != nil && *input.PaymentTermDays < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Termin pembayaran tidak boleh negatif"})
		return
	}

	financeDriversChanged := false
	var dueDateOverride *time.Time

	if input.SupplierID != nil {
		purchase.SupplierID = input.SupplierID
	}
	if input.SupplierName != nil {
		purchase.SupplierName = strings.TrimSpace(*input.SupplierName)
	}
	if input.SupplierContact != nil {
		purchase.SupplierContact = strings.TrimSpace(*input.SupplierContact)
	}
	if input.InvoiceNumber != nil {
		purchase.InvoiceNumber = strings.TrimSpace(*input.InvoiceNumber)
	}
	if input.InvoiceDate != nil {
		parsedInvoiceDate, err := parseOptionalLocalDate(*input.InvoiceDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal faktur tidak valid"})
			return
		}
		purchase.InvoiceDate = parsedInvoiceDate
		financeDriversChanged = true
	}
	if input.PaymentMethod != nil {
		purchase.PaymentMethod = normalizePurchasePaymentMethod(*input.PaymentMethod)
		financeDriversChanged = true
	}
	if input.PaymentTermDays != nil {
		purchase.PaymentTermDays = *input.PaymentTermDays
		financeDriversChanged = true
	}
	if input.DueDate != nil {
		parsedDueDate, err := parseOptionalLocalDate(*input.DueDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal jatuh tempo tidak valid"})
			return
		}
		dueDateOverride = parsedDueDate
		financeDriversChanged = true
	}
	if input.Notes != nil {
		purchase.Notes = *input.Notes
	}

	var normalizedItems []models.PurchaseItem
	if input.Items != nil {
		if len(*input.Items) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal harus ada 1 item pembelian"})
			return
		}

		purchaseType := "inventory"
		if len(*input.Items) > 0 && (*input.Items)[0].MedicineID != nil {
			purchaseType = "medicine"
		}
		purchase.PurchaseType = purchaseType

		totalAmount := 0.0
		normalizedItems = make([]models.PurchaseItem, 0, len(*input.Items))
		for _, itemInput := range *input.Items {
			prepared, err := preparePurchaseItem(itemInput)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			totalAmount += prepared.TotalPrice
			normalizedItems = append(normalizedItems, models.PurchaseItem{
				PurchaseID:            purchase.ID,
				InventoryID:           itemInput.InventoryID,
				MedicineID:            itemInput.MedicineID,
				QuantityLargeOrdered:  prepared.QuantityLarge,
				QuantitySmallOrdered:  prepared.QuantitySmall,
				QuantityOrdered:       prepared.QuantityOrdered,
				QuantityLargeReceived: 0,
				QuantitySmallReceived: 0,
				QuantityReceived:      0,
				UnitLarge:             prepared.UnitLarge,
				UnitSmall:             prepared.UnitSmall,
				ConversionFactor:      prepared.ConversionFactor,
				Unit:                  prepared.Unit,
				UnitPrice:             itemInput.UnitPrice,
				DiscountPercent:       prepared.DiscountPercent,
				DiscountAmount:        prepared.DiscountAmount,
				TaxPercent:            prepared.TaxPercent,
				TaxAmount:             prepared.TaxAmount,
				TotalPrice:            prepared.TotalPrice,
				BatchNumber:           strings.TrimSpace(itemInput.BatchNumber),
				ExpiryDate:            prepared.ExpiryDate,
				Notes:                 itemInput.Notes,
			})
		}
		purchase.TotalAmount = totalAmount
	}

	if financeDriversChanged {
		purchase.DueDate = derivePurchaseDueDate(purchase.InvoiceDate, dueDateOverride, purchase.PaymentMethod, purchase.PaymentTermDays, time.Now())
	}
	purchase.RemainingAmount = purchase.TotalAmount - purchase.PaidAmount
	if purchase.RemainingAmount < 0 {
		purchase.RemainingAmount = 0
	}
	purchase.PaymentStatus = derivePurchasePaymentStatus(purchase.TotalAmount, purchase.PaidAmount, purchase.DueDate, time.Now())

	tx := database.DB.Begin()
	if err := tx.Save(&purchase).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update purchase"})
		return
	}

	if input.Items != nil {
		if err := tx.Where("purchase_id = ?", purchase.ID).Delete(&models.PurchaseItem{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to replace purchase items"})
			return
		}
		if len(normalizedItems) > 0 {
			if err := tx.Create(&normalizedItems).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save purchase items"})
				return
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update purchase"})
		return
	}

	// Reload
	database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("Items").Preload("Payments").Preload("Payments.RecordedBy").
		Preload("Items.Inventory").Preload("Items.Medicine").First(&purchase, purchase.ID)

	c.JSON(http.StatusOK, gin.H{"data": purchase})
}

// DeletePurchase godoc
// @Summary Delete a purchase
// @Description Delete a purchase (only draft/pending status)
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id} [delete]
func DeletePurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status != "pending" && purchase.Status != "draft" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete purchase that is not pending/draft"})
		return
	}

	// Delete items first
	database.DB.Where("purchase_id = ?", purchase.ID).Delete(&models.PurchaseItem{})
	database.DB.Delete(&purchase)

	c.JSON(http.StatusOK, gin.H{"message": "Purchase deleted successfully"})
}

// SubmitPurchase godoc
// @Summary Submit a purchase for approval
// @Description Submit a draft purchase for approval (draft → pending)
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id}/submit [post]
func SubmitPurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status != "draft" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya pembelian draft yang bisa diajukan"})
		return
	}

	purchase.Status = "pending"
	database.DB.Save(&purchase)

	c.JSON(http.StatusOK, gin.H{"data": purchase, "message": "Purchase submitted for approval"})
}

// ApprovePurchase godoc
// @Summary Approve a purchase order
// @Description Approve a purchase order and change status to ordered
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id}/approve [post]
func ApprovePurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status != "draft" && purchase.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya pembelian dengan status draft/pending yang bisa disetujui"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDUint := userID.(uint)
	now := time.Now()

	purchase.Status = "ordered"
	purchase.OrderDate = &now
	purchase.ApprovedByID = &userIDUint

	if err := database.DB.Save(&purchase).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyetujui pembelian"})
		return
	}

	// Reload with associations
	database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("ApprovedBy").
		Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").Preload("Payments").Preload("Payments.RecordedBy").First(&purchase, purchase.ID)

	c.JSON(http.StatusOK, gin.H{"data": purchase, "message": "Pembelian berhasil disetujui"})
}

// ReceivePurchase godoc
// @Summary Receive purchase items
// @Description Record receipt of purchase items
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Param input body ReceivePurchaseInput true "Receive data"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id}/receive [post]
func ReceivePurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status == "received" || purchase.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Purchase already completed or cancelled"})
		return
	}

	if purchase.Status == "draft" || purchase.Status == "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Purchase harus disetujui terlebih dahulu sebelum menerima barang"})
		return
	}

	var input ReceivePurchaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	tx := database.DB.Begin()

	itemByID := make(map[uint]models.PurchaseItem, len(purchase.Items))
	receivedQuantities := make(map[uint]int, len(purchase.Items))
	for _, purchaseItem := range purchase.Items {
		itemByID[purchaseItem.ID] = purchaseItem
		receivedQuantities[purchaseItem.ID] = purchaseItem.QuantityReceived
	}

	for _, itemInput := range input.Items {
		purchaseItem, exists := itemByID[itemInput.ID]
		if !exists {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Item penerimaan tidak termasuk dalam pembelian ini"})
			return
		}

		var item models.PurchaseItem
		if err := tx.Preload("Inventory").Preload("Medicine").First(&item, itemInput.ID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Item pembelian tidak ditemukan"})
			return
		}

		// Parse expiry date if provided
		var expiryDate *time.Time
		if itemInput.ExpiryDate != "" {
			parsed, err := ParseLocalDate(itemInput.ExpiryDate)
			if err == nil {
				expiryDate = &parsed
			}
		}

		// Calculate quantity being received this time (stored in satuan kecil)
		qtyReceiving := resolveReceivingQuantity(item, itemInput)
		newTotalReceived := item.QuantityReceived + qtyReceiving
		if newTotalReceived > purchaseItem.QuantityOrdered {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Jumlah diterima untuk item %d melebihi qty yang dipesan", item.ID)})
			return
		}

		item.QuantityReceived = newTotalReceived
		factor := item.ConversionFactor
		if factor < 1 {
			factor = 1
		}
		item.QuantityLargeReceived = newTotalReceived / factor
		item.QuantitySmallReceived = newTotalReceived % factor
		if itemInput.BatchNumber != "" {
			item.BatchNumber = itemInput.BatchNumber
		}
		if expiryDate != nil {
			item.ExpiryDate = expiryDate
		}

		tx.Save(&item)
		receivedQuantities[item.ID] = item.QuantityReceived

		// Add stock to room - only if quantity being received > 0
		if qtyReceiving > 0 {
			now := time.Now()
			if item.InventoryID != nil && *item.InventoryID > 0 {
				// Add to RoomInventory
				var roomInventory models.RoomInventory
				result := tx.Where("room_id = ? AND inventory_id = ?", purchase.ToRoomID, *item.InventoryID).First(&roomInventory)

				prevStock := 0
				if result.Error != nil {
					// Create new room inventory record
					roomInventory = models.RoomInventory{
						RoomID:      purchase.ToRoomID,
						InventoryID: *item.InventoryID,
						Quantity:    qtyReceiving,
						Notes:       fmt.Sprintf("Dari pembelian %s", purchase.PurchaseNumber),
					}
					tx.Create(&roomInventory)
				} else {
					// Update existing
					prevStock = roomInventory.Quantity
					roomInventory.Quantity += qtyReceiving
					tx.Save(&roomInventory)
				}

				// Create transaction log
				invTransaction := models.InventoryTransaction{
					TransactionType: "in",
					InventoryID:     *item.InventoryID,
					Quantity:        qtyReceiving,
					PreviousStock:   prevStock,
					CurrentStock:    roomInventory.Quantity,
					ToRoomID:        &purchase.ToRoomID,
					TransactionDate: now,
					ReferenceNumber: purchase.PurchaseNumber,
					Notes:           fmt.Sprintf("Penerimaan pembelian %s", purchase.PurchaseNumber),
					UserID:          userID.(uint),
				}
				tx.Create(&invTransaction)

			} else if item.MedicineID != nil && *item.MedicineID > 0 {
				// Add to RoomMedicine
				var roomMedicine models.RoomMedicine
				result := tx.Where("room_id = ? AND medicine_id = ?", purchase.ToRoomID, *item.MedicineID).First(&roomMedicine)

				prevStock := 0
				if result.Error != nil {
					// Create new room medicine record
					roomMedicine = models.RoomMedicine{
						RoomID:     purchase.ToRoomID,
						MedicineID: *item.MedicineID,
						Quantity:   qtyReceiving,
						Notes:      fmt.Sprintf("Dari pembelian %s", purchase.PurchaseNumber),
					}
					tx.Create(&roomMedicine)
				} else {
					// Update existing
					prevStock = roomMedicine.Quantity
					roomMedicine.Quantity += qtyReceiving
					tx.Save(&roomMedicine)
				}

				// Create batch if expiry date provided
				if expiryDate != nil {
					batch := models.MedicineBatch{
						MedicineID:   *item.MedicineID,
						BatchNumber:  itemInput.BatchNumber,
						ExpiryDate:   *expiryDate,
						Quantity:     qtyReceiving,
						RemainingQty: qtyReceiving,
						Location:     fmt.Sprintf("Ruangan ID: %d", purchase.ToRoomID),
					}
					tx.Create(&batch)
				}

				// Create transaction log
				medTransaction := models.MedicineTransaction{
					TransactionType: "in",
					MedicineID:      *item.MedicineID,
					Quantity:        qtyReceiving,
					PreviousStock:   prevStock,
					CurrentStock:    roomMedicine.Quantity,
					ToRoomID:        &purchase.ToRoomID,
					TransactionDate: now,
					ReferenceNumber: purchase.PurchaseNumber,
					Notes:           fmt.Sprintf("Penerimaan pembelian %s", purchase.PurchaseNumber),
					UserID:          userID.(uint),
				}
				tx.Create(&medTransaction)
			}
		}
	}

	// Update purchase status
	allReceived := len(purchase.Items) > 0
	for _, purchaseItem := range purchase.Items {
		if receivedQuantities[purchaseItem.ID] < purchaseItem.QuantityOrdered {
			allReceived = false
			break
		}
	}

	now2 := time.Now()
	userIDUint := userID.(uint)
	if allReceived {
		purchase.Status = "received"
	} else {
		purchase.Status = "partial"
	}
	purchase.ReceivedDate = &now2
	purchase.ReceivedByID = &userIDUint
	if input.Notes != "" {
		purchase.Notes = purchase.Notes + "\n" + input.Notes
	}

	tx.Save(&purchase)
	tx.Commit()

	// Reload
	database.DB.Preload("ToRoom").Preload("CreatedBy").Preload("ReceivedBy").
		Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").Preload("Payments").Preload("Payments.RecordedBy").First(&purchase, purchase.ID)

	c.JSON(http.StatusOK, gin.H{"data": purchase, "message": "Barang berhasil diterima dan stok ditambahkan"})
}

func RecordPurchasePayment(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat mencatat pembayaran untuk pembelian yang dibatalkan"})
		return
	}

	var input RecordPurchasePaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Amount > purchase.TotalAmount-purchase.PaidAmount+0.0001 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nominal pembayaran melebihi sisa hutang pembelian"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	paymentDate := time.Now()
	if strings.TrimSpace(input.PaymentDate) != "" {
		parsedPaymentDate, err := ParseLocalDate(strings.TrimSpace(input.PaymentDate))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal pembayaran tidak valid"})
			return
		}
		paymentDate = parsedPaymentDate
	}

	paymentMethod := normalizePurchasePaymentMethod(input.PaymentMethod)

	tx := database.DB.Begin()
	payment := models.PurchasePayment{
		PurchaseID:      purchase.ID,
		PaymentNumber:   generatePurchasePaymentNumber(),
		PaymentMethod:   paymentMethod,
		Amount:          input.Amount,
		PaymentDate:     paymentDate,
		ReferenceNumber: strings.TrimSpace(input.ReferenceNumber),
		Notes:           input.Notes,
		RecordedByID:    userID.(uint),
	}

	if err := tx.Create(&payment).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat pembayaran pembelian"})
		return
	}

	purchase.PaidAmount += input.Amount
	purchase.RemainingAmount = purchase.TotalAmount - purchase.PaidAmount
	if purchase.RemainingAmount < 0 {
		purchase.RemainingAmount = 0
	}
	purchase.PaymentStatus = derivePurchasePaymentStatus(purchase.TotalAmount, purchase.PaidAmount, purchase.DueDate, time.Now())

	if err := tx.Save(&purchase).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui status pembayaran pembelian"})
		return
	}

	tx.Commit()

	database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("ApprovedBy").Preload("ReceivedBy").
		Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").Preload("Payments").Preload("Payments.RecordedBy").First(&purchase, purchase.ID)
	database.DB.Preload("RecordedBy").First(&payment, payment.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Pembayaran pembelian berhasil dicatat",
		"payment": payment,
		"data":    purchase,
	})
}

// CancelPurchase godoc
// @Summary Cancel a purchase
// @Description Cancel a purchase order
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id}/cancel [post]
func CancelPurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status == "received" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel received purchase"})
		return
	}

	purchase.Status = "cancelled"
	database.DB.Save(&purchase)

	c.JSON(http.StatusOK, gin.H{"data": purchase})
}
