import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // relative asset paths: the built `dist/` works from any URL - a domain root, a GitHub Pages sub-path, a plain folder
  base: './',
  build: {
    chunkSizeWarningLimit: 1000, // three.js itself is ~930 kB (247 kB gzipped) and cannot be made smaller; the game is ~53 kB
    rolldownOptions: {
      output: {
        // the libraries change rarely, the game often: keep them in their own files so a new release re-downloads little
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|@react-three)[\\/]/, priority: 3 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 2 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
})
