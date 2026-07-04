<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import request from '@/utils/request';
import DeliveryForm from './DeliveryForm.vue';

interface DeliveryItem {
  id: number;
  contract: { contract_no: string } | null;
  logistics_company: string;
  tracking_no: string;
  status: string;
  created_at: string;
}

const router = useRouter();

const list = ref<DeliveryItem[]>([]);
const loading = ref(false);
const formVisible = ref(false);

const statusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待发货', type: 'warning' },
  shipped: { label: '已发货', type: 'primary' },
  delivered: { label: '已完成', type: 'success' },
};

const fetchList = async () => {
  loading.value = true;
  try {
    const res = await request.get('/delivery');
    list.value = res.data;
  } finally {
    loading.value = false;
  }
};

const handleCreate = () => {
  formVisible.value = true;
};

onMounted(fetchList);
</script>

<template>
  <div>
    <h2>交付管理</h2>
    <div class="toolbar">
      <el-button v-permission="'delivery:ship'" type="primary" @click="handleCreate">
        创建交付单
      </el-button>
    </div>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="合同号" min-width="160">
        <template #default="{ row }">
          {{ row.contract?.contract_no || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="logistics_company" label="物流公司" width="150" />
      <el-table-column prop="tracking_no" label="物流单号" width="150" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="(statusMap[row.status]?.type as any)">
            {{ statusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="router.push(`/delivery/${row.id}`)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <DeliveryForm
      v-model:visible="formVisible"
      @success="fetchList"
    />
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
