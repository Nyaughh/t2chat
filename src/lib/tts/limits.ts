/** Shared between the Convex /tts action (convex/tts.ts) and the client. */

/** Longest text accepted per Gemini TTS request; longer replies are split. */
export const TTS_MAX_CHARS = 3000

/** Gemini TTS streams 16-bit mono PCM at this rate. */
export const GEMINI_SAMPLE_RATE = 24000

export const GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts'

/** Per signed-in user, enforced in Convex (ttsUsage table). */
export const TTS_RATE_LIMITS = {
  requestsPerMinute: 8,
  charsPerHour: 40_000,
}
