<script setup lang="ts">
import { ref, watch } from 'vue';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';

interface ContractItem {
  id: number;
  product_id: number;
  quantity: number;
  remark?: string;
  product?: { id: number; name: string; model: string };
}

interface Contract {
  id: number;
  contract_no: string;
  customer_name: string;
  items: ContractItem[];
}

interface DeliveryItem {
  product_id: number;
  quantity: number;
}

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const contracts = ref<Contract[]>([]);
const loadingContracts = ref(false);

const selectedContractId = ref<number | null>(null);
const selectedContract = ref<Contract | null>(null);
const deliveryItems = ref<DeliveryItem[]>([]);
const logisticsCompany = ref('');
const trackingNo = ref('');
const submitting = ref(false);

const loadContracts = async () => {
  loadingContracts.value = true;
  try {
    const res = await request.get('/contracts', { params: { status: 'approved' } });
    contracts.value = res.data;
  } finally {
    loadingContracts.value = false;
  }
};

watch(selectedContractId, (val) => {
  const contract = contracts.value.find(c => c.id === val) || null;
  selectedContract.value = contract;
  if (contract) {
    deliveryItems.value = contract.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
  } else {
    deliveryItems.value = [];
  }
});

const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};

const handleSubmit = async () => {
  if (!selectedContractId.value) {
    ElMessage.warning('请选择合同');
    return;
  }
  if (!logisticsCompany.value) {
    ElMessage.warning('请输入物流公司');
    return;
  }
  if (!trackingNo.value) {
    ElMessage.warning('请输入物流单号');
    return;
  }
  if (deliveryItems.value.length === 0) {
    ElMessage.warning('请选择包含产品的合同');
    return;
  }
  submitting.value = true;
  try {
    await request.post('/delivery', {
      contract_id: selectedContractId.value,
      logistics_company: logisticsCompany.value,
      tracking_no: trackingNo.value,
      items: deliveryItems.value,
    });
    ElMessage.success('交付单创建成功');
    handleClose();
    emit('success');
  } finally {
    submitting.value = false;
  }
};

watch(() => props.visible, (val) => {
  if (val) {
    selectedContractId.value = null;
    selectedContract.value = null;
    deliveryItems.value = [];
    logisticsCompany.value = '';
    trackingNo.value = '';
    loadContracts();
  }
});
</script>

<template>
  <el-dialog
    :model-value="props.visible"
    title="创建交付单"
    width="700px"
    @close="handleClose"
  >
    <el-form label-width="120px">
      <el-form-item label="关联合同" required>
        <el-select
          v-model="selectedContractId"
          placeholder="请选择已审批合同"
          style="width: 100%"
          :loading="loadingContracts"
        >
          <el-option
            v-for="c in contracts"
            :key="c.id"
            :label="`${c.contract_no} - ${c.customer_name}`"
            :value="c.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-if="selectedContract" label="合同产品">
        <el-table :data="selectedContract.items" border stripe size="small" style="width: 100%">
          <el-table-column label="产品型号" width="140">
            <template #default="{ row }">
              {{ row.product?.model || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="产品名称" min-width="120">
            <template #default="{ row }">
              {{ row.product?.name || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="合同数量" width="100" align="center">
            <template #default="{ row }">
              {{ row.quantity }}
            </template>
          </el-table-column>
          <el-table-column label="交付数量" width="120" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="deliveryItems[selectedContract.items.indexOf(row)].quantity"
                :min="0"
                :max="row.quantity"
                size="small"
                controls-position="right"
                style="width: 100px"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-form-item>

      <el-form-item label="物流公司" required>
        <el-input
          v-model="logisticsCompany"
          placeholder="请输入物流公司名称"
        />
      </el-form-item>
      <el-form-item label="物流单号" required>
        <el-input
          v-model="trackingNo"
          placeholder="请输入物流单号"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">创建</el-button>
    </template>
  </el-dialog>
</template>
