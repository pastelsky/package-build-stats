## Contributing

1. Clone this repo, run yarn install
2. To make it easier to test changes when develop, you can start an HTTP server
   that uses REST APIs to report size of packages.

To start the server, run –

```bash
yarn dev
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
