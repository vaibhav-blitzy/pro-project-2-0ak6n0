import React, { useEffect, useRef, useCallback, memo } from 'react';
import { Portal } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { ComponentProps } from '../../interfaces/common.interface';
import Icon from './Icon';
import { ComponentSize } from '../../types/common.types';

/**
 * Modal size configuration mapping following Material Design 3.0 specs
 */
const MODAL_SIZES = {
  sm: '400px',
  md: '600px',
  lg: '800px',
  full: '100%',
} as const;

/**
 * Props interface for Modal component extending base ComponentProps
 */
interface ModalProps extends ComponentProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof MODAL_SIZES;
  title?: string;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  disableEscapeKey?: boolean;
  onAfterOpen?: () => void;
  onBeforeClose?: () => void;
  contentStyles?: React.CSSProperties;
}

/**
 * Styled overlay component with animation and accessibility support
 */
const StyledOverlay = styled('div')(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(2px)',
  zIndex: theme.zIndex.modal,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'fadeIn 0.2s ease-in-out',
  '@keyframes fadeIn': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

/**
 * Styled modal container with responsive design and theme integration
 */
const StyledModalContainer = styled('div')<{ $size: string }>(({ theme, $size }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  maxHeight: '90vh',
  overflowY: 'auto',
  position: 'relative',
  zIndex: theme.zIndex.modal + 1,
  boxShadow: theme.shadows[24],
  animation: 'slideIn 0.3s ease-out',
  width: 'calc(100% - 48px)',
  maxWidth: $size,
  '@keyframes slideIn': {
    from: { transform: 'translateY(20px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
  '@media (max-width: 768px)': {
    width: '100%',
    maxHeight: '100vh',
    borderRadius: 0,
    margin: 0,
  },
}));

/**
 * Styled header component for modal title and close button
 */
const StyledHeader = styled('header')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
}));

/**
 * Styled title component with proper typography
 */
const StyledTitle = styled('h2')(({ theme }) => ({
  margin: 0,
  fontSize: theme.typography.h6.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.palette.text.primary,
}));

/**
 * Enhanced Modal component with accessibility and animation features
 */
const Modal: React.FC<ModalProps> = memo(({
  isOpen,
  onClose,
  children,
  size = 'md',
  title,
  closeOnOverlayClick = true,
  showCloseButton = true,
  ariaLabel,
  ariaDescribedBy,
  disableEscapeKey = false,
  onAfterOpen,
  onBeforeClose,
  contentStyles,
  className,
  id,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /**
   * Handles click events on the modal overlay
   */
  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onBeforeClose?.();
      onClose();
    }
  }, [closeOnOverlayClick, onClose, onBeforeClose]);

  /**
   * Handles keyboard events for accessibility
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!disableEscapeKey && event.key === 'Escape' && isOpen) {
      event.preventDefault();
      onBeforeClose?.();
      onClose();
    }
  }, [disableEscapeKey, isOpen, onClose, onBeforeClose]);

  /**
   * Manages focus trap within modal
   */
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
      document.addEventListener('keydown', handleKeyDown);
      onAfterOpen?.();

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        previousFocusRef.current?.focus();
      };
    }
  }, [isOpen, handleKeyDown, onAfterOpen]);

  if (!isOpen) return null;

  return (
    <Portal>
      <StyledOverlay
        onClick={handleOverlayClick}
        role="presentation"
      >
        <StyledModalContainer
          ref={modalRef}
          $size={MODAL_SIZES[size]}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || title}
          aria-describedby={ariaDescribedBy}
          tabIndex={-1}
          style={contentStyles}
          className={className}
          id={id}
        >
          {(title || showCloseButton) && (
            <StyledHeader>
              {title && (
                <StyledTitle>{title}</StyledTitle>
              )}
              {showCloseButton && (
                <Icon
                  name="close"
                  size={ComponentSize.MEDIUM}
                  onClick={() => {
                    onBeforeClose?.();
                    onClose();
                  }}
                  ariaLabel="Close modal"
                  testId="modal-close-button"
                />
              )}
            </StyledHeader>
          )}
          {children}
        </StyledModalContainer>
      </StyledOverlay>
    </Portal>
  );
});

Modal.displayName = 'Modal';

export default Modal;