<template>
  <!-- 有数据就显示：单页时按钮自动禁用，但「共 N 条」对用户是有用信息，
       也能让人一眼确认分页功能在工作（否则不满一页时像没实现分页） -->
  <div v-if="total > 0" class="pager">
    <button class="pg-btn" :disabled="page === 0" @click="emit('change', page - 1)">上一页</button>
    <span class="pg-info">
      第 {{ page + 1 }} / {{ pageCount }} 页 · 共 {{ total }} 条
    </span>
    <button class="pg-btn" :disabled="page + 1 >= pageCount" @click="emit('change', page + 1)">
      下一页
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * 轻量分页条：上一页 / 页码 / 下一页。
 *
 * <p>只负责展示与翻页事件，数据由父组件拉取——服务端分页（传 page/size）与
 * 本地分页（先切片再传 totalCount）都能套，不绑定任何数据来源。</p>
 */
defineProps<{
  /** 当前页，从 0 开始 */
  page: number
  /** 总页数，最少按 1 页算 */
  pageCount: number
  /** 总条数，仅用于展示 */
  total: number
}>()

const emit = defineEmits<{ (e: 'change', page: number): void }>()
</script>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
}
.pg-btn {
  padding: 6px 14px;
  border: 1px solid #dcede0;
  border-radius: 10px;
  background: #fff;
  color: #0b6e68;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.pg-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pg-info {
  font-size: 12.5px;
  color: #7c99a1;
}
</style>
