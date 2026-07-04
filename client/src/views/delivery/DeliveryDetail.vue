<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';
import AfterSaleForm from './components/AfterSaleForm.vue';

const route = useRoute();
const delivery = ref<any>(null);
const loading = ref(false);
const afterSaleVisible = ref(false);

const statusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待发货', type: 'warning' },
  shipped: { label: '已发货', type: 'primary' },
  delivered: { label: '已完成', type: 'success' },
};

const fetchDetail = async () => {
  loading.value = true;
  try {
    const id = route.params.id;
    const res = await request.get(`/delivery/${id}`);
    delivery.value = res.data;
  } catch {
    ElMessage.error('获取发货单详情失败');
  } finally {
    loading.value = false;
  }
};

const handleAfterSaleSuccess = () => {
  afterSaleVisible.value = false;
  ElMessage.success('售后记录已保存');
};

onMounted(fetchDetail);
</script>

<template>
  <div v-loading="loading">
    <h2>发货单详情</h2>
    <el-card v-if="delivery" style="max-width: 800px">
      <el-descriptions title="发货信息" :column="2" border>
        <el-descriptions-item label="发货单ID">{{ delivery.id }}</el-descriptions-item>
        <el-descriptions-item label="关联合同号">
          {{ delivery.contract?.contract_no || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="物流公司">{{ delivery.logistics_company }}</el-descriptions-item>
        <el-descriptions-item label="快递单号">{{ delivery.tracking_no }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="(statusMap[delivery.status]?.type as any)">
            {{ statusMap[delivery.status]?.label || delivery.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ delivery.created_at }}</el-descriptions-item>
      </el-descriptions>

      <h3 style="margin-top: 24px">发货设备清单</h3>
      <el-table :data="delivery.items || []" border stripe style="margin-top: 8px">
        <el-table-column label="产品型号" width="150">
          <template #default="{ row }">
            {{ row.product?.model || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="产品名称" width="150">
          <template #default="{ row }">
            {{ row.product?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="发货数量" width="100" prop="quantity" />
      </el-table>

      <div style="margin-top: 16px">
        <el-button
          v-permission="'delivery:install'"
          v-if="delivery.status === 'shipped'"
          type="warning"
          @click="afterSaleVisible = true"
        >
          记录售后装机
        </el-button>
      </div>
    </el-card>

    <AfterSaleForm
      v-model="afterSaleVisible"
      :contract-id="delivery?.contract?.id"
      @success="handleAfterSaleSuccess"
    />
  </div>
</template>

<style scoped>
</style>
