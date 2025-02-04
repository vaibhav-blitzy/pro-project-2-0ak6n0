import React, { useEffect, useCallback, useMemo, useState } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import useWebSocket from 'react-use-websocket'; // ^4.0.0
import { VariableSizeList as VirtualList } from 'react-window'; // ^1.8.9
import { styled } from '@mui/material/styles'; // ^5.0.0
import { 
  Box, 
  Typography, 
  TextField, 
  Select, 
  MenuItem, 
  IconButton,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery 
} from '@mui/material'; // ^5.0.0
import { 
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon 
} from '@mui/icons-material'; // ^5.0.0

import { Project, ProjectStatus } from '../../interfaces/project.interface';
import { LoadingState, SortDirection } from '../../types/common.types';
import { useDebounce } from '../../hooks/useDebounce';
import { usePerformanceTracking } from '../../hooks/usePerformanceTracking';

// Styled components following Material Design and responsive requirements
const PageContainer = styled(Box)(({ theme }) => ({
  maxWidth: '1440px',
  margin: '0 auto',
  padding: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const PageHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
  padding: `0 calc(100% / 2.618)`, // Golden ratio
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

const FilterSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    width: '100%',
  },
}));

// Custom hooks for project management
const useProjectFilters = () => {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    sortDirection: SortDirection.DESC,
  });

  const debouncedSearch = useDebounce(filters.search, 300);

  const updateFilters = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    filters,
    debouncedSearch,
    updateFilters,
  };
};

const useWebSocketConnection = () => {
  const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080/ws/projects';
  
  const { 
    sendMessage, 
    lastMessage, 
    readyState 
  } = useWebSocket(WS_URL, {
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    shouldReconnect: true,
  });

  useEffect(() => {
    if (lastMessage) {
      // Handle real-time project updates
      const update = JSON.parse(lastMessage.data);
      // Dispatch update to Redux store
    }
  }, [lastMessage]);

  return { sendMessage, readyState };
};

// Main component with performance optimization
const ProjectListPage: React.FC = React.memo(() => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { trackPerformance } = usePerformanceTracking();
  const { filters, debouncedSearch, updateFilters } = useProjectFilters();
  const { readyState } = useWebSocketConnection();

  // Redux selectors
  const projects = useSelector((state: any) => state.projects.items);
  const loadingState = useSelector((state: any) => state.projects.loadingState);
  const error = useSelector((state: any) => state.projects.error);

  // Memoized project list with filtering and sorting
  const filteredProjects = useMemo(() => {
    return projects
      .filter((project: Project) => {
        const matchesSearch = project.name
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase());
        const matchesStatus = !filters.status || project.status === filters.status;
        return matchesSearch && matchesStatus;
      })
      .sort((a: Project, b: Project) => {
        return filters.sortDirection === SortDirection.DESC
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [projects, debouncedSearch, filters.status, filters.sortDirection]);

  // Virtual list row renderer
  const renderRow = useCallback(({ index, style }: any) => {
    const project = filteredProjects[index];
    return (
      <Box style={style}>
        <ProjectCard project={project} />
      </Box>
    );
  }, [filteredProjects]);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      trackPerformance('projectListLoad');
      dispatch({ type: 'FETCH_PROJECTS_REQUEST' });
    };
    loadProjects();
  }, [dispatch, trackPerformance]);

  if (loadingState === LoadingState.ERROR) {
    return (
      <PageContainer>
        <Alert severity="error">{error}</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        <FilterSection>
          <TextField
            placeholder="Search projects..."
            value={filters.search}
            onChange={(e) => updateFilters('search', e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon />,
            }}
            size={isMobile ? 'small' : 'medium'}
            fullWidth={isMobile}
          />
          <Select
            value={filters.status}
            onChange={(e) => updateFilters('status', e.target.value)}
            displayEmpty
            size={isMobile ? 'small' : 'medium'}
            fullWidth={isMobile}
          >
            <MenuItem value="">All Status</MenuItem>
            {Object.values(ProjectStatus).map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </Select>
          <IconButton
            onClick={() => updateFilters('sortDirection',
              filters.sortDirection === SortDirection.DESC
                ? SortDirection.ASC
                : SortDirection.DESC
            )}
          >
            <FilterIcon />
          </IconButton>
        </FilterSection>
      </PageHeader>

      {loadingState === LoadingState.LOADING ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <VirtualList
          height={window.innerHeight - 200}
          width="100%"
          itemCount={filteredProjects.length}
          itemSize={() => 100}
          overscanCount={5}
        >
          {renderRow}
        </VirtualList>
      )}
    </PageContainer>
  );
});

ProjectListPage.displayName = 'ProjectListPage';

export default ProjectListPage;