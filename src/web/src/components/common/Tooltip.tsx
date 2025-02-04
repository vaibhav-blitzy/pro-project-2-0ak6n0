import React, { useCallback, useEffect, useRef, useState, memo } from 'react'; // ^18.0.0
import styled from '@mui/material/styles/styled'; // ^5.0.0
import { ComponentProps } from '../../interfaces/common.interface';
import { themeConfig } from '../../config/theme.config';

// Interface extending base component props
interface TooltipProps extends ComponentProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  disabled?: boolean;
  interactive?: boolean;
  theme?: 'light' | 'dark';
  ariaLabel?: string;
}

// Styled tooltip container with theme-aware styling
const TooltipContainer = styled('div')<{ $theme: 'light' | 'dark' }>(({ theme, $theme }) => ({
  position: 'fixed',
  zIndex: themeConfig.zIndex.tooltip,
  padding: '8px 12px',
  borderRadius: '4px',
  fontSize: '0.875rem',
  lineHeight: '1.4',
  maxWidth: '300px',
  wordWrap: 'break-word',
  backgroundColor: $theme === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
  color: $theme === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)',
  boxShadow: theme.shadows[2],
  transition: `opacity ${themeConfig.transitions.duration}ms ${themeConfig.transitions.easing}`,
  pointerEvents: 'none',
}));

// Interactive tooltip wrapper for touch devices
const InteractiveWrapper = styled('div')({
  position: 'relative',
  display: 'inline-block',
});

const Tooltip = memo(({
  children,
  content,
  position = 'top',
  delay = 200,
  disabled = false,
  interactive = false,
  theme: tooltipTheme = 'dark',
  ariaLabel,
  id,
  className,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coordinates, setCoordinates] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const observerRef = useRef<IntersectionObserver>();

  // Calculate tooltip position
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const spacing = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - spacing;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + spacing;
        break;
    }

    // Viewport boundary checks
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    if (left < 0) left = spacing;
    if (left + tooltipRect.width > viewport.width) {
      left = viewport.width - tooltipRect.width - spacing;
    }
    if (top < 0) top = spacing;
    if (top + tooltipRect.height > viewport.height) {
      top = viewport.height - tooltipRect.height - spacing;
    }

    setCoordinates({ top, left });
  }, [position]);

  // Handle mouse enter
  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      requestAnimationFrame(calculatePosition);
    }, delay);
  }, [calculatePosition, delay, disabled]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isVisible) return;

    if (event.key === 'Escape') {
      setIsVisible(false);
    }
  }, [isVisible]);

  // Set up intersection observer
  useEffect(() => {
    if (!triggerRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && isVisible) {
          setIsVisible(false);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(triggerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isVisible]);

  // Set up keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <InteractiveWrapper
      ref={triggerRef}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      style={{ pointerEvents: interactive ? 'auto' : undefined }}
    >
      <div
        id={id}
        role="tooltip"
        aria-label={ariaLabel}
        aria-describedby={`tooltip-${id}`}
      >
        {children}
      </div>
      {isVisible && (
        <TooltipContainer
          ref={tooltipRef}
          id={`tooltip-${id}`}
          role="tooltip"
          $theme={tooltipTheme}
          style={{
            top: coordinates.top,
            left: coordinates.left,
            opacity: isVisible ? 1 : 0,
            pointerEvents: interactive ? 'auto' : 'none',
          }}
        >
          {content}
        </TooltipContainer>
      )}
    </InteractiveWrapper>
  );
});

Tooltip.displayName = 'Tooltip';

export { Tooltip };