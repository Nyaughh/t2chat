# tiny-voca (vendored)

The plain-JavaScript runtime of [tiny-voca](https://github.com/n4ze3m/tiny-voca)
by Muhammed Nazeem (n4ze3m): a 4.5M-parameter, two-voice (F2, M2) English
text-to-speech model, and [dizione](https://github.com/n4ze3m/dizione), its
phonemizer. No dependencies; it runs in our Web Worker (`../local.worker.ts`).

- Source: `js/tiny-voca.js`, `js/text.js` and `js/dizione/*.js` from
  github.com/n4ze3m/tiny-voca at commit `85bd7b0f36ff0529f87a600735e66a0cb071b524`,
  copied unchanged.
- Model: `gguf/tiny-voca-js.gguf` (7,988,384 bytes) from huggingface.co/n4ze3m/tiny-voca
  at revision `5fe06641d0afecb3c04bc9faca2cf64d9b2b1600`. It is downloaded at
  runtime, never bundled, and its SHA-256 is checked (see `../local-model.ts`).
- License: Apache-2.0 (`LICENSE`). The model file contains a pronunciation
  dictionary derived from the CMU Pronouncing Dictionary (`LICENSE.cmudict`).

To update, copy the same files from a newer commit, then update the commit,
revision, size and hash in `../local-model.ts`.
