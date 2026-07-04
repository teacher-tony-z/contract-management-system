<script setup lang="ts">
import { ref } from 'vue';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  contractId?: number;
}>(), {});

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'success'): void;
}>();

const form = ref({
  test_date: '',
  test_result: '',
  remark: '',
});

const submitting = ref(false);

const handleSubmit = async () => {
  if (!props.contractId) {
    ElMessage.warning('合同信息缺失');
    return;
  }
  if (!form.value.test_date) {
    ElMessage.warning('请选择测试日期');
    return;
  }
  if (!form.value.test_result) {
    ElMessage.warning('请输入测试结果');
    return;
  }
  submitting.value = true;
  try {
    await request.post(`/delivery/after-sale/${props.contractId}`, {
      test_date: form.value.test_date,
      test_result: form.value.test_result,
      remark: form.value.remark,
    });
    ElMessage.success('售后记录保存成功');
    form.value = { test_date: '', test_result: '', remark: '' };
    emit('success');
    emit('update:modelValue', false);
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false;
  }
};

const handleClose = () => {
  emit('update:modelValue', false);
};
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    title="售后装机记录"
    width="500px"
    @close="handleClose"
  >
    <el-form label-width="100px">
      <el-form-item label="测试日期" required>
        <el-date-picker
          v-model="form.test_date"
          type="date"
          placeholder="选择日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="测试结果" required>
        <el-input
          v-model="form.test_result"
          placeholder="请输入测试结果"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="3"
          placeholder="备注信息（可选）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
</style>
