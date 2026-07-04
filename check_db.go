package main
import (
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"time"
)
type DocSig struct {
	ID uint
	DocumentType string
	DocumentID uint
	RequiredSignatures int
	SignedSignatures int
	CreatedAt time.Time
}
func main() {
	db, err := gorm.Open(postgres.Open("host=localhost user=postgres password=Dimasw1950 dbname=simrs port=5432 sslmode=disable"), &gorm.Config{})
	if err != nil { panic(err) }
	var sigs []DocSig
	db.Table("document_signatures").Where("document_type = ?", "general_consent_inpatient").Order("id desc").Limit(5).Find(&sigs)
	for _, s := range sigs {
		fmt.Printf("ID: %d, DocType: %s, DocID: %d, Req: %d, Signed: %d, Created: %s\n", s.ID, s.DocumentType, s.DocumentID, s.RequiredSignatures, s.SignedSignatures, s.CreatedAt)
	}
}
