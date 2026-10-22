import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  SpaceBetween,
  FormField,
  Input,
  Button,
  Alert
} from '@cloudscape-design/components';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const { signIn, completeNewPassword, confirmForgotPassword, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required'); return; }
    try {
      setLoading(true); setError(null);
      const result = await signIn(email, password);
      if (result.challengeName === 'NEW_PASSWORD_REQUIRED') {
        setShowNewPasswordForm(true);
        setTempUsername(result.username);
      } else if (result.challengeName === 'PASSWORD_RESET_REQUIRED') {
        setTempUsername(result.username);
        setShowResetForm(true);
        setInfo('A verification code has been sent to your email. Enter it below with your new password.');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteNewPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) { setError('New password is required'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!passwordRegex.test(newPassword)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character (@$!%*?&)');
      return;
    }
    try {
      setLoading(true); setError(null);
      await completeNewPassword(tempUsername, newPassword);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to set new password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (!resetCode || !newPassword) { setError('Verification code and new password are required'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!passwordRegex.test(newPassword)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character (@$!%*?&)');
      return;
    }
    try {
      setLoading(true); setError(null);
      await confirmForgotPassword(tempUsername, resetCode, newPassword);
      setInfo(null);
      setShowResetForm(false);
      await signIn(tempUsername, newPassword);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f2f3f3' }}>
      <Container
        header={<Header variant="h1" description="Enter your credentials to access the application">HVAC Field Service Management</Header>}
        style={{ maxWidth: '400px', width: '100%' }}
      >
        {error && <Alert type="error" dismissible onDismiss={() => setError(null)}>{error}</Alert>}
        {info && <Alert type="info">{info}</Alert>}

        {!showNewPasswordForm && !showResetForm && (
          <form onSubmit={handleSignIn}>
            <SpaceBetween size="l">
              <FormField label="Email">
                <Input type="email" value={email} onChange={({ detail }) => setEmail(detail.value)} placeholder="Enter your email" disabled={loading} />
              </FormField>
              <FormField label="Password">
                <Input type="password" value={password} onChange={({ detail }) => setPassword(detail.value)} placeholder="Enter your password" disabled={loading} />
              </FormField>
              <Button variant="primary" fullWidth formAction="submit" loading={loading}>Sign In</Button>
            </SpaceBetween>
          </form>
        )}

        {showNewPasswordForm && (
          <form onSubmit={handleCompleteNewPassword}>
            <SpaceBetween size="l">
              <Alert type="info">You need to change your password for first-time login.</Alert>
              <FormField label="New Password">
                <Input type="password" value={newPassword} onChange={({ detail }) => setNewPassword(detail.value)} placeholder="Enter new password" disabled={loading} />
              </FormField>
              <FormField label="Confirm New Password">
                <Input type="password" value={confirmPassword} onChange={({ detail }) => setConfirmPassword(detail.value)} placeholder="Confirm new password" disabled={loading} />
              </FormField>
              <Button variant="primary" fullWidth formAction="submit" loading={loading}>Set New Password</Button>
            </SpaceBetween>
          </form>
        )}

        {showResetForm && (
          <form onSubmit={handleConfirmReset}>
            <SpaceBetween size="l">
              <FormField label="Verification Code" description="Check your email for the code">
                <Input value={resetCode} onChange={({ detail }) => setResetCode(detail.value)} placeholder="Enter verification code" disabled={loading} />
              </FormField>
              <FormField label="New Password">
                <Input type="password" value={newPassword} onChange={({ detail }) => setNewPassword(detail.value)} placeholder="Enter new password" disabled={loading} />
              </FormField>
              <FormField label="Confirm New Password">
                <Input type="password" value={confirmPassword} onChange={({ detail }) => setConfirmPassword(detail.value)} placeholder="Confirm new password" disabled={loading} />
              </FormField>
              <Button variant="primary" fullWidth formAction="submit" loading={loading}>Reset Password</Button>
            </SpaceBetween>
          </form>
        )}
      </Container>
    </div>
  );
}

export default Login;
