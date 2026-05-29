# react-3rddigital-exception-tracking

Exception tracking SDK for React web projects. It captures browser JavaScript errors, unhandled promise rejections, React render errors, and manually reported exceptions, then posts them to the 3rdDigital exception ingestion API.

## Install

```sh
npm install react-3rddigital-exception-tracking
```

## Setup

Call `setupExceptionTracking` once, before rendering your React app.

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import {
  ExceptionBoundary,
  setupExceptionTracking,
} from "react-3rddigital-exception-tracking";
import App from "./App";

setupExceptionTracking({
  url: process.env.REACT_APP_BASE_URL,
  apiKey: process.env.REACT_APP_EXCEPTION_API_KEY ?? "",
  projectKey: process.env.REACT_APP_EXCEPTION_PROJECT_KEY ?? "",
  appVersion: process.env.REACT_APP_VERSION,
  buildNumber: process.env.REACT_APP_BUILD_NUMBER,
  allowedInDevMode: false,
  source: "auto",
  userInfo: {
    id: currentUser?.id,
    email: currentUser?.email,
  },
  extraData: {
    environment: process.env.NODE_ENV,
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ExceptionBoundary fallback={null}>
    <App />
  </ExceptionBoundary>,
);
```

The SDK posts to:

```txt
{url}/exceptions/ingest/{projectKey}
```

If `url` already includes `/exceptions/ingest/{projectKey}`, that exact endpoint is used.

## Backend Keys

The backend uses a few top-level fields for grouping, filtering, and counting. This package sends those fields directly:

- `source` is `react` for normal browser React apps and `capacitor` when running on a native Capacitor platform.
- `deviceId` is a stable browser install id stored in `localStorage`; Capacitor apps use the native device id when available.
- `pageUrl`, `screenName`, `appVersion`, `buildNumber`, `userInfo`, `deviceInfo`, `browserInfo`, `osInfo`, and `metadata` are sent as first-class payload fields.
- Dashboard display keys are populated directly: `deviceInfo.model` for Device and `osInfo.name` for OS.
- The detailed error origin, such as `window.onerror`, `window.unhandledrejection`, `resource`, or `manual`, is sent as `metadata.errorSource` and `stackSource`.

## Capacitor Details

The package works in normal React projects without Capacitor. For Capacitor apps, install these optional peer dependencies to enrich payloads with native app, OS, battery, language, and device details:

```sh
npm install @capacitor/app @capacitor/device
```

Capacitor enrichment is enabled by default when the app is running on a native Capacitor platform. Disable it with:

For native Capacitor reports, `browserInfo` is intentionally sent as an empty object. Device, OS, battery, memory, storage, WebView version, app version, and build details are sent through `deviceInfo`, `osInfo`, `batteryInfo`, `memoryInfo`, `storageInfo`, `metadata`, and `otherDetails`.

```ts
setupExceptionTracking({
  // ...
  enrichWithCapacitor: false,
});
```

If your app runtime cannot expose Capacitor detection early enough, force the backend source:

```ts
setupExceptionTracking({
  // ...
  source: "capacitor",
});
```

## Manual Capture

```ts
import { captureException } from "react-3rddigital-exception-tracking";

try {
  await doSomething();
} catch (error) {
  captureException(error, { feature: "task-upload" });
}
```

## Context

Attach data that should be included with future exception reports.

```ts
import {
  clearExceptionContext,
  setCurrentScreen,
  setExceptionContext,
} from "react-3rddigital-exception-tracking";

setCurrentScreen("/projects");
setExceptionContext({ userId: "123", role: "admin" });
clearExceptionContext(["role"]);
```

## Options

| Option                       | Required | Description                                                         |
| ---------------------------- | -------- | ------------------------------------------------------------------- |
| `url`                        | Yes      | Base API URL or full ingest URL.                                    |
| `apiKey`                     | Yes      | Sent as the `Api-Key` header.                                       |
| `projectKey`                 | Yes      | Project identifier used in the ingest URL and payload.              |
| `headers`                    | No       | Extra request headers.                                              |
| `appVersion`                 | No       | Version included in every payload. Defaults to `1.0.0`.             |
| `buildNumber`                | No       | Build number included in every payload.                             |
| `userInfo`                   | No       | User data stored in the backend `userInfo` field.                   |
| `extraData`                  | No       | Static custom context merged into every payload.                    |
| `allowedInDevMode`           | No       | Enables reporting in `NODE_ENV=development`. Defaults to `false`.   |
| `installGlobalHandlers`      | No       | Captures `window.error` and promise rejections. Defaults to `true`. |
| `captureUnhandledRejections` | No       | Captures unhandled promise rejections. Defaults to `true`.          |
| `captureResourceErrors`      | No       | Captures failed script/image/link loads. Defaults to `false`.       |
| `enrichWithCapacitor`        | No       | Loads optional Capacitor details in native builds. Defaults to `true`. |
| `source`                     | No       | `auto`, `react`, or `capacitor`. Defaults to `auto`.                |
| `beforeSend`                 | No       | Mutate or drop payloads before upload. Return `null` to skip.       |
| `onError`                    | No       | Called when the SDK fails to upload an exception.                   |

## Payload

Each payload includes:

- Error title, message, stack trace, backend source, detailed error source, timestamp, project key, app version, and build number.
- Stable device id, friendly device model, page URL, screen name, browser, OS, device, screen, network, memory, storage, document, history, performance, and referrer details.
- Static `userInfo`, static `extraData`, current context, per-call `extraData`, and metadata.

## Cleanup

`setupExceptionTracking` returns a cleanup function for tests or micro-frontends.

```ts
const cleanup = setupExceptionTracking(options);
cleanup();
```
