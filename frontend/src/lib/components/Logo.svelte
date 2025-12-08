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

<svg
  class="{sizes[size]} text-grove-600 {className}"
  viewBox="0 0 100 100"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Shield shape representing security -->
  <path
    d="M50 8 L85 25 L85 50 C85 70 70 85 50 92 C30 85 15 70 15 50 L15 25 Z"
    stroke="currentColor"
    stroke-width="3"
    fill="none"
    opacity="0.2"
  />
  <!-- Inner shield -->
  <path
    d="M50 20 L75 32 L75 50 C75 65 63 77 50 82 C37 77 25 65 25 50 L25 32 Z"
    fill="currentColor"
    fill-opacity="0.15"
  />
  <!-- Checkmark representing verified auth -->
  <path
    d="M38 52 L47 61 L62 42"
    stroke="currentColor"
    stroke-width="5"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
  <!-- Key hole accent -->
  <circle cx="50" cy="68" r="4" fill="currentColor" opacity="0.5" />
</svg>
