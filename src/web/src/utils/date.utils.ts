import { Timestamp } from '../types/common.types';
import { format, parseISO, isValid, differenceInDays, differenceInMinutes } from 'date-fns'; // ^2.30.0
import { Locale, enUS } from 'date-fns/locale'; // ^2.30.0

// Cache for memoized date formatting results
const formatCache = new Map<string, string>();
const CACHE_MAX_SIZE = 1000;

// Cache for day difference calculations
const diffCache = new Map<string, number>();

interface RelativeTimeOptions {
  threshold?: number;
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  includeTime?: boolean;
}

/**
 * Formats a date into a localized string with advanced formatting options
 * @param date - The date to format (string or Date object)
 * @param formatString - The format pattern to use
 * @param locale - Optional locale string (defaults to en-US)
 * @param timezone - Optional timezone string
 * @returns Formatted date string
 */
export const formatDate = (
  date: Timestamp,
  formatString: string,
  locale?: string,
  timezone?: string
): string => {
  try {
    // Generate cache key
    const cacheKey = `${date}-${formatString}-${locale}-${timezone}`;
    
    // Check cache first
    const cachedResult = formatCache.get(cacheKey);
    if (cachedResult) return cachedResult;

    // Convert string dates to Date objects
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      throw new Error('Invalid date provided');
    }

    // Apply timezone if specified
    let finalDate = dateObj;
    if (timezone) {
      finalDate = new Date(dateObj.toLocaleString('en-US', { timeZone: timezone }));
    }

    // Get locale configuration
    const localeConfig = locale ? 
      require(`date-fns/locale/${locale}`) : 
      enUS;

    // Format the date
    const result = format(finalDate, formatString, {
      locale: localeConfig,
      useAdditionalWeekYearTokens: true,
      useAdditionalDayOfYearTokens: true
    });

    // Cache the result
    if (formatCache.size >= CACHE_MAX_SIZE) {
      const firstKey = formatCache.keys().next().value;
      formatCache.delete(firstKey);
    }
    formatCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

/**
 * Enhanced date parser with support for multiple formats
 * @param dateString - The date string to parse
 * @param timezone - Optional timezone string
 * @param formatPatterns - Optional array of format patterns to try
 * @returns Parsed Date object or null if invalid
 */
export const parseDate = (
  dateString: string,
  timezone?: string,
  formatPatterns?: string[]
): Date | null => {
  try {
    // Sanitize input
    const sanitizedDate = dateString.trim();
    
    // Try parsing with provided patterns first
    if (formatPatterns) {
      for (const pattern of formatPatterns) {
        const parsed = parseISO(sanitizedDate);
        if (isValid(parsed)) {
          return timezone ? 
            new Date(parsed.toLocaleString('en-US', { timeZone: timezone })) : 
            parsed;
        }
      }
    }

    // Fallback to ISO parsing
    const parsed = parseISO(sanitizedDate);
    if (isValid(parsed)) {
      return timezone ? 
        new Date(parsed.toLocaleString('en-US', { timeZone: timezone })) : 
        parsed;
    }

    return null;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
};

/**
 * Calculates day differences with support for business days and holidays
 * @param startDate - Start date
 * @param endDate - End date
 * @param businessDaysOnly - Optional flag for business days only
 * @param holidays - Optional array of holiday dates to exclude
 * @returns Number of days between dates
 */
export const getDaysDifference = (
  startDate: Timestamp,
  endDate: Timestamp,
  businessDaysOnly?: boolean,
  holidays?: Date[]
): number => {
  try {
    // Generate cache key
    const cacheKey = `${startDate}-${endDate}-${businessDaysOnly}-${holidays?.length}`;
    
    // Check cache first
    const cachedResult = diffCache.get(cacheKey);
    if (cachedResult !== undefined) return cachedResult;

    // Convert dates to Date objects if needed
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValid(start) || !isValid(end)) {
      throw new Error('Invalid date(s) provided');
    }

    let difference = differenceInDays(end, start);

    // Apply business days calculation if specified
    if (businessDaysOnly) {
      difference = Math.floor(difference * (5 / 7)); // Exclude weekends
      
      // Exclude holidays if provided
      if (holidays?.length) {
        const holidaysInRange = holidays.filter(holiday => 
          holiday >= start && holiday <= end
        ).length;
        difference -= holidaysInRange;
      }
    }

    // Cache the result
    if (diffCache.size >= CACHE_MAX_SIZE) {
      const firstKey = diffCache.keys().next().value;
      diffCache.delete(firstKey);
    }
    diffCache.set(cacheKey, difference);

    return Math.abs(difference);
  } catch (error) {
    console.error('Day difference calculation error:', error);
    return 0;
  }
};

/**
 * Generates granular relative time strings with threshold-based formatting
 * @param date - The date to compare
 * @param options - Optional configuration options
 * @returns Formatted relative time string
 */
export const getRelativeTimeString = (
  date: Timestamp,
  options: RelativeTimeOptions = {}
): string => {
  try {
    const {
      threshold = 7,
      granularity = 'day',
      includeTime = false
    } = options;

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      throw new Error('Invalid date provided');
    }

    const now = new Date();
    const diffInMinutes = differenceInMinutes(now, dateObj);
    const diffInDays = differenceInDays(now, dateObj);

    // Handle different granularities
    if (granularity === 'minute' || diffInDays === 0) {
      if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
      }
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    // For recent dates within threshold
    if (diffInDays < threshold) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }

    // For dates beyond threshold, use formatted date
    return formatDate(
      dateObj,
      includeTime ? 'PPpp' : 'PP',
      undefined,
      undefined
    );
  } catch (error) {
    console.error('Relative time calculation error:', error);
    return 'Invalid Date';
  }
};