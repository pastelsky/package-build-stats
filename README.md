<img src="https://img.shields.io/npm/v/package-build-stats.svg" /> <img src="https://img.shields.io/npm/l/package-build-stats.svg" /> <img src="https://img.shields.io/github/workflow/status/pastelsky/package-build-stats/CI/master"/>

This is the function that powers the core of building, minifying and gzipping of packages in bundlephobia.

## Usage

```js
const { getBuiltPackageStats } = require('package-build-stats')
```

#### Building packages from npm

##### Building the latest stable version

```js
const results = await getBuiltPackageStats('moment')
```

##### Building a specific version / tag

```js
const results = await getBuiltPackageStats('moment@2.24.0')
```

##### Building local packages (beta)

```js
const results = await getBuiltPackageStats('~/dev/my-npm-package') // must have a package.json
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

## Contributing

1. Clone this repo, run yarn install
2. To make it easier to test changes when develop, you can start an HTTP server
   that uses REST APIs to report size of packages.

To start the server, run –

```bash
yarn run start
```

The server runs at port `3000`.

To build a package and get its build stats, run a curl request like so -

```bash
curl 'localhost:3000/size?p=<package-name>'
```

eg.

```bash
curl 'localhost:3000/size?p=react'
```

To build a package and get stats about exports that are exposed out of the package –

```bash
curl 'localhost:3000/exports?p=<package-name>'
```

To build a package and get stats about size of various exports that are exposed out of the package –

```bash
curl 'localhost:3000/export-sizes?p=<package-name>'
```
