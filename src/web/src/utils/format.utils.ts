import { Timestamp } from '../types/common.types';
import numeral from 'numeral'; // ^2.0.6
import { memoize } from 'lodash'; // ^4.17.21

// Global constants for formatting configuration
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Type guard to validate number input
 * @param value Value to check
 */
const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

/**
 * Formats a number with locale-aware thousand separators and decimal places
 * @param value Number to format
 * @param format Optional format pattern
 * @param locale Optional locale string
 * @returns Formatted number string
 */
export const formatNumber = memoize((
  value: number,
  format?: string,
  locale: string = DEFAULT_LOCALE
): string => {
  if (!isValidNumber(value)) {
    return '0';
  }

  try {
    if (format) {
      return numeral(value).format(format);
    }

    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    }).format(value);
  } catch (error) {
    console.error('Error formatting number:', error);
    return '0';
  }
});

/**
 * Formats a number as currency with locale-aware symbol placement
 * @param value Amount to format
 * @param currencyCode Optional currency code
 * @param locale Optional locale string
 * @returns Formatted currency string
 */
export const formatCurrency = memoize((
  value: number,
  currencyCode: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE
): string => {
  if (!isValidNumber(value)) {
    return `0.00 ${currencyCode}`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `0.00 ${currencyCode}`;
  }
});

/**
 * Formats bytes into human-readable file size
 * @param bytes Number of bytes
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number): string => {
  if (!isValidNumber(bytes) || bytes < 0) {
    return '0 B';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    FILE_SIZE_UNITS.length - 1
  );

  const size = bytes / Math.pow(1024, exp);
  const roundedSize = Math.round(size * 100) / 100;
  
  return `${roundedSize} ${FILE_SIZE_UNITS[exp]}`;
};

/**
 * Truncates text to specified length with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length
 * @param preserveWords Optional flag to preserve word boundaries
 * @returns Truncated text
 */
export const truncateText = (
  text: string,
  maxLength: number,
  preserveWords: boolean = true
): string => {
  if (!text || maxLength <= 0) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  let truncated = text.slice(0, maxLength);

  if (preserveWords) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.slice(0, lastSpace);
    }
  }

  // Handle RTL text direction
  const rtlMarker = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  const isRTL = rtlMarker.test(text);
  
  return `${truncated}${isRTL ? '...' : '...'}`;
};

/**
 * Formats a decimal number as percentage
 * @param value Decimal value (0-1)
 * @param decimalPlaces Optional decimal places
 * @param locale Optional locale string
 * @returns Formatted percentage string
 */
export const formatPercentage = memoize((
  value: number,
  decimalPlaces: number = 0,
  locale: string = DEFAULT_LOCALE
): string => {
  if (!isValidNumber(value)) {
    return '0%';
  }

  try {
    const percentage = value * 100;
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    }).format(value);
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return '0%';
  }
});