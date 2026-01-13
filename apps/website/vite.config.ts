import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
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
	plugins: [tailwindcss(), TanStackRouterVite(), react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		minify: "esbuild",
		cssCodeSplit: true,
		target: "esnext",
	},
});
