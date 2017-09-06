This is the cloud function that powers the core of building, minifying and gzipping of packages in bundlephobia.
This is built using [serverless](https://serverless.com). 
Make sure you have serverless installed on your machine using

```bash
    npm i -g serverless
```

**Note: The latest node version supported by AWS Lambda is only v6.10.0, and hence very limited ES6 must be used.**

## Commands
To start an offline server, use
```bash
    yarn run start
```

To deploy,
```bash
    sls deploy
```

To see production server logs - 

```bash
    yarn run show-logs
```
