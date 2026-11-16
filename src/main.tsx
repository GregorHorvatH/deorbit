import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode: the game state lives outside React and the effects start real work (the sound, a weather request, the
// input handlers), so running every effect twice in development only gets in the way.
createRoot(document.getElementById('root')!).render(<App />)
