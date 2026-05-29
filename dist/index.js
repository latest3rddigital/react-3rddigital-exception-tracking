import React from 'react';

let currentConfig;
let currentContext = {};
let cleanupHandlers;

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const getIngestUrl = (url, projectKey) => {
  const baseUrl = url.replace(/\/+$/, '');
  const encodedProjectKey = encodeURIComponent(projectKey);

  if (baseUrl.endsWith(`/exceptions/ingest/${encodedProjectKey}`)) {
    return baseUrl;
  }

  return `${baseUrl}/exceptions/ingest/${encodedProjectKey}`;
};

const isDevMode = () => {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === 'development';
  }

  return false;
};

const assertRequiredConfig = (options) => {
  const missingFields = ['url', 'apiKey', 'projectKey'].filter((field) => !options[field]?.trim());

  if (missingFields.length > 0) {
    throw new Error(
      `Exception tracking setup is missing required field(s): ${missingFields.join(', ')}`
    );
  }
};

const getBrowserAndOs = (userAgent = '') => {
  let browserName = 'Unknown Browser';
  let osName = 'Unknown OS';

  if (userAgent.includes('Firefox')) browserName = 'Firefox';
  else if (userAgent.includes('SamsungBrowser')) browserName = 'Samsung Browser';
  else if (userAgent.includes('Opera') || userAgent.includes('OPR')) browserName = 'Opera';
  else if (userAgent.includes('Trident')) browserName = 'Internet Explorer';
  else if (userAgent.includes('Edge') || userAgent.includes('Edg')) browserName = 'Edge';
  else if (userAgent.includes('Chrome')) browserName = 'Chrome';
  else if (userAgent.includes('Safari')) browserName = 'Safari';

  if (userAgent.includes('Win')) osName = 'Windows';
  else if (userAgent.includes('Mac')) osName = 'macOS';
  else if (userAgent.includes('X11') || userAgent.includes('Linux')) osName = 'Linux';
  else if (userAgent.includes('Android')) osName = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) osName = 'iOS';

  return { browserName, osName };
};

const getBrowserVersion = (userAgent, browserName) => {
  const versionMatchers = {
    Chrome: /Chrome\/([\d.]+)/,
    Firefox: /Firefox\/([\d.]+)/,
    'Samsung Browser': /SamsungBrowser\/([\d.]+)/,
    Opera: /(?:Opera|OPR)\/([\d.]+)/,
    'Internet Explorer': /(?:MSIE |rv:)([\d.]+)/,
    Edge: /Edg(?:e)?\/([\d.]+)/,
    Safari: /Version\/([\d.]+).*Safari/,
  };

  return userAgent.match(versionMatchers[browserName])?.[1] || 'Unknown';
};

const getScreenInfo = () => {
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
      (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'),
  };
};

const getNetworkInfo = () => {
  if (!isBrowser()) return {};

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  return {
    onlineStatus: navigator.onLine,
    effectiveType: connection?.effectiveType || 'Unknown',
    downlink: connection?.downlink || 'Unknown',
    rtt: connection?.rtt || 'Unknown',
    saveData: connection?.saveData || false,
  };
};

const getUserAgentData = () => {
  if (!isBrowser()) return null;
  return navigator.userAgentData || null;
};

