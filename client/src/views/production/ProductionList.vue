<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useProductionStore } from '@/stores/production';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const router = useRouter();
const store = useProductionStore();

const dialogVisible = ref(false);
const approvedContracts = ref<any[]>([]);
const selectedContractId = ref<number | null>(null);
const creating = ref(false);

const statusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待生产', type: 'primary' },
  in_progress: { label: '生产中', type: 'warning' },
  completed: { label: '已完成', type: 'success' },
};

onMounted(() => store.fetchList());

const handleStart = async (id: number) => {
  await ElMessageBox.confirm('确认开始此工单？');
  await store.start(id);
  ElMessage.success('已开始生产');
  store.fetchList();
};

const handleComplete = async (id: number) => {
  await ElMessageBox.confirm('确认此工单已完成生产？');
  await store.complete(id);
  ElMessage.success('生产已完成');
  store.fetchList();
};

const openCreateDialog = async () => {
  const res = await request.get('/contracts', { params: { status: 'approved' } });
  approvedContracts.value = res.data;
  selectedContractId.value = null;
  dialogVisible.value = true;
};

const handleCreate = async () => {
  if (!selectedContractId.value) {
    ElMessage.warning('请选择合同');
    return;
  }
  creating.value = true;
  try {
    await store.create(selectedContractId.value);
    ElMessage.success('工单创建成功');
    dialogVisible.value = false;
    store.fetchList();
  } finally {
    creating.value = false;
  }
};
</script>

<template>
  <div>
    <h2>生产管理</h2>
    <div class="toolbar">
      <el-button v-permission="'production:create'" type="primary" @click="openCreateDialog">创建工单</el-button>
    </div>

    <el-table :data="store.list" border stripe v-loading="!store.list.length && !store.list">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="关联合同号" min-width="160">
        <template #default="{ row }">
          {{ row.contract?.contract_no || row.contract_no || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="(statusMap[row.status]?.type as any)">
            {{ statusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="router.push(`/production/${row.id}`)">详情</el-button>
          <el-button
            size="small"
            v-permission="'production:start'"
            v-if="row.status === 'pending'"
            type="primary"
            @click="handleStart(row.id)"
          >开始生产</el-button>
          <el-button
            size="small"
            v-permission="'production:start'"
            v-if="row.status === 'in_progress'"
            type="success"
            @click="handleComplete(row.id)"
          >生产完成</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="创建工单" width="500px">
      <el-form>
        <el-form-item label="选择合同">
          <el-select v-model="selectedContractId" placeholder="请选择已审批通过的合同" style="width: 100%">
            <el-option
              v-for="c in approvedContracts"
              :key="c.id"
              :label="`${c.contract_no} - ${c.customer_name}`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
