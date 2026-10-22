import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  AppLayout,
  SideNavigation,
  BreadcrumbGroup,
  TopNavigation
} from '@cloudscape-design/components';
import { applyMode, Mode } from '@cloudscape-design/global-styles';

// Import pages
import Dashboard from './pages/Dashboard';
import Scheduler from './pages/Scheduler';
import Technician from './pages/Technician';
import Billing from './pages/Billing';
import CustomerDetails from './pages/CustomerDetails';
import Login from './pages/Login';
import Callback from './pages/Callback';
import Admin from './pages/Admin';
import Parts from './pages/Parts';
import AgentsDashboard from './pages/AgentsDashboard';
import AgentsDashboardDebug from './pages/AgentsDashboard.debug';

// Import authentication components
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Main App Layout with Navigation
function MainLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeHref = location.pathname;
  const { user } = useAuth();
  
  console.log('MainLayout rendered, user:', user);

  return (
    <AppLayout
      navigation={
        <SideNavigation
          header={{ text: 'HVAC Field Service', href: '/' }}
          activeHref={activeHref}
          onFollow={e => {
            e.preventDefault();
            navigate(e.detail.href);
          }}
          items={[
            { type: 'link', text: 'Dashboard', href: '/dashboard' },
            { type: 'link', text: 'Job Scheduler', href: '/scheduler' },
            { type: 'link', text: 'Technician View', href: '/technician' },
            { type: 'link', text: 'Billing', href: '/billing' },
            { type: 'link', text: 'Parts Inventory', href: '/parts' },
            { type: 'link', text: 'AI Agents', href: '/agents' },
            { type: 'link', text: 'Admin', href: '/admin' }
          ]}
        />
      }
      breadcrumbs={
        <BreadcrumbGroup
          items={[
            { text: 'HVAC Field Service', href: '/' },
            { text: activeHref.substring(1).charAt(0).toUpperCase() + activeHref.substring(1).slice(1), href: activeHref }
          ]}
          ariaLabel="Breadcrumbs"
        />
      }
      content={children}
      toolsHide={true}
      notifications={null}
      navigationWidth={300}
      headerSelector="#header"
    />
  );
}

// Header component with user info and sign out button
function Header() {
  const { user, signOut } = useAuth();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('fsm_theme') === 'dark');

  // Apply saved theme on mount
  useEffect(() => {
    applyMode(darkMode ? Mode.Dark : Mode.Light);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    applyMode(next ? Mode.Dark : Mode.Light);
    localStorage.setItem('fsm_theme', next ? 'dark' : 'light');
  };
  
  useEffect(() => {
    if (user) {
      setUserName(user.username || user.attributes?.name || 'User');
      setUserEmail(user.attributes?.email || '');
      return;
    }
    try {
      const idToken = localStorage.getItem('idToken');
      if (idToken) {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        setUserName(payload.name || payload.email || 'User');
        setUserEmail(payload.email || '');
      }
    } catch (error) {
      console.error('Error parsing ID token:', error);
    }
  }, [user]);
  
  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('sessionData');
      window.location.href = '/login';
    }
  };
  
  return (
    <div id="header" style={{ position: 'sticky', top: 0, zIndex: 1002 }}>
      <TopNavigation
        identity={{
          href: '/',
          title: 'HVAC Field Service Management'
        }}
        utilities={[
          {
            type: 'button',
            iconName: darkMode ? 'status-positive' : 'status-pending',
            title: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
            ariaLabel: 'Toggle dark mode',
            onClick: toggleDarkMode
          },
          {
            type: 'menu-dropdown',
            text: userName,
            description: userEmail,
            iconName: 'user-profile',
            onItemClick: ({ detail }) => {
              if (detail.id === 'signout') handleSignOut();
            },
            items: [
              {
                id: 'signout',
                text: 'Sign out',
                iconName: 'exit'
              }
            ]
          }
        ]}
      />
    </div>
  );
}

// Main App component
function App() {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  console.log('App component rendered');
  
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
  };

  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/callback" element={<Callback />} />
            <Route 
              path="/" 
              element={
                <Navigate to="/dashboard" replace />
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Header />
                  <MainLayout>
                    {selectedCustomer ? (
                      <CustomerDetails 
                        customer={selectedCustomer} 
                        onBack={() => setSelectedCustomer(null)} 
                      />
                    ) : (
                      <Dashboard onCustomerSelect={handleCustomerSelect} />
                    )}
                  </MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/scheduler" 
              element={
                <ProtectedRoute>
                  <Header />
                  <MainLayout>
                    <Scheduler />
                  </MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/technician" 
              element={
                <ProtectedRoute>
                  <Header />
                  <MainLayout>
                    <Technician />
                  </MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/billing" 
              element={
                <ProtectedRoute>
                  <Header />
                  <MainLayout>
                    <Billing />
                  </MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/parts" 
              element={
                <ProtectedRoute>
                  <Header />
                  <MainLayout>
                    <Parts />
                  </MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/agents" 
              element={
                <ProtectedRoute>
                  <Header />
                  <MainLayout>
                    <AgentsDashboard />
                  </MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/debug-agents" 
              element={
                <React.Fragment>
                  <Header />
                  <MainLayout>
                    <AgentsDashboardDebug />
                  </MainLayout>
                </React.Fragment>
              }
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <Header />
                  <MainLayout>
                    <Admin />
                  </MainLayout>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
