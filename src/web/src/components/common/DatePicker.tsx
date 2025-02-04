import React, { useState, useCallback, useEffect } from 'react';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers'; // ^6.0.0
import { TextField } from '@mui/material'; // ^5.0.0
import { ComponentProps } from '../../interfaces/common.interface';
import { formatDate, isValidDate } from '../../utils/date.utils';
import { validateDateRange } from '../../utils/validation.utils';

/**
 * Enhanced props interface for DatePicker component with advanced features
 * Extends base ComponentProps with comprehensive date handling capabilities
 */
interface DatePickerProps extends ComponentProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  errorMessage?: string;
  helperText?: string;
  timezone?: string;
  formatPattern?: string;
  businessDaysOnly?: boolean;
  customValidator?: (date: Date) => boolean;
  disabledDates?: string[];
  validationRules?: Record<string, any>;
}

/**
 * Enhanced DatePicker component implementing Material Design 3.0 principles
 * Provides comprehensive date selection with validation, localization and accessibility
 */
const DatePicker: React.FC<DatePickerProps> = ({
  id,
  className,
  value,
  onChange,
  label,
  placeholder,
  required = false,
  disabled = false,
  minDate,
  maxDate,
  errorMessage,
  helperText,
  timezone = 'UTC',
  formatPattern = 'PP',
  businessDaysOnly = false,
  customValidator,
  disabledDates = [],
  validationRules,
  ...props
}) => {
  // State for internal error handling
  const [error, setError] = useState<string | null>(null);
  const [internalValue, setInternalValue] = useState<Date | null>(value);

  /**
   * Enhanced date change handler with comprehensive validation
   */
  const handleDateChange = useCallback((date: Date | null) => {
    let isValid = true;
    let validationError = '';

    if (date) {
      // Basic date validation
      if (!isValidDate(date)) {
        isValid = false;
        validationError = 'Invalid date format';
      }

      // Date range validation
      if (isValid && (minDate || maxDate)) {
        const rangeValidation = validateDateRange(
          minDate || new Date(),
          maxDate || new Date(8640000000000000)
        );
        if (rangeValidation.hasError) {
          isValid = false;
          validationError = rangeValidation.message;
        }
      }

      // Business days validation
      if (isValid && businessDaysOnly) {
        const day = date.getDay();
        if (day === 0 || day === 6) {
          isValid = false;
          validationError = 'Please select a business day';
        }
      }

      // Disabled dates validation
      if (isValid && disabledDates.length > 0) {
        const dateStr = formatDate(date, 'yyyy-MM-dd', undefined, timezone);
        if (disabledDates.includes(dateStr)) {
          isValid = false;
          validationError = 'This date is not available';
        }
      }

      // Custom validation
      if (isValid && customValidator && !customValidator(date)) {
        isValid = false;
        validationError = 'Date does not meet custom validation rules';
      }
    }

    // Update error state
    setError(isValid ? null : validationError);

    // Update internal value and call onChange
    setInternalValue(date);
    if (isValid || date === null) {
      onChange(date);
    }
  }, [minDate, maxDate, businessDaysOnly, disabledDates, customValidator, onChange, timezone]);

  // Sync internal value with external value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return (
    <MuiDatePicker
      value={internalValue}
      onChange={handleDateChange}
      renderInput={(params) => (
        <TextField
          {...params}
          id={id}
          className={className}
          label={label}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          error={!!error || !!errorMessage}
          helperText={error || errorMessage || helperText}
          fullWidth
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{
            ...params.inputProps,
            'aria-label': label || 'Date picker',
            'aria-required': required,
            'data-testid': props.testId,
          }}
        />
      )}
      disabled={disabled}
      minDate={minDate}
      maxDate={maxDate}
      shouldDisableDate={(date) => {
        if (businessDaysOnly) {
          const day = date.getDay();
          if (day === 0 || day === 6) return true;
        }
        const dateStr = formatDate(date, 'yyyy-MM-dd', undefined, timezone);
        return disabledDates.includes(dateStr);
      }}
      inputFormat={formatPattern}
      mask="__/__/____"
      toolbarFormat={formatPattern}
      showToolbar
      showTodayButton
      clearable
      PopperProps={{
        placement: 'bottom-start',
        modifiers: [{
          name: 'offset',
          options: {
            offset: [0, 8],
          },
        }],
      }}
      {...props}
    />
  );
};

export default DatePicker;