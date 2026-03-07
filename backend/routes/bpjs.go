package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupBPJSRoutes configures all BPJS-related routes
func SetupBPJSRoutes(api *gin.RouterGroup) {
	bpjs := api.Group("/bpjs")
	{
		// Protected routes - require authentication
		bpjs.Use(middleware.AuthMiddleware())

		// Config routes (admin only)
		config := bpjs.Group("/config")
		config.Use(middleware.RequirePermission("integrations.view"))
		{
			config.GET("", handlers.GetBPJSConfig)
			config.PUT("", handlers.UpdateBPJSConfig)
			config.POST("/init", handlers.InitBPJSConfig)
		}

		// Test connection
		bpjs.GET("/test-connection", middleware.RequirePermission("integrations.view"), handlers.TestBPJSConnection)

		// API Tester (like Postman)
		bpjs.POST("/api-test", middleware.RequirePermission("integrations.view"), handlers.BPJSAPITester)

		// Referensi BPJS Antrian Online
		referensi := bpjs.Group("/referensi")
		referensi.Use(middleware.RequirePermission("integrations.view"))
		{
			referensi.GET("/poli", handlers.GetBPJSReferensiPoli)
			referensi.GET("/dokter", handlers.GetBPJSReferensiDokter)
			referensi.GET("/jadwal-dokter", handlers.GetBPJSJadwalDokter)
			referensi.POST("/jadwal-dokter", handlers.UpdateBPJSJadwalDokter)
		}

		// Sync logs
		logs := bpjs.Group("/logs")
		logs.Use(middleware.RequirePermission("integrations.view"))
		{
			logs.GET("", handlers.GetBPJSSyncLogs)
			logs.GET("/stats", handlers.GetBPJSSyncStats)
		}

		// Poli mapping
		mapping := bpjs.Group("/mapping")
		mapping.Use(middleware.RequirePermission("integrations.view"))
		{
			// Poli mapping
			mapping.GET("/poli", handlers.GetBPJSPoliMappings)
			mapping.POST("/poli", middleware.RequirePermission("integrations.manage"), handlers.CreateBPJSPoliMapping)
			mapping.PUT("/poli/:id", middleware.RequirePermission("integrations.manage"), handlers.UpdateBPJSPoliMapping)
			mapping.DELETE("/poli/:id", middleware.RequirePermission("integrations.manage"), handlers.DeleteBPJSPoliMapping)

			// Doctor mapping
			mapping.GET("/dokter", handlers.GetBPJSDoctorMappings)
			mapping.POST("/dokter", middleware.RequirePermission("integrations.manage"), handlers.CreateBPJSDoctorMapping)
			mapping.PUT("/dokter/:id", middleware.RequirePermission("integrations.manage"), handlers.UpdateBPJSDoctorMapping)
			mapping.DELETE("/dokter/:id", middleware.RequirePermission("integrations.manage"), handlers.DeleteBPJSDoctorMapping)
			mapping.POST("/dokter/sync", middleware.RequirePermission("integrations.manage"), handlers.SyncBPJSDoctorFromReferensi)
		}

		// BPJS Queue management (antrian MJKN)
		queue := bpjs.Group("/queue")
		queue.Use(middleware.RequirePermission("registrations.view"))
		{
			queue.GET("", handlers.GetBPJSQueues)
			queue.GET("/registration/:id", handlers.GetBPJSQueueByRegistration)
			queue.GET("/visit/:id", handlers.GetBPJSQueueByVisit)
			queue.POST("/:id/checkin", middleware.RequirePermission("registrations.update"), handlers.ActivateBPJSQueueCheckin)
			queue.POST("/:id/send-task", middleware.RequirePermission("registrations.update"), handlers.SendBPJSTaskManual)
			queue.POST("/:id/retry-add", middleware.RequirePermission("registrations.update"), handlers.RetryAddAntrean)
			queue.POST("/:id/cancel", middleware.RequirePermission("registrations.delete"), handlers.CancelBPJSQueue)
		}

		// Antrian Online (direct BPJS Antrian API calls)
		antrean := bpjs.Group("/antrean")
		antrean.Use(middleware.RequirePermission("integrations.view"))
		{
			antrean.GET("/pendaftaran/:tanggal", handlers.GetBPJSPendaftaranAntrean)
			antrean.GET("/pendaftaran-detail/:kodebooking", handlers.GetBPJSPendaftaranByKodeBooking)
			antrean.POST("/getlisttask", handlers.GetBPJSListTask)
			antrean.POST("/batal", middleware.RequirePermission("registrations.delete"), handlers.BatalAntreanOnline)
		}

		// ==================== VCLAIM ====================
		vclaim := bpjs.Group("/vclaim")
		vclaim.Use(middleware.RequirePermission("registrations.view"))
		{
			// Peserta
			vclaim.GET("/peserta/nokartu/:noKartu", handlers.VClaimGetPesertaByNoKartu)
			vclaim.GET("/peserta/nik/:nik", handlers.VClaimGetPesertaByNIK)

			// Rujukan
			vclaim.GET("/rujukan/nomor/:noRujukan", handlers.VClaimGetRujukanByNomor)
			vclaim.GET("/rujukan/peserta/:noKartu", handlers.VClaimGetRujukanByPeserta)

			// SEP
			vclaim.POST("/sep", middleware.RequirePermission("registrations.create"), handlers.VClaimCreateSEP)
			vclaim.POST("/sep/import", middleware.RequirePermission("registrations.create"), handlers.VClaimImportSEP)
			vclaim.POST("/sep/approval", middleware.RequirePermission("registrations.update"), handlers.VClaimApprovalSEP)   // Approval SEP backdate/finger print
			vclaim.POST("/sep/pengajuan", middleware.RequirePermission("registrations.update"), handlers.VClaimPengajuanSEP) // Pengajuan SEP backdate/finger print
			vclaim.GET("/sep/:noSEP", handlers.VClaimGetSEP)
			vclaim.PUT("/sep/:noSEP", middleware.RequirePermission("registrations.update"), handlers.VClaimUpdateSEP)
			vclaim.DELETE("/sep/:noSEP", middleware.RequirePermission("registrations.update"), handlers.VClaimDeleteSEP)

			// SEP Options (untuk dropdown/select)
			vclaim.GET("/sep/options", handlers.VClaimGetSEPOptions)

			// SEP Local (dari database SIMRS)
			vclaim.GET("/sep/visit/:visitId", handlers.GetSEPByVisit)
			vclaim.GET("/sep/registration/:registrationId", handlers.GetSEPByRegistration)
			vclaim.GET("/sep/list", handlers.GetSEPList)
			vclaim.PATCH("/sep/:noSEP/visit", middleware.RequirePermission("registrations.update"), handlers.UpdateSEPVisitID)

			// SPRI (Surat Perintah Rawat Inap)
			vclaim.POST("/spri", middleware.RequirePermission("registrations.create"), handlers.VClaimCreateSPRI)
			vclaim.POST("/spri/local", middleware.RequirePermission("registrations.create"), handlers.CreateLocalSPRI)
			vclaim.GET("/spri/poli", handlers.VClaimSearchPoliSPRI)
			vclaim.GET("/spri/dokter", handlers.VClaimSearchDokterSPRI)
			vclaim.GET("/spri/list", handlers.GetSPRIList)
			vclaim.GET("/spri/visit/:visitId", handlers.GetSPRIByVisit)
			vclaim.GET("/spri/registration/:registrationId", handlers.GetSPRIByRegistration)
			vclaim.PUT("/spri/visit/:visitId/cancel", middleware.RequirePermission("registrations.delete"), handlers.CancelSPRIByVisit)
			vclaim.PUT("/spri/registration/:registrationId/cancel", middleware.RequirePermission("registrations.delete"), handlers.CancelSPRIByRegistration)
			vclaim.DELETE("/spri/:noSPRI", middleware.RequirePermission("registrations.delete"), handlers.VClaimDeleteSPRI)
			vclaim.PUT("/spri/:noSPRI", middleware.RequirePermission("registrations.update"), handlers.VClaimUpdateSPRI)

			// Surat Kontrol (SKDP Rawat Jalan)
			vclaim.POST("/surat-kontrol", middleware.RequirePermission("registrations.create"), handlers.VClaimCreateSuratKontrol)
			vclaim.DELETE("/surat-kontrol/:noSuratKontrol", middleware.RequirePermission("registrations.delete"), handlers.VClaimDeleteSuratKontrol)
			vclaim.PUT("/surat-kontrol/:noSuratKontrol", middleware.RequirePermission("registrations.update"), handlers.VClaimUpdateSuratKontrol)
			vclaim.GET("/surat-kontrol/poli", handlers.VClaimSearchPoliSuratKontrol)
			vclaim.GET("/surat-kontrol/dokter", handlers.VClaimSearchDokterSuratKontrol)
			vclaim.GET("/surat-kontrol/prb-options", handlers.VClaimGetPRBOptions)
			vclaim.GET("/surat-kontrol/visit/:visitId", handlers.GetSuratKontrolByVisit)
			vclaim.GET("/surat-kontrol/registration/:registrationId", handlers.GetSuratKontrolByRegistration)
			vclaim.GET("/surat-kontrol/list", handlers.GetSuratKontrolList)
			vclaim.GET("/surat-kontrol/local/:noSuratKontrol", handlers.GetSuratKontrolLocal) // Get from local DB with SEP asal

			// Rencana Kontrol / SKDP
			vclaim.GET("/rencana-kontrol/sep/:noSEP", handlers.VClaimGetRencanaKontrolBySEP)
			vclaim.GET("/rencana-kontrol/peserta/:noKartu", handlers.VClaimGetListRencanaKontrol)

			// Check-In Kontrol (Surat Kontrol + SEP Kontrol)
			vclaim.GET("/surat-kontrol/detail/:noSuratKontrol", handlers.VClaimGetSuratKontrolDetail)
			vclaim.GET("/surat-kontrol/cari/:noKartu", handlers.VClaimCariSuratKontrolByNoKartu)
			vclaim.POST("/sep/kontrol", middleware.RequirePermission("registrations.update"), handlers.VClaimInsertSEPKontrol)

			// Persetujuan / Approval SEP (untuk SEP backdate atau fingerprint)
			vclaim.GET("/sep/persetujuan", handlers.VClaimGetListPersetujuanSEP)

			// Referensi VClaim
			vclaim.GET("/referensi/poli", handlers.VClaimGetReferensiPoli)
			vclaim.GET("/referensi/diagnosa", handlers.VClaimGetReferensiDiagnosa)
			vclaim.GET("/referensi/faskes", handlers.VClaimGetReferensiFaskes)
			vclaim.GET("/referensi/dokter-dpjp", handlers.VClaimGetReferensiDokterDPJP)
			vclaim.GET("/referensi/propinsi", handlers.VClaimGetReferensiPropinsi)
			vclaim.GET("/referensi/kabupaten/:kdPropinsi", handlers.VClaimGetReferensiKabupaten)
			vclaim.GET("/referensi/kecamatan/:kdKabupaten", handlers.VClaimGetReferensiKecamatan)
		}

		// ==================== I-CARE ====================
		icare := bpjs.Group("/icare")
		icare.Use(middleware.RequirePermission("registrations.view"))
		{
			icare.POST("/validate/:visitId", handlers.ICareValidate)
			icare.POST("/validate-manual", handlers.ICareValidateManual)
		}

		// ==================== APLICARE ====================
		aplicare := bpjs.Group("/aplicare")
		aplicare.Use(middleware.RequirePermission("integrations.view"))
		{
			aplicare.GET("/ref-kelas", handlers.AplicareGetRefKelas)
			aplicare.GET("/bed", handlers.AplicareReadBed)
			aplicare.GET("/rooms", handlers.AplicareGetRooms)
			aplicare.POST("/bed/create", middleware.RequirePermission("integrations.manage"), handlers.AplicareCreateRoom)
			aplicare.POST("/bed/update", middleware.RequirePermission("integrations.manage"), handlers.AplicareUpdateRoom)
			aplicare.POST("/bed/delete", middleware.RequirePermission("integrations.manage"), handlers.AplicareDeleteRoom)
		}
	}
}

