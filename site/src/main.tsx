import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';
import { readPreference } from './theme.ts';

// Set the theme before the first paint so a stored choice never flashes.
const preference = readPreference();
document.documentElement.dataset.theme = preference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference;

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
