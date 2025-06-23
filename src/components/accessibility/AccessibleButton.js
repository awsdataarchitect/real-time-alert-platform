import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import './AccessibleButton.css';

const AccessibleButton = forwardRef(({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  ariaLabel,
  ariaDescribedBy,
  ariaExpanded,
  ariaPressed,
  onClick,
  onKeyDown,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  const handleKeyDown = (event) => {
    // Handle Enter and Space key activation
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled && !loading && onClick) {
        onClick(event);
      }
    }
    
    if (onKeyDown) {
      onKeyDown(event);
    }
  };

  const buttonClasses = [
    'accessible-button',
    `accessible-button--${variant}`,
    `accessible-button--${size}`,
    disabled && 'accessible-button--disabled',
    loading && 'accessible-button--loading',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {loading && (
        <span className="accessible-button__spinner" aria-hidden="true">
          <span className="sr-only">Loading...</span>
        </span>
      )}
      <span className={loading ? 'accessible-button__content--loading' : 'accessible-button__content'}>
        {children}
      </span>
    </button>
  );
});

AccessibleButton.displayName = 'AccessibleButton';

AccessibleButton.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  ariaLabel: PropTypes.string,
  ariaDescribedBy: PropTypes.string,
  ariaExpanded: PropTypes.bool,
  ariaPressed: PropTypes.bool,
  onClick: PropTypes.func,
  onKeyDown: PropTypes.func,
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset'])
};

export default AccessibleButton;