const getBuiltPackageStats = require('./getPackageStats')

exports.getPackageStats = function (event, context, callback) {
  const packageString = decodeURIComponent(event.queryStringParameters.p)

  getBuiltPackageStats(packageString)
    .then(result => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify(result)
      })
    })
    .catch(err => {
      callback(null, {
        statusCode: 500,
        body: JSON.stringify(err)
      })
      console.log(err)
    })
}
