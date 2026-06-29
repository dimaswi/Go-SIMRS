import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8080/api` : 'http://localhost:8080/api');

export const getApiBaseUrl = () => API_URL.replace(/\/api\/?$/, '');

export const resolveBackendFileUrl = (value?: string) => {
  const raw = (value || '').trim();
  if (!raw) return '';

  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }

  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let globalIsCasemix = false;
let globalCasemixEklaimId: number | null = null;

export const setCasemixContext = (isCasemix: boolean, eklaimId?: number) => {
  globalIsCasemix = isCasemix;
  globalCasemixEklaimId = eklaimId || null;
  if (isCasemix && eklaimId) {
    sessionStorage.setItem('casemix_active', 'true');
    sessionStorage.setItem('casemix_eklaim_id', String(eklaimId));
  } else {
    sessionStorage.removeItem('casemix_active');
    sessionStorage.removeItem('casemix_eklaim_id');
  }
};

export const restoreCasemixContext = () => {
  const active = sessionStorage.getItem('casemix_active') === 'true';
  const eklaimId = sessionStorage.getItem('casemix_eklaim_id');
  if (active && eklaimId) {
    globalIsCasemix = true;
    globalCasemixEklaimId = Number(eklaimId);
    return { isCasemix: true, eklaimId: Number(eklaimId) };
  }
  return { isCasemix: false, eklaimId: null };
};

// Request interceptor to add token and casemix context
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Restore from sessionStorage if in-memory state was lost (e.g. after navigation)
    if (!globalIsCasemix) {
      restoreCasemixContext();
    }

    // Inject casemix parameters for visit/order routes used in RM Duplicate workflows
    const requestUrl = config.url || '';
    const supportsCasemixScope =
      requestUrl.includes('/visits/') ||
      requestUrl.includes('/medicine-orders') ||
      requestUrl.includes('/procedure-orders');

    if (globalIsCasemix && supportsCasemixScope) {
      config.params = {
        ...config.params,
        is_casemix: 'true',
      };
      if (globalCasemixEklaimId) {
        config.params.casemix_eklaim_id = globalCasemixEklaimId;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
