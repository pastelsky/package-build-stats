import server from 'server'
const { get } = server.router
const { json, status } = server.reply

import {
  getPackageStats,
  getPackageExportSizes,
  getAllPackageExports,
} from './src/index.js'

const PORT = 3000
console.log(`Starting at port ${PORT}`)

server({ port: PORT }, [
  get('/size', async ctx => {
    const packageString = decodeURIComponent(ctx.query.p)

    try {
      const result = await getPackageStats(packageString, {
        ...ctx.query,
      })
      return json(result)
    } catch (err) {
      console.log(err)
      return status(500).send({
        statusCode: 500,
        body: JSON.stringify(err),
      })
    }
  }),
  get('/export-sizes', async ctx => {
    const packageString = decodeURIComponent(ctx.query.p)

    try {
      const result = await getPackageExportSizes(packageString, {
        debug: !!ctx.query.debug,
        minifier: ctx.query.minifier,
      })
      return json(result)
    } catch (err) {
      console.log(err)
      return status(500).send({
        statusCode: 500,
        body: JSON.stringify(err),
      })
    }
  }),
  get('/exports', async ctx => {
    const packageString = decodeURIComponent(ctx.query.p)

    try {
      const result = await getAllPackageExports(packageString, {
        debug: !!ctx.query.debug,
      })
      return json(result)
    } catch (err) {
      console.log(err)
      return status(500).send({
        statusCode: 500,
        body: JSON.stringify(err),
      })
    }
  }),
])
