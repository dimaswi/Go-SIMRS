package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupPrintRoutes configures routes for PDF printing
func SetupPrintRoutes(api *gin.RouterGroup) {
	print := api.Group("/print")
	print.Use(middleware.AuthMiddleware())
	{
		// Available docs check (lightweight)
		print.GET("/available-docs/:visitId", handlers.GetAvailableDocs)

		// A. Umum
		// Patient label PDF
		print.GET("/patient-label/:patientId", handlers.PrintPatientLabel)
		// Informed consent / General consent PDF
		print.GET("/informed-consent/:patientId", handlers.PrintInformedConsent)
		// MR.1 - Ringkasan Masuk dan Keluar Pasien
		print.GET("/admission-discharge-summary/:registrationId", handlers.PrintAdmissionDischargeSummary)
		// Bukti Registrasi / Tanda Pendaftaran
		print.GET("/registration-receipt/:registrationId", handlers.PrintRegistrationReceipt)
		// SEP (Surat Eligibilitas Peserta) - BPJS
		print.GET("/sep/:sepId", handlers.PrintSEP)
		// Formulir Permohonan DPJP
		print.GET("/dpjp-request/:visitId", handlers.PrintDPJPRequest)
		// Bukti Pemberian Informed Consent per Kunjungan
		print.GET("/informed-consent-receipt/:visitId", handlers.PrintInformedConsentReceipt)

		// B. Rawat Jalan
		// Outpatient resume PDF
		print.GET("/outpatient-resume/:visitId", handlers.PrintOutpatientResume)
		// Sick letter PDF
		print.GET("/sick-letter/:visitId", handlers.PrintSickLetter)

		// C. Gawat Darurat (UGD)
		// Triage form PDF
		print.GET("/triage/:visitId", handlers.PrintTriageForm)
		// Emergency summary PDF
		print.GET("/emergency-summary/:visitId", handlers.PrintEmergencySummary)

		// D. Rawat Inap
		// Inpatient resume PDF
		print.GET("/inpatient-resume/:visitId", handlers.PrintInpatientResume)
		// CPPT PDF
		print.GET("/cppt/:visitId", handlers.PrintCPPT)
		// Nursing care PDF
		print.GET("/nursing-care/:visitId", handlers.PrintNursingCare)
		// Fluid balance PDF
		print.GET("/fluid-balance/:visitId", handlers.PrintFluidBalance)
		// Bed transfer PDF
		print.GET("/bed-transfer/:visitId", handlers.PrintBedTransfer)
		// Unit transfer PDF (Rawat Jalan/UGD)
		print.GET("/unit-transfer/:visitId", handlers.PrintUnitTransfer)
		// Vital sign chart PDF
		print.GET("/vital-sign-chart/:visitId", handlers.PrintVitalSignChart)
		// Inpatient certificate PDF (Surat Keterangan Rawat Inap)
		print.GET("/inpatient-certificate/:visitId", handlers.PrintInpatientCertificate)
		// Death certificate PDF (Surat Kematian)
		print.GET("/death-certificate/:visitId", handlers.PrintDeathCertificate)

		// E. Order & Penunjang
		// Prescription PDF
		print.GET("/prescription/:orderId", handlers.PrintPrescription)
		// Lab order PDF
		print.GET("/lab-order/:orderId", handlers.PrintLabOrder)
		// Lab result PDF
		print.GET("/lab-result/:orderId", handlers.PrintLabResult)
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
		print.GET("/referral-letter/:visitId", handlers.PrintReferralLetter)
		// Health certificate PDF (Surat Keterangan Sehat)
		print.GET("/health-certificate/:visitId", handlers.PrintHealthCertificate)
		// Birth certificate PDF (Surat Keterangan Kelahiran)
		print.GET("/birth-certificate/:visitId", handlers.PrintBirthCertificate)
		// Leave certificate PDF (Surat Keterangan Cuti)
		print.GET("/leave-certificate/:visitId", handlers.PrintLeaveCertificate)
		// MCU certificate PDF (Surat Keterangan MCU)
		print.GET("/mcu-certificate/:visitId", handlers.PrintMCUCertificate)

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

		// K. BPJS - SPRI & Surat Kontrol
		// SPRI (Surat Perintah Rawat Inap)
		print.GET("/spri/:spriId", handlers.PrintSPRI)
		// Surat Kontrol / SKDP
		print.GET("/surat-kontrol/:suratKontrolId", handlers.PrintSuratKontrol)
		// Surat Kontrol Umum (SIMRS follow-up)
		print.GET("/surat-kontrol-simrs/:registrationId", handlers.PrintSuratKontrolSIMRS)

		// L. Cache Management (Admin)
		print.GET("/cache/stats", middleware.RequirePermission("settings.manage"), handlers.GetPDFCacheStats)
		print.DELETE("/cache/cleanup", middleware.RequirePermission("settings.manage"), handlers.CleanupPDFCache)
	}
}
