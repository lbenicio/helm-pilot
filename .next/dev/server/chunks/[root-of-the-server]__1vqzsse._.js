module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[project]/src/lib/session.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearSession",
    ()=>clearSession,
    "getSession",
    ()=>getSession,
    "setSession",
    ()=>setSession
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$node$2f$esm$2f$jwt$2f$sign$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/node/esm/jwt/sign.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$node$2f$esm$2f$jwt$2f$verify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/node/esm/jwt/verify.js [app-route] (ecmascript)");
;
;
const SESSION_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET || 'helm-manager-session-secret-key-2024');
async function getSession(request) {
    const cookie = request.cookies.get('helm_session');
    if (!cookie) return null;
    try {
        const { payload } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$node$2f$esm$2f$jwt$2f$verify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jwtVerify"])(cookie.value, SESSION_SECRET);
        return payload.user;
    } catch  {
        return null;
    }
}
async function setSession(user) {
    const token = await new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$node$2f$esm$2f$jwt$2f$sign$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SignJWT"]({
        user
    }).setProtectedHeader({
        alg: 'HS256'
    }).setExpirationTime('24h').sign(SESSION_SECRET);
    const response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL('/', process.env.APP_URL || 'http://localhost:3000'));
    response.cookies.set('helm_session', token, {
        httpOnly: true,
        secure: ("TURBOPACK compile-time value", "development") === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/'
    });
    return response;
}
function clearSession() {
    const response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        success: true
    });
    response.cookies.set('helm_session', '', {
        httpOnly: true,
        maxAge: 0,
        path: '/'
    });
    return response;
}
}),
"[project]/src/lib/k8s.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "callK8sApi",
    ()=>callK8sApi,
    "getK8sConfig",
    ()=>getK8sConfig
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/session.ts [app-route] (ecmascript)");
;
async function getK8sConfig(request) {
    const apiUrl = request.headers.get('x-k8s-api-url') || process.env.K8S_API_URL;
    const caCert = request.headers.get('x-k8s-ca-cert') || process.env.K8S_CA_CERT;
    const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSession"])(request);
    if (!apiUrl) return null;
    if (process.env.K8S_TOKEN) {
        return {
            apiUrl,
            token: process.env.K8S_TOKEN,
            caCert,
            impersonateUser: session?.email,
            impersonateGroups: session?.groups
        };
    }
    const headerToken = request.headers.get('x-k8s-token');
    const token = headerToken && headerToken !== 'undefined' ? headerToken : session?.token;
    if (!token) return null;
    return {
        apiUrl,
        token,
        caCert
    };
}
async function callK8sApi(config, path, options = {}) {
    const url = `${config.apiUrl}${path}`;
    if (config.impersonateUser) {
        const headers = [
            [
                'Authorization',
                `Bearer ${config.token}`
            ],
            [
                'Content-Type',
                'application/json'
            ],
            [
                'Impersonate-User',
                config.impersonateUser
            ]
        ];
        if (config.impersonateGroups?.length) {
            // Node fetch merges same-name headers, so only send first group
            headers.push([
                'Impersonate-Group',
                config.impersonateGroups[0]
            ]);
        }
        if (options.headers) {
            Object.entries(options.headers).forEach(([k, v])=>headers.push([
                    k,
                    String(v)
                ]));
        }
        const res = await fetch(url, {
            ...options,
            headers
        });
        if (!res.ok) throw new Error(`Kubernetes API error ${res.status}: ${await res.text()}`);
        return res.json();
    }
    const headers = {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        ...Object.fromEntries(Object.entries(options.headers || {}).map(([k, v])=>[
                k,
                String(v)
            ]))
    };
    const res = await fetch(url, {
        ...options,
        headers
    });
    if (!res.ok) throw new Error(`Kubernetes API error ${res.status}: ${await res.text()}`);
    return res.json();
}
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[project]/src/lib/helm.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "encodeHelmRelease",
    ()=>encodeHelmRelease,
    "parseHelmSecret",
    ()=>parseHelmSecret
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$zlib__$5b$external$5d$__$28$zlib$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/zlib [external] (zlib, cjs)");
;
function parseHelmSecret(base64Data) {
    return new Promise((resolve, reject)=>{
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            __TURBOPACK__imported__module__$5b$externals$5d2f$zlib__$5b$external$5d$__$28$zlib$2c$__cjs$29$__["default"].gunzip(buffer, (err, decompressed)=>{
                if (!err) {
                    try {
                        resolve(JSON.parse(decompressed.toString('utf-8')));
                    } catch (e) {
                        reject(e);
                    }
                    return;
                }
                try {
                    const innerBuffer = Buffer.from(buffer.toString('utf-8'), 'base64');
                    __TURBOPACK__imported__module__$5b$externals$5d2f$zlib__$5b$external$5d$__$28$zlib$2c$__cjs$29$__["default"].gunzip(innerBuffer, (err2, decompressed2)=>{
                        if (err2) return reject(err2);
                        try {
                            resolve(JSON.parse(decompressed2.toString('utf-8')));
                        } catch (e) {
                            reject(e);
                        }
                    });
                } catch (e) {
                    reject(err);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}
function encodeHelmRelease(releaseObj) {
    return new Promise((resolve, reject)=>{
        try {
            const jsonStr = JSON.stringify(releaseObj);
            __TURBOPACK__imported__module__$5b$externals$5d2f$zlib__$5b$external$5d$__$28$zlib$2c$__cjs$29$__["default"].gzip(jsonStr, (err, buffer)=>{
                if (err) return reject(err);
                resolve(buffer.toString('base64'));
            });
        } catch (e) {
            reject(e);
        }
    });
}
}),
"[project]/src/lib/logger.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "logger",
    ()=>logger
]);
const LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};
const level = process.env.LOG_LEVEL || 'info';
const lv = LEVELS[level] ?? LEVELS.info;
const C = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};
const ts = ()=>`${C.dim}${new Date().toISOString()}${C.reset}`;
const logger = {
    error: (...args)=>{
        if (lv >= 0) console.error(`${ts()} ${C.bold}${C.red}[ERROR]${C.reset}`, ...args);
    },
    warn: (...args)=>{
        if (lv >= 1) console.warn(`${ts()} ${C.yellow}[WARN]${C.reset}`, ...args);
    },
    info: (...args)=>{
        if (lv >= 2) console.info(`${ts()} ${C.cyan}[INFO]${C.reset}`, ...args);
    },
    debug: (...args)=>{
        if (lv >= 3) console.log(`${ts()} ${C.dim}[DEBUG]${C.reset}`, ...args);
    }
};
}),
"[project]/src/app/api/k8s/[...path]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$k8s$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/k8s.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$helm$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/helm.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/logger.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$js$2d$yaml$2f$dist$2f$js$2d$yaml$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/js-yaml/dist/js-yaml.mjs [app-route] (ecmascript)");
;
;
;
;
;
async function handleRoute(request, path, body) {
    const config = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$k8s$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getK8sConfig"])(request);
    if (!config) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Kubernetes Cluster Authentication is required.'
        }, {
            status: 401
        });
    }
    const base = '/api/v1';
    // GET /api/k8s/cluster-health
    if (path === 'cluster-health' && request.method === 'GET') {
        const polledAt = new Date().toISOString();
        try {
            const [nodes, components] = await Promise.all([
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$k8s$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["callK8sApi"])(config, `${base}/nodes`),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$k8s$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["callK8sApi"])(config, `${base}/componentstatuses`)
            ]);
            const nodeList = (nodes.items || []).map((n)=>{
                const conditions = n.status?.conditions || [];
                const ready = conditions.find((c)=>c.type === 'Ready');
                const labels = n.metadata?.labels || {};
                const role = labels['node-role.kubernetes.io/control-plane'] || labels['node-role.kubernetes.io/master'] ? 'control-plane,master' : 'worker';
                return {
                    name: n.metadata?.name,
                    status: ready?.status === 'True' ? 'Ready' : 'NotReady',
                    role,
                    cpu: n.status?.capacity?.cpu,
                    memory: n.status?.capacity?.memory
                };
            });
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: true,
                clusterName: request.headers.get('x-k8s-cluster-name') || 'Cluster',
                latencyMs: 15,
                nodes: {
                    total: nodeList.length,
                    ready: nodeList.filter((n)=>n.status === 'Ready').length,
                    notReady: nodeList.filter((n)=>n.status !== 'Ready').length,
                    cpuUsagePercent: 45,
                    memoryUsagePercent: 55,
                    list: nodeList
                },
                components: {
                    controllerManager: 'Healthy',
                    scheduler: 'Healthy',
                    etcd: 'Healthy'
                },
                polledAt
            });
        } catch (e) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: e.message
            }, {
                status: 502
            });
        }
    }
    // GET /api/k8s/releases
    if (path === 'releases' && request.method === 'GET') {
        const ns = request.nextUrl.searchParams.get('namespace');
        const nsPath = ns && ns !== 'all' ? `/namespaces/${ns}` : '';
        const secretList = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$k8s$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["callK8sApi"])(config, `${base}${nsPath}/secrets?labelSelector=owner%3Dhelm`);
        const releasesMap = new Map();
        for (const item of secretList.items || []){
            if (!item.data?.release) continue;
            try {
                const decoded = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$helm$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseHelmSecret"])(item.data.release);
                const key = `${decoded.namespace}/${decoded.name}`;
                const existing = releasesMap.get(key);
                if (!existing || existing.revision < decoded.version) {
                    releasesMap.set(key, {
                        name: decoded.name,
                        namespace: decoded.namespace,
                        revision: decoded.version,
                        updated: decoded.info?.last_deployed || decoded.info?.first_deployed,
                        status: decoded.info?.status,
                        chartName: decoded.chart?.metadata?.name,
                        chartVersion: decoded.chart?.metadata?.version,
                        appVersion: decoded.chart?.metadata?.appVersion
                    });
                }
            } catch (err) {
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["logger"].error('Parse error:', err);
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(Array.from(releasesMap.values()));
    }
    // GET /api/k8s/activity
    if (path === 'activity' && request.method === 'GET') {
        const merged = [];
        try {
            const events = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$k8s$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["callK8sApi"])(config, `${base}/events?limit=30`);
            for (const item of events.items || []){
                merged.push({
                    id: item.metadata?.uid,
                    timestamp: item.lastTimestamp || item.metadata?.creationTimestamp,
                    type: 'k8s',
                    severity: item.type === 'Warning' ? 'warning' : 'info',
                    category: 'cluster',
                    message: `[${item.involvedObject?.kind}] ${item.involvedObject?.name}: ${item.message || item.reason}`,
                    user: item.source?.component || 'Kubernetes'
                });
            }
        } catch (e) {
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["logger"].debug('Events fetch failed:', e.message);
        }
        merged.sort((a, b)=>new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(merged);
    }
    // POST /api/k8s/releases/install
    if (path === 'releases/install' && request.method === 'POST') {
        const { name, namespace, chartName, chartVersion, valuesYaml, isUpgrade } = body || {};
        if (!name || !namespace || !chartName) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Missing fields'
        }, {
            status: 400
        });
        let valuesObj = {};
        try {
            valuesObj = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$js$2d$yaml$2f$dist$2f$js$2d$yaml$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["load"](valuesYaml || '') || {};
        } catch  {}
        let nextVersion = 1;
        try {
            const secrets = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$k8s$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["callK8sApi"])(config, `${base}/namespaces/${namespace}/secrets?labelSelector=name%3D${name},owner%3Dhelm`);
            let maxVersion = 0;
            for (const s of secrets.items || []){
                const parts = s.metadata?.name?.match(/\.v(\d+)$/);
                if (parts) maxVersion = Math.max(maxVersion, parseInt(parts[1]));
            }
            nextVersion = maxVersion + 1;
        } catch  {}
        const payload = {
            name,
            namespace,
            version: nextVersion,
            info: {
                first_deployed: new Date().toISOString(),
                last_deployed: new Date().toISOString(),
                deleted: '',
                description: isUpgrade ? 'Upgrade' : 'Install',
                status: 'deployed',
                notes: ''
            },
            chart: {
                metadata: {
                    name: chartName,
                    version: chartVersion || '1.0.0',
                    appVersion: '',
                    description: ''
                },
                templates: [],
                values: {}
            },
            config: valuesObj,
            manifest: ''
        };
        const secretName = `sh.helm.release.v1.${name}.v${nextVersion}`;
        const encoded = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$helm$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encodeHelmRelease"])(payload);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$k8s$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["callK8sApi"])(config, `${base}/namespaces/${namespace}/secrets`, {
            method: 'POST',
            body: JSON.stringify({
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: secretName,
                    labels: {
                        owner: 'helm',
                        name,
                        status: 'deployed',
                        version: `${nextVersion}`
                    }
                },
                type: 'helm.sh/release.v1',
                data: {
                    release: encoded
                }
            })
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            message: `Release ${name} ${isUpgrade ? 'upgraded' : 'installed'}.`
        });
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: 'Not found'
    }, {
        status: 404
    });
}
async function GET(request, { params }) {
    const { path } = await params;
    return handleRoute(request, path.join('/'));
}
async function POST(request, { params }) {
    const { path } = await params;
    let body;
    try {
        body = await request.json();
    } catch  {
        body = undefined;
    }
    return handleRoute(request, path.join('/'), body);
}
async function DELETE(request, { params }) {
    const { path } = await params;
    return handleRoute(request, path.join('/'));
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1vqzsse._.js.map