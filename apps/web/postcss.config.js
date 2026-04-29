import autoprefixer from 'autoprefixer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
  plugins: [
    tailwindcss({ config: path.join(dirname, 'tailwind.config.js') }),
    autoprefixer(),
  ],
}
