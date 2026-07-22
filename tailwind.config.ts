import type { Config } from "tailwindcss";
import daisyui from "daisyui";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: ["business", "light"],
    // Evita el hueco del backdrop a la derecha: el scroll vive en <main>, no en :root.
    exclude: ["rootscrollgutter"],
  },
};

export default config;
