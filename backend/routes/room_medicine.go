package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// setupRoomMedicineRoutes sets up all room medicine related routes
func setupRoomMedicineRoutes(rg *gin.RouterGroup) {
	roomMedicines := rg.Group("/room-medicines")
	{
		// List all room medicines with pagination
		roomMedicines.GET("", middleware.RequirePermission("room-medicines.view"), handlers.GetAllRoomMedicines)

		// Get single room medicine
		roomMedicines.GET("/:id", middleware.RequirePermission("room-medicines.view"), handlers.GetRoomMedicine)

		// Create room medicine assignment
		roomMedicines.POST("", middleware.RequirePermission("room-medicines.create"), handlers.CreateRoomMedicine)

		// Update room medicine
		roomMedicines.PUT("/:id", middleware.RequirePermission("room-medicines.update"), handlers.UpdateRoomMedicineStock)

		// Delete room medicine
		roomMedicines.DELETE("/:id", middleware.RequirePermission("room-medicines.delete"), handlers.DeleteRoomMedicine)

		// Adjust stock
		roomMedicines.POST("/:id/adjust", middleware.RequirePermission("room-medicines.update"), handlers.AdjustRoomMedicineStock)

		// Transfer stock between rooms
		roomMedicines.POST("/transfer", middleware.RequirePermission("room-medicines.update"), handlers.TransferMedicineStock)

		// Get low stock medicines
		roomMedicines.GET("/low-stock", middleware.RequirePermission("room-medicines.view"), handlers.GetLowStockMedicines)
	}

	// Room-specific medicine routes (avoid conflict with existing /rooms/:id)
	roomMedicinesByRoom := rg.Group("/room-medicines-by-room")
	{
		// Get medicines by room
		roomMedicinesByRoom.GET("/:room_id", middleware.RequirePermission("room-medicines.view"), handlers.GetMedicinesByRoom)
	}

	// Medicine-specific room routes
	medicines := rg.Group("/medicines")
	{
		// Get rooms by medicine
		medicines.GET("/:id/rooms", middleware.RequirePermission("room-medicines.view"), handlers.GetRoomsByMedicine)

		// Get total stock of a medicine across all rooms
		medicines.GET("/:id/total-stock", middleware.RequirePermission("room-medicines.view"), handlers.GetTotalMedicineStock)
	}
}
