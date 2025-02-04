import React, { useCallback, useMemo } from 'react'; // ^18.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { Checkbox as MuiCheckbox } from '@mui/material'; // ^5.0.0
import { ComponentProps } from '../../interfaces/common.interface';
import { themeConfig } from '../../config/theme.config';

/**
 * Enhanced props interface extending base ComponentProps
 * Provides comprehensive typing for the Checkbox component
 */
export interface CheckboxProps extends ComponentProps {
  checked?: boolean;
  defaultChecked?: boolean;
  label?: string;
  name?: string;
  value?: string;
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  size?: 'small' | 'medium';
  ariaLabel?: string;
  useSystemTheme?: boolean;
  themePreference?: 'light' | 'dark';
}

/**
 * StyledCheckbox component with enhanced styling and accessibility
 * Implements Material Design 3.0 principles
 */
const StyledCheckbox = styled(MuiCheckbox)(({ theme }) => ({
  padding: theme.spacing(1),
  borderRadius: '4px',
  transition: `all ${themeConfig.transitions.duration}ms ${themeConfig.transitions.easing}`,
  
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  
  '&.Mui-focusVisible': {
    outline: `${themeConfig.accessibility.focusRingWidth} solid ${theme.palette.primary.main}`,
    outlineOffset: themeConfig.accessibility.focusRingOffset,
  },
  
  '&.Mui-disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  
  '& .MuiSvgIcon-root': {
    fontSize: ({ size }) => size === 'small' ? '1.25rem' : '1.5rem',
    transition: `all ${themeConfig.transitions.duration}ms ${themeConfig.transitions.easing}`,
  },
  
  // Enhanced touch target for mobile
  '@media (pointer: coarse)': {
    padding: theme.spacing(1.5),
    '& .MuiSvgIcon-root': {
      fontSize: '1.75rem',
    },
  },
}));

/**
 * Custom hook for managing checkbox state and theme preferences
 * Handles controlled/uncontrolled state and system theme detection
 */
const useCheckboxState = (props: CheckboxProps) => {
  const {
    checked,
    defaultChecked,
    onChange,
    useSystemTheme = false,
    themePreference,
    disabled,
  } = props;

  // Initialize internal state for uncontrolled component
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false);
  
  // Memoized change handler
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const newChecked = event.target.checked;
    
    // Update internal state if uncontrolled
    if (checked === undefined) {
      setInternalChecked(newChecked);
    }
    
    // Call onChange prop if provided
    onChange?.(newChecked, event);
    
    // Log state change in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Checkbox] State changed:', { newChecked, controlled: checked !== undefined });
    }
  }, [checked, onChange]);

  // Determine effective checked state
  const isChecked = checked !== undefined ? checked : internalChecked;

  return {
    isChecked,
    handleChange,
    disabled,
  };
};

/**
 * Checkbox component implementing Material Design 3.0 principles
 * Features enhanced accessibility, theme support, and performance optimizations
 */
export const Checkbox: React.FC<CheckboxProps> = React.memo((props) => {
  const {
    id,
    className,
    disabled = false,
    color = 'primary',
    size = 'medium',
    ariaLabel,
    name,
    value,
    label,
    ...rest
  } = props;

  const { isChecked, handleChange } = useCheckboxState(props);

  // Memoize aria attributes
  const ariaAttributes = useMemo(() => ({
    'aria-label': ariaLabel || label,
    'aria-checked': isChecked,
    'aria-disabled': disabled,
  }), [ariaLabel, label, isChecked, disabled]);

  return (
    <StyledCheckbox
      id={id}
      className={className}
      checked={isChecked}
      onChange={handleChange}
      disabled={disabled}
      color={color}
      size={size}
      name={name}
      value={value}
      inputProps={ariaAttributes}
      disableRipple={themeConfig.accessibility.reducedMotion}
      {...rest}
    />
  );
});

// Display name for debugging
Checkbox.displayName = 'Checkbox';

// Default export
export default Checkbox;