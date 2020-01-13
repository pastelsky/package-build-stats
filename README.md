  <img src="https://img.shields.io/npm/v/package-build-stats.svg" /> 
  <img src="https://img.shields.io/npm/l/package-build-stats.svg" 
  
  This is the function that powers the core of building, minifying and gzipping of packages in bundlephobia.

## Usage
```js
const getBuiltPackageStats = require('package-build-stats');

getBuiltPackageStats('packageName', { options })
    .then((result) => console.log(result))
```

## Options

| Option  | Values | Description |
|---|---|---|
|  client | `'npm' or 'yarn'` | Which client to use to install package for building |
| limitConcurrency  | `true` or `false`  |  When using `yarn` as the client, use the network mutex to limit concurrency |
|  networkConcurrency |  `number` |  When using `yarn` as client, limit simultaneous installs to this number. |
| customImports | `Array<string>` | By default, the default export is used for calculating sizes. Setting this option allows calculation of package stats based on more granular top-level exports.

## Testing results using in-built server in development
### Commands
To start an local server that builds packages, run -

```bash
yarn run start
```

The server runs at port `3000`.

### Making requests
To build a package and get it's stats, run a curl request like so - 

```bash
curl 'localhost:3000/size?p=<package-name>'
```

eg.

```bash
curl 'localhost:3000/size?p=react'
```

## Contributing
Clone the repo, npm install, and run the server.
The file you're probably looking for is `getPackageStats.js`

