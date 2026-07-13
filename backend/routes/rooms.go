package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupRoomRoutes(rg *gin.RouterGroup) {
	// My assigned rooms (must be before :id route)
	rg.GET("/rooms/my-assigned", middleware.AuthMiddleware(), handlers.GetMyAssignedRooms)

	// Public lookup endpoints
	rg.GET("/rooms/pharmacy", middleware.AuthMiddleware(), handlers.GetPharmacyRooms)

	// Rooms (Ruangan/Bangsal)
	rg.GET("/rooms", middleware.RequirePermission("rooms.view"), handlers.GetRooms)
	rg.GET("/rooms/:id", middleware.RequirePermission("rooms.view"), handlers.GetRoom)
	rg.POST("/rooms", middleware.RequirePermission("rooms.create"), handlers.CreateRoom)
	rg.PUT("/rooms/:id", middleware.RequirePermission("rooms.update"), handlers.UpdateRoom)
	rg.DELETE("/rooms/:id", middleware.RequirePermission("rooms.delete"), handlers.DeleteRoom)

	// Room Units (Kamar - nested under rooms)
	rg.GET("/rooms/:id/units", middleware.RequirePermission("rooms.view"), handlers.GetRoomUnits)
	rg.GET("/rooms/:id/units/:unit_id", middleware.RequirePermission("rooms.view"), handlers.GetRoomUnit)
	rg.POST("/rooms/:id/units", middleware.RequirePermission("rooms.update"), handlers.CreateRoomUnit)
	rg.PUT("/rooms/:id/units/:unit_id", middleware.RequirePermission("rooms.update"), handlers.UpdateRoomUnit)
	rg.DELETE("/rooms/:id/units/:unit_id", middleware.RequirePermission("rooms.update"), handlers.DeleteRoomUnit)

	// Beds (nested under room units)
	rg.GET("/rooms/:id/beds", middleware.RequirePermission("rooms.view"), handlers.GetAllRoomBeds)                        // Get all beds for a room
	rg.GET("/rooms/:id/units/:unit_id/beds", middleware.RequirePermission("rooms.view"), handlers.GetBeds)                // Get beds for a unit
	rg.POST("/rooms/:id/units/:unit_id/beds", middleware.RequirePermission("rooms.update"), handlers.CreateBed)           // Create bed in unit
	rg.PUT("/rooms/:id/units/:unit_id/beds/:bed_id", middleware.RequirePermission("rooms.update"), handlers.UpdateBed)    // Update bed
	rg.DELETE("/rooms/:id/units/:unit_id/beds/:bed_id", middleware.RequirePermission("rooms.update"), handlers.DeleteBed) // Delete bed

	// Room Staff (nested under rooms)
	rg.GET("/rooms/:id/staff", middleware.RequirePermission("rooms.view"), handlers.GetRoomStaff)
	rg.POST("/rooms/:id/staff", middleware.RequirePermission("rooms.update"), handlers.AssignRoomStaff)
	rg.PUT("/rooms/:id/staff/:staff_id", middleware.RequirePermission("rooms.update"), handlers.UpdateRoomStaff)
	rg.DELETE("/rooms/:id/staff/:staff_id", middleware.RequirePermission("rooms.update"), handlers.RemoveRoomStaff)

	// Room Schedules (Jadwal Ruangan/Poli - nested under rooms)
	rg.GET("/rooms/:id/schedules", middleware.RequirePermission("rooms.view"), handlers.GetRoomSchedules)
	rg.POST("/rooms/:id/schedules", middleware.RequirePermission("rooms.update"), handlers.CreateSchedule)
	rg.POST("/rooms/:id/schedules/bulk", middleware.RequirePermission("rooms.update"), handlers.BulkCreateSchedules)
	rg.PUT("/rooms/:id/schedules/:schedule_id", middleware.RequirePermission("rooms.update"), handlers.UpdateSchedule)
	rg.DELETE("/rooms/:id/schedules/:schedule_id", middleware.RequirePermission("rooms.update"), handlers.DeleteSchedule)

	// Doctor Schedules (Jadwal Dokter - nested under rooms)
	rg.GET("/rooms/:id/doctor-schedules", middleware.RequirePermission("rooms.view"), handlers.GetRoomDoctorSchedules)
	rg.POST("/rooms/:id/doctor-schedules", middleware.RequirePermission("rooms.update"), handlers.CreateDoctorSchedule)
	rg.PUT("/rooms/:id/doctor-schedules/:schedule_id", middleware.RequirePermission("rooms.update"), handlers.UpdateDoctorSchedule)
	rg.DELETE("/rooms/:id/doctor-schedules/:schedule_id", middleware.RequirePermission("rooms.update"), handlers.DeleteDoctorSchedule)

	// Schedules (general endpoints)
	rg.GET("/schedules", middleware.RequirePermission("rooms.view"), handlers.GetSchedules)
	rg.GET("/doctor-schedules", middleware.RequirePermission("rooms.view"), handlers.GetDoctorSchedules)
	rg.GET("/schedules/available-doctors", middleware.RequirePermission("rooms.view"), handlers.GetAvailableDoctorsByDate)

	// Schedule Exceptions
	rg.GET("/schedule-exceptions", middleware.RequirePermission("rooms.view"), handlers.GetScheduleExceptions)
	rg.POST("/schedule-exceptions", middleware.RequirePermission("rooms.update"), handlers.CreateScheduleException)
	rg.DELETE("/schedule-exceptions/:id", middleware.RequirePermission("rooms.update"), handlers.DeleteScheduleException)

	// Room Procedures (Tindakan yang tersedia di ruangan)
	rg.GET("/rooms/:id/procedures", middleware.RequirePermission("rooms.view"), handlers.GetRoomProcedures)
	rg.POST("/rooms/:id/procedures", middleware.RequirePermission("rooms.update"), handlers.CreateRoomProcedure)
	rg.POST("/rooms/:id/procedures/bulk", middleware.RequirePermission("rooms.update"), handlers.BulkAssignProcedures)
	rg.PUT("/rooms/:id/procedures/:rpId", middleware.RequirePermission("rooms.update"), handlers.UpdateRoomProcedure)
	rg.DELETE("/rooms/:id/procedures/:rpId", middleware.RequirePermission("rooms.update"), handlers.DeleteRoomProcedure)

	// Room Clinical Packages (Paket Klinis yang tersedia di ruangan)
	rg.GET("/rooms/:id/clinical-packages", middleware.RequirePermission("rooms.view"), handlers.GetRoomClinicalPackages)
	rg.POST("/rooms/:id/clinical-packages", middleware.RequirePermission("rooms.update"), handlers.AssignClinicalPackageToRoom)
	rg.PUT("/rooms/:id/clinical-packages/:assignmentId", middleware.RequirePermission("rooms.update"), handlers.UpdateRoomClinicalPackage)
	rg.DELETE("/rooms/:id/clinical-packages/:assignmentId", middleware.RequirePermission("rooms.update"), handlers.DeleteRoomClinicalPackage)

	// Room Tariffs (Tarif per Kelas Pasien untuk Rawat Inap)
	rg.GET("/rooms/:id/tariffs", middleware.RequirePermission("rooms.view"), handlers.GetRoomTariffs)
	rg.POST("/rooms/:id/tariffs", middleware.RequirePermission("rooms.update"), handlers.CreateRoomTariff)
	rg.POST("/rooms/:id/tariffs/bulk", middleware.RequirePermission("rooms.update"), handlers.BulkUpdateRoomTariffs)
	rg.PUT("/rooms/:id/tariffs/:tariffId", middleware.RequirePermission("rooms.update"), handlers.UpdateRoomTariff)
	rg.DELETE("/rooms/:id/tariffs/:tariffId", middleware.RequirePermission("rooms.update"), handlers.DeleteRoomTariff)

	// Room Inventories (Inventaris yang di-assign ke ruangan)
	rg.GET("/rooms/:id/inventories", middleware.RequirePermission("inventories.view"), handlers.GetRoomInventories)
	rg.POST("/rooms/:id/inventories", middleware.RequirePermission("inventories.update"), handlers.AssignInventoryToRoom)
	rg.PUT("/rooms/:id/inventories/:invId", middleware.RequirePermission("inventories.update"), handlers.UpdateRoomInventory)
	rg.DELETE("/rooms/:id/inventories/:invId", middleware.RequirePermission("inventories.delete"), handlers.RemoveRoomInventory)

	// Room Medicines (Obat yang di-assign ke ruangan/depo)
	rg.GET("/rooms/:id/medicines", middleware.RequirePermission("medicines.view"), handlers.GetRoomMedicines)
	rg.POST("/rooms/:id/medicines", middleware.RequirePermission("medicines.update"), handlers.AssignMedicineToRoom)
	rg.PUT("/rooms/:id/medicines/:medicineId", middleware.RequirePermission("medicines.update"), handlers.UpdateRoomMedicine)
	rg.DELETE("/rooms/:id/medicines/:medicineId", middleware.RequirePermission("medicines.delete"), handlers.RemoveMedicineFromRoom)
}
