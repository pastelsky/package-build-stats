import path from 'node:path'

export default {
  tmp: path.resolve(process.env.BUILD_TMP_DIR || '/tmp/tmp-build'),
}
