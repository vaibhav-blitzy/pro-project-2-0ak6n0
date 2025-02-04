import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { Theme } from '../config/theme.config';
import { UIState } from '../types/store.types';

/**
 * Interface for enhanced toast notifications with priority and grouping
 */
interface EnhancedToastState {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
  priority: 'low' | 'medium' | 'high';
  action?: {
    label: string;
    handler: () => void;
  };
  group?: string;
}

/**
 * Interface for performance monitoring metrics
 */
interface PerformanceMetrics {
  pageLoadTime: number; // in milliseconds
  apiResponseTime: number; // in milliseconds
  lastUpdated: number; // timestamp
}

/**
 * Initial state for UI slice with enhanced features
 */
const initialState: UIState = {
  theme: 'system',
  isSidebarOpen: true,
  isMobileView: window.innerWidth < 768,
  performanceMetrics: {
    pageLoadTime: 0,
    apiResponseTime: 0,
    lastUpdated: Date.now(),
  },
  toasts: [],
};

/**
 * Enhanced UI slice with performance monitoring and advanced toast management
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
      localStorage.setItem('theme-preference', action.payload);
      
      if (action.payload === 'system') {
        const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', systemPreference);
      } else {
        document.documentElement.setAttribute('data-theme', action.payload);
      }
    },

    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },

    setMobileView: (state, action: PayloadAction<boolean>) => {
      state.isMobileView = action.payload;
      if (action.payload) {
        state.isSidebarOpen = false;
      }
    },

    updatePerformanceMetrics: (state, action: PayloadAction<Partial<PerformanceMetrics>>) => {
      state.performanceMetrics = {
        ...state.performanceMetrics,
        ...action.payload,
        lastUpdated: Date.now(),
      };

      // Log performance issues if thresholds are exceeded
      if (action.payload.pageLoadTime && action.payload.pageLoadTime > 3000) {
        console.warn('Page load time exceeds threshold:', action.payload.pageLoadTime);
      }
      if (action.payload.apiResponseTime && action.payload.apiResponseTime > 500) {
        console.warn('API response time exceeds threshold:', action.payload.apiResponseTime);
      }
    },

    addEnhancedToast: (state, action: PayloadAction<EnhancedToastState>) => {
      const newToast = {
        ...action.payload,
        id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      // Group similar toasts if specified
      if (newToast.group) {
        const existingGroupToast = state.toasts.find(
          toast => toast.group === newToast.group
        );
        if (existingGroupToast) {
          state.toasts = state.toasts.filter(
            toast => toast.id !== existingGroupToast.id
          );
        }
      }

      // Manage toasts based on priority
      if (newToast.priority === 'high') {
        state.toasts = [newToast, ...state.toasts];
      } else {
        state.toasts.push(newToast);
      }

      // Limit maximum number of toasts
      if (state.toasts.length > 5) {
        state.toasts = state.toasts.filter(
          toast => toast.priority === 'high' || toast.id === newToast.id
        );
      }
    },

    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(toast => toast.id !== action.payload);
    },

    clearToasts: (state) => {
      state.toasts = state.toasts.filter(toast => toast.priority === 'high');
    },
  },
});

// Export actions and reducer
export const {
  setTheme,
  toggleSidebar,
  setMobileView,
  updatePerformanceMetrics,
  addEnhancedToast,
  removeToast,
  clearToasts,
} = uiSlice.actions;

export default uiSlice.reducer;

// Selector for theme preference
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;

// Selector for performance metrics
export const selectPerformanceMetrics = (state: { ui: UIState }) => state.ui.performanceMetrics;

// Selector for mobile view status
export const selectIsMobileView = (state: { ui: UIState }) => state.ui.isMobileView;

// Selector for sidebar status
export const selectIsSidebarOpen = (state: { ui: UIState }) => state.ui.isSidebarOpen;

// Selector for active toasts
export const selectToasts = (state: { ui: UIState }) => state.ui.toasts;