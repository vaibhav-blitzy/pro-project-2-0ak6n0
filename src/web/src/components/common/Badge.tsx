import React from 'react'; // ^18.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { Badge as MuiBadge } from '@mui/material'; // ^5.0.0
import { ComponentSize, ComponentVariant } from '../../types/common.types';

/**
 * Interface for Badge component props extending Material-UI Badge props
 * with enhanced accessibility and theme support
 */
interface BadgeProps {
  children?: React.ReactNode;
  content?: string;
  size?: ComponentSize;
  variant?: ComponentVariant;
  color?: string;
  dot?: boolean;
  invisible?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'right';
  };
  theme?: 'light' | 'dark';
}

/**
 * Size configuration mapping for consistent badge dimensions
 */
const sizeConfig = {
  [ComponentSize.SMALL]: {
    dotSize: '6px',
    fontSize: '0.75rem',
    padding: '0 4px',
    minWidth: '16px',
    height: '16px',
  },
  [ComponentSize.MEDIUM]: {
    dotSize: '8px',
    fontSize: '0.875rem',
    padding: '0 6px',
    minWidth: '20px',
    height: '20px',
  },
  [ComponentSize.LARGE]: {
    dotSize: '10px',
    fontSize: '1rem',
    padding: '0 8px',
    minWidth: '24px',
    height: '24px',
  },
};

/**
 * Styled badge component with theme-aware styling
 */
const StyledBadge = styled(MuiBadge, {
  shouldForwardProp: (prop) => 
    !['badgeSize', 'badgeVariant', 'customColor'].includes(prop as string),
})<{
  badgeSize?: ComponentSize;
  badgeVariant?: ComponentVariant;
  customColor?: string;
}>(({ theme, badgeSize = ComponentSize.MEDIUM, badgeVariant = ComponentVariant.PRIMARY, customColor }) => ({
  '& .MuiBadge-badge': {
    ...sizeConfig[badgeSize],
    backgroundColor: customColor || (() => {
      switch (badgeVariant) {
        case ComponentVariant.PRIMARY:
          return theme.palette.primary.main;
        case ComponentVariant.SECONDARY:
          return theme.palette.secondary.main;
        case ComponentVariant.OUTLINE:
          return 'transparent';
        default:
          return theme.palette.primary.main;
      }
    })(),
    color: badgeVariant === ComponentVariant.OUTLINE
      ? theme.palette.text.primary
      : theme.palette.getContrastText(
          customColor || theme.palette.primary.main
        ),
    border: badgeVariant === ComponentVariant.OUTLINE
      ? `1px solid ${theme.palette.divider}`
      : 'none',
    borderRadius: '12px',
    fontWeight: 500,
    textTransform: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: theme.transitions.create(['background-color', 'border-color', 'color']),

    '&.MuiBadge-dot': {
      minWidth: 'auto',
      width: sizeConfig[badgeSize].dotSize,
      height: sizeConfig[badgeSize].dotSize,
      borderRadius: '50%',
      padding: 0,
    },

    // Ensure high contrast for accessibility
    '@media (prefers-contrast: high)': {
      border: `1px solid ${theme.palette.background.paper}`,
    },
  },
}));

/**
 * Enhanced Badge component with theme awareness, accessibility features,
 * and flexible styling options following Material Design 3.0 principles.
 *
 * @param {BadgeProps} props - Component props
 * @returns {JSX.Element} Rendered badge component
 */
const Badge = React.memo<BadgeProps>(({
  children,
  content,
  size = ComponentSize.MEDIUM,
  variant = ComponentVariant.PRIMARY,
  color,
  dot = false,
  invisible = false,
  className,
  style,
  'aria-label': ariaLabel,
  position = { vertical: 'top', horizontal: 'right' },
  theme: badgeTheme,
  ...props
}) => {
  // Ensure proper aria-label for accessibility
  const accessibilityLabel = ariaLabel || (
    dot ? 'Status indicator' : `Badge ${content || ''}`
  );

  return (
    <StyledBadge
      badgeSize={size}
      badgeVariant={variant}
      customColor={color}
      badgeContent={dot ? undefined : content}
      invisible={invisible}
      variant="standard"
      anchorOrigin={position}
      className={className}
      style={style}
      aria-label={accessibilityLabel}
      role="status"
      data-testid="badge-component"
      dot={dot}
      {...props}
    >
      {children}
    </StyledBadge>
  );
});

Badge.displayName = 'Badge';

export default Badge;