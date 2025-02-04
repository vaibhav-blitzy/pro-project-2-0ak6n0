import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Typography, Box, useTheme } from '@mui/material'; // ^5.0.0
import { Project } from '../../interfaces/project.interface';
import { ProgressBar } from '../common/ProgressBar';
import { projectsApi } from '../../api/projects.api';
import { SPACING, ANIMATION } from '../../constants/ui.constants';

// Interface for project statistics with real-time update support
interface ProjectStatistics {
  completedTasks: number;
  totalTasks: number;
  progressPercentage: number;
  lastUpdated: Date;
}

// Props interface for ProjectProgress component
interface ProjectProgressProps {
  project: Project;
  className?: string;
  onError?: (error: Error) => void;
  refreshInterval?: number;
}

/**
 * Calculates project progress considering both task completion and timeline
 * @param statistics - Current project statistics
 * @param startDate - Project start date
 * @param endDate - Project end date
 * @returns Normalized progress percentage between 0 and 100
 */
const calculateProgress = (
  statistics: ProjectStatistics,
  startDate: Date,
  endDate: Date
): number => {
  // Calculate task completion percentage
  const taskProgress = statistics.progressPercentage;

  // Calculate timeline progress
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsedDuration = Date.now() - startDate.getTime();
  const timelineProgress = Math.min(100, (elapsedDuration / totalDuration) * 100);

  // Weight both factors (60% tasks, 40% timeline)
  const weightedProgress = (taskProgress * 0.6) + (timelineProgress * 0.4);

  // Normalize and round to 2 decimal places
  return Math.min(100, Math.round(weightedProgress * 100) / 100);
};

/**
 * ProjectProgress component that displays project progress with real-time updates
 * Implements Material Design 3.0 specifications and accessibility requirements
 */
export const ProjectProgress: React.FC<ProjectProgressProps> = ({
  project,
  className,
  onError,
  refreshInterval = 30000 // Default 30s refresh interval
}) => {
  const theme = useTheme();
  const [statistics, setStatistics] = useState<ProjectStatistics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize project dates to prevent unnecessary recalculations
  const projectDates = useMemo(() => ({
    startDate: new Date(project.startDate),
    endDate: new Date(project.endDate)
  }), [project.startDate, project.endDate]);

  /**
   * Fetches project statistics with error handling and caching
   */
  const fetchProjectStatistics = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await projectsApi.getProjectStatistics(project.id);
      setStatistics(data);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id, onError]);

  // Set up real-time updates and initial data fetch
  useEffect(() => {
    fetchProjectStatistics();

    // Set up periodic refresh
    const intervalId = setInterval(fetchProjectStatistics, refreshInterval);

    // Set up WebSocket subscription for real-time updates
    const unsubscribe = projectsApi.subscribeToProjectUpdates(
      project.id,
      (updatedStats) => {
        setStatistics(updatedStats);
      }
    );

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [project.id, refreshInterval, fetchProjectStatistics]);

  // Calculate overall progress
  const progress = useMemo(() => {
    if (!statistics) return 0;
    return calculateProgress(
      statistics,
      projectDates.startDate,
      projectDates.endDate
    );
  }, [statistics, projectDates]);

  return (
    <Card
      className={className}
      sx={{
        p: SPACING.LARGE,
        transition: `all ${ANIMATION.DURATION_MEDIUM}ms ${ANIMATION.EASING_STANDARD}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4]
        }
      }}
    >
      <Box sx={{ mb: SPACING.MEDIUM }}>
        <Typography variant="h6" gutterBottom>
          {project.name}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: SPACING.MEDIUM }}
        >
          {`Status: ${project.status}`}
        </Typography>
      </Box>

      <ProgressBar
        value={progress}
        showLabel
        animate
        height={8}
        useGradient
        ariaLabel={`Project progress for ${project.name}`}
      />

      {statistics && (
        <Box sx={{ mt: SPACING.MEDIUM, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {`${statistics.completedTasks}/${statistics.totalTasks} tasks completed`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {`Last updated: ${new Date(statistics.lastUpdated).toLocaleString()}`}
          </Typography>
        </Box>
      )}

      {isLoading && (
        <Typography variant="body2" color="text.secondary">
          Updating progress...
        </Typography>
      )}

      {error && (
        <Typography variant="body2" color="error">
          Error loading progress: {error.message}
        </Typography>
      )}
    </Card>
  );
};

export default ProjectProgress;