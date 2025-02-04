import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // ^18.0.0
import styled from '@emotion/styled'; // ^11.11.0
import { AutoSizer, List, WindowScroller } from 'react-virtualized'; // ^9.22.3
import { ComponentSize, SortDirection } from '../../types/common.types';

// Interfaces
interface TableColumn {
  key: string;
  title: string;
  sortable?: boolean;
  width?: number;
  resizable?: boolean;
  hidden?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  frozen?: boolean;
  sortFn?: (a: any, b: any) => number;
}

interface TableProps {
  columns: TableColumn[];
  data: any[];
  size?: ComponentSize;
  loading?: boolean;
  sortable?: boolean;
  paginated?: boolean;
  virtualized?: boolean;
  pageSize?: number;
  className?: string;
  selectable?: boolean;
  resizableColumns?: boolean;
  ariaLabel?: string;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, direction: SortDirection) => void;
  onSelectionChange?: (selectedRows: any[]) => void;
}

// Styled Components
const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
  min-height: 200px;
  
  @media (max-width: 768px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  &:focus-within {
    outline: 2px solid #1976d2;
    outline-offset: 2px;
  }
`;

const StyledTable = styled.table<{ size: ComponentSize }>`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: ${({ size }) => 
    size === ComponentSize.SMALL ? '0.75rem' : 
    size === ComponentSize.LARGE ? '1rem' : 
    '0.875rem'
  };
  table-layout: fixed;
  position: relative;
`;

const TableHeader = styled.thead`
  background-color: #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const TableHeaderCell = styled.th<{ 
  width?: number; 
  align?: string;
  sortable?: boolean;
  resizable?: boolean 
}>`
  padding: 12px 16px;
  text-align: ${({ align }) => align || 'left'};
  font-weight: 600;
  color: #424242;
  white-space: nowrap;
  width: ${({ width }) => width ? `${width}px` : 'auto'};
  cursor: ${({ sortable }) => sortable ? 'pointer' : 'default'};
  position: relative;
  
  ${({ resizable }) => resizable && `
    &::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      height: 100%;
      width: 4px;
      cursor: col-resize;
      background-color: #e0e0e0;
    }
  `}
  
  &:hover {
    background-color: ${({ sortable }) => sortable ? '#eeeeee' : 'inherit'};
  }
`;

const TableBody = styled.tbody`
  background-color: #ffffff;
`;

const TableRow = styled.tr<{ selected?: boolean }>`
  &:hover {
    background-color: #f5f5f5;
  }
  
  ${({ selected }) => selected && `
    background-color: #e3f2fd;
    &:hover {
      background-color: #bbdefb;
    }
  `}
`;

