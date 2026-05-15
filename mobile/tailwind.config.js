/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bistro: {
          bg: "#0f0e0c",
          surface: "#1a1814",
          card: "#242019",
          border: "#3d3528",
          gold: "#c9a962",
          "gold-dim": "#8a7340",
          cream: "#f5f0e6",
          muted: "#9a9080",
          accent: "#e85d4c",
          success: "#6b9e78",
        },
      },
      fontFamily: {
        serif: ["Georgia"],
      },
    },
  },
  plugins: [],
};
