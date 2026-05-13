<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogTrigger as-child>
      <slot />
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <AlertDialogContent class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <AlertDialogTitle class="text-lg font-semibold">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-sm text-muted-foreground">{{ description }}</AlertDialogDescription>
        <div class="mt-4 flex justify-end gap-2">
          <AlertDialogCancel class="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent transition-colors">
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            class="inline-flex h-9 items-center justify-center rounded-md bg-destructive text-destructive-foreground px-4 text-sm font-medium hover:bg-destructive/90 transition-colors"
            @click="$emit('confirm')"
          >
            {{ confirmText }}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  AlertDialogRoot,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from 'radix-vue'

withDefaults(defineProps<{
  title?: string
  description?: string
  confirmText?: string
}>(), {
  title: '确认操作',
  description: '此操作不可撤销，确定要继续吗？',
  confirmText: '确认删除',
})

defineEmits<{ confirm: [] }>()

const open = ref(false)
</script>
