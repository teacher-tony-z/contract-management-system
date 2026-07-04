<script setup lang="ts">
import { ref, onMounted } from 'vue';
import request from '@/utils/request';

const props = defineProps<{
  contractId: number;
}>();

interface Operation {
  id: number;
  action: string;
  operator: string;
  remark?: string;
  created_at: string;
}

const operations = ref<Operation[]>([]);
const loading = ref(false);

const actionLabels: Record<string, string> = {
  create: '创建合同',
  submit: '提交审核',
  audit_pass: '审核通过',
  audit_reject: '审核退回',
  change: '合同变更',
  complete: '交付确认',
  terminate: '合同终止',
};

onMounted(async () => {
  loading.value = true;
  try {
    const res = await request.get(`/contracts/${props.contractId}/operations`);
    operations.value = res.data;
  } catch {
    // silently fail
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div v-loading="loading">
    <el-timeline v-if="operations.length > 0">
      <el-timeline-item
        v-for="op in operations"
        :key="op.id"
        :timestamp="op.created_at"
      >
        <p>{{ actionLabels[op.action] || op.action }}</p>
        <p v-if="op.remark" style="color: #999; font-size: 13px;">{{ op.remark }}</p>
        <p style="color: #999; font-size: 12px;">操作人: {{ op.operator }}</p>
      </el-timeline-item>
    </el-timeline>
    <el-empty v-else-if="!loading" description="暂无操作记录" />
  </div>
</template>
