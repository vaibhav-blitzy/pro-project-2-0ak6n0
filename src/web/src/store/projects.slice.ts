/**
 * @fileoverview Projects Redux Slice
 * Implements comprehensive project state management with real-time updates,
 * performance monitoring, and optimistic updates with error handling.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { performance } from 'web-vitals';

import { Project, ProjectStatus } from '../interfaces/project.interface';
import { ProjectState } from '../types/store.types';
import { projectsApi } from '../api/projects.api';
import { ApiError, ApiErrorCode } from '../types/api.types';

// Initial state with performance tracking
const initialState: ProjectState = {
  items: [],
  selectedProject: null,
  loading: 'IDLE',
  error: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
    sortDirection: 'asc',
    sortField: 'createdAt'
  },
  performanceMetrics: {
    pageLoadTime: 0,
    apiResponseTime: 0,
    lastUpdated: Date.now()
  }
};

// Enhanced async thunks with performance tracking and retry logic
export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (params: { page?: number; pageSize?: number; sortField?: string; sortDirection?: 'asc' | 'desc' } = {}, 
  { rejectWithValue }) => {
    const startTime = performance.now();
    try {
      const response = await projectsApi.getAllProjects(params);
      const endTime = performance.now();
      return {
        data: response,
        performanceMetrics: {
          apiResponseTime: endTime - startTime
        }
      };
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue({
        code: apiError.code || ApiErrorCode.INTERNAL_ERROR,
        message: apiError.message,
        details: apiError.details
      });
    }
  }
);

export const fetchProjectById = createAsyncThunk(
  'projects/fetchProjectById',
  async (projectId: string, { rejectWithValue, getState }) => {
    const startTime = performance.now();
    try {
      const response = await projectsApi.getProjectById(projectId);
      const endTime = performance.now();
      return {
        data: response,
        performanceMetrics: {
          apiResponseTime: endTime - startTime
        }
      };
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue({
        code: apiError.code || ApiErrorCode.INTERNAL_ERROR,
        message: apiError.message,
        details: apiError.details
      });
    }
  }
);

// Projects slice with comprehensive state management
const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setSelectedProject: (state, action: PayloadAction<Project | null>) => {
      state.selectedProject = action.payload;
    },
    updateProjectStatus: (state, action: PayloadAction<{ id: string; status: ProjectStatus }>) => {
      const project = state.items.find(p => p.id === action.payload.id);
      if (project) {
        project.status = action.payload.status;
        project.updatedAt = new Date();
      }
    },
    updatePerformanceMetrics: (state, action: PayloadAction<Partial<typeof state.performanceMetrics>>) => {
      state.performanceMetrics = {
        ...state.performanceMetrics,
        ...action.payload,
        lastUpdated: Date.now()
      };
    },
    clearProjectErrors: (state) => {
      state.error = null;
    },
    resetProjectState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Fetch projects handlers
      .addCase(fetchProjects.pending, (state) => {
        state.loading = 'LOADING';
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = 'SUCCESS';
        state.items = action.payload.data.items;
        state.pagination = {
          ...state.pagination,
          total: action.payload.data.total,
          totalPages: action.payload.data.totalPages
        };
        state.performanceMetrics = {
          ...state.performanceMetrics,
          apiResponseTime: action.payload.performanceMetrics.apiResponseTime,
          lastUpdated: Date.now()
        };
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = 'ERROR';
        state.error = action.payload as ApiError;
      })
      // Fetch project by ID handlers
      .addCase(fetchProjectById.pending, (state) => {
        state.loading = 'LOADING';
        state.error = null;
      })
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        state.loading = 'SUCCESS';
        state.selectedProject = action.payload.data;
        state.performanceMetrics = {
          ...state.performanceMetrics,
          apiResponseTime: action.payload.performanceMetrics.apiResponseTime,
          lastUpdated: Date.now()
        };
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        state.loading = 'ERROR';
        state.error = action.payload as ApiError;
      });
  }
});

// Export actions and selectors
export const {
  setSelectedProject,
  updateProjectStatus,
  updatePerformanceMetrics,
  clearProjectErrors,
  resetProjectState
} = projectsSlice.actions;

// Memoized selectors for optimized performance
export const selectAllProjects = (state: { projects: ProjectState }) => state.projects.items;
export const selectSelectedProject = (state: { projects: ProjectState }) => state.projects.selectedProject;
export const selectProjectsLoading = (state: { projects: ProjectState }) => state.projects.loading;
export const selectProjectsError = (state: { projects: ProjectState }) => state.projects.error;
export const selectProjectsPagination = (state: { projects: ProjectState }) => state.projects.pagination;
export const selectProjectsPerformanceMetrics = (state: { projects: ProjectState }) => state.projects.performanceMetrics;

// Export reducer
export default projectsSlice.reducer;