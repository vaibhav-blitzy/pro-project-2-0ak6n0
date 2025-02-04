package com.taskmanager.project.controllers;

import com.taskmanager.project.services.ProjectService;
import com.taskmanager.project.dto.ProjectDTO;
import com.taskmanager.project.entities.Project.ProjectStatus;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.Parameter;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.util.UUID;
import java.time.LocalDateTime;
import java.util.concurrent.TimeUnit;

/**
 * REST controller implementing project management API endpoints with comprehensive validation,
 * rate limiting, monitoring, and error handling capabilities.
 */
@RestController
@RequestMapping("/api/v1/projects")
@Tag(name = "Project Management", description = "APIs for project lifecycle management")
@Validated
public class ProjectController {

    private final ProjectService projectService;
    private final MeterRegistry meterRegistry;
    private final Timer createProjectTimer;
    private final Timer getProjectTimer;
    private final Timer updateProjectTimer;

    /**
     * Constructs ProjectController with required dependencies.
     */
    public ProjectController(ProjectService projectService, MeterRegistry meterRegistry) {
        this.projectService = projectService;
        this.meterRegistry = meterRegistry;
        
        // Initialize performance metrics
        this.createProjectTimer = Timer.builder("project.create")
                .description("Time taken to create projects")
                .register(meterRegistry);
        this.getProjectTimer = Timer.builder("project.get")
                .description("Time taken to retrieve projects")
                .register(meterRegistry);
        this.updateProjectTimer = Timer.builder("project.update")
                .description("Time taken to update projects")
                .register(meterRegistry);
    }

    /**
     * Creates a new project with validation.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create new project", description = "Creates a new project with validation")
    @ApiResponse(responseCode = "201", description = "Project created successfully")
    @RateLimiter(name = "projectApi")
    public ResponseEntity<ProjectDTO> createProject(
            @Valid @RequestBody ProjectDTO projectDTO) {
        return createProjectTimer.record(() -> {
            ProjectDTO createdProject = projectService.createProject(projectDTO);
            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(createdProject);
        });
    }

    /**
     * Retrieves a project by ID.
     */
    @GetMapping("/{projectId}")
    @Operation(summary = "Get project by ID", description = "Retrieves project details by ID")
    @ApiResponse(responseCode = "200", description = "Project retrieved successfully")
    @RateLimiter(name = "projectApi")
    public ResponseEntity<ProjectDTO> getProject(
            @PathVariable @NotNull UUID projectId) {
        return getProjectTimer.record(() -> {
            ProjectDTO project = projectService.getProjectById(projectId);
            return ResponseEntity.ok(project);
        });
    }

    /**
     * Updates an existing project.
     */
    @PutMapping("/{projectId}")
    @Operation(summary = "Update project", description = "Updates an existing project")
    @ApiResponse(responseCode = "200", description = "Project updated successfully")
    @RateLimiter(name = "projectApi")
    public ResponseEntity<ProjectDTO> updateProject(
            @PathVariable @NotNull UUID projectId,
            @Valid @RequestBody ProjectDTO projectDTO) {
        return updateProjectTimer.record(() -> {
            ProjectDTO updatedProject = projectService.updateProject(projectId, projectDTO);
            return ResponseEntity.ok(updatedProject);
        });
    }

    /**
     * Archives a project.
     */
    @DeleteMapping("/{projectId}")
    @Operation(summary = "Archive project", description = "Archives an existing project")
    @ApiResponse(responseCode = "200", description = "Project archived successfully")
    @RateLimiter(name = "projectApi")
    public ResponseEntity<ProjectDTO> archiveProject(
            @PathVariable @NotNull UUID projectId) {
        ProjectDTO archivedProject = projectService.archiveProject(projectId);
        return ResponseEntity.ok(archivedProject);
    }

    /**
     * Retrieves projects by owner with pagination.
     */
    @GetMapping("/owner/{ownerId}")
    @Operation(summary = "Get projects by owner", description = "Retrieves paginated list of projects for an owner")
    @ApiResponse(responseCode = "200", description = "Projects retrieved successfully")
    @RateLimiter(name = "projectApi")
    public ResponseEntity<Page<ProjectDTO>> getProjectsByOwner(
            @PathVariable @NotNull UUID ownerId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<ProjectDTO> projects = projectService.getProjectsByOwner(ownerId, pageable);
        return ResponseEntity.ok(projects);
    }

    /**
     * Searches projects by name pattern with pagination.
     */
    @GetMapping("/search")
    @Operation(summary = "Search projects", description = "Searches projects by name pattern")
    @ApiResponse(responseCode = "200", description = "Search results retrieved successfully")
    @RateLimiter(name = "projectApi")
    public ResponseEntity<Page<ProjectDTO>> searchProjects(
            @Parameter(description = "Name pattern to search for")
            @RequestParam String namePattern,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<ProjectDTO> searchResults = projectService.searchProjectsByName(namePattern, pageable);
        return ResponseEntity.ok(searchResults);
    }

    /**
     * Exception handler for validation errors.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<String> handleValidationException(IllegalArgumentException ex) {
        meterRegistry.counter("project.validation.errors").increment();
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ex.getMessage());
    }

    /**
     * Exception handler for rate limiting.
     */
    @ExceptionHandler(RuntimeException.class)
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    public ResponseEntity<String> handleRateLimitException(RuntimeException ex) {
        meterRegistry.counter("project.rate.limit.exceeded").increment();
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .body("Rate limit exceeded. Please try again later.");
    }
}