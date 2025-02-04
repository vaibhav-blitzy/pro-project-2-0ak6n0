import React, { useCallback, useRef, useState, useEffect } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import debounce from 'lodash/debounce'; // ^4.0.8
import { ComponentSize } from '../../types/common.types';
import { validateInput } from '../../utils/validation.utils';
import { useTheme } from '../../hooks/useTheme';

/**
 * Interface for input validation rules following WCAG 2.1 standards
 */
interface InputValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => Promise<boolean>;
}

/**
 * Interface for input validation state
 */
interface ValidationState {
  isValid: boolean;
  error?: string;
  isDirty: boolean;
}

/**
 * Comprehensive props interface for the Input component
 */
interface InputProps {
  id?: string;
  name: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search';
  value: string;
  placeholder?: string;
  label: string;
  error?: string;
  helperText?: string;
  size?: ComponentSize;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  pattern?: string;
  autoComplete?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'data-testid'?: string;
  className?: string;
  validationRules?: InputValidationRules;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onValidation?: (isValid: boolean, error?: string) => void;
}

/**
 * Enhanced input component implementing Material Design 3.0 with comprehensive
 * validation, accessibility features, and responsive behavior
 */
const Input: React.FC<InputProps> = React.memo(({
  id,
  name,
  type = 'text',
  value,
  placeholder,
  label,
  error,
  helperText,
  size = ComponentSize.MEDIUM,
  disabled = false,
  required = false,
  readOnly = false,
  pattern,
  autoComplete,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'data-testid': dataTestId,
  className,
  validationRules,
  onChange,
  onBlur,
  onFocus,
  onValidation
}) => {
  // Generate unique IDs for accessibility
  const inputId = useRef(`input-${id || crypto.randomUUID()}`);
  const helperId = useRef(`helper-${inputId.current}`);
  const errorId = useRef(`error-${inputId.current}`);

  // State management
  const [validationState, setValidationState] = useState<ValidationState>({
    isValid: true,
    isDirty: false
  });
  const { theme, isDarkMode } = useTheme();

  // Debounced validation handler
  const debouncedValidate = useCallback(
    debounce(async (value: string) => {
      if (!validationRules) return;

      try {
        const validationResult = await validateInput(value, validationRules);
        setValidationState(prev => ({
          ...prev,
          isValid: validationResult.isValid,
          error: validationResult.error
        }));
        onValidation?.(validationResult.isValid, validationResult.error);
      } catch (error) {
        console.error('Validation error:', error);
        setValidationState(prev => ({
          ...prev,
          isValid: false,
          error: 'Validation failed'
        }));
        onValidation?.(false, 'Validation failed');
      }
    }, 300),
    [validationRules, onValidation]
  );

  // Handle input changes with validation
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;

    const newValue = event.target.value;
    onChange?.(event);

    setValidationState(prev => ({
      ...prev,
      isDirty: true
    }));

    debouncedValidate(newValue);
  }, [disabled, readOnly, onChange, debouncedValidate]);

  // Handle blur events
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
    if (!validationState.isDirty) {
      setValidationState(prev => ({
        ...prev,
        isDirty: true
      }));
      debouncedValidate(event.target.value);
    }
  }, [onBlur, debouncedValidate, validationState.isDirty]);

  // Clean up debounced validation on unmount
  useEffect(() => {
    return () => {
      debouncedValidate.cancel();
    };
  }, [debouncedValidate]);

  // Compute input classes
  const inputClasses = classNames(
    'input',
    `input--${size.toLowerCase()}`,
    {
      'input--error': error || (validationState.isDirty && !validationState.isValid),
      'input--disabled': disabled,
      'input--readonly': readOnly,
      'input--dark': isDarkMode
    },
    className
  );

  return (
    <div className="input-container">
      <label
        htmlFor={inputId.current}
        className={classNames('input__label', {
          'input__label--required': required
        })}
      >
        {label}
      </label>
      <input
        id={inputId.current}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        pattern={pattern}
        autoComplete={autoComplete}
        aria-label={ariaLabel || label}
        aria-invalid={!validationState.isValid}
        aria-required={required}
        aria-describedby={classNames(
          helperText && helperId.current,
          (error || validationState.error) && errorId.current,
          ariaDescribedBy
        )}
        data-testid={dataTestId}
        className={inputClasses}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={onFocus}
      />
      {helperText && (
        <span id={helperId.current} className="input__helper-text">
          {helperText}
        </span>
      )}
      {(error || (validationState.isDirty && validationState.error)) && (
        <span
          id={errorId.current}
          className="input__error"
          role="alert"
        >
          {error || validationState.error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;