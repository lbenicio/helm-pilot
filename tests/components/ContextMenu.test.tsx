import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ContextMenu from '@/components/ContextMenu';

const fn = () => vi.fn<() => void>();

describe('ContextMenu', () => {
  let onClose: ReturnType<typeof fn>;
  let optionOnClick1: ReturnType<typeof fn>;
  let optionOnClick2: ReturnType<typeof fn>;

  beforeEach(() => {
    onClose = fn();
    optionOnClick1 = fn();
    optionOnClick2 = fn();
    vi.clearAllMocks();
  });

  it('renders at the given x,y position', () => {
    const options = [{ label: 'Test', onClick: fn() }];
    render(<ContextMenu x={150} y={200} options={options} onClose={onClose} />);
    const menu = screen.getByRole('button', { name: 'Test' }).closest('div.fixed') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.style.top).toBe('200px');
    expect(menu.style.left).toBe('150px');
  });

  it('renders option buttons', () => {
    const options = [
      { label: 'Copy Path', onClick: optionOnClick1, icon: <span>📋</span> },
      { label: 'Delete', onClick: optionOnClick2 },
    ];
    render(<ContextMenu x={0} y={0} options={options} onClose={onClose} />);
    expect(screen.getByText('Copy Path')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('clicking an option calls its onClick and then onClose', async () => {
    const user = userEvent.setup();
    const options = [{ label: 'Copy Path', onClick: optionOnClick1 }];
    render(<ContextMenu x={0} y={0} options={options} onClose={onClose} />);
    await user.click(screen.getByText('Copy Path'));
    expect(optionOnClick1).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking an option triggers the specific handler', async () => {
    const user = userEvent.setup();
    const options = [
      { label: 'Option A', onClick: optionOnClick1 },
      { label: 'Option B', onClick: optionOnClick2 },
    ];
    render(<ContextMenu x={0} y={0} options={options} onClose={onClose} />);
    await user.click(screen.getByText('Option B'));
    expect(optionOnClick1).not.toHaveBeenCalled();
    expect(optionOnClick2).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the menu', async () => {
    const options = [{ label: 'Test', onClick: fn() }];
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ContextMenu x={0} y={0} options={options} onClose={onClose} />
      </div>,
    );
    await userEvent.setup().click(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on right-click (contextmenu event) on the menu', () => {
    const options = [{ label: 'Test', onClick: fn() }];
    render(<ContextMenu x={0} y={0} options={options} onClose={onClose} />);
    const menu = screen.getByText('Test').closest('div.fixed') as HTMLElement;
    fireEvent.contextMenu(menu);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders disabled buttons', () => {
    const options = [
      { label: 'Enabled', onClick: optionOnClick1 },
      { label: 'Disabled', onClick: optionOnClick2, disabled: true },
    ];
    render(<ContextMenu x={0} y={0} options={options} onClose={onClose} />);
    expect(screen.getByText('Disabled')).toBeDisabled();
  });

  it('clicking a disabled button does not call onClick', async () => {
    const options = [{ label: 'Disabled', onClick: optionOnClick1, disabled: true }];
    render(<ContextMenu x={0} y={0} options={options} onClose={onClose} />);
    await userEvent.setup().click(screen.getByText('Disabled'));
    expect(optionOnClick1).not.toHaveBeenCalled();
  });

  it('renders without options gracefully', () => {
    render(<ContextMenu x={0} y={0} options={[]} onClose={onClose} />);
    expect(document.querySelector('.fixed')).toBeInTheDocument();
    expect(document.querySelectorAll('.fixed button').length).toBe(0);
  });

  it('removes window click listener on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const options = [{ label: 'Test', onClick: fn() }];
    const { unmount } = render(<ContextMenu x={0} y={0} options={options} onClose={onClose} />);
    expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
  });
});
