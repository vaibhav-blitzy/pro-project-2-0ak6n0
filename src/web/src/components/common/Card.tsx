import React, { useCallback, FocusEvent } from 'react'; // ^18.0.0
import styled from '@mui/material/styles/styled'; // ^5.0.0
import useMediaQuery from '@mui/material/useMediaQuery'; // ^5.0.0
import { ComponentProps } from '../../interfaces/common.interface';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for Card component extending base ComponentProps
 */
interface CardProps extends ComponentProps {
  elevation?: 'low' | 'medium' | 'high';
  interactive?: boolean;
  fullWidth?: boolean;
  noPadding?: boolean;
  role?: string;
  'aria-label'?: string;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  tabIndex?: number;
}

/**
 * Returns elevation-specific box shadow styles based on elevation level and theme mode
 */
const getElevationStyles = (elevation: 'low' | 'medium' | 'high', isDarkMode: boolean): string => {
  const shadowOpacity = isDarkMode ? '0.4' : '0.2';
  const shadowColor = isDarkMode ? '0, 0, 0' : '58, 53, 65';
  
  const elevationMap = {
    low: `0 2px 4px rgba(${shadowColor}, ${shadowOpacity})`,
    medium: `0 4px 8px rgba(${shadowColor}, ${shadowOpacity}), 0 1px 2px rgba(${shadowColor}, ${shadowOpacity})`,
    high: `0 8px 16px rgba(${shadowColor}, ${shadowOpacity}), 0 2px 4px rgba(${shadowColor}, ${shadowOpacity})`
  };

  return elevationMap[elevation];
};

/**
 * Styled container component implementing Material Design 3.0 principles
 */
const CardContainer = styled('div')<CardProps>(({ theme, elevation = 'low', interactive, fullWidth, noPadding }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: '12px',
  padding: noPadding ? 0 : theme.spacing(3),
  boxShadow: getElevationStyles(elevation, theme.palette.mode === 'dark'),
  width: fullWidth ? '100%' : 'auto',
  transition: theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
  ...(interactive && {
    cursor: 'pointer',
    '&:hover': {
      boxShadow: getElevationStyles('medium', theme.palette.mode === 'dark'),
      transform: 'translateY(-2px)',
    },
    '&:active': {
      transform: 'translateY(0)',
    },
    '&:focus-visible': {
      outline: `3px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  }),
}));

/**
 * Custom hook managing card interaction states and handlers
 */
const useCardInteraction = (interactive?: boolean) => {
  const handleFocus = useCallback((event: FocusEvent) => {
    if (interactive) {
      event.currentTarget.style.outline = '3px solid var(--md-sys-color-primary-main)';
      event.currentTarget.style.outlineOffset = '2px';
    }
  }, [interactive]);

  const handleBlur = useCallback((event: FocusEvent) => {
    if (interactive) {
      event.currentTarget.style.outline = 'none';
    }
  }, [interactive]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.currentTarget.click();
    }
  }, [interactive]);

  return {
    handleFocus,
    handleBlur,
    handleKeyDown,
  };
};

/**
 * Card component implementing Material Design 3.0 principles with comprehensive accessibility
 */
const Card: React.FC<CardProps> = React.memo(({
  children,
  elevation = 'low',
  interactive = false,
  fullWidth = false,
  noPadding = false,
  className,
  role = 'region',
  'aria-label': ariaLabel,
  onFocus,
  onBlur,
  tabIndex,
  ...props
}) => {
  const { isDarkMode } = useTheme();
  const preferReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { handleFocus, handleBlur, handleKeyDown } = useCardInteraction(interactive);

  return (
    <CardContainer
      elevation={elevation}
      interactive={interactive}
      fullWidth={fullWidth}
      noPadding={noPadding}
      className={className}
      role={role}
      aria-label={ariaLabel}
      tabIndex={interactive ? (tabIndex ?? 0) : undefined}
      onFocus={(e: FocusEvent) => {
        handleFocus(e);
        onFocus?.(e);
      }}
      onBlur={(e: FocusEvent) => {
        handleBlur(e);
        onBlur?.(e);
      }}
      onKeyDown={handleKeyDown}
      style={preferReducedMotion ? { transition: 'none' } : undefined}
      {...props}
    >
      {children}
    </CardContainer>
  );
});

Card.displayName = 'Card';

export default Card;