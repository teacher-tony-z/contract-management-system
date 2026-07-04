<script setup lang="ts">
import { ref, watch } from 'vue';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  product?: any;
}>(), {});

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'success'): void;
}>();

const form = ref({
  model: '',
  name: '',
  unit: '',
  specs: '',
  status: 1,
});

const submitting = ref(false);
const isEdit = ref(false);

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      if (props.product) {
        isEdit.value = true;
        form.value = {
          model: props.product.model || '',
          name: props.product.name || '',
          unit: props.product.unit || '',
          specs: props.product.specs
            ? (typeof props.product.specs === 'object'
              ? JSON.stringify(props.product.specs, null, 2)
              : String(props.product.specs))
            : '',
          status: props.product.status ?? 1,
        };
      } else {
        isEdit.value = false;
        form.value = { model: '', name: '', unit: '', specs: '', status: 1 };
      }
    }
  },
);

const handleSubmit = async () => {
  if (!form.value.model) {
    ElMessage.warning('请输入产品型号');
    return;
  }
  if (!form.value.name) {
    ElMessage.warning('请输入产品名称');
    return;
  }
  submitting.value = true;
  try {
    const data: any = {
      model: form.value.model,
      name: form.value.name,
      unit: form.value.unit,
      specs: form.value.specs,
      status: form.value.status,
    };
    // Try to parse specs as JSON if not empty
    if (data.specs) {
      try {
        data.specs = JSON.parse(data.specs);
      } catch {
        // Keep as string if not valid JSON
      }
    }
    if (isEdit.value && props.product?.id) {
      await request.put(`/products/${props.product.id}`, data);
      ElMessage.success('产品更新成功');
    } else {
      await request.post('/products', data);
      ElMessage.success('产品创建成功');
    }
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
    :title="isEdit ? '编辑产品' : '创建产品'"
    width="520px"
    @close="handleClose"
  >
    <el-form label-width="100px">
      <el-form-item label="产品型号" required>
        <el-input v-model="form.model" placeholder="请输入产品型号" />
      </el-form-item>
      <el-form-item label="产品名称" required>
        <el-input v-model="form.name" placeholder="请输入产品名称" />
      </el-form-item>
      <el-form-item label="单位">
        <el-input v-model="form.unit" placeholder="如：台、套" />
      </el-form-item>
      <el-form-item label="规格参数">
        <el-input
          v-model="form.specs"
          type="textarea"
          :rows="4"
          placeholder="JSON 格式，如：{&quot;CPU&quot;: &quot;i7&quot;, &quot;内存&quot;: &quot;16GB&quot;}"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-switch
          v-model="form.status"
          :active-value="1"
          :inactive-value="0"
          active-text="启用"
          inactive-text="停用"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
</style>
