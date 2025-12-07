# Panduan Display Antrian

## Konsep Display yang Telah Diimplementasikan

Sistem antrian sekarang mendukung 3 halaman display:

### 0. **Navigasi Display** (BARU!)
URL: `http://localhost:5173/queue-display`

**Fitur:**
- ✅ Dashboard untuk memilih display yang ingin dibuka
- ✅ Tombol untuk membuka Display Utama
- ✅ Grid loket untuk membuka Display Per Loket
- ✅ Informasi fitur masing-masing display
- ✅ Membuka display di tab baru

**Kegunaan:**
- Halaman landing untuk staff yang akan setup display
- Memudahkan membuka display yang dibutuhkan
- Tidak perlu hafal URL setiap loket

---

### 1. **Display Utama (All Counters)**
URL: `http://localhost:5173/queue-display/main`

**Fitur:**
- ✅ Menampilkan statistik global (Total, Menunggu, Sedang Dilayani, Selesai)
- ✅ Grid semua loket dengan nomor antrian terkini per loket
- ✅ Statistik per loket (Tunggu/Layani/Selesai)
- ✅ Riwayat panggilan terakhir
- ❌ **TIDAK ADA** suara (untuk menghindari konflik)
- ❌ **TIDAK ADA** card "Sedang Dipanggil" besar

**Kegunaan:**
- Dipasang di area umum/lobby
- Pasien melihat semua loket sekaligus
- Tidak ada gangguan suara saling tumpang tindih

**Auto Refresh:** 3 detik

---

### 2. **Display Per Loket (Single Counter)**
URL: `http://localhost:5173/queue-display/counter/1` (untuk Loket 1)
URL: `http://localhost:5173/queue-display/counter/2` (untuk Loket 2)
URL: `http://localhost:5173/queue-display/counter/3` (untuk Loket 3)
... dst

**Fitur:**
- ✅ Menampilkan statistik global
- ✅ Grid semua loket
- ✅ **Card "Sedang Dipanggil"** khusus untuk loket tersebut
- ✅ **Suara/Text-to-Speech** hanya untuk loket tersebut
- ✅ Fokus pada antrian loket spesifik

**Kegunaan:**
- Dipasang di masing-masing loket (TV/Monitor kecil)
- Petugas dan pasien di loket tersebut tahu antrian mereka
- Suara hanya keluar untuk loket itu (tidak konflik dengan loket lain)

**Auto Refresh:** 3 detik

---

## Skenario Penggunaan

### Scenario 1: 5 Loket Beroperasi Bersamaan

**Setup yang Disarankan:**

1. **Display Utama (1 unit)** - Di Lobby Utama
   - URL: `http://localhost:5173/queue-display/main`
   - Ukuran: TV 43-55 inch
   - Posisi: Area tunggu utama
   - Fungsi: Pasien melihat semua loket

2. **Display Per Loket (5 unit)** - Di Masing-masing Loket
   - Loket 1: `http://localhost:5173/queue-display/counter/1` (TV 24-32 inch)
   - Loket 2: `http://localhost:5173/queue-display/counter/2` (TV 24-32 inch)
   - Loket 3: `http://localhost:5173/queue-display/counter/3` (TV 24-32 inch)
   - Loket 4: `http://localhost:5173/queue-display/counter/4` (TV 24-32 inch)
   - Loket 5: `http://localhost:5173/queue-display/counter/5` (TV 24-32 inch)
   - Fungsi: Pasien di loket spesifik tahu gilirannya

**Alur Kerja:**
1. Petugas Loket 1 panggil A001 → Suara keluar **hanya** di Display Loket 1
2. Petugas Loket 3 panggil A003 → Suara keluar **hanya** di Display Loket 3
3. Display Utama: Update kedua antrian **tanpa suara**
4. Tidak ada konflik suara!

---

### Scenario 2: Setup Sederhana (1-2 Loket)

**Setup yang Disarankan:**
- **Display Utama (1 unit)** - Di area tunggu
- URL: `http://localhost:5173/queue-display/main`
- Ukuran: TV 32-43 inch
- Cukup 1 display untuk semua

**Catatan:** Untuk 1-2 loket, bisa aktifkan suara dengan membuka display per loket juga.

---

## Keuntungan Arsitektur Ini

### ✅ Scalability
- Support unlimited counters
- Setiap loket independen
- Tidak ada bottleneck

### ✅ No Audio Conflict
- Suara per loket terpisah
- Display utama silent
- Pasien tidak bingung

