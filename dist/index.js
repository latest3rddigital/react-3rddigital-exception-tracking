import React from "react";
let currentConfig;
let currentContext = {};
let cleanupHandlers;
const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";
const getGlobalValue = (key) => {
    const globalObject = globalThis;
    return globalObject[key];
};
const getIngestUrl = (url, projectKey) => {
    const baseUrl = url.replace(/\/+$/, "");
    const encodedProjectKey = encodeURIComponent(projectKey);
    if (baseUrl.endsWith(`/exceptions/ingest/${encodedProjectKey}`)) {
        return baseUrl;
    }
    return `${baseUrl}/exceptions/ingest/${encodedProjectKey}`;
};
const isDevMode = () => {
    if (typeof process !== "undefined" && process.env?.NODE_ENV) {
        return process.env.NODE_ENV === "development";
    }
    return false;
};
const assertRequiredConfig = (options) => {
    const missingFields = ["url", "apiKey", "projectKey"].filter((field) => !options[field]?.trim());
    if (missingFields.length > 0) {
        throw new Error(`Exception tracking setup is missing required field(s): ${missingFields.join(", ")}`);
    }
};
const getBrowserAndOs = (userAgent = "") => {
    let browserName = "Unknown Browser";
    let osName = "Unknown OS";
    if (userAgent.includes("Firefox"))
        browserName = "Firefox";
    else if (userAgent.includes("SamsungBrowser"))
        browserName = "Samsung Browser";
    else if (userAgent.includes("Opera") || userAgent.includes("OPR"))
        browserName = "Opera";
    else if (userAgent.includes("Trident"))
        browserName = "Internet Explorer";
    else if (userAgent.includes("Edge") || userAgent.includes("Edg"))
        browserName = "Edge";
    else if (userAgent.includes("Chrome"))
        browserName = "Chrome";
    else if (userAgent.includes("Safari"))
        browserName = "Safari";
    if (userAgent.includes("Android"))
        osName = "Android";
    else if (userAgent.includes("iPhone") || userAgent.includes("iPad"))
        osName = "iOS";
    else if (userAgent.includes("Win"))
        osName = "Windows";
    else if (userAgent.includes("Mac"))
        osName = "macOS";
    else if (userAgent.includes("X11") || userAgent.includes("Linux"))
        osName = "Linux";
    return { browserName, osName };
};
const getFormattedOsName = (osName, osVersion) => {
    const normalized = (osName || "Unknown OS").toLowerCase();
    let label = osName || "Unknown OS";
    if (normalized === "macos" || normalized === "mac os" || normalized === "mac")
        label = "macOS";
    else if (normalized === "ios")
        label = "iOS";
    else if (normalized === "android")
        label = "Android";
    else if (normalized === "windows" || normalized === "win")
        label = "Windows";
    else if (normalized === "linux")
        label = "Linux";
    const version = firstString(osVersion);
    return version && version !== "Unknown" ? `${label} ${version}` : label;
};
const getReactDeviceModel = (osName, userAgent) => {
    if (/iPad/i.test(userAgent))
        return "iPad";
    if (/iPhone/i.test(userAgent))
        return "iPhone";
    if (/Android/i.test(userAgent))
        return "Android Device";
    if (osName === "macOS")
        return "macOS Desktop";
    if (osName === "Windows")
        return "Windows PC";
    if (osName === "Linux")
        return "Linux Desktop";
    return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)
        ? "Mobile Browser"
        : "Desktop Browser";
};
const getRuntimeInfo = () => {
    const capacitor = getGlobalValue("Capacitor");
    const isCapacitorNative = Boolean(capacitor?.isNativePlatform?.());
    const capacitorPlatform = capacitor?.getPlatform?.();
    return {
        runtime: isCapacitorNative ? "capacitor" : "browser",
        platform: capacitorPlatform || "web",
        isCapacitorNative,
    };
};
const getBackendSource = (runtimeInfo) => {
    if (currentConfig?.source && currentConfig.source !== "auto") {
        return currentConfig.source;
    }
    return runtimeInfo.isCapacitorNative ? "capacitor" : "react";
};
const isCapacitorPayload = (payload) => {
    return payload.source === "capacitor" || getRuntimeInfo().isCapacitorNative;
};
const getBrowserVersion = (userAgent, browserName) => {
    const versionMatchers = {
        Chrome: /Chrome\/([\d.]+)/,
        Firefox: /Firefox\/([\d.]+)/,
        "Samsung Browser": /SamsungBrowser\/([\d.]+)/,
        Opera: /(?:Opera|OPR)\/([\d.]+)/,
        "Internet Explorer": /(?:MSIE |rv:)([\d.]+)/,
        Edge: /Edg(?:e)?\/([\d.]+)/,
        Safari: /Version\/([\d.]+).*Safari/,
    };
    return userAgent.match(versionMatchers[browserName])?.[1] || "Unknown";
};
const getScreenInfo = () => {
    if (!isBrowser())
        return {};
    return {
        screenWidth: window.screen?.width,
        screenHeight: window.screen?.height,
        availableScreenWidth: window.screen?.availWidth,
        availableScreenHeight: window.screen?.availHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        colorDepth: window.screen?.colorDepth,
        orientation: window.screen?.orientation?.type ||
            (window.innerHeight > window.innerWidth ? "portrait" : "landscape"),
    };
};
const getNetworkInfo = () => {
    if (!isBrowser())
        return {};
    const navigatorWithConnection = navigator;
    const connection = navigatorWithConnection.connection ||
        navigatorWithConnection.mozConnection ||
        navigatorWithConnection.webkitConnection;
    return {
        onlineStatus: navigator.onLine,
        effectiveType: connection?.effectiveType || "Unknown",
        downlink: connection?.downlink || "Unknown",
        rtt: connection?.rtt || "Unknown",
        saveData: connection?.saveData || false,
    };
};
const getStorageEstimate = async () => {
    if (!isBrowser() || !navigator.storage?.estimate) {
        return undefined;
    }
    try {
        const estimate = await navigator.storage.estimate();
        return {
            quota: estimate.quota,
            usage: estimate.usage,
            usageDetails: estimate
                .usageDetails,
        };
    }
    catch {
        return undefined;
    }
};
const getUserAgentData = () => {
    if (!isBrowser())
        return null;
    const navigatorWithUserAgentData = navigator;
    return navigatorWithUserAgentData.userAgentData || null;
};
const createId = () => {
    const cryptoObject = getGlobalValue("crypto");
    if (cryptoObject?.randomUUID) {
        return cryptoObject.randomUUID();
    }
    if (cryptoObject?.getRandomValues) {
        const values = cryptoObject.getRandomValues(new Uint32Array(4));
        return Array.from(values, (value) => value.toString(16)).join("-");
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};
const getDeviceId = () => {
    const contextDeviceId = firstString(currentContext.deviceId, currentContext.deviceID, currentContext.installationId);
    if (contextDeviceId) {
        return contextDeviceId;
    }
    if (!isBrowser()) {
        return `server:${createId()}`;
    }
    return `web:${createId()}`;
};
const firstString = (...values) => {
    const value = values.find((item) => item !== undefined && item !== null && item !== "");
    return value === undefined ? undefined : String(value);
};
const getTimezoneInfo = () => {
    if (!isBrowser())
        return {};
    const date = new Date();
    return {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffsetMinutes: date.getTimezoneOffset(),
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
    };
};
const getDocumentInfo = () => {
    if (!isBrowser())
        return {};
    return {
        title: document.title,
        referrer: document.referrer || "Direct",
        visibilityState: document.visibilityState,
        hidden: document.hidden,
        characterSet: document.characterSet,
        contentType: document.contentType,
        readyState: document.readyState,
    };
};
const getPerformanceInfo = () => {
    if (!isBrowser())
        return {};
    const navigation = performance.getEntriesByType?.("navigation")?.[0];
    const memory = performance.memory;
    return {
        navigationType: navigation?.type,
        domContentLoadedMs: navigation
            ? Math.round(navigation.domContentLoadedEventEnd)
            : undefined,
        loadEventEndMs: navigation
            ? Math.round(navigation.loadEventEnd)
            : undefined,
        transferSize: navigation?.transferSize,
        encodedBodySize: navigation?.encodedBodySize,
        decodedBodySize: navigation?.decodedBodySize,
        memory,
    };
};
const getMemoryInfo = () => {
    if (!isBrowser())
        return {};
    const memory = performance.memory;
    return {
        deviceMemory: navigator
            .deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
        jsHeapSizeLimit: memory?.jsHeapSizeLimit,
        totalJSHeapSize: memory?.totalJSHeapSize,
        usedJSHeapSize: memory?.usedJSHeapSize,
    };
};
const getHistoryInfo = () => {
    if (!isBrowser())
        return {};
    return {
        historyLength: window.history.length,
        hash: window.location.hash,
        search: window.location.search,
        origin: window.location.origin,
        host: window.location.host,
        protocol: window.location.protocol,
    };
};
const getInstalledWebAppInfo = () => {
    if (!isBrowser())
        return {};
    const navigatorWithStandalone = navigator;
    return {
        standalone: window.matchMedia?.("(display-mode: standalone)")?.matches ||
            navigatorWithStandalone.standalone ||
            false,
        hasInstalledRelatedAppsApi: typeof navigatorWithStandalone.getInstalledRelatedApps === "function",
    };
};
const optionalImport = async (moduleName) => {
    try {
        const importer = new Function("moduleName", "return import(moduleName)");
        return (await importer(moduleName));
    }
    catch {
        return undefined;
    }
};
const getUserAgentHighEntropyData = async () => {
    if (!isBrowser())
        return undefined;
    const navigatorWithUserAgentData = navigator;
    if (!navigatorWithUserAgentData.userAgentData?.getHighEntropyValues) {
        return undefined;
    }
    try {
        return await navigatorWithUserAgentData.userAgentData.getHighEntropyValues([
            "architecture",
            "bitness",
            "model",
            "platformVersion",
            "uaFullVersion",
            "fullVersionList",
            "wow64",
        ]);
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
};
const enrichPayloadWithCapacitor = async (payload) => {
    if (!currentConfig?.enrichWithCapacitor) {
        return payload;
    }
    const runtimeInfo = getRuntimeInfo();
    if (!isCapacitorPayload(payload)) {
        return payload;
    }
    const [deviceModule, appModule] = await Promise.all([
        optionalImport("@capacitor/device"),
        optionalImport("@capacitor/app"),
    ]);
    if (!deviceModule?.Device && !appModule?.App) {
        return {
            ...payload,
            browserInfo: {},
            metadata: {
                ...payload.metadata,
                capacitorDetails: "not-installed",
            },
        };
    }
    try {
        const [deviceInfo, deviceIdInfo, batteryInfo, languageInfo, languageTagInfo, appInfo,] = await Promise.all([
            deviceModule?.Device?.getInfo?.(),
            deviceModule?.Device?.getId?.(),
            deviceModule?.Device?.getBatteryInfo?.(),
            deviceModule?.Device?.getLanguageCode?.(),
            deviceModule?.Device?.getLanguageTag?.(),
            appModule?.App?.getInfo?.(),
        ]);
        const deviceName = firstString(deviceInfo?.name);
        const deviceModel = firstString(deviceInfo?.model);
        const nativeDeviceId = firstString(deviceIdInfo?.identifier);
        const nativeOsName = firstString(deviceInfo?.operatingSystem);
        const nativeOsVersion = firstString(deviceInfo?.osVersion);
        const nativeSystemName = getFormattedOsName(nativeOsName, nativeOsVersion);
        const dashboardDeviceName = deviceInfo?.name ?? "";
        const nativeMemoryInfo = {
            usedMemory: deviceInfo?.memUsed,
            memUsed: deviceInfo?.memUsed,
            jsHeapSizeLimit: payload.memoryInfo?.jsHeapSizeLimit,
            totalJSHeapSize: payload.memoryInfo?.totalJSHeapSize,
            usedJSHeapSize: payload.memoryInfo?.usedJSHeapSize,
        };
        const nativeStorageInfo = {
            totalDiskCapacity: deviceInfo?.diskTotal,
            freeDiskStorage: deviceInfo?.diskFree,
            realDiskTotal: deviceInfo?.realDiskTotal,
            realDiskFree: deviceInfo?.realDiskFree,
            browserStorageEstimate: await getStorageEstimate(),
        };
        const nativeBatteryInfo = {
            ...batteryInfo,
            batteryLevel: batteryInfo?.batteryLevel,
            isCharging: batteryInfo?.isCharging,
        };
        return {
            ...payload,
            appVersion: firstString(appInfo?.version, payload.appVersion) || "1.0.0",
            buildNumber: firstString(appInfo?.build, payload.buildNumber),
            deviceId: nativeDeviceId || "",
            browserInfo: {},
            osInfo: {
                name: nativeSystemName,
                osName: nativeOsName,
                osVersion: nativeOsVersion,
                systemName: nativeSystemName,
                systemVersion: nativeOsVersion,
                platform: firstString(deviceInfo?.platform),
                apiLevel: firstString(deviceInfo?.androidSDKVersion),
            },
            deviceInfo: {
                ...deviceInfo,
                model: dashboardDeviceName,
                modelId: deviceModel,
                capacitorModel: deviceModel,
                deviceId: nativeDeviceId,
                uniqueId: nativeDeviceId,
                installationId: nativeDeviceId,
                systemName: nativeSystemName,
                systemVersion: nativeOsVersion,
                isEmulator: deviceInfo?.isVirtual,
                languageCode: languageInfo?.value,
                languageTag: languageTagInfo?.value,
            },
            memoryInfo: nativeMemoryInfo,
            storageInfo: nativeStorageInfo,
            batteryInfo: nativeBatteryInfo,
            metadata: {
                ...payload.metadata,
                capacitorDetails: "resolved",
                batteryInfo: nativeBatteryInfo,
                memoryInfo: nativeMemoryInfo,
                storageInfo: nativeStorageInfo,
                appInfo,
            },
            otherDetails: {
                ...payload.otherDetails,
                batteryInfo: nativeBatteryInfo,
                memoryInfo: nativeMemoryInfo,
                storageInfo: nativeStorageInfo,
                appInfo,
                capacitorDeviceInfo: deviceInfo,
                capacitorBatteryInfo: batteryInfo,
                capacitorLanguageInfo: languageInfo,
                capacitorLanguageTagInfo: languageTagInfo,
            },
        };
    }
    catch (error) {
        return {
            ...payload,
            browserInfo: {},
            metadata: {
                ...payload.metadata,
                capacitorDetails: "failed",
                capacitorDetailsError: error instanceof Error ? error.message : String(error),
            },
        };
    }
};
const enrichPayload = async (payload) => {
    const isCapacitor = isCapacitorPayload(payload);
    const [userAgentHighEntropyData, storageInfo] = await Promise.all([
        isCapacitor ? Promise.resolve(undefined) : getUserAgentHighEntropyData(),
        getStorageEstimate(),
    ]);
    const capacitorPayload = await enrichPayloadWithCapacitor({
        ...payload,
        storageInfo,
        otherDetails: {
            ...payload.otherDetails,
            storageInfo,
        },
    });
    if (isCapacitor || !userAgentHighEntropyData) {
        return capacitorPayload;
    }
    const highEntropyModel = firstString(userAgentHighEntropyData.model);
    return {
        ...capacitorPayload,
        browserInfo: {
            ...capacitorPayload.browserInfo,
            userAgentHighEntropyData,
        },
        osInfo: {
            ...capacitorPayload.osInfo,
            platformVersion: userAgentHighEntropyData.platformVersion,
            architecture: userAgentHighEntropyData.architecture,
            bitness: userAgentHighEntropyData.bitness,
            wow64: userAgentHighEntropyData.wow64,
        },
        deviceInfo: {
            ...capacitorPayload.deviceInfo,
            model: highEntropyModel || capacitorPayload.deviceInfo.model,
            modelId: highEntropyModel || capacitorPayload.deviceInfo.modelId,
        },
    };
};
export const buildExceptionPayload = ({ source = "manual", title, message, stackTrace = "", exceptionData, metadata = {}, extraData = {}, userInfo = {}, }) => {
    const url = isBrowser() ? window.location.href : undefined;
    const pathname = isBrowser() ? window.location.pathname : undefined;
    const userAgent = isBrowser() ? window.navigator.userAgent : "";
    const { browserName, osName } = getBrowserAndOs(userAgent);
    const formattedOsName = getFormattedOsName(osName);
    const reactDeviceModel = getReactDeviceModel(formattedOsName, userAgent);
    const runtimeInfo = getRuntimeInfo();
    const backendSource = getBackendSource(runtimeInfo);
    const configExtraData = currentConfig?.extraData ?? {};
    const configUserInfo = currentConfig?.userInfo ?? {};
    const screenName = currentContext.screenName ||
        pathname ||
        "UnknownScreen";
    const timestamp = new Date().toISOString();
    const deviceId = getDeviceId();
    const timezoneInfo = getTimezoneInfo();
    const documentInfo = getDocumentInfo();
    const historyInfo = getHistoryInfo();
    const performanceInfo = getPerformanceInfo();
    const memoryInfo = getMemoryInfo();
    const installedWebAppInfo = getInstalledWebAppInfo();
    return {
        source: backendSource,
        title,
        message,
        stackTrace,
        stackSource: source,
        platform: "web",
        timestamp,
        reportedAt: timestamp,
        projectKey: currentConfig?.projectKey ?? "",
        environment: currentConfig?.environment,
        appVersion: currentConfig?.appVersion ?? "1.0.0",
        buildNumber: currentConfig?.buildNumber,
        deviceId,
        pageUrl: url,
        url,
        path: pathname,
        pathname,
        screenName,
        userAgent,
        exceptionData,
        browserInfo: {
            name: browserName,
            version: getBrowserVersion(userAgent, browserName),
            language: isBrowser() ? window.navigator.language : undefined,
            languages: isBrowser() ? window.navigator.languages : undefined,
            cookiesEnabled: isBrowser() ? window.navigator.cookieEnabled : undefined,
            doNotTrack: isBrowser() ? window.navigator.doNotTrack : undefined,
            vendor: isBrowser() ? window.navigator.vendor : undefined,
            userAgentData: getUserAgentData(),
            onlineStatus: isBrowser() ? window.navigator.onLine : undefined,
        },
        osInfo: {
            name: formattedOsName,
            osName,
            systemName: formattedOsName,
            platform: isBrowser() ? window.navigator.platform : undefined,
            ...timezoneInfo,
        },
        deviceInfo: {
            deviceId,
            model: reactDeviceModel,
            modelId: reactDeviceModel,
            systemName: formattedOsName,
            deviceType: /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)
                ? "mobile-browser"
                : "desktop-browser",
            touchPoints: isBrowser()
                ? window.navigator.maxTouchPoints || 0
                : undefined,
            hardwareConcurrency: isBrowser()
                ? window.navigator.hardwareConcurrency || "Unknown"
                : undefined,
            deviceMemory: isBrowser()
                ? window.navigator
                    .deviceMemory || "Unknown"
                : undefined,
            runtime: runtimeInfo.runtime,
            runtimePlatform: runtimeInfo.platform,
            isCapacitorNative: runtimeInfo.isCapacitorNative,
        },
        screenInfo: getScreenInfo(),
        networkInfo: getNetworkInfo(),
        memoryInfo,
        userInfo: {
            ...configUserInfo,
            ...userInfo,
        },
        metadata: {
            ...metadata,
            framework: "react",
            errorSource: source,
            backendSource,
            runtimeSource: runtimeInfo.runtime,
            documentInfo,
            historyInfo,
            performanceInfo,
            memoryInfo,
            installedWebAppInfo,
        },
        otherDetails: {
            documentInfo,
            historyInfo,
            performanceInfo,
            memoryInfo,
            installedWebAppInfo,
        },
        extraData: {
            ...configExtraData,
            ...currentContext,
            ...extraData,
        },
    };
};
export const setExceptionContext = (context) => {
    currentContext = {
        ...currentContext,
        ...context,
    };
};
export const clearExceptionContext = (keys) => {
    if (!keys) {
        currentContext = {};
        return;
    }
    keys.forEach((key) => {
        delete currentContext[key];
    });
};
export const setCurrentScreen = (screenName) => {
    setExceptionContext({ screenName });
};
export const logException = async (payload) => {
    if (!currentConfig?.enabled) {
        return false;
    }
    const enrichedPayload = await enrichPayload(payload);
    const preparedPayload = currentConfig.beforeSend
        ? await currentConfig.beforeSend(enrichedPayload)
        : enrichedPayload;
    if (!preparedPayload) {
        return false;
    }
    try {
        const response = await fetch(getIngestUrl(currentConfig.url, currentConfig.projectKey), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...currentConfig.headers,
                "Api-Key": currentConfig.apiKey,
            },
            body: JSON.stringify(preparedPayload),
            keepalive: true,
        });
        return response.ok;
    }
    catch (error) {
        currentConfig.onError?.(error, preparedPayload);
        return false;
    }
};
export const captureException = async (error, extraData) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    return logException(buildExceptionPayload({
        source: "manual",
        title: normalizedError.name || "Manual Exception",
        message: normalizedError.message || "No message provided",
        stackTrace: normalizedError.stack ?? "",
        extraData,
    }));
};
const getRejectionMessage = (reason) => {
    if (reason instanceof Error)
        return reason.message;
    if (typeof reason === "string")
        return reason;
    try {
        return JSON.stringify(reason);
    }
    catch {
        return String(reason);
    }
};
const installGlobalHandlers = () => {
    if (!isBrowser())
        return undefined;
    const errorHandler = (event) => {
        if (event instanceof ErrorEvent) {
            logException(buildExceptionPayload({
                source: "window.onerror",
                title: event.error?.name || "JavaScript Error",
                message: event.message || "No message provided",
                stackTrace: event.error?.stack ||
                    `${event.filename || "unknown"}:${event.lineno || 0}:${event.colno || 0}`,
                metadata: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                },
            }));
            return;
        }
        if (!currentConfig?.captureResourceErrors) {
            return;
        }
        const target = event.target;
        const resourceUrl = target && "src" in target
            ? String(target.src)
            : target && "href" in target
                ? String(target.href)
                : undefined;
        logException(buildExceptionPayload({
            source: "resource",
            title: "Resource Load Error",
            message: resourceUrl || "A browser resource failed to load",
            stackTrace: "",
            metadata: {
                tagName: target?.tagName,
                resourceUrl,
            },
        }));
    };
    const rejectionHandler = (event) => {
        if (!currentConfig?.captureUnhandledRejections) {
            return;
        }
        const reason = event.reason;
        const error = reason instanceof Error ? reason : undefined;
        logException(buildExceptionPayload({
            source: "window.unhandledrejection",
            title: error?.name || "Unhandled Promise Rejection",
            message: error?.message || getRejectionMessage(reason),
            stackTrace: error?.stack || "No stack trace available",
            metadata: {
                reason: error ? undefined : reason,
            },
        }));
    };
    window.addEventListener("error", errorHandler, true);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
        window.removeEventListener("error", errorHandler, true);
        window.removeEventListener("unhandledrejection", rejectionHandler);
    };
};
export const setupExceptionTracking = (options) => {
    assertRequiredConfig(options);
    cleanupHandlers?.();
    const enabled = options.enabled ?? (options.allowedInDevMode ? true : !isDevMode());
    currentConfig = {
        enabled,
        installGlobalHandlers: true,
        captureUnhandledRejections: true,
        captureResourceErrors: false,
        enrichWithCapacitor: true,
        ...options,
    };
    if (currentConfig.installGlobalHandlers) {
        cleanupHandlers = installGlobalHandlers();
    }
    return () => {
        cleanupHandlers?.();
        cleanupHandlers = undefined;
    };
};
export class ExceptionBoundary extends React.Component {
    constructor() {
        super(...arguments);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, errorInfo) {
        logException(buildExceptionPayload({
            source: "react",
            title: error.name || "React Component Error",
            message: error.message || "No message provided",
            stackTrace: error.stack ?? errorInfo.componentStack ?? "",
            metadata: {
                componentStack: errorInfo.componentStack,
            },
            extraData: this.props.extraData,
        }));
        this.props.onError?.(error, errorInfo);
    }
    render() {
        const { error } = this.state;
        if (error) {
            if (typeof this.props.fallback === "function") {
                return this.props.fallback(error);
            }
            return this.props.fallback ?? null;
        }
        return this.props.children;
    }
}
export default {
    setupExceptionTracking,
    captureException,
    buildExceptionPayload,
    logException,
    setExceptionContext,
    clearExceptionContext,
    setCurrentScreen,
    ExceptionBoundary,
};
