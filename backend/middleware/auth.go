package middleware

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret []byte

// Role permission cache to avoid repeated database queries
type rolePermissionCache struct {
	permissions map[uint]map[string]bool
	mutex       sync.RWMutex
	expireAt    time.Time
}

var permCache = &rolePermissionCache{
	permissions: make(map[uint]map[string]bool),
}

// Cache duration - refresh every 5 minutes
const cacheDuration = 5 * time.Minute

func SetJWTSecret(secret string) {
	jwtSecret = []byte(secret)
}

// InvalidatePermissionCache clears the permission cache
// Call this when roles or permissions are updated
func InvalidatePermissionCache() {
	permCache.mutex.Lock()
	defer permCache.mutex.Unlock()
	permCache.permissions = make(map[uint]map[string]bool)
	permCache.expireAt = time.Time{}
}

// getRolePermissions gets permissions from cache or database
func getRolePermissions(roleID uint) (map[string]bool, error) {
	permCache.mutex.RLock()
	if time.Now().Before(permCache.expireAt) {
		if perms, ok := permCache.permissions[roleID]; ok {
			permCache.mutex.RUnlock()
			return perms, nil
		}
	}
	permCache.mutex.RUnlock()

	// Cache miss or expired - load from database
	var role models.Role
	if err := database.DB.Preload("Permissions").First(&role, roleID).Error; err != nil {
		return nil, err
	}

	perms := make(map[string]bool)
	for _, perm := range role.Permissions {
		perms[perm.Name] = true
	}

	// Update cache
	permCache.mutex.Lock()
	permCache.permissions[roleID] = perms
	if time.Now().After(permCache.expireAt) {
		permCache.expireAt = time.Now().Add(cacheDuration)
	}
	permCache.mutex.Unlock()

	return perms, nil
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
		c.Set("user_id", claims.UserID) // Also set snake_case for compatibility
		c.Set("email", claims.Email)
		c.Set("roleID", claims.RoleID)
		c.Set("role_id", claims.RoleID) // Also set snake_case for compatibility
		c.Next()
	}
}

// PrintAuthMiddleware is a relaxed version of AuthMiddleware specifically for printing documents.
// It accepts either a standard Bearer token OR a JWT token from query parameters.
// This allows patients to view the document they are about to sign via the public patient-sign page.
func PrintAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// 1. Try Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}

		// 2. Try URL parameter ?token=
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header or token query required"})
			c.Abort()
			return
		}

		// Parse token using generic MapClaims
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		mapClaims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid claims format"})
			c.Abort()
			return
		}

		// Check if it's an Employee token
		if userID, exists := mapClaims["user_id"]; exists {
			c.Set("userID", uint(userID.(float64)))
			c.Set("user_id", uint(userID.(float64)))
			c.Set("email", mapClaims["email"])
			c.Set("roleID", uint(mapClaims["role_id"].(float64)))
			c.Set("role_id", uint(mapClaims["role_id"].(float64)))
		} else if docType, exists := mapClaims["doc_type"]; exists {
			// Check if it's a Patient Signature token
			c.Set("doc_type", docType)
			c.Set("doc_id", uint(mapClaims["doc_id"].(float64)))
			c.Set("req_id", uint(mapClaims["req_id"].(float64)))

			// Set dummy IDs so normal print endpoints don't crash
			// Patient tokens don't have roles, so we bypass permissions for prints
			c.Set("userID", uint(999999))
			c.Set("roleID", uint(999999))
			c.Set("patient_token", true)
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unknown token type"})
			c.Abort()
			return
		}

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

		// Use cached permissions for better performance
		perms, err := getRolePermissions(roleID.(uint))
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Role not found"})
			c.Abort()
			return
		}

		if !perms[permission] {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAnyPermission checks if the user has AT LEAST ONE of the required permissions
func RequireAnyPermission(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleID, exists := c.Get("roleID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		// Use cached permissions for better performance
		perms, err := getRolePermissions(roleID.(uint))
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Role not found"})
			c.Abort()
			return
		}

		hasPermission := false
		for _, permission := range permissions {
			if perms[permission] {
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
