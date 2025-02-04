package com.taskmanager.project.repositories;

// Spring Data JPA - version 2.7.0
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

// Project entity and related imports
import com.taskmanager.project.entities.Project;
import com.taskmanager.project.entities.Project.ProjectStatus;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Repository interface for Project entity providing comprehensive data access operations
 * with optimized query methods and pagination support for efficient project management.
 */
@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {

    /**
     * Retrieves a paginated list of projects owned by a specific user.
     * Uses index on owner_id for optimized query performance.
     *
     * @param ownerId ID of the project owner
     * @param pageable pagination parameters including size, page number, and sorting
     * @return Page of projects with total count and pagination metadata
     */
    Page<Project> findByOwnerId(UUID ownerId, Pageable pageable);

    /**
     * Retrieves a paginated list of projects with a specific status.
     * Uses index on status field for efficient filtering.
     *
     * @param status project status to filter by
     * @param pageable pagination parameters including size, page number, and sorting
     * @return Page of projects with total count and pagination metadata
     */
    Page<Project> findByStatus(ProjectStatus status, Pageable pageable);

    /**
     * Performs case-insensitive search for projects by name pattern.
     * Uses database index for optimized text search performance.
     *
     * @param name project name pattern to search for
     * @param pageable pagination parameters including size, page number, and sorting
     * @return Page of projects matching the name pattern with pagination metadata
     */
    @Query("SELECT p FROM Project p WHERE LOWER(p.name) LIKE LOWER(CONCAT('%', :name, '%'))")
    Page<Project> findByNameContainingIgnoreCase(String name, Pageable pageable);

    /**
     * Retrieves projects with start dates within the specified date range.
     * Uses index on start_date for efficient date-based queries.
     *
     * @param startDate start of the date range
     * @param endDate end of the date range
     * @param pageable pagination parameters including size, page number, and sorting
     * @return Page of projects within the date range with pagination metadata
     */
    Page<Project> findByStartDateBetween(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);

    /**
     * Retrieves active projects owned by a specific user.
     * Combines status and owner filtering with optimized query execution.
     *
     * @param ownerId ID of the project owner
     * @param status project status (typically ACTIVE)
     * @param pageable pagination parameters including size, page number, and sorting
     * @return Page of active projects for the specified owner
     */
    Page<Project> findByOwnerIdAndStatus(UUID ownerId, ProjectStatus status, Pageable pageable);

    /**
     * Retrieves projects updated after a specific timestamp.
     * Useful for synchronization and change tracking.
     *
     * @param updatedAt timestamp to filter by
     * @param pageable pagination parameters including size, page number, and sorting
     * @return Page of projects updated after the specified timestamp
     */
    Page<Project> findByUpdatedAtAfter(LocalDateTime updatedAt, Pageable pageable);

    /**
     * Checks if a project with the given name exists for an owner.
     * Used for validation during project creation.
     *
     * @param name project name to check
     * @param ownerId ID of the project owner
     * @return true if a project with the name exists for the owner
     */
    boolean existsByNameAndOwnerId(String name, UUID ownerId);
}