-- Flyway migration V1: Initial schema setup for task management system
-- Version: 8.0.0

-- Create custom types for task status and priority with ordered values
CREATE TYPE task_status AS ENUM (
    'TODO',
    'IN_PROGRESS',
    'REVIEW',
    'DONE'
);

CREATE TYPE task_priority AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH'
);

-- Create the main tasks table with comprehensive tracking and auditing
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT,
    project_id UUID NOT NULL,
    assignee_id UUID,
    priority task_priority NOT NULL,
    status task_status NOT NULL DEFAULT 'TODO',
    due_date TIMESTAMP,
    custom_fields JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    CONSTRAINT valid_dates CHECK (
        (due_date IS NULL OR due_date > created_at) AND
        updated_at >= created_at
    )
);

-- Create task dependencies table with cycle prevention
CREATE TABLE task_dependencies (
    id UUID PRIMARY KEY,
    source_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL CHECK (
        dependency_type IN ('BLOCKS', 'RELATES_TO', 'DUPLICATES')
    ),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    CONSTRAINT no_self_dependency CHECK (source_task_id != target_task_id),
    CONSTRAINT unique_dependency UNIQUE (source_task_id, target_task_id, dependency_type)
);

-- Create task comments table with content validation
CREATE TABLE task_comments (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255) NOT NULL
);

-- Create task attachments table with file metadata
CREATE TABLE task_attachments (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL CHECK (length(trim(file_name)) > 0),
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    storage_path VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL
);

-- Create optimized indexes for common query patterns
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_assignee_due_date ON tasks(assignee_id, due_date);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_attachments_task ON task_attachments(task_id);

-- Create GIN index for JSONB custom fields
CREATE INDEX idx_tasks_custom_fields ON tasks USING gin(custom_fields);

-- Create partial index for active tasks
CREATE INDEX idx_active_tasks ON tasks(project_id, assignee_id) 
WHERE status != 'DONE';

-- Create trigger function for updating timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_tasks_timestamp
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_comments_timestamp
    BEFORE UPDATE ON task_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Create function to prevent dependency cycles
CREATE OR REPLACE FUNCTION prevent_dependency_cycles()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        WITH RECURSIVE dependency_chain AS (
            SELECT target_task_id, 1 AS level
            FROM task_dependencies
            WHERE source_task_id = NEW.target_task_id
            UNION ALL
            SELECT td.target_task_id, dc.level + 1
            FROM task_dependencies td
            JOIN dependency_chain dc ON dc.target_task_id = td.source_task_id
            WHERE dc.level < 100
        )
        SELECT 1
        FROM dependency_chain
        WHERE target_task_id = NEW.source_task_id
    ) THEN
        RAISE EXCEPTION 'Dependency cycle detected';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for dependency cycle prevention
CREATE TRIGGER prevent_task_dependency_cycles
    BEFORE INSERT OR UPDATE ON task_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION prevent_dependency_cycles();