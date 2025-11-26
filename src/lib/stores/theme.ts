import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
	if (browser) {
		const root = document.documentElement;
		if (theme === 'dark') {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
	}
}

function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>('light');

	return {
		subscribe,
		toggle: () => {
			update(current => {
				const newTheme: Theme = current === 'light' ? 'dark' : 'light';
				if (browser) {
					localStorage.setItem('theme', newTheme);
					applyTheme(newTheme);
				}
				return newTheme;
			});
		},
		set: (theme: Theme) => {
			set(theme);
			if (browser) {
				localStorage.setItem('theme', theme);
				applyTheme(theme);
			}
		},
		init: () => {
			if (browser) {
				const stored = localStorage.getItem('theme') as Theme | null;
				const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				const theme = stored || (prefersDark ? 'dark' : 'light');
				set(theme);
				applyTheme(theme);
			}
		}
	};
}

export const themeStore = createThemeStore();
