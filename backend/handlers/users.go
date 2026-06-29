package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

func GetUsers(c *gin.Context) {
	var users []models.User
	if err := database.DB.Preload("Role").Preload("Employee").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": users})
}

func GetUser(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.Preload("Role.Permissions").Preload("Employee").First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

type CreateUserRequest struct {
	Email      string `json:"email" binding:"omitempty,email"`
	Username   string `json:"username" binding:"required"`
	Password   string `json:"password" binding:"required,min=6"`
	FullName   string `json:"full_name" binding:"required"`
	RoleID     uint   `json:"role_id" binding:"required"`
	EmployeeID *uint  `json:"employee_id"`
}

func CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Email == "" {
		req.Email = req.Username + "@simrs.local"
	}

	user := models.User{
		Email:      req.Email,
		Username:   req.Username,
		FullName:   req.FullName,
		RoleID:     req.RoleID,
		EmployeeID: req.EmployeeID,
		IsActive:   true,
	}

	if err := user.HashPassword(req.Password); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.Preload("Role").Preload("Employee").First(&user, user.ID)
	c.JSON(http.StatusCreated, gin.H{"data": user})
}

type UpdateUserRequest struct {
	FullName   string `json:"full_name"`
	RoleID     uint   `json:"role_id"`
	EmployeeID *uint  `json:"employee_id"`
	IsActive   *bool  `json:"is_active"`
	Password   string `json:"password,omitempty"`
}

func UpdateUser(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.FullName != "" {
		user.FullName = req.FullName
	}
	if req.RoleID > 0 {
		user.RoleID = req.RoleID
	}
	// Handle employee_id - can be set to null
	user.EmployeeID = req.EmployeeID

	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	if req.Password != "" {
		if err := user.HashPassword(req.Password); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
	}

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.Preload("Role").Preload("Employee").First(&user, user.ID)
	c.JSON(http.StatusOK, gin.H{"data": user})
}

func DeleteUser(c *gin.Context) {
	id := c.Param("id")

	idInt, _ := strconv.Atoi(id)
	userID, _ := c.Get("userID")
	if uint(idInt) == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
		return
	}

	if err := database.DB.Delete(&models.User{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}
