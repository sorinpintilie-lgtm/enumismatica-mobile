/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Keep mobile color palette in sync with web app
        navy: {
          50: '#e6e8f0',
          100: '#b3b9d4',
          200: '#8089b8',
          300: '#4d599c',
          400: '#263480',
          500: '#000940', // Main navy blue
          600: '#000833',
          700: '#000626',
          800: '#000419',
          900: '#00020d',
        },
        gold: {
          50: '#fef9ed',
          100: '#fcefc7',
          200: '#fae5a1',
          300: '#f8db7b',
          400: '#f6d155',
          500: '#e7b73c', // Main gold accent
          600: '#d4a022',
          700: '#a67b1a',
          800: '#785713',
          900: '#4a330b',
        },
      },
    },
  },
  plugins: [],
}