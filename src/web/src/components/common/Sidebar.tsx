import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import styled from '@emotion/styled';
import Icon from './Icon';
import Navigation from '../layout/Navigation';
import useMediaQuery from '../../hooks/useMediaQuery';
import { ComponentSize } from '../../types/common.types';

/**
 * Props interface for the Sidebar component with comprehensive configuration options
 */
interface SidebarProps {
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional children content */
  children?: React.ReactNode;
  /** Disable animations for reduced motion */
  disableAnimation?: boolean;
  /** Custom transition duration in ms */
  transitionDuration?: number;
  /** Callback for collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Disable touch gestures */
  disableGestures?: boolean;
}

/**
 * Styled container implementing F-pattern layout and Material Design principles
 */
const SidebarContainer = styled.aside<{
  isCollapsed: boolean;
  disableAnimation?: boolean;
  isMobile: boolean;
  theme?: any;
}>`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: ${({ isCollapsed }) => (isCollapsed ? '64px' : '256px')};
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-right: 1px solid ${({ theme }) => theme.palette.divider};
  z-index: ${({ theme }) => theme.zIndex.drawer};
  transition: ${({ disableAnimation }) =>
    disableAnimation ? 'none' : 'width 0.3s ease'};
  overflow-x: hidden;
  overflow-y: auto;
  direction: ${({ theme }) => theme.direction};
  
  /* Accessibility enhancements */
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: -1px;
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  /* High contrast mode support */
  @media (forced-colors: active) {
    border-right: 2px solid ButtonText;
  }

  /* Mobile optimizations */
  ${({ isMobile }) =>
    isMobile &&
    `
    transform: translateX(0);
    transition: transform 0.3s ease;
    width: 256px;
    `}
`;

/**
 * Toggle button with accessibility enhancements
 */
const ToggleButton = styled.button<{ isCollapsed: boolean }>`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  padding: 8px;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }
`;

/**
 * Enhanced Sidebar component with comprehensive features
 */
const Sidebar: React.FC<SidebarProps> = memo(({
  defaultCollapsed = false,
  className,
  children,
  disableAnimation = false,
  transitionDuration = 300,
  onCollapsedChange,
  disableGestures = false
}) => {
  // State management
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [touchStartX, setTouchStartX] = useState(0);
  const [isGestureEnabled, setIsGestureEnabled] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Responsive behavior
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Load saved preference on mount
  useEffect(() => {
    if (!isMobile) {
      const savedCollapsed = localStorage.getItem('sidebar-collapsed');
      if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === 'true');
      }
    }
  }, [isMobile]);

  // Toggle handler with animation and persistence
  const handleToggle = useCallback(() => {
    setIsCollapsed(prev => {
      const newState = !prev;
      if (!isMobile) {
        localStorage.setItem('sidebar-collapsed', String(newState));
      }
      onCollapsedChange?.(newState);
      
      // Announce state change to screen readers
      const message = `Sidebar ${newState ? 'collapsed' : 'expanded'}`;
      window.setTimeout(() => {
        document.getElementById('a11y-status')?.setAttribute('aria-label', message);
      }, transitionDuration);
      
      return newState;
    });
  }, [isMobile, onCollapsedChange, transitionDuration]);

  // Touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disableGestures) return;
    setTouchStartX(e.touches[0].clientX);
    setIsGestureEnabled(true);
  }, [disableGestures]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isGestureEnabled) return;
    
    const touchDelta = e.touches[0].clientX - touchStartX;
    const threshold = 50;

    if (Math.abs(touchDelta) > threshold) {
      setIsCollapsed(touchDelta < 0);
      setIsGestureEnabled(false);
    }
  }, [touchStartX, isGestureEnabled]);

  const handleTouchEnd = useCallback(() => {
    setIsGestureEnabled(false);
  }, []);

  return (
    <>
      <SidebarContainer
        ref={sidebarRef}
        className={className}
        isCollapsed={isCollapsed}
        disableAnimation={disableAnimation}
        isMobile={isMobile}
        role="complementary"
        aria-label="Main navigation sidebar"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        tabIndex={0}
      >
        <ToggleButton
          onClick={handleToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          isCollapsed={isCollapsed}
        >
          <Icon
            name={isCollapsed ? 'menu' : 'chevron_left'}
            size={ComponentSize.MEDIUM}
            ariaLabel={isCollapsed ? 'Expand' : 'Collapse'}
          />
        </ToggleButton>

        <Navigation
          defaultCollapsed={isCollapsed}
          onNavigationChange={() => {
            if (isMobile) {
              setIsCollapsed(true);
            }
          }}
        />

        {children}
      </SidebarContainer>
      
      {/* Accessibility status announcer */}
      <div
        id="a11y-status"
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}
      />
    </>
  );
});

// Display name for debugging
Sidebar.displayName = 'Sidebar';

export default Sidebar;