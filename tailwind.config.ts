import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#F0B420',
          'yellow-dark': '#C8930D',
          'yellow-light': '#FEF3CC',
          // Merkgeel dat je kunt lézen. `yellow-dark` (#C8930D) is 2,75:1
          // op wit: prima als vlak of icoon, te licht voor een woord.
          // Deze haalt 5,11:1 en is bedoeld voor de korte gele labels
          // ("deze week", "nu"), niet voor vlakken.
          'yellow-tekst': '#8F6706',
          red: '#BC2934',
          'red-dark': '#96202A',
          'red-light': '#FAEAEA',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#ECEAE4',
          3: '#E0DDD5',
        },
        'surface-dark': {
          // Het canvas gaat een tint dieper dan de kaarten erop. Zonder
          // dat verschil vielen de zijbalk en de pagina-achtergrond in
          // donkere modus samen tot één vlak, terwijl light wél drie
          // lagen heeft (wit / #F4F3EF / wit). Schaduw doet in donker
          // bijna niets, dus de gelaagdheid moet uit de tint komen.
          DEFAULT: '#0d1117',
          2: '#161b22',
          3: '#1c2129',
        },
        // Tekstkleuren met een gemeten contrastverhouding, in plaats van
        // een grijstint die toevallig goed oogde op het scherm van wie
        // hem koos.
        //
        // Hiervoor stond overal `text-gray-400` (#9CA3AF): 2,54:1 op wit
        // en 2,29:1 op het canvas — ruim onder de 4,5:1 die de norm voor
        // gewone tekst vraagt. Op 191 plekken, en juist op de datums,
        // aantallen en hints die een monteur buiten moet kunnen lezen.
        // Dat is precies de belofte uit PROJECT.md ("in de zon, met een
        // paar procent batterij") die daarmee niet werd waargemaakt.
        tekst: {
          // Bijschriften, datums, aantallen, hints. 4,83:1 op wit.
          gedempt: '#6B7280',
          // Formulierlabels en secundaire koppen. 7,56:1 op wit.
          zwak: '#4B5563',
          // Uitsluitend voor decoratie: chevrons, placeholders, een
          // leeg fotovakje. 3,63:1 op wit — de norm voor niet-tekst.
          // Zet hier nooit een zin in.
          fijn: '#7E8794',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '14px',
        lg: '20px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        DEFAULT: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 8px 24px rgba(0,0,0,0.10)',
        lg: '0 20px 48px rgba(0,0,0,0.13)',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'page-in': 'fade-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config