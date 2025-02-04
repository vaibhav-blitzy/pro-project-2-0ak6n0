import React, { useMemo } from 'react';
import { styled } from '@mui/material/styles'; // ^5.0.0
import { useIntl } from 'react-intl'; // ^6.0.0
import Card from '../common/Card';
import Icon from '../common/Icon';
import { ComponentSize } from '../../types/common.types';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Props interface for MetricsCard component with comprehensive type safety
 */
interface MetricsCardProps {
  title: string;
  value: string | number;
  unit: string;
  change: number;
  icon: string;
  className?: string;
  onClick?: () => void;
  isLoading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  tooltipContent?: object;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Styled components for MetricsCard with theme integration
 */
const StyledMetricsCard = styled(Card)<{ interactive?: boolean }>(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  minWidth: '240px',
  transition: theme.transitions.create(['transform', 'box-shadow'], {
    duration: theme.transitions.duration.short,
  }),
  '&:hover': {
    transform: props => props.interactive ? 'translateY(-2px)' : 'none',
  },
}));

const MetricHeader = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
});

const MetricTitle = styled('h3')(({ theme }) => ({
  margin: 0,
  fontSize: '1rem',
  fontWeight: 500,
  color: theme.palette.text.secondary,
}));

const MetricValue = styled('div')(({ theme }) => ({
  fontSize: '2rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'baseline',
  gap: theme.spacing(1),
}));

const MetricUnit = styled('span')(({ theme }) => ({
  fontSize: '1rem',
  color: theme.palette.text.secondary,
  marginLeft: theme.spacing(1),
}));

const MetricChange = styled('div')<{ trend: number }>(({ theme, trend }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  color: trend > 0 ? theme.palette.success.main : 
         trend < 0 ? theme.palette.error.main : 
         theme.palette.text.secondary,
  fontSize: '0.875rem',
  fontWeight: 500,
}));

/**
 * Helper function to determine trend color based on change value
 */
const getTrendColor = (change: number, theme: any): string => {
  if (change > 0) return theme.palette.success.main;
  if (change < 0) return theme.palette.error.main;
  return theme.palette.text.secondary;
};

/**
 * Helper function to format change value with proper sign and localization
 */
const formatChange = (change: number, intl: any): string => {
  const formattedValue = intl.formatNumber(Math.abs(change), {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${change > 0 ? '+' : change < 0 ? '-' : ''}${formattedValue}`;
};

/**
 * MetricsCard component for displaying key performance indicators
 * Implements Material Design principles with comprehensive accessibility
 */
const MetricsCard: React.FC<MetricsCardProps> = React.memo(({
  title,
  value,
  unit,
  change,
  icon,
  className,
  onClick,
  isLoading = false,
  hasError = false,
  errorMessage,
  tooltipContent,
  size = 'medium',
}) => {
  const intl = useIntl();

  // Memoize formatted values for performance
  const formattedValue = useMemo(() => {
    return typeof value === 'number' 
      ? intl.formatNumber(value)
      : value;
  }, [value, intl]);

  const formattedChange = useMemo(() => {
    return formatChange(change, intl);
  }, [change, intl]);

  return (
    <ErrorBoundary
      fallback={
        <StyledMetricsCard elevation="low">
          <MetricHeader>
            <MetricTitle>{title}</MetricTitle>
            <Icon 
              name="error" 
              size={ComponentSize.MEDIUM} 
              color="error"
              ariaLabel="Error loading metric"
            />
          </MetricHeader>
          <div>{errorMessage || 'Failed to load metric'}</div>
        </StyledMetricsCard>
      }
    >
      <StyledMetricsCard
        elevation="low"
        interactive={Boolean(onClick)}
        className={className}
        onClick={onClick}
        role={onClick ? 'button' : 'region'}
        aria-label={`${title} metric card`}
        aria-busy={isLoading}
        tabIndex={onClick ? 0 : undefined}
      >
        <MetricHeader>
          <MetricTitle>{title}</MetricTitle>
          <Icon
            name={icon}
            size={ComponentSize.MEDIUM}
            ariaLabel={`${title} icon`}
          />
        </MetricHeader>

        {isLoading ? (
          <div aria-busy="true">Loading...</div>
        ) : (
          <>
            <MetricValue>
              {formattedValue}
              <MetricUnit>{unit}</MetricUnit>
            </MetricValue>

            <MetricChange trend={change} aria-label={`Change: ${formattedChange}`}>
              <Icon
                name={change > 0 ? 'trending_up' : change < 0 ? 'trending_down' : 'trending_flat'}
                size={ComponentSize.SMALL}
                ariaLabel={change > 0 ? 'Increasing' : change < 0 ? 'Decreasing' : 'No change'}
              />
              {formattedChange}
            </MetricChange>
          </>
        )}
      </StyledMetricsCard>
    </ErrorBoundary>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;