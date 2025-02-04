package com.taskmanager.task.dto;

import com.fasterxml.jackson.annotation.JsonFormat; // v2.13.0
import com.fasterxml.jackson.annotation.JsonInclude; // v2.13.0
import com.fasterxml.jackson.annotation.JsonProperty; // v2.13.0
import com.fasterxml.jackson.databind.JsonNode;
import com.taskmanager.task.entities.Task;
import com.taskmanager.task.entities.TaskPriority;
import com.taskmanager.task.entities.TaskStatus;
import lombok.Builder; // v1.18.22
import lombok.Getter; // v1.18.22
import lombok.Setter; // v1.18.22

import javax.validation.Valid;
import javax.validation.constraints.Future;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Data Transfer Object for Task entities with comprehensive validation and business rule enforcement.
 * Provides a clean API contract for task-related operations while ensuring data integrity.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TaskDTO {

    @JsonProperty("id")
    private UUID id;

    @NotNull(message = "Task title is required")
    @Size(min = 1, max = 255, message = "Task title must be between 1 and 255 characters")
    @JsonProperty("title")
    private String title;

    @Size(max = 4000, message = "Task description cannot exceed 4000 characters")
    @JsonProperty("description")
    private String description;

    @NotNull(message = "Project ID is required")
    @JsonProperty("projectId")
    private UUID projectId;

    @JsonProperty("assigneeId")
    private UUID assigneeId;

    @NotNull(message = "Task priority is required")
    @JsonProperty("priority")
    private TaskPriority priority;

    @NotNull(message = "Task status is required")
    @JsonProperty("status")
    private TaskStatus status;

    @Future(message = "Due date must be in the future")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    @JsonProperty("dueDate")
    private LocalDateTime dueDate;

    @Valid
    @JsonProperty("customFields")
    private JsonNode customFields;

    /**
     * Protected constructor for TaskDTO with validation.
     * Use the builder pattern for object creation.
     */
    protected TaskDTO() {
        // Protected constructor for builder pattern
    }

    /**
     * Creates a validated DTO from a Task entity.
     *
     * @param task The source Task entity
     * @return A new validated TaskDTO instance
     * @throws IllegalArgumentException if the task is null or invalid
     */
    public static TaskDTO fromEntity(@NotNull(message = "Task entity cannot be null") Task task) {
        if (task == null) {
            throw new IllegalArgumentException("Task entity cannot be null");
        }

        return TaskDTO.builder()
                .id(task.getId())
                .title(task.getTitle())
                .description(task.getDescription())
                .projectId(task.getProjectId())
                .assigneeId(task.getAssigneeId())
                .priority(task.getPriority())
                .status(task.getStatus())
                .dueDate(task.getDueDate())
                .customFields(task.getCustomFields())
                .build();
    }

    /**
     * Converts this DTO to a Task entity with validation.
     *
     * @return A new Task entity populated with validated DTO data
     * @throws IllegalStateException if the DTO state is invalid
     */
    public Task toEntity() {
        validateState();
        
        return Task.builder()
                .id(this.id)
                .title(this.title)
                .description(this.description)
                .projectId(this.projectId)
                .assigneeId(this.assigneeId)
                .priority(this.priority)
                .status(this.status)
                .dueDate(this.dueDate)
                .customFields(this.customFields)
                .build();
    }

    /**
     * Validates the current state of the DTO according to business rules.
     *
     * @throws IllegalStateException if validation fails
     */
    private void validateState() {
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalStateException("Task title is required");
        }

        if (projectId == null) {
            throw new IllegalStateException("Project ID is required");
        }

        if (priority == null) {
            throw new IllegalStateException("Task priority is required");
        }

        if (status == null) {
            throw new IllegalStateException("Task status is required");
        }

        if (dueDate != null && dueDate.isBefore(LocalDateTime.now())) {
            throw new IllegalStateException("Due date must be in the future");
        }

        if (customFields != null && !customFields.isObject()) {
            throw new IllegalStateException("Custom fields must be a valid JSON object");
        }
    }
}