This is the function that powers the core of building, minifying and gzipping of packages in bundlephobia.

## Commands
To start an local server that builds packages, run -

```bash
    yarn run start
```

The server runs at port `3000`.

### Making requests
To build a package and get it's stats, run a curl request like so - 

```bash
curl 'localhost:3000/size?p=<package-name>
```

eg.

```bash
curl 'localhost:3000/size?p=react`
```

## Contributing
Clone the repo, npm install, and run the server.
There isn't any autorestart or hot reloading as of now, so the server will need to be manually restarted on code changes. 
The file you're probably looking for is `getPackageStats.js`

