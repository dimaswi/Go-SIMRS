package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupReportRoutes configures all report routes
func SetupReportRoutes(api *gin.RouterGroup) {
	reports := api.Group("/reports")
	reports.Use(middleware.AuthMiddleware())
	{
		// ==============================
		// Category A: Kunjungan & Pasien
		// ==============================
		visits := reports.Group("/visits")
		{
			visits.GET("/daily", handlers.ReportDailyVisits)
			visits.GET("/by-room", handlers.ReportVisitsByRoom)
			visits.GET("/by-doctor", handlers.ReportVisitsByDoctor)
			visits.GET("/demographics", handlers.ReportPatientDemographics)
			visits.GET("/regions", handlers.ReportPatientRegions)
			visits.GET("/top-diagnoses", handlers.ReportTopDiagnoses)
			visits.GET("/new-vs-old", handlers.ReportNewVsOldPatients)
			visits.GET("/payment-methods", handlers.ReportPaymentMethods)
			visits.GET("/referrals", handlers.ReportReferrals)
		}

		// ==============================
		// Category B: BPJS
		// ==============================
		bpjs := reports.Group("/bpjs")
		{
			bpjs.GET("/daily", handlers.ReportBPJSDailyVisits)
			bpjs.GET("/sep", handlers.ReportSEP)
			bpjs.GET("/surat-kontrol", handlers.ReportSuratKontrol)
			bpjs.GET("/antrean", handlers.ReportAntreanBPJS)
			bpjs.GET("/eklaim", handlers.ReportEKlaim)
			bpjs.GET("/by-poli", handlers.ReportBPJSByPoli)
		}

		// ==============================
		// Category C: Keuangan
		// ==============================
		billing := reports.Group("/billing")
		{
			billing.GET("/daily-revenue", handlers.ReportDailyRevenue)
			billing.GET("/by-payment", handlers.ReportRevenueByPayment)
			billing.GET("/by-room", handlers.ReportRevenueByRoom)
			billing.GET("/by-doctor", handlers.ReportRevenueByDoctor)
			billing.GET("/receivables", handlers.ReportReceivables)
			billing.GET("/by-item-type", handlers.ReportBillingByItemType)
		}

		// ==============================
		// Category D: Rawat Inap
		// ==============================
		inpatient := reports.Group("/inpatient")
		{
			inpatient.GET("/indicators", handlers.ReportInpatientIndicators)
			inpatient.GET("/census", handlers.ReportInpatientCensus)
			inpatient.GET("/list", handlers.ReportInpatientList)
			inpatient.GET("/by-room", handlers.ReportInpatientByRoom)
		}

		// ==============================
		// Category E: Farmasi
		// ==============================
		pharmacy := reports.Group("/pharmacy")
		{
			pharmacy.GET("/daily", handlers.ReportPharmacyDaily)
			pharmacy.GET("/top-medicines", handlers.ReportTopMedicines)
			pharmacy.GET("/by-doctor", handlers.ReportPharmacyByDoctor)
			pharmacy.GET("/by-depo", handlers.ReportPharmacyByDepo)
			pharmacy.GET("/tat", handlers.ReportPharmacyTAT)
		}

		// ==============================
		// Category F: Penunjang (Lab & Radiologi)
		// ==============================
		penunjang := reports.Group("/penunjang")
		{
			penunjang.GET("/daily", handlers.ReportPenunjangDaily)
			penunjang.GET("/top-lab", handlers.ReportTopLabExams)
			penunjang.GET("/top-radiology", handlers.ReportTopRadiologyExams)
			penunjang.GET("/critical-results", handlers.ReportCriticalResults)
			penunjang.GET("/tat", handlers.ReportPenunjangTAT)
		}

		// ==============================
		// Category G: Inventaris & Stok
		// ==============================
		inventory := reports.Group("/inventory")
		{
			inventory.GET("/medicine-stock", handlers.ReportMedicineStock)
			inventory.GET("/expired-medicines", handlers.ReportExpiredMedicines)
			inventory.GET("/stock", handlers.ReportInventoryStock)
			inventory.GET("/mutations", handlers.ReportStockMutations)
		}

		// ==============================
		// Category H: SDM
		// ==============================
		hr := reports.Group("/hr")
		{
			hr.GET("/summary", handlers.ReportEmployeeSummary)
			hr.GET("/doctors", handlers.ReportDoctorList)
			hr.GET("/license-expiry", handlers.ReportLicenseExpiry)
			hr.GET("/doctor-workload", handlers.ReportDoctorWorkload)
		}

		// ==============================
		// Category I: Kemenkes / RL
		// ==============================
		kemenkes := reports.Group("/kemenkes")
		{
			kemenkes.GET("/rl12-beds", handlers.ReportRL12BedFacility)
			kemenkes.GET("/rl31-top-diseases-outpatient", handlers.ReportRL31TopDiseasesOutpatient)
			kemenkes.GET("/rl32-top-diseases-inpatient", handlers.ReportRL32TopDiseasesInpatient)
			kemenkes.GET("/rl4a-visits", handlers.ReportRL4AVisitsByType)
			kemenkes.GET("/rl51-workforce", handlers.ReportRL51Workforce)
			kemenkes.GET("/quality-indicators", handlers.ReportQualityIndicators)
		}
	}
}
