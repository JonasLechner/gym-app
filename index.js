import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/gym-app/sw.js', { scope: '/gym-app/' }).catch(console.warn);
  });
}
