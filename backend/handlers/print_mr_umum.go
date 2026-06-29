package handlers

import "github.com/gin-gonic/gin"

func PrintMR00PatientLabel(c *gin.Context) {
	PrintPatientLabel(c)
}

func PrintMR01AdmissionDischargeSummary(c *gin.Context) {
	PrintAdmissionDischargeSummary(c)
}

func PrintMR24InformedConsent(c *gin.Context) {
	PrintInformedConsent(c)
}

func PrintMR24InformedConsentReceipt(c *gin.Context) {
	PrintInformedConsentReceipt(c)
}

func PrintMR50SEP(c *gin.Context) {
	PrintSEP(c)
}

func PrintMR50RegistrationReceipt(c *gin.Context) {
	PrintRegistrationReceipt(c)
}

func PrintMR50DPJPRequest(c *gin.Context) {
	PrintDPJPRequest(c)
}
