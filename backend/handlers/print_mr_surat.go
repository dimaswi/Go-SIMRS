package handlers

import "github.com/gin-gonic/gin"

func PrintMR36SPRI(c *gin.Context) {
	PrintSPRI(c)
}

func PrintMR36SuratKontrol(c *gin.Context) {
	PrintSuratKontrol(c)
}

func PrintMR36SuratKontrolSIMRS(c *gin.Context) {
	PrintSuratKontrolSIMRS(c)
}

func PrintMR38ReferralLetter(c *gin.Context) {
	PrintReferralLetter(c)
}

func PrintMR39SickLetter(c *gin.Context) {
	PrintSickLetter(c)
}

func PrintMR39HealthCertificate(c *gin.Context) {
	PrintHealthCertificate(c)
}

func PrintMR39BirthCertificate(c *gin.Context) {
	PrintBirthCertificate(c)
}

func PrintMR39LeaveCertificate(c *gin.Context) {
	PrintLeaveCertificate(c)
}

func PrintMR39MCUCertificate(c *gin.Context) {
	PrintMCUCertificate(c)
}

func PrintMR40DeathCertificate(c *gin.Context) {
	PrintDeathCertificate(c)
}
