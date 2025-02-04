import React from 'react'; // ^18.0.0
import styled from 'styled-components'; // ^6.0.0
import { ComponentSize } from '../../../types/common.types';
import { ANIMATION } from '../../../constants/ui.constants';

/**
 * Props interface for the LoadingSpinner component
 */
interface SpinnerProps {
  /** Size variant of the spinner following design system specifications */
  size?: ComponentSize;
  /** Custom color for the spinner. Defaults to currentColor */
  color?: string;
  /** Thickness of the spinner border in pixels. Defaults to 2px */
  thickness?: number;
  /** Optional className for custom styling */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Test ID for component testing */
  testId?: string;
}

/**
 * Memoized function to determine spinner size in pixels based on ComponentSize
 */
const getSizeValue = React.useCallback((size?: ComponentSize): number => {
  switch (size) {
    case ComponentSize.SMALL:
      return 24;
    case ComponentSize.LARGE:
      return 48;
    case ComponentSize.MEDIUM:
    default:
      return 36;
  }
}, []);

/**
 * Styled container for the spinner with optimized animation performance
 */
const SpinnerContainer = styled.div<{
  size: number;
  color?: string;
  thickness?: number;
}>`
  display: inline-block;
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  border-radius: 50%;
  border-style: solid;
  border-color: transparent;
  border-top-color: ${props => props.color || 'currentColor'};
  border-width: ${props => props.thickness || 2}px;
  animation: spinner-rotate ${ANIMATION.DURATION_MEDIUM}ms ${ANIMATION.EASING_STANDARD} infinite;
  will-change: transform;
  
  /* Accessibility: Respect user's reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    animation-duration: 1500ms;
  }

  /* Define the rotation animation */
  @keyframes spinner-rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

/**
 * LoadingSpinner component provides visual feedback for loading states
 * Implements Material Design principles and WCAG 2.1 Level AA compliance
 */
export const LoadingSpinner: React.FC<SpinnerProps> = React.memo(({
  size = ComponentSize.MEDIUM,
  color,
  thickness,
  className,
  ariaLabel = 'Loading...',
  testId = 'loading-spinner',
}) => {
  const sizeInPixels = getSizeValue(size);

  return (
    <SpinnerContainer
      size={sizeInPixels}
      color={color}
      thickness={thickness}
      className={className}
      role="progressbar"
      aria-label={ariaLabel}
      aria-busy="true"
      data-testid={testId}
    />
  );
});

// Display name for debugging purposes
LoadingSpinner.displayName = 'LoadingSpinner';

// Default export for convenient importing
export default LoadingSpinner;