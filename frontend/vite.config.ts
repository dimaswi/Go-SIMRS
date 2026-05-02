import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/pages/visits/show.tsx')) {
            return 'visit-show-page'
          }

          if (id.includes('/src/pages/eklaim-local/rm-duplicate-tab.tsx')) {
            return 'rm-duplicate-page'
          }

          if (id.includes('/src/components/medical-record/')) {
            if (id.includes('workstation') || id.includes('order-form') || id.includes('procedure-edit-order')) {
              return 'medical-record-orders'
            }

            if (id.includes('disposition') || id.includes('final-visit') || id.includes('print-') || id.includes('surat-form')) {
              return 'medical-record-flow'
            }

            if (id.includes('drawer') || id.includes('history') || id.includes('editable-form-wrapper') || id.includes('copy-from-history')) {
              return 'medical-record-support'
            }

            if (id.includes('medicine') || id.includes('pharmacy') || id.includes('allergy')) {
              return 'medical-record-pharmacy'
            }

            if (id.includes('nursing') || id.includes('fluid') || id.includes('vital') || id.includes('o2-usage') || id.includes('fall-risk') || id.includes('observation')) {
              return 'medical-record-care'
            }

            if (id.includes('triage') || id.includes('anamnesis') || id.includes('physical-exam') || id.includes('diagnosis') || id.includes('assessment-plan') || id.includes('body-marker') || id.includes('cppt')) {
              return 'medical-record-assessment'
            }

            return 'medical-record-forms'
          }

          if (id.includes('/src/components/signature/')) {
            return 'signature'
          }

          if (id.includes('/src/lib/api/')) {
            return 'api-client'
          }

          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('react') || id.includes('scheduler') || id.includes('zustand')) {
            return 'react-vendor'
          }

          if (id.includes('lucide-react')) {
            return 'icon-vendor'
          }

          if (id.includes('@radix-ui') || id.includes('cmdk') || id.includes('vaul') || id.includes('sonner')) {
            return 'ui-vendor'
          }

          if (id.includes('@tanstack/react-table')) {
            return 'table-vendor'
          }

          if (id.includes('framer-motion') || id.includes('embla-carousel-react')) {
            return 'motion-vendor'
          }

          if (id.includes('recharts') || id.includes('d3-')) {
            return 'chart-vendor'
          }

          if (id.includes('jspdf')) {
            return 'jspdf-vendor'
          }

          if (id.includes('pdf-lib')) {
            return 'pdf-vendor'
          }

          if (id.includes('html2canvas')) {
            return 'html2canvas-vendor'
          }

          if (id.includes('react-to-print')) {
            return 'print-vendor'
          }

          if (id.includes('date-fns') || id.includes('zod') || id.includes('axios')) {
            return 'data-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
  server: {
    allowedHosts: ['bpjs_dev.dimaswysnu.com', 'localhost'],
  },
})
