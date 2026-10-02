import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { ErrorToast } from './components/ErrorToast'
import { showError } from './lib/errors'
import './index.css'

const queryClient = new QueryClient({
  // every failed save shows a message, so nothing fails silently
  mutationCache: new MutationCache({ onError: showError }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ErrorToast />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
