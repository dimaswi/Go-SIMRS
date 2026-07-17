interface PartografVisualProps {
  data: any[];
  formData?: any;
}

export function PartografVisual({ data, formData }: PartografVisualProps) {
  // Constants for dimensions
  const width = 800;
  const height = 1150; // Increased height to accommodate the bottom section
  const offsetX = 120;
  const cols = 16;
  const colWidth = 40; // 1 hour = 40px
  const halfCol = 20; // 30 mins = 20px
  const graphWidth = cols * colWidth;

  // Helper to draw horizontal grid lines and labels
  const drawGrid = (yStart: number, rows: number, rowHeight: number, yLabels: string[] | number[] = [], labelTitle: string = "") => {
    const lines = [];
    const texts = [];

    if (labelTitle) {
      texts.push(
        <text key={`title-${yStart}`} x={offsetX - 10} y={yStart + (rows * rowHeight) / 2} fontSize="11" fontWeight="bold" textAnchor="end" dominantBaseline="middle">
          {labelTitle}
        </text>
      );
    }

    for (let i = 0; i <= rows; i++) {
      const y = yStart + i * rowHeight;
      // Draw horizontal line
      lines.push(
        <line key={`hline-${yStart}-${i}`} x1={offsetX} y1={y} x2={offsetX + graphWidth} y2={y} stroke="#e5e7eb" strokeWidth="1" />
      );
      // Draw label
      if (yLabels[i] !== undefined) {
        texts.push(
          <text key={`label-${yStart}-${i}`} x={offsetX - 10} y={y + rowHeight / 2} fontSize="10" textAnchor="end" dominantBaseline="middle">
            {yLabels[i]}
          </text>
        );
      }
    }

    // Draw vertical lines
    for (let i = 0; i <= cols; i++) {
      const x = offsetX + i * colWidth;
      lines.push(
        <line key={`vline-${yStart}-${i}`} x1={x} y1={yStart} x2={x} y2={yStart + rows * rowHeight} stroke="#e5e7eb" strokeWidth={i % 1 === 0 ? "2" : "1"} />
      );
      // Draw 30 min dashed line
      if (i < cols) {
        lines.push(
          <line key={`vdline-${yStart}-${i}`} x1={x + halfCol} y1={yStart} x2={x + halfCol} y2={yStart + rows * rowHeight} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 2" />
        );
      }
    }

    return <g key={`grid-group-${yStart}`}>{lines}{texts}</g>;
  };

  // Header Texts
  const headerTexts = [];
  if (formData) {
    headerTexts.push(<text key="h-ketuban" x={offsetX + 400} y={15} fontSize="11">Ketuban pecah sejak jam: {formData.ketuban_pecah_jam || "......"}</text>);
    headerTexts.push(<text key="h-mules" x={offsetX + 400} y={30} fontSize="11">Mules sejak jam: {formData.mules_sejak_jam || "......"}</text>);
    
    // Patient Data Placeholders (in a real app, pass patient info here)
    headerTexts.push(<text key="h-reg" x={offsetX} y={15} fontSize="11">No. Register: .....................</text>);
    headerTexts.push(<text key="h-nama" x={offsetX} y={30} fontSize="11">Nama Ibu: ........................ Umur: .... G .. P .. A ..</text>);
  }

  // 1. DJJ Grid
  const djjLabels = [200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100, 90, 80];
  const djjGrid = drawGrid(50, 12, 15, djjLabels);

  // 2. Ketuban & Penyusupan
  const ketubanGrid = drawGrid(245, 2, 20, ["Air Ketuban", "Penyusupan"]);

  // 3. Pembukaan Grid
  const pembukaanLabels = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  const pembukaanGrid = drawGrid(300, 10, 20, pembukaanLabels);

  // Waktu row
  const waktuGrid = drawGrid(500, 1, 25, ["Waktu (jam)"]);

  // 4. Kontraksi Grid
  const kontraksiLabels = [5, 4, 3, 2, 1];
  const kontraksiGrid = drawGrid(540, 5, 15, kontraksiLabels);

  // 5. Oksitosin & Obat
  const obatGrid = drawGrid(630, 2, 25, ["Oksitosin U/L", "Obat / Cairan IV"]);

  // 6. Nadi & TD
  const tdLabels = [180, 170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60];
  const tdGrid = drawGrid(690, 12, 15, tdLabels);

  // 7. Suhu & Urin
  const suhuGrid = drawGrid(885, 1, 20, ["Suhu °C"]);
  const urinGrid = drawGrid(920, 3, 20, ["Protein", "Aseton", "Volume"]);

  // Parse plots
  const renderData = () => {
    const safeData = data || [];

    // Find when active phase (4cm) starts
    let activePhaseIndex = -1;
    let activePhaseTime = -1;
    for (let i = 0; i < safeData.length; i++) {
      const p = Number(safeData[i].pembukaan);
      if (p >= 4) {
        activePhaseIndex = i;
        activePhaseTime = offsetX + (i * halfCol) + (halfCol / 2);
        break;
      }
    }

    const waspadaLines = [];
    if (activePhaseIndex !== -1) {
      // Waspada line: starts at activePhaseTime, y = 300 + (10 - 4)*20 = 420.
      // Ends at y = 300 (10cm). It takes 6 hours (6 * colWidth = 240px).
      const startX = activePhaseTime;
      const startY = 420;
      const endX = startX + 6 * colWidth;
      const endY = 300;
      waspadaLines.push(
        <line key="waspada" x1={startX} y1={startY} x2={endX} y2={endY} stroke="#eab308" strokeWidth="2" strokeDasharray="5 5" />
      );
      waspadaLines.push(
        <text key="waspada-text" x={startX + 50} y={startY - 30} fill="#eab308" fontSize="12" fontWeight="bold" transform={`rotate(-26, ${startX + 50}, ${startY - 30})`}>WASPADA</text>
      );

      // Bertindak line: 4 hours to the right (4 * 40 = 160px)
      const bertindakStartX = startX + 4 * colWidth;
      const bertindakEndX = endX + 4 * colWidth;
      waspadaLines.push(
        <line key="bertindak" x1={bertindakStartX} y1={startY} x2={bertindakEndX} y2={endY} stroke="#ef4444" strokeWidth="2" strokeDasharray="5 5" />
      );
      waspadaLines.push(
        <text key="bertindak-text" x={bertindakStartX + 50} y={startY - 30} fill="#ef4444" fontSize="12" fontWeight="bold" transform={`rotate(-26, ${bertindakStartX + 50}, ${startY - 30})`}>BERTINDAK</text>
      );
    }

    const plots = safeData.map((row, i) => {
      const xCenter = offsetX + (i * halfCol) + (halfCol / 2);

      const elements = [];

      // Waktu Text
      if (row.waktu) {
        elements.push(
          <text key={`waktu-${i}`} x={xCenter} y={500 + 12.5} fontSize="10" textAnchor="middle" dominantBaseline="middle">{row.waktu}</text>
        );
      }

      // DJJ (80-200, y: 50 to 230)
      if (row.djj) {
        const val = Number(row.djj);
        if (val >= 80 && val <= 200) {
          const y = 50 + ((200 - val) / 10) * 15;
          elements.push(<circle key={`djj-${i}`} cx={xCenter} cy={y} r="3" fill="#000" />);
        }
      }

      // Air Ketuban
      if (row.air_ketuban) {
        elements.push(<text key={`ketuban-${i}`} x={xCenter} y={245 + 10} fontSize="10" textAnchor="middle" dominantBaseline="middle">{row.air_ketuban}</text>);
      }

      // Penyusupan
      if (row.penyusupan) {
        elements.push(<text key={`penyusupan-${i}`} x={xCenter} y={265 + 10} fontSize="10" textAnchor="middle" dominantBaseline="middle">{row.penyusupan}</text>);
      }

      // Pembukaan (0-10, y: 300 to 500)
      if (row.pembukaan !== "" && row.pembukaan !== undefined) {
        const val = Number(row.pembukaan);
        if (val >= 0 && val <= 10) {
          const y = 300 + ((10 - val) * 20);
          elements.push(
            <g key={`pembukaan-${i}`}>
              <line x1={xCenter - 4} y1={y - 4} x2={xCenter + 4} y2={y + 4} stroke="#000" strokeWidth="2" />
              <line x1={xCenter - 4} y1={y + 4} x2={xCenter + 4} y2={y - 4} stroke="#000" strokeWidth="2" />
            </g>
          );
        }
      }

      if (row.turunnya_kepala !== "" && row.turunnya_kepala !== undefined) {
        const val = Number(row.turunnya_kepala);
        if (val >= 0 && val <= 5) {
          const y = 300 + ((10 - (val * 2)) * 20); // Mapped to 0-10 grid
          elements.push(
            <circle key={`kepala-${i}`} cx={xCenter} cy={y} r="4" fill="none" stroke="#000" strokeWidth="2" />
          );
        }
      }

      // Kontraksi (0-5, y: 540 to 615). Box height = 15. Width = 20.
      if (row.kontraksi_jumlah) {
        const val = Number(row.kontraksi_jumlah);
        const dur = Number(row.kontraksi_durasi) || 0;
        let fillType = "none";

        if (dur > 0 && dur < 20) fillType = "dots";
        else if (dur >= 20 && dur <= 40) fillType = "lines";
        else if (dur > 40) fillType = "solid";

        for (let k = 0; k < val && k < 5; k++) {
          const y = 540 + (4 - k) * 15;

          if (fillType === "solid") {
            elements.push(<rect key={`k-${i}-${k}`} x={xCenter - 8} y={y + 1} width={16} height={13} fill="#000" />);
          } else if (fillType === "lines") {
            elements.push(
              <g key={`k-${i}-${k}`}>
                <rect x={xCenter - 8} y={y + 1} width={16} height={13} fill="none" stroke="#000" strokeWidth="1" />
                <line x1={xCenter - 8} y1={y + 4} x2={xCenter + 8} y2={y + 4} stroke="#000" strokeWidth="1" />
                <line x1={xCenter - 8} y1={y + 8} x2={xCenter + 8} y2={y + 8} stroke="#000" strokeWidth="1" />
                <line x1={xCenter - 8} y1={y + 12} x2={xCenter + 8} y2={y + 12} stroke="#000" strokeWidth="1" />
              </g>
            );
          } else if (fillType === "dots") {
            elements.push(
              <g key={`k-${i}-${k}`}>
                <rect x={xCenter - 8} y={y + 1} width={16} height={13} fill="none" stroke="#000" strokeWidth="1" />
                <circle cx={xCenter - 3} cy={y + 5} r="1" fill="#000" />
                <circle cx={xCenter + 3} cy={y + 5} r="1" fill="#000" />
                <circle cx={xCenter - 3} cy={y + 9} r="1" fill="#000" />
                <circle cx={xCenter + 3} cy={y + 9} r="1" fill="#000" />
              </g>
            );
          }
        }
      }

      // Oksitosin & Obat
      if (row.oksitosin) elements.push(<text key={`oksi-${i}`} x={xCenter} y={630 + 12.5} fontSize="9" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90, ${xCenter}, ${630 + 12.5})`}>{row.oksitosin}</text>);
      if (row.obat_cairan) elements.push(<text key={`obat-${i}`} x={xCenter} y={655 + 12.5} fontSize="9" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90, ${xCenter}, ${655 + 12.5})`}>{row.obat_cairan}</text>);

      // BP (arrow) and Pulse (dot)
      // Nadi (60-180, y: 690 to 870)
      if (row.nadi) {
        const val = Number(row.nadi);
        if (val >= 60 && val <= 180) {
          const y = 690 + ((180 - val) / 10) * 15;
          elements.push(<circle key={`nadi-${i}`} cx={xCenter} cy={y} r="3" fill="#000" />);
        }
      }

      // Tekanan Darah (Systolic / Diastolic) Example format "120/80"
      if (row.tekanan_darah && row.tekanan_darah.includes('/')) {
        const [sysStr, diaStr] = row.tekanan_darah.split('/');
        const sys = Number(sysStr);
        const dia = Number(diaStr);
        if (sys >= 60 && sys <= 180 && dia >= 60 && dia <= 180) {
          const ySys = 690 + ((180 - sys) / 10) * 15;
          const yDia = 690 + ((180 - dia) / 10) * 15;
          elements.push(
            <g key={`td-${i}`}>
              <line x1={xCenter} y1={ySys} x2={xCenter} y2={yDia} stroke="#000" strokeWidth="1.5" />
              {/* Up arrow */}
              <polygon points={`${xCenter},${ySys} ${xCenter - 3},${ySys + 4} ${xCenter + 3},${ySys + 4}`} fill="#000" />
              {/* Down arrow */}
              <polygon points={`${xCenter},${yDia} ${xCenter - 3},${yDia - 4} ${xCenter + 3},${yDia - 4}`} fill="#000" />
            </g>
          );
        }
      }

      // Suhu
      if (row.suhu) elements.push(<text key={`suhu-${i}`} x={xCenter} y={885 + 10} fontSize="10" textAnchor="middle" dominantBaseline="middle">{row.suhu}</text>);

      // Urin
      if (row.urin_protein) elements.push(<text key={`up-${i}`} x={xCenter} y={920 + 10} fontSize="10" textAnchor="middle" dominantBaseline="middle">{row.urin_protein}</text>);
      if (row.urin_aseton) elements.push(<text key={`ua-${i}`} x={xCenter} y={940 + 10} fontSize="10" textAnchor="middle" dominantBaseline="middle">{row.urin_aseton}</text>);
      if (row.urin_volume) elements.push(<text key={`uv-${i}`} x={xCenter} y={960 + 10} fontSize="10" textAnchor="middle" dominantBaseline="middle">{row.urin_volume}</text>);


      return <g key={`plot-${i}`}>{elements}</g>;
    });

    // Draw connecting lines for Pembukaan (X) and DJJ and Nadi
    const pembukaanLines = [];
    const djjLines = [];
    const nadiLines = [];

    let lastP: number | null = null, lastPIdx = -1;
    let lastD: number | null = null, lastDIdx = -1;
    let lastN: number | null = null, lastNIdx = -1;

    for (let i = 0; i < safeData.length; i++) {
      const row = safeData[i];
      const xCenter = offsetX + (i * halfCol) + (halfCol / 2);

      if (row.pembukaan !== "" && row.pembukaan !== undefined) {
        const val = Number(row.pembukaan);
        if (val >= 0 && val <= 10) {
          const y = 300 + ((10 - val) * 20);
          if (lastP !== null) {
            pembukaanLines.push(<line key={`pl-${i}`} x1={offsetX + (lastPIdx * halfCol) + (halfCol / 2)} y1={lastP} x2={xCenter} y2={y} stroke="#000" strokeWidth="2" />);
          }
          lastP = y;
          lastPIdx = i;
        }
      }

      if (row.djj) {
        const val = Number(row.djj);
        if (val >= 80 && val <= 200) {
          const y = 50 + ((200 - val) / 10) * 15;
          if (lastD !== null) {
            djjLines.push(<line key={`dl-${i}`} x1={offsetX + (lastDIdx * halfCol) + (halfCol / 2)} y1={lastD} x2={xCenter} y2={y} stroke="#000" strokeWidth="1" />);
          }
          lastD = y;
          lastDIdx = i;
        }
      }

      if (row.nadi) {
        const val = Number(row.nadi);
        if (val >= 60 && val <= 180) {
          const y = 690 + ((180 - val) / 10) * 15;
          if (lastN !== null) {
            nadiLines.push(<line key={`nl-${i}`} x1={offsetX + (lastNIdx * halfCol) + (halfCol / 2)} y1={lastN} x2={xCenter} y2={y} stroke="#000" strokeWidth="1" />);
          }
          lastN = y;
          lastNIdx = i;
        }
      }
    }

    return (
      <>
        {waspadaLines}
        {pembukaanLines}
        {djjLines}
        {nadiLines}
        {plots}
      </>
    );
  };

  return (
    <div className="w-full overflow-x-auto bg-white border rounded-lg shadow-sm p-4">
      <div className="min-w-[800px] flex justify-center mb-4">
        <h3 className="font-bold text-lg tracking-widest uppercase text-muted-foreground">Partograf</h3>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto block text-xs" style={{ backgroundColor: 'white' }}>
        {headerTexts}

        {/* Texts for side labels */}
        <text x="20" y="140" transform="rotate(-90, 20, 140)" fontSize="11" fontWeight="bold" textAnchor="middle">Denyut Jantung Janin (/menit)</text>
        <text x="20" y="400" transform="rotate(-90, 20, 400)" fontSize="11" fontWeight="bold" textAnchor="middle">Pembukaan Serviks (cm) tanda X</text>
        <text x="35" y="400" transform="rotate(-90, 35, 400)" fontSize="10" textAnchor="middle">Turunnya Kepala tanda O</text>
        <text x="20" y="580" transform="rotate(-90, 20, 580)" fontSize="11" fontWeight="bold" textAnchor="middle">Kontraksi tiap 10 mnt</text>
        <text x="20" y="780" transform="rotate(-90, 20, 780)" fontSize="11" fontWeight="bold" textAnchor="middle">Nadi (•) & Tekanan Darah (↕)</text>

        {djjGrid}
        {ketubanGrid}
        {pembukaanGrid}
        {waktuGrid}
        {kontraksiGrid}
        {obatGrid}
        {tdGrid}
        {suhuGrid}
        {urinGrid}

        {/* Legend for contraction */}
        <rect x={offsetX - 80} y={550} width={12} height={12} fill="none" stroke="#000" />
        <circle cx={offsetX - 74} cy={554} r="1" fill="#000" /><circle cx={offsetX - 74} cy={558} r="1" fill="#000" />
        <text x={offsetX - 60} y={556} fontSize="9" dominantBaseline="middle">&lt; 20 dtk</text>

        <rect x={offsetX - 80} y={570} width={12} height={12} fill="none" stroke="#000" />
        <line x1={offsetX - 80} y1={573} x2={offsetX - 68} y2={573} stroke="#000" strokeWidth="1" />
        <line x1={offsetX - 80} y1={576} x2={offsetX - 68} y2={576} stroke="#000" strokeWidth="1" />
        <line x1={offsetX - 80} y1={579} x2={offsetX - 68} y2={579} stroke="#000" strokeWidth="1" />
        <text x={offsetX - 60} y={576} fontSize="9" dominantBaseline="middle">20-40 dtk</text>

        <rect x={offsetX - 80} y={590} width={12} height={12} fill="#000" />
        <text x={offsetX - 60} y={596} fontSize="9" dominantBaseline="middle">&gt; 40 dtk</text>

        {/* Bottom Section: Makan, Minum, Penolong */}
        <text x={offsetX} y={1050} fontSize="11">Makan terakhir : Pukul {formData?.catatan_kala_1?.makan_terakhir_jam || "............"} Jenis : {formData?.catatan_kala_1?.makan_terakhir_jenis || "........................"} Porsi : {formData?.catatan_kala_1?.makan_terakhir_porsi || "............"}</text>
        <text x={offsetX} y={1080} fontSize="11">Minum terakhir : Pukul {formData?.catatan_kala_1?.minum_terakhir_jam || "............"} Jenis : {formData?.catatan_kala_1?.minum_terakhir_jenis || "........................"} Porsi : {formData?.catatan_kala_1?.minum_terakhir_porsi || "............"}</text>
        
        {/* Penolong Signature Area */}
        <text x={offsetX + 450} y={1040} fontSize="11" textAnchor="middle">Penolong</text>
        <line x1={offsetX + 380} y1={1100} x2={offsetX + 520} y2={1100} stroke="#000" strokeWidth="1" strokeDasharray="2 2" />
        <text x={offsetX + 370} y={1100} fontSize="11">)</text>
        <text x={offsetX + 530} y={1100} fontSize="11">(</text>

        {/* Catatan Persalinan in the Pembukaan grid */}
        {formData?.catatan_kala_1?.catatan_persalinan && (
           <foreignObject x={offsetX + 350} y={310} width={250} height={180}>
             <div style={{ fontSize: '11px', fontFamily: 'monospace', lineHeight: '1.2', color: '#000', whiteSpace: 'pre-wrap' }}>
               {formData.catatan_kala_1.catatan_persalinan}
             </div>
           </foreignObject>
        )}

        {renderData()}
      </svg>
    </div>
  );
}
