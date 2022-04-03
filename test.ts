import {
  createPackage,
  generateContent,
} from '/Users/skanodia/dev/package-build-stats/unit-tests/create-package-fixture'

async function run() {
  let p = await createPackage('./packs', 'dummy-pack', { name: 'dummy-pack' })
  await p.addFile('index.js', generateContent(100), true)
  let d = await p.addDependency('dummy-dep-2')
}

run()