export const buildExceptionPayload = ({
  source,
  title,
  message,
  stackTrace = '',
  metadata = {},
  extraData = {},
}) => {
  const url = isBrowser() ? window.location.href : undefined;
  const pathname = isBrowser() ? window.location.pathname : undefined;
  const userAgent = isBrowser() ? window.navigator.userAgent : '';
  const { browserName, osName } = getBrowserAndOs(userAgent);
  const configExtraData = currentConfig?.extraData ?? {};
  const screenName = currentContext.screenName || pathname || 'UnknownScreen';

  return {
    source,
    title,
    message,
    stackTrace,
    stackSource: source,
    platform: 'web',
    timestamp: new Date().toISOString(),
    projectKey: currentConfig?.projectKey ?? '',
    appVersion: currentConfig?.appVersion ?? '1.0.0',
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
      deviceId: 'browser',
      deviceType: /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)
        ? 'mobile-browser'
        : 'desktop-browser',
      touchPoints: isBrowser() ? window.navigator.maxTouchPoints || 0 : undefined,
      hardwareConcurrency: isBrowser() ? window.navigator.hardwareConcurrency || 'Unknown' : undefined,
      deviceMemory: isBrowser() ? window.navigator.deviceMemory || 'Unknown' : undefined,
    },
    screenInfo: getScreenInfo(),
    networkInfo: getNetworkInfo(),
    metadata: {
      ...metadata,
      framework: 'react',
      referrer: isBrowser() ? document.referrer || 'Direct' : undefined,
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

  const preparedPayload = currentConfig.beforeSend
    ? await currentConfig.beforeSend(payload)
    : payload;

  if (!preparedPayload) {
    return false;
  }

  try {
    const response = await fetch(getIngestUrl(currentConfig.url, currentConfig.projectKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...currentConfig.headers,
        'Api-Key': currentConfig.apiKey,
      },
      body: JSON.stringify(preparedPayload),
      keepalive: true,
    });

    return response.ok;
  } catch (error) {
    currentConfig.onError?.(error, preparedPayload);
    return false;
  }
};

export const captureException = async (error, extraData) => {
  const normalizedError = error instanceof Error ? error : new Error(String(error));

  return logException(
    buildExceptionPayload({
      source: 'manual',
      title: normalizedError.name || 'Manual Exception',
      message: normalizedError.message || 'No message provided',
      stackTrace: normalizedError.stack ?? '',
      extraData,
    })
  );
};

const getRejectionMessage = (reason) => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;

  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
};

const installGlobalHandlers = () => {
  if (!isBrowser()) return undefined;

  const errorHandler = (event) => {
    if (event instanceof ErrorEvent) {
      logException(
        buildExceptionPayload({
          source: 'window.onerror',
          title: event.error?.name || 'JavaScript Error',
          message: event.message || 'No message provided',
          stackTrace:
            event.error?.stack ||
            `${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`,
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        })
      );
      return;
    }

    if (!currentConfig?.captureResourceErrors) {
      return;
    }

    const target = event.target;
    const resourceUrl =
      target && 'src' in target
        ? String(target.src)
        : target && 'href' in target
          ? String(target.href)
          : undefined;

    logException(
      buildExceptionPayload({
        source: 'resource',
        title: 'Resource Load Error',
        message: resourceUrl || 'A browser resource failed to load',
        stackTrace: '',
        metadata: {
          tagName: target?.tagName,
          resourceUrl,
        },
      })
    );
  };

  const rejectionHandler = (event) => {
    if (!currentConfig?.captureUnhandledRejections) {
      return;
    }

    const reason = event.reason;
    const error = reason instanceof Error ? reason : undefined;

    logException(
      buildExceptionPayload({
        source: 'window.unhandledrejection',
        title: error?.name || 'Unhandled Promise Rejection',
        message: error?.message || getRejectionMessage(reason),
        stackTrace: error?.stack || 'No stack trace available',
        metadata: {
          reason: error ? undefined : reason,
        },
      })
    );
  };

  window.addEventListener('error', errorHandler, true);
  window.addEventListener('unhandledrejection', rejectionHandler);

  return () => {
    window.removeEventListener('error', errorHandler, true);
    window.removeEventListener('unhandledrejection', rejectionHandler);
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
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    logException(
      buildExceptionPayload({
        source: 'react',
        title: error.name || 'React Component Error',
        message: error.message || 'No message provided',
        stackTrace: error.stack ?? errorInfo.componentStack ?? '',
        metadata: {
          componentStack: errorInfo.componentStack,
        },
        extraData: this.props.extraData,
      })
    );

    this.props.onError?.(error, errorInfo);
  }

  render() {
    const { error } = this.state;

    if (error) {
      if (typeof this.props.fallback === 'function') {
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
