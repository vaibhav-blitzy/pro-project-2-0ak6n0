package com.taskmanager.task.entities;

import javax.persistence.*; // JPA 2.2
import com.fasterxml.jackson.databind.JsonNode; // Jackson 2.13.0
import org.hibernate.annotations.Type; // Hibernate 5.6.0
import org.hibernate.annotations.TypeDef; // Hibernate 5.6.0
import lombok.Getter; // Lombok 1.18.22
import lombok.Setter; // Lombok 1.18.22
import lombok.Builder; // Lombok 1.18.22
import lombok.NoArgsConstructor; // Lombok 1.18.22
import lombok.AllArgsConstructor; // Lombok 1.18.22
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Task entity representing a task in the task management system.
 * Implements comprehensive audit trail, status tracking, and custom fields support.
 */
@Entity
@Table(name = "tasks", indexes = {
    @Index(name = "idx_task_project", columnList = "project_id"),
    @Index(name = "idx_task_assignee", columnList = "assignee_id")
})
@EntityListeners(AuditingEntityListener.class)
@TypeDef(name = "json", typeClass = JsonType.class)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "assignee_id")
    private UUID assigneeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false)
    private TaskPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TaskStatus status;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Type(type = "json")
    @Column(name = "custom_fields", columnDefinition = "jsonb")
    private JsonNode customFields;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private String createdBy;

    @Column(name = "updated_by", nullable = false)
    private String updatedBy;

    @Version
    @Column(name = "version")
    private Long version;

    /**
     * JPA callback executed before persisting a new task.
     * Initializes audit fields and performs validation.
     */
    @PrePersist
    protected void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        this.version = 1L;
        
        if (this.status == null) {
            this.status = TaskStatus.CREATED;
        }
        
        validateCustomFields();
    }

    /**
     * JPA callback executed before updating an existing task.
     * Updates audit fields and performs validation.
     */
    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = LocalDateTime.now();
        validateCustomFields();
        validateStatusTransition();
    }

    /**
     * Validates the structure of custom fields JSON data.
     * @throws IllegalArgumentException if custom fields are invalid
     */
    private void validateCustomFields() {
        if (customFields != null && !customFields.isObject()) {
            throw new IllegalArgumentException("Custom fields must be a valid JSON object");
        }
    }

    /**
     * Validates task status transitions according to business rules.
     * @throws IllegalStateException if status transition is invalid
     */
    private void validateStatusTransition() {
        // Status transition validation logic to be implemented based on business rules
    }
}