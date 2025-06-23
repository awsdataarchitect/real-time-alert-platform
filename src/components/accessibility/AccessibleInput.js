import React, { forwardRef, useState } from 'react';
import PropTypes from 'prop-types';
import './AccessibleInput.css';

const AccessibleInput = forwardRef(({
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder,
  required = false,
  disabled = false,
  error,
  helpText,
  id,
  name,
  autoComplete,
  className = '',
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helpId = helpText ? `${inputId}-help` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  const handleFocus = (event) => {
    setIsFocused(true);
    if (onFocus) onFocus(event);
  };

  const handleBlur = (event) => {
    setIsFocused(false);
    if (onBlur) onBlur(event);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const inputClasses = [
    'accessible-input__field',
    error && 'accessible-input__field--error',
    disabled && 'accessible-input__field--disabled',
    isFocused && 'accessible-input__field--focused',
    className
  ].filter(Boolean).join(' ');

  const containerClasses = [
    'accessible-input',
    type === 'password' && 'accessible-input--password'
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="accessible-input__label"
        >
          {label}
          {required && (
            <span className="accessible-input__required" aria-label="required">
              *
            </span>
          )}
        </label>
      )}
      
      <div className="accessible-input__wrapper">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type === 'password' && showPassword ? 'text' : type}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={inputClasses}
          {...props}
        />
        
        {type === 'password' && (
          <button
            type="button"
            className="accessible-input__password-toggle"
            onClick={togglePasswordVisibility}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            <span aria-hidden="true">
              {showPassword ? '🙈' : '👁️'}
            </span>
          </button>
        )}
      </div>
      
      {helpText && (
        <div id={helpId} className="accessible-input__help">
          {helpText}
        </div>
      )}
      
      {error && (
        <div 
          id={errorId} 
          className="accessible-input__error" 
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

AccessibleInput.displayName = 'AccessibleInput';

AccessibleInput.propTypes = {
  label: PropTypes.string,
  type: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  helpText: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
  autoComplete: PropTypes.string,
  className: PropTypes.string
};

export default AccessibleInput;