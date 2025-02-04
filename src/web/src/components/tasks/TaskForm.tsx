import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  TextField, 
  Button, 
  FormControl, 
  FormHelperText, 
  RadioGroup, 
  FormControlLabel, 
  Radio,
  IconButton,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material'; // ^5.0.0
import { DateTimePicker } from '@mui/x-date-pickers'; // ^6.0.0
import { useDropzone } from 'react-dropzone'; // ^14.2.0
import { Task, TaskPriority, TaskStatus } from '../../interfaces/task.interface';
import { useTheme } from '../../hooks/useTheme';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { validateTaskData } from '../../utils/validation.utils';
import DeleteIcon from '@mui/icons-material/Delete'; // ^5.0.0
import CloudUploadIcon from '@mui/icons-material/CloudUpload'; // ^5.0.0

// File attachment interface
interface FileAttachment {
  file: File;
  preview: string;
  progress: number;
}

// Form validation errors interface
interface ValidationErrors {
  title?: string;
  description?: string;
  dueDate?: string;
  attachments?: string;
}

// Enhanced TaskForm props interface
interface TaskFormProps {
  initialData?: Task;
  projectId?: string;
  onSubmit: (task: Task) => void;
  onCancel: () => void;
  isDarkMode: boolean;
  locale: string;
  onUploadProgress?: (progress: number) => void;
}

// Form state interface
interface TaskFormState {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: Date | null;
  attachments: FileAttachment[];
  errors: ValidationErrors;
  isDirty: boolean;
  isSubmitting: boolean;
  uploadProgress: number;
}

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
const AUTOSAVE_DELAY = 1000; // 1 second

