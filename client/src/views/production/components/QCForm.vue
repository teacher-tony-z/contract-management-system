<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useProductionStore } from '@/stores/production';

const props = defineProps<{
  visible: boolean;
  productionId: number;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const store = useProductionStore();

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
    await store.qc(props.productionId, action.value, remark.value);
    ElMessage.success('质检操作完成');
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
    title="质检操作"
    width="400px"
    @close="handleClose"
  >
    <el-radio-group v-model="action">
      <el-radio value="pass">质检通过</el-radio>
      <el-radio value="reject">质检退回</el-radio>
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
