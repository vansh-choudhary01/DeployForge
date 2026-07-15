import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const siteName = 'Deploy Control Room';
const defaultTitle = 'Deploy Control Room | Deploy GitHub Apps With Live Logs';
const defaultDescription =
  'Deploy GitHub repositories as managed static and server apps with live logs, project workspaces, environment variables, and health checks.';

const routeSeo = {
  '/': {
    title: defaultTitle,
    description: defaultDescription,
    robots: 'index, follow, max-image-preview:large',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: siteName,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      description: defaultDescription,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  },
  '/login': {
    title: `Sign In | ${siteName}`,
    description: 'Sign in to manage projects, services, deployments, and live build logs.',
    robots: 'noindex, nofollow',
  },
  '/register': {
    title: `Create Account | ${siteName}`,
    description: 'Create an account to deploy GitHub repositories and manage live services.',
    robots: 'noindex, nofollow',
  },
};

const appRouteSeo = {
  '/dashboard': 'Deployment Dashboard',
  '/services': 'Services',
  '/deploy': 'Deploy Service',
  '/projects': 'Projects',
  '/settings': 'Settings',
};

function getSiteUrl() {
  const configuredUrl = process.env.REACT_APP_SITE_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
}

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    const match = selector.match(/\[(name|property)="([^"]+)"\]/);

    if (match) {
      element.setAttribute(match[1], match[2]);
    }

    document.head.appendChild(element);
  }

  element.setAttribute(attribute, value);
}

function setCanonical(url) {
  let canonical = document.head.querySelector('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }

  canonical.setAttribute('href', url);
}

function setStructuredData(schema) {
  const id = 'route-structured-data';
  let script = document.getElementById(id);

  if (!schema) {
    script?.remove();
    return;
  }

  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(schema);
}

function getSeoForPath(pathname) {
  if (routeSeo[pathname]) {
    return routeSeo[pathname];
  }

  if (pathname.startsWith('/services/')) {
    return {
      title: `Service Details | ${siteName}`,
      description: 'View service health, deployment history, runtime settings, and deployment diagnosis.',
      robots: 'noindex, nofollow',
    };
  }

  if (pathname.startsWith('/deployments/')) {
    return {
      title: `Deployment Logs | ${siteName}`,
      description: 'View live deployment logs and readable deployment diagnosis.',
      robots: 'noindex, nofollow',
    };
  }

  if (appRouteSeo[pathname]) {
    return {
      title: `${appRouteSeo[pathname]} | ${siteName}`,
      description: 'Manage projects, services, deployment settings, and live logs.',
      robots: 'noindex, nofollow',
    };
  }

  return {
    title: defaultTitle,
    description: defaultDescription,
    robots: 'noindex, nofollow',
  };
}

export default function Seo() {
  const location = useLocation();

  useEffect(() => {
    const seo = getSeoForPath(location.pathname);
    const siteUrl = getSiteUrl();
    const canonicalUrl = siteUrl ? `${siteUrl}${location.pathname}` : location.pathname;
    const imageUrl = siteUrl ? `${siteUrl}/logo512.png` : '/logo512.png';

    document.title = seo.title;
    setMeta('meta[name="description"]', 'content', seo.description);
    setMeta('meta[name="robots"]', 'content', seo.robots);
    setMeta('meta[property="og:title"]', 'content', seo.title);
    setMeta('meta[property="og:description"]', 'content', seo.description);
    setMeta('meta[property="og:url"]', 'content', canonicalUrl);
    setMeta('meta[property="og:image"]', 'content', imageUrl);
    setMeta('meta[name="twitter:title"]', 'content', seo.title);
    setMeta('meta[name="twitter:description"]', 'content', seo.description);
    setMeta('meta[name="twitter:image"]', 'content', imageUrl);
    setCanonical(canonicalUrl);
    setStructuredData(seo.schema ? { ...seo.schema, url: canonicalUrl, image: imageUrl } : null);
  }, [location.pathname]);

  return null;
}
