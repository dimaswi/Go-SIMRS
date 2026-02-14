1. Pasien Rujukan pasti biasanya tidak punya data rekam medis di SIMRS
2. Pasien Rujukan ambil antrian karena dia tidak punya data rekam medis tolong munculkan response API seperti ini :
{
  "metadata": {
    "code": 202,
    "message": "Pasien belum memiliki rekam medis, silakan daftar ke faskes."
  },
  "response": null
}

3. Lalu mobile JKN biasanya muncul modal dialog untuk daftar pasien dulu dan di sisi SIMRS akan menerima API Info Pasien Baru tadi lalu kita proses, nah setelah response dari API kita sudah sesuai kan SIMRS sudah membuatkan data pasien tersebut. lalu selanjutnya biasanya juga pasien akan mengambil antrian ulang jadi baru proses untuk response secara lengkap
4. Jadi sudah benar untuk pasien mobile JKN tetap awal dari Task id 3 lalu alur sesuai dengan alur yang sudah ada. 