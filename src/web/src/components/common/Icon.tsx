import React, { useMemo, memo } from 'react';
import { Icon as MuiIcon } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { ComponentSize } from '../../types/common.types';

/**
 * Interface defining the props for the Icon component
 * Provides comprehensive type safety and documentation
 */
interface IconProps {
  /** Material icon name to be rendered */
  name: string;
  /** Size variant following design system specifications */
  size: ComponentSize;
  /** Optional color override - defaults to current theme color */
  color?: string;
  /** Optional spinning animation flag */
  spin?: boolean;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** Optional click handler for interactive icons */
  onClick?: () => void;
  /** Loading state indicator */
  loading?: boolean;
  /** Test ID for automated testing */
  testId?: string;
}

/**
 * Converts ComponentSize enum to pixel values with responsive scaling
 * @param size - ComponentSize enum value
 * @returns number - Calculated pixel size
 */
const getIconSize = (size: ComponentSize): number => {
  switch (size) {
    case ComponentSize.SMALL:
      return 16; // Minimum accessible touch target
    case ComponentSize.MEDIUM:
      return 24; // Standard Material Design icon size
    case ComponentSize.LARGE:
      return 32; // Enhanced visibility size
    default:
      return 24; // Safe fallback to medium size
  }
};

/**
 * Styled component for the icon with comprehensive theme integration
 * Implements hardware-accelerated animations and accessibility features
 */
const StyledIcon = styled(MuiIcon, {
  shouldComponentUpdate: (props, nextProps) => props.className !== nextProps.className,
})<{ $size: number; $spin?: boolean; $loading?: boolean }>(
  ({ theme, $size, $spin, $loading }) => ({
    fontSize: $size,
    color: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: theme.transitions.create(['color', 'transform'], {
      duration: theme.transitions.duration.shorter,
      easing: theme.transitions.easing.easeInOut,
    }),
    cursor: $loading ? 'wait' : 'inherit',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
    ...$spin && {
      animation: 'spin 1s linear infinite',
      '@keyframes spin': {
        from: { transform: 'rotate(0deg)' },
        to: { transform: 'rotate(360deg)' },
      },
      willChange: 'transform',
      transformOrigin: 'center',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    '@media (forced-colors: active)': {
      forcedColorAdjust: 'auto',
    },
  })
);

/**
 * Enhanced Material Design icon component with advanced features
 * Implements accessibility, theme awareness, and performance optimizations
 */
const Icon: React.FC<IconProps> = memo(({
  name,
  size,
  color,
  spin = false,
  className,
  ariaLabel,
  onClick,
  loading = false,
  testId,
}) => {
  // Memoize the calculated size for performance
  const iconSize = useMemo(() => getIconSize(size), [size]);

  return (
    <StyledIcon
      $size={iconSize}
      $spin={spin}
      $loading={loading}
      className={className}
      style={{ color: color }}
      aria-label={ariaLabel || name}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyPress={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      data-testid={testId}
      aria-busy={loading}
      aria-hidden={!ariaLabel}
    >
      {name}
    </StyledIcon>
  );
});

// Display name for debugging
Icon.displayName = 'Icon';

// Default export for the enhanced icon component
export default Icon;