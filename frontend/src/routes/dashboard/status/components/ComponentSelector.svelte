<script lang="ts">
  interface Component {
    id: string;
    name: string;
    description?: string;
  }

  interface Props {
    components: Component[];
    selected: string[];
  }

  let { components, selected = $bindable([]) }: Props = $props();

  function toggleComponent(id: string) {
    if (selected.includes(id)) {
      selected = selected.filter(s => s !== id);
    } else {
      selected = [...selected, id];
    }
  }
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  {#each components as component}
    <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <input
        type="checkbox"
        checked={selected.includes(component.id)}
        onchange={() => toggleComponent(component.id)}
        class="mt-1"
      />
      <div class="flex-1">
        <div class="font-medium text-bark dark:text-gray-100">{component.name}</div>
        {#if component.description}
          <div class="text-sm text-bark/60 dark:text-gray-400">
            {component.description}
          </div>
        {/if}
      </div>
    </label>
  {/each}
</div>
