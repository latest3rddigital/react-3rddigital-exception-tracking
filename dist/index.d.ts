import React from 'react';

export type ExtraData = Record<string, unknown>;

export type ExceptionContext = ExtraData & {
  screenName?: string;
  userId?: string | number;
};

export type ExceptionSource =
  | 'react'
  | 'window.onerror'
  | 'window.unhandledrejection'
  | 'resource'
  | 'manual';

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
  platform: 'web';
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
    payload: ExceptionPayload
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

export declare const buildExceptionPayload: (
  input: ExceptionPayloadInput
) => ExceptionPayload;

export declare const setExceptionContext: (context: ExceptionContext) => void;

export declare const clearExceptionContext: (
  keys?: Array<keyof ExceptionContext>
) => void;

export declare const setCurrentScreen: (screenName: string) => void;

export declare const logException: (
  payload: ExceptionPayload
) => Promise<boolean>;

export declare const captureException: (
  error: unknown,
  extraData?: ExtraData
) => Promise<boolean>;

export declare const setupExceptionTracking: (
  options: SetupExceptionTrackingOptions
) => CleanupExceptionTracking;

export declare class ExceptionBoundary extends React.Component<
  ExceptionBoundaryProps,
  { error: Error | null }
> {}

declare const _default: {
  setupExceptionTracking: typeof setupExceptionTracking;
  captureException: typeof captureException;
  buildExceptionPayload: typeof buildExceptionPayload;
  logException: typeof logException;
  setExceptionContext: typeof setExceptionContext;
  clearExceptionContext: typeof clearExceptionContext;
  setCurrentScreen: typeof setCurrentScreen;
  ExceptionBoundary: typeof ExceptionBoundary;
};

export default _default;
