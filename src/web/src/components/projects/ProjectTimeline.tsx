import React, { useMemo } from 'react';
import styled from '@emotion/styled'; // ^11.0.0
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab'; // ^5.0.0
import { Typography, useTheme } from '@mui/material'; // ^5.0.0
import { Project, ProjectStatus } from '../../interfaces/project.interface';
import ProgressBar from '../common/ProgressBar';
import { SPACING, ANIMATION } from '../../constants/ui.constants';

// Enhanced props interface with accessibility and theme support
interface ProjectTimelineProps {
  project: Project;
  showCompleted?: boolean;
  onEventClick?: (eventId: string) => void;
  className?: string;
  theme?: 'light' | 'dark' | 'system';
  locale?: string;
  direction?: 'ltr' | 'rtl';
}

// Enhanced interface for timeline events with accessibility metadata
interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  type: 'task' | 'milestone';
  status: string;
  ariaLabel: string;
  importance: 'high' | 'medium' | 'low';
}

// Styled components with theme integration and accessibility enhancements
const StyledTimeline = styled(Timeline)<{ $direction?: string }>`
  padding: ${SPACING.LARGE}px;
  margin: 0;
  direction: ${({ $direction }) => $direction || 'ltr'};

  .MuiTimelineItem-root {
    min-height: ${SPACING.XLARGE * 2}px;
    &:before {
      flex: 0;
      padding: 0;
    }
  }
`;

const StyledTimelineContent = styled(TimelineContent)`
  padding: ${SPACING.MEDIUM}px ${SPACING.LARGE}px;
  background: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  box-shadow: ${({ theme }) => theme.shadows[1]};
  transition: all ${ANIMATION.DURATION_MEDIUM}ms ${ANIMATION.EASING_STANDARD};
  
  &:hover {
    box-shadow: ${({ theme }) => theme.shadows[3]};
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }
`;

const StyledTimelineDot = styled(TimelineDot)<{ $importance: string }>`
  background-color: ${({ theme, $importance }) => {
    switch ($importance) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      default:
        return theme.palette.info.main;
    }
  }};
`;

// Utility function to calculate project progress with weighted milestones
const calculateProjectProgress = (project: Project): number => {
  if (!project.tasks || project.tasks.length === 0) return 0;

  const weights = {
    high: 3,
    medium: 2,
    low: 1
  };

  const totalTasks = project.tasks.length;
  const completedWeightedTasks = project.tasks
    .filter(task => task.status === 'DONE')
    .reduce((acc, task) => acc + weights[task.priority.toLowerCase() as keyof typeof weights], 0);

  const totalWeight = project.tasks
    .reduce((acc, task) => acc + weights[task.priority.toLowerCase() as keyof typeof weights], 0);

  return Math.round((completedWeightedTasks / totalWeight) * 100);
};

// Utility function to sort and group timeline events
const sortTimelineEvents = (events: TimelineEvent[]): TimelineEvent[] => {
  return events.sort((a, b) => {
    const dateCompare = a.date.getTime() - b.date.getTime();
    if (dateCompare === 0) {
      const importanceWeight = { high: 3, medium: 2, low: 1 };
      return importanceWeight[b.importance] - importanceWeight[a.importance];
    }
    return dateCompare;
  });
};

// Enhanced ProjectTimeline component with accessibility features
export const ProjectTimeline: React.FC<ProjectTimelineProps> = React.memo(({
  project,
  showCompleted = true,
  onEventClick,
  className,
  direction = 'ltr',
  locale = 'en-US'
}) => {
  const theme = useTheme();

  // Memoized timeline events
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [
      ...project.tasks.map(task => ({
        id: task.id.toString(),
        date: task.dueDate,
        title: task.title,
        type: 'task',
        status: task.status,
        ariaLabel: `Task: ${task.title}, Due: ${task.dueDate.toLocaleDateString(locale)}`,
        importance: task.priority.toLowerCase() as 'high' | 'medium' | 'low'
      })),
      ...(project.milestones || []).map(milestone => ({
        id: milestone.id.toString(),
        date: milestone.date,
        title: milestone.title,
        type: 'milestone',
        status: milestone.status,
        ariaLabel: `Milestone: ${milestone.title}, Date: ${milestone.date.toLocaleDateString(locale)}`,
        importance: 'high'
      }))
    ];

    return sortTimelineEvents(events);
  }, [project, locale]);

  const progress = useMemo(() => calculateProjectProgress(project), [project]);

  return (
    <div
      className={className}
      role="region"
      aria-label={`Timeline for project ${project.name}`}
    >
      <ProgressBar
        value={progress}
        showLabel
        ariaLabel={`Project progress: ${progress}% complete`}
        height={8}
      />
      
      <StyledTimeline
        $direction={direction}
        aria-orientation="vertical"
      >
        {timelineEvents.map((event) => (
          <TimelineItem
            key={event.id}
            role="listitem"
            aria-label={event.ariaLabel}
          >
            <TimelineSeparator>
              <StyledTimelineDot
                $importance={event.importance}
                aria-hidden="true"
              />
              <TimelineConnector />
            </TimelineSeparator>
            
            <StyledTimelineContent
              tabIndex={0}
              onClick={() => onEventClick?.(event.id)}
              onKeyPress={(e) => e.key === 'Enter' && onEventClick?.(event.id)}
              role="button"
            >
              <Typography
                variant="h6"
                component="h3"
                color="textPrimary"
              >
                {event.title}
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
              >
                {event.date.toLocaleDateString(locale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Typography>
              <Typography
                variant="caption"
                color="textSecondary"
                component="div"
                role="status"
              >
                {event.status}
              </Typography>
            </StyledTimelineContent>
          </TimelineItem>
        ))}
      </StyledTimeline>
    </div>
  );
});

ProjectTimeline.displayName = 'ProjectTimeline';

export default ProjectTimeline;