const TableCell = styled.td<{ align?: string }>`
  padding: 12px 16px;
  text-align: ${({ align }) => align || 'left'};
  color: #212121;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Custom Hooks
const useVirtualization = (itemCount: number, itemHeight: number, containerHeight: number) => {
  const overscanCount = 5;
  
  return useMemo(() => ({
    itemCount,
    itemHeight,
    overscanCount,
    height: containerHeight,
    rowRenderer: ({ index, style }: { index: number; style: React.CSSProperties }) => ({
      index,
      style: {
        ...style,
        width: '100%'
      }
    })
  }), [itemCount, itemHeight, containerHeight]);
};

// Main Component
export const Table: React.FC<TableProps> = ({
  columns,
  data,
  size = ComponentSize.MEDIUM,
  loading = false,
  sortable = true,
  paginated = false,
  virtualized = false,
  pageSize = 10,
  className,
  selectable = false,
  resizableColumns = false,
  ariaLabel,
  onPageChange,
  onSort,
  onSelectionChange
}) => {
  const [selectedRows, setSelectedRows] = useState<Set<any>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingColumn = useRef<string | null>(null);

  // Handle column sorting
  const handleSort = useCallback((columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    const newDirection = sortConfig?.key === columnKey && sortConfig.direction === SortDirection.ASC
      ? SortDirection.DESC
      : SortDirection.ASC;

    setSortConfig({ key: columnKey, direction: newDirection });
    onSort?.(columnKey, newDirection);
  }, [columns, sortConfig, onSort]);

  // Handle row selection
  const handleRowSelect = useCallback((row: any) => {
    setSelectedRows(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(row)) {
        newSelection.delete(row);
      } else {
        newSelection.add(row);
      }
      return newSelection;
    });
  }, []);

  // Handle column resize
  const handleColumnResize = useCallback((columnKey: string, width: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [columnKey]: Math.max(50, width)
    }));
  }, []);

  // Effect to notify selection changes
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedRows));
  }, [selectedRows, onSelectionChange]);

  // Virtualization configuration
  const virtualConfig = useVirtualization(
    data.length,
    48, // Default row height
    tableRef.current?.clientHeight || 400
  );

  // Render table header
  const renderHeader = () => (
    <TableHeader>
      <tr>
        {selectable && (
          <TableHeaderCell width={48}>
            <input
              type="checkbox"
              onChange={() => {
                setSelectedRows(prev => 
                  prev.size === data.length ? new Set() : new Set(data)
                );
              }}
              checked={selectedRows.size === data.length}
              aria-label="Select all rows"
            />
          </TableHeaderCell>
        )}
        {columns.filter(col => !col.hidden).map(column => (
          <TableHeaderCell
            key={column.key}
            width={columnWidths[column.key] || column.width}
            align={column.align}
            sortable={sortable && column.sortable}
            resizable={resizableColumns && column.resizable}
            onClick={() => sortable && column.sortable && handleSort(column.key)}
            aria-sort={sortConfig?.key === column.key ? 
              sortConfig.direction.toLowerCase() : undefined}
          >
            {column.title}
            {sortConfig?.key === column.key && (
              <span aria-hidden="true">
                {sortConfig.direction === SortDirection.ASC ? ' ↑' : ' ↓'}
              </span>
            )}
          </TableHeaderCell>
        ))}
      </tr>
    </TableHeader>
  );

  // Render table rows
  const renderRow = (row: any, index: number) => (
    <TableRow
      key={row.id || index}
      selected={selectedRows.has(row)}
      onClick={() => selectable && handleRowSelect(row)}
    >
      {selectable && (
        <TableCell>
          <input
            type="checkbox"
            checked={selectedRows.has(row)}
            onChange={() => handleRowSelect(row)}
            aria-label={`Select row ${index + 1}`}
          />
        </TableCell>
      )}
      {columns.filter(col => !col.hidden).map(column => (
        <TableCell
          key={column.key}
          align={column.align}
        >
          {column.render ? column.render(row[column.key], row) : row[column.key]}
        </TableCell>
      ))}
    </TableRow>
  );

  return (
    <TableContainer className={className}>
      <StyledTable
        ref={tableRef}
        size={size}
        role="grid"
        aria-label={ariaLabel}
        aria-busy={loading}
      >
        {renderHeader()}
        <TableBody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                <div role="status" aria-label="Loading data">
                  Loading...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                No data available
              </td>
            </tr>
          ) : virtualized ? (
            <WindowScroller>
              {({ height, isScrolling, onChildScroll, scrollTop }) => (
                <AutoSizer disableHeight>
                  {({ width }) => (
                    <List
                      autoHeight
                      height={height}
                      width={width}
                      isScrolling={isScrolling}
                      onScroll={onChildScroll}
                      scrollTop={scrollTop}
                      rowCount={data.length}
                      rowHeight={virtualConfig.itemHeight}
                      rowRenderer={({ index, style }) => (
                        <div style={style}>
                          {renderRow(data[index], index)}
                        </div>
                      )}
                      overscanRowCount={virtualConfig.overscanCount}
                    />
                  )}
                </AutoSizer>
              )}
            </WindowScroller>
          ) : (
            data.map((row, index) => renderRow(row, index))
          )}
        </TableBody>
      </StyledTable>
    </TableContainer>
  );
};

export type { TableColumn, TableProps };