// SetupBPJSWebhookRoutes configures webhook endpoints that BPJS calls to RS
// These are PUBLIC endpoints with BPJS token authentication (not SIMRS auth)
func SetupBPJSWebhookRoutes(router *gin.Engine) {
	// BPJS Webhook endpoints - these are called BY BPJS to our system
	// Authentication is via x-username and x-password headers
	webhook := router.Group("/bpjs-webhook")
	{
		// Token generation (BPJS calls this first to get token)
		webhook.GET("/token", handlers.BPJSWebhookGetToken)

		// Antrean endpoints (authenticated with token)
		antrean := webhook.Group("/antrean")
		antrean.Use(handlers.ValidateBPJSWebhookToken())
		{
			antrean.POST("/status", handlers.BPJSWebhookStatusAntrean)
			antrean.POST("/ambil", handlers.BPJSWebhookAmbilAntrean)
			antrean.POST("/sisa", handlers.BPJSWebhookSisaAntrean)
			antrean.POST("/batal", handlers.BPJSWebhookBatalAntrean)
			antrean.POST("/checkin", handlers.BPJSWebhookCheckIn)
			antrean.POST("/pasien-baru", handlers.BPJSWebhookPasienBaru)
		}

		// Jadwal Operasi endpoints
		operasi := webhook.Group("/operasi")
		operasi.Use(handlers.ValidateBPJSWebhookToken())
		{
			operasi.POST("/rs", handlers.BPJSWebhookJadwalOperasiRS)
			operasi.POST("/pasien", handlers.BPJSWebhookJadwalOperasiPasien)
		}

		// Farmasi endpoints
		farmasi := webhook.Group("/farmasi")
		farmasi.Use(handlers.ValidateBPJSWebhookToken())
		{
			farmasi.POST("/antrean", handlers.BPJSWebhookAmbilAntreanFarmasi)
			farmasi.POST("/status", handlers.BPJSWebhookStatusAntreanFarmasi)
		}
	}
}
