package com.taskmanager.project.entities;

import javax.persistence.Entity;  // javax.persistence 2.2
import javax.persistence.Table;
import javax.persistence.Id;
import javax.persistence.GeneratedValue;
import javax.persistence.Column;
import javax.persistence.Version;
import javax.persistence.EntityListeners;
import javax.persistence.Convert;
import javax.persistence.GenerationType;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;

import lombok.Getter;  // lombok 1.18.22
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import org.springframework.data.jpa.domain.support.AuditingEntityListener;  // spring-data-jpa 3.0.0

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "projects")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "status", nullable = false)
    private ProjectStatus status = ProjectStatus.DRAFT;

    @Column(name = "start_date")
    private LocalDateTime startDate;

    @Column(name = "end_date")
    private LocalDateTime endDate;

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
    private Long version = 0L;

    @Convert(converter = MetadataConverter.class)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata = new HashMap<>();

    @PrePersist
    protected void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
        
        if (metadata == null) {
            metadata = new HashMap<>();
        }
        
        if (version == null) {
            version = 0L;
        }
        
        if (status == null) {
            status = ProjectStatus.DRAFT;
        }
    }

    @PreUpdate
    protected void preUpdate() {
        updatedAt = LocalDateTime.now();
        
        if (metadata == null) {
            metadata = new HashMap<>();
        }
    }

    public enum ProjectStatus {
        DRAFT,
        ACTIVE,
        ON_HOLD,
        COMPLETED,
        ARCHIVED
    }
}