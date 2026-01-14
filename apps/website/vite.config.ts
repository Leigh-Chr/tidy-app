import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	base: "/tidy-app/",
	server: {
		port: 3020,
		strictPort: true,
	},
	preview: {
		port: 3020,
		strictPort: true,
	},
	plugins: [tailwindcss()],
	build: {
		minify: "esbuild",
		cssCodeSplit: false,
		target: "esnext",
	},
});
