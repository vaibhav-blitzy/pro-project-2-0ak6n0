import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import ClickAwayListener from '@mui/material/ClickAwayListener'; // ^5.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { ComponentProps } from '../../interfaces/common.interface';
import Icon from './Icon';
import { ComponentSize } from '../../types/common.types';

/**
 * Interface for dropdown option structure
 */
interface DropdownOption {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  icon?: string;
  description?: string;
}

/**
 * Props interface extending base component props
 */
interface DropdownProps extends ComponentProps {
  label: string;
  placeholder: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  virtualized?: boolean;
  virtualizedThreshold?: number;
  options: DropdownOption[];
  value: DropdownOption | DropdownOption[] | null;
  onChange: (value: DropdownOption | DropdownOption[] | null) => void;
  errorMessage?: string;
  required?: boolean;
  maxHeight?: number;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

// Styled components with Material Design principles
const DropdownContainer = styled('div')(({ theme }) => ({
  position: 'relative',
  width: '100%',
  fontFamily: theme.typography.fontFamily,
}));

const DropdownTrigger = styled('button')<{ $hasError?: boolean }>(({ theme, $hasError }) => ({
  width: '100%',
  minHeight: '48px',
  padding: theme.spacing(1.5, 2),
  border: `1px solid ${$hasError ? theme.palette.error.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  transition: theme.transitions.create(['border-color', 'box-shadow']),
  '&:hover': {
    borderColor: theme.palette.primary.main,
  },
  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
  },
  '&:disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
    cursor: 'not-allowed',
  },
}));

const DropdownList = styled('ul')<{ $maxHeight?: number }>(({ theme, $maxHeight }) => ({
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  maxHeight: $maxHeight || 300,
  overflowY: 'auto',
  margin: 0,
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[4],
  zIndex: theme.zIndex.modal,
  listStyle: 'none',
  '&:focus': {
    outline: 'none',
  },
}));

const DropdownOption = styled('li')<{ $isSelected?: boolean; $isFocused?: boolean }>(
  ({ theme, $isSelected, $isFocused }) => ({
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    backgroundColor: $isSelected
      ? theme.palette.primary.light
      : $isFocused
      ? theme.palette.action.hover
      : 'transparent',
    color: $isSelected ? theme.palette.primary.contrastText : theme.palette.text.primary,
    '&:hover': {
      backgroundColor: $isSelected ? theme.palette.primary.light : theme.palette.action.hover,
    },
    '&[aria-disabled="true"]': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  }),
);

const SearchInput = styled('input')(({ theme }) => ({
  width: '100%',
  padding: theme.spacing(1, 2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(1),
  '&:focus': {
    outline: 'none',
    borderColor: theme.palette.primary.main,
  },
}));

const ErrorMessage = styled('span')(({ theme }) => ({
  color: theme.palette.error.main,
  fontSize: theme.typography.caption.fontSize,
  marginTop: theme.spacing(0.5),
}));

/**
 * Enhanced Dropdown component with virtualization and comprehensive accessibility
 */
const Dropdown: React.FC<DropdownProps> = ({
  id,
  label,
  placeholder,
  disabled = false,
  multiple = false,
  searchable = false,
  virtualized = false,
  virtualizedThreshold = 100,
  options,
  value,
  onChange,
  errorMessage,
  required = false,
  maxHeight = 300,
  ariaLabel,
  ariaDescribedBy,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [options, searchTerm]);

  // Setup virtualization if enabled and options exceed threshold
  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 40,
    overscan: 5,
    enabled: virtualized && filteredOptions.length > virtualizedThreshold,
  });

  // Handle keyboard navigation
  const handleKeyboardNavigation = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev,
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedIndex >= 0) {
            handleOptionSelect(filteredOptions[focusedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          break;
        case 'Tab':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, focusedIndex, filteredOptions],
  );

  // Handle option selection
  const handleOptionSelect = useCallback(
    (option: DropdownOption) => {
      if (option.disabled) return;

      if (multiple) {
        const currentValue = (value as DropdownOption[]) || [];
        const isSelected = currentValue.some((v) => v.value === option.value);
        onChange(
          isSelected
            ? currentValue.filter((v) => v.value !== option.value)
            : [...currentValue, option],
        );
      } else {
        onChange(option);
        setIsOpen(false);
      }
    },
    [multiple, value, onChange],
  );

  // Reset state when closing dropdown
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  // Render selected value(s)
  const renderValue = () => {
    if (!value) return placeholder;
    if (multiple) {
      const selectedValues = value as DropdownOption[];
      return selectedValues.length
        ? selectedValues.map((v) => v.label).join(', ')
        : placeholder;
    }
    return (value as DropdownOption).label;
  };

  return (
    <DropdownContainer ref={containerRef} className={className}>
      <ClickAwayListener onClickAway={() => setIsOpen(false)}>
        <div>
          <DropdownTrigger
            type="button"
            id={id}
            disabled={disabled}
            $hasError={!!errorMessage}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-labelledby={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-required={required}
          >
            <span>{renderValue()}</span>
            <Icon
              name={isOpen ? 'expand_less' : 'expand_more'}
              size={ComponentSize.SMALL}
              aria-hidden="true"
            />
          </DropdownTrigger>

          {isOpen && (
            <DropdownList
              ref={listRef}
              role="listbox"
              $maxHeight={maxHeight}
              aria-multiselectable={multiple}
              onKeyDown={handleKeyboardNavigation}
              tabIndex={-1}
            >
              {searchable && (
                <SearchInput
                  ref={searchRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  aria-label="Search options"
                />
              )}

              {virtualized && filteredOptions.length > virtualizedThreshold ? (
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => (
                    <DropdownOption
                      key={filteredOptions[virtualRow.index].id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => handleOptionSelect(filteredOptions[virtualRow.index])}
                      $isSelected={
                        multiple
                          ? (value as DropdownOption[])?.some(
                              (v) => v.value === filteredOptions[virtualRow.index].value,
                            )
                          : (value as DropdownOption)?.value === filteredOptions[virtualRow.index].value
                      }
                      $isFocused={focusedIndex === virtualRow.index}
                      role="option"
                      aria-selected={
                        multiple
                          ? (value as DropdownOption[])?.some(
                              (v) => v.value === filteredOptions[virtualRow.index].value,
                            )
                          : (value as DropdownOption)?.value === filteredOptions[virtualRow.index].value
                      }
                      aria-disabled={filteredOptions[virtualRow.index].disabled}
                    >
                      {filteredOptions[virtualRow.index].icon && (
                        <Icon
                          name={filteredOptions[virtualRow.index].icon!}
                          size={ComponentSize.SMALL}
                        />
                      )}
                      {filteredOptions[virtualRow.index].label}
                    </DropdownOption>
                  ))}
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <DropdownOption
                    key={option.id}
                    onClick={() => handleOptionSelect(option)}
                    $isSelected={
                      multiple
                        ? (value as DropdownOption[])?.some((v) => v.value === option.value)
                        : (value as DropdownOption)?.value === option.value
                    }
                    $isFocused={focusedIndex === index}
                    role="option"
                    aria-selected={
                      multiple
                        ? (value as DropdownOption[])?.some((v) => v.value === option.value)
                        : (value as DropdownOption)?.value === option.value
                    }
                    aria-disabled={option.disabled}
                  >
                    {option.icon && <Icon name={option.icon} size={ComponentSize.SMALL} />}
                    {option.label}
                  </DropdownOption>
                ))
              )}
            </DropdownList>
          )}
        </div>
      </ClickAwayListener>
      {errorMessage && <ErrorMessage role="alert">{errorMessage}</ErrorMessage>}
    </DropdownContainer>
  );
};

export default Dropdown;