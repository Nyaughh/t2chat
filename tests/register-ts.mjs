// Lets `node --test` run the TypeScript unit tests in this folder without extra
// dependencies. Node strips the types itself (Node 22.18+ / 23.6+); this hook
// only adds the `.ts` extension to extensionless relative and `@/` imports,
// which the app's bundler resolves but Node does not.
//
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null
    if (specifier.startsWith('@/')) base = path.join(srcDir, specifier.slice(2))
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:'))
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)

    if (base && !path.extname(base)) {
      for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context)
      }
    }
    return nextResolve(specifier, context)
  },
})
