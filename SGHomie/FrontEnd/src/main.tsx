import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { getSupabaseConfigError } from './lib/supabaseConfig';

function MissingSupabaseConfig() {
  const configError = getSupabaseConfigError();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <section className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-gray-900">Supabase setup required</h1>
        <p className="mt-3 text-gray-600">
          {configError}
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-gray-700">
          <li>Copy <code>.env.example</code> to <code>.env</code>.</li>
          <li>Set the project URL and publishable key (or legacy anon key) from Supabase Project Settings → API.</li>
          <li>Restart the Vite development server.</li>
        </ol>
      </section>
    </main>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

if (getSupabaseConfigError()) {
  createRoot(rootElement).render(
    <StrictMode>
      <MissingSupabaseConfig />
    </StrictMode>
  );
} else {
  import('./App').then(({ default: App }) => {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}
