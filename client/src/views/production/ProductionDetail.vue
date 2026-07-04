<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useProductionStore } from '@/stores/production';
import QCForm from './components/QCForm.vue';

const route = useRoute();
const store = useProductionStore();
const qcVisible = ref(false);

const statusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待生产', type: 'primary' },
  in_progress: { label: '生产中', type: 'warning' },
  completed: { label: '已完成', type: 'success' },
};

const qcStatusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待质检', type: 'info' },
  passed: { label: '已通过', type: 'success' },
  rejected: { label: '已退回', type: 'danger' },
};

onMounted(async () => {
  await store.fetchById(Number(route.params.id));
});

const handleStart = async () => {
  await ElMessageBox.confirm('确认开始此工单？');
  await store.start(store.current!.id);
  ElMessage.success('已开始生产');
  store.fetchById(store.current!.id);
};

const handleComplete = async () => {
  await ElMessageBox.confirm('确认此工单已完成生产？');
  await store.complete(store.current!.id);
  ElMessage.success('生产已完成');
  store.fetchById(store.current!.id);
};
</script>

<template>
  <div v-if="store.current" class="production-detail">
    <div class="detail-header">
      <h2>工单 #{{ store.current.id }}</h2>
      <el-tag :type="(statusMap[store.current.status]?.type as any)">
        {{ statusMap[store.current.status]?.label || store.current.status }}
      </el-tag>
      <div class="header-actions">
        <el-button
          v-permission="'production:start'"
          v-if="store.current.status === 'pending'"
          type="primary"
          @click="handleStart"
        >开始生产</el-button>
        <el-button
          v-permission="'production:start'"
          v-if="store.current.status === 'in_progress'"
          type="success"
          @click="handleComplete"
        >生产完成</el-button>
        <el-button
          v-permission="'production:qc'"
          v-if="store.current.status === 'completed'"
          type="warning"
          @click="qcVisible = true"
        >质检</el-button>
      </div>
    </div>

    <el-card class="detail-card">
      <template #header>合同信息</template>
      <el-descriptions :column="2">
        <el-descriptions-item label="合同号">
          {{ store.current.contract?.contract_no || store.current.contract_no || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="合同状态">
          <el-tag v-if="store.current.contract" type="success">已通过</el-tag>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ store.current.created_at }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">
          {{ store.current.contract?.customer_name || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="detail-card">
      <template #header>设备清单</template>
      <el-table :data="store.current.items || store.current.production_items || []" border>
        <el-table-column label="产品型号" min-width="120">
          <template #default="{ row }">
            {{ row.product?.model || row.model || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="产品名称" min-width="150">
          <template #default="{ row }">
            {{ row.product?.name || row.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column label="质检状态" width="100">
          <template #default="{ row }">
            <el-tag
              v-if="row.qc_status"
              :type="(qcStatusMap[row.qc_status]?.type as any)"
              size="small"
            >
              {{ qcStatusMap[row.qc_status]?.label || row.qc_status }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <QCForm
      v-model:visible="qcVisible"
      :production-id="store.current.id"
      @success="store.fetchById(store.current!.id)"
    />
  </div>
</template>

<style scoped>
.detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.header-actions { margin-left: auto; display: flex; gap: 8px; }
.detail-card { margin-bottom: 16px; }
.text-muted { color: #999; }
</style>
