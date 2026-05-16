import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          green: '#39FF14',
          pink: '#FF26D9',
          blue: '#26D9FF',
          orange: '#FF8C26',
          purple: '#D926FF',
          yellow: '#FFEB26',
        }
      },
      boxShadow: {
        'neon-green': '0 0 20px #39FF14, 0 0 40px #39FF14, 0 0 60px #39FF14',
        'neon-pink': '0 0 20px #FF26D9, 0 0 40px #FF26D9, 0 0 60px #FF26D9',
        'neon-blue': '0 0 20px #26D9FF, 0 0 40px #26D9FF, 0 0 60px #26D9FF',
        'neon-orange': '0 0 20px #FF8C26, 0 0 40px #FF8C26, 0 0 60px #FF8C26',
        'neon-purple': '0 0 20px #D926FF, 0 0 40px #D926FF, 0 0 60px #D926FF',
        'neon-yellow': '0 0 20px #FFEB26, 0 0 40px #FFEB26, 0 0 60px #FFEB26',
      }
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
  ],
} satisfies Config
