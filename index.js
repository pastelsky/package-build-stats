const server = require('server');
const { get } = server.router;
const { json, status } = server.reply;

const getBuiltPackageStats = require('./src/getPackageStats')

server({ port: 3000 }, [
  get('/size', async ctx => {
    const packageString = decodeURIComponent(ctx.query.p)

    try {
      const result = await getBuiltPackageStats(packageString)
      return json(result)
    } catch (err) {
      console.log(err)
      return status(500).send({
        statusCode: 500,
        body: JSON.stringify(err)
      })
    }
  }),
  get('/import-size', async ctx => {
    const packageString = decodeURIComponent(ctx.query.p)
    const imports = decodeURIComponent(ctx.query.imports)

    try {
      const result = await getBuiltPackageStats(packageString, { customImports: imports.split(',') })
      return json(result)
    } catch (err) {
      console.log(err)
      return status(500).send({
        statusCode: 500,
        body: JSON.stringify(err)
      })
    }
  })
]);
