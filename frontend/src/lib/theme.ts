import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createThemeStore() {
  // Initialize with false, will be updated in browser
  const { subscribe, set, update } = writable(false);

  return {
    subscribe,
    init() {
      if (!browser) return;

      // Check localStorage first, then system preference
      const stored = localStorage.getItem('theme');
      if (stored) {
        set(stored === 'dark');
      } else {
        set(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }

      // Apply theme on init
      this.apply();

      // Listen for system preference changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          set(e.matches);
          this.apply();
        }
      });
    },
    toggle() {
      update(isDark => {
        const newValue = !isDark;
        if (browser) {
          localStorage.setItem('theme', newValue ? 'dark' : 'light');
        }
        return newValue;
      });
      this.apply();
    },
    apply() {
      if (!browser) return;

      let isDark = false;
      const unsubscribe = subscribe(value => { isDark = value; });
      unsubscribe();

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };
}

export const theme = createThemeStore();
