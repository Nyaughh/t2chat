// Loaded on demand by math.ts the first time a message contains `$`.
// This keeps KaTeX (JS, CSS and fonts) off the first-load path.
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

export const remarkMathPlugin = [remarkMath, { singleDollarTextMath: true }] as const
// trust stays false, so \href, \url and \includegraphics can't make links or
// load resources from untrusted model output.
export const rehypeKatexPlugin = [rehypeKatex, { throwOnError: false, strict: 'ignore', trust: false, output: 'htmlAndMathml' }] as const
