import styled from '@emotion/styled'; // ^11.0.0
import { LinearProgress } from '@mui/material'; // ^5.0.0
import { lightTheme } from '../../config/theme.config';
import { ANIMATION } from '../../constants/ui.constants';

// Props interface with comprehensive customization options
interface ProgressBarProps {
  value: number;
  min?: number;
  max?: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
  animate?: boolean;
  className?: string;
  ariaLabel?: string;
  useGradient?: boolean;
  showBuffer?: boolean;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  customStyles?: React.CSSProperties;
}

// Styled components with theme integration
const StyledProgressContainer = styled.div<{ labelPosition?: string }>`
  display: flex;
  flex-direction: ${({ labelPosition }) =>
    labelPosition === 'left' || labelPosition === 'right' ? 'row' : 'column'};
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  width: 100%;
`;

const StyledProgressBar = styled(LinearProgress)<{
  $height?: number;
  $useGradient?: boolean;
  $animate?: boolean;
}>`
  width: 100%;
  height: ${({ $height }) => $height}px;
  border-radius: ${({ $height }) => $height! / 2}px;
  background-color: ${({ theme }) => theme.palette.grey[200]};
  
  .MuiLinearProgress-bar {
    background-color: ${({ color, theme }) => color || theme.palette.primary.main};
    transition: transform ${({ $animate }) =>
      $animate ? ANIMATION.DURATION_MEDIUM : 0}ms ${ANIMATION.EASING_STANDARD};
    ${({ $useGradient, theme }) =>
      $useGradient &&
      `background: linear-gradient(90deg, 
        ${theme.palette.primary.main} 0%, 
        ${theme.palette.primary.light} 50%, 
        ${theme.palette.primary.main} 100%
      );`}
  }
  
  .MuiLinearProgress-dashed {
    background-color: ${({ theme }) => theme.palette.grey[100]};
  }
`;

const StyledLabel = styled.span<{ labelPosition?: string }>`
  color: ${({ theme }) => theme.palette.text.secondary};
  font-size: 0.875rem;
  font-weight: 500;
  order: ${({ labelPosition }) => (labelPosition === 'top' || labelPosition === 'left' ? -1 : 1)};
`;

// Utility function to calculate progress percentage
const calculateProgress = (value: number, min: number = 0, max: number = 100): number => {
  // Validate input parameters
  if (min >= max) {
    console.error('Min value must be less than max value');
    return 0;
  }

  // Handle edge cases
  if (value <= min) return 0;
  if (value >= max) return 100;

  // Calculate percentage with precision rounding
  const percentage = ((value - min) / (max - min)) * 100;
  return Math.round(percentage * 100) / 100;
};

/**
 * ProgressBar component with accessibility and animation features
 * Implements Material Design 3.0 specifications and WCAG 2.1 Level AA compliance
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  min = 0,
  max = 100,
  color = lightTheme.palette.primary.main,
  height = 4,
  showLabel = true,
  animate = true,
  className,
  ariaLabel,
  useGradient = false,
  showBuffer = false,
  labelPosition = 'right',
  customStyles,
}) => {
  const progress = calculateProgress(value, min, max);
  
  return (
    <StyledProgressContainer
      className={className}
      labelPosition={labelPosition}
      style={customStyles}
    >
      {showLabel && (
        <StyledLabel labelPosition={labelPosition}>
          {`${progress}%`}
        </StyledLabel>
      )}
      <StyledProgressBar
        variant={showBuffer ? 'buffer' : 'determinate'}
        value={progress}
        $height={height}
        $useGradient={useGradient}
        $animate={animate}
        color={color}
        role="progressbar"
        aria-label={ariaLabel || 'Progress indicator'}
        aria-valuenow={progress}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${progress}% complete`}
      />
    </StyledProgressContainer>
  );
};

export default ProgressBar;