const TaskForm: React.FC<TaskFormProps> = React.memo(({
  initialData,
  projectId,
  onSubmit,
  onCancel,
  isDarkMode,
  locale,
  onUploadProgress
}) => {
  // Theme and state management
  const { theme, isTransitioning } = useTheme();
  const [formState, setFormState] = useState<TaskFormState>(() => ({
    title: initialData?.title || '',
    description: initialData?.description || '',
    priority: initialData?.priority || TaskPriority.MEDIUM,
    dueDate: initialData?.dueDate ? new Date(initialData.dueDate) : null,
    attachments: [],
    errors: {},
    isDirty: false,
    isSubmitting: false,
    uploadProgress: 0
  }));

  // Local storage for form persistence
  const [savedForm, setSavedForm] = useLocalStorage<Partial<TaskFormState>>(
    `task-form-${projectId || 'new'}`,
    {}
  );

  // Refs for handling autosave and file upload
  const autosaveTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload handling with react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    maxSize: MAX_FILE_SIZE,
    onDrop: handleFileUpload,
    disabled: formState.isSubmitting
  });

  // Handle file upload with progress tracking
  async function handleFileUpload(acceptedFiles: File[]) {
    const newAttachments: FileAttachment[] = [];
    let totalProgress = 0;

    for (const file of acceptedFiles) {
      if (ALLOWED_FILE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        const attachment: FileAttachment = {
          file,
          preview: '',
          progress: 0
        };

        reader.onloadstart = () => {
          setFormState(prev => ({
            ...prev,
            uploadProgress: 0
          }));
        };

        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            attachment.progress = progress;
            totalProgress = newAttachments.reduce((acc, curr) => acc + curr.progress, 0) / newAttachments.length;
            
            setFormState(prev => ({
              ...prev,
              uploadProgress: totalProgress
            }));
            onUploadProgress?.(totalProgress);
          }
        };

        reader.onload = () => {
          attachment.preview = reader.result as string;
          newAttachments.push(attachment);
          
          setFormState(prev => ({
            ...prev,
            attachments: [...prev.attachments, attachment],
            isDirty: true
          }));
        };

        reader.readAsDataURL(file);
      }
    }
  }

  // Handle form field changes
  const handleChange = useCallback((field: keyof TaskFormState, value: any) => {
    setFormState(prev => ({
      ...prev,
      [field]: value,
      isDirty: true,
      errors: {
        ...prev.errors,
        [field]: undefined
      }
    }));
  }, []);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormState(prev => ({ ...prev, isSubmitting: true }));

    const taskData: Task = {
      ...initialData,
      title: formState.title,
      description: formState.description,
      priority: formState.priority,
      dueDate: formState.dueDate!,
      projectId: projectId!,
      status: initialData?.status || TaskStatus.TODO,
      attachments: formState.attachments.map(att => att.preview)
    };

    const validation = validateTaskData(taskData);

    if (validation.hasError) {
      setFormState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          ...validation.details
        },
        isSubmitting: false
      }));
      return;
    }

    try {
      await onSubmit(taskData);
      setFormState(prev => ({
        ...prev,
        isDirty: false,
        isSubmitting: false
      }));
      localStorage.removeItem(`task-form-${projectId || 'new'}`);
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        isSubmitting: false,
        errors: {
          ...prev.errors,
          submit: 'Failed to submit task. Please try again.'
        }
      }));
    }
  };

  // Handle autosave
  useEffect(() => {
    if (formState.isDirty) {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      autosaveTimeoutRef.current = setTimeout(() => {
        setSavedForm({
          title: formState.title,
          description: formState.description,
          priority: formState.priority,
          dueDate: formState.dueDate
        });
      }, AUTOSAVE_DELAY);
    }

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [formState, setSavedForm]);

  // Restore form state from local storage
  useEffect(() => {
    if (savedForm && Object.keys(savedForm).length > 0) {
      setFormState(prev => ({
        ...prev,
        ...savedForm,
        isDirty: true
      }));
    }
  }, [savedForm]);

  // Cleanup file previews on unmount
  useEffect(() => {
    return () => {
      formState.attachments.forEach(attachment => {
        URL.revokeObjectURL(attachment.preview);
      });
    };
  }, [formState.attachments]);

  return (
    <Paper 
      elevation={3}
      sx={{ 
        p: 3, 
        backgroundColor: theme === 'dark' ? 'grey.800' : 'background.paper'
      }}
    >
      <form onSubmit={handleSubmit} aria-label="Task form">
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            {initialData ? 'Edit Task' : 'Create New Task'}
          </Typography>
        </Box>

        <TextField
          fullWidth
          label="Title"
          value={formState.title}
          onChange={(e) => handleChange('title', e.target.value)}
          error={!!formState.errors.title}
          helperText={formState.errors.title}
          disabled={formState.isSubmitting}
          required
          sx={{ mb: 2 }}
          inputProps={{
            'aria-label': 'Task title',
            maxLength: 100
          }}
        />

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Description"
          value={formState.description}
          onChange={(e) => handleChange('description', e.target.value)}
          error={!!formState.errors.description}
          helperText={formState.errors.description}
          disabled={formState.isSubmitting}
          sx={{ mb: 2 }}
          inputProps={{
            'aria-label': 'Task description',
            maxLength: 5000
          }}
        />

        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Priority
          </Typography>
          <RadioGroup
            row
            value={formState.priority}
            onChange={(e) => handleChange('priority', e.target.value)}
          >
            <FormControlLabel
              value={TaskPriority.LOW}
              control={<Radio />}
              label="Low"
              disabled={formState.isSubmitting}
            />
            <FormControlLabel
              value={TaskPriority.MEDIUM}
              control={<Radio />}
              label="Medium"
              disabled={formState.isSubmitting}
            />
            <FormControlLabel
              value={TaskPriority.HIGH}
              control={<Radio />}
              label="High"
              disabled={formState.isSubmitting}
            />
          </RadioGroup>
        </FormControl>

        <DateTimePicker
          label="Due Date"
          value={formState.dueDate}
          onChange={(date) => handleChange('dueDate', date)}
          disabled={formState.isSubmitting}
          sx={{ mb: 2, width: '100%' }}
        />

        <Box
          {...getRootProps()}
          sx={{
            p: 2,
            mb: 2,
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 1,
            textAlign: 'center',
            cursor: 'pointer'
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ mb: 1 }} />
          <Typography>
            {isDragActive
              ? 'Drop files here'
              : 'Drag and drop files here, or click to select files'}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Supported formats: JPEG, PNG, PDF, TXT (max 10MB)
          </Typography>
        </Box>

        {formState.attachments.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Attachments
            </Typography>
            {formState.attachments.map((attachment, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 1
                }}
              >
                <Typography noWrap sx={{ flex: 1 }}>
                  {attachment.file.name}
                </Typography>
                <CircularProgress
                  variant="determinate"
                  value={attachment.progress}
                  size={24}
                  sx={{ mr: 1 }}
                />
                <IconButton
                  onClick={() => {
                    setFormState(prev => ({
                      ...prev,
                      attachments: prev.attachments.filter((_, i) => i !== index),
                      isDirty: true
                    }));
                  }}
                  disabled={formState.isSubmitting}
                  aria-label={`Remove ${attachment.file.name}`}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {formState.errors.submit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formState.errors.submit}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={formState.isSubmitting || !formState.isDirty}
            startIcon={formState.isSubmitting && <CircularProgress size={20} />}
          >
            {initialData ? 'Update Task' : 'Create Task'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
});

TaskForm.displayName = 'TaskForm';

export default TaskForm;