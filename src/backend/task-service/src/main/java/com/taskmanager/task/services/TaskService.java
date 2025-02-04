package com.taskmanager.task.services;

import com.taskmanager.task.entities.Task;
import com.taskmanager.task.dto.TaskDTO;
import com.taskmanager.task.repositories.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.CacheManager;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import io.micrometer.core.annotation.Timed;
import io.micrometer.core.annotation.Counted;
import lombok.extern.slf4j.Slf4j;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Optional;
import java.util.Map;

/**
 * Service implementation for task management functionality.
 * Provides business logic for task operations with enhanced caching, monitoring, and error handling.
 * 
 * @version 2.0.0
 */
@Slf4j
@Service
@Transactional(isolation = Isolation.READ_COMMITTED, timeout = 5)
public class TaskService {

    private final TaskRepository taskRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final CacheManager cacheManager;
    private final CircuitBreakerFactory circuitBreakerFactory;
    private static final String TASK_CACHE = "taskCache";
    private static final String TASK_TOPIC = "/topic/tasks";

    public TaskService(
            TaskRepository taskRepository,
            SimpMessagingTemplate messagingTemplate,
            CacheManager cacheManager,
            CircuitBreakerFactory circuitBreakerFactory) {
        this.taskRepository = taskRepository;
        this.messagingTemplate = messagingTemplate;
        this.cacheManager = cacheManager;
        this.circuitBreakerFactory = circuitBreakerFactory;
    }

    /**
     * Creates a new task with validation and real-time notification.
     *
     * @param taskDTO the task data transfer object
     * @return created task DTO
     * @throws IllegalArgumentException if validation fails
     */
    @Timed(value = "task.creation.time", description = "Time taken to create task")
    @Counted(value = "task.creation.count", description = "Number of tasks created")
    @CacheEvict(value = TASK_CACHE, allEntries = true)
    public TaskDTO createTask(@Valid TaskDTO taskDTO) {
        log.debug("Creating new task: {}", taskDTO);
        
        Task task = taskDTO.toEntity();
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        
        Task savedTask = taskRepository.save(task);
        TaskDTO createdTaskDTO = TaskDTO.fromEntity(savedTask);
        
        // Send real-time notification
        notifyTaskUpdate("TASK_CREATED", createdTaskDTO);
        
        log.info("Task created successfully with ID: {}", savedTask.getId());
        return createdTaskDTO;
    }

    /**
     * Updates an existing task with optimistic locking and cache management.
     *
     * @param taskId ID of the task to update
     * @param taskDTO updated task data
     * @return updated task DTO
     * @throws IllegalStateException if task not found or version conflict
     */
    @Timed(value = "task.update.time", description = "Time taken to update task")
    @CacheEvict(value = TASK_CACHE, key = "#taskId")
    public TaskDTO updateTask(UUID taskId, @Valid TaskDTO taskDTO) {
        log.debug("Updating task with ID: {}", taskId);
        
        return circuitBreakerFactory.create("updateTask").run(() -> {
            Task existingTask = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalStateException("Task not found: " + taskId));
            
            // Optimistic locking check
            if (!existingTask.getVersion().equals(taskDTO.getVersion())) {
                throw new IllegalStateException("Task was modified by another user");
            }
            
            Task updatedTask = taskDTO.toEntity();
            updatedTask.setId(taskId);
            updatedTask.setUpdatedAt(LocalDateTime.now());
            
            Task savedTask = taskRepository.save(updatedTask);
            TaskDTO updatedTaskDTO = TaskDTO.fromEntity(savedTask);
            
            // Send real-time notification
            notifyTaskUpdate("TASK_UPDATED", updatedTaskDTO);
            
            log.info("Task updated successfully: {}", taskId);
            return updatedTaskDTO;
        });
    }

    /**
     * Retrieves a task by ID with caching support.
     *
     * @param taskId ID of the task
     * @return task DTO if found
     * @throws IllegalStateException if task not found
     */
    @Timed(value = "task.retrieval.time", description = "Time taken to retrieve task")
    @Cacheable(value = TASK_CACHE, key = "#taskId")
    public TaskDTO getTask(UUID taskId) {
        log.debug("Retrieving task with ID: {}", taskId);
        
        return taskRepository.findById(taskId)
            .map(TaskDTO::fromEntity)
            .orElseThrow(() -> new IllegalStateException("Task not found: " + taskId));
    }

    /**
     * Retrieves tasks by assignee with pagination.
     *
     * @param assigneeId ID of the assignee
     * @param pageable pagination parameters
     * @return page of task DTOs
     */
    @Timed(value = "task.list.time", description = "Time taken to list tasks")
    @Cacheable(value = TASK_CACHE, key = "'assignee:' + #assigneeId + ':' + #pageable")
    public Page<TaskDTO> getTasksByAssignee(UUID assigneeId, Pageable pageable) {
        log.debug("Retrieving tasks for assignee: {}", assigneeId);
        
        return taskRepository.findByAssigneeId(assigneeId, pageable)
            .map(TaskDTO::fromEntity);
    }

    /**
     * Sends real-time task updates via WebSocket.
     *
     * @param eventType type of task event
     * @param taskDTO task data to send
     */
    private void notifyTaskUpdate(String eventType, TaskDTO taskDTO) {
        Map<String, Object> payload = Map.of(
            "eventType", eventType,
            "taskId", taskDTO.getId(),
            "timestamp", LocalDateTime.now(),
            "data", taskDTO
        );
        
        messagingTemplate.convertAndSend(TASK_TOPIC, payload);
        log.debug("Sent task notification: {}", eventType);
    }
}