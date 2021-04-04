<img src="https://img.shields.io/npm/v/package-build-stats.svg" /> <img src="https://img.shields.io/npm/l/package-build-stats.svg" /> <img src="https://img.shields.io/github/workflow/status/pastelsky/package-build-stats/CI/master"/>

This is the function that powers the core of building, minifying and gzipping of packages in bundlephobia.

## Usage

```js
const { getPackageStats } = require('package-build-stats')
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

#### Passing options to the build

```js
const results = await getBuiltPackageStats('moment', options)
```

##### Options

| Option             | Values            | Default | Description                                                                                                                                                     |
| ------------------ | ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| client             | `npm` or `yarn`   | `npm`   | Which client to use to install package for building                                                                                                             |
| limitConcurrency   | `true` or `false` | `false` | When using `yarn` as the client, use the network mutex to limit concurrency                                                                                     |
| networkConcurrency | `number`          | `false` | When using `yarn` as client, limit simultaneous installs to this number.                                                                                        |
| customImports      | `Array<string>`   | `null`  | By default, the default export is used for calculating sizes. Setting this option allows calculation of package stats based on more granular top-level exports. |
| minifier           |  `terser` or `esbuild` | `terser` | ESbuild is faster, albeit with marginally larger file sizes

## Listening to events
`package-build-stats` emits various lifecycle events when building a package. 
You can listen to these events by subscribing to the event emitter (based on [mitt](https://github.com/developit/mitt)).

```js
import { eventQueue } from 'package-build-stats';

// Listen to all events
eventQueue.on('*', callback)

// Listen to specific events
eventQueue.on('TASK_PACKAGE_BUILD', callback)
```
For a list of all events, see [this](src/utils/telemetry.utils.ts).

## Contributing
See [contributing guide.](CONTRIBUTING.md)

