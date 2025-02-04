/**
 * @fileoverview Navigation Component
 * Enterprise-grade navigation component implementing F-pattern layout with comprehensive
 * security, accessibility, and performance optimizations.
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useMediaQuery, Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Collapse, Tooltip } from '@mui/material';
import { analytics } from '@segment/analytics-next';

import {
  AUTH_ROUTES,
  DASHBOARD_ROUTES,
  TASK_ROUTES,
  PROJECT_ROUTES,
  SETTINGS_ROUTES
} from '../../constants/routes.constants';
import { useAuth } from '../../hooks/useAuth';
import { Theme, ComponentSize } from '../../types/common.types';

// Navigation item interface following F-pattern layout
interface NavigationItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  ariaLabel: string;
  isVisible: boolean;
  children?: NavigationItem[];
}

// Props interface with theme support
interface NavigationProps {
  defaultCollapsed?: boolean;
  onNavigationChange?: (path: string) => void;
  theme?: Theme;
}

// Breakpoint constants for responsive design
const DRAWER_WIDTH = 256;
const MOBILE_BREAKPOINT = '(max-width: 768px)';
const TABLET_BREAKPOINT = '(max-width: 1024px)';

/**
 * Custom hook for managing navigation items with security
 */
const useNavigationItems = () => {
  const { isAuthenticated, hasRole, checkPermission } = useAuth();

  return useMemo(() => {
    if (!isAuthenticated) return [];

    return [
      {
        path: DASHBOARD_ROUTES.HOME,
        label: 'Dashboard',
        icon: 'dashboard',
        roles: ['MEMBER', 'ADMIN'],
        ariaLabel: 'Navigate to Dashboard',
        isVisible: true
      },
      {
        path: TASK_ROUTES.LIST,
        label: 'Tasks',
        icon: 'task',
        roles: ['MEMBER', 'ADMIN'],
        ariaLabel: 'Navigate to Tasks',
        isVisible: hasRole('MEMBER'),
        children: [
          {
            path: TASK_ROUTES.BOARD,
            label: 'Board View',
            icon: 'view_kanban',
            roles: ['MEMBER'],
            ariaLabel: 'Navigate to Task Board',
            isVisible: checkPermission('VIEW_TASK_BOARD')
          },
          {
            path: TASK_ROUTES.CALENDAR,
            label: 'Calendar',
            icon: 'calendar_today',
            roles: ['MEMBER'],
            ariaLabel: 'Navigate to Task Calendar',
            isVisible: checkPermission('VIEW_TASK_CALENDAR')
          }
        ]
      },
      {
        path: PROJECT_ROUTES.LIST,
        label: 'Projects',
        icon: 'folder',
        roles: ['MEMBER', 'ADMIN'],
        ariaLabel: 'Navigate to Projects',
        isVisible: hasRole('MEMBER')
      },
      {
        path: SETTINGS_ROUTES.PROFILE,
        label: 'Settings',
        icon: 'settings',
        roles: ['MEMBER', 'ADMIN'],
        ariaLabel: 'Navigate to Settings',
        isVisible: true
      }
    ].filter(item => item.isVisible && item.roles.some(role => hasRole(role)));
  }, [isAuthenticated, hasRole, checkPermission]);
};

/**
 * Custom hook for responsive navigation behavior
 */
const useResponsiveNavigation = (props: NavigationProps) => {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const isTablet = useMediaQuery(TABLET_BREAKPOINT);
  const [isCollapsed, setIsCollapsed] = useState(props.defaultCollapsed || false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true);
      setMobileOpen(false);
    }
  }, [isMobile]);

  const handleDrawerToggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  }, [isMobile, mobileOpen, isCollapsed]);

  return {
    isMobile,
    isTablet,
    isCollapsed,
    mobileOpen,
    handleDrawerToggle
  };
};

/**
 * Enterprise-grade Navigation component with comprehensive features
 */
const Navigation: React.FC<NavigationProps> = memo((props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationItems = useNavigationItems();
  const { isMobile, isCollapsed, mobileOpen, handleDrawerToggle } = useResponsiveNavigation(props);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Performance optimization for navigation item rendering
  const handleNavigation = useCallback((item: NavigationItem) => {
    analytics.track('Navigation Click', {
      path: item.path,
      label: item.label,
      timestamp: new Date().toISOString()
    });

    if (props.onNavigationChange) {
      props.onNavigationChange(item.path);
    }

    navigate(item.path);
  }, [navigate, props.onNavigationChange]);

  // Accessibility-enhanced navigation item renderer
  const renderNavigationItem = useCallback((item: NavigationItem, depth = 0) => {
    const isSelected = location.pathname === item.path;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.path);

    return (
      <React.Fragment key={item.path}>
        <Tooltip title={isCollapsed ? item.label : ''} placement="right">
          <ListItem
            button
            onClick={() => {
              if (hasChildren) {
                setExpandedItems(prev =>
                  isExpanded
                    ? prev.filter(path => path !== item.path)
                    : [...prev, item.path]
                );
              } else {
                handleNavigation(item);
              }
            }}
            selected={isSelected}
            sx={{ pl: depth * 2 }}
            aria-label={item.ariaLabel}
            aria-expanded={hasChildren ? isExpanded : undefined}
            role="menuitem"
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              sx={{
                opacity: isCollapsed ? 0 : 1,
                transition: 'opacity 0.2s'
              }}
            />
            {hasChildren && !isCollapsed && (
              <IconButton
                size="small"
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
              >
                {isExpanded ? 'expand_less' : 'expand_more'}
              </IconButton>
            )}
          </ListItem>
        </Tooltip>

        {hasChildren && (
          <Collapse in={isExpanded && !isCollapsed} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderNavigationItem(child, depth + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  }, [location.pathname, isCollapsed, expandedItems, handleNavigation]);

  const drawerContent = useMemo(() => (
    <List
      component="nav"
      aria-label="Main Navigation"
      sx={{
        width: isCollapsed ? 72 : DRAWER_WIDTH,
        transition: 'width 0.2s',
        overflowX: 'hidden'
      }}
    >
      {navigationItems.map(item => renderNavigationItem(item))}
    </List>
  ), [navigationItems, isCollapsed, renderNavigationItem]);

  return (
    <>
      {/* Mobile navigation drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          anchor="left"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box'
            }
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Desktop navigation drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          anchor="left"
          open={!isCollapsed}
          sx={{
            '& .MuiDrawer-paper': {
              width: isCollapsed ? 72 : DRAWER_WIDTH,
              transition: 'width 0.2s',
              overflowX: 'hidden'
            }
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Toggle button for mobile */}
      {isMobile && (
        <IconButton
          color="inherit"
          aria-label="Toggle navigation menu"
          onClick={handleDrawerToggle}
          edge="start"
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          menu
        </IconButton>
      )}
    </>
  );
});

Navigation.displayName = 'Navigation';

export default Navigation;