// Paste into tailwind.config.ts → theme.extend. Hex values are sRGB conversions of the oklch tokens.
export const lessonFoundryTheme = {
  "colors": {
    "ink": "#191f2b",
    "canvas": "#f3f2f2",
    "surface": "#eae9e9",
    "blue": {
      "100": "#eff6ff",
      "200": "#d9e9ff",
      "300": "#b8d3f9",
      "400": "#7ba7e3",
      "500": "#427bc6",
      "600": "#1b5296",
      "700": "#154784",
      "800": "#0b3262",
      "900": "#051f3f",
      "DEFAULT": "#2763ae"
    },
    "green": {
      "100": "#dcf2df",
      "700": "#196632",
      "DEFAULT": "#267543"
    },
    "amber": {
      "100": "#fde8c6",
      "700": "#844b00",
      "DEFAULT": "#d49838"
    },
    "red": {
      "100": "#ffe3df",
      "700": "#9b1f1d",
      "DEFAULT": "#cc3430"
    },
    "neutral": {
      "100": "#f8f4f4",
      "200": "#eae7e7",
      "300": "#d7d3d3",
      "400": "#bab6b6",
      "500": "#9b9797",
      "600": "#7d7979",
      "700": "#605d5d",
      "800": "#444141",
      "900": "#2d2b2b"
    }
  },
  "borderRadius": {
    "none": "0",
    "DEFAULT": "0"
  },
  "fontFamily": {
    "sans": [
      "Archivo",
      "system-ui",
      "sans-serif"
    ]
  },
  "borderWidth": {
    "rule": "2px"
  }
} as const;
