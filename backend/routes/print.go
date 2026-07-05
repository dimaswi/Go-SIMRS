package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupPrintRoutes configures routes for PDF printing
func SetupPrintRoutes(api *gin.RouterGroup) {
	print := api.Group("/print")
	print.Use(middleware.PrintAuthMiddleware())
	{
		// Available docs check (lightweight)
		print.GET("/available-docs/:visitId", handlers.GetAvailableDocs)
		// MR print registry metadata
		print.GET("/mr-registry", handlers.GetMRPrintRegistryJSON)

		// A. Umum
		// Patient label PDF
		print.GET("/patient-label/:patientId", handlers.PrintMR00PatientLabel)
		// Informed consent / General consent PDF
		print.GET("/informed-consent/:patientId", handlers.PrintMR24InformedConsent)
		// MR.1 - Ringkasan Masuk dan Keluar Pasien
		print.GET("/admission-discharge-summary/:registrationId", handlers.PrintMR01AdmissionDischargeSummary)
		// General Consent Rawat Inap (RM-03)
		print.GET("/general-consent-inpatient/:visitId", handlers.PrintGeneralConsentInpatient)
		// Bukti Registrasi / Tanda Pendaftaran
		print.GET("/registration-receipt/:registrationId", handlers.PrintMR50RegistrationReceipt)
		// SEP (Surat Eligibilitas Peserta) - BPJS
		print.GET("/sep/:sepId", handlers.PrintMR50SEP)
		// Formulir Permohonan DPJP
		print.GET("/dpjp-request/:visitId", handlers.PrintMR50DPJPRequest)
		// Bukti Pemberian Informed Consent per Kunjungan
		print.GET("/informed-consent-receipt/:visitId", handlers.PrintMR24InformedConsentReceipt)

		// B. Rawat Jalan
		// Outpatient resume PDF
		print.GET("/outpatient-resume/:visitId", handlers.PrintMR35OutpatientResume)
		// Sick letter PDF
		print.GET("/sick-letter/:visitId", handlers.PrintMR39SickLetter)

		// C. Gawat Darurat (UGD)
		// Triage form PDF
		print.GET("/triage/:visitId", handlers.PrintMR06TriageForm)
		// Emergency summary PDF
		print.GET("/emergency-summary/:visitId", handlers.PrintMR35EmergencySummary)

		// D. Rawat Inap
		// Inpatient resume PDF
		print.GET("/inpatient-resume/:visitId", handlers.PrintMR35InpatientResume)
		// CPPT PDF
		print.GET("/cppt/:visitId", handlers.PrintMR07CPPT)
		// Nursing care PDF
		print.GET("/nursing-care/:visitId", handlers.PrintMR09NursingCare)
		// Fluid balance PDF
		print.GET("/fluid-balance/:visitId", handlers.PrintMR32FluidBalance)
		// Bed transfer PDF
		print.GET("/bed-transfer/:visitId", handlers.PrintBedTransfer)
		// Unit transfer PDF (Rawat Jalan/UGD)
		print.GET("/unit-transfer/:visitId", handlers.PrintUnitTransfer)
		// Vital sign chart PDF
		print.GET("/vital-sign-chart/:visitId", handlers.PrintMR10VitalSignChart)
		// Inpatient certificate PDF (Surat Keterangan Rawat Inap)
		print.GET("/inpatient-certificate/:visitId", handlers.PrintInpatientCertificate)
		// Death certificate PDF (Surat Kematian)
		print.GET("/death-certificate/:visitId", handlers.PrintMR40DeathCertificate)

		// M. Kebidanan / Kandungan
		// Rekam Medis Bersalin (Partograf)
		print.GET("/bersalin/:visitId", handlers.PrintMR47BersalinRecord)

		// E. Order & Penunjang
		// Prescription PDF
		print.GET("/prescription/:orderId", handlers.PrintMR13Prescription)
		// Lab order PDF
		print.GET("/lab-order/:orderId", handlers.PrintMR16LabOrder)
		// Lab result PDF
		print.GET("/lab-result/:orderId", handlers.PrintMR16LabResult)
		// Queue ticket by RoomQueue ID (Thermal 100mm x 80mm)
		print.GET("/queue-ticket/:queueId", handlers.PrintQueueTicket)
		// Queue ticket by Registration ID (Thermal 100mm x 80mm)
		print.GET("/registration-ticket/:registrationId", handlers.PrintRegistrationTicket)

		// F. Farmasi
		// Medicine label - single item (Thermal 100mm x 40mm)
		print.GET("/medicine-label/:itemId", handlers.PrintMedicineLabel)
		// Medicine labels - all items in order (Thermal 100mm x 40mm per label)
		print.GET("/medicine-labels/:orderId", handlers.PrintMedicineLabels)
		// Prescription thermal (100mm width) - for patient
		print.GET("/prescription-thermal/:orderId", handlers.PrintPrescriptionThermal)

		// G. Surat-Surat
		// Referral letter PDF (Surat Rujukan)
		print.GET("/referral-letter/:visitId", handlers.PrintMR38ReferralLetter)
		// Health certificate PDF (Surat Keterangan Sehat)
		print.GET("/health-certificate/:visitId", handlers.PrintMR39HealthCertificate)
		// Birth certificate PDF (Surat Keterangan Kelahiran)
		print.GET("/birth-certificate/:visitId", handlers.PrintMR39BirthCertificate)
		// Leave certificate PDF (Surat Keterangan Cuti)
		print.GET("/leave-certificate/:visitId", handlers.PrintMR39LeaveCertificate)
		// MCU certificate PDF (Surat Keterangan MCU)
		print.GET("/mcu-certificate/:visitId", handlers.PrintMR39MCUCertificate)

		// H. Billing & Kasir
		// Billing/Invoice PDF (Kwitansi)
		print.GET("/billing/:billingId", handlers.PrintBilling)

		// I. Gizi / Nutrisi
		// Nutrition food etiket (Thermal 100mm width)
		print.GET("/nutrition-etiket/:orderId", handlers.PrintNutritionEtiket)

		// J. RM Duplicate Order Prints (EKlaim)
		// Lab order from RM Duplicate
		print.GET("/rm-duplicate/lab-order/:rmOrderId", handlers.PrintRMDuplicateLabOrder)
		// Lab result from RM Duplicate
		print.GET("/rm-duplicate/lab-result/:rmOrderId", handlers.PrintRMDuplicateLabResult)
		// Radiology result from RM Duplicate
		print.GET("/rm-duplicate/radiology-result/:rmOrderId", handlers.PrintRMDuplicateRadiologyResult)
		// Surgery/Consultation result from RM Duplicate
		print.GET("/rm-duplicate/procedure-result/:rmOrderId", handlers.PrintRMDuplicateProcedureResult)
		// Prescription from RM Duplicate
		print.GET("/rm-duplicate/prescription/:rmOrderId", handlers.PrintRMDuplicatePrescription)
		// Billing from RM Duplicate
		print.GET("/rm-duplicate/billing/:rmDuplicateId", handlers.PrintRMDuplicateBilling)
		// Bersalin from RM Duplicate
		print.GET("/rm-duplicate/bersalin/:rmDuplicateId", handlers.PrintRMDuplicateBersalin)

		// K. BPJS - SPRI & Surat Kontrol
		// SPRI (Surat Perintah Rawat Inap)
		print.GET("/spri/:spriId", handlers.PrintMR36SPRI)
		// Surat Kontrol / SKDP
		print.GET("/surat-kontrol/:suratKontrolId", handlers.PrintMR36SuratKontrol)
		// Surat Kontrol Umum (SIMRS follow-up)
		print.GET("/surat-kontrol-simrs/:registrationId", handlers.PrintMR36SuratKontrolSIMRS)

		// L. Cache Management (Admin)
		print.GET("/cache/stats", middleware.RequirePermission("settings.manage"), handlers.GetPDFCacheStats)
		print.DELETE("/cache/cleanup", middleware.RequirePermission("settings.manage"), handlers.CleanupPDFCache)
	}

	// Public Print Routes (No Auth Required)
	publicPrint := api.Group("/print-public")
	{
		// Kiosk queue ticket (Thermal 100mm x 90mm)
		publicPrint.GET("/kiosk-ticket/:queueId", handlers.PrintKioskTicket)
	}
}
