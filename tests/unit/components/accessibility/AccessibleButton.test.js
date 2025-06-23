import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import AccessibleButton from '../../../../src/components/accessibility/AccessibleButton';

expect.extend(toHaveNoViolations);

describe('AccessibleButton', () => {
  test('renders with correct default attributes', () => {
    render(<AccessibleButton>Click me</AccessibleButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Click me');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toBeDisabled();
  });

  test('applies variant classes correctly', () => {
    const { rerender } = render(
      <AccessibleButton variant="primary">Primary</AccessibleButton>
    );
    
    let button = screen.getByRole('button');
    expect(button).toHaveClass('accessible-button--primary');
    
    rerender(<AccessibleButton variant="secondary">Secondary</AccessibleButton>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('accessible-button--secondary');
    
    rerender(<AccessibleButton variant="danger">Danger</AccessibleButton>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('accessible-button--danger');
  });

  test('applies size classes correctly', () => {
    const { rerender } = render(
      <AccessibleButton size="small">Small</AccessibleButton>
    );
    
    let button = screen.getByRole('button');
    expect(button).toHaveClass('accessible-button--small');
    
    rerender(<AccessibleButton size="large">Large</AccessibleButton>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('accessible-button--large');
  });

  test('handles disabled state correctly', () => {
    render(<AccessibleButton disabled>Disabled</AccessibleButton>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('accessible-button--disabled');
  });

  test('handles loading state correctly', () => {
    render(<AccessibleButton loading>Loading</AccessibleButton>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('accessible-button--loading');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('handles click events', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    
    render(<AccessibleButton onClick={handleClick}>Click me</AccessibleButton>);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('handles keyboard activation with Enter key', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    
    render(<AccessibleButton onClick={handleClick}>Click me</AccessibleButton>);
    
    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard('{Enter}');
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('handles keyboard activation with Space key', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    
    render(<AccessibleButton onClick={handleClick}>Click me</AccessibleButton>);
    
    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard(' ');
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('does not trigger click when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();\n    \n    render(\n      <AccessibleButton disabled onClick={handleClick}>\n        Disabled\n      </AccessibleButton>\n    );\n    \n    const button = screen.getByRole('button');\n    await user.click(button);\n    \n    expect(handleClick).not.toHaveBeenCalled();\n  });\n\n  test('does not trigger click when loading', async () => {\n    const user = userEvent.setup();\n    const handleClick = jest.fn();\n    \n    render(\n      <AccessibleButton loading onClick={handleClick}>\n        Loading\n      </AccessibleButton>\n    );\n    \n    const button = screen.getByRole('button');\n    await user.click(button);\n    \n    expect(handleClick).not.toHaveBeenCalled();\n  });\n\n  test('applies ARIA attributes correctly', () => {\n    render(\n      <AccessibleButton\n        ariaLabel=\"Custom label\"\n        ariaDescribedBy=\"desc-1\"\n        ariaExpanded={true}\n        ariaPressed={false}\n      >\n        Button\n      </AccessibleButton>\n    );\n    \n    const button = screen.getByRole('button');\n    expect(button).toHaveAttribute('aria-label', 'Custom label');\n    expect(button).toHaveAttribute('aria-describedby', 'desc-1');\n    expect(button).toHaveAttribute('aria-expanded', 'true');\n    expect(button).toHaveAttribute('aria-pressed', 'false');\n  });\n\n  test('forwards ref correctly', () => {\n    const ref = React.createRef();\n    \n    render(\n      <AccessibleButton ref={ref}>\n        Button with ref\n      </AccessibleButton>\n    );\n    \n    expect(ref.current).toBeInstanceOf(HTMLButtonElement);\n  });\n\n  test('handles custom onKeyDown events', async () => {\n    const user = userEvent.setup();\n    const handleKeyDown = jest.fn();\n    \n    render(\n      <AccessibleButton onKeyDown={handleKeyDown}>\n        Button\n      </AccessibleButton>\n    );\n    \n    const button = screen.getByRole('button');\n    button.focus();\n    await user.keyboard('{ArrowDown}');\n    \n    expect(handleKeyDown).toHaveBeenCalled();\n  });\n\n  test('meets accessibility standards', async () => {\n    const { container } = render(\n      <AccessibleButton variant=\"primary\">\n        Accessible Button\n      </AccessibleButton>\n    );\n    \n    const results = await axe(container);\n    expect(results).toHaveNoViolations();\n  });\n\n  test('has minimum touch target size', () => {\n    render(<AccessibleButton>Button</AccessibleButton>);\n    \n    const button = screen.getByRole('button');\n    const styles = window.getComputedStyle(button);\n    \n    // WCAG requires minimum 44x44px touch targets\n    expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);\n    expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);\n  });\n\n  test('supports different button types', () => {\n    const { rerender } = render(\n      <AccessibleButton type=\"submit\">Submit</AccessibleButton>\n    );\n    \n    let button = screen.getByRole('button');\n    expect(button).toHaveAttribute('type', 'submit');\n    \n    rerender(<AccessibleButton type=\"reset\">Reset</AccessibleButton>);\n    button = screen.getByRole('button');\n    expect(button).toHaveAttribute('type', 'reset');\n  });\n\n  test('applies custom className', () => {\n    render(\n      <AccessibleButton className=\"custom-class\">\n        Custom Button\n      </AccessibleButton>\n    );\n    \n    const button = screen.getByRole('button');\n    expect(button).toHaveClass('custom-class');\n    expect(button).toHaveClass('accessible-button');\n  });\n\n  test('loading spinner is announced to screen readers', () => {\n    render(<AccessibleButton loading>Submit</AccessibleButton>);\n    \n    expect(screen.getByText('Loading...')).toHaveClass('sr-only');\n  });\n});"}