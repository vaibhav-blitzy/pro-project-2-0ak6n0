import React from 'react'; // ^18.0.0
import styled from '@emotion/styled'; // ^11.11.0
import { ComponentSize, ComponentVariant } from '../../types/common.types';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps {
  /** Button text or child elements */
  children: React.ReactNode;
  /** Button variant following Material Design 3.0 */
  variant?: ComponentVariant;
  /** Button size following design system specifications */
  size?: ComponentSize;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Additional CSS class */
  className?: string;
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
  /** Accessible label */
  ariaLabel?: string;
  /** Test ID for testing */
  testId?: string;
}

const getButtonSize = (size: ComponentSize = ComponentSize.MEDIUM) => {
  const sizes = {
    [ComponentSize.SMALL]: {
      padding: '6px 16px',
      fontSize: '0.875rem',
      height: '32px',
      minWidth: '64px',
    },
    [ComponentSize.MEDIUM]: {
      padding: '8px 24px',
      fontSize: '1rem',
      height: '40px',
      minWidth: '80px',
    },
    [ComponentSize.LARGE]: {
      padding: '10px 32px',
      fontSize: '1.125rem',
      height: '48px',
      minWidth: '96px',
    },
  };
  return sizes[size];
};

const getButtonVariant = (variant: ComponentVariant = ComponentVariant.PRIMARY) => {
  const variants = {
    [ComponentVariant.PRIMARY]: {
      backgroundColor: 'var(--color-primary)',
      color: 'var(--color-on-primary)',
      border: 'none',
      '&:hover': {
        backgroundColor: 'var(--color-primary-dark)',
      },
      '&:active': {
        backgroundColor: 'var(--color-primary-darker)',
      },
    },
    [ComponentVariant.SECONDARY]: {
      backgroundColor: 'var(--color-secondary)',
      color: 'var(--color-on-secondary)',
      border: 'none',
      '&:hover': {
        backgroundColor: 'var(--color-secondary-dark)',
      },
      '&:active': {
        backgroundColor: 'var(--color-secondary-darker)',
      },
    },
    [ComponentVariant.OUTLINE]: {
      backgroundColor: 'transparent',
      color: 'var(--color-primary)',
      border: '2px solid var(--color-primary)',
      '&:hover': {
        backgroundColor: 'var(--color-primary-transparent)',
      },
      '&:active': {
        backgroundColor: 'var(--color-primary-transparent-dark)',
      },
    },
    [ComponentVariant.GHOST]: {
      backgroundColor: 'transparent',
      color: 'var(--color-primary)',
      border: 'none',
      '&:hover': {
        backgroundColor: 'var(--color-primary-transparent)',
      },
      '&:active': {
        backgroundColor: 'var(--color-primary-transparent-dark)',
      },
    },
  };
  return variants[variant];
};

const getElevation = (variant: ComponentVariant = ComponentVariant.PRIMARY, disabled: boolean = false) => {
  if (disabled) return 'none';
  
  const elevations = {
    [ComponentVariant.PRIMARY]: '0 2px 4px rgba(0, 0, 0, 0.1)',
    [ComponentVariant.SECONDARY]: '0 2px 4px rgba(0, 0, 0, 0.1)',
    [ComponentVariant.OUTLINE]: 'none',
    [ComponentVariant.GHOST]: 'none',
  };
  return elevations[variant];
};

const StyledButton = styled.button<{
  variant: ComponentVariant;
  size: ComponentSize;
  disabled?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 4px;
  font-weight: 500;
  letter-spacing: 0.025em;
  transition: all 0.2s ease-in-out;
  cursor: ${props => (props.disabled || props.loading) ? 'not-allowed' : 'pointer'};
  outline: none;
  position: relative;
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  opacity: ${props => (props.disabled || props.loading) ? 0.6 : 1};
  pointer-events: ${props => (props.disabled || props.loading) ? 'none' : 'auto'};
  box-shadow: ${props => getElevation(props.variant, props.disabled)};
  
  ${props => getButtonSize(props.size)}
  ${props => getButtonVariant(props.variant)}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }

  &:hover {
    transform: ${props => (!props.disabled && !props.loading) ? 'translateY(-1px)' : 'none'};
  }

  &:active {
    transform: translateY(0);
  }

  /* Touch target size for mobile */
  @media (max-width: ${768}px) {
    min-height: 48px;
  }
`;

const Button: React.FC<ButtonProps> = React.memo(({
  children,
  variant = ComponentVariant.PRIMARY,
  size = ComponentSize.MEDIUM,
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  className,
  type = 'button',
  ariaLabel,
  testId = 'button',
}) => {
  return (
    <StyledButton
      variant={variant}
      size={size}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      loading={loading}
      onClick={onClick}
      className={className}
      type={type}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      data-testid={testId}
    >
      {loading ? (
        <>
          <LoadingSpinner
            size={size === ComponentSize.SMALL ? ComponentSize.SMALL : ComponentSize.MEDIUM}
            color="currentColor"
          />
          {children}
        </>
      ) : (
        children
      )}
    </StyledButton>
  );
});

Button.displayName = 'Button';

export default Button;