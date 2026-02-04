1. Setup Development Environment : Untuk development bridging haruslah dilakukan pada server atau komputer khusus untuk development, atau development environment. Tidak boleh dilakukan pada production environment. Hal ini wajib dipastikan dan tidak dilanggar agar tidak mengganggu operasional klaim reguler.
2. Implement ICD-10 2010 IM : Rumah sakit telah menerima data code ICD-10 2010 IM dari Kemkes, dan melakukan implementasi data tersebut pada SIMRS untuk digunakan sebagai standard pencarian, input dan validasi coding yang dilakukan oleh user.
3. Implement ICD-9-CM 2010 IM : Rumah sakit telah menerima data code ICD-9-CM 2010 IM dari Kemkes, dan melakukan implementasi data tersebut pada SIMRS untuk digunakan sebagai standard pencarian, input dan validasi coding yang dilakukan oleh user.
4. Implement multiplicity dan setting pada coding procedure iDRG : Pada input coding procedure, SIMRS wajib implement fitur multiplicity dan setting pada setiap record procedure.
5. Grouping iDRG dilakukan paling pertama : Setelah proses input data pada form pengajuan klaim, maka proses pertama yang harus dilakukan pada sistem adalah coding dan grouping iDRG. Berbeda dengan pola sebelumnya yaitu dilakukan coding INACBG terlebih dahulu.
6. Grouping iDRG : Aksi grouping untuk mendapatkan code iDRG. Dilakukan serangkaian uji skenario untuk beberapa use case coding, baik yang positive test maupun negative test.
7. Muncul tombol final iDRG setelah Grouping iDRG : Tombol final iDRG harus lah muncul hanya ketika grouping iDRG menghasilkan group yang valid (bukan error ungroupable)
8. Tombol final iDRG Tidak Boleh Muncul Jika Error Ungroupable : Jika terjadi error ungroupable maka tombol final tidak boleh muncul. Boleh muncul tapi dalam kondisi disabled (optional).
9. Final Grouping iDRG : Aksi finalisasi coding/grouping iDRG.
10. Seluruh Input Form Disabled setelah iDRG final : Seluruh form inputan data klaim dan coding iDRG harus menjadi read only (disabled) ketika iDRG final.
11. Muncul tombol Edit Ulang iDRG Ketika final : Dimunculkan tombol Edit Ulang iDRG ketika iDRG sudah final, dan tombol final iDRG harus lah hilang (digantikan)
12. INACBG Coding Muncul setelah final iDRG : Input coding/grouping INACBG hanya boleh muncul setelah iDRG final.
13. Import Coding iDRG Ke INACBG : Ada tombol atau fungsi untuk import coding dari iDRG ke INACBG. Sistem haruslah melakukan import secara keseluruhan terlebih dahulu.
14. Warning Ketika Im Pada INACBG : Warning atau peringatan "tidak berlaku" harus lah muncul pada code yang tidak valid pada INACBG, khususnya IM. Peringatan haruslah jelas, tegas dan menjadikan user tanggap untuk melakukan perubahan.
15. Grouping INACBG : Aksi grouping untuk mendapatkan kode INACBG.
16. Muncul tombol final INACBG setelah Grouping iDRG : Tombol Final INACBG harus lah muncul hanya ketika grouping INACBG menghasilkan group yang valid (bukan error ungroupable)
17. Tombol final INACBG Tidak Boleh Muncul Jika Error Ungroupable : Jika terjadi error ungroupable maka tombol final tidak boleh muncul. Boleh muncul tapi dalam kondisi disabled (optional).
18. Final Grouping INACBG : Aksi finalisasi coding/grouping INACBG.
19. Muncul tombol Edit Ulang INACBG ketika final : Dimunculkan tombol Edit Ulang INACBG ketika INACBG sudah final, dan tombol final INACBG harus lah hilang (digantikan)
20. Muncul tombol final Klaim setelah INACBG final : Tombol "Klaim FInal" harus dan hanya muncul ketika INACBG final.
21. Final Klaim : Aksi finalisasi Klaim.
22. Tombol Kirim Klaim Muncul setelah Klaim final : Tombol "Kirim Klaim" harus dan hanya muncul ketika Klaim final.
23. Tombol Cetak Muncul setelah Klaim final : Tombol "Cetak Klaim" harus dan hanya muncul ketika Klaim final.
24. Tombol Edit Ulang iDRG dan INACBG hilang setelah Klaim final : Tombol "Edit Ulang iDRG" dan "Edit Ulang INACBG" tidak boleh muncul ketika Klaim final.
25. Data SIMRS harus sinkron dengan data E-Klaim : SIMRS wajib menyimpan semua data sebagaimana yg terkirim ke E-Klaim dan yg diresponse oleh E-Klaim
