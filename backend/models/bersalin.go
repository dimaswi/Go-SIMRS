package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// BersalinRecord merepresentasikan rekam medis khusus untuk tab Bersalin (Labor & Delivery)
type BersalinRecord struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Casemix Support
	IsCasemix       bool  `gorm:"default:false;index" json:"is_casemix"`
	CasemixEklaimID *uint `gorm:"index" json:"casemix_eklaim_id,omitempty"`

	RecordedByID *uint `gorm:"index" json:"recorded_by_id,omitempty"`
	RecordedBy   *User `gorm:"foreignKey:RecordedByID" json:"recorded_by,omitempty"`

	// 1. Asesmen Awal & Fisik
	JamDatang       string `gorm:"size:20" json:"jam_datang,omitempty"`
	JamPengkajian   string `gorm:"size:20" json:"jam_pengkajian,omitempty"`
	AnamnesisType   string `gorm:"size:50" json:"anamnesis_type,omitempty"` // Autoanamnesis, Alloanamnesis
	KeluhanUtama    string `gorm:"type:text" json:"keluhan_utama,omitempty"`

	// Pemeriksaan Fisik (menggunakan JSON untuk fleksibilitas)
	PemeriksaanFisikJSON datatypes.JSON `json:"pemeriksaan_fisik,omitempty"`
	GenetaliaJSON        datatypes.JSON `json:"genetalia,omitempty"`

	// 2. Skrining & Riwayat Kesehatan
	SkorNorton    int            `json:"skor_norton,omitempty"`
	SkorMust      int            `json:"skor_must,omitempty"`
	SkorBarthel   int            `json:"skor_barthel,omitempty"`
	SkorMorse     int            `json:"skor_morse,omitempty"`
	NyeriJSON     datatypes.JSON `json:"nyeri,omitempty"`
	EdukasiJSON   datatypes.JSON `json:"edukasi,omitempty"`
	RiwayatMedisJSON datatypes.JSON `json:"riwayat_medis,omitempty"` // Termasuk G P A, Riwayat Obstetrik, dll

	// 3. Analisa & Rencana Asuhan
	RencanaAsuhanJSON datatypes.JSON `json:"rencana_asuhan,omitempty"`

	// 4. Observasi & Partograf
	KetubanPecahJam      string         `gorm:"size:20" json:"ketuban_pecah_jam,omitempty"`
	MulesSejakJam        string         `gorm:"size:20" json:"mules_sejak_jam,omitempty"`
	LembarObservasiJSON  datatypes.JSON `json:"lembar_observasi,omitempty"` // Array of observasi
	PartografDataJSON    datatypes.JSON `json:"partograf_data,omitempty"`   // Array of partograf points
	LaporanTindakanJSON  datatypes.JSON `json:"laporan_tindakan,omitempty"`

	// 5. Catatan Persalinan (Kala I - IV)
	CatatanKala1JSON   datatypes.JSON `json:"catatan_kala_1,omitempty"`
	CatatanKala2JSON   datatypes.JSON `json:"catatan_kala_2,omitempty"`
	CatatanKala3JSON   datatypes.JSON `json:"catatan_kala_3,omitempty"`
	BayiBaruLahirJSON  datatypes.JSON `json:"bayi_baru_lahir,omitempty"`
	PemantauanKala4JSON datatypes.JSON `json:"pemantauan_kala_4,omitempty"`
}

func (BersalinRecord) TableName() string {
	return "bersalin_records"
}
