import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './LoginForm.css';

const LoginForm = ({ onSuccess, onSwitchToRegister }) => {
  const { login, loading, error } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Basic validation
    if (!formData.username || !formData.password) {
      setFormError('Please fill in all fields');
      return;
    }

    const result = await login(formData.username, formData.password);
    
    if (result.success) {
      onSuccess?.();
    } else {
      setFormError(result.error || 'Login failed');
    }
  };

  return (
    <div className="login-form-container">
      <form onSubmit={handleSubmit} className="login-form" data-testid="login-form">
        <h2>Sign In</h2>
        
        {(error || formError) && (
          <div className="error-message" role="alert" data-testid="login-error">
            {formError || error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="username">
            Username or Email
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
            aria-describedby="username-error"
            data-testid="username-input"
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
            autoComplete="current-password"
            aria-describedby="password-error"
            data-testid="password-input"
          />
        </div>

        <button
          type="submit"
          className="submit-button"
          disabled={loading}
          data-testid="login-submit"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>

        <div className="form-footer">
          <button
            type="button"
            className="link-button"
            onClick={onSwitchToRegister}
            data-testid="switch-to-register"
          >
            Don't have an account? Sign up
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;