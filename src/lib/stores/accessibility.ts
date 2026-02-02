import { writable } from 'svelte/store';

export type AccessibilitySettings = {
  textSize: 'normal' | 'large' | 'xlarge'; // 100% | 125% | 150%
  highContrast: boolean;
  reduceMotion: boolean;
};

const DEFAULT_SETTINGS: AccessibilitySettings = {
  textSize: 'normal',
  highContrast: false,
  reduceMotion: false
};

function createAccessibilityStore() {
  // Try to load from localStorage
  let saved: AccessibilitySettings = DEFAULT_SETTINGS;
  
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('accessibility-settings');
      if (stored) {
        saved = JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Failed to load accessibility settings:', err);
    }
  }

  const { subscribe, set, update } = writable<AccessibilitySettings>(saved);

  return {
    subscribe,
    
    setTextSize: (size: AccessibilitySettings['textSize']) => {
      update(settings => ({ ...settings, textSize: size }));
      persistSettings();
    },
    
    setHighContrast: (enabled: boolean) => {
      update(settings => ({ ...settings, highContrast: enabled }));
      persistSettings();
    },
    
    setReduceMotion: (enabled: boolean) => {
      update(settings => ({ ...settings, reduceMotion: enabled }));
      persistSettings();
    },
    
    reset: () => {
      set(DEFAULT_SETTINGS);
      persistSettings();
    }
  };

  function persistSettings() {
    if (typeof window !== 'undefined') {
      const unsubscribe = subscribe(settings => {
        try {
          localStorage.setItem('accessibility-settings', JSON.stringify(settings));
          
          // Apply settings to document
          const root = document.documentElement;
          
          // Text size
          const sizeMultipliers = {
            normal: 1,
            large: 1.25,
            xlarge: 1.5
          };
          root.style.fontSize = `${16 * sizeMultipliers[settings.textSize]}px`;
          
          // High contrast
          if (settings.highContrast) {
            root.classList.add('high-contrast');
          } else {
            root.classList.remove('high-contrast');
          }
          
          // Reduce motion
          if (settings.reduceMotion) {
            root.classList.add('reduce-motion');
          } else {
            root.classList.remove('reduce-motion');
          }
        } catch (err) {
          console.warn('Failed to persist accessibility settings:', err);
        }
      });
      unsubscribe();
    }
  }
}

export const accessibility = createAccessibilityStore();
