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

		// H. Billing & Kasir
		// Billing/Invoice PDF (Kwitansi)
		print.GET("/billing/:billingId", handlers.PrintBilling)
	}
}
