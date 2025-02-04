import React, { useCallback, useEffect, useRef, useState } from 'react'; // ^18.0.0
import { Select as MuiSelect, MenuItem, InputBase, Chip, CircularProgress } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { useVirtual } from 'react-virtual'; // ^3.0.0
import debounce from 'lodash/debounce'; // ^4.17.21
import { ComponentProps, ErrorState } from '../../interfaces/common.interface';
import { themeConfig } from '../../config/theme.config';

// Interfaces
interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}

interface SelectProps extends ComponentProps {
  value: string | number | Array<string | number>;
  options: SelectOption[];
  onChange: (value: string | number | Array<string | number>, option: SelectOption | SelectOption[]) => void;
  placeholder?: string;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  renderOption?: (option: SelectOption) => React.ReactNode;
  error?: ErrorState;
  loading?: boolean;
  virtualScrollThreshold?: number;
  maxHeight?: number;
}

// Styled Components
const StyledSelect = styled(MuiSelect)(({ theme }) => ({
  '& .MuiSelect-select': {
    minHeight: '1.4375em',
    padding: '8px 14px',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.23)' : 'rgba(255, 255, 255, 0.23)',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.primary.main,
    borderWidth: 2,
  },
  '&.Mui-error .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.error.main,
  },
  transition: theme.transitions.create(['border-color', 'box-shadow']),
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  padding: '8px 14px',
  '&.Mui-selected': {
    backgroundColor: theme.palette.mode === 'light' 
      ? 'rgba(0, 0, 0, 0.08)' 
      : 'rgba(255, 255, 255, 0.08)',
  },
  '&.Mui-focusVisible': {
    backgroundColor: theme.palette.mode === 'light'
      ? 'rgba(0, 0, 0, 0.12)'
      : 'rgba(255, 255, 255, 0.12)',
  },
}));

const LoadingWrapper = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px',
});

// Component
export const Select: React.FC<SelectProps> = ({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  multiple = false,
  searchable = false,
  clearable = true,
  renderOption,
  error,
  loading = false,
  disabled = false,
  className,
  virtualScrollThreshold = 100,
  maxHeight = 300,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Virtual scroll configuration
  const rowVirtualizer = useVirtual({
    size: options.length,
    parentRef: listRef,
    estimateSize: useCallback(() => 40, []),
    overscan: 5,
  });

  // Filter options based on search term
  const filteredOptions = useCallback(
    debounce((searchTerm: string) => {
      if (!searchTerm) return options;
      const lowerSearchTerm = searchTerm.toLowerCase();
      return options.filter(option => 
        option.label.toLowerCase().includes(lowerSearchTerm)
      );
    }, 150),
    [options]
  );

  // Handle change with proper typing
  const handleChange = (
    event: React.ChangeEvent<{ value: unknown }>,
    child: React.ReactNode
  ) => {
    const newValue = event.target.value;
    const selectedOptions = multiple
      ? options.filter(opt => (newValue as Array<string | number>).includes(opt.value))
      : options.find(opt => opt.value === newValue);

    onChange(newValue as string | number | Array<string | number>, selectedOptions as SelectOption | SelectOption[]);
  };

  // Handle search input
  const handleSearchInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // Custom render value for multiple select
  const renderValue = (selected: unknown) => {
    if (!selected) return <em>{placeholder}</em>;

    if (multiple) {
      const selectedValues = selected as Array<string | number>;
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {selectedValues.map((value) => {
            const option = options.find(opt => opt.value === value);
            return option ? (
              <Chip
                key={value}
                label={option.label}
                size="small"
                onDelete={clearable ? () => {
                  const newValue = selectedValues.filter(v => v !== value);
                  onChange(newValue, options.filter(opt => newValue.includes(opt.value)));
                } : undefined}
              />
            ) : null;
          })}
        </div>
      );
    }

    const option = options.find(opt => opt.value === selected);
    return option ? option.label : <em>{placeholder}</em>;
  };

  return (
    <StyledSelect
      id={id}
      value={value}
      multiple={multiple}
      onChange={handleChange}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      renderValue={renderValue}
      disabled={disabled}
      error={!!error}
      className={className}
      input={<InputBase />}
      MenuProps={{
        PaperProps: {
          style: { maxHeight },
        },
        variant: 'menu',
      }}
      {...(searchable && {
        onKeyDown: (e) => e.stopPropagation(),
        MenuProps: {
          ...{
            autoFocus: false,
            PaperProps: {
              style: { maxHeight },
            },
          },
        },
      })}
    >
      {searchable && (
        <MenuItem style={{ padding: '8px' }} disabled>
          <input
            style={{
              width: '100%',
              border: 'none',
              padding: '4px',
              outline: 'none',
              background: 'transparent',
            }}
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearchInput}
            onClick={(e) => e.stopPropagation()}
          />
        </MenuItem>
      )}
      
      {loading ? (
        <LoadingWrapper>
          <CircularProgress size={24} />
        </LoadingWrapper>
      ) : (
        <div ref={listRef} style={{ height: Math.min(options.length * 40, maxHeight) }}>
          {rowVirtualizer.virtualItems.map((virtualRow) => {
            const option = options[virtualRow.index];
            return (
              <StyledMenuItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderOption ? renderOption(option) : option.label}
              </StyledMenuItem>
            );
          })}
        </div>
      )}
    </StyledSelect>
  );
};

export default Select;