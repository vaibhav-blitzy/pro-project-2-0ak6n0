import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query'; // ^4.0.0
import { Project, ProjectStatus } from '../../interfaces/project.interface';
import { useWebSocket } from '../../hooks/useWebSocket';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import Card from '../../components/common/Card';
import styled from '@mui/material/styles/styled'; // ^5.0.0
import { useTheme } from '../../hooks/useTheme';
import { validateProjectData } from '../../utils/validation.utils';

// Styled components following Material Design 3.0 principles
const ProjectContainer = styled('div')(({ theme }) => ({
  padding: theme.spacing(3),
  maxWidth: '1440px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing(3),
  gridTemplateColumns: 'repeat(12, 1fr)',
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: 'repeat(1, 1fr)',
  },
}));

const ProjectHeader = styled('header')(({ theme }) => ({
  gridColumn: '1 / -1',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
  },
}));

const ProjectTitle = styled('h1')(({ theme }) => ({
  fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
  color: theme.palette.text.primary,
  margin: 0,
}));

const ProjectDescription = styled('p')(({ theme }) => ({
  fontSize: '1rem',
  color: theme.palette.text.secondary,
  lineHeight: 1.618,
  marginTop: theme.spacing(2),
}));

const ProjectStatus = styled('div')<{ status: ProjectStatus }>(({ theme, status }) => {
  const statusColors = {
    PLANNING: theme.palette.info.main,
    ACTIVE: theme.palette.success.main,
    ON_HOLD: theme.palette.warning.main,
    COMPLETED: theme.palette.success.dark,
    ARCHIVED: theme.palette.grey[500],
  };

  return {
    padding: theme.spacing(1, 2),
    borderRadius: '16px',
    backgroundColor: `${statusColors[status]}20`,
    color: statusColors[status],
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  };
});

interface ProjectDetailsProps {
  projectId: string;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = React.memo(({ projectId }) => {
  const { isDarkMode } = useTheme();
  const [optimisticData, setOptimisticData] = useState<Partial<Project> | null>(null);

  // WebSocket setup for real-time updates
  const { socket, connect, subscribe, disconnect } = useWebSocket(
    localStorage.getItem('authToken') || '',
    {
      maxRetries: 5,
      retryDelay: 3000,
      heartbeatEnabled: true,
    }
  );

  // Query for project data with prefetching
  const { data: project, error, isLoading } = useQuery<Project>(
    ['project', projectId],
    async () => {
      const response = await fetch(`/api/v1/projects/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    },
    {
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
      refetchOnWindowFocus: true,
      retry: 3,
    }
  );

  // Memoized project data combining server and optimistic updates
  const currentProject = useMemo(() => {
    if (!project) return null;
    return optimisticData ? { ...project, ...optimisticData } : project;
  }, [project, optimisticData]);

  // WebSocket event handlers
  useEffect(() => {
    connect();

    subscribe('project:update', (updatedProject: Project) => {
      if (updatedProject.id === projectId) {
        setOptimisticData(updatedProject);
      }
    });

    return () => {
      disconnect();
    };
  }, [connect, subscribe, disconnect, projectId]);

  // Optimistic update handler
  const handleOptimisticUpdate = useCallback((update: Partial<Project>) => {
    const validation = validateProjectData({ ...currentProject!, ...update });
    if (!validation.hasError) {
      setOptimisticData(update);
    }
  }, [currentProject]);

  if (error) {
    return (
      <Card elevation="medium" role="alert" aria-live="polite">
        <ProjectTitle>Error Loading Project</ProjectTitle>
        <ProjectDescription>
          We encountered an error while loading the project. Please try again later.
        </ProjectDescription>
      </Card>
    );
  }

  if (isLoading || !currentProject) {
    return (
      <Card elevation="low" aria-busy="true">
        <ProjectTitle>Loading Project...</ProjectTitle>
      </Card>
    );
  }

  return (
    <ErrorBoundary>
      <ProjectContainer role="main" aria-label="Project Details">
        <ProjectHeader>
          <div>
            <ProjectTitle>{currentProject.name}</ProjectTitle>
            <ProjectDescription>{currentProject.description}</ProjectDescription>
          </div>
          <ProjectStatus 
            status={currentProject.status}
            role="status"
            aria-label={`Project status: ${currentProject.status.toLowerCase()}`}
          >
            {currentProject.status}
          </ProjectStatus>
        </ProjectHeader>

        {/* Project content sections */}
        <Card 
          elevation="medium"
          className="project-details"
          aria-label="Project Information"
          fullWidth
        >
          {/* Additional project details content */}
        </Card>

        {/* Timeline section */}
        <Card 
          elevation="medium"
          className="project-timeline"
          aria-label="Project Timeline"
          fullWidth
        >
          {/* Timeline visualization */}
        </Card>

        {/* Tasks section */}
        <Card 
          elevation="medium"
          className="project-tasks"
          aria-label="Project Tasks"
          fullWidth
        >
          {/* Task management interface */}
        </Card>
      </ProjectContainer>
    </ErrorBoundary>
  );
});

ProjectDetails.displayName = 'ProjectDetails';

export default ProjectDetails;