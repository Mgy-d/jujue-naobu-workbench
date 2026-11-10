<!--
  站内风格下拉选择器（案例管理用）。

  为什么不用原生 <select>：原生弹层是浏览器绘制的，暗色系统主题下会跟站点的
  浅色青绿风格完全脱节（用户 2026-10-22 报「弹出的选项 UI 太丑」）。
  这里用按钮 + 自绘面板，样式走站点 tokens（#12a594 / #cfe0df / #f1f8f7），
  面板 Teleport 到 body 并用 fixed 定位 —— 因为案例表单的滚动容器有 overflow，
  面板放在里面会被裁掉一半。

  交互：点击开合、点外部关闭、Esc 关闭、滚动/缩放时跟随触发器重新定位。
-->
<template>
  <div ref="root" class="site-select" :class="{ open, disabled }">
    <button
      type="button"
      class="ss-trigger"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown.esc.stop="close"
    >
      <span class="ss-value" :class="{ placeholder: !modelValue }">{{ display }}</span>
      <svg class="ss-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <Teleport to="body">
      <div v-if="open" ref="panel" class="ss-panel" :style="panelStyle" role="listbox">
        <button v-if="allowEmpty" type="button" class="ss-opt" :class="{ active: !modelValue }" @click="pick('')">
          <span>{{ emptyLabel }}</span>
          <svg v-if="!modelValue" class="ss-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        </button>
        <button
          v-for="opt in options"
          :key="opt"
          type="button"
          class="ss-opt"
          :class="{ active: opt === modelValue }"
          @click="pick(opt)"
        >
          <span>{{ opt }}</span>
          <svg v-if="opt === modelValue" class="ss-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        </button>
        <div v-if="!options.length && !allowEmpty" class="ss-empty">暂无可选项</div>
        <div v-if="allowCustom" class="ss-sep"></div>
        <button v-if="allowCustom" type="button" class="ss-opt ss-custom" @click="chooseCustom">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          <span>{{ customLabel }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: string[]
    placeholder?: string
    disabled?: boolean
    allowEmpty?: boolean
    emptyLabel?: string
    allowCustom?: boolean
    customLabel?: string
  }>(),
  {
    placeholder: '请选择',
    disabled: false,
    allowEmpty: false,
    emptyLabel: '不选择',
    allowCustom: false,
    customLabel: '手动输入',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'custom'): void
}>()

const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
const rect = ref<{ left: number; top: number; width: number; maxHeight: number }>({ left: 0, top: 0, width: 0, maxHeight: 260 })

const display = computed(() => props.modelValue || props.placeholder)
const panelStyle = computed(() => ({
  left: `${rect.value.left}px`,
  top: `${rect.value.top}px`,
  width: `${rect.value.width}px`,
  maxHeight: `${rect.value.maxHeight}px`,
}))

function place(): void {
  const el = root.value
  if (!el) return
  const box = el.getBoundingClientRect()
  const below = window.innerHeight - box.bottom - 16
  const above = box.top - 16
  const useAbove = below < 180 && above > below
  const maxHeight = Math.max(140, Math.min(280, useAbove ? above : below))
  const height = Math.min(maxHeight, (props.options.length + (props.allowCustom ? 2 : 0) + (props.allowEmpty ? 1 : 0)) * 38 + 14)
  rect.value = {
    left: box.left,
    top: useAbove ? Math.max(8, box.top - height - 6) : box.bottom + 6,
    width: box.width,
    maxHeight,
  }
}

function onDocPointer(event: PointerEvent): void {
  const target = event.target as Node | null
  if (!target) return
  if (root.value?.contains(target) || panel.value?.contains(target)) return
  close()
}

function onViewportChange(): void {
  if (open.value) place()
}

function bind(): void {
  document.addEventListener('pointerdown', onDocPointer, true)
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
}

function unbind(): void {
  document.removeEventListener('pointerdown', onDocPointer, true)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
}

function toggle(): void {
  if (props.disabled) return
  if (open.value) {
    close()
    return
  }
  place()
  open.value = true
  bind()
}

function close(): void {
  if (!open.value) return
  open.value = false
  unbind()
}

function pick(value: string): void {
  emit('update:modelValue', value)
  close()
}

function chooseCustom(): void {
  close()
  emit('custom')
}

onBeforeUnmount(unbind)
</script>

<style scoped>
.site-select {
  width: 100%;
  min-width: 0;
}
.ss-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #fbfefe;
  border: 1px solid #cfe0df;
  border-radius: 10px;
  color: #15333a;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
.ss-trigger:hover {
  border-color: #9ed5ce;
}
.ss-trigger:focus-visible {
  outline: none;
  border-color: #12a594;
  box-shadow: 0 0 0 3px rgba(18, 165, 148, 0.14);
}
.site-select.open .ss-trigger {
  border-color: #12a594;
  box-shadow: 0 0 0 3px rgba(18, 165, 148, 0.14);
}
.ss-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.ss-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ss-value.placeholder {
  color: #93a7ad;
  font-weight: 500;
}
.ss-caret {
  flex: none;
  color: #7d9298;
  transition: transform 0.16s ease;
}
.site-select.open .ss-caret {
  transform: rotate(180deg);
  color: #0b887b;
}
</style>

<style>
/* 面板被 Teleport 到 body：scoped 选择器带不到它，用非 scoped 但以 .ss-panel 前缀收窄 */
.ss-panel {
  position: fixed;
  z-index: 3000;
  overflow: auto;
  padding: 6px;
  background: #ffffff;
  border: 1px solid #d9e8e7;
  border-radius: 12px;
  box-shadow: 0 18px 44px rgba(17, 50, 56, 0.18);
  font-family: Inter, "Microsoft YaHei", sans-serif;
}
.ss-panel .ss-opt {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #25464d;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.ss-panel .ss-opt > span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ss-panel .ss-opt:hover {
  background: #f1f8f7;
}
.ss-panel .ss-opt.active {
  background: #ddf8f1;
  color: #08796f;
  font-weight: 800;
}
.ss-panel .ss-check {
  flex: none;
  color: #0b887b;
}
.ss-panel .ss-empty {
  padding: 12px 10px;
  color: #93a7ad;
  font-size: 12px;
}
.ss-panel .ss-sep {
  height: 1px;
  margin: 6px 4px;
  background: #e6efee;
}
.ss-panel .ss-custom {
  color: #0b887b;
}
</style>
