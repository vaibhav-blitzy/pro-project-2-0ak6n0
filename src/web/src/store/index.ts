/**
 * @fileoverview Root Redux store configuration with comprehensive middleware setup,
 * real-time updates support, and performance optimizations.
 * @version 1.0.0
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit'; // ^2.0.0
import { performance } from 'web-vitals';

// Import reducers from feature slices
import { reducer as authReducer } from './auth.slice';
import { reducer as notificationsReducer } from './notifications.slice';
import { reducer as tasksReducer } from './tasks.slice';
import { reducer as projectsReducer } from './projects.slice';
import { reducer as uiReducer } from './ui.slice';

// Combine all reducers with type safety
const rootReducer = combineReducers({
  auth: authReducer,
  notifications: notificationsReducer,
  tasks: tasksReducer,
  projects: projectsReducer,
  ui: uiReducer
});

/**
 * Configures and creates the Redux store with comprehensive middleware setup
 * Implements performance monitoring, development tools, and real-time updates
 */
const setupStore = () => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // Configure middleware with performance optimizations
        serializableCheck: {
          // Ignore specific action types and paths for WebSocket messages
          ignoredActions: ['notifications/handleWebSocketMessage'],
          ignoredPaths: ['notifications.socket']
        },
        // Enable immutability checks in development
        immutableCheck: process.env.NODE_ENV === 'development',
        // Thunk middleware configuration
        thunk: {
          extraArgument: {
            api: {
              baseURL: process.env.VITE_API_URL || '/api'
            }
          }
        }
      }),
    devTools: {
      // Enhanced DevTools configuration
      name: 'Task Management System',
      trace: true,
      traceLimit: 25,
      // Enable detailed action/state logging in development
      actionsDenylist: process.env.NODE_ENV === 'production' ? ['@redux-devtools'] : []
    },
    // Enable hot module replacement in development
    enhancers: process.env.NODE_ENV === 'development' 
      ? [(window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__()]
      : []
  });

  // Performance monitoring
  if (process.env.NODE_ENV === 'development') {
    store.subscribe(() => {
      performance.mark('stateUpdate:start');
      performance.measure('stateUpdate', 'stateUpdate:start');
    });
  }

  // Enable hot module replacement for reducers
  if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept([
      './auth.slice',
      './notifications.slice',
      './tasks.slice',
      './projects.slice',
      './ui.slice'
    ], () => {
      store.replaceReducer(rootReducer);
    });
  }

  return store;
};

// Create the store instance
export const store = setupStore();

// Export type definitions for TypeScript support
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export store instance as default
export default store;