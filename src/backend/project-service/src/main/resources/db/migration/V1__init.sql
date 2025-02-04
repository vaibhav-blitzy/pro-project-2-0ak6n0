-- Initial database migration script for the project service
-- Version: V1
-- Description: Creates the projects table with all required fields, constraints, and indexes
-- External dependency: Flyway 8.5.0

-- Create projects table with enhanced structure
CREATE TABLE projects (
    -- Primary identifier
    id UUID PRIMARY KEY,
    
    -- Core project attributes
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    
    -- Timeline fields
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    
    -- Optimistic locking support
    version BIGINT NOT NULL DEFAULT 0,
    
    -- Flexible attributes storage
    metadata JSONB,
    
    -- Additional constraints
    CONSTRAINT chk_projects_dates CHECK (
        (start_date IS NULL AND end_date IS NULL) OR
        (start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= end_date)
    ),
    CONSTRAINT chk_projects_status CHECK (
        status IN ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')
    )
);

-- Create index for owner-based queries
CREATE INDEX idx_projects_owner ON projects(owner_id);

-- Create index for status-based filtering
CREATE INDEX idx_projects_status ON projects(status);

-- Create index for name-based searches
CREATE INDEX idx_projects_name ON projects(name);

-- Create composite index for date range queries
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);

-- Create GIN index for JSONB metadata queries
CREATE INDEX idx_projects_metadata ON projects USING GIN (metadata);

-- Create trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_projects_updated_at();

-- Add comments for documentation
COMMENT ON TABLE projects IS 'Stores project information with enhanced support for flexible attributes and optimistic locking';
COMMENT ON COLUMN projects.id IS 'Unique identifier for the project';
COMMENT ON COLUMN projects.metadata IS 'Flexible JSONB storage for additional project attributes';
COMMENT ON COLUMN projects.version IS 'Optimistic locking version number';