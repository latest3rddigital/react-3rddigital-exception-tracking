import React from "react";
export type ExtraData = Record<string, unknown>;
export type ExceptionContext = ExtraData & {
    screenName?: string;
    userId?: string | number;
};
export type ExceptionSource = "react" | "capacitor";
export type ExceptionDetailSource = "react" | "window.onerror" | "window.unhandledrejection" | "resource" | "manual";
export type ExceptionPayloadInput = {
    source?: ExceptionDetailSource;
    title: string;
    message: string;
    stackTrace?: string;
    exceptionData?: unknown;
    metadata?: ExtraData;
    extraData?: ExtraData;
    userInfo?: ExtraData;
};
export type ExceptionPayload = {
    source: ExceptionSource;
    title: string;
    message: string;
    stackTrace: string;
    stackSource: ExceptionDetailSource;
    platform: "web";
    timestamp: string;
    reportedAt: string;
    projectKey: string;
    environment?: string;
    appVersion: string;
    buildNumber?: string;
    deviceId: string;
    pageUrl?: string;
    url?: string;
    path?: string;
    pathname?: string;
    screenName?: string;
    userAgent?: string;
    exceptionData?: unknown;
    browserInfo: ExtraData;
    osInfo: ExtraData;
    deviceInfo: ExtraData;
    screenInfo: ExtraData;
    networkInfo: ExtraData;
    memoryInfo?: ExtraData;
    storageInfo?: ExtraData;
    batteryInfo?: ExtraData;
    userInfo: ExtraData;
    metadata: ExtraData;
    otherDetails: ExtraData;
    extraData: ExtraData;
};
export type SetupExceptionTrackingOptions = {
    url: string;
    apiKey: string;
    projectKey: string;
    headers?: Record<string, string>;
    extraData?: ExceptionContext;
    userInfo?: ExtraData;
    appVersion?: string;
    buildNumber?: string;
    environment?: "development" | "production" | string;
    enabled?: boolean;
    allowedInDevMode?: boolean;
    reactTrackingEnabled?: boolean;
    capacitorTrackingEnabled?: boolean;
    installGlobalHandlers?: boolean;
    captureUnhandledRejections?: boolean;
    captureResourceErrors?: boolean;
    enrichWithCapacitor?: boolean;
    source?: ExceptionSource | "auto";
    beforeSend?: (payload: ExceptionPayload) => ExceptionPayload | null | Promise<ExceptionPayload | null>;
    onError?: (error: unknown, payload?: ExceptionPayload) => void;
};
export type CleanupExceptionTracking = () => void;
export type ExceptionBoundaryProps = {
    children: React.ReactNode;
    fallback?: React.ReactNode | ((error: Error) => React.ReactNode);
    extraData?: ExtraData;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};
export declare const buildExceptionPayload: ({ source, title, message, stackTrace, exceptionData, metadata, extraData, userInfo, }: ExceptionPayloadInput) => ExceptionPayload;
export declare const setExceptionContext: (context: ExceptionContext) => void;
export declare const clearExceptionContext: (keys?: Array<keyof ExceptionContext>) => void;
export declare const setCurrentScreen: (screenName: string) => void;
export declare const logException: (payload: ExceptionPayload) => Promise<boolean>;
export declare const captureException: (error: unknown, extraData?: ExtraData) => Promise<boolean>;
export declare const setupExceptionTracking: (options: SetupExceptionTrackingOptions) => CleanupExceptionTracking;
export declare class ExceptionBoundary extends React.Component<ExceptionBoundaryProps, {
    error: Error | null;
}> {
    state: {
        error: null;
    };
    static getDerivedStateFromError(error: Error): {
        error: Error;
    };
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void;
    render(): React.ReactNode;
}
declare const _default: {
    setupExceptionTracking: (options: SetupExceptionTrackingOptions) => CleanupExceptionTracking;
    captureException: (error: unknown, extraData?: ExtraData) => Promise<boolean>;
    buildExceptionPayload: ({ source, title, message, stackTrace, exceptionData, metadata, extraData, userInfo, }: ExceptionPayloadInput) => ExceptionPayload;
    logException: (payload: ExceptionPayload) => Promise<boolean>;
    setExceptionContext: (context: ExceptionContext) => void;
    clearExceptionContext: (keys?: Array<keyof ExceptionContext>) => void;
    setCurrentScreen: (screenName: string) => void;
    ExceptionBoundary: typeof ExceptionBoundary;
};
export default _default;
//# sourceMappingURL=index.d.ts.map