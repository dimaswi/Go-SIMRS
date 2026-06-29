package handlers

import "github.com/gin-gonic/gin"

func PrintMR06TriageForm(c *gin.Context) {
	PrintTriageForm(c)
}

func PrintMR07CPPT(c *gin.Context) {
	PrintCPPT(c)
}

func PrintMR09NursingCare(c *gin.Context) {
	PrintNursingCare(c)
}

func PrintMR10VitalSignChart(c *gin.Context) {
	PrintVitalSignChart(c)
}

func PrintMR32FluidBalance(c *gin.Context) {
	PrintFluidBalance(c)
}

func PrintMR35OutpatientResume(c *gin.Context) {
	PrintOutpatientResume(c)
}

func PrintMR35InpatientResume(c *gin.Context) {
	PrintInpatientResume(c)
}

func PrintMR35EmergencySummary(c *gin.Context) {
	PrintEmergencySummary(c)
}

func PrintMR47BersalinRecord(c *gin.Context) {
	printBersalinRecordImpl(c, false)
}

func PrintRMDuplicateBersalin(c *gin.Context) {
	printBersalinRecordImpl(c, true)
}

