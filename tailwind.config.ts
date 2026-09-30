import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bone: "#F4F0E8",
        ink: "#172B4D",
        rust: "#C45A2A",
        border: "#E0D9C8",
        muted: "#8A8275",
      },
      fontFamily: {
        sans: ["Heebo", "sans-serif"],
        mono: ["Space Grotesk", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

