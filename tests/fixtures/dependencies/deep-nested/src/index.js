import axios from 'axios'

// axios has multiple nested dependencies:
// axios -> follow-redirects, form-data, proxy-from-env
// form-data -> asynckit, combined-stream, mime-types
// mime-types -> mime-db
// This creates a deep dependency tree

export async function fetchData(url) {
  try {
    const response = await axios.get(url)
    return response.data
  } catch (error) {
    return { error: error.message }
  }
}

export function createClient(baseURL) {
  return axios.create({ baseURL })
}
