<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import request from '@/utils/request';

interface Item {
  product_id: number;
  quantity: number;
  remark?: string;
}

const props = defineProps<{
  modelValue: Item[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Item[]): void;
}>();

interface ProductOption {
  id: number;
  name: string;
  model: string;
}

const products = ref<ProductOption[]>([]);
const items = ref<Item[]>([]);
const syncing = ref(false);

// Sync from props to local (one direction)
watch(() => props.modelValue, (val) => {
  if (syncing.value) {
    syncing.value = false;
    return;
  }
  items.value = val.map(i => ({ ...i }));
}, { immediate: true, deep: true });

// Watch for local changes and emit to parent
watch(items, (val) => {
  syncing.value = true;
  emit('update:modelValue', val.map(i => ({ ...i })));
}, { deep: true });

onMounted(async () => {
  try {
    const res = await request.get('/products');
    products.value = res.data;
  } catch {
    // silently fail
  }
});

const addItem = () => {
  items.value.push({ product_id: 0, quantity: 1, remark: '' });
};

const removeItem = (index: number) => {
  items.value.splice(index, 1);
};
</script>

<template>
  <div>
    <el-table :data="items" border stripe>
      <el-table-column label="产品" min-width="200">
        <template #default="{ row }">
          <el-select v-model="row.product_id" placeholder="选择产品" style="width: 100%">
            <el-option v-for="p in products" :key="p.id" :label="`${p.model} - ${p.name}`" :value="p.id" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="数量" width="120">
        <template #default="{ row }">
          <el-input-number v-model="row.quantity" :min="1" style="width: 100%" />
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="150">
        <template #default="{ row }">
          <el-input v-model="row.remark" placeholder="备注" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80">
        <template #default="{ $index }">
          <el-button size="small" type="danger" @click="removeItem($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-button type="primary" size="small" style="margin-top: 8px" @click="addItem">添加设备</el-button>
  </div>
</template>
