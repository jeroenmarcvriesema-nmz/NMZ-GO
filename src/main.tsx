import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { luisterOpFouten } from '@/lib/foutmelder'
import './index.css'

// Meteen aanzetten, vóór React begint. Wat er tijdens het opstarten
// misgaat is juist het lastigst te reproduceren en het meest gemeld
// als "hij deed het gewoon niet".
luisterOpFouten()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
