import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      'public/**',
      'convex/_generated/**',
      'next-env.d.ts',
    ],
  },
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // Existing typing debt; kept visible as warnings instead of blocking lint.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
]

export default eslintConfig
