import React from "react";

declare const process:
  | {
      env?: {
        NODE_ENV?: string;
      };
    }
  | undefined;

export type ExtraData = Record<string, unknown>;

export type ExceptionContext = ExtraData & {
  screenName?: string;
  userId?: string | number;
};

export type ExceptionSource =
  | "react"
  | "window.onerror"
  | "window.unhandledrejection"
  | "resource"
  | "manual";

export type ExceptionPayloadInput = {
  source: ExceptionSource;
  title: string;
  message: string;
  stackTrace?: string;
  metadata?: ExtraData;
  extraData?: ExtraData;
};

export type ExceptionPayload = {
  source: ExceptionSource;
  title: string;
  message: string;
  stackTrace: string;
  stackSource: ExceptionSource;
  platform: "web";
  timestamp: string;
  projectKey: string;
  appVersion: string;
  url?: string;
  pathname?: string;
  screenName?: string;
  userAgent?: string;
  browserInfo: ExtraData;
  osInfo: ExtraData;
  deviceInfo: ExtraData;
  screenInfo: ExtraData;
  networkInfo: ExtraData;
  metadata: ExtraData;
  extraData: ExtraData;
};

export type SetupExceptionTrackingOptions = {
  url: string;
  apiKey: string;
  projectKey: string;
  headers?: Record<string, string>;
  extraData?: ExceptionContext;
  appVersion?: string;
  enabled?: boolean;
  allowedInDevMode?: boolean;
  installGlobalHandlers?: boolean;
  captureUnhandledRejections?: boolean;
  captureResourceErrors?: boolean;
  beforeSend?: (
    payload: ExceptionPayload,
  ) => ExceptionPayload | null | Promise<ExceptionPayload | null>;
  onError?: (error: unknown, payload?: ExceptionPayload) => void;
};

export type CleanupExceptionTracking = () => void;

export type ExceptionBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((error: Error) => React.ReactNode);
  extraData?: ExtraData;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type InternalConfig = Required<
  Pick<
    SetupExceptionTrackingOptions,
    | "enabled"
    | "installGlobalHandlers"
    | "captureUnhandledRejections"
    | "captureResourceErrors"
  >
> &
  Omit<
    SetupExceptionTrackingOptions,
    | "enabled"
    | "installGlobalHandlers"
    | "captureUnhandledRejections"
    | "captureResourceErrors"
  >;

let currentConfig: InternalConfig | undefined;
let currentContext: ExceptionContext = {};
let cleanupHandlers: CleanupExceptionTracking | undefined;

const isBrowser = () =>
  typeof window !== "undefined" && typeof document !== "undefined";

