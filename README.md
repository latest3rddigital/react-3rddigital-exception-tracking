# react-3rddigital-exception-tracking

Exception tracking SDK for React web projects. It captures browser JavaScript errors, unhandled promise rejections, React render errors, and manually reported exceptions, then posts them to the 3rdDigital exception ingestion API.

## Install

```sh
npm install react-3rddigital-exception-tracking
```

## Setup

Call `setupExceptionTracking` once, before rendering your React app.

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  ExceptionBoundary,
  setupExceptionTracking,
} from 'react-3rddigital-exception-tracking';
import App from './App';

setupExceptionTracking({
  url: 'https://dev.3rddigital.com/appupdate-api/api',
  apiKey: process.env.REACT_APP_EXCEPTION_API_KEY ?? '',
  projectKey: process.env.REACT_APP_EXCEPTION_PROJECT_KEY ?? '',
  appVersion: process.env.REACT_APP_VERSION,
  allowedInDevMode: false,
  extraData: {
    environment: process.env.NODE_ENV,
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ExceptionBoundary fallback={null}>
    <App />
  </ExceptionBoundary>
);
```

The SDK posts to:

```txt
{url}/exceptions/ingest/{projectKey}
```

If `url` already includes `/exceptions/ingest/{projectKey}`, that exact endpoint is used.

## Manual Capture

```ts
import { captureException } from 'react-3rddigital-exception-tracking';

try {
  await doSomething();
} catch (error) {
  captureException(error, { feature: 'task-upload' });
}
```

## Context

Attach data that should be included with future exception reports.

```ts
import {
  clearExceptionContext,
  setCurrentScreen,
  setExceptionContext,
} from 'react-3rddigital-exception-tracking';

setCurrentScreen('/projects');
setExceptionContext({ userId: '123', role: 'admin' });
clearExceptionContext(['role']);
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `url` | Yes | Base API URL or full ingest URL. |
| `apiKey` | Yes | Sent as the `Api-Key` header. |
| `projectKey` | Yes | Project identifier used in the ingest URL and payload. |
| `headers` | No | Extra request headers. |
| `appVersion` | No | Version included in every payload. Defaults to `1.0.0`. |
| `extraData` | No | Static custom context merged into every payload. |
| `allowedInDevMode` | No | Enables reporting in `NODE_ENV=development`. Defaults to `false`. |
| `installGlobalHandlers` | No | Captures `window.error` and promise rejections. Defaults to `true`. |
| `captureUnhandledRejections` | No | Captures unhandled promise rejections. Defaults to `true`. |
| `captureResourceErrors` | No | Captures failed script/image/link loads. Defaults to `false`. |
| `beforeSend` | No | Mutate or drop payloads before upload. Return `null` to skip. |
| `onError` | No | Called when the SDK fails to upload an exception. |

## Payload

Each payload includes:

- Error title, message, stack trace, source, timestamp, project key, and app version.
- Browser, OS, device, screen, network, URL, pathname, and referrer details.
- Static `extraData`, current context, per-call `extraData`, and metadata.

## Cleanup

`setupExceptionTracking` returns a cleanup function for tests or micro-frontends.

```ts
const cleanup = setupExceptionTracking(options);
cleanup();
```
