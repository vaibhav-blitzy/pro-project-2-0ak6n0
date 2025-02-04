import React, { useMemo } from 'react'; // ^18.0.0
import styled from '@mui/material/styles/styled'; // ^5.0.0
import { ComponentProps } from '../../interfaces/common.interface';
import Card from '../common/Card';
import Avatar from '../common/Avatar';
import ProgressBar from '../common/ProgressBar';
import { ComponentSize } from '../../types/common.types';
import { SPACING, ANIMATION } from '../../constants/ui.constants';

// Enhanced interface for team member data with additional metrics
interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  tasksCompleted: number;
  totalTasks: number;
  lastActive: string;
  productivityScore: number;
  currentTasks: string[];
  isOnline: boolean;
}

// Enhanced props interface for TeamOverview component with additional states
interface TeamOverviewProps extends ComponentProps {
  members: TeamMember[];
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  onMemberClick?: (memberId: string) => void;
  onRefresh?: () => void;
  viewMode?: 'grid' | 'list';
}

// Styled components following Material Design 3.0 principles
const StyledContainer = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: theme.spacing(SPACING.MEDIUM),
  width: '100%',
  padding: theme.spacing(SPACING.MEDIUM),
  '@media (max-width: 600px)': {
    gridTemplateColumns: '1fr',
  },
}));

const StyledMemberCard = styled(Card)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(SPACING.MEDIUM),
  padding: theme.spacing(SPACING.MEDIUM),
  transition: theme.transitions.create(['transform', 'box-shadow'], {
    duration: ANIMATION.DURATION_MEDIUM,
    easing: ANIMATION.EASING_STANDARD,
  }),
  '&:hover': {
    transform: 'translateY(-4px)',
  },
}));

const StyledMemberInfo = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.MEDIUM,
});

const StyledMemberDetails = styled('div')(({ theme }) => ({
  flex: 1,
  '& h3': {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  '& p': {
    margin: '4px 0 0 0',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
}));

const StyledMetrics = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(SPACING.SMALL),
}));

const StyledOnlineIndicator = styled('span')<{ $isOnline: boolean }>(({ theme, $isOnline }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: $isOnline ? theme.palette.success.main : theme.palette.grey[400],
  marginLeft: theme.spacing(1),
}));

// Enhanced function to calculate task completion rate with validation
const calculateCompletionRate = (completed: number, total: number): number => {
  if (completed < 0 || total <= 0) return 0;
  const rate = (completed / total) * 100;
  return Math.min(Math.max(Math.round(rate), 0), 100);
};

// TeamOverview component with enhanced accessibility and real-time updates
const TeamOverview: React.FC<TeamOverviewProps> = React.memo(({
  members,
  loading = false,
  error = false,
  errorMessage = 'Error loading team data',
  onMemberClick,
  onRefresh,
  viewMode = 'grid',
  className,
  ...props
}) => {
  // Memoize member cards rendering for performance
  const renderMemberCard = useMemo(() => (member: TeamMember) => {
    const completionRate = calculateCompletionRate(member.tasksCompleted, member.totalTasks);
    
    return (
      <StyledMemberCard
        key={member.id}
        interactive
        elevation="low"
        onClick={() => onMemberClick?.(member.id)}
        role="article"
        aria-label={`Team member ${member.name}`}
        tabIndex={0}
      >
        <StyledMemberInfo>
          <Avatar
            src={member.avatarUrl}
            name={member.name}
            size={ComponentSize.LARGE}
            alt={`${member.name}'s avatar`}
          />
          <StyledMemberDetails>
            <h3>
              {member.name}
              <StyledOnlineIndicator
                $isOnline={member.isOnline}
                aria-label={member.isOnline ? 'Online' : 'Offline'}
              />
            </h3>
            <p>{member.role}</p>
          </StyledMemberDetails>
        </StyledMemberInfo>

        <StyledMetrics>
          <ProgressBar
            value={completionRate}
            showLabel
            ariaLabel={`Task completion rate: ${completionRate}%`}
            height={8}
          />
          <p aria-label="Current tasks">
            Active Tasks: {member.currentTasks.length}
          </p>
          <p aria-label="Last activity">
            Last Active: {new Date(member.lastActive).toLocaleString()}
          </p>
        </StyledMetrics>
      </StyledMemberCard>
    );
  }, [onMemberClick]);

  if (loading) {
    return (
      <StyledContainer className={className} role="alert" aria-busy="true">
        {/* Skeleton loading state */}
        {Array.from({ length: 4 }).map((_, index) => (
          <StyledMemberCard key={index} elevation="low" aria-hidden="true" />
        ))}
      </StyledContainer>
    );
  }

  if (error) {
    return (
      <Card
        role="alert"
        aria-label={errorMessage}
        className={className}
        elevation="medium"
      >
        <p>{errorMessage}</p>
        {onRefresh && (
          <button onClick={onRefresh} aria-label="Retry loading team data">
            Retry
          </button>
        )}
      </Card>
    );
  }

  return (
    <StyledContainer
      className={className}
      role="region"
      aria-label="Team Overview"
      {...props}
    >
      {members.map(renderMemberCard)}
    </StyledContainer>
  );
});

TeamOverview.displayName = 'TeamOverview';

export default TeamOverview;