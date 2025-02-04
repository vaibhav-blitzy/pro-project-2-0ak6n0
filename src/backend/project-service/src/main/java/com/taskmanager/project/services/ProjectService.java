package com.taskmanager.project.services;

import com.taskmanager.project.entities.Project;
import com.taskmanager.project.entities.Project.ProjectStatus;
import com.taskmanager.project.dto.ProjectDTO;
import com.taskmanager.project.repositories.ProjectRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import io.micrometer.core.annotation.Monitored;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Optional;
import java.util.Map;

/**
 * Enterprise-grade service implementing comprehensive project management business logic
 * with support for caching, auditing, and advanced data lifecycle management.
 */
@Service
@Transactional(isolation = Isolation.READ_COMMITTED)
@Monitored
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final AuditService auditService;
    private final MetadataValidator metadataValidator;

    /**
     * Constructs ProjectService with required dependencies.
     */
    public ProjectService(
            ProjectRepository projectRepository,
            AuditService auditService,
            MetadataValidator metadataValidator) {
        this.projectRepository = projectRepository;
        this.auditService = auditService;
        this.metadataValidator = metadataValidator;
    }

    /**
     * Creates a new project with comprehensive validation and auditing.
     *
     * @param projectDTO Project data transfer object
     * @return Created project DTO
     * @throws IllegalArgumentException if validation fails
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    @CacheEvict(value = "projects", allEntries = true)
    @Monitored
    public ProjectDTO createProject(ProjectDTO projectDTO) {
        // Validate project metadata schema
        metadataValidator.validateMetadata(projectDTO.getMetadata());

        // Check for duplicate project names for the owner
        if (projectRepository.existsByNameAndOwnerId(projectDTO.getName(), projectDTO.getOwnerId())) {
            throw new IllegalArgumentException("Project name already exists for this owner");
        }

        Project project = projectDTO.toEntity();
        project.setCreatedAt(LocalDateTime.now());
        project.setUpdatedAt(LocalDateTime.now());
        project.setStatus(ProjectStatus.DRAFT);
        project.setVersion(0L);

        Project savedProject = projectRepository.save(project);
        auditService.logProjectCreation(savedProject);

        return ProjectDTO.fromEntity(savedProject);
    }

    /**
     * Retrieves a project by ID with caching support.
     *
     * @param projectId Project UUID
     * @return Project DTO
     * @throws IllegalArgumentException if project not found
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "projects", key = "#projectId")
    @Monitored
    public ProjectDTO getProjectById(UUID projectId) {
        return projectRepository.findById(projectId)
                .map(ProjectDTO::fromEntity)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));
    }

    /**
     * Updates an existing project with optimistic locking.
     *
     * @param projectId Project UUID
     * @param projectDTO Updated project data
     * @return Updated project DTO
     * @throws IllegalArgumentException if project not found or validation fails
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    @CacheEvict(value = "projects", key = "#projectId")
    @Monitored
    public ProjectDTO updateProject(UUID projectId, ProjectDTO projectDTO) {
        Project existingProject = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));

        metadataValidator.validateMetadata(projectDTO.getMetadata());

        Project updatedProject = projectDTO.toEntity();
        updatedProject.setId(existingProject.getId());
        updatedProject.setVersion(existingProject.getVersion());
        updatedProject.setCreatedAt(existingProject.getCreatedAt());
        updatedProject.setUpdatedAt(LocalDateTime.now());

        Project savedProject = projectRepository.save(updatedProject);
        auditService.logProjectUpdate(savedProject);

        return ProjectDTO.fromEntity(savedProject);
    }

    /**
     * Archives a project and its associated data.
     *
     * @param projectId Project UUID
     * @return Archived project DTO
     * @throws IllegalArgumentException if project not found
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    @CacheEvict(value = "projects", key = "#projectId")
    @Monitored
    public ProjectDTO archiveProject(UUID projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));

        project.setStatus(ProjectStatus.ARCHIVED);
        project.setUpdatedAt(LocalDateTime.now());
        
        Project archivedProject = projectRepository.save(project);
        auditService.logProjectArchival(archivedProject);

        return ProjectDTO.fromEntity(archivedProject);
    }

    /**
     * Retrieves projects by owner with pagination.
     *
     * @param ownerId Owner UUID
     * @param pageable Pagination parameters
     * @return Page of project DTOs
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "projects", key = "'owner_' + #ownerId + '_' + #pageable")
    @Monitored
    public Page<ProjectDTO> getProjectsByOwner(UUID ownerId, Pageable pageable) {
        return projectRepository.findByOwnerId(ownerId, pageable)
                .map(ProjectDTO::fromEntity);
    }

    /**
     * Searches projects by name pattern with pagination.
     *
     * @param namePattern Name search pattern
     * @param pageable Pagination parameters
     * @return Page of project DTOs
     */
    @Transactional(readOnly = true)
    @Monitored
    public Page<ProjectDTO> searchProjectsByName(String namePattern, Pageable pageable) {
        return projectRepository.findByNameContainingIgnoreCase(namePattern, pageable)
                .map(ProjectDTO::fromEntity);
    }

    /**
     * Updates project metadata with validation.
     *
     * @param projectId Project UUID
     * @param metadata Updated metadata
     * @return Updated project DTO
     * @throws IllegalArgumentException if project not found or validation fails
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    @CacheEvict(value = "projects", key = "#projectId")
    @Monitored
    public ProjectDTO updateProjectMetadata(UUID projectId, Map<String, Object> metadata) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));

        metadataValidator.validateMetadata(metadata);
        project.setMetadata(metadata);
        project.setUpdatedAt(LocalDateTime.now());

        Project savedProject = projectRepository.save(project);
        auditService.logMetadataUpdate(savedProject);

        return ProjectDTO.fromEntity(savedProject);
    }
}