<script setup lang="ts">
import { ref, watch } from 'vue';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  role?: any;
}>(), {});

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'success'): void;
}>();

const form = ref({
  name: '',
  description: '',
});

const submitting = ref(false);

watch(
  () => props.modelValue,
  (val) => {
    if (val && props.role) {
      form.value = {
        name: props.role.name || '',
        description: props.role.description || '',
      };
    } else if (val) {
      form.value = { name: '', description: '' };
    }
  },
);

const handleSubmit = async () => {
  if (!form.value.name) {
    ElMessage.warning('请输入角色名称');
    return;
  }
  submitting.value = true;
  try {
    await request.post('/roles', {
      name: form.value.name,
      description: form.value.description,
    });
    ElMessage.success('角色创建成功');
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
    title="创建角色"
    width="480px"
    @close="handleClose"
  >
    <el-form label-width="100px">
      <el-form-item label="角色名称" required>
        <el-input v-model="form.name" placeholder="请输入角色名称" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="角色描述（可选）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">创建</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
</style>
