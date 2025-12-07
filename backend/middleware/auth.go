package middleware

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret []byte

func SetJWTSecret(secret string) {
	jwtSecret = []byte(secret)
}

type Claims struct {
	UserID uint   `json:"user_id"`
	Email  string `json:"email"`
	RoleID uint   `json:"role_id"`
	jwt.RegisteredClaims
}

func GenerateToken(user *models.User) (string, error) {
	claims := Claims{
		UserID: user.ID,
		Email:  user.Email,
		RoleID: user.RoleID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("roleID", claims.RoleID)
		c.Next()
	}
}

func RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleID, exists := c.Get("roleID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		var role models.Role
		if err := database.DB.Preload("Permissions").First(&role, roleID).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Role not found"})
			c.Abort()
			return
		}

		hasPermission := false
		for _, perm := range role.Permissions {
			if perm.Name == permission {
				hasPermission = true
				break
			}
		}

		if !hasPermission {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			c.Abort()
			return
		}

		c.Next()
	}
}
