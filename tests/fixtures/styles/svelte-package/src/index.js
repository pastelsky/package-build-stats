import App from './App.svelte'

export default App
export const createApp = (target) => {
  return new App({ target })
}
