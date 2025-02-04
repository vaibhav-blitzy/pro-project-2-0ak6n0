import { createTheme, useMediaQuery } from '@mui/material'; // ^5.0.0
import { Theme } from '../types/common.types';
import memoize from 'lodash/memoize'; // ^4.17.21

// Global constants for theme configuration
const THEME_TRANSITION_DURATION = 200;
const THEME_TRANSITION_EASING = 'ease-in-out';
const MINIMUM_CONTRAST_RATIO = 4.5;
const ENHANCED_CONTRAST_RATIO = 7.0;

// Color palette tokens following Material Design 3.0
const colorTokens = {
  light: {
    primary: {
      main: '#006494',
      light: '#4B89B8',
      dark: '#004266',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#7B1FA2',
      light: '#9C27B0',
      dark: '#6A1B9A',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#D32F2F',
      light: '#EF5350',
      dark: '#C62828',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#ED6C02',
      light: '#FF9800',
      dark: '#E65100',
      contrastText: '#000000',
    },
    info: {
      main: '#0288D1',
      light: '#03A9F4',
      dark: '#01579B',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#2E7D32',
      light: '#4CAF50',
      dark: '#1B5E20',
      contrastText: '#FFFFFF',
    },
    grey: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
    background: {
      default: '#FFFFFF',
      paper: '#F5F5F5',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
      disabled: 'rgba(0, 0, 0, 0.38)',
    },
  },
  dark: {
    primary: {
      main: '#90CAF9',
      light: '#B3E5FC',
      dark: '#42A5F5',
      contrastText: '#000000',
    },
    secondary: {
      main: '#CE93D8',
      light: '#E1BEE7',
      dark: '#AB47BC',
      contrastText: '#000000',
    },
    error: {
      main: '#F44336',
      light: '#E57373',
      dark: '#D32F2F',
      contrastText: '#000000',
    },
    warning: {
      main: '#FFA726',
      light: '#FFB74D',
      dark: '#F57C00',
      contrastText: '#000000',
    },
    info: {
      main: '#29B6F6',
      light: '#4FC3F7',
      dark: '#0288D1',
      contrastText: '#000000',
    },
    success: {
      main: '#66BB6A',
      light: '#81C784',
      dark: '#388E3C',
      contrastText: '#000000',
    },
    grey: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.5)',
    },
  },
};

// Interface for theme configuration
export interface ThemeConfig {
  palette: object;
  typography: object;
  spacing: object;
  breakpoints: object;
  transitions: object;
  zIndex: object;
  components: object;
  accessibility: object;
}

/**
 * Creates a customized Material-UI theme with accessibility enhancements
 * @param mode - Theme mode (light/dark/system)
 * @param preferHighContrast - Enable enhanced contrast ratios
 * @param reduceMotion - Enable reduced motion preferences
 * @returns Configured Material-UI theme object
 */
export const createCustomTheme = memoize((
  mode: Theme,
  preferHighContrast: boolean = false,
  reduceMotion: boolean = false
) => {
  const contrastRatio = preferHighContrast ? ENHANCED_CONTRAST_RATIO : MINIMUM_CONTRAST_RATIO;
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const effectiveMode = mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : mode;
  
  return createTheme({
    palette: {
      mode: effectiveMode,
      ...colorTokens[effectiveMode],
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: 16,
      htmlFontSize: 16,
      h1: {
        fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
        fontWeight: 700,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: 'clamp(2rem, 4vw, 3rem)',
        fontWeight: 700,
        lineHeight: 1.2,
      },
      h3: {
        fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h4: {
        fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h5: {
        fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
        fontWeight: 500,
        lineHeight: 1.4,
      },
      h6: {
        fontSize: 'clamp(1rem, 1.5vw, 1.25rem)',
        fontWeight: 500,
        lineHeight: 1.4,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.618,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.618,
      },
    },
    spacing: (factor: number) => `${0.25 * factor}rem`,
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 960,
        lg: 1280,
        xl: 1920,
      },
    },
    transitions: {
      duration: {
        shortest: reduceMotion ? 0 : THEME_TRANSITION_DURATION / 4,
        shorter: reduceMotion ? 0 : THEME_TRANSITION_DURATION / 2,
        short: reduceMotion ? 0 : THEME_TRANSITION_DURATION,
        standard: reduceMotion ? 0 : THEME_TRANSITION_DURATION,
        complex: reduceMotion ? 0 : THEME_TRANSITION_DURATION * 2,
        enteringScreen: reduceMotion ? 0 : THEME_TRANSITION_DURATION,
        leavingScreen: reduceMotion ? 0 : THEME_TRANSITION_DURATION,
      },
      easing: THEME_TRANSITION_EASING,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '4px',
            textTransform: 'none',
            fontWeight: 500,
            padding: '8px 16px',
            '&:focus-visible': {
              outline: `3px solid ${colorTokens[effectiveMode].primary.main}`,
              outlineOffset: '2px',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '&:focus-within': {
                '& > fieldset': {
                  borderColor: colorTokens[effectiveMode].primary.main,
                  borderWidth: '2px',
                },
              },
            },
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            textDecorationThickness: '1px',
            textUnderlineOffset: '2px',
            '&:focus-visible': {
              outline: `3px solid ${colorTokens[effectiveMode].primary.main}`,
              outlineOffset: '2px',
            },
          },
        },
      },
    },
    accessibility: {
      contrastRatio,
      reduceMotion,
      focusRing: true,
      semanticColors: true,
    },
  });
});

// Export theme configurations
export const lightTheme = createCustomTheme('light');
export const darkTheme = createCustomTheme('dark');

// Export common theme configuration
export const themeConfig = {
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
  transitions: {
    duration: THEME_TRANSITION_DURATION,
    easing: THEME_TRANSITION_EASING,
  },
  zIndex: {
    mobileStepper: 1000,
    speedDial: 1050,
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500,
  },
  accessibility: {
    minContrastRatio: MINIMUM_CONTRAST_RATIO,
    enhancedContrastRatio: ENHANCED_CONTRAST_RATIO,
    focusRingWidth: '3px',
    focusRingOffset: '2px',
    reducedMotion: false,
  },
};