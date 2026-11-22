/** Messages between the page and the on-device voice worker. Kept dependency-free. */

export type LocalRequest =
  /** The model file's bytes (transferred). */
  | { type: 'init'; model: ArrayBuffer }
  /** Read these chunks in order; audio comes back one sentence at a time. */
  | { type: 'speak'; session: number; chunks: string[]; voice: string; speed: number }
  | { type: 'cancel'; session: number }

export type LocalResponse =
  | { type: 'ready'; sampleRate: number; voices: string[] }
  | { type: 'init-error'; message: string }
  | { type: 'audio'; session: number; samples: Float32Array }
  | { type: 'done'; session: number }
  | { type: 'error'; session: number; message: string }
