<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '@/utils/request';
import AfterSaleForm from './components/AfterSaleForm.vue';

interface DeliveryItem {
  id: number;
  product_id: number;
  quantity: number;
  product?: { name: string; model: string };
}

interface DeliveryDetail {
  id: number;
  contract: { contract_no: string; customer_name: string } | null;
  logistics_company: string;
  tracking_no: string;
  status: string;
  items: DeliveryItem[];
  created_at: string;
  updated_at: string;
}

const route = useRoute();

const detail = ref<DeliveryDetail | null>(null);
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
    const res = await request.get(`/delivery/${route.params.id}`);
    detail.value = res.data;
  } finally {
    loading.value = false;
  }
};

const handleRecordAfterSale = () => {
  afterSaleVisible.value = true;
};

onMounted(fetchDetail);
</script>

<template>
  <div>
    <h2>交付详情</h2>

    <el-card v-loading="loading" style="margin-bottom: 16px">
      <template #header>
        <span>基本信息</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="交付单ID">
          {{ detail?.id }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="detail" :type="(statusMap[detail.status]?.type as any)">
            {{ statusMap[detail.status]?.label || detail.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="合同号">
          {{ detail?.contract?.contract_no || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="客户名称">
          {{ detail?.contract?.customer_name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="物流公司">
          {{ detail?.logistics_company || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="物流单号">
          {{ detail?.tracking_no || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ detail?.created_at || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ detail?.updated_at || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-bottom: 16px">
      <template #header>
        <span>交付产品</span>
      </template>
      <el-table :data="detail?.items || []" border stripe>
        <el-table-column label="产品型号" width="160">
          <template #default="{ row }">
            {{ row.product?.model || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="产品名称" min-width="160">
          <template #default="{ row }">
            {{ row.product?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="交付数量" width="100" align="center" prop="quantity" />
      </el-table>
    </el-card>

    <div class="toolbar">
      <el-button
        v-if="detail?.status === 'shipped'"
        v-permission="'delivery:install'"
        type="warning"
        @click="handleRecordAfterSale"
      >
        记录售后
      </el-button>
      <el-button @click="$router.back()">返回</el-button>
    </div>

    <AfterSaleForm
      v-if="detail"
      v-model:visible="afterSaleVisible"
      :delivery-id="detail.id"
      @success="fetchDetail"
    />
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
