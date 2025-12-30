<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  }

  let { size = 'md', class: className = '' }: Props = $props();

  const sizes = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };
</script>

<!-- Grove Seed Icon - Summer Version -->
<svg class="{sizes[size]} {className} text-grove-600 dark:text-grove-400" viewBox="0 0 100 100" fill="none">
  <path
    d="M50 10C35 25 20 35 20 55C20 75 33 90 50 90C67 90 80 75 80 55C80 35 65 25 50 10Z"
    fill="currentColor"
    fill-opacity="0.3"
  />
  <path
    d="M50 32C44 40 38 46 38 55C38 64 43 70 50 70C57 70 62 64 62 55C62 46 56 40 50 32Z"
    fill="currentColor"
  />
  <path d="M50 70V85" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
</svg>
