package com.taskmanager.task.controllers;

import com.taskmanager.task.services.TaskService;
import com.taskmanager.task.dto.TaskDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import javax.validation.Valid;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * REST controller implementing the task management API endpoints.
 * Provides CRUD operations for tasks with validation, caching, and performance optimizations.
 * 
 * @version 2.0.0
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tasks")
@Validated
@Tag(name = "Task Management", description = "API endpoints for task operations")
public class TaskController {

    private final TaskService taskService;
    private final CacheControl cacheControl;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
        this.cacheControl = CacheControl.maxAge(10, TimeUnit.MINUTES)
                                      .noTransform()
                                      .mustRevalidate();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create new task", description = "Creates a new task with validation")
    @ApiResponse(responseCode = "201", description = "Task created successfully")
    @RateLimiter(name = "taskCreation")
    public ResponseEntity<TaskDTO> createTask(@Valid @RequestBody TaskDTO taskDTO) {
        log.debug("REST request to create Task: {}", taskDTO);
        TaskDTO result = taskService.createTask(taskDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get task by ID", description = "Retrieves a task by its ID")
    @ApiResponse(responseCode = "200", description = "Task found")
    @ApiResponse(responseCode = "404", description = "Task not found")
    public ResponseEntity<TaskDTO> getTask(@PathVariable UUID id) {
        log.debug("REST request to get Task: {}", id);
        TaskDTO taskDTO = taskService.getTask(id);
        return ResponseEntity.ok()
                           .cacheControl(cacheControl)
                           .body(taskDTO);
    }

    @GetMapping("/project/{projectId}")
    @Operation(summary = "Get tasks by project", description = "Retrieves all tasks for a project")
    public ResponseEntity<Page<TaskDTO>> getTasksByProject(
            @PathVariable UUID projectId,
            Pageable pageable) {
        log.debug("REST request to get Tasks for Project: {}", projectId);
        Page<TaskDTO> page = taskService.getTasksByProject(projectId, pageable);
        return ResponseEntity.ok()
                           .cacheControl(cacheControl)
                           .body(page);
    }

    @GetMapping("/assignee/{assigneeId}")
    @Operation(summary = "Get tasks by assignee", description = "Retrieves all tasks assigned to a user")
    public ResponseEntity<Page<TaskDTO>> getTasksByAssignee(
            @PathVariable UUID assigneeId,
            Pageable pageable) {
        log.debug("REST request to get Tasks for Assignee: {}", assigneeId);
        Page<TaskDTO> page = taskService.getTasksByAssignee(assigneeId, pageable);
        return ResponseEntity.ok()
                           .cacheControl(cacheControl)
                           .body(page);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update task", description = "Updates an existing task")
    @ApiResponse(responseCode = "200", description = "Task updated successfully")
    @RateLimiter(name = "taskUpdate")
    public ResponseEntity<TaskDTO> updateTask(
            @PathVariable UUID id,
            @Valid @RequestBody TaskDTO taskDTO) {
        log.debug("REST request to update Task: {}", id);
        TaskDTO result = taskService.updateTask(id, taskDTO);
        return ResponseEntity.ok().body(result);
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update task status", description = "Updates the status of an existing task")
    @RateLimiter(name = "statusUpdate")
    public ResponseEntity<TaskDTO> updateTaskStatus(
            @PathVariable UUID id,
            @RequestParam TaskStatus status) {
        log.debug("REST request to update Task status: {} to {}", id, status);
        TaskDTO result = taskService.updateTaskStatus(id, status);
        return ResponseEntity.ok().body(result);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete task", description = "Deletes an existing task")
    @ApiResponse(responseCode = "204", description = "Task deleted successfully")
    @RateLimiter(name = "taskDeletion")
    public ResponseEntity<Void> deleteTask(@PathVariable UUID id) {
        log.debug("REST request to delete Task: {}", id);
        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create multiple tasks", description = "Creates multiple tasks in a single request")
    @RateLimiter(name = "bulkCreation")
    public ResponseEntity<List<TaskDTO>> bulkCreateTasks(
            @Valid @RequestBody List<TaskDTO> taskDTOs) {
        log.debug("REST request to create {} tasks", taskDTOs.size());
        List<TaskDTO> results = taskService.bulkCreateTasks(taskDTOs);
        return ResponseEntity.status(HttpStatus.CREATED).body(results);
    }

    @PatchMapping("/bulk/status")
    @Operation(summary = "Update multiple task statuses", description = "Updates the status of multiple tasks")
    @RateLimiter(name = "bulkStatusUpdate")
    public ResponseEntity<List<TaskDTO>> bulkUpdateStatus(
            @RequestBody List<UUID> taskIds,
            @RequestParam TaskStatus status) {
        log.debug("REST request to update status of {} tasks to {}", taskIds.size(), status);
        List<TaskDTO> results = taskService.bulkUpdateStatus(taskIds, status);
        return ResponseEntity.ok().body(results);
    }
}