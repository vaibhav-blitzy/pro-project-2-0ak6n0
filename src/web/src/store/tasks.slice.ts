import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { io, Socket } from 'socket.io-client';
import { Task, TaskStatus, TaskPriority, CreateTaskDTO, UpdateTaskDTO } from '../interfaces/task.interface';
import { LoadingState, Pagination, ErrorState, ApiResponse, ListResponse } from '../types/common.types';
import { performance } from 'perf_hooks';

// State interface
interface TasksState {
  tasks: Task[];
  selectedTask: Task | null;
  loading: LoadingState;
  error: ErrorState | null;
  pagination: Pagination;
  cache: {
    timestamp: number | null;
    ttl: number; // 5 minutes in milliseconds
  };
  websocket: {
    connected: boolean;
    lastSync: number | null;
  };
}

// Initial state
const initialState: TasksState = {
  tasks: [],
  selectedTask: null,
  loading: LoadingState.IDLE,
  error: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false
  },
  cache: {
    timestamp: null,
    ttl: 300000 // 5 minutes
  },
  websocket: {
    connected: false,
    lastSync: null
  }
};

// WebSocket setup
let socket: Socket;

// Async thunks
export const fetchTasks = createAsyncThunk<
  ListResponse<Task>,
  {
    projectId?: string;
    assigneeId?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
  }
>(
  'tasks/fetchTasks',
  async (params, { rejectWithValue }) => {
    const startTime = performance.now();
    try {
      const response = await fetch('/api/v1/tasks', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: params.signal,
        body: JSON.stringify(params)
      });

      const data: ListResponse<Task> = await response.json();
      
      // Performance monitoring
      const endTime = performance.now();
      console.debug(`Tasks fetch took ${endTime - startTime}ms`);

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch tasks');
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      return rejectWithValue(error.message);
    }
  }
);

export const createTask = createAsyncThunk<
  ApiResponse<Task>,
  CreateTaskDTO
>(
  'tasks/createTask',
  async (taskData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });

      const data: ApiResponse<Task> = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create task');
      }

      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateTask = createAsyncThunk<
  ApiResponse<Task>,
  { id: string; updates: UpdateTaskDTO }
>(
  'tasks/updateTask',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/v1/tasks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      const data: ApiResponse<Task> = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update task');
      }

      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Slice definition
const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setSelectedTask: (state, action: PayloadAction<Task | null>) => {
      state.selectedTask = action.payload;
    },
    handleWebSocketUpdate: (state, action: PayloadAction<{ type: string; payload: Task }>) => {
      const { type, payload } = action.payload;
      switch (type) {
        case 'TASK_CREATED':
          state.tasks.unshift(payload);
          state.pagination.total += 1;
          break;
        case 'TASK_UPDATED':
          const index = state.tasks.findIndex(task => task.id === payload.id);
          if (index !== -1) {
            state.tasks[index] = payload;
          }
          break;
        case 'TASK_DELETED':
          state.tasks = state.tasks.filter(task => task.id !== payload.id);
          state.pagination.total -= 1;
          break;
      }
    },
    setWebSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.websocket.connected = action.payload;
      state.websocket.lastSync = action.payload ? Date.now() : null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch tasks
      .addCase(fetchTasks.pending, (state) => {
        state.loading = LoadingState.LOADING;
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = LoadingState.SUCCESS;
        state.tasks = action.payload.data;
        state.pagination = action.payload.pagination;
        state.cache.timestamp = Date.now();
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = LoadingState.ERROR;
        state.error = {
          message: action.payload as string || 'Failed to fetch tasks',
          code: 'FETCH_ERROR'
        };
      })
      // Create task
      .addCase(createTask.fulfilled, (state, action) => {
        state.tasks.unshift(action.payload.data);
        state.pagination.total += 1;
      })
      // Update task
      .addCase(updateTask.fulfilled, (state, action) => {
        const index = state.tasks.findIndex(task => task.id === action.payload.data.id);
        if (index !== -1) {
          state.tasks[index] = action.payload.data;
        }
      });
  }
});

// Selectors
export const selectTasks = (state: { tasks: TasksState }) => state.tasks.tasks;
export const selectSelectedTask = (state: { tasks: TasksState }) => state.tasks.selectedTask;
export const selectTasksLoading = (state: { tasks: TasksState }) => state.tasks.loading;
export const selectTasksError = (state: { tasks: TasksState }) => state.tasks.error;
export const selectTasksPagination = (state: { tasks: TasksState }) => state.tasks.pagination;
export const selectTaskById = (id: string) => 
  (state: { tasks: TasksState }) => state.tasks.tasks.find(task => task.id === id);

// WebSocket initialization
export const initializeWebSocket = () => {
  socket = io('/tasks', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  return (dispatch: any) => {
    socket.on('connect', () => {
      dispatch(tasksSlice.actions.setWebSocketConnected(true));
    });

    socket.on('disconnect', () => {
      dispatch(tasksSlice.actions.setWebSocketConnected(false));
    });

    socket.on('taskUpdate', (update: { type: string; payload: Task }) => {
      dispatch(tasksSlice.actions.handleWebSocketUpdate(update));
    });
  };
};

export const { setSelectedTask, handleWebSocketUpdate, setWebSocketConnected } = tasksSlice.actions;
export default tasksSlice.reducer;