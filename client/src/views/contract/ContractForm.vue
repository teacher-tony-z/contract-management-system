<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';
import ContractItemsEditor from './components/ContractItemsEditor.vue';

const route = useRoute();
const router = useRouter();

const isChange = computed(() => route.query.mode === 'change');
const isEdit = computed(() => !!route.params.id && !isChange.value);
const title = computed(() => isChange.value ? '合同变更' : isEdit.value ? '编辑合同' : '新建合同');

const form = ref({
  customer_name: '',
  customer_phone: '',
  customer_address: '',
  items: [] as Array<{ product_id: number; quantity: number; remark?: string }>,
  change_reason: '',
});

const loading = ref(false);

const loadContract = async () => {
  if (!route.params.id) return;
  const res = await request.get(`/contracts/${route.params.id}`);
  const c = res.data;
  form.value = {
    customer_name: c.customer_name,
    customer_phone: c.customer_phone || '',
    customer_address: c.customer_address || '',
    items: c.items?.map((i: any) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      remark: i.remark,
    })) || [],
    change_reason: '',
  };
};

onMounted(loadContract);

const handleSubmit = async () => {
  loading.value = true;
  try {
    if (isChange.value) {
      await request.post(`/contracts/${route.params.id}/change`, form.value);
      ElMessage.success('合同变更已提交');
    } else if (isEdit.value) {
      await request.put(`/contracts/${route.params.id}`, form.value);
      ElMessage.success('合同已更新');
    } else {
      const res = await request.post('/contracts', form.value);
      ElMessage.success('合同创建成功');
      router.push(`/contracts/${res.data.id}`);
      return;
    }
    router.push('/contracts');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div>
    <h2>{{ title }}</h2>
    <el-form :model="form" label-width="100px" style="max-width: 800px">
      <el-form-item label="客户名称" required>
        <el-input v-model="form.customer_name" placeholder="客户名称" />
      </el-form-item>
      <el-form-item label="联系电话">
        <el-input v-model="form.customer_phone" placeholder="联系电话" />
      </el-form-item>
      <el-form-item label="交付地址">
        <el-input v-model="form.customer_address" placeholder="交付地址" />
      </el-form-item>
      <el-form-item v-if="isChange" label="变更原因" required>
        <el-input v-model="form.change_reason" type="textarea" :rows="3" placeholder="请填写变更原因" />
      </el-form-item>
      <el-form-item label="设备清单">
        <ContractItemsEditor v-model="form.items" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="handleSubmit">保存</el-button>
        <el-button @click="router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
