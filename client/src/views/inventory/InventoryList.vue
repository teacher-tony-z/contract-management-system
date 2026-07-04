<script setup lang="ts">
import { onMounted, ref } from 'vue';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';

interface InventoryItem {
  id: number;
  product: { model: string; name: string };
  quantity: number;
  location: string;
  updatedAt: string;
}

const inventoryList = ref<InventoryItem[]>([]);
const loading = ref(false);
const adjustDialogVisible = ref(false);
const currentItem = ref<InventoryItem | null>(null);
const adjustQuantity = ref(0);
const adjusting = ref(false);

const fetchList = async () => {
  loading.value = true;
  try {
    const res = await request.get('/inventory');
    inventoryList.value = res.data;
  } finally {
    loading.value = false;
  }
};

const showAdjust = (row: InventoryItem) => {
  currentItem.value = row;
  adjustQuantity.value = 0;
  adjustDialogVisible.value = true;
};

const handleAdjust = async () => {
  if (!currentItem.value || adjustQuantity.value === 0) {
    ElMessage.warning('调整数量不能为0');
    return;
  }
  adjusting.value = true;
  try {
    await request.post(`/inventory/${currentItem.value.id}/adjust`, {
      quantity: adjustQuantity.value,
    });
    ElMessage.success('库存调整成功');
    adjustDialogVisible.value = false;
    fetchList();
  } finally {
    adjusting.value = false;
  }
};

onMounted(fetchList);
</script>

<template>
  <div>
    <h2>库存管理</h2>
    <el-table :data="inventoryList" border stripe v-loading="loading">
      <el-table-column label="产品型号" prop="product.model" />
      <el-table-column label="产品名称" prop="product.name" />
      <el-table-column label="库存数量" width="120">
        <template #default="{ row }">
          <el-tag :type="row.quantity > 0 ? 'success' : 'danger'">
            {{ row.quantity }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="库位" prop="location" width="150" />
      <el-table-column label="最后更新" prop="updatedAt" width="180" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" v-permission="'inventory:update'" @click="showAdjust(row)">
            调整库存
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="adjustDialogVisible" title="调整库存" width="420px">
      <el-form label-width="90px">
        <el-form-item label="产品型号">
          <el-input :model-value="currentItem?.product?.model" disabled />
        </el-form-item>
        <el-form-item label="当前库存">
          <el-input :model-value="currentItem?.quantity" disabled />
        </el-form-item>
        <el-form-item label="调整数量">
          <el-input-number v-model="adjustQuantity" :min="-99999" :max="99999" />
          <span style="margin-left: 8px; font-size: 12px; color: #999;">正数增加，负数减少</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjusting" @click="handleAdjust">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
</style>
