/**
 * Core UI constants for the Task Management System
 * Implements Material Design 3.0 specifications and atomic design principles
 * Ensures consistent styling, layout, spacing, and responsive design
 */

// Global constants
const GOLDEN_RATIO = 1.618;
const BASE_SPACING_UNIT = 8;

/**
 * Responsive breakpoints following mobile-first approach
 * Used for consistent media queries across the application
 */
export const BREAKPOINTS = {
  MOBILE: 320,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE_DESKTOP: 1440,
} as const;

/**
 * Core layout dimensions following golden ratio and consistent spacing
 * Implements F-pattern layout organization
 */
export const LAYOUT = {
  MAX_WIDTH: BREAKPOINTS.LARGE_DESKTOP,
  HEADER_HEIGHT: 64, // Standard Material Design app bar height
  SIDEBAR_WIDTH: 256, // Standard Material Design navigation drawer width
  COLLAPSED_SIDEBAR_WIDTH: 72,
  CONTENT_PADDING: BASE_SPACING_UNIT * 3, // 24px standard content padding
  GOLDEN_RATIO_SPACING: Math.round(BASE_SPACING_UNIT * GOLDEN_RATIO), // ~13px for whitespace ratio
} as const;

/**
 * Spacing system based on 8px grid
 * Provides consistent spacing scale throughout the application
 */
export const SPACING = {
  UNIT: BASE_SPACING_UNIT,
  SMALL: BASE_SPACING_UNIT, // 8px
  MEDIUM: BASE_SPACING_UNIT * 2, // 16px
  LARGE: BASE_SPACING_UNIT * 3, // 24px
  XLARGE: BASE_SPACING_UNIT * 4, // 32px
  /**
   * Utility function to get spacing in multiples of base unit
   * @param multiplier Number of base units
   * @returns Spacing value in pixels
   */
  getSpacing: (multiplier: number): number => BASE_SPACING_UNIT * multiplier,
} as const;

/**
 * Z-index hierarchy for consistent layering
 * Follows Material Design elevation system
 */
export const Z_INDEX = {
  HEADER: 1100,
  SIDEBAR: 1200,
  DROPDOWN: 1300,
  MODAL: 1400,
  TOOLTIP: 1500,
  OVERLAY: 1600,
} as const;

/**
 * Animation timings and easing functions
 * Based on Material Design motion specifications
 */
export const ANIMATION = {
  DURATION_SHORT: 200,
  DURATION_MEDIUM: 300,
  DURATION_LONG: 400,
  EASING_STANDARD: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  EASING_DECELERATE: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  EASING_ACCELERATE: 'cubic-bezier(0.4, 0.0, 1, 1)',
} as const;

/**
 * Standard modal sizes for consistent dialog presentations
 * Follows responsive design principles
 */
export const MODAL_SIZES = {
  SMALL: 400,
  MEDIUM: 600,
  LARGE: 800,
  FULLSCREEN: '100%',
} as const;