import { defineConfig } from "vite";
import pkg from "./package.json";

export default defineConfig({
  build: {
    target: "ES2017",
    lib: {
      entry: "src/index.ts",
      name: "Figments",
      formats: ["es", "umd"],
      fileName: (format, name) => `${name}.${format}.js`,
    },
    rollupOptions: {
      input: "./src/index.ts",
      output: {
        preserveModules: false,
      },
    },
  },
});
