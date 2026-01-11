<script lang="ts">
  interface Props {
    status: string;
  }

  let { status }: Props = $props();

  const statusConfig: Record<string, { label: string; class: string }> = {
    investigating: { label: '🔍 Investigating', class: 'badge-warning' },
    identified: { label: '✓ Identified', class: 'badge-info' },
    monitoring: { label: '👁 Monitoring', class: 'badge-info' },
    resolved: { label: '✓ Resolved', class: 'badge-success' },
    operational: { label: '✓ Operational', class: 'badge-success' },
    degraded: { label: '⚠ Degraded', class: 'badge-warning' },
    partial_outage: { label: '⚠ Partial Outage', class: 'badge-warning' },
    major_outage: { label: '✗ Major Outage', class: 'badge-error' },
    maintenance: { label: '🔧 Maintenance', class: 'badge-info' },
  };

  const config = $derived(statusConfig[status as keyof typeof statusConfig] || { label: status, class: 'badge-secondary' });
</script>

<span class="badge {config.class}">
  {config.label}
</span>
