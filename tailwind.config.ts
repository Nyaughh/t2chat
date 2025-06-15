import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        serif: ["Lora", "serif"],
        "roboto-slab": ["Roboto Slab", "serif"],
        "source-code-pro": ["Source Code Pro", "monospace"],
        "fira-code": ["Fira Code", "monospace"],
        consolas: ["Consolas", "monospace"],
        jetbrains: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config; 