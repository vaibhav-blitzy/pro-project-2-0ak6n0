import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { performance } from 'web-vitals'; // ^3.0.0
import { 
  AuthState, 
  User, 
  AuthToken, 
  RefreshToken, 
  AuthErrorType,
  SecurityContext,
  AuthRequestMetadata,
  MFAState
} from '../interfaces/auth.interface';

// Initial authentication state with security context
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  loading: false,
  error: null,
  mfaRequired: false,
  sessionExpiresIn: 0,
  isSessionExpired: false,
  securityContext: {
    ipAddress: '',
    userAgent: '',
    lastActivity: 0
  }
};

// Enhanced login credentials interface with security metadata
interface LoginCredentials {
  email: string;
  password: string;
  metadata: AuthRequestMetadata;
}

// Performance monitoring wrapper
const measurePerformance = async (name: string, fn: () => Promise<any>) => {
  const startTime = performance.now();
  try {
    const result = await fn();
    performance.measure(name, { start: startTime, end: performance.now() });
    return result;
  } catch (error) {
    performance.measure(`${name}_error`, { start: startTime, end: performance.now() });
    throw error;
  }
};

// Enhanced login thunk with MFA support and performance monitoring
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ credentials, mfaToken }: { credentials: LoginCredentials, mfaToken?: string }, { rejectWithValue }) => {
    return measurePerformance('login_attempt', async () => {
      try {
        // Validate credentials format and strength
        if (!credentials.email || !credentials.password) {
          throw new Error(AuthErrorType.INVALID_CREDENTIALS);
        }

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MFA-Token': mfaToken || ''
          },
          body: JSON.stringify(credentials)
        });

        const data = await response.json();

        if (!response.ok) {
          return rejectWithValue({
            error: data.error,
            code: response.status
          });
        }

        // Handle MFA challenge
        if (data.mfaRequired && !mfaToken) {
          return rejectWithValue({
            error: AuthErrorType.MFA_REQUIRED,
            mfaDetails: data.mfaDetails
          });
        }

        // Process security headers and store tokens
        const authToken: AuthToken = {
          token: data.token,
          expiresAt: Date.now() + (data.expiresIn * 1000),
          type: 'Bearer'
        };

        const refreshToken: RefreshToken = {
          token: data.refreshToken,
          expiresAt: Date.now() + (data.refreshExpiresIn * 1000),
          issuedAt: Date.now(),
          deviceId: credentials.metadata.deviceId
        };

        return {
          user: data.user,
          token: authToken,
          refreshToken: refreshToken,
          securityContext: {
            ipAddress: credentials.metadata.ipAddress,
            userAgent: credentials.metadata.userAgent,
            lastActivity: Date.now()
          }
        };
      } catch (error) {
        return rejectWithValue({
          error: AuthErrorType.SECURITY_VIOLATION,
          details: error
        });
      }
    });
  }
);

// Enhanced session validation thunk
export const validateSessionThunk = createAsyncThunk(
  'auth/validateSession',
  async (_, { getState, rejectWithValue }) => {
    return measurePerformance('session_validation', async () => {
      const { auth } = getState() as { auth: AuthState };
      
      if (!auth.token || !auth.refreshToken) {
        return rejectWithValue({ error: AuthErrorType.INVALID_TOKEN });
      }

      const tokenExpired = Date.now() >= auth.token.expiresAt;
      const refreshExpired = Date.now() >= auth.refreshToken.expiresAt;

      if (refreshExpired) {
        return rejectWithValue({ error: AuthErrorType.SESSION_EXPIRED });
      }

      if (tokenExpired) {
        // Trigger token refresh
        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${auth.refreshToken.token}`
            }
          });

          if (!response.ok) {
            return rejectWithValue({ error: AuthErrorType.INVALID_TOKEN });
          }

          const data = await response.json();
          return {
            token: {
              token: data.token,
              expiresAt: Date.now() + (data.expiresIn * 1000),
              type: 'Bearer'
            },
            securityContext: {
              ...auth.securityContext,
              lastActivity: Date.now()
            }
          };
        } catch (error) {
          return rejectWithValue({ error: AuthErrorType.SECURITY_VIOLATION });
        }
      }

      return {
        securityContext: {
          ...auth.securityContext,
          lastActivity: Date.now()
        }
      };
    });
  }
);

// Enhanced auth slice with security features
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      Object.assign(state, initialState);
    },
    updateSecurityContext: (state, action: PayloadAction<Partial<SecurityContext>>) => {
      state.securityContext = {
        ...state.securityContext,
        ...action.payload,
        lastActivity: Date.now()
      };
    },
    setMFAStatus: (state, action: PayloadAction<MFAState>) => {
      state.mfaRequired = action.payload.required;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.securityContext = action.payload.securityContext;
        state.sessionExpiresIn = action.payload.token.expiresAt - Date.now();
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as AuthErrorType;
        state.isAuthenticated = false;
      })
      .addCase(validateSessionThunk.fulfilled, (state, action) => {
        if (action.payload.token) {
          state.token = action.payload.token;
          state.sessionExpiresIn = action.payload.token.expiresAt - Date.now();
        }
        state.securityContext = action.payload.securityContext;
        state.isSessionExpired = false;
      })
      .addCase(validateSessionThunk.rejected, (state, action) => {
        state.isSessionExpired = true;
        state.error = action.payload as AuthErrorType;
        if (action.payload.error === AuthErrorType.SESSION_EXPIRED) {
          Object.assign(state, initialState);
        }
      });
  }
});

// Export actions and selectors
export const { logout, updateSecurityContext, setMFAStatus } = authSlice.actions;

// Enhanced selector with security context
export const selectAuthWithSecurity = (state: { auth: AuthState }) => ({
  ...state.auth,
  isSessionValid: !state.auth.isSessionExpired && 
                  state.auth.token && 
                  Date.now() < state.auth.token.expiresAt
});

export default authSlice.reducer;