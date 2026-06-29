package handlers

import "github.com/gin-gonic/gin"

func PrintOutpatientResume(c *gin.Context) {
	printOutpatientResumeImpl(c)
}

func PrintInpatientResume(c *gin.Context) {
	printInpatientResumeImpl(c)
}

func PrintEmergencySummary(c *gin.Context) {
	printEmergencySummaryImpl(c)
}

func PrintPatientLabel(c *gin.Context) {
	printPatientLabelImpl(c)
}

func PrintTriageForm(c *gin.Context) {
	printTriageFormImpl(c)
}

func PrintBedTransfer(c *gin.Context) {
	printBedTransferImpl(c)
}

func PrintUnitTransfer(c *gin.Context) {
	printUnitTransferImpl(c)
}

func PrintReferralLetter(c *gin.Context) {
	printReferralLetterImpl(c)
}

func PrintInpatientCertificate(c *gin.Context) {
	printInpatientCertificateImpl(c)
}

func PrintPrescription(c *gin.Context) {
	printPrescriptionImpl(c)
}

func PrintLabOrder(c *gin.Context) {
	printLabOrderImpl(c)
}

func PrintLabResult(c *gin.Context) {
	printLabResultImpl(c)
}

func PrintCPPT(c *gin.Context) {
	printCPPTImpl(c)
}

func PrintNursingCare(c *gin.Context) {
	printNursingCareImpl(c)
}

func PrintFluidBalance(c *gin.Context) {
	printFluidBalanceImpl(c)
}

func PrintVitalSignChart(c *gin.Context) {
	printVitalSignChartImpl(c)
}

func PrintLaboratoryResult(c *gin.Context) {
	printLaboratoryResultImpl(c)
}

func PrintLaboratoryResultItem(c *gin.Context) {
	printLaboratoryResultItemImpl(c)
}

func PrintRadiologyResult(c *gin.Context) {
	printRadiologyResultImpl(c)
}

func PrintRadiologyResultItem(c *gin.Context) {
	printRadiologyResultItemImpl(c)
}

func PrintSickLetter(c *gin.Context) {
	printSickLetterImpl(c)
}

func PrintDeathCertificate(c *gin.Context) {
	printDeathCertificateImpl(c)
}

func PrintHealthCertificate(c *gin.Context) {
	printHealthCertificateImpl(c)
}

func PrintBirthCertificate(c *gin.Context) {
	printBirthCertificateImpl(c)
}

func PrintLeaveCertificate(c *gin.Context) {
	printLeaveCertificateImpl(c)
}

func PrintMCUCertificate(c *gin.Context) {
	printMCUCertificateImpl(c)
}

func PrintQueueTicket(c *gin.Context) {
	printQueueTicketImpl(c)
}

func PrintRegistrationTicket(c *gin.Context) {
	printRegistrationTicketImpl(c)
}

func PrintMedicineLabel(c *gin.Context) {
	printMedicineLabelImpl(c)
}

func PrintMedicineLabels(c *gin.Context) {
	printMedicineLabelsImpl(c)
}

func PrintPrescriptionThermal(c *gin.Context) {
	printPrescriptionThermalImpl(c)
}

func PrintBilling(c *gin.Context) {
	printBillingImpl(c)
}

func PrintInformedConsent(c *gin.Context) {
	printInformedConsentImpl(c)
}

func PrintAdmissionDischargeSummary(c *gin.Context) {
	printAdmissionDischargeSummaryImpl(c)
}

func PrintRegistrationReceipt(c *gin.Context) {
	printRegistrationReceiptImpl(c)
}

func PrintDPJPRequest(c *gin.Context) {
	printDPJPRequestImpl(c)
}

func PrintInformedConsentReceipt(c *gin.Context) {
	printInformedConsentReceiptImpl(c)
}

func PrintSEP(c *gin.Context) {
	printSEPImpl(c)
}

func PrintNutritionEtiket(c *gin.Context) {
	printNutritionEtiketImpl(c)
}

func PrintRMDuplicateLabOrder(c *gin.Context) {
	printRMDuplicateLabOrderImpl(c)
}

func PrintRMDuplicateLabResult(c *gin.Context) {
	printRMDuplicateLabResultImpl(c)
}

func PrintRMDuplicateRadiologyResult(c *gin.Context) {
	printRMDuplicateRadiologyResultImpl(c)
}

func PrintRMDuplicateProcedureResult(c *gin.Context) {
	printRMDuplicateProcedureResultImpl(c)
}

func PrintRMDuplicatePrescription(c *gin.Context) {
	printRMDuplicatePrescriptionImpl(c)
}

func PrintRMDuplicateBilling(c *gin.Context) {
	printRMDuplicateBillingImpl(c)
}

func PrintSPRI(c *gin.Context) {
	printSPRIImpl(c)
}

func PrintSuratKontrol(c *gin.Context) {
	printSuratKontrolImpl(c)
}

func PrintSuratKontrolSIMRS(c *gin.Context) {
	printSuratKontrolSIMRSImpl(c)
}
