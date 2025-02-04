import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid, Box, Typography } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import styled from '@mui/material/styles/styled';
import { Project, ProjectStatus } from '../../interfaces/project.interface';
import ProjectCard from './ProjectCard';
import useWebSocket from '../../hooks/useWebSocket';
import ErrorBoundary from '../common/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';

// Styled components following Material Design 3.0 principles
const VirtualizedContainer = styled('div')`
  height: 100%;
  overflow: auto;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  scroll-behavior: smooth;
  padding: ${({ theme }) => theme.spacing(2)};

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    padding: ${({ theme }) => theme.spacing(1)};
  }
`;

const GridContainer = styled(Grid)`
  width: 100%;
  margin: 0;
  position: relative;
  min-height: 200px;
`;

const EmptyStateContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
  min-height: 300px;
`;

// Props interface with comprehensive filtering and sorting options
interface ProjectListProps {
  className?: string;
  filterStatus?: ProjectStatus;
  searchQuery?: string;
  sortBy?: 'name' | 'status' | 'lastUpdated';
  sortDirection?: 'asc' | 'desc';
  pageSize?: number;
  currentPage?: number;
  onProjectClick?: (projectId: string) => void;
  onStatusChange?: (projectId: string, newStatus: ProjectStatus) => void;
}

// Custom hook for managing project data with real-time updates
const useProjectData = (
  filterStatus?: ProjectStatus,
  searchQuery?: string,
  sortBy?: string,
  sortDirection?: string
) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket, connect, subscribe, unsubscribe } = useWebSocket(
    localStorage.getItem('authToken') || '',
    { autoReconnect: true, maxRetries: 3 }
  );

  // Handle real-time project updates
  const handleProjectUpdate = useCallback((updatedProject: Project) => {
    setProjects(prevProjects => {
      const projectIndex = prevProjects.findIndex(p => p.id === updatedProject.id);
      if (projectIndex === -1) {
        return [...prevProjects, updatedProject];
      }
      const newProjects = [...prevProjects];
      newProjects[projectIndex] = updatedProject;
      return newProjects;
    });
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        // Simulated API call - replace with actual API implementation
        const response = await fetch('/api/projects', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        const data = await response.json();
        setProjects(data);
        setError(null);
      } catch (err) {
        setError('Failed to load projects');
        console.error('Error fetching projects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
    connect();

    return () => {
      unsubscribe('project:update');
    };
  }, [connect, unsubscribe]);

  useEffect(() => {
    if (socket) {
      subscribe('project:update', handleProjectUpdate);
    }
  }, [socket, subscribe, handleProjectUpdate]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    if (filterStatus) {
      result = result.filter(project => project.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(project =>
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query)
      );
    }

    if (sortBy) {
      result.sort((a, b) => {
        const direction = sortDirection === 'desc' ? -1 : 1;
        switch (sortBy) {
          case 'name':
            return direction * a.name.localeCompare(b.name);
          case 'status':
            return direction * a.status.localeCompare(b.status);
          case 'lastUpdated':
            return direction * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
          default:
            return 0;
        }
      });
    }

    return result;
  }, [projects, filterStatus, searchQuery, sortBy, sortDirection]);

  return { projects: filteredProjects, loading, error };
};

const ProjectList: React.FC<ProjectListProps> = ({
  className,
  filterStatus,
  searchQuery,
  sortBy,
  sortDirection,
  pageSize = 20,
  currentPage = 0,
  onProjectClick,
  onStatusChange
}) => {
  const { isDarkMode } = useTheme();
  const { projects, loading, error } = useProjectData(filterStatus, searchQuery, sortBy, sortDirection);

  // Virtual list configuration for performance optimization
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: projects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300,
    overscan: 5
  });

  // Calculate grid columns based on viewport width
  const getGridColumns = () => {
    const width = window.innerWidth;
    if (width < 600) return 1;
    if (width < 960) return 2;
    if (width < 1280) return 3;
    return 4;
  };

  const [columns, setColumns] = useState(getGridColumns());

  useEffect(() => {
    const handleResize = () => {
      setColumns(getGridColumns());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (error) {
    return (
      <EmptyStateContainer>
        <Typography variant="h6" color="error" gutterBottom>
          {error}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Please try refreshing the page
        </Typography>
      </EmptyStateContainer>
    );
  }

  if (!loading && projects.length === 0) {
    return (
      <EmptyStateContainer>
        <Typography variant="h6" gutterBottom>
          No projects found
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Try adjusting your filters or create a new project
        </Typography>
      </EmptyStateContainer>
    );
  }

  return (
    <ErrorBoundary>
      <VirtualizedContainer ref={parentRef} className={className}>
        <GridContainer container spacing={2}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const project = projects[virtualRow.index];
            return (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                lg={3}
                key={project.id}
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <ProjectCard
                  project={project}
                  interactive
                  onClick={() => onProjectClick?.(project.id.toString())}
                  onStatusChange={(newStatus) => onStatusChange?.(project.id.toString(), newStatus)}
                  elevation={isDarkMode ? 'medium' : 'low'}
                />
              </Grid>
            );
          })}
        </GridContainer>
      </VirtualizedContainer>
    </ErrorBoundary>
  );
};

ProjectList.displayName = 'ProjectList';

export default React.memo(ProjectList);