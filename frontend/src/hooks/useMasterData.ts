import { useState, useEffect, useCallback } from 'react';
import { masterDataApi, type MasterData } from '@/lib/api/master-data';

export interface MasterDataOption {
  value: string;
  label: string;
  description?: string;
}

// Cache untuk menyimpan master data
const masterDataCache: Record<string, MasterData[]> = {};

/**
 * Hook untuk mengambil master data berdasarkan category
 * @param category - Kategori master data
 * @returns { options, loading, error, refresh }
 */
export function useMasterData(category: string) {
  const [data, setData] = useState<MasterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // Cek cache terlebih dahulu
    if (masterDataCache[category]) {
      setData(masterDataCache[category]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await masterDataApi.getByCategory(category);
      const items = response.data.data || [];
      // Filter hanya yang aktif dan sort berdasarkan sort_order
      const activeItems = items.filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order);
      masterDataCache[category] = activeItems;
      setData(activeItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil data');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Convert ke format options untuk Combobox
  const options: MasterDataOption[] = data.map(item => ({
    value: item.code,
    label: item.name,
    description: item.description,
  }));

  // Fungsi untuk mendapatkan label berdasarkan code
  const getLabel = useCallback((code: string) => {
    const item = data.find(d => d.code === code);
    return item?.name || code;
  }, [data]);

  // Fungsi untuk refresh data
  const refresh = useCallback(() => {
    delete masterDataCache[category];
    fetchData();
  }, [category, fetchData]);

  return { data, options, loading, error, getLabel, refresh };
}

/**
 * Hook untuk mengambil beberapa kategori master data sekaligus
 * @param categories - Array kategori master data
 * @returns { data, loading, error, getOptions, getLabel }
 */
export function useMultipleMasterData(categories: string[]) {
  const [data, setData] = useState<Record<string, MasterData[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Memoize categories key untuk mencegah infinite loop
  const categoriesKey = categories.sort().join(',');

  useEffect(() => {
    const fetchData = async () => {
      const categoryList = categoriesKey.split(',').filter(Boolean);
      
      // Cek categories yang belum ada di cache
      const uncachedCategories = categoryList.filter(cat => !masterDataCache[cat]);
      
      if (uncachedCategories.length === 0) {
        // Semua sudah ada di cache
        const cachedData: Record<string, MasterData[]> = {};
        categoryList.forEach(cat => {
          cachedData[cat] = masterDataCache[cat] || [];
        });
        setData(cachedData);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await masterDataApi.getMultiple(uncachedCategories);
        const newData = response.data.data || {};
        
        // Update cache dan state
        const allData: Record<string, MasterData[]> = {};
        categoryList.forEach(cat => {
          if (newData[cat]) {
            const activeItems = newData[cat].filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order);
            masterDataCache[cat] = activeItems;
            allData[cat] = activeItems;
          } else if (masterDataCache[cat]) {
            allData[cat] = masterDataCache[cat];
          } else {
            allData[cat] = [];
          }
        });
        
        setData(allData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal mengambil data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [categoriesKey]);

  // Fungsi untuk mendapatkan options berdasarkan category
  const getOptions = useCallback((category: string): MasterDataOption[] => {
    return (data[category] || []).map(item => ({
      value: item.code,
      label: item.name,
      description: item.description,
    }));
  }, [data]);

  // Fungsi untuk mendapatkan label berdasarkan category dan code
  const getLabel = useCallback((category: string, code: string) => {
    const items = data[category] || [];
    const item = items.find(d => d.code === code);
    return item?.name || code;
  }, [data]);

  return { data, loading, error, getOptions, getLabel };
}

/**
 * Fungsi untuk clear cache master data
 * @param category - Kategori yang akan di-clear, jika tidak ada akan clear semua
 */
export function clearMasterDataCache(category?: string) {
  if (category) {
    delete masterDataCache[category];
  } else {
    Object.keys(masterDataCache).forEach(key => {
      delete masterDataCache[key];
    });
  }
}
