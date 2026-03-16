export type Theme = 'dark' | 'light';

export function getStoredTheme(): Theme {
  return (localStorage.getItem('app-theme') as Theme) || 'dark';
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem('app-theme', theme);
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
