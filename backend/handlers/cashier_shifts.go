package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"starter/backend/database"
	"starter/backend/models"
)

// GetCurrentShift returns the currently active cashier shift for the logged-in user.
func GetCurrentShift(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var shift models.CashierShift
	if err := database.DB.Preload("Cashier").Where("status = ? AND cashier_id = ?", "active", userID.(uint)).First(&shift).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, gin.H{"data": nil})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active shift: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": shift})
}

// OpenShift opens a new cashier shift.
func OpenShift(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var input struct {
		OpeningBalance float64 `json:"opening_balance"`
		Notes          string  `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Cek apakah ada shift yang masih aktif untuk user ini
	var activeShift models.CashierShift
	if err := database.DB.Where("status = ? AND cashier_id = ?", "active", userID.(uint)).First(&activeShift).Error; err == nil {
		// Ada shift aktif
		c.JSON(http.StatusConflict, gin.H{"error": "Anda masih memiliki shift kasir yang aktif. Harap tutup shift sebelumnya terlebih dahulu."})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check active shift: " + err.Error()})
		return
	}

	// Buka shift baru
	newShift := models.CashierShift{
		CashierID:      userID.(uint),
		StartTime:      time.Now(),
		OpeningBalance: input.OpeningBalance,
		Status:         "active",
		Notes:          input.Notes,
	}

	if err := database.DB.Create(&newShift).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuka shift: " + err.Error()})
		return
	}

	database.DB.Preload("Cashier").First(&newShift, newShift.ID)

	c.JSON(http.StatusOK, gin.H{"message": "Shift berhasil dibuka", "data": newShift})
}

// CloseShift closes the currently active shift.
func CloseShift(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var input struct {
		ActualBalance float64 `json:"actual_balance"`
		Notes         string  `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Cek shift aktif milik user ini
	var shift models.CashierShift
	if err := database.DB.Where("status = ? AND cashier_id = ?", "active", userID.(uint)).First(&shift).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tidak ada shift aktif milik Anda yang bisa ditutup."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active shift: " + err.Error()})
		return
	}

	// Validasi bahwa user yang menutup harus user yang membuka
	if shift.CashierID != userID.(uint) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Hanya kasir yang membuka shift yang bisa menutupnya."})
		return
	}

	// Hitung expected closing balance (saldo sistem)
	// Kita ambil semua pembayaran yang terikat pada shift ini
	var payments []models.BillingPayment
	if err := database.DB.Where("cashier_shift_id = ? AND status = ?", shift.ID, "completed").Find(&payments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung saldo pembayaran: " + err.Error()})
		return
	}

	// Total penerimaan cash = semua pembayaran "cash" + opening balance
	// Catatan: Jika ingin lebih rinci, kita bisa hitung total per metode pembayaran.
	var totalCash float64 = 0
	for _, p := range payments {
		if p.PaymentMethod == "cash" {
			totalCash += p.Amount
		}
	}

	expectedBalance := shift.OpeningBalance + totalCash

	now := time.Now()
	shift.EndTime = &now
	shift.ClosingBalance = expectedBalance
	shift.ActualBalance = input.ActualBalance
	shift.Status = "closed"
	
	if input.Notes != "" {
		if shift.Notes != "" {
			shift.Notes += "\nCatatan Tutup: " + input.Notes
		} else {
			shift.Notes = input.Notes
		}
	}

	if err := database.DB.Save(&shift).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menutup shift: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Shift berhasil ditutup", 
		"data": shift,
	})
}
