<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="open = false"
      >
        <img
          :src="src"
          class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          :alt="alt"
        />
        <DialogClose
          class="absolute top-4 right-4 rounded-full bg-black/60 text-white w-10 h-10 flex items-center justify-center text-xl hover:bg-black/80 transition-colors"
        >
          ✕
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
} from 'radix-vue'

defineProps<{
  src: string
  alt?: string
}>()

const open = ref(false)
</script>
