import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { settingsApi } from './lib/api'

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'
  return apiUrl.replace(/\/api$/, '')
}

const BASE_URL = getBaseUrl()

const toAssetUrl = (value: string) => {
  if (!value) return ''
  return value.startsWith('http') ? value : `${BASE_URL}${value}`
}

const ensureFaviconLink = () => {
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  return link
}

const applyBranding = (appName?: string | null, appFavicon?: string | null) => {
  if (appName) {
    document.title = appName
  }

  if (appFavicon) {
    const faviconLink = ensureFaviconLink()
    faviconLink.type = 'image/png'
    faviconLink.href = toAssetUrl(appFavicon)
  }
}

applyBranding(localStorage.getItem('appName'), localStorage.getItem('appFavicon'))

void settingsApi
  .getAll()
  .then((response) => {
    const settings = response.data.data || {}

    if (settings.app_name) {
      localStorage.setItem('appName', settings.app_name)
    }

    if (settings.app_logo) {
      localStorage.setItem('appLogo', settings.app_logo)
    }

    if (settings.app_favicon) {
      localStorage.setItem('appFavicon', settings.app_favicon)
    }

    applyBranding(settings.app_name, settings.app_favicon)
  })
  .catch(() => {
    // Ignore branding bootstrap failure and let page-level settings continue.
  })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
