package com.taskmanager.project.dto;

import com.fasterxml.jackson.annotation.JsonFormat; // jackson-annotations 2.13.0
import com.fasterxml.jackson.annotation.JsonView; // jackson-annotations 2.13.0
import com.taskmanager.project.entities.Project;
import com.taskmanager.project.entities.Project.ProjectStatus;
import lombok.AllArgsConstructor; // lombok 1.18.22
import lombok.Builder; // lombok 1.18.22
import lombok.Getter; // lombok 1.18.22
import lombok.NoArgsConstructor; // lombok 1.18.22
import lombok.Setter; // lombok 1.18.22

import javax.validation.Valid; // javax.validation 2.0.1.Final
import javax.validation.constraints.NotNull; // javax.validation 2.0.1.Final
import javax.validation.constraints.Size; // javax.validation 2.0.1.Final
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Data Transfer Object for Project entities with enhanced validation and serialization support.
 * Handles project data transfer between service layer and API endpoints.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectDTO {

    public interface BasicView {}
    public interface DetailedView extends BasicView {}

    @JsonView(BasicView.class)
    private UUID id;

    @NotNull(message = "Project name is required")
    @Size(min = 3, max = 100, message = "Project name must be between 3 and 100 characters")
    @JsonView(BasicView.class)
    private String name;

    @Size(max = 1000, message = "Description cannot exceed 1000 characters")
    @JsonView(BasicView.class)
    private String description;

    @NotNull(message = "Owner ID is required")
    @JsonView(BasicView.class)
    private UUID ownerId;

    @NotNull(message = "Project status is required")
    @JsonView(BasicView.class)
    private ProjectStatus status;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    @JsonView(DetailedView.class)
    private LocalDateTime startDate;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    @JsonView(DetailedView.class)
    private LocalDateTime endDate;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    @JsonView(DetailedView.class)
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    @JsonView(DetailedView.class)
    private LocalDateTime updatedAt;

    @Valid
    @JsonView(DetailedView.class)
    private Map<String, Object> metadata;

    /**
     * Creates a new ProjectDTO instance from a Project entity.
     * Performs validation and data transformation.
     *
     * @param project The source Project entity
     * @return A new validated ProjectDTO instance
     * @throws IllegalArgumentException if the project is null or invalid
     */
    public static ProjectDTO fromEntity(@NotNull Project project) {
        if (project == null) {
            throw new IllegalArgumentException("Project entity cannot be null");
        }

        return ProjectDTO.builder()
                .id(project.getId())
                .name(project.getName())
                .description(project.getDescription())
                .ownerId(project.getOwnerId())
                .status(project.getStatus())
                .startDate(project.getStartDate())
                .endDate(project.getEndDate())
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .metadata(project.getMetadata() != null ? new HashMap<>(project.getMetadata()) : new HashMap<>())
                .build();
    }

    /**
     * Converts this DTO to a Project entity.
     * Performs validation and business rule enforcement.
     *
     * @return A new validated Project entity
     * @throws IllegalStateException if the DTO contains invalid data
     */
    public Project toEntity() {
        validateBusinessRules();

        Project project = new Project();
        project.setId(this.id);
        project.setName(this.name);
        project.setDescription(this.description);
        project.setOwnerId(this.ownerId);
        project.setStatus(this.status);
        project.setStartDate(this.startDate);
        project.setEndDate(this.endDate);
        project.setMetadata(this.metadata != null ? new HashMap<>(this.metadata) : new HashMap<>());

        return project;
    }

    /**
     * Validates business rules for the project data.
     *
     * @throws IllegalStateException if any business rules are violated
     */
    private void validateBusinessRules() {
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw new IllegalStateException("End date cannot be before start date");
        }

        if (status == ProjectStatus.COMPLETED && endDate == null) {
            throw new IllegalStateException("Completed projects must have an end date");
        }

        if (metadata != null && metadata.size() > 100) {
            throw new IllegalStateException("Metadata cannot contain more than 100 entries");
        }
    }
}