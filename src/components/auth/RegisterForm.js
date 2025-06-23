import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './LoginForm.css'; // Reuse the same styles

const RegisterForm = ({ onSuccess, onSwitchToLogin }) => {
  const { register, confirmRegistration, loading, error } = useAuth();
  const [step, setStep] = useState('register'); // 'register' or 'confirm'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [confirmationCode, setConfirmationCode] = useState('');
  const [formError, setFormError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (formError) setFormError('');
  };

  const validateForm = () => {
    if (!formData.username || !formData.email || !formData.password || !formData.name) {
      setFormError('Please fill in all required fields');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match');
      return false;
    }

    if (formData.password.length < 8) {
      setFormError('Password must be at least 8 characters long');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setFormError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!validateForm()) {
      return;
    }

    const result = await register(
      formData.username,
      formData.password,
      formData.email,
      { name: formData.name }
    );
    
    if (result.success) {
      if (result.requiresConfirmation) {
        setStep('confirm');
      } else {
        onSuccess?.();
      }
    } else {
      setFormError(result.error || 'Registration failed');
    }
  };

  const handleConfirmSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!confirmationCode) {
      setFormError('Please enter the confirmation code');
      return;
    }

    const result = await confirmRegistration(formData.username, confirmationCode);
    
    if (result.success) {
      onSuccess?.();
    } else {
      setFormError(result.error || 'Confirmation failed');
    }
  };

  if (step === 'confirm') {
    return (
      <div className="login-form-container">
        <form onSubmit={handleConfirmSubmit} className="login-form" data-testid="confirm-form">
          <h2>Confirm Your Account</h2>
          <p>We've sent a confirmation code to {formData.email}</p>
          
          {(error || formError) && (
            <div className="error-message" role="alert" data-testid="confirm-error">
              {formError || error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="confirmationCode">
              Confirmation Code
              <span className="required" aria-label="required">*</span>
            </label>
            <input
              type="text"
              id="confirmationCode"
              name="confirmationCode"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              required
              placeholder="Enter 6-digit code"
              data-testid="confirmation-code-input"
            />
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
            data-testid="confirm-submit"
          >
            {loading ? 'Confirming...' : 'Confirm Account'}
          </button>

          <div className="form-footer">
            <button
              type="button"
              className="link-button"
              onClick={() => setStep('register')}
              data-testid="back-to-register"
            >
              Back to Registration
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="login-form-container">
      <form onSubmit={handleRegisterSubmit} className="login-form" data-testid="register-form">
        <h2>Create Account</h2>
        
        {(error || formError) && (
          <div className="error-message" role="alert" data-testid="register-error">
            {formError || error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="name">
            Full Name
            <span className="required" aria-label="required">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            autoComplete="name"
            data-testid="name-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="username">
            Username
            <span className="required" aria-label="required">*</span>
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            autoComplete="username"
            data-testid="username-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">
            Email
            <span className="required" aria-label="required">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
            data-testid="email-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">
            Password
            <span className="required" aria-label="required">*</span>
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="new-password"
            minLength="8"
            data-testid="password-input"
          />
          <small>Password must be at least 8 characters long</small>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">
            Confirm Password
            <span className="required" aria-label="required">*</span>
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            autoComplete="new-password"
            data-testid="confirm-password-input"
          />
        </div>

        <button
          type="submit"
          className="submit-button"
          disabled={loading}
          data-testid="register-submit"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        <div className="form-footer">
          <button
            type="button"
            className="link-button"
            onClick={onSwitchToLogin}
            data-testid="switch-to-login"
          >
            Already have an account? Sign in
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;