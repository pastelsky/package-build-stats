import test from 'ava';
import fetch from 'node-fetch'
import pSeries from 'p-series'

require('dotenv').config()

const MAX_SIZE_DELTA = 7 * 1024 // in bytes
const MIN_SIZE_DELTA = 3 * 1024 // in bytes

const isDeltaOk = (originalSize, builtSize) => {
  const diff = Math.abs(originalSize - builtSize)

  if (diff > MAX_SIZE_DELTA) {
    return false
  }

  if (diff < MIN_SIZE_DELTA) {
    return true
  }

  return (diff / originalSize) < 0.05
}

const UIPackages = [{
  name: 'react@15.6.1',
  size: 22.18 * 1024
}, {
  name: 'react@16.0.0-beta.5',
  size: 6.73 * 1024
}, {
  name: 'preact@8.2.5',
  size: 8.28 * 1024
}, {
  name: 'vue@2.4.2',
  size: 58.4 * 1024
}
//  {
//  name: '@cycle/dom@18.3.0',
//  size: 56.33 * 1024
//}
]

const popularPackages = [
  {
    name: 'lodash@4.17.4',
    size: 72.77 * 1024
  },
  {
    name: 'async@2.5.0',
    size: 23.74 * 1024
  },
  {
    name: 'bluebird@3.5.0',
    size: 79.55 * 1024
  },
  {
    name: 'jquery@3.2.1',
    size: 86.66 * 1024
  },
  //{
  //  name: 'rxjs@5.4.3',
  //  size: 141.32 * 1024
  //},
  {
    name: 'moment@2.18.1',
    size: 213.54 * 1024
  }
  ,
  {
    name: 'redux@3.7.2',
    size: 5.76 * 1024
  },
  {
    name: 'axios@0.16.2',
    size: 12.67 * 1024
  }
]

const UILibraries = [{
  name: 'bootstrap@3.3.7',
  size: 37.05 * 1024
},
  {
    name: 'animate.css@3.5.2',
    size: 52.79 * 1024
  },
  {
    name: 'bulma@0.5.1',
    size: 146 * 1024
  },
  {
    name: 'tachyons@4.8.1',
    size: 80.69 * 1024
  }
]


test.skip('Sizes of popular UI Frameworks', async t => {
  const promises = UIPackages.map(pack => async () => {
    const res = await fetch(`${process.env.AWS_LAMBDA_ENDPOINT}/size?p=${encodeURIComponent(pack.name)}`)
    const json = await res.json()
    console.log(json, pack)
    t.truthy(isDeltaOk(json.size, pack.size), `Size delta too large, ${json.size - pack.size}`)
  })

  await pSeries(promises)
    .catch(r => console.log(r))
})


test.skip('Sizes of popular JS Frameworks', async t => {
  const promises = popularPackages.map(pack => async () => {
    const res = await fetch(`${process.env.AWS_LAMBDA_ENDPOINT}/size?p=${encodeURIComponent(pack.name)}`)
    const json = await res.json()
    console.log(json, pack)
    t.truthy(isDeltaOk(json.size, pack.size), `Size delta too large, ${json.size - pack.size}`)
  })

  await pSeries(promises)
    .catch(r => console.log(r))
})

test('Sizes of popular UI Libraries', async t => {
  const promises = UILibraries.map(pack => async () => {
    const res = await fetch(`${process.env.AWS_LAMBDA_ENDPOINT}/size?p=${encodeURIComponent(pack.name)}`)
    const json = await res.json()
    console.log(json, pack)
    t.truthy(isDeltaOk(json.size, pack.size), `Size delta too large, ${json.size - pack.size}`)
  })

  await pSeries(promises)
    .catch(r => console.log(r))
})