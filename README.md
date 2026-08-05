<img src="https://img.shields.io/npm/v/package-build-stats.svg" /> <img src="https://img.shields.io/npm/l/package-build-stats.svg" /> <img src="https://img.shields.io/github/workflow/status/pastelsky/package-build-stats/CI/master"/>

This is the function that powers the core of building, minifying and gzipping of packages in bundlephobia.

## Requirements

`package-build-stats` supports maintained Node.js LTS releases: Node.js 22 or newer is required, and Node.js 24 is the recommended runtime.

## Usage

```js
import { getPackageStats } from 'package-build-stats'
```

#### Building packages from npm

##### Building the latest stable version

```js
const results = await getPackageStats('moment')
```

##### Building a specific version / tag

```js
const results = await getPackageStats('moment@2.24.0')
```

##### Building local packages (beta)

```js
const results = await getPackageStats('~/dev/my-npm-package') // must have a package.json
```

##### Using different package managers

```js
// Use Bun for 13x faster installs!
const results = await getPackageStats('lodash', { client: 'bun' })

// Or use pnpm
const results = await getPackageStats('lodash', { client: 'pnpm' })

// Or use yarn
const results = await getPackageStats('lodash', { client: 'yarn' })
```

Analysis functions install packages locally by default. A service can instead
provide a reusable installation without changing those APIs:

```js
await getPackageStats('lodash', {
  installationService: { url: 'http://127.0.0.1:7003' },
})
```

The service implements `POST /installations` to return
`{ packageString, packageName, installPath, packagePath }`. Generated entries
and bundles are written to a separate per-analysis directory, so the returned
installation can be safely reused. Transport failures fall back to a local
install unless `fallbackToLocal` is `false`.

The `package-build-stats/installation` subpath exports `installPackage` and
`disposePackage` for implementing that service. Standalone callers do not need
an installation service.

#### Passing options to the build

```js
const results = await getBuiltPackageStats('moment', options)
```

##### Options

| Option             | Values                          | Default  | Description                                                                                                                                                     |
| ------------------ | ------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| client             | `npm`, `yarn`, `pnpm`, or `bun` | `npm`    | Which client to use to install package for building. **Bun is 13x faster!**                                                                                     |
| limitConcurrency   | `true` or `false`               | `false`  | When using `yarn` as the client, use the network mutex to limit concurrency                                                                                     |
| networkConcurrency | `number`                        | `false`  | When using `yarn` or `bun` as client, limit simultaneous installs to this number.                                                                               |
| customImports      | `Array<string>`                 | `null`   | By default, the default export is used for calculating sizes. Setting this option allows calculation of package stats based on more granular top-level exports. |
| minifier           | `terser` or `esbuild`           | `terser` | ESbuild is faster, albeit with marginally larger file sizes                                                                                                     |
| installTimeout     | number (ms)                     | 30000    | Timeout for package install                                                                                                                                     |

## Listening to events

`package-build-stats` emits various lifecycle events when building a package.
You can listen to these events by subscribing to the event emitter (based on [mitt](https://github.com/developit/mitt)).

```js
import { eventQueue } from 'package-build-stats'

// Listen to all events
eventQueue.on('*', callback)

// Listen to specific events
eventQueue.on('TASK_PACKAGE_BUILD', callback)
```

For a list of all events, see [this](src/utils/telemetry.utils.ts).

## Contributing

See [contributing guide.](CONTRIBUTING.md)
