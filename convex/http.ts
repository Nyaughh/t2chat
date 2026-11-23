import { httpRouter } from 'convex/server'
import { authComponent, createAuth } from './auth'
import { geminiTts } from './tts'

const http = httpRouter()

authComponent.registerRoutes(http, createAuth)

// Gemini read-aloud with the caller's own key. Called by the app's /api/tts route.
http.route({ path: '/tts', method: 'POST', handler: geminiTts })

export default http
