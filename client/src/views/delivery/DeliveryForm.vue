<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';

const router = useRouter();

const form = ref({
  contract_id: null as number | null,
  logistics_company: '',
  tracking_no: '',
  items: [] as { product_id: number; quantity: number }[],
});

const loading = ref(false);
const submitting = ref(false);
const approvedContracts = ref<any[]>([]);
const selectedContract = ref<any>(null);
const contractItems = ref<any[]>([]);

const loadContracts = async () => {
  try {
    const res = await request.get('/contracts', { params: { status: 'approved' } });
    approvedContracts.value = res.data;
  } catch {
    ElMessage.error('获取合同列表失败');
  }
};

const onContractChange = (contractId: number) => {
  const contract = approvedContracts.value.find((c: any) => c.id === contractId);
  selectedContract.value = contract;
  if (contract?.items) {
    contractItems.value = contract.items.map((item: any) => ({
      ...item,
      ship_quantity: item.quantity,
    }));
  } else {
    contractItems.value = [];
  }
};

const handleSubmit = async () => {
  if (!form.value.contract_id) {
    ElMessage.warning('请选择合同');
    return;
  }
  if (!form.value.logistics_company) {
    ElMessage.warning('请输入物流公司');
    return;
  }
  if (!form.value.tracking_no) {
    ElMessage.warning('请输入快递单号');
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      contract_id: form.value.contract_id,
      logistics_company: form.value.logistics_company,
      tracking_no: form.value.tracking_no,
      items: contractItems.value.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.ship_quantity,
      })),
    };
    await request.post('/delivery', payload);
    ElMessage.success('发货单创建成功');
    router.push('/delivery');
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false;
  }
};

const handleCancel = () => {
  router.push('/delivery');
};

// Load contracts on mount
loading.value = true;
loadContracts().finally(() => { loading.value = false; });
</script>

<template>
  <div>
    <h2>创建发货单</h2>
    <el-card v-loading="loading" style="max-width: 800px">
      <el-form label-width="120px">
        <el-form-item label="选择合同" required>
          <el-select
            v-model="form.contract_id"
            placeholder="请选择已审批通过的合同"
            style="width: 100%"
            @change="onContractChange"
          >
            <el-option
              v-for="c in approvedContracts"
              :key="c.id"
              :label="`${c.contract_no} - ${c.customer_name}`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="物流公司" required>
          <el-input v-model="form.logistics_company" placeholder="如：顺丰速运" />
        </el-form-item>

        <el-form-item label="快递单号" required>
          <el-input v-model="form.tracking_no" placeholder="请输入快递单号" />
        </el-form-item>

        <el-form-item label="发货设备" v-if="contractItems.length">
          <el-table :data="contractItems" border size="small" style="width: 100%">
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
            <el-table-column label="合同数量" width="120" prop="quantity" />
            <el-table-column label="发货数量" width="120">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.ship_quantity"
                  :min="1"
                  :max="row.quantity"
                  size="small"
                />
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">提交发货</el-button>
          <el-button @click="handleCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
</style>
