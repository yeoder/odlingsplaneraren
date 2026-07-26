import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// base = reponamnet, krävs för GitHub Pages (https://<user>.github.io/odlingsplaneraren/)
export default defineConfig({
  plugins: [svelte()],
  base: '/odlingsplaneraren/',
})
