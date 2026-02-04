/**
 * Utility function to set page title dynamically
 * @param pageTitle - The title of the current page
 */
export const setPageTitle = (pageTitle: string) => {
  const appName = localStorage.getItem('appName') || 'Starter Kits';
  document.title = `${pageTitle} - ${appName}`;
};

/**
 * Get application name from localStorage
 */
export const getAppName = () => {
  return localStorage.getItem('appName') || 'Starter Kits';
};

/**
 * Get application subtitle from localStorage
 */
export const getAppSubtitle = () => {
  return localStorage.getItem('appSubtitle') || 'Your Application Subtitle';
};

/**
 * Get application logo URL from localStorage
 */
export const getAppLogo = () => {
  return localStorage.getItem('appLogo') || '';
};
