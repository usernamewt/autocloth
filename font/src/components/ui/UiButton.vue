<template>
  <button
    class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50"
    :class="variantClass"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type Size = 'default' | 'sm' | 'lg'

const props = withDefaults(
  defineProps<{ variant?: Variant; size?: Size }>(),
  {
    variant: 'default',
    size: 'default',
  },
)

const variantClass = computed(() => {
  const size =
    props.size === 'sm'
      ? 'h-9 px-3'
      : props.size === 'lg'
        ? 'h-11 px-8'
        : 'h-10 px-4'

  const variant =
    props.variant === 'secondary'
      ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      : props.variant === 'outline'
        ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
        : props.variant === 'ghost'
          ? 'hover:bg-accent hover:text-accent-foreground'
          : props.variant === 'destructive'
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'

  return `${size} ${variant}`
})
</script>
