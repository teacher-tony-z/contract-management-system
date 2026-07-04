<script setup lang="ts">
import { ref } from 'vue';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  visible: boolean;
  deliveryId: number;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const form = ref({
  test_date: '',
  test_result: '',
  remark: '',
});
const submitting = ref(false);

const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};

const handleSubmit = async () => {
  if (!form.value.test_date) {
    ElMessage.warning('请选择测试日期');
    return;
  }
  if (!form.value.test_result) {
    ElMessage.warning('请填写测试结果');
    return;
  }
  submitting.value = true;
  try {
    await request.post(`/delivery/${props.deliveryId}/after-sale`, {
      test_date: form.value.test_date,
      test_result: form.value.test_result,
      remark: form.value.remark,
    });
    ElMessage.success('售后记录提交成功');
    handleClose();
    emit('success');
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <el-dialog
    :model-value="props.visible"
    title="记录售后"
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
          :rows="3"
          type="textarea"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input
          v-model="form.remark"
          placeholder="可选备注信息"
          :rows="3"
          type="textarea"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
    </template>
  </el-dialog>
</template>
