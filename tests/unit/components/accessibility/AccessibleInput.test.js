import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import AccessibleInput from '../../../../src/components/accessibility/AccessibleInput';

expect.extend(toHaveNoViolations);

describe('AccessibleInput', () => {
  test('renders with label correctly', () => {
    render(
      <AccessibleInput
        label="Email Address"
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Email Address');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  test('associates label with input correctly', () => {
    render(
      <AccessibleInput
        label="Username"
        id="username-input"
        value=""
        onChange={() => {}}
      />
    );
    
    const label = screen.getByText('Username');
    const input = screen.getByLabelText('Username');
    
    expect(label).toHaveAttribute('for', 'username-input');
    expect(input).toHaveAttribute('id', 'username-input');
  });

  test('generates unique ID when not provided', () => {
    const { rerender } = render(
      <AccessibleInput
        label="First Input"
        value=""
        onChange={() => {}}
      />
    );
    
    const firstInput = screen.getByLabelText('First Input');
    const firstId = firstInput.getAttribute('id');
    
    rerender(
      <AccessibleInput
        label="Second Input"
        value=""
        onChange={() => {}}
      />
    );
    
    const secondInput = screen.getByLabelText('Second Input');
    const secondId = secondInput.getAttribute('id');
    
    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
  });

  test('shows required indicator', () => {
    render(
      <AccessibleInput
        label="Required Field"
        required
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Required Field');
    const requiredIndicator = screen.getByLabelText('required');
    
    expect(input).toBeRequired();
    expect(requiredIndicator).toHaveTextContent('*');
  });

  test('displays help text with proper association', () => {
    render(
      <AccessibleInput
        label="Password"
        helpText="Must be at least 8 characters"
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Password');
    const helpText = screen.getByText('Must be at least 8 characters');
    
    expect(helpText).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-describedby');
    
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain(helpText.getAttribute('id'));
  });

  test('displays error with proper ARIA attributes', () => {
    render(
      <AccessibleInput
        label="Email"
        error="Invalid email format"
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Email');
    const errorMessage = screen.getByRole('alert');
    
    expect(errorMessage).toHaveTextContent('Invalid email format');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
    
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain(errorMessage.getAttribute('id'));
  });

  test('combines help text and error in aria-describedby', () => {
    render(
      <AccessibleInput
        label="Username"
        helpText="Choose a unique username"
        error="Username already taken"
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Username');
    const helpText = screen.getByText('Choose a unique username');
    const errorMessage = screen.getByRole('alert');
    
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain(helpText.getAttribute('id'));
    expect(describedBy).toContain(errorMessage.getAttribute('id'));
  });

  test('handles password type with toggle functionality', async () => {
    const user = userEvent.setup();
    
    render(
      <AccessibleInput
        type="password"
        label="Password"
        value="secret123"
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Password');
    const toggleButton = screen.getByLabelText('Show password');
    
    expect(input).toHaveAttribute('type', 'password');
    
    await user.click(toggleButton);
    
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Hide password')).toBeInTheDocument();
    
    await user.click(screen.getByLabelText('Hide password'));
    
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Show password')).toBeInTheDocument();
  });

  test('handles focus and blur events', async () => {
    const user = userEvent.setup();
    const handleFocus = jest.fn();
    const handleBlur = jest.fn();
    
    render(
      <AccessibleInput
        label="Test Input"
        value=""
        onChange={() => {}}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
    
    const input = screen.getByLabelText('Test Input');
    
    await user.click(input);
    expect(handleFocus).toHaveBeenCalled();
    
    await user.tab();
    expect(handleBlur).toHaveBeenCalled();
  });

  test('handles change events', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    
    render(
      <AccessibleInput
        label="Test Input"
        value=""
        onChange={handleChange}
      />
    );
    
    const input = screen.getByLabelText('Test Input');
    
    await user.type(input, 'hello');
    
    expect(handleChange).toHaveBeenCalledTimes(5); // Once for each character
  });

  test('applies disabled state correctly', () => {
    render(
      <AccessibleInput
        label="Disabled Input"
        disabled
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Disabled Input');
    
    expect(input).toBeDisabled();
    expect(input).toHaveClass('accessible-input__field--disabled');
  });

  test('forwards ref correctly', () => {
    const ref = React.createRef();
    
    render(
      <AccessibleInput
        ref={ref}
        label="Input with ref"
        value=""
        onChange={() => {}}
      />
    );
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  test('supports different input types', () => {
    const { rerender } = render(
      <AccessibleInput
        type="email"
        label="Email"
        value=""
        onChange={() => {}}
      />
    );
    
    let input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    
    rerender(
      <AccessibleInput
        type="tel"
        label="Phone"
        value=""
        onChange={() => {}}
      />
    );
    
    input = screen.getByLabelText('Phone');
    expect(input).toHaveAttribute('type', 'tel');
  });

  test('supports autocomplete attribute', () => {
    render(
      <AccessibleInput
        label="Email"
        type="email"
        autoComplete="email"
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('autocomplete', 'email');
  });

  test('applies placeholder correctly', () => {
    render(
      <AccessibleInput
        label="Search"
        placeholder="Enter search terms..."
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Search');
    expect(input).toHaveAttribute('placeholder', 'Enter search terms...');
  });

  test('meets accessibility standards', async () => {
    const { container } = render(
      <AccessibleInput
        label="Accessible Input"
        helpText="This is help text"
        required
        value=""
        onChange={() => {}}
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('error message has proper live region attributes', () => {
    render(
      <AccessibleInput
        label="Email"
        error="Invalid email"
        value=""
        onChange={() => {}}
      />
    );
    
    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toHaveAttribute('aria-live', 'polite');
  });

  test('has minimum touch target size', () => {
    render(
      <AccessibleInput
        label="Input"
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Input');
    const styles = window.getComputedStyle(input);
    
    // WCAG requires minimum 44px touch targets
    expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
  });

  test('password toggle button has minimum touch target size', () => {
    render(
      <AccessibleInput
        type="password"
        label="Password"
        value="test"
        onChange={() => {}}
      />
    );
    
    const toggleButton = screen.getByLabelText('Show password');
    const styles = window.getComputedStyle(toggleButton);
    
    expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(32);
    expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(32);
  });

  test('applies custom className', () => {
    render(
      <AccessibleInput
        label="Custom Input"
        className="custom-class"
        value=""
        onChange={() => {}}
      />
    );
    
    const input = screen.getByLabelText('Custom Input');
    expect(input).toHaveClass('custom-class');
    expect(input).toHaveClass('accessible-input__field');
  });
});