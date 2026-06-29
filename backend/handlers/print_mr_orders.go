package handlers

import "github.com/gin-gonic/gin"

func PrintMR13Prescription(c *gin.Context) {
	PrintPrescription(c)
}

func PrintMR16LabOrder(c *gin.Context) {
	PrintLabOrder(c)
}

func PrintMR16LabResult(c *gin.Context) {
	PrintLabResult(c)
}

func PrintMR16LaboratoryResult(c *gin.Context) {
	PrintLaboratoryResult(c)
}

func PrintMR16LaboratoryResultItem(c *gin.Context) {
	PrintLaboratoryResultItem(c)
}

func PrintMR17RadiologyResult(c *gin.Context) {
	PrintRadiologyResult(c)
}

func PrintMR17RadiologyResultItem(c *gin.Context) {
	PrintRadiologyResultItem(c)
}

func PrintMR21ConsultationResult(c *gin.Context) {
	PrintProcedureOrderResult(c)
}

func PrintMR28OperativeReport(c *gin.Context) {
	PrintProcedureOrderResult(c)
}
