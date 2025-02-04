package com.taskmanager.task.repositories;

import com.taskmanager.task.entities.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.stereotype.Repository;
import javax.persistence.QueryHint;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Repository interface for Task entity providing optimized CRUD and custom query operations.
 * Implements pagination and performance optimizations to meet the 500ms response time SLA.
 * 
 * @version 2.7.0
 */
@Repository
public interface TaskRepository extends JpaRepository<Task, UUID> {

    /**
     * Retrieves all tasks assigned to a specific user with pagination support.
     * Optimized for read-only operations to improve performance.
     *
     * @param assigneeId ID of the user to whom tasks are assigned
     * @param pageable pagination parameters
     * @return Page of tasks assigned to the user
     */
    @QueryHints(value = @QueryHint(name = "org.hibernate.readOnly", value = "true"))
    Page<Task> findByAssigneeId(UUID assigneeId, Pageable pageable);

    /**
     * Retrieves all tasks belonging to a specific project with pagination support.
     * Utilizes database indexing on project_id for optimal performance.
     *
     * @param projectId ID of the project
     * @param pageable pagination parameters
     * @return Page of tasks in the project
     */
    @QueryHints(value = @QueryHint(name = "org.hibernate.readOnly", value = "true"))
    Page<Task> findByProjectId(UUID projectId, Pageable pageable);

    /**
     * Retrieves all tasks with a specific status with pagination support.
     * Optimized for filtering and status-based queries.
     *
     * @param status status of the tasks to retrieve
     * @param pageable pagination parameters
     * @return Page of tasks with the specified status
     */
    @QueryHints(value = @QueryHint(name = "org.hibernate.readOnly", value = "true"))
    Page<Task> findByStatus(TaskStatus status, Pageable pageable);

    /**
     * Retrieves all tasks due before a specific date with pagination support.
     * Supports deadline tracking and overdue task management.
     *
     * @param dueDate cutoff date for task due dates
     * @param pageable pagination parameters
     * @return Page of tasks due before the specified date
     */
    @QueryHints(value = @QueryHint(name = "org.hibernate.readOnly", value = "true"))
    Page<Task> findByDueDateBefore(LocalDateTime dueDate, Pageable pageable);

    /**
     * Retrieves tasks assigned to a user with specific status using pagination.
     * Combines assignee and status filtering for targeted task lists.
     *
     * @param assigneeId ID of the assigned user
     * @param status status of the tasks
     * @param pageable pagination parameters
     * @return Page of tasks matching the criteria
     */
    @QueryHints(value = @QueryHint(name = "org.hibernate.readOnly", value = "true"))
    Page<Task> findByAssigneeIdAndStatus(UUID assigneeId, TaskStatus status, Pageable pageable);

    /**
     * Counts tasks in a project with specific status using optimized query.
     * Supports project metrics and dashboard statistics.
     *
     * @param projectId ID of the project
     * @param status status of the tasks to count
     * @return Count of matching tasks
     */
    @Query("SELECT COUNT(t) FROM Task t WHERE t.projectId = :projectId AND t.status = :status")
    Long countByProjectIdAndStatus(UUID projectId, TaskStatus status);
}