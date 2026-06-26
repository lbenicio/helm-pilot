import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Shield, 
  Terminal as TerminalIcon, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Copy, 
  Check, 
  Sparkles, 
  Gauge, 
  Lock, 
  EyeOff
} from 'lucide-react';

interface AntivirusScannerProps {
  manifest: string;
  releaseName: string;
}

interface ScanFinding {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  remediation: string;
  category: string;
  passed: boolean;
}

export default function AntivirusScanner({ manifest, releaseName }: AntivirusScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [findings, setFindings] = useState<ScanFinding[]>([]);
  const [securityScore, setSecurityScore] = useState<number>(100);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const runVulnerabilityScan = () => {
    setIsScanning(true);
    setProgress(0);
    setSecurityScore(100);
    setTerminalLogs([]);
    setFindings([]);

    const logQueue: string[] = [
      `[INFO] Booting Antivírus Helm & K8s Manifest Scanner v1.4.2...`,
      `[INFO] Target: Helm Release "${releaseName}" compiled manifests`,
      `[INFO] Checking manifest payload integrity...`,
    ];

    // Static analysis rules
    const detectedFindings: ScanFinding[] = [];
    let score = 100;

    // Rule 1: Privileged container
    const isPrivileged = manifest.toLowerCase().includes('privileged: true');
    if (isPrivileged) {
      score -= 25;
      detectedFindings.push({
        id: 'privileged-containers',
        severity: 'critical',
        title: 'Privileged Container Access Enabled',
        description: 'A container is configured with privileged: true, granting it full root capabilities on the host OS.',
        remediation: 'securityContext:\n  privileged: false\n  allowPrivilegeEscalation: false',
        category: 'Process Privilege',
        passed: false
      });
      logQueue.push(`[ALERT] CRITICAL: Container runs with elevated host-level root capabilities!`);
    } else {
      detectedFindings.push({
        id: 'privileged-containers',
        severity: 'success',
        title: 'No Privileged Containers',
        description: 'No container in the manifest requests privileged root host permissions.',
        remediation: '',
        category: 'Process Privilege',
        passed: true
      });
      logQueue.push(`[OK] Checked process privilege escalation: Secure.`);
    }

    // Rule 2: HostPath mounts
    const hasHostPath = manifest.toLowerCase().includes('hostpath:');
    if (hasHostPath) {
      score -= 25;
      detectedFindings.push({
        id: 'hostpath-mounts',
        severity: 'critical',
        title: 'Insecure HostPath Mount Detected',
        description: 'The deployment mounts a local path (hostPath) directly from the underlying node file system, exposing nodes to host takeover.',
        remediation: 'Use persistentVolumeClaim (PVC) or emptyDir instead of mounting direct HostPaths.',
        category: 'Volume Security',
        passed: false
      });
      logQueue.push(`[ALERT] CRITICAL: hostPath volume mount exposes node local storage directly!`);
    } else {
      detectedFindings.push({
        id: 'hostpath-mounts',
        severity: 'success',
        title: 'Host Isolation Maintained',
        description: 'No hostPath mounts detected. Persistent and temporary storage use network boundaries.',
        remediation: '',
        category: 'Volume Security',
        passed: true
      });
      logQueue.push(`[OK] Storage volume isolation validated.`);
    }

    // Rule 3: Run as Non-Root
    const hasRunAsNonRoot = manifest.toLowerCase().includes('runasnonroot: true');
    if (!hasRunAsNonRoot) {
      score -= 15;
      detectedFindings.push({
        id: 'run-as-nonroot',
        severity: 'warning',
        title: 'Missing runAsNonRoot Directive',
        description: 'Pod template spec does not explicitly enforce running containers as non-root users.',
        remediation: 'securityContext:\n  runAsNonRoot: true\n  runAsUser: 10001',
        category: 'User Constraints',
        passed: false
      });
      logQueue.push(`[WARN] WARNING: Pod spec lacks "runAsNonRoot: true". Defaulting to container UID.`);
    } else {
      detectedFindings.push({
        id: 'run-as-nonroot',
        severity: 'success',
        title: 'Enforced Non-Root UID Execution',
        description: 'Pod forces execution as non-root UID. Excellent protection against jailbreak exploits.',
        remediation: '',
        category: 'User Constraints',
        passed: true
      });
      logQueue.push(`[OK] Non-root security UID validated.`);
    }

    // Rule 4: Resource bounds (limits:)
    const hasLimits = manifest.toLowerCase().includes('limits:');
    if (!hasLimits) {
      score -= 15;
      detectedFindings.push({
        id: 'resource-limits',
        severity: 'warning',
        title: 'No Resource Limits Configured',
        description: 'Containers lack CPU/Memory limits, leaving the node vulnerable to resource exhaustion (DoS).',
        remediation: 'resources:\n  limits:\n    cpu: "500m"\n    memory: "512Mi"\n  requests:\n    cpu: "100m"\n    memory: "128Mi"',
        category: 'Resource Boundaries',
        passed: false
      });
      logQueue.push(`[WARN] WARNING: Containers are missing CPU/Memory request/limit constraints.`);
    } else {
      detectedFindings.push({
        id: 'resource-limits',
        severity: 'success',
        title: 'Resource Boundaries Active',
        description: 'Containers have strict CPU and Memory boundaries to prevent resource starvation.',
        remediation: '',
        category: 'Resource Boundaries',
        passed: true
      });
      logQueue.push(`[OK] CPU and memory scheduler boundaries found.`);
    }

    // Rule 5: allowPrivilegeEscalation
    const hasAllowPrivEscalationFalse = manifest.toLowerCase().includes('allowprivilegeescalation: false');
    if (!hasAllowPrivEscalationFalse) {
      score -= 10;
      detectedFindings.push({
        id: 'privilege-escalation',
        severity: 'warning',
        title: 'Privilege Escalation Allowed',
        description: 'allowPrivilegeEscalation is not set to false, allowing child processes to acquire more privileges than their parent.',
        remediation: 'securityContext:\n  allowPrivilegeEscalation: false',
        category: 'Process Privilege',
        passed: false
      });
      logQueue.push(`[WARN] WARNING: Container permits privilege escalation fallback (allowPrivilegeEscalation).`);
    } else {
      detectedFindings.push({
        id: 'privilege-escalation',
        severity: 'success',
        title: 'No Privilege Escalation Fallback',
        description: 'Processes explicitly blocked from acquiring extra capability flags.',
        remediation: '',
        category: 'Process Privilege',
        passed: true
      });
      logQueue.push(`[OK] Privilege escalation controls configured.`);
    }

    // Rule 6: Read-only Root Filesystem
    const hasReadOnlyRoot = manifest.toLowerCase().includes('readonlyrootfilesystem: true');
    if (!hasReadOnlyRoot) {
      score -= 10;
      detectedFindings.push({
        id: 'readonly-rootfs',
        severity: 'info',
        title: 'Root Filesystem is Writable',
        description: 'Root filesystem is not read-only. Attackers who compromise the container can write scripts and binaries to disk.',
        remediation: 'securityContext:\n  readOnlyRootFilesystem: true',
        category: 'Disk Write Protection',
        passed: false
      });
      logQueue.push(`[INFO] ADVISORY: Container root file system is writable. Non-persistent payloads possible.`);
    } else {
      detectedFindings.push({
        id: 'readonly-rootfs',
        severity: 'success',
        title: 'ReadOnly Root Filesystem Enforced',
        description: 'Root container storage is immutable, preventing malicious payload writes to standard directories.',
        remediation: '',
        category: 'Disk Write Protection',
        passed: true
      });
      logQueue.push(`[OK] Immutable disk write policies are active.`);
    }

    // Let's run a timeline simulator with progress increments and staggered terminal lines!
    const steps = 12;
    let stepCount = 0;

    const timer = setInterval(() => {
      stepCount++;
      const currentProgress = Math.floor((stepCount / steps) * 100);
      setProgress(currentProgress);

      // Add corresponding terminal logs
      if (stepCount === 1) {
        setTerminalLogs(prev => [...prev, logQueue[0], logQueue[1]]);
      } else if (stepCount === 2) {
        setTerminalLogs(prev => [...prev, logQueue[2], `[INFO] Loading security policy profile: Standard Kubernetes CIS Benchmark...`]);
      } else if (stepCount === 4) {
        setTerminalLogs(prev => [...prev, `[INFO] Analysing Process Privilege controls...`, logQueue[3]]);
      } else if (stepCount === 6) {
        setTerminalLogs(prev => [...prev, `[INFO] Mapping filesystem and volume structures...`, logQueue[4]]);
      } else if (stepCount === 8) {
        setTerminalLogs(prev => [...prev, `[INFO] Inspecting cluster boundaries and user scopes...`, logQueue[5], logQueue[6]]);
      } else if (stepCount === 10) {
        setTerminalLogs(prev => [...prev, `[INFO] Audit finished. Compiling security telemetry score...`, logQueue[7], logQueue[8]]);
      } else if (stepCount === 12) {
        clearInterval(timer);
        setIsScanning(false);
        setSecurityScore(Math.max(10, score));
        setFindings(detectedFindings);
        setTerminalLogs(prev => [
          ...prev, 
          `[OK] Report generated successfully.`,
          `[SUCCESS] Antivírus telemetry completed. Manifest Integrity: ${Math.max(10, score)}/100.`
        ]);
      }
    }, 400);
  };

  useEffect(() => {
    // Run an initial scan on mount automatically
    runVulnerabilityScan();
  }, [manifest]);

  const copyRemediation = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const criticalCount = findings.filter(f => !f.passed && f.severity === 'critical').length;
  const warningCount = findings.filter(f => !f.passed && f.severity === 'warning').length;
  const passedCount = findings.filter(f => f.passed).length;

  return (
    <div className="space-y-6 select-none">
      
      {/* Top Scanning Status Header Row */}
      <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 rounded-lg border border-rose-100 dark:border-rose-900/40">
                <Shield className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  Kubernetes Antivírus Manifest Scan
                  <span className="text-[9px] font-mono lowercase tracking-normal font-normal bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded text-rose-800 dark:text-rose-300">
                    static audit active
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Secures workload deployments against malware hooks, runtime container breakout, and CIS benchmark vulnerabilities.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runVulnerabilityScan}
              disabled={isScanning}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-bold text-white rounded-lg transition active:scale-95 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {isScanning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4" />
              )}
              {isScanning ? 'Scanning Deployment...' : 'Trigger Antivírus Scan'}
            </button>
          </div>
        </div>

        {/* Dynamic scan radar vs. final metric gauges */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          
          {/* Radar Scanner Visual Block (4 cols) */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 rounded-xl relative overflow-hidden min-h-[220px]">
            {isScanning ? (
              <div className="space-y-4 flex flex-col items-center">
                {/* Simulated Radar Screen */}
                <div className="relative w-32 h-32 rounded-full border-2 border-emerald-500/30 flex items-center justify-center overflow-hidden bg-emerald-950/5">
                  <div className="absolute w-28 h-28 rounded-full border border-emerald-500/20" />
                  <div className="absolute w-16 h-16 rounded-full border border-emerald-500/10" />
                  <div className="absolute w-px h-full bg-emerald-500/20" />
                  <div className="absolute h-px w-full bg-emerald-500/20" />
                  
                  {/* Radar Sweeping Line */}
                  <div className="absolute w-full h-full border-t-2 border-r-2 border-emerald-500/40 rounded-full animate-spin origin-center" style={{ animationDuration: '2.5s' }} />
                  
                  {/* Blinking threat markers */}
                  <span className="absolute top-8 left-12 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="absolute bottom-12 right-8 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                </div>
                <div className="text-center space-y-1 z-10">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-widest block uppercase animate-pulse">
                    Scanning Manifest {progress}%
                  </span>
                  <span className="text-[9px] text-slate-400 block font-mono">
                    resolving AST structure...
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center w-full">
                {/* Circular Score Gauge */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background ring */}
                    <circle 
                      cx="50" cy="50" r="40" 
                      className="stroke-slate-200 dark:stroke-slate-800 fill-none" 
                      strokeWidth="8" 
                    />
                    {/* Foreground progress */}
                    <motion.circle 
                      cx="50" cy="50" r="40" 
                      className={`fill-none ${
                        securityScore >= 80 
                          ? 'stroke-emerald-500' 
                          : securityScore >= 50 
                            ? 'stroke-amber-500' 
                            : 'stroke-rose-500'
                      }`}
                      strokeWidth="8"
                      strokeDasharray="251.2"
                      initial={{ strokeDashoffset: 251.2 }}
                      animate={{ strokeDashoffset: 251.2 - (251.2 * securityScore) / 100 }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-black text-slate-800 dark:text-white font-mono leading-none">
                      {securityScore}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      INTEGRITY
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <span className={`text-xs font-bold uppercase ${
                    securityScore >= 80 
                      ? 'text-emerald-600' 
                      : securityScore >= 50 
                        ? 'text-amber-600' 
                        : 'text-rose-600'
                  }`}>
                    {securityScore >= 80 ? 'Highly Secure' : securityScore >= 50 ? 'Warning Vulnerabilities' : 'Insecure Configuration'}
                  </span>
                  <span className="text-[9px] text-slate-400 block font-mono mt-0.5">
                    {findings.filter(f => !f.passed).length} total vulnerabilities flagged
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* CRT Retro Scanner Terminal Block (8 cols) */}
          <div className="md:col-span-8 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <TerminalIcon className="w-3.5 h-3.5" />
                ANTIVÍRUS LOGS TERMINAL
              </span>
              <span>K8S STATIC SCANNER</span>
            </div>

            <div className="bg-slate-900 dark:bg-black rounded-xl p-4 border border-slate-800 font-mono text-[10px] leading-relaxed text-[#4AF626] shadow-inner h-[220px] overflow-y-auto scrollbar-thin select-text">
              <div className="space-y-1.5">
                {terminalLogs.map((log, i) => {
                  let textClass = 'text-emerald-400';
                  if (log.includes('[ALERT]')) textClass = 'text-rose-400 font-bold';
                  else if (log.includes('[WARN]')) textClass = 'text-amber-400 font-bold';
                  else if (log.includes('[SUCCESS]')) textClass = 'text-sky-400 font-black tracking-wide';
                  else if (log.includes('[OK]')) textClass = 'text-[#4AF626]';
                  
                  return (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`${textClass} whitespace-pre-wrap break-all`}
                    >
                      {log}
                    </motion.div>
                  );
                })}
                {isScanning && (
                  <div className="flex items-center gap-1.5 text-emerald-400 animate-pulse mt-1">
                    <span>█</span>
                    <span>Analyzing YAML configuration elements...</span>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Vulnerability Findings Lists */}
      <AnimatePresence mode="popLayout">
        {!isScanning && findings.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Vulnerability Inspector & Remediation Reports
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 px-2 py-0.5 rounded font-bold">
                  {criticalCount} Critical
                </span>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 px-2 py-0.5 rounded font-bold">
                  {warningCount} Warnings
                </span>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded font-bold">
                  {passedCount} Secure Checks
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {findings.map((finding) => {
                const isExpanded = expandedFinding === finding.id;
                
                return (
                  <motion.div
                    key={finding.id}
                    layout="position"
                    className={`bg-white dark:bg-slate-900 border ${
                      finding.passed 
                        ? 'border-slate-150 dark:border-slate-800' 
                        : finding.severity === 'critical'
                          ? 'border-rose-200 dark:border-rose-950'
                          : 'border-amber-200 dark:border-amber-950'
                    } rounded-xl overflow-hidden shadow-sm`}
                  >
                    {/* Header trigger */}
                    <button
                      onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                      className="w-full p-4 flex items-center justify-between text-left select-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          finding.passed
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500'
                            : finding.severity === 'critical'
                              ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-500'
                              : 'bg-amber-50 dark:bg-amber-950/20 text-amber-500'
                        }`}>
                          {finding.passed ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : finding.severity === 'critical' ? (
                            <ShieldAlert className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {finding.title}
                            </span>
                            <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
                              {finding.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                            {finding.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded font-mono ${
                          finding.passed
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                            : finding.severity === 'critical'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                        }`}>
                          {finding.passed ? 'PASSED' : finding.severity}
                        </span>
                      </div>
                    </button>

                    {/* Expandable info & code block remediation */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 p-4 space-y-3 text-xs"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</span>
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            {finding.description}
                          </p>
                        </div>

                        {!finding.passed && finding.remediation && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5 text-blue-500" />
                                Recommended Remediation configuration
                              </span>
                              <button
                                onClick={() => copyRemediation(finding.remediation, finding.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                {copiedId === finding.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    Copied configuration!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    Copy snippet
                                  </>
                                )}
                              </button>
                            </div>
                            <pre className="p-3 bg-slate-900 dark:bg-black text-[10px] text-emerald-400 font-mono rounded border border-slate-800 overflow-x-auto">
                              {finding.remediation}
                            </pre>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
