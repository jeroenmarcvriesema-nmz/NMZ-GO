import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { luisterOpFouten } from '@/lib/foutmelder'
import { herlaadVoorNieuweVersie } from '@/lib/versie'
import './index.css'

// Meteen aanzetten, vóór React begint. Wat er tijdens het opstarten
// misgaat is juist het lastigst te reproduceren en het meest gemeld
// als "hij deed het gewoon niet".
luisterOpFouten()

// Vite meldt zelf wanneer een scherm niet ingeladen kan worden. Dat
// gebeurt vrijwel altijd om één reden: er is een nieuwe versie
// uitgerold terwijl deze pagina al openstond (zie lib/versie.ts).
// Hier opvangen betekent dat de gebruiker er niets van merkt — de
// pagina herlaadt en hij gaat door. Merkt hij er tóch iets van, dan
// vangt de Foutvanger het af met een knop.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  herlaadVoorNieuweVersie()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
