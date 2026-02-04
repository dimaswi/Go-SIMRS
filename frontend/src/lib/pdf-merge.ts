import { PDFDocument } from "pdf-lib";

export interface MergeItem {
  label: string;
  fetchBlob: () => Promise<Blob>;
}

export interface MergeResult {
  blob: Blob;
  totalPages: number;
  successCount: number;
  failedItems: string[];
}

/**
 * Merge multiple PDF blobs into a single PDF.
 * Fetches sequentially to avoid overwhelming the server.
 * Skips failed items and continues with remaining docs.
 */
export async function mergePdfs(
  items: MergeItem[],
  onProgress?: (current: number, total: number) => void
): Promise<MergeResult> {
  const mergedPdf = await PDFDocument.create();
  const failedItems: string[] = [];
  let successCount = 0;

  for (let i = 0; i < items.length; i++) {
    onProgress?.(i + 1, items.length);
    try {
      const blob = await items[i].fetchBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
      successCount++;
    } catch (error) {
      console.error(`Failed to merge: ${items[i].label}`, error);
      failedItems.push(items[i].label);
    }
  }

  if (successCount === 0) {
    throw new Error("Tidak ada dokumen yang berhasil dimuat");
  }

  const mergedBytes = await mergedPdf.save();
  const mergedBlob = new Blob([mergedBytes as BlobPart], { type: "application/pdf" });

  return {
    blob: mergedBlob,
    totalPages: mergedPdf.getPageCount(),
    successCount,
    failedItems,
  };
}
