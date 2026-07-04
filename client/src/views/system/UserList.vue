<script setup lang="ts">
import { onMounted, ref } from 'vue';
import request from '@/utils/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserForm from './UserForm.vue';

interface UserItem {
  id: number;
  username: string;
  real_name: string;
  phone: string;
  status: string;
  roles: { id: number; name: string }[];
}

const userList = ref<UserItem[]>([]);
const loading = ref(false);
const formVisible = ref(false);
const editingUser = ref<any>(null);

const fetchList = async () => {
  loading.value = true;
  try {
    const res = await request.get('/users');
    userList.value = res.data;
  } finally {
    loading.value = false;
  }
};

const handleCreate = () => {
  editingUser.value = null;
  formVisible.value = true;
};

const handleEdit = (row: UserItem) => {
  editingUser.value = { ...row };
  formVisible.value = true;
};

const handleToggleStatus = async (row: UserItem) => {
  const newStatus = row.status === 'enabled' ? 'disabled' : 'enabled';
  const actionLabel = row.status === 'enabled' ? '禁用' : '启用';
  try {
    await ElMessageBox.confirm(`确认${actionLabel}用户「${row.username}」？`, '提示');
    await request.put(`/users/${row.id}/status`, { status: newStatus });
    ElMessage.success(`${actionLabel}成功`);
    fetchList();
  } catch {
    // cancelled or error
  }
};

const handleDelete = async (row: UserItem) => {
  try {
    await ElMessageBox.confirm(
      `确认删除用户「${row.username}」？此操作不可恢复。`,
      '警告',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' },
    );
    await request.delete(`/users/${row.id}`);
    ElMessage.success('删除成功');
    fetchList();
  } catch {
    // cancelled or error
  }
};

const handleFormSuccess = () => {
  formVisible.value = false;
  fetchList();
};

onMounted(fetchList);
</script>

<template>
  <div>
    <h2>用户管理</h2>
    <div class="toolbar">
      <el-button v-permission="'system:admin'" type="primary" @click="handleCreate">创建用户</el-button>
    </div>

    <el-table :data="userList" border stripe v-loading="loading">
      <el-table-column prop="username" label="用户名" width="140" />
      <el-table-column prop="real_name" label="姓名" width="120" />
      <el-table-column prop="phone" label="手机号" width="140" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'enabled' ? 'success' : 'danger'">
            {{ row.status === 'enabled' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="角色" min-width="180">
        <template #default="{ row }">
          <el-tag
            v-for="role in (row.roles || [])"
            :key="role.id"
            style="margin-right: 4px; margin-bottom: 2px;"
          >
            {{ role.name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button
            size="small"
            :type="row.status === 'enabled' ? 'warning' : 'success'"
            @click="handleToggleStatus(row)"
          >
            {{ row.status === 'enabled' ? '禁用' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <UserForm
      v-model="formVisible"
      :user="editingUser"
      @success="handleFormSuccess"
    />
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
