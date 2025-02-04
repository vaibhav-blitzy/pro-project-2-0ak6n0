import React, { useCallback, useRef, useState } from 'react';
import styled from '@mui/material/styles/styled';
import { Box, Typography, IconButton } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { ComponentProps } from '../../interfaces/common.interface';
import ProgressBar from './ProgressBar';
import { ANIMATION, SPACING } from '../../constants/ui.constants';

// File upload error interface
interface FileUploadError {
  code: string;
  message: string;
  file?: File;
}

// Props interface extending base component props
export interface FileUploadProps extends ComponentProps {
  onFileSelect: (files: File[]) => void;
  onUploadProgress?: (progress: number, file: File) => void;
  onError?: (error: FileUploadError) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
}

// Styled components with Material Design integration
const DropZone = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isDragging' && prop !== 'isDisabled',
})<{ isDragging?: boolean; isDisabled?: boolean }>(({ theme, isDragging, isDisabled }) => ({
  border: `2px dashed ${
    isDragging
      ? theme.palette.primary.main
      : isDisabled
      ? theme.palette.grey[300]
      : theme.palette.grey[400]
  }`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: isDragging
    ? theme.palette.action.hover
    : isDisabled
    ? theme.palette.action.disabledBackground
    : theme.palette.background.paper,
  padding: theme.spacing(SPACING.LARGE),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: isDisabled ? 'not-allowed' : 'pointer',
  transition: `all ${ANIMATION.DURATION_SHORT}ms ${ANIMATION.EASING_STANDARD}`,
  '&:hover': {
    backgroundColor: isDisabled ? theme.palette.action.disabledBackground : theme.palette.action.hover,
  },
  '&:focus-visible': {
    outline: `3px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

const UploadIcon = styled(CloudUploadIcon)(({ theme }) => ({
  fontSize: 48,
  color: theme.palette.primary.main,
  marginBottom: theme.spacing(SPACING.MEDIUM),
}));

// Validation function for files
const validateFiles = (
  files: File[],
  maxSize: number,
  accept?: string
): { valid: boolean; error?: FileUploadError } => {
  for (const file of files) {
    // Check file size
    if (file.size > maxSize) {
      return {
        valid: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File ${file.name} exceeds maximum size of ${maxSize / 1024 / 1024}MB`,
          file,
        },
      };
    }

    // Check file type if specified
    if (accept) {
      const acceptedTypes = accept.split(',').map((type) => type.trim());
      const fileType = file.type || '';
      const fileExtension = `.${file.name.split('.').pop()}`;
      
      const isValidType = acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          return fileExtension.toLowerCase() === type.toLowerCase();
        }
        if (type.includes('*')) {
          const [mainType] = type.split('/*');
          return fileType.startsWith(`${mainType}/`);
        }
        return fileType === type;
      });

      if (!isValidType) {
        return {
          valid: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `File ${file.name} has an unsupported format`,
            file,
          },
        };
      }
    }
  }

  return { valid: true };
};

export const FileUpload: React.FC<FileUploadProps> = React.memo(({
  onFileSelect,
  onUploadProgress,
  onError,
  multiple = false,
  accept = '*/*',
  maxSize = 5 * 1024 * 1024, // 5MB default
  disabled = false,
  id,
  className,
  testId = 'file-upload',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, [disabled]);

  const handleFiles = useCallback((files: File[]) => {
    const { valid, error } = validateFiles(files, maxSize, accept);

    if (!valid && error) {
      onError?.(error);
      return;
    }

    // Initialize progress tracking
    const progressMap: { [key: string]: number } = {};
    files.forEach((file) => {
      progressMap[file.name] = 0;
    });
    setUploadProgress(progressMap);

    // Simulate progress updates
    files.forEach((file) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress <= 100) {
          setUploadProgress((prev) => ({
            ...prev,
            [file.name]: progress,
          }));
          onUploadProgress?.(progress, file);
        } else {
          clearInterval(interval);
        }
      }, 200);
    });

    onFileSelect(files);
  }, [maxSize, accept, onFileSelect, onUploadProgress, onError]);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFiles]);

  return (
    <Box className={className}>
      <input
        ref={fileInputRef}
        type="file"
        id={id}
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{ display: 'none' }}
        data-testid={`${testId}-input`}
        aria-label="File upload input"
      />
      <DropZone
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        isDragging={isDragging}
        isDisabled={disabled}
        role="button"
        tabIndex={disabled ? -1 : 0}
        data-testid={testId}
        aria-disabled={disabled}
      >
        <UploadIcon />
        <Typography variant="h6" component="div" align="center" gutterBottom>
          {isDragging ? 'Drop files here' : 'Drag and drop files here'}
        </Typography>
        <Typography variant="body2" color="textSecondary" align="center">
          or click to select files
        </Typography>
        <Typography variant="caption" color="textSecondary" align="center" sx={{ mt: 1 }}>
          {`Maximum file size: ${maxSize / 1024 / 1024}MB`}
          {accept !== '*/*' && ` • Accepted formats: ${accept}`}
        </Typography>
      </DropZone>
      {Object.entries(uploadProgress).map(([fileName, progress]) => (
        <Box key={fileName} sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            {fileName}
          </Typography>
          <ProgressBar
            value={progress}
            showLabel
            height={4}
            animate
            useGradient
            ariaLabel={`Upload progress for ${fileName}`}
          />
        </Box>
      ))}
    </Box>
  );
});

FileUpload.displayName = 'FileUpload';

export default FileUpload;