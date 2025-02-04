import React, { useMemo } from 'react'; // ^18.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { Avatar as MuiAvatar } from '@mui/material'; // ^5.0.0
import { ComponentSize } from '../../types/common.types';

/**
 * Interface defining the props for the Avatar component
 * Includes accessibility and interaction properties
 */
export interface AvatarProps {
  /** Image source URL for the avatar */
  src?: string;
  /** Alternative text for accessibility */
  alt?: string;
  /** User's full name for generating initials fallback */
  name?: string;
  /** Size variant following design system specifications */
  size?: ComponentSize;
  /** Whether the avatar is clickable */
  clickable?: boolean;
  /** Click handler for interactive avatars */
  onClick?: () => void;
  /** Explicit ARIA label for enhanced accessibility */
  ariaLabel?: string;
  /** Test ID for component testing */
  testId?: string;
  /** Keyboard event handler for accessibility */
  onKeyPress?: (event: React.KeyboardEvent) => void;
  /** Loading state indicator */
  loading?: boolean;
}

/**
 * Size mappings following Material Design 3.0 specifications
 * and golden ratio principles
 */
const sizeMap = {
  [ComponentSize.SMALL]: '32px',
  [ComponentSize.MEDIUM]: '40px',
  [ComponentSize.LARGE]: '48px'
};

/**
 * Styled Avatar component with enhanced accessibility and interaction features
 * Implements Material Design 3.0 principles
 */
const StyledAvatar = styled(MuiAvatar, {
  shouldForwardProp: (prop) => !['clickable', 'size'].includes(prop as string),
})<{ clickable?: boolean; size?: ComponentSize }>(({ theme, clickable, size }) => ({
  width: size ? sizeMap[size] : sizeMap[ComponentSize.MEDIUM],
  height: size ? sizeMap[size] : sizeMap[ComponentSize.MEDIUM],
  borderRadius: '50%',
  cursor: clickable ? 'pointer' : 'default',
  transition: theme.transitions.create(['transform', 'box-shadow'], {
    duration: theme.transitions.duration.shorter,
  }),
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  fontWeight: theme.typography.fontWeightMedium,
  ...(clickable && {
    '&:hover': {
      transform: 'scale(1.1)',
      boxShadow: theme.shadows[2],
    },
    '&:active': {
      transform: 'scale(0.95)',
    },
  }),
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

/**
 * Extracts and formats initials from a user's full name
 * Handles special characters and ensures proper formatting
 * @param name - User's full name
 * @returns Formatted initials (maximum 2 characters)
 */
const getInitials = (name?: string): string => {
  if (!name) return '';

  // Remove special characters and extra spaces
  const cleanName = name.replace(/[^\p{L}\s]/gu, '').trim();
  
  // Split name and extract initials
  const nameParts = cleanName.split(/\s+/);
  const firstInitial = nameParts[0]?.[0] || '';
  const lastInitial = nameParts[nameParts.length - 1]?.[0] || '';

  // Handle single name case
  const initials = nameParts.length === 1 
    ? firstInitial 
    : `${firstInitial}${lastInitial}`;

  return initials.toUpperCase();
};

/**
 * Avatar component displaying user profile images or fallback initials
 * Implements accessibility features and interactive states
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size = ComponentSize.MEDIUM,
  clickable = false,
  onClick,
  ariaLabel,
  testId,
  onKeyPress,
  loading = false,
}) => {
  // Memoize initials calculation
  const initials = useMemo(() => getInitials(name), [name]);

  // Handle keyboard interaction for accessibility
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (clickable && onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
    onKeyPress?.(event);
  };

  return (
    <StyledAvatar
      src={src}
      alt={alt || `Avatar for ${name}`}
      size={size}
      clickable={clickable}
      onClick={clickable ? onClick : undefined}
      onKeyPress={handleKeyPress}
      tabIndex={clickable ? 0 : -1}
      aria-label={ariaLabel || `Avatar for ${name}`}
      data-testid={testId}
      role="img"
      aria-busy={loading}
    >
      {!src && initials}
    </StyledAvatar>
  );
};

export default Avatar;