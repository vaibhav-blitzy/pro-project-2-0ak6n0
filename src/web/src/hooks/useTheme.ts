import { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { Theme } from '../types/common.types';
import useLocalStorage from './useLocalStorage';
import { lightTheme, darkTheme } from '../config/theme.config';

// Constants for theme management
const THEME_STORAGE_KEY = 'theme';
const SYSTEM_DARK_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const THEME_TRANSITION_DURATION = '300ms';

/**
 * Interface for theme hook return value
 */
interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDarkMode: boolean;
  isTransitioning: boolean;
  error: string | null;
}

/**
 * Enhanced helper function to detect system theme preference with error handling
 * @returns Theme.LIGHT or Theme.DARK based on system preference
 */
const getSystemTheme = (): Theme => {
  try {
    if (!window.matchMedia) {
      console.warn('matchMedia not supported, defaulting to light theme');
      return 'light';
    }

    return window.matchMedia(SYSTEM_DARK_THEME_MEDIA_QUERY).matches ? 'dark' : 'light';
  } catch (error) {
    console.error('Error detecting system theme:', error);
    return 'light';
  }
};

/**
 * Validates theme colors against WCAG 2.1 Level AA contrast requirements
 * @param theme - Theme to validate
 * @returns boolean indicating if theme meets contrast requirements
 */
const validateThemeContrast = (theme: 'light' | 'dark'): boolean => {
  try {
    const themeConfig = theme === 'light' ? lightTheme : darkTheme;
    const { text, background } = themeConfig.palette;

    // Helper function to calculate relative luminance
    const getLuminance = (r: number, g: number, b: number): number => {
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    // Helper function to calculate contrast ratio
    const getContrastRatio = (l1: number, l2: number): number => {
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };

    // Convert hex to RGB
    const hexToRgb = (hex: string): number[] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [0, 0, 0];
    };

    // Calculate luminance for text and background colors
    const textLuminance = getLuminance(...hexToRgb(text.primary));
    const bgLuminance = getLuminance(...hexToRgb(background.default));

    // Check if contrast ratio meets WCAG 2.1 Level AA requirement (4.5:1)
    const contrastRatio = getContrastRatio(textLuminance, bgLuminance);
    return contrastRatio >= 4.5;
  } catch (error) {
    console.error('Error validating theme contrast:', error);
    return false;
  }
};

/**
 * Advanced hook for managing application theme state with Material Design 3.0 support,
 * WCAG compliance, and smooth transitions
 * @returns UseThemeReturn object containing theme state and management functions
 */
const useTheme = (): UseThemeReturn => {
  // Initialize theme state from localStorage with system preference fallback
  const [storedTheme, setStoredTheme] = useLocalStorage<Theme>(THEME_STORAGE_KEY, 'system');
  const [currentTheme, setCurrentTheme] = useState<Theme>(storedTheme);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate effective theme based on system preference when set to 'system'
  const effectiveTheme = currentTheme === 'system' ? getSystemTheme() : currentTheme;
  const isDarkMode = effectiveTheme === 'dark';

  /**
   * Applies theme transition animations to document root
   */
  const applyThemeTransition = useCallback(() => {
    const root = document.documentElement;
    root.style.setProperty('transition', `all ${THEME_TRANSITION_DURATION} ease-in-out`);
    setIsTransitioning(true);

    setTimeout(() => {
      root.style.removeProperty('transition');
      setIsTransitioning(false);
    }, parseInt(THEME_TRANSITION_DURATION));
  }, []);

  /**
   * Applies Material Design 3.0 theme tokens to document root
   */
  const applyThemeTokens = useCallback(() => {
    const theme = isDarkMode ? darkTheme : lightTheme;
    const root = document.documentElement;

    // Apply color tokens
    Object.entries(theme.palette).forEach(([category, values]) => {
      if (typeof values === 'object') {
        Object.entries(values).forEach(([key, value]) => {
          root.style.setProperty(
            `--md-sys-color-${category}-${key}`,
            value as string
          );
        });
      }
    });

    // Apply typography tokens
    Object.entries(theme.typography).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([prop, val]) => {
          root.style.setProperty(
            `--md-sys-typescale-${key}-${prop}`,
            val as string
          );
        });
      }
    });
  }, [isDarkMode]);

  /**
   * Memoized theme setter with WCAG validation and error handling
   */
  const setTheme = useCallback((newTheme: Theme) => {
    try {
      if (newTheme !== 'system' && !validateThemeContrast(newTheme)) {
        throw new Error(`Theme '${newTheme}' does not meet WCAG contrast requirements`);
      }

      applyThemeTransition();
      setCurrentTheme(newTheme);
      setStoredTheme(newTheme);
      setError(null);
    } catch (error) {
      console.error('Error setting theme:', error);
      setError(error instanceof Error ? error.message : 'Unknown error setting theme');
    }
  }, [setStoredTheme, applyThemeTransition]);

  // Set up system theme media query listener
  useEffect(() => {
    if (currentTheme === 'system') {
      const mediaQuery = window.matchMedia(SYSTEM_DARK_THEME_MEDIA_QUERY);
      const handleChange = () => {
        applyThemeTransition();
        applyThemeTokens();
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [currentTheme, applyThemeTransition, applyThemeTokens]);

  // Apply theme tokens whenever effective theme changes
  useEffect(() => {
    applyThemeTokens();
  }, [effectiveTheme, applyThemeTokens]);

  return {
    theme: currentTheme,
    setTheme,
    isDarkMode,
    isTransitioning,
    error
  };
};

export default useTheme;