const plugin = require("tailwindcss/plugin");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  corePlugins: {
    fontWeight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["InstrumentSans-400"],
        display: ["InstrumentSerif-400"],
        mono: ["JetBrainsMono-400"],
        medium: ["InstrumentSans-500"],
        semibold: ["InstrumentSans-600"],
        bold: ["InstrumentSans-700"],
      },
      colors: {
        primary: "#00685f",
        needs: "#3b82f6",
        wants: "#f97316",
        savings: "#10b981",
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        ".font-normal": { fontFamily: "InstrumentSans-400", fontWeight: "400" },
        ".font-medium": { fontFamily: "InstrumentSans-500", fontWeight: "400" },
        ".font-semibold": { fontFamily: "InstrumentSans-600", fontWeight: "400" },
        ".font-bold": { fontFamily: "InstrumentSans-700", fontWeight: "400" },
        ".font-extrabold": { fontFamily: "InstrumentSans-700", fontWeight: "400" },
        ".font-black": { fontFamily: "InstrumentSans-700", fontWeight: "400" },
        ".font-display": { fontFamily: "InstrumentSans-700", fontWeight: "400" },
        ".font-mono": { fontFamily: "JetBrainsMono-400", fontWeight: "400" },
        ".font-sans": { fontFamily: "InstrumentSans-400", fontWeight: "400" },
      });
    }),
  ],
};
