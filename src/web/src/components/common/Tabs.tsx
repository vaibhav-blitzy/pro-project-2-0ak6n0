import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Tab, Tabs as MuiTabs, TabPanel as MuiTabPanel } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { ComponentProps } from '../../interfaces/common.interface';
import useMediaQuery from '../../hooks/useMediaQuery';
import Icon from './Icon';

/**
 * Interface for individual tab configuration with enhanced accessibility
 */
interface TabItem {
  id: string;
  label: string;
  icon?: string;
  content?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  dataTestId?: Record<string, string>;
}

/**
 * Extended props interface with comprehensive accessibility and responsive features
 */
interface TabsProps extends ComponentProps {
  items: TabItem[];
  activeIndex?: number;
  onChange?: (index: number) => void;
  orientation?: 'top' | 'bottom' | 'left' | 'right';
  scrollable?: boolean;
  centered?: boolean;
  variant?: 'standard' | 'fullWidth' | 'scrollable';
  rtl?: boolean;
  ariaLabel?: string;
  analyticsData?: Record<string, unknown>;
}

/**
 * Styled component for enhanced Material Design tabs with semantic tokens
 */
const StyledTabs = styled(MuiTabs, {
  shouldComponentUpdate: (props, nextProps) => props.value !== nextProps.value,
})(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTabs-indicator': {
    backgroundColor: theme.palette.primary.main,
    height: 3,
    transition: theme.transitions.create(['width', 'left'], {
      duration: theme.transitions.duration.standard,
      easing: theme.transitions.easing.easeInOut,
    }),
  },
  '& .MuiTab-root': {
    textTransform: 'none',
    minWidth: 0,
    padding: theme.spacing(2, 3),
    [theme.breakpoints.up('sm')]: {
      minWidth: 120,
    },
    '&:focus-visible': {
      outline: `3px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
    '&.Mui-selected': {
      color: theme.palette.primary.main,
      fontWeight: theme.typography.fontWeightMedium,
    },
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& .MuiTabs-indicator': {
      transition: 'none',
    },
  },
}));

/**
 * Styled component for accessible tab content with semantic padding
 */
const TabPanel = styled(MuiTabPanel)(({ theme }) => ({
  padding: theme.spacing(3),
  '&:focus': {
    outline: 'none',
  },
  '&[aria-hidden="false"]': {
    animation: 'fadeIn 0.3s ease-in-out',
  },
  '@keyframes fadeIn': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

/**
 * Generates accessible and unique IDs for tab elements
 */
const getTabId = (baseId: string, index: number): string => {
  if (!baseId) throw new Error('Base ID is required for accessibility');
  return `${baseId}-tab-${index}`;
};

/**
 * Enhanced Material Design tab navigation with comprehensive accessibility
 * and responsive features
 */
const Tabs: React.FC<TabsProps> = ({
  id,
  items,
  activeIndex: controlledIndex,
  onChange,
  orientation = 'top',
  scrollable = false,
  centered = false,
  variant = 'standard',
  rtl = false,
  ariaLabel,
  analyticsData,
  className,
}) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 600px)');

  // Handle controlled/uncontrolled component pattern
  const activeIndex = controlledIndex ?? internalIndex;

  // Enhanced tab change handler with analytics and error boundary
  const handleTabChange = useCallback((event: React.SyntheticEvent, newIndex: number) => {
    event.preventDefault();

    // Validate index bounds
    if (newIndex < 0 || newIndex >= items.length) {
      console.error('Invalid tab index:', newIndex);
      return;
    }

    // Track analytics if enabled
    if (analyticsData) {
      // Analytics tracking implementation would go here
      console.debug('Tab change analytics:', { newIndex, ...analyticsData });
    }

    // Update state and call onChange handler
    if (onChange) {
      onChange(newIndex);
    } else {
      setInternalIndex(newIndex);
    }
  }, [items.length, onChange, analyticsData]);

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!tabsRef.current) return;

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          event.preventDefault();
          const direction = event.key === 'ArrowLeft' ? -1 : 1;
          const newIndex = (activeIndex + direction + items.length) % items.length;
          handleTabChange(event as unknown as React.SyntheticEvent, newIndex);
          break;
        }
        case 'Home':
          event.preventDefault();
          handleTabChange(event as unknown as React.SyntheticEvent, 0);
          break;
        case 'End':
          event.preventDefault();
          handleTabChange(event as unknown as React.SyntheticEvent, items.length - 1);
          break;
      }
    };

    const tabsElement = tabsRef.current;
    tabsElement?.addEventListener('keydown', handleKeyDown);

    return () => {
      tabsElement?.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, items.length, handleTabChange]);

  return (
    <div
      className={className}
      ref={tabsRef}
      style={{ direction: rtl ? 'rtl' : 'ltr' }}
    >
      <StyledTabs
        value={activeIndex}
        onChange={handleTabChange}
        orientation={isMobile ? 'top' : orientation}
        variant={scrollable || isMobile ? 'scrollable' : variant}
        scrollButtons={scrollable || isMobile ? 'auto' : false}
        centered={!scrollable && !isMobile && centered}
        aria-label={ariaLabel || 'Navigation tabs'}
        allowScrollButtonsMobile
      >
        {items.map((item, index) => (
          <Tab
            key={item.id}
            id={getTabId(id || 'tabs', index)}
            label={item.label}
            icon={item.icon ? <Icon name={item.icon} size="SMALL" /> : undefined}
            disabled={item.disabled}
            aria-label={item.ariaLabel}
            data-testid={item.dataTestId?.tab}
            aria-controls={`${id}-panel-${index}`}
          />
        ))}
      </StyledTabs>
      {items.map((item, index) => (
        <TabPanel
          key={item.id}
          value={activeIndex}
          index={index}
          id={`${id}-panel-${index}`}
          aria-labelledby={getTabId(id || 'tabs', index)}
          data-testid={item.dataTestId?.panel}
          hidden={activeIndex !== index}
        >
          {item.content}
        </TabPanel>
      ))}
    </div>
  );
};

export default Tabs;