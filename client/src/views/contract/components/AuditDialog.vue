<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';

const props = defineProps<{
  visible: boolean;
  contractId: number;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const action = ref<'pass' | 'reject'>('pass');
const remark = ref('');
const confirming = ref(false);

const confirm = async () => {
  if (action.value === 'reject' && !remark.value) {
    ElMessage.warning('请填写退回原因');
    return;
  }
  confirming.value = true;
  try {
    await request.post(`/contracts/${props.contractId}/audit`, {
      action: action.value,
      remark: remark.value,
    });
    ElMessage.success('审核完成');
    emit('update:visible', false);
    emit('close');
    emit('success');
  } finally {
    confirming.value = false;
  }
};

const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};
</script>

<template>
  <el-dialog
    :model-value="props.visible"
    title="合同审核"
    width="400px"
    @close="handleClose"
  >
    <el-radio-group v-model="action">
      <el-radio value="pass">审核通过</el-radio>
      <el-radio value="reject">退回修改</el-radio>
    </el-radio-group>
    <el-input
      v-if="action === 'reject'"
      v-model="remark"
      type="textarea"
      placeholder="退回原因"
      :rows="3"
      style="margin-top: 12px"
    />
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="confirming" @click="confirm">确认</el-button>
    </template>
  </el-dialog>
</template>
