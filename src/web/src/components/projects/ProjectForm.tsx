import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form'; // ^7.0.0
import { yupResolver } from '@hookform/resolvers/yup'; // ^3.0.0
import * as yup from 'yup'; // ^1.0.0
import { debounce } from 'lodash'; // ^4.17.21
import {
  TextField,
  Button,
  Box,
  Stack,
  FormControl,
  FormHelperText,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material'; // ^5.0.0
import { DatePicker } from '@mui/x-date-pickers'; // ^6.0.0
import { Project, CreateProjectDTO, ProjectStatus } from '../../interfaces/project.interface';
import { projectsApi } from '../../api/projects.api';

// Enhanced validation schema with business rules
const projectSchema = yup.object().shape({
  name: yup
    .string()
    .required('Project name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must not exceed 100 characters')
    .matches(/^[a-zA-Z0-9\s-_]+$/, 'Name can only contain letters, numbers, spaces, and hyphens'),
  description: yup
    .string()
    .required('Project description is required')
    .max(500, 'Description must not exceed 500 characters'),
  startDate: yup
    .date()
    .required('Start date is required')
    .min(new Date(), 'Start date must be in the future')
    .test('isBusinessDay', 'Start date must be a business day', (value) => {
      if (!value) return false;
      const day = value.getDay();
      return day !== 0 && day !== 6;
    }),
  endDate: yup
    .date()
    .required('End date is required')
    .min(yup.ref('startDate'), 'End date must be after start date')
    .test('isBusinessDay', 'End date must be a business day', (value) => {
      if (!value) return false;
      const day = value.getDay();
      return day !== 0 && day !== 6;
    })
});

interface ProjectFormProps {
  initialData?: Project;
  onSubmit: (project: Project) => void;
  onCancel: () => void;
  isLoading?: boolean;
  autoFocus?: boolean;
  'aria-labelledby'?: string;
  validationOptions?: {
    validateOnBlur?: boolean;
    validateOnChange?: boolean;
  };
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  autoFocus = true,
  'aria-labelledby': ariaLabelledBy,
  validationOptions = {
    validateOnBlur: true,
    validateOnChange: true
  }
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setError
  } = useForm({
    resolver: yupResolver(projectSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      startDate: initialData?.startDate || null,
      endDate: initialData?.endDate || null,
      status: initialData?.status || ProjectStatus.PLANNING
    },
    mode: validationOptions.validateOnChange ? 'onChange' : 'onSubmit'
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  // Debounced validation for performance
  const debouncedValidation = useMemo(
    () => debounce(async (data: CreateProjectDTO) => {
      try {
        await projectSchema.validate(data, { abortEarly: false });
      } catch (err) {
        if (err instanceof yup.ValidationError) {
          err.inner.forEach((error) => {
            if (error.path) {
              setError(error.path as keyof CreateProjectDTO, {
                type: 'validation',
                message: error.message
              });
            }
          });
        }
      }
    }, 300),
    [setError]
  );

  // Form submission handler with error handling
  const onFormSubmit = async (data: CreateProjectDTO) => {
    try {
      const projectData = {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate)
      };

      const result = initialData
        ? await projectsApi.updateProject(initialData.id, projectData)
        : await projectsApi.createProject(projectData);

      onSubmit(result);
    } catch (error) {
      console.error('Project submission failed:', error);
      setError('root', {
        type: 'submit',
        message: 'Failed to save project. Please try again.'
      });
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      aria-labelledby={ariaLabelledBy}
      role="form"
    >
      <Stack spacing={3}>
        {errors.root && (
          <Alert severity="error" aria-live="polite">
            {errors.root.message}
          </Alert>
        )}

        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <FormControl error={!!errors.name}>
              <TextField
                {...field}
                label="Project Name"
                required
                autoFocus={autoFocus}
                error={!!errors.name}
                helperText={errors.name?.message}
                inputProps={{
                  'aria-label': 'Project name',
                  'aria-describedby': errors.name ? 'name-error' : undefined
                }}
                disabled={isLoading}
              />
            </FormControl>
          )}
        />

        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <FormControl error={!!errors.description}>
              <TextField
                {...field}
                label="Description"
                required
                multiline
                rows={4}
                error={!!errors.description}
                helperText={errors.description?.message}
                inputProps={{
                  'aria-label': 'Project description',
                  'aria-describedby': errors.description ? 'description-error' : undefined
                }}
                disabled={isLoading}
              />
            </FormControl>
          )}
        />

        <Stack direction="row" spacing={2}>
          <Controller
            name="startDate"
            control={control}
            render={({ field }) => (
              <FormControl error={!!errors.startDate}>
                <DatePicker
                  {...field}
                  label="Start Date"
                  disablePast
                  disabled={isLoading}
                  slotProps={{
                    textField: {
                      required: true,
                      error: !!errors.startDate,
                      helperText: errors.startDate?.message,
                      inputProps: {
                        'aria-label': 'Project start date'
                      }
                    }
                  }}
                />
              </FormControl>
            )}
          />

          <Controller
            name="endDate"
            control={control}
            render={({ field }) => (
              <FormControl error={!!errors.endDate}>
                <DatePicker
                  {...field}
                  label="End Date"
                  disablePast
                  disabled={isLoading}
                  slotProps={{
                    textField: {
                      required: true,
                      error: !!errors.endDate,
                      helperText: errors.endDate?.message,
                      inputProps: {
                        'aria-label': 'Project end date'
                      }
                    }
                  }}
                />
              </FormControl>
            )}
          />
        </Stack>

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Cancel project form"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || !isDirty}
            startIcon={isSubmitting && <CircularProgress size={20} />}
            aria-label="Save project"
          >
            {initialData ? 'Update Project' : 'Create Project'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default ProjectForm;