### ✅ Performance
- Polling 3 detik sudah optimal
- Backend query efficient (filter by counter_id)
- Database index pada counter_id

### ✅ Flexibility
- Bisa tambah/kurangi loket tanpa ubah code
- Bisa pilih display utama atau per loket
- Bisa kombinasi keduanya

---

## Technical Details

### URL Parameters

| Route | Description | Features |
|-------|-------------|----------|
| `/queue-display` | Navigasi/Landing page | Pilih display yang ingin dibuka |
| `/queue-display/main` | Display Utama | NO sound, semua loket |
| `/queue-display/counter/:counterId` | Display Per Loket | WITH sound, 1 loket |

### Route Structure

```
/queue-display                    → Navigasi (pilih display)
/queue-display/main               → Display Utama (NO sound)
/queue-display/counter/1          → Display Loket 1 (WITH sound)
/queue-display/counter/2          → Display Loket 2 (WITH sound)
/queue-display/counter/3          → Display Loket 3 (WITH sound)
...
```

### Data Flow

```
Admin Call Queue (Loket 3)
    ↓
Backend: Update status → "called", called_at = NOW
    ↓
Display Utama (3s polling)
    ├─ Load all queues
    ├─ Update grid Loket 3
    └─ NO SOUND ❌
    
Display Loket 3 (3s polling)
    ├─ Load queues (filter: counter_id=3)
    ├─ Detect new called_at
    ├─ Update "Sedang Dipanggil" card
    └─ PLAY SOUND ✅

Display Loket 1,2,4,5
    └─ No update (different counter)
```

---

## Best Practices

### 1. Hardware Setup
- Display Utama: 43-55" TV, mounting bracket
- Display Per Loket: 24-32" Monitor, desk/wall mount
- Audio: Built-in speaker (volume 60-70%)
- Network: Wired Ethernet (lebih stabil dari WiFi)

### 2. Browser Configuration
- Chrome/Edge (Kiosk Mode): `chrome --kiosk --app=http://localhost:5173/queue-display`
- Auto-start on boot
- Disable sleep/screensaver
- Enable auto-play audio

### 3. Monitoring
- Check console logs untuk debug
- Monitor network requests (setiap 3 detik)
- Alert jika polling gagal > 3x berturut-turut

### 4. Maintenance
- Restart browser 1x per hari (misal jam 00:00) untuk clear memory
- Update database index regular
- Backup queue data bulanan

---

## Troubleshooting

### Suara Tidak Keluar
1. ✅ Pastikan buka URL **display per loket**: `/queue-display/counter/1`
2. ✅ Check browser console untuk error
3. ✅ Pastikan volume tidak mute
4. ✅ Klik halaman dulu (browser butuh user interaction)
5. ✅ Chrome: chrome://settings/content/sound → Allow

### Display Tidak Update
1. ✅ Check network di browser DevTools
2. ✅ Pastikan backend running
3. ✅ Check interval masih berjalan (console log)
4. ✅ Refresh browser (Ctrl+R)

### Multiple Sounds Playing
1. ✅ Pastikan Display Utama tanpa `/counter/:id` di URL
2. ✅ Pastikan hanya 1 tab per display
3. ✅ Close duplicate tabs

---

## URL Reference

### Production URLs (setelah deploy)

**Display Utama:**
```
https://simrs.example.com/queue-display
```

**Display Per Loket:**
```
https://simrs.example.com/queue-display/counter/1
https://simrs.example.com/queue-display/counter/2
https://simrs.example.com/queue-display/counter/3
https://simrs.example.com/queue-display/counter/4
https://simrs.example.com/queue-display/counter/5
```

### Development URLs

**Display Utama:**
```
http://localhost:5173/queue-display
```

**Display Per Loket:**
```
http://localhost:5173/queue-display/counter/1
http://localhost:5173/queue-display/counter/2
http://localhost:5173/queue-display/counter/3
http://localhost:5173/queue-display/counter/4
http://localhost:5173/queue-display/counter/5
```

---

## Summary

✅ **Display Utama** = Semua loket, NO sound, untuk area tunggu  
✅ **Display Per Loket** = 1 loket, WITH sound, untuk masing-masing loket  
✅ **Polling** = 3 detik, aman untuk 20-50 concurrent users  
✅ **Scalable** = Support unlimited loket tanpa konflik  

---

**Updated:** December 6, 2025  
**Version:** 2.0
