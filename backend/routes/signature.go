package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

// SetupSignatureRoutes sets up all signature-related routes
func SetupSignatureRoutes(protected *gin.RouterGroup) {
	signature := protected.Group("/signature")
	{
		// PIN Management
		signature.POST("/pin/setup", handlers.SetupSignaturePIN)     // Setup PIN for first time
		signature.POST("/pin/change", handlers.ChangeSignaturePIN)   // Change existing PIN
		signature.POST("/pin/verify", handlers.VerifySignaturePIN)   // Verify PIN (without signing)
		signature.POST("/pin/reset", handlers.ResetUserSignaturePIN) // Admin only: Reset user's PIN

		// Document Signing
		signature.POST("/sign", handlers.SignDocument)                       // Sign a document
		signature.POST("/revoke", handlers.RevokeDocumentSignature)          // Revoke/cancel a signature
		signature.GET("/status", handlers.GetDocumentSignature)              // Get signature status of a document
		signature.GET("/can-sign", handlers.CanSignDocument)                 // Check if current user can sign a document
		signature.POST("/batch-status", handlers.BatchSignatureStatus)       // Batch check signature status
		signature.GET("/check-required", handlers.CheckSignaturePINRequired) // Check if PIN is required

		// Audit Logs (Admin/Manajemen)
		signature.GET("/logs", handlers.GetSignatureLogs)                             // Signature activity logs
		signature.GET("/medical-record-logs", handlers.GetMedicalRecordEditLogsAudit) // Medical record edit logs
	}
}

// SetupPublicSignatureRoutes sets up public signature verification routes
func SetupPublicSignatureRoutes(public *gin.RouterGroup) {
	// Public verification endpoint (for external parties to verify document signature)
	public.GET("/signature/verify/:hash", handlers.VerifyDocumentSignature)
}