const getIngestUrl = (url: string, projectKey: string) => {
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

const assertRequiredConfig = (options: SetupExceptionTrackingOptions) => {
  const missingFields = (["url", "apiKey", "projectKey"] as const).filter(
    (field) => !options[field]?.trim(),
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Exception tracking setup is missing required field(s): ${missingFields.join(", ")}`,
    );
  }
};

const getBrowserAndOs = (userAgent = "") => {
  let browserName = "Unknown Browser";
  let osName = "Unknown OS";

  if (userAgent.includes("Firefox")) browserName = "Firefox";
  else if (userAgent.includes("SamsungBrowser"))
    browserName = "Samsung Browser";
  else if (userAgent.includes("Opera") || userAgent.includes("OPR"))
    browserName = "Opera";
  else if (userAgent.includes("Trident")) browserName = "Internet Explorer";
  else if (userAgent.includes("Edge") || userAgent.includes("Edg"))
    browserName = "Edge";
  else if (userAgent.includes("Chrome")) browserName = "Chrome";
  else if (userAgent.includes("Safari")) browserName = "Safari";

  if (userAgent.includes("Win")) osName = "Windows";
  else if (userAgent.includes("Mac")) osName = "macOS";
  else if (userAgent.includes("X11") || userAgent.includes("Linux"))
    osName = "Linux";
  else if (userAgent.includes("Android")) osName = "Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad"))
    osName = "iOS";

  return { browserName, osName };
};

const getBrowserVersion = (userAgent: string, browserName: string) => {
  const versionMatchers: Record<string, RegExp> = {
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

const getScreenInfo = (): ExtraData => {
  if (!isBrowser()) return {};

  return {
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    availableScreenWidth: window.screen?.availWidth,
    availableScreenHeight: window.screen?.availHeight,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    colorDepth: window.screen?.colorDepth,
    orientation:
      window.screen?.orientation?.type ||
      (window.innerHeight > window.innerWidth ? "portrait" : "landscape"),
  };
};

const getNetworkInfo = (): ExtraData => {
  if (!isBrowser()) return {};

  const navigatorWithConnection = navigator as Navigator & {
    connection?: ExtraData;
    mozConnection?: ExtraData;
    webkitConnection?: ExtraData;
  };
  const connection =
    navigatorWithConnection.connection ||
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

const getUserAgentData = (): ExtraData | null => {
  if (!isBrowser()) return null;

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: ExtraData;
  };

  return navigatorWithUserAgentData.userAgentData || null;
};

export const buildExceptionPayload = ({
  source,
  title,
  message,
  stackTrace = "",
  metadata = {},
  extraData = {},
}: ExceptionPayloadInput): ExceptionPayload => {
  const url = isBrowser() ? window.location.href : undefined;
  const pathname = isBrowser() ? window.location.pathname : undefined;
  const userAgent = isBrowser() ? window.navigator.userAgent : "";
  const { browserName, osName } = getBrowserAndOs(userAgent);
  const configExtraData = currentConfig?.extraData ?? {};
  const screenName =
    (currentContext.screenName as string | undefined) ||
    pathname ||
    "UnknownScreen";

  return {
    source,
    title,
    message,
    stackTrace,
    stackSource: source,
    platform: "web",
    timestamp: new Date().toISOString(),
    projectKey: currentConfig?.projectKey ?? "",
    appVersion: currentConfig?.appVersion ?? "1.0.0",
    url,
    pathname,
    screenName,
    userAgent,
    browserInfo: {
      name: browserName,
      version: getBrowserVersion(userAgent, browserName),
      language: isBrowser() ? window.navigator.language : undefined,
      languages: isBrowser() ? window.navigator.languages : undefined,
      cookiesEnabled: isBrowser() ? window.navigator.cookieEnabled : undefined,
      doNotTrack: isBrowser() ? window.navigator.doNotTrack : undefined,
      vendor: isBrowser() ? window.navigator.vendor : undefined,
      userAgentData: getUserAgentData(),
    },
    osInfo: {
      osName,
      platform: isBrowser() ? window.navigator.platform : undefined,
    },
    deviceInfo: {
      deviceId: "browser",
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
        ? (window.navigator as Navigator & { deviceMemory?: number })
            .deviceMemory || "Unknown"
        : undefined,
    },
    screenInfo: getScreenInfo(),
    networkInfo: getNetworkInfo(),
    metadata: {
      ...metadata,
      framework: "react",
      referrer: isBrowser() ? document.referrer || "Direct" : undefined,
    },
    extraData: {
      ...configExtraData,
      ...currentContext,
      ...extraData,
    },
  };
};

export const setExceptionContext = (context: ExceptionContext) => {
  currentContext = {
    ...currentContext,
    ...context,
  };
};

export const clearExceptionContext = (keys?: Array<keyof ExceptionContext>) => {
  if (!keys) {
    currentContext = {};
    return;
  }

  keys.forEach((key) => {
    delete currentContext[key];
  });
};

export const setCurrentScreen = (screenName: string) => {
  setExceptionContext({ screenName });
};

export const logException = async (
  payload: ExceptionPayload,
): Promise<boolean> => {
  if (!currentConfig?.enabled) {
    return false;
  }

  const preparedPayload = currentConfig.beforeSend
    ? await currentConfig.beforeSend(payload)
    : payload;

  if (!preparedPayload) {
    return false;
  }

  try {
    const response = await fetch(
      getIngestUrl(currentConfig.url, currentConfig.projectKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...currentConfig.headers,
          "Api-Key": currentConfig.apiKey,
        },
        body: JSON.stringify(preparedPayload),
        keepalive: true,
      },
    );

    return response.ok;
  } catch (error) {
    currentConfig.onError?.(error, preparedPayload);
    return false;
  }
};

export const captureException = async (
  error: unknown,
  extraData?: ExtraData,
) => {
  const normalizedError =
    error instanceof Error ? error : new Error(String(error));

  return logException(
    buildExceptionPayload({
      source: "manual",
      title: normalizedError.name || "Manual Exception",
      message: normalizedError.message || "No message provided",
      stackTrace: normalizedError.stack ?? "",
      extraData,
    }),
  );
};

const getRejectionMessage = (reason: unknown) => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;

  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
};

const installGlobalHandlers = () => {
  if (!isBrowser()) return undefined;

  const errorHandler = (event: ErrorEvent | Event) => {
    if (event instanceof ErrorEvent) {
      logException(
        buildExceptionPayload({
          source: "window.onerror",
          title: event.error?.name || "JavaScript Error",
          message: event.message || "No message provided",
          stackTrace:
            event.error?.stack ||
            `${event.filename || "unknown"}:${event.lineno || 0}:${event.colno || 0}`,
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        }),
      );
      return;
    }

    if (!currentConfig?.captureResourceErrors) {
      return;
    }

    const target = event.target as HTMLElement | undefined;
    const resourceUrl =
      target && "src" in target
        ? String((target as HTMLImageElement | HTMLScriptElement).src)
        : target && "href" in target
          ? String((target as HTMLLinkElement).href)
          : undefined;

    logException(
      buildExceptionPayload({
        source: "resource",
        title: "Resource Load Error",
        message: resourceUrl || "A browser resource failed to load",
        stackTrace: "",
        metadata: {
          tagName: target?.tagName,
          resourceUrl,
        },
      }),
    );
  };

  const rejectionHandler = (event: PromiseRejectionEvent) => {
    if (!currentConfig?.captureUnhandledRejections) {
      return;
    }

    const reason = event.reason;
    const error = reason instanceof Error ? reason : undefined;

    logException(
      buildExceptionPayload({
        source: "window.unhandledrejection",
        title: error?.name || "Unhandled Promise Rejection",
        message: error?.message || getRejectionMessage(reason),
        stackTrace: error?.stack || "No stack trace available",
        metadata: {
          reason: error ? undefined : reason,
        },
      }),
    );
  };

  window.addEventListener("error", errorHandler, true);
  window.addEventListener("unhandledrejection", rejectionHandler);

  return () => {
    window.removeEventListener("error", errorHandler, true);
    window.removeEventListener("unhandledrejection", rejectionHandler);
  };
};

export const setupExceptionTracking = (
  options: SetupExceptionTrackingOptions,
): CleanupExceptionTracking => {
  assertRequiredConfig(options);

  cleanupHandlers?.();

  const enabled =
    options.enabled ?? (options.allowedInDevMode ? true : !isDevMode());

  currentConfig = {
    enabled,
    installGlobalHandlers: true,
    captureUnhandledRejections: true,
    captureResourceErrors: false,
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

export class ExceptionBoundary extends React.Component<
  ExceptionBoundaryProps,
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logException(
      buildExceptionPayload({
        source: "react",
        title: error.name || "React Component Error",
        message: error.message || "No message provided",
        stackTrace: error.stack ?? errorInfo.componentStack ?? "",
        metadata: {
          componentStack: errorInfo.componentStack,
        },
        extraData: this.props.extraData,
      }),
    );

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
