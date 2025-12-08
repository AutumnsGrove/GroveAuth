<script>
  import '../app.css';

  let { children } = $props();
</script>

<div class="min-h-screen auth-gradient">
  {@render children()}
</div>
