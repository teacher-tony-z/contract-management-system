<script setup lang="ts">
import { ref, watch } from 'vue';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  user?: any;
}>(), {});

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'success'): void;
}>();

const form = ref({
  username: '',
  password: '',
  real_name: '',
  phone: '',
  role_ids: [] as number[],
});

const roles = ref<any[]>([]);
const submitting = ref(false);
const isEdit = ref(false);

const fetchRoles = async () => {
  try {
    const res = await request.get('/roles');
    roles.value = res.data;
  } catch {
    ElMessage.error('获取角色列表失败');
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      fetchRoles();
      if (props.user) {
        isEdit.value = true;
        form.value = {
          username: props.user.username || '',
          password: '',
          real_name: props.user.real_name || '',
          phone: props.user.phone || '',
          role_ids: (props.user.roles || []).map((r: any) => r.id),
        };
      } else {
        isEdit.value = false;
        form.value = {
          username: '',
          password: '',
          real_name: '',
          phone: '',
          role_ids: [],
        };
      }
    }
  },
);

const handleSubmit = async () => {
  if (!form.value.username) {
    ElMessage.warning('请输入用户名');
    return;
  }
  if (!isEdit.value && !form.value.password) {
    ElMessage.warning('请输入密码');
    return;
  }
  submitting.value = true;
  try {
    const data: any = {
      username: form.value.username,
      real_name: form.value.real_name,
      phone: form.value.phone,
      role_ids: form.value.role_ids,
    };
    if (form.value.password) {
      data.password = form.value.password;
    }
    if (isEdit.value && props.user?.id) {
      await request.put(`/users/${props.user.id}`, data);
      ElMessage.success('用户更新成功');
    } else {
      await request.post('/users', data);
      ElMessage.success('用户创建成功');
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
    :title="isEdit ? '编辑用户' : '创建用户'"
    width="500px"
    @close="handleClose"
  >
    <el-form label-width="100px">
      <el-form-item label="用户名" required>
        <el-input v-model="form.username" :disabled="isEdit" placeholder="请输入用户名" />
      </el-form-item>
      <el-form-item :label="isEdit ? '密码' : '密码'" :required="!isEdit">
        <el-input
          v-model="form.password"
          type="password"
          :placeholder="isEdit ? '留空则不修改' : '请输入密码'"
          show-password
        />
      </el-form-item>
      <el-form-item label="姓名">
        <el-input v-model="form.real_name" placeholder="请输入姓名" />
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model="form.phone" placeholder="请输入手机号" />
      </el-form-item>
      <el-form-item label="角色">
        <el-checkbox-group v-model="form.role_ids">
          <el-checkbox v-for="role in roles" :key="role.id" :label="role.id" :value="role.id">
            {{ role.name }}
          </el-checkbox>
        </el-checkbox-group>
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
