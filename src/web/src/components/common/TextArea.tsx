import React, { useCallback, useRef, useEffect, forwardRef } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import { ComponentProps } from '../../interfaces/common.interface';
import styles from './TextArea.module.scss';

/**
 * Props interface for TextArea component
 * Extends base ComponentProps with textarea-specific properties
 */
interface TextAreaProps extends ComponentProps {
  value: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  autoResize?: boolean;
  showCharCount?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

/**
 * Debounce utility for optimizing resize calculations
 */
const debounce = (fn: Function, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

/**
 * TextArea component providing an accessible, feature-rich textarea input
 * Implements Material Design principles and WCAG 2.1 Level AA compliance
 */
const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
  id,
  className,
  value,
  placeholder,
  rows = 3,
  maxLength,
  autoResize = false,
  showCharCount = false,
  error,
  disabled = false,
  onChange,
  onBlur,
  ...props
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const combinedRef = (element: HTMLTextAreaElement) => {
    textareaRef.current = element;
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  };

  /**
   * Handles textarea value changes with validation and auto-resize
   */
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    
    // Prevent input if maxLength is exceeded
    if (maxLength && newValue.length > maxLength) {
      event.preventDefault();
      return;
    }

    onChange(newValue);

    if (autoResize) {
      adjustHeight(event.target);
    }
  };

  /**
   * Optimizes textarea height calculation with debouncing
   */
  const adjustHeight = useCallback(
    debounce((element: HTMLTextAreaElement) => {
      // Reset height to allow proper scrollHeight calculation
      element.style.height = 'auto';
      
      // Calculate new height with padding consideration
      const computedStyle = window.getComputedStyle(element);
      const verticalPadding = 
        parseFloat(computedStyle.paddingTop) + 
        parseFloat(computedStyle.paddingBottom);
      
      // Set new height with minimum constraint
      const newHeight = Math.max(
        element.scrollHeight + verticalPadding,
        rows * 24 // Minimum height based on line height
      );
      
      element.style.height = `${newHeight}px`;
    }, 150),
    [rows]
  );

  // Initialize auto-resize
  useEffect(() => {
    if (autoResize && textareaRef.current) {
      adjustHeight(textareaRef.current);
    }
  }, [autoResize, value, adjustHeight]);

  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${textareaId}-error`;
  const counterId = `${textareaId}-counter`;

  return (
    <div 
      className={classNames(
        styles.textareaWrapper,
        {
          [styles.disabled]: disabled,
          [styles.error]: error,
          [styles.autoResize]: autoResize
        },
        className
      )}
    >
      <textarea
        ref={combinedRef}
        id={textareaId}
        className={styles.textarea}
        value={value}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        onChange={handleChange}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={classNames({
          [errorId]: error,
          [counterId]: showCharCount
        })}
        {...props}
      />
      
      {/* Character counter */}
      {showCharCount && (
        <div 
          id={counterId}
          className={styles.counter}
          aria-live="polite"
        >
          {value.length}{maxLength ? `/${maxLength}` : ''}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div 
          id={errorId}
          className={styles.errorMessage}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;