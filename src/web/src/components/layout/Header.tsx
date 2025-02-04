import React, { useState, useCallback, useEffect, memo } from 'react';
import styled from '@emotion/styled';
import { Badge, AppBar, Toolbar, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon, DarkMode, LightMode, AccountCircle } from '@mui/icons-material';
import { Analytics } from '@analytics/react';

import Icon from '../common/Icon';
import Avatar from '../common/Avatar';
import NotificationBell from '../notifications/NotificationBell';
import { useAuth } from '../../hooks/useAuth';
import ErrorBoundary from '../common/ErrorBoundary';
import { ComponentSize } from '../../types/common.types';

// Styled components with Material Design 3.0 principles
const HeaderContainer = styled(AppBar)<{ isDarkMode: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  max-width: 1440px;
  margin: 0 auto;
  background-color: ${({ theme }) => theme.palette.background.paper};
  color: ${({ theme }) => theme.palette.text.primary};
  box-shadow: ${({ theme }) => theme.shadows[1]};
  z-index: ${({ theme }) => theme.zIndex.appBar};
  transition: all 0.3s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledToolbar = styled(Toolbar)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(0, 2)};

  @media (min-width: 600px) {
    padding: ${({ theme }) => theme.spacing(0, 3)};
  }
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const ActionsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const ThemeToggle = styled(IconButton)`
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }
`;

interface HeaderProps {
  className?: string;
  isMenuOpen?: boolean;
  onMenuToggle?: () => void;
  role?: string;
  'aria-label'?: string;
  isSecureContext?: boolean;
  preferredTheme?: 'light' | 'dark' | 'system';
  testId?: string;
}

const Header: React.FC<HeaderProps> = memo(({
  className,
  isMenuOpen = false,
  onMenuToggle,
  role = 'banner',
  'aria-label': ariaLabel = 'Main header',
  isSecureContext = true,
  preferredTheme = 'system',
  testId = 'header',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';
  const { user, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll behavior
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle theme toggle with analytics
  const handleThemeToggle = useCallback(() => {
    Analytics.track('theme_toggle', {
      from: isDarkMode ? 'dark' : 'light',
      to: isDarkMode ? 'light' : 'dark',
      timestamp: new Date().toISOString(),
    });
  }, [isDarkMode]);

  // Handle menu toggle with analytics
  const handleMenuClick = useCallback(() => {
    Analytics.track('menu_toggle', {
      state: isMenuOpen ? 'close' : 'open',
      viewport: isMobile ? 'mobile' : 'desktop',
      timestamp: new Date().toISOString(),
    });
    onMenuToggle?.();
  }, [isMenuOpen, isMobile, onMenuToggle]);

  // Handle logout with cleanup
  const handleLogout = useCallback(async () => {
    try {
      Analytics.track('user_logout', {
        userId: user?.id,
        timestamp: new Date().toISOString(),
      });
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [user, logout]);

  return (
    <ErrorBoundary>
      <HeaderContainer
        position="fixed"
        className={className}
        isDarkMode={isDarkMode}
        elevation={isScrolled ? 4 : 1}
        role={role}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        <StyledToolbar>
          <LogoContainer>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open menu"
              onClick={handleMenuClick}
              data-testid="menu-button"
            >
              <MenuIcon />
            </IconButton>
            <Icon
              name="task_manager_logo"
              size={ComponentSize.MEDIUM}
              ariaLabel="Task Manager Logo"
            />
          </LogoContainer>

          <ActionsContainer>
            {isSecureContext && (
              <NotificationBell
                ariaLabel="Notifications"
                className="notification-bell"
                testId="notification-bell"
              />
            )}

            <ThemeToggle
              color="inherit"
              onClick={handleThemeToggle}
              aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`}
              data-testid="theme-toggle"
            >
              {isDarkMode ? <LightMode /> : <DarkMode />}
            </ThemeToggle>

            {user ? (
              <Avatar
                src={user.avatarUrl}
                alt={`${user.firstName} ${user.lastName}`}
                name={`${user.firstName} ${user.lastName}`}
                size={ComponentSize.MEDIUM}
                clickable
                onClick={handleLogout}
                ariaLabel="User profile"
                testId="user-avatar"
              />
            ) : (
              <IconButton
                color="inherit"
                aria-label="User account"
                data-testid="user-account"
              >
                <AccountCircle />
              </IconButton>
            )}
          </ActionsContainer>
        </StyledToolbar>
      </HeaderContainer>
    </ErrorBoundary>
  );
});

Header.displayName = 'Header';

export default Header;