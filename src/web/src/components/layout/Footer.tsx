import React, { memo, useMemo } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { Box, Container } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ComponentProps } from '../../interfaces/common.interface';
import Icon from '../common/Icon';
import { LAYOUT } from '../../constants/ui.constants';
import { ComponentSize } from '../../types/common.types';

/**
 * Props interface for Footer component extending base ComponentProps
 */
interface FooterProps extends ComponentProps {
  showSocialLinks?: boolean;
  showNavLinks?: boolean;
}

/**
 * Styled footer container with theme integration and accessibility features
 */
const StyledFooter = styled('footer')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(3, 0),
  marginTop: 'auto',
  transition: theme.transitions.create(['background-color', 'border-color'], {
    duration: theme.transitions.duration.short,
  }),
  contain: 'layout style paint',
  '@media print': {
    display: 'none',
  },
}));

/**
 * Styled content wrapper with responsive layout
 */
const FooterContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    textAlign: 'center',
    gap: theme.spacing(3),
  },
}));

/**
 * Social media links configuration
 */
const SOCIAL_LINKS = [
  { icon: 'linkedin', url: 'https://linkedin.com/company/taskmaster', label: 'LinkedIn' },
  { icon: 'twitter', url: 'https://twitter.com/taskmaster', label: 'Twitter' },
  { icon: 'github', url: 'https://github.com/taskmaster', label: 'GitHub' },
] as const;

/**
 * Navigation links configuration
 */
const NAV_LINKS = [
  { label: 'footer.about', href: '/about' },
  { label: 'footer.privacy', href: '/privacy' },
  { label: 'footer.terms', href: '/terms' },
  { label: 'footer.contact', href: '/contact' },
] as const;

/**
 * Footer component implementing Material Design principles and WCAG accessibility guidelines
 */
const Footer = memo<FooterProps>(({
  className,
  showSocialLinks = true,
  showNavLinks = true,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  /**
   * Renders social media links with accessible icons and hover effects
   */
  const renderSocialLinks = () => {
    if (!showSocialLinks) return null;

    return (
      <Box
        component="section"
        aria-label={t('footer.socialLinks')}
        sx={{
          display: 'flex',
          gap: 2,
          justifyContent: 'center',
        }}
      >
        {SOCIAL_LINKS.map(({ icon, url, label }) => (
          <a
            key={icon}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <Icon
              name={icon}
              size={ComponentSize.MEDIUM}
              ariaLabel={label}
              className="social-icon"
              testId={`footer-${icon}-link`}
            />
          </a>
        ))}
      </Box>
    );
  };

  /**
   * Renders footer navigation links with proper spacing and accessibility
   */
  const renderNavLinks = () => {
    if (!showNavLinks) return null;

    return (
      <Box
        component="nav"
        aria-label={t('footer.navigation')}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          justifyContent: 'center',
        }}
      >
        {NAV_LINKS.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            style={{
              color: theme.palette.text.secondary,
              textDecoration: 'none',
              '&:hover': {
                color: theme.palette.primary.main,
                textDecoration: 'underline',
              },
            }}
          >
            {t(label)}
          </a>
        ))}
      </Box>
    );
  };

  return (
    <StyledFooter className={className}>
      <Container
        maxWidth={false}
        sx={{ maxWidth: LAYOUT.MAX_WIDTH }}
      >
        <FooterContent>
          {renderSocialLinks()}
          {renderNavLinks()}
          <Box
            component="div"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.875rem',
            }}
          >
            {t('footer.copyright', { year: currentYear })}
          </Box>
        </FooterContent>
      </Container>
    </StyledFooter>
  );
});

// Display name for debugging
Footer.displayName = 'Footer';

export default Footer;