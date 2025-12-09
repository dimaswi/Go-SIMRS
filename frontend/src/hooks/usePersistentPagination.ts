import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook untuk menyimpan pagination state ke localStorage
 * dengan cara yang benar-benar persisten
 */
export function usePersistentPagination(key: string, defaultPage = 0) {
  // Baca dari localStorage saat pertama kali
  const getStoredPage = useCallback(() => {
    try {
      const stored = localStorage.getItem(`pagination_${key}`);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading from localStorage:', e);
    }
    return defaultPage;
  }, [key, defaultPage]);

  const [page, setPageInternal] = useState(getStoredPage);

  // Sync dengan localStorage jika key berubah
  useEffect(() => {
    setPageInternal(getStoredPage());
  }, [key, getStoredPage]);

  // Function untuk set page dan simpan ke localStorage
  const setPage = useCallback((newPage: number) => {
    setPageInternal(newPage);
    try {
      localStorage.setItem(`pagination_${key}`, String(newPage));
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  }, [key]);

  // Reset page ke 0
  const resetPage = useCallback(() => {
    setPage(0);
  }, [setPage]);

  return { page, setPage, resetPage };
}
