import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HelmChart } from '@/types/helm-chart.type';
import type { K8sCluster } from '@/types/k8s-cluster.type';

import InstallChartModal from '@/components/InstallChartModal';

const mockChart: HelmChart = {
  name: 'nginx',
  repo: 'bitnami',
  description: 'NGINX Open Source is a web server',
  version: '15.1.0',
  appVersion: '1.27.0',
  defaultValues: 'replicaCount: 1\nservice:\n  type: ClusterIP',
};

const mockCluster: K8sCluster = {
  id: 'test-cluster',
  name: 'production-gke',
  apiUrl: 'https://prod.k8s.example.com',
  token: 'my-token',
  caCert: 'my-ca-cert',
};

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('InstallChartModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  const defaultProps = {
    chart: mockChart,
    activeCluster: mockCluster,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  function renderModal(props = {}) {
    return render(<InstallChartModal {...defaultProps} {...props} />);
  }

  // --- Chart name in header ---
  it('renders chart name in the header', () => {
    renderModal();
    expect(screen.getByText('Deploy: nginx')).toBeInTheDocument();
  });

  it('shows active cluster name in header', () => {
    renderModal();
    expect(screen.getByText('production-gke')).toBeInTheDocument();
  });

  it('shows "Active Cluster" fallback when no cluster', () => {
    renderModal({ activeCluster: null });
    expect(screen.getByText('Active Cluster')).toBeInTheDocument();
  });

  // --- Close button ---
  it('renders close button that calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    const header = document.querySelector('.flex.items-center.justify-between.border-b');
    const closeBtn = header?.querySelector('button');
    if (closeBtn) {
      await user.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    }
  });

  // --- Basic step ---
  it('shows Basic step by default with release name input', () => {
    renderModal();
    expect(screen.getByText('Release Name')).toBeInTheDocument();
  });

  it('release name defaults to chart name', () => {
    renderModal();
    const releaseNameInput = screen.getByPlaceholderText('e.g. my-release') as HTMLInputElement;
    expect(releaseNameInput.value).toBe('nginx');
  });

  it('shows namespace input on Basic step', () => {
    renderModal();
    expect(screen.getByText('Namespace')).toBeInTheDocument();
  });

  it('namespace defaults to "default"', () => {
    renderModal();
    const namespaceInput = screen.getByPlaceholderText('default') as HTMLInputElement;
    expect(namespaceInput.value).toBe('default');
  });

  it('shows chart version input on Basic step', () => {
    renderModal();
    expect(screen.getByText('Chart Version')).toBeInTheDocument();
  });

  it('chart version defaults to chart version', () => {
    renderModal();
    const versionInput = screen.getByDisplayValue('15.1.0') as HTMLInputElement;
    expect(versionInput).toBeInTheDocument();
  });

  it('shows info callout about Advanced step', () => {
    renderModal();
    expect(screen.getByText(/Ready to deploy with defaults/)).toBeInTheDocument();
  });

  // --- Step switching via step indicator (in the step nav bar) ---
  it('clicking Advanced step indicator switches to Advanced step', async () => {
    const user = userEvent.setup();
    renderModal();

    // The step nav bar is the flex container with step indicator buttons
    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2');
    const advancedStepBtn = within(stepBar as HTMLElement).getByText('Advanced');
    await user.click(advancedStepBtn);

    await waitFor(() => {
      // "values.yaml" label is unique to the Advanced step
      expect(screen.getByText('values.yaml')).toBeInTheDocument();
    });
  });

  it('Advanced step shows values.yaml editor', async () => {
    const user = userEvent.setup();
    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2');
    await user.click(within(stepBar as HTMLElement).getByText('Advanced'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('# values.yaml')).toBeInTheDocument();
    });
  });

  it('values.yaml editor contains default values', async () => {
    const user = userEvent.setup();
    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2');
    await user.click(within(stepBar as HTMLElement).getByText('Advanced'));

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('# values.yaml') as HTMLTextAreaElement;
      expect(textarea.value).toContain('replicaCount: 1');
    });
  });

  it('Advanced step shows Format button', async () => {
    const user = userEvent.setup();
    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2');
    await user.click(within(stepBar as HTMLElement).getByText('Advanced'));

    await waitFor(() => {
      expect(screen.getByText('Format')).toBeInTheDocument();
    });
  });

  // --- Step switching back: Advanced -> Basic ---
  it('clicking Basic step indicator on Advanced step goes back to Basic', async () => {
    const user = userEvent.setup();
    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('values.yaml')).toBeInTheDocument());

    await user.click(within(stepBar).getByText('Basic'));
    await waitFor(() => expect(screen.getByText('Release Name')).toBeInTheDocument());
  });

  // --- Footer buttons ---
  it('Advanced button in Basic step footer navigates to Advanced', async () => {
    const user = userEvent.setup();
    renderModal();

    // On Basic step, the footer has [Cancel] [Advanced >]
    // The button text includes a trailing space: "Advanced " + icon
    // Use a regex or partial match
    const form = document.querySelector('form') as HTMLElement;
    const advancedBtn = within(form).getByRole('button', { name: /Advanced/ });
    await user.click(advancedBtn);

    await waitFor(() => {
      expect(screen.getByText('values.yaml')).toBeInTheDocument();
    });
  });

  it('clicking Basic in Advanced footer goes back to Basic step', async () => {
    const user = userEvent.setup();
    renderModal();

    // Go to Advanced step via step indicator
    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    // Go back via "Basic" button in footer (has ArrowLeft icon)
    const form = document.querySelector('form') as HTMLElement;
    const basicBtn = within(form).getByRole('button', { name: /Basic/ });
    await user.click(basicBtn);

    await waitFor(() => expect(screen.getByText('Release Name')).toBeInTheDocument());
  });

  // --- Deploy button ---
  it('shows Deploy button on Advanced step', async () => {
    const user = userEvent.setup();
    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));

    await waitFor(() => {
      expect(screen.getByText('Deploy')).toBeInTheDocument();
    });
  });

  it('Deploy button submits the form', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Chart deployed successfully!' }),
    });

    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    await user.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/k8s/releases/install',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('Deploy button sends correct payload', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Chart deployed successfully!' }),
    });

    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    await user.click(screen.getByText('Deploy'));

    await waitFor(() => {
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.name).toBe('nginx');
      expect(body.namespace).toBe('default');
      expect(body.chartName).toBe('nginx');
      expect(body.repoName).toBe('bitnami');
      expect(body.chartVersion).toBe('15.1.0');
      expect(body.isUpgrade).toBe(false);
    });
  });

  it('includes activeCluster headers in deploy request', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Chart deployed successfully!' }),
    });

    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    await user.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-k8s-api-url': 'https://prod.k8s.example.com',
            'x-k8s-token': 'my-token',
            'x-k8s-ca-cert': 'my-ca-cert',
          }),
        }),
      );
    });
  });

  // --- Success message ---
  it('shows success message after successful deploy', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Chart deployed successfully!' }),
    });

    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    await user.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(screen.getByText('Chart deployed successfully!')).toBeInTheDocument();
    });
  });

  // --- Error message ---
  it('shows error message after failed deploy', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Installation failed: resource already exists' }),
    });

    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    await user.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(screen.getByText('Installation failed: resource already exists')).toBeInTheDocument();
    });
  });

  it('shows error for network failure', async () => {
    const user = userEvent.setup();
    // The deploy fetch will reject; err.message is 'Network error' (no trailing dot)
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    // Fallback for any other calls
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    await user.click(screen.getByText('Deploy'));

    // The component sets error to err.message which is 'Network error' (no dot)
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  // --- Deploying state ---
  it('shows "Deploying..." text and spinner during deploy', async () => {
    const user = userEvent.setup();
    mockFetch.mockReturnValue(new Promise(() => {}));

    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    await user.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(screen.getByText('Deploying...')).toBeInTheDocument();
    });
  });

  it('disables Deploy button when deploying', async () => {
    const user = userEvent.setup();
    mockFetch.mockReturnValue(new Promise(() => {}));

    renderModal();

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    const deployBtn = screen.getByRole('button', { name: /Deploy/ });
    await user.click(deployBtn);

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Deploying/ });
      expect(btn).toBeDisabled();
    });
  });

  // --- Cancel buttons ---
  it('Cancel button in Basic step calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    // On Basic step, footer has [Cancel] [Advanced >]
    const form = document.querySelector('form') as HTMLElement;
    const cancelBtns = within(form).getAllByText('Cancel');
    await user.click(cancelBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel button in Advanced step calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    const stepBar = document.querySelector('.flex.items-center.justify-center.gap-2') as HTMLElement;
    await user.click(within(stepBar).getByText('Advanced'));
    await waitFor(() => expect(screen.getByText('Deploy')).toBeInTheDocument());

    const form = document.querySelector('form') as HTMLElement;
    const cancelBtns = within(form).getAllByText('Cancel');
    await user.click(cancelBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });

  // --- Release name sanitization ---
  it('sanitizes release name input (lowercase, no special chars)', async () => {
    const user = userEvent.setup();
    renderModal();

    const releaseNameInput = screen.getByPlaceholderText('e.g. my-release') as HTMLInputElement;
    await user.clear(releaseNameInput);
    await user.type(releaseNameInput, 'My-Release!');

    expect(releaseNameInput.value).not.toContain('!');
    expect(releaseNameInput.value).not.toContain('M');
    expect(releaseNameInput.value).not.toContain('R');
  });

  // --- Rocket icon in header ---
  it('renders Rocket icon in the header', () => {
    renderModal();
    const rocketIcon = document.querySelector('.lucide-rocket');
    expect(rocketIcon).toBeInTheDocument();
  });
});
