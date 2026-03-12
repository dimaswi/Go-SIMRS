# {BASE URL}/{Service Name}/api/rs/validate
Request :
{
    "param": "{nomorkartu}",
    "kodedokter": {kodedokter}
} 

Response :
{
    "response": {
        "url": "https://dvlp.bpjs-kesehatan.go.id/ihs/history?token=e6b610b4-2960-46a3-8420-de879756dce3"
    },
    "metaData": {
        "code": 200,
        "message": "Sukses"
    }
}

# ALUR SISTEM
1. Pada kunjungan nanti dibagian atas disamping cetak berikan button untuk icare yang akan hit ke url diatas, dan juga pastikan bahwa kode dokter yang dipakai adalah dokter yang di mapping tolong cek, dan juga untuk nomor kartu adalah kartu bpjs
2. ketika dihit nanti untuk response dari BPJS kan URL jadi ini nanti seperti membukan aplikasi didalam SIMRS saya jadi seperti modal dengan ukuran besar
3. Untuk enkripsi dan dekripsi sama dengan BPJS lainnya termasuk dengan header 