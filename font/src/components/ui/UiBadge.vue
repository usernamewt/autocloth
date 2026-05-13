<template>
  <span
    class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
    :class="badgeClass"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline'

const props = withDefaults(defineProps<{ variant?: Variant }>(), {
  variant: 'default',
})

const badgeClass = computed(() => {
  if (props.variant === 'secondary') return 'bg-secondary text-secondary-foreground'
  if (props.variant === 'destructive') return 'bg-destructive text-destructive-foreground border-transparent'
  if (props.variant === 'outline') return 'text-foreground'
  return 'bg-primary text-primary-foreground border-transparent'
})
</script>
