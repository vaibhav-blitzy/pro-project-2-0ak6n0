import React, { useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion'; // ^6.0.0
import { Draggable } from 'react-beautiful-dnd'; // ^13.1.0
import { 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  Avatar, 
  Skeleton,
  IconButton,
  Box
} from '@mui/material'; // ^5.0.0
import { Task, TaskPriority, TaskStatus } from '../../interfaces/task.interface';
import { InteractiveComponentProps } from '../../types/common.types';

// Enhanced props interface extending InteractiveComponentProps
interface TaskCardProps extends InteractiveComponentProps {
  task: Task;
  index: number;
  isDragging?: boolean;
  isLoading?: boolean;
}

// Styled components with theme integration
const StyledCard = styled(Card)(({ theme }) => ({
  margin: theme.spacing(1),
  cursor: 'pointer',
  transition: theme.transitions.create(['transform', 'box-shadow'], {
    duration: theme.transitions.duration.standard,
  }),
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

const PriorityChip = styled(Chip)<{ priority: TaskPriority }>(({ theme, priority }) => ({
  marginRight: theme.spacing(1),
  backgroundColor: {
    [TaskPriority.HIGH]: theme.palette.error.light,
    [TaskPriority.MEDIUM]: theme.palette.warning.light,
    [TaskPriority.LOW]: theme.palette.success.light,
  }[priority],
  color: theme.palette.getContrastText(
    {
      [TaskPriority.HIGH]: theme.palette.error.light,
      [TaskPriority.MEDIUM]: theme.palette.warning.light,
      [TaskPriority.LOW]: theme.palette.success.light,
    }[priority]
  ),
}));

const StatusChip = styled(Chip)<{ status: TaskStatus }>(({ theme, status }) => ({
  backgroundColor: {
    [TaskStatus.TODO]: theme.palette.grey[300],
    [TaskStatus.IN_PROGRESS]: theme.palette.info.light,
    [TaskStatus.REVIEW]: theme.palette.warning.light,
    [TaskStatus.DONE]: theme.palette.success.light,
  }[status],
}));

// Animation variants for drag-and-drop
const cardAnimationVariants = {
  initial: { scale: 1 },
  dragging: { scale: 1.02, boxShadow: 15 },
  dropped: { scale: 1 },
};

// Memoized TaskCard component with enhanced features
const TaskCard: React.FC<TaskCardProps> = React.memo(({
  task,
  index,
  isDragging = false,
  isLoading = false,
  onClick,
  className,
  disabled,
}) => {
  // Memoized date formatting
  const formattedDueDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(task.dueDate));
  }, [task.dueDate]);

  // Click handler with accessibility support
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!disabled && onClick) {
      onClick();
    }
  }, [disabled, onClick]);

  // Keyboard handler for accessibility
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (!disabled && onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  }, [disabled, onClick]);

  if (isLoading) {
    return (
      <StyledCard>
        <CardContent>
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
          <Box display="flex" justifyContent="space-between" mt={1}>
            <Skeleton variant="rectangular" width={60} height={24} />
            <Skeleton variant="circular" width={32} height={32} />
          </Box>
        </CardContent>
      </StyledCard>
    );
  }

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <motion.div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          variants={cardAnimationVariants}
          initial="initial"
          animate={isDragging ? "dragging" : "dropped"}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <StyledCard
            className={className}
            onClick={handleClick}
            onKeyPress={handleKeyPress}
            elevation={isDragging ? 6 : 1}
            tabIndex={0}
            role="button"
            aria-label={`Task: ${task.title}`}
            data-testid={`task-card-${task.id}`}
          >
            <CardContent>
              <Typography 
                variant="h6" 
                component="h3"
                gutterBottom
                sx={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {task.title}
              </Typography>
              
              <Typography 
                variant="body2" 
                color="textSecondary"
                sx={{ 
                  mb: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {task.description}
              </Typography>

              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Box display="flex" gap={1}>
                  <PriorityChip
                    label={task.priority.toLowerCase()}
                    priority={task.priority}
                    size="small"
                  />
                  <StatusChip
                    label={task.status.replace('_', ' ').toLowerCase()}
                    status={task.status}
                    size="small"
                  />
                </Box>

                <Typography 
                  variant="caption" 
                  color="textSecondary"
                  component="span"
                  aria-label="Due date"
                >
                  Due: {formattedDueDate}
                </Typography>
              </Box>

              {task.assigneeId && (
                <Box display="flex" justifyContent="flex-end" mt={1}>
                  <Avatar
                    alt="Assignee"
                    src={`/api/users/${task.assigneeId}/avatar`}
                    sx={{ width: 32, height: 32 }}
                  />
                </Box>
              )}
            </CardContent>
          </StyledCard>
        </motion.div>
      )}
    </Draggable>
  );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard;