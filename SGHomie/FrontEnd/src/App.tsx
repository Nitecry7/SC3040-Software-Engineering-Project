import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import Chatbot from './components/Chatbot';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SessionLifecycle from './components/SessionLifecycle';
import { clearRecoveryState, getRecoveryState, wasCapturedFromUrl } from './lib/authRecovery';

const Home = lazy(() => import('./pages/Home'));
const Search = lazy(() => import('./pages/Search'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Contact = lazy(() => import('./pages/Contact'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PropertyDetails = lazy(() => import('./pages/PropertyDetails'));
const Enquiry = lazy(() => import('./pages/Enquiry'));
const SellerSignup = lazy(() => import('./pages/SellerSignup'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// A password-recovery or auth-error redirect can land on any path (for example
// when the hosted redirect list falls back to the site URL). Send it to the reset
// page once, and drop any recovery or error state when the user leaves that page,
// so an abandoned recovery cannot keep the reset form reachable or the profile
// overlay hidden.
function RecoveryRedirect() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const redirected = useRef(false);
  const visitedResetPage = useRef(false);

  useEffect(() => {
    if (pathname === '/reset-password') {
      visitedResetPage.current = true;
      return;
    }
    const state = getRecoveryState();
    if (state && wasCapturedFromUrl() && !redirected.current && !visitedResetPage.current) {
      redirected.current = true;
      navigate('/reset-password', { replace: true });
    } else if (visitedResetPage.current && state) {
      clearRecoveryState();
    }
  }, [pathname, navigate]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div id="app-shell" className="flex flex-col min-h-screen bg-gray-50">
          <Navbar />
          <main className="flex-grow">
            <Suspense fallback={(
              <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-600" role="status">
                Loading page…
              </div>
            )}>
              <Routes>
              <Route path="/" element={<Home />} />
              <Route 
                path="/search" 
                element={
                  <ProtectedRoute>
                    <Search />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/analytics" 
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                } 
              />
              <Route path="/contact" element={<Contact />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route path="/property/:id" element={
                <ProtectedRoute requireProfileSetup={false} signInMessage="Sign up or log in to view property details">
                  <PropertyDetails />
                </ProtectedRoute>
              } />
              <Route 
                path="/enquiry" 
                element={
                  <ProtectedRoute>
                    <Enquiry />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/seller/signup"
                element={
                  <ProtectedRoute>
                    <SellerSignup />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller"
                element={
                  <ProtectedRoute requiredRole="seller">
                    <SellerDashboard />
                  </ProtectedRoute>
                }
              />
              </Routes>
            </Suspense>
          </main>
          <AuthModal />
          <Chatbot />
          <Toaster position="bottom-right" />
        </div>
        <SessionLifecycle />
        <RecoveryRedirect />
      </Router>
    </AuthProvider>
  );
}

export default App;
