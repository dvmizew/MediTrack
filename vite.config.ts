import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import fs from 'fs';
import path from 'path';

// Check if SSL certificates exist for HTTPS development
const certPath = path.resolve('./localhost.pem');
const keyPath = path.resolve('./localhost-key.pem');
const hasSSL = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		...(hasSSL && {
			https: {
				cert: fs.readFileSync(certPath),
				key: fs.readFileSync(keyPath)
			}
		}),
		hmr: {
			host: 'localhost',
			port: 5173,
			protocol: hasSSL ? 'wss' : 'ws'
		}
	},
	build: {
		target: 'esnext',
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true
			}
		},
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ['lucide-svelte', 'chart.js'],
					utils: ['date-fns', 'clsx', 'tailwind-merge']
				}
			}
		},
		cssCodeSplit: true,
		sourcemap: false,
		reportCompressedSize: true
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}', 'tests/client/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
										setupFiles: ['./vitest.setup.ts'],
					include: ['tests/**/*.{test,spec}.{js,ts}'],
					exclude: ['tests/client/**']
				}
			}
		]
	}
});
