import React, { useCallback, useMemo } from 'react';
import styled from '@mui/material/styles/styled';
import { useTheme } from '@mui/material/styles';
import Card from '../common/Card';
import ErrorBoundary from '../common/ErrorBoundary';
import { Project, ProjectStatus } from '../../interfaces/project.interface';
import { formatDistanceToNow } from 'date-fns'; // ^2.30.0

// Styled components with Material Design 3.0 principles
const StyledCard = styled(Card)<{ elevation?: 'low' | 'medium' | 'high' }>`
  width: 100%;
  max-width: 400px;
  transition: transform 0.2s ease-in-out;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: ${({ interactive }) => interactive ? 'translateY(-4px)' : 'none'};
  }
`;

const StyledContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const ProjectTitle = styled('h3')`
  margin: 0;
  color: ${({ theme }) => theme.palette.text.primary};
  font-size: ${({ theme }) => theme.typography.h6.fontSize};
  font-weight: 600;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const StatusBadge = styled('span')<{ statusColor: string }>`
  padding: ${({ theme }) => theme.spacing(0.5, 1.5)};
  border-radius: 16px;
  background-color: ${({ statusColor }) => statusColor};
  color: ${({ theme }) => theme.palette.getContrastText(statusColor)};
  font-size: ${({ theme }) => theme.typography.caption.fontSize};
  font-weight: 500;
  white-space: nowrap;
`;

const Description = styled('p')`
  margin: ${({ theme }) => theme.spacing(2, 0)};
  color: ${({ theme }) => theme.palette.text.secondary};
  font-size: ${({ theme }) => theme.typography.body2.fontSize};
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`;

const ProgressBar = styled('div')<{ progress: number }>`
  width: 100%;
  height: 4px;
  background-color: ${({ theme }) => theme.palette.grey[200]};
  border-radius: 2px;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${({ progress }) => `${progress}%`};
    height: 100%;
    background-color: ${({ theme }) => theme.palette.primary.main};
    transition: width 0.3s ease-in-out;
  }
`;

const MetadataContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.palette.text.secondary};
  font-size: ${({ theme }) => theme.typography.caption.fontSize};
`;

// Props interface following project requirements
interface ProjectCardProps {
  project: Project;
  interactive?: boolean;
  onClick?: (id: string) => void;
  className?: string;
  loading?: boolean;
  fallback?: React.ReactNode;
  elevation?: 'low' | 'medium' | 'high';
}

// Helper function to calculate project progress
const calculateProgress = (startDate: Date, endDate: Date): number => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 0;
  if (now > end) return 100;

  const total = end.getTime() - start.getTime();
  const current = now.getTime() - start.getTime();
  return Math.round((current / total) * 100);
};

// Helper function to get status color with theme awareness
const getStatusColor = (status: ProjectStatus, theme: any): string => {
  const statusColors = {
    [ProjectStatus.PLANNING]: theme.palette.info.main,
    [ProjectStatus.ACTIVE]: theme.palette.success.main,
    [ProjectStatus.ON_HOLD]: theme.palette.warning.main,
    [ProjectStatus.COMPLETED]: theme.palette.primary.main,
    [ProjectStatus.ARCHIVED]: theme.palette.grey[500]
  };
  return statusColors[status];
};

// ProjectCard component with comprehensive accessibility
const ProjectCard: React.FC<ProjectCardProps> = React.memo(({
  project,
  interactive = false,
  onClick,
  className,
  loading = false,
  fallback,
  elevation = 'low'
}) => {
  const theme = useTheme();

  // Memoized calculations
  const progress = useMemo(() => 
    calculateProgress(project.startDate, project.endDate),
    [project.startDate, project.endDate]
  );

  const statusColor = useMemo(() => 
    getStatusColor(project.status, theme),
    [project.status, theme]
  );

  // Event handlers
  const handleClick = useCallback(() => {
    if (interactive && onClick && !loading) {
      onClick(project.id.toString());
    }
  }, [interactive, onClick, project.id, loading]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick();
    }
  }, [interactive, handleClick]);

  return (
    <ErrorBoundary fallback={fallback}>
      <StyledCard
        className={className}
        elevation={elevation}
        interactive={interactive}
        onClick={handleClick}
        onKeyPress={handleKeyPress}
        role={interactive ? 'button' : 'article'}
        tabIndex={interactive ? 0 : undefined}
        aria-busy={loading}
        aria-label={`Project: ${project.name}`}
      >
        <StyledContent>
          <StyledHeader>
            <ProjectTitle>{project.name}</ProjectTitle>
            <StatusBadge 
              statusColor={statusColor}
              aria-label={`Status: ${project.status}`}
            >
              {project.status}
            </StatusBadge>
          </StyledHeader>

          <Description>{project.description}</Description>

          <ProgressBar 
            progress={progress}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Project progress"
          />

          <MetadataContainer>
            <span>
              Start: {formatDistanceToNow(new Date(project.startDate), { addSuffix: true })}
            </span>
            <span>
              Due: {formatDistanceToNow(new Date(project.endDate), { addSuffix: true })}
            </span>
          </MetadataContainer>
        </StyledContent>
      </StyledCard>
    </ErrorBoundary>
  );
});

ProjectCard.displayName = 'ProjectCard';

export default ProjectCard;