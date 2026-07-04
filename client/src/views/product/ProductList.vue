<script setup lang="ts">
import { onMounted, ref } from 'vue';
import request from '@/utils/request';
import ProductForm from './ProductForm.vue';

interface ProductItem {
  id: number;
  model: string;
  name: string;
  unit: string;
  status: number;
}

const productList = ref<ProductItem[]>([]);
const loading = ref(false);
const formVisible = ref(false);
const editingProduct = ref<any>(null);

const fetchList = async () => {
  loading.value = true;
  try {
    const res = await request.get('/products');
    productList.value = res.data;
  } finally {
    loading.value = false;
  }
};

const handleCreate = () => {
  editingProduct.value = null;
  formVisible.value = true;
};

const handleEdit = (row: ProductItem) => {
  editingProduct.value = { ...row };
  formVisible.value = true;
};

const handleFormSuccess = () => {
  formVisible.value = false;
  fetchList();
};

onMounted(fetchList);
</script>

<template>
  <div>
    <h2>产品目录管理</h2>
    <div class="toolbar">
      <el-button v-permission="'product:manage'" type="primary" @click="handleCreate">创建产品</el-button>
    </div>

    <el-table :data="productList" border stripe v-loading="loading">
      <el-table-column prop="model" label="产品型号" width="180" />
      <el-table-column prop="name" label="产品名称" min-width="200" />
      <el-table-column prop="unit" label="单位" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <ProductForm
      v-model="formVisible"
      :product="editingProduct"
      @success="handleFormSuccess"
    />
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
