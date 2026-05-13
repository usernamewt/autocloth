<template>
  <label class="inline-flex items-center gap-2 cursor-pointer select-none">
    <span class="relative inline-flex items-center justify-center">
      <input
        type="checkbox"
        class="peer sr-only"
        :checked="modelValue"
        :disabled="disabled"
        @change="onChange"
      />
      <span
        class="h-4 w-4 rounded border border-input bg-background peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ring-offset-background peer-disabled:opacity-50"
      />
      <svg
        class="absolute h-3 w-3 text-primary peer-checked:opacity-100 opacity-0"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 6L9 17l-5-5"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>

    <span class="text-sm text-foreground"><slot /></span>
  </label>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

function onChange(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  emit('update:modelValue', checked)
}
</script>
