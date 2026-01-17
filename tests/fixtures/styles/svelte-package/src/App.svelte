<script>
  let count = 0

  function increment() {
    count += 1
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>

<style>
  button {
    background-color: #4CAF50;
    border: none;
    color: white;
    padding: 15px 32px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background-color: #45a049;
  }
</style>
