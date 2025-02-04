import React, { useCallback, useState, useEffect } from 'react';
import { Switch, Typography, FormControlLabel, Slider, Select, MenuItem, TextField } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useNotifications } from '../../hooks/useNotifications';
import Card from '../../components/common/Card';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import styled from '@emotion/styled';

// Styled components for layout and organization
const SettingsContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 24px;
`;

const SettingSection = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
`;

// Interface for user preferences
interface UserPreferences {
  theme: {
    mode: 'light' | 'dark' | 'system';
    colorMode: 'light' | 'dark';
    contrast: 'normal' | 'high';
    fontSize: number;
    fontFamily: string;
    motionReduced: boolean;
  };
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
    quiet_hours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  accessibility: {
    screenReader: boolean;
    keyboardNavigation: boolean;
    animationReduced: boolean;
    contrastMode: 'normal' | 'high' | 'custom';
    customColors: Record<string, string>;
  };
  privacy: {
    dataCollection: boolean;
    activityTracking: boolean;
    cookiePreferences: Record<string, boolean>;
  };
  language: string;
  timezone: string;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme, isDarkMode, error: themeError } = useTheme();
  const { updatePreferences } = useNotifications();
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: {
      mode: 'system',
      colorMode: 'light',
      contrast: 'normal',
      fontSize: 16,
      fontFamily: 'Inter',
      motionReduced: false
    },
    notifications: {
      email: true,
      push: true,
      desktop: true,
      frequency: 'immediate',
      quiet_hours: {
        enabled: false,
        start: '22:00',
        end: '07:00'
      }
    },
    accessibility: {
      screenReader: false,
      keyboardNavigation: true,
      animationReduced: false,
      contrastMode: 'normal',
      customColors: {}
    },
    privacy: {
      dataCollection: true,
      activityTracking: true,
      cookiePreferences: {
        necessary: true,
        functional: true,
        analytics: true,
        marketing: false
      }
    },
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  // Load saved preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedPreferences = localStorage.getItem('userPreferences');
        if (savedPreferences) {
          setPreferences(JSON.parse(savedPreferences));
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  // Handle theme changes with system sync
  const handleThemeChange = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    setPreferences(prev => ({
      ...prev,
      theme: {
        ...prev.theme,
        mode: newTheme
      }
    }));
  }, [setTheme]);

  // Handle notification preference changes
  const handleNotificationChange = useCallback(async (
    key: keyof typeof preferences.notifications,
    value: boolean | string
  ) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
    await updatePreferences({
      ...preferences.notifications,
      [key]: value
    });
  }, [preferences.notifications, updatePreferences]);

  // Handle accessibility preference changes
  const handleAccessibilityChange = useCallback((
    key: keyof typeof preferences.accessibility,
    value: boolean | string
  ) => {
    setPreferences(prev => ({
      ...prev,
      accessibility: {
        ...prev.accessibility,
        [key]: value
      }
    }));
  }, []);

  // Save preferences when they change
  useEffect(() => {
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
  }, [preferences]);

  return (
    <ErrorBoundary>
      <SettingsContainer>
        {/* Theme Settings */}
        <SettingSection elevation="low">
          <Typography variant="h5">Theme Settings</Typography>
          <SettingRow>
            <Typography>Theme Mode</Typography>
            <Select
              value={preferences.theme.mode}
              onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark' | 'system')}
              aria-label="Theme mode selection"
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </SettingRow>
          <SettingRow>
            <Typography>High Contrast</Typography>
            <Switch
              checked={preferences.theme.contrast === 'high'}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                theme: { ...prev.theme, contrast: e.target.checked ? 'high' : 'normal' }
              }))}
              aria-label="High contrast mode"
            />
          </SettingRow>
          <SettingRow>
            <Typography>Font Size</Typography>
            <Slider
              value={preferences.theme.fontSize}
              min={12}
              max={24}
              step={1}
              onChange={(_, value) => setPreferences(prev => ({
                ...prev,
                theme: { ...prev.theme, fontSize: value as number }
              }))}
              aria-label="Font size adjustment"
            />
          </SettingRow>
        </SettingSection>

        {/* Notification Settings */}
        <SettingSection elevation="low">
          <Typography variant="h5">Notification Preferences</Typography>
          <SettingRow>
            <Typography>Email Notifications</Typography>
            <Switch
              checked={preferences.notifications.email}
              onChange={(e) => handleNotificationChange('email', e.target.checked)}
              aria-label="Email notifications toggle"
            />
          </SettingRow>
          <SettingRow>
            <Typography>Push Notifications</Typography>
            <Switch
              checked={preferences.notifications.push}
              onChange={(e) => handleNotificationChange('push', e.target.checked)}
              aria-label="Push notifications toggle"
            />
          </SettingRow>
          <SettingRow>
            <Typography>Notification Frequency</Typography>
            <Select
              value={preferences.notifications.frequency}
              onChange={(e) => handleNotificationChange('frequency', e.target.value)}
              aria-label="Notification frequency selection"
            >
              <MenuItem value="immediate">Immediate</MenuItem>
              <MenuItem value="daily">Daily Digest</MenuItem>
              <MenuItem value="weekly">Weekly Digest</MenuItem>
            </Select>
          </SettingRow>
        </SettingSection>

        {/* Accessibility Settings */}
        <SettingSection elevation="low">
          <Typography variant="h5">Accessibility</Typography>
          <SettingRow>
            <Typography>Screen Reader Optimization</Typography>
            <Switch
              checked={preferences.accessibility.screenReader}
              onChange={(e) => handleAccessibilityChange('screenReader', e.target.checked)}
              aria-label="Screen reader optimization toggle"
            />
          </SettingRow>
          <SettingRow>
            <Typography>Reduce Motion</Typography>
            <Switch
              checked={preferences.accessibility.animationReduced}
              onChange={(e) => handleAccessibilityChange('animationReduced', e.target.checked)}
              aria-label="Reduce motion toggle"
            />
          </SettingRow>
        </SettingSection>

        {/* Privacy Settings */}
        <SettingSection elevation="low">
          <Typography variant="h5">Privacy</Typography>
          <SettingRow>
            <Typography>Data Collection</Typography>
            <Switch
              checked={preferences.privacy.dataCollection}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                privacy: { ...prev.privacy, dataCollection: e.target.checked }
              }))}
              aria-label="Data collection toggle"
            />
          </SettingRow>
          <SettingRow>
            <Typography>Activity Tracking</Typography>
            <Switch
              checked={preferences.privacy.activityTracking}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                privacy: { ...prev.privacy, activityTracking: e.target.checked }
              }))}
              aria-label="Activity tracking toggle"
            />
          </SettingRow>
        </SettingSection>
      </SettingsContainer>
    </ErrorBoundary>
  );
};

export default Settings;