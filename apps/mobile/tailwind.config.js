/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#026462",
        needs: "#3b82f6",
        wants: "#f97316",
        savings: "#10b981",
      },
    },
  },
  plugins: [],
};
