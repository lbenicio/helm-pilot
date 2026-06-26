import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock motion/react to avoid animation-related issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
    span: 'span',
    circle: 'circle',
    pre: 'pre',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock scrollIntoView (not implemented in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock setInterval to fire N times synchronously and then stop.
// This avoids needing fake timers while still controlling scan execution.
const originalSetInterval = window.setInterval;

function mockSetIntervalForScan() {
  window.setInterval = ((callback: () => void, _ms?: number) => {
    let runs = 0;
    const maxRuns = 12;
    function tick() {
      runs++;
      callback();
      if (runs < maxRuns) {
        setTimeout(tick, 0);
      }
    }
    setTimeout(tick, 0);
    // Return a timer-like object
    return 0 as unknown as ReturnType<typeof setInterval>;
  }) as typeof window.setInterval;
}

function mockSetIntervalOneShot() {
  window.setInterval = ((callback: () => void, _ms?: number) => {
    setTimeout(() => callback(), 0);
    return 0 as unknown as ReturnType<typeof setInterval>;
  }) as typeof window.setInterval;
}

function restoreSetInterval() {
  window.setInterval = originalSetInterval;
}

import AntivirusScanner from '@/components/AntivirusScanner';

describe('AntivirusScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
  });

  // ---------------------------------------------------------------------------
  // Initial render / scan trigger
  // ---------------------------------------------------------------------------
  it('renders the scan UI with header and scan button', () => {
    // Prevent scan from completing (simulate in-progress scan)
    mockSetIntervalOneShot();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    expect(screen.getByText('Kubernetes Antivírus Manifest Scan')).toBeInTheDocument();
    // Scan auto-starts on mount, so button shows scanning state
    expect(screen.getByText('Scanning Deployment...')).toBeInTheDocument();

    restoreSetInterval();
  });

  it('shows the scan button in idle state after scan completes', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    // After the synchronous scan, button should show idle state
    await waitFor(() => {
      expect(screen.getByText('Trigger Antivírus Scan')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Scanning progress and terminal logs
  // ---------------------------------------------------------------------------
  it('shows scanning progress during scan', () => {
    mockSetIntervalOneShot();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    // During scan (before interval fires), progress shows "Scanning Manifest 0%"
    expect(screen.getByText(/Scanning Manifest 0%/)).toBeInTheDocument();

    restoreSetInterval();
  });

  it('displays terminal log entries during scan', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Booting Antivírus Helm & K8s Manifest Scanner/),
      ).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('shows terminal log entries for security rule checks', async () => {
    mockSetIntervalForScan();

    render(
      <AntivirusScanner
        manifest="privileged: true\nhostPath: /data"
        releaseName="test-release"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/CRITICAL: Container runs with elevated host-level root capabilities!/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/CRITICAL: hostPath volume mount exposes node local storage directly!/),
      ).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Findings display after scan completes
  // ---------------------------------------------------------------------------
  it('shows findings list after scan completes', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    await waitFor(() => {
      expect(
        screen.getByText('Vulnerability Inspector & Remediation Reports'),
      ).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('shows security score after scan completes', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    await waitFor(() => {
      expect(screen.getByText('INTEGRITY')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Passed status
  // ---------------------------------------------------------------------------
  it('displays PASSED status for compliant security checks', async () => {
    mockSetIntervalForScan();

    const secureManifest = `
      securityContext:
        privileged: false
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
      resources:
        limits:
          cpu: "500m"
          memory: "512Mi"
    `;

    render(<AntivirusScanner manifest={secureManifest} releaseName="secure-release" />);

    await waitFor(() => {
      const passedElements = screen.getAllByText('PASSED');
      expect(passedElements.length).toBeGreaterThanOrEqual(3);
    });

    restoreSetInterval();
  });

  it('shows Secure Checks count badge', async () => {
    mockSetIntervalForScan();

    const secureManifest = `
      securityContext:
        privileged: false
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
      resources:
        limits:
          cpu: "500m"
          memory: "512Mi"
    `;

    render(<AntivirusScanner manifest={secureManifest} releaseName="secure-release" />);

    await waitFor(() => {
      expect(screen.getByText(/Secure Checks/)).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Failed / severity badges
  // ---------------------------------------------------------------------------
  it('displays severity badges for failed checks (critical, warning)', async () => {
    mockSetIntervalForScan();

    const vulnerableManifest = `
      securityContext:
        privileged: true
      volumes:
        - hostPath:
            path: /var/run/docker.sock
    `;

    render(<AntivirusScanner manifest={vulnerableManifest} releaseName="vuln-release" />);

    await waitFor(() => {
      const criticalBadges = screen.getAllByText('critical');
      expect(criticalBadges.length).toBeGreaterThanOrEqual(2);

      const warningBadges = screen.getAllByText('warning');
      expect(warningBadges.length).toBeGreaterThanOrEqual(2);
    });

    restoreSetInterval();
  });

  it('shows Critical count badge', async () => {
    mockSetIntervalForScan();

    const vulnerableManifest = `
      securityContext:
        privileged: true
      volumes:
        - hostPath:
            path: /var/run/docker.sock
    `;

    render(<AntivirusScanner manifest={vulnerableManifest} releaseName="vuln-release" />);

    await waitFor(() => {
      expect(screen.getByText(/Critical/)).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('shows Warnings count badge', async () => {
    mockSetIntervalForScan();

    const vulnerableManifest = `
      securityContext:
        privileged: true
    `;

    render(<AntivirusScanner manifest={vulnerableManifest} releaseName="vuln-release" />);

    await waitFor(() => {
      expect(screen.getByText(/Warnings/)).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Expandable finding details
  // ---------------------------------------------------------------------------
  it('expands a finding to show description and remediation when clicked', async () => {
    mockSetIntervalForScan();

    const vulnerableManifest = `
      securityContext:
        privileged: true
    `;

    render(<AntivirusScanner manifest={vulnerableManifest} releaseName="vuln-release" />);

    await waitFor(() => {
      expect(
        screen.getByText('Privileged Container Access Enabled'),
      ).toBeInTheDocument();
    });

    const findingButton = screen
      .getByText('Privileged Container Access Enabled')
      .closest('button');
    if (findingButton) {
      await userEvent.click(findingButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(
        screen.getByText('Recommended Remediation configuration'),
      ).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('collapses an expanded finding when clicked again', async () => {
    mockSetIntervalForScan();

    const vulnerableManifest = `
      securityContext:
        privileged: true
    `;

    render(<AntivirusScanner manifest={vulnerableManifest} releaseName="vuln-release" />);

    await waitFor(() => {
      expect(
        screen.getByText('Privileged Container Access Enabled'),
      ).toBeInTheDocument();
    });

    const findingButton = screen
      .getByText('Privileged Container Access Enabled')
      .closest('button');
    if (findingButton) {
      await userEvent.click(findingButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    if (findingButton) {
      await userEvent.click(findingButton);
    }

    await waitFor(() => {
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Copy remediation
  // ---------------------------------------------------------------------------
  it('copies remediation code to clipboard when copy button is clicked', async () => {
    mockSetIntervalForScan();

    const vulnerableManifest = `
      securityContext:
        privileged: true
    `;

    render(<AntivirusScanner manifest={vulnerableManifest} releaseName="vuln-release" />);

    await waitFor(() => {
      expect(
        screen.getByText('Privileged Container Access Enabled'),
      ).toBeInTheDocument();
    });

    const findingButton = screen
      .getByText('Privileged Container Access Enabled')
      .closest('button');
    if (findingButton) {
      await userEvent.click(findingButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Copy snippet')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Copy snippet'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('privileged: false'),
    );

    restoreSetInterval();
  });

  it('shows "Copied configuration!" after copying', async () => {
    mockSetIntervalForScan();

    const vulnerableManifest = `
      securityContext:
        privileged: true
    `;

    render(<AntivirusScanner manifest={vulnerableManifest} releaseName="vuln-release" />);

    await waitFor(() => {
      expect(
        screen.getByText('Privileged Container Access Enabled'),
      ).toBeInTheDocument();
    });

    const findingButton = screen
      .getByText('Privileged Container Access Enabled')
      .closest('button');
    if (findingButton) {
      await userEvent.click(findingButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Copy snippet')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Copy snippet'));

    // The clipboard mock should be called, then after setTimeout(2000ms) "Copied!" shows
    // With real timers, the timeout will fire after 2000ms
    await waitFor(
      () => {
        expect(screen.getByText('Copied configuration!')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Manually triggering a re-scan
  // ---------------------------------------------------------------------------
  it('triggers a new scan when scan button is clicked', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    await waitFor(() => {
      expect(screen.getByText('Trigger Antivírus Scan')).toBeInTheDocument();
    });

    // Set up a one-shot interval mock for the re-scan
    restoreSetInterval();
    mockSetIntervalOneShot();

    await userEvent.click(screen.getByText('Trigger Antivírus Scan'));

    expect(screen.getByText('Scanning Deployment...')).toBeInTheDocument();

    restoreSetInterval();
  });

  it('scan button is disabled while scanning', () => {
    mockSetIntervalOneShot();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    const scanButton = screen.getByText('Scanning Deployment...').closest('button');
    expect(scanButton).toBeDisabled();

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Security score evaluations
  // ---------------------------------------------------------------------------
  it('shows high security score for secure manifest (>= 80)', async () => {
    mockSetIntervalForScan();

    const secureManifest = `
      securityContext:
        privileged: false
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
      resources:
        limits:
          cpu: "500m"
          memory: "512Mi"
    `;

    render(<AntivirusScanner manifest={secureManifest} releaseName="secure-release" />);

    await waitFor(() => {
      expect(screen.getByText('Highly Secure')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('shows warning score for partially secure manifest (50-79)', async () => {
    mockSetIntervalForScan();

    const partialManifest = `
      securityContext:
        privileged: false
    `;

    render(<AntivirusScanner manifest={partialManifest} releaseName="partial-release" />);

    await waitFor(() => {
      expect(screen.getByText('Warning Vulnerabilities')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('shows insecure score for vulnerable manifest (< 50)', async () => {
    mockSetIntervalForScan();

    const vulnerableManifest = `
      securityContext:
        privileged: true
      volumes:
        - hostPath:
            path: /var/run/docker.sock
    `;

    render(<AntivirusScanner manifest={vulnerableManifest} releaseName="vuln-release" />);

    await waitFor(() => {
      expect(screen.getByText('Insecure Configuration')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Vulnerabilities count
  // ---------------------------------------------------------------------------
  it('shows total vulnerabilities flagged count', async () => {
    mockSetIntervalForScan();

    const vulnerableManifest = `
      securityContext:
        privileged: true
      volumes:
        - hostPath:
            path: /var/run/docker.sock
    `;

    render(<AntivirusScanner manifest={vulnerableManifest} releaseName="vuln-release" />);

    await waitFor(() => {
      expect(screen.getByText(/total vulnerabilities flagged/)).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Finding categories display
  // ---------------------------------------------------------------------------
  it('shows category labels for each finding', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    await waitFor(() => {
      // Categories are CSS-uppercased but the DOM text is in original casing.
      // "Process Privilege" appears twice (for privileged-containers and privilege-escalation).
      const processPrivilege = screen.getAllByText('Process Privilege');
      expect(processPrivilege.length).toBe(2);
      expect(screen.getByText('Volume Security')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Static analysis rule details
  // ---------------------------------------------------------------------------
  it('detects privileged: true as critical', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="privileged: true" releaseName="test-release" />);

    await waitFor(() => {
      expect(
        screen.getByText('Privileged Container Access Enabled'),
      ).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('detects hostPath as critical', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="hostPath: /data" releaseName="test-release" />);

    await waitFor(() => {
      expect(screen.getByText('Insecure HostPath Mount Detected')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('detects missing runAsNonRoot as warning', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    await waitFor(() => {
      expect(screen.getByText('Missing runAsNonRoot Directive')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('detects missing resource limits as warning', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    await waitFor(() => {
      expect(screen.getByText('No Resource Limits Configured')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('detects missing allowPrivilegeEscalation: false as warning', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    await waitFor(() => {
      expect(screen.getByText('Privilege Escalation Allowed')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  it('detects missing readOnlyRootFilesystem as info', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    await waitFor(() => {
      expect(screen.getByText('Root Filesystem is Writable')).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Release name in scan target
  // ---------------------------------------------------------------------------
  it('shows the release name in the scan initiation log', async () => {
    mockSetIntervalForScan();

    render(<AntivirusScanner manifest="" releaseName="my-helm-release" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Target: Helm Release "my-helm-release" compiled manifests/),
      ).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Re-scan with different manifest
  // ---------------------------------------------------------------------------
  it('re-runs scan when manifest prop changes', async () => {
    mockSetIntervalForScan();

    const { rerender } = render(
      <AntivirusScanner manifest="" releaseName="test-release" />,
    );

    await waitFor(() => {
      expect(screen.getByText('Trigger Antivírus Scan')).toBeInTheDocument();
    });

    // Re-render with a different manifest triggers re-scan via useEffect
    rerender(<AntivirusScanner manifest="privileged: true" releaseName="test-release" />);

    // The scan restarts
    await waitFor(() => {
      expect(
        screen.getByText('Privileged Container Access Enabled'),
      ).toBeInTheDocument();
    });

    restoreSetInterval();
  });

  // ---------------------------------------------------------------------------
  // Terminal theme elements
  // ---------------------------------------------------------------------------
  it('renders the CRT terminal block', () => {
    mockSetIntervalOneShot();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    expect(screen.getByText('ANTIVÍRUS LOGS TERMINAL')).toBeInTheDocument();
    expect(screen.getByText('K8S STATIC SCANNER')).toBeInTheDocument();

    restoreSetInterval();
  });

  it('shows animated cursor during scan', () => {
    mockSetIntervalOneShot();

    render(<AntivirusScanner manifest="" releaseName="test-release" />);

    expect(screen.getByText('Analyzing YAML configuration elements...')).toBeInTheDocument();

    restoreSetInterval();
  });

  it('shows SUCCESS terminal log after scan completes', async () => {
    mockSetIntervalForScan();

    const secureManifest = `
      securityContext:
        privileged: false
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
      resources:
        limits:
          cpu: "500m"
          memory: "512Mi"
    `;

    render(<AntivirusScanner manifest={secureManifest} releaseName="secure-release" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Antivírus telemetry completed/),
      ).toBeInTheDocument();
    });

    restoreSetInterval();
  });
});
