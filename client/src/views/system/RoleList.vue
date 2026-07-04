<script setup lang="ts">
import { onMounted, ref } from 'vue';
import request from '@/utils/request';
import { ElMessage } from 'element-plus';
import RoleForm from './RoleForm.vue';

interface RoleItem {
  id: number;
  name: string;
  description: string;
  permissions?: { id: number; name: string; module: string }[];
}

const roleList = ref<RoleItem[]>([]);
const loading = ref(false);
const formVisible = ref(false);
const editingRole = ref<any>(null);
const permDialogVisible = ref(false);
const currentRole = ref<RoleItem | null>(null);
const allPermissions = ref<any[]>([]);
const selectedPermIds = ref<number[]>([]);
const savingPerms = ref(false);

const fetchList = async () => {
  loading.value = true;
  try {
    const res = await request.get('/roles');
    roleList.value = res.data;
  } finally {
    loading.value = false;
  }
};

const handleCreate = () => {
  editingRole.value = null;
  formVisible.value = true;
};

const handleFormSuccess = () => {
  formVisible.value = false;
  fetchList();
};

const openPermDialog = async (role: RoleItem) => {
  currentRole.value = role;
  selectedPermIds.value = (role.permissions || []).map((p) => p.id);
  try {
    const res = await request.get('/permissions');
    allPermissions.value = res.data;
    permDialogVisible.value = true;
  } catch {
    ElMessage.error('获取权限列表失败');
  }
};

const savePermissions = async () => {
  if (!currentRole.value) return;
  savingPerms.value = true;
  try {
    await request.put(`/roles/${currentRole.value.id}/permissions`, {
      permission_ids: selectedPermIds.value,
    });
    ElMessage.success('权限配置已保存');
    permDialogVisible.value = false;
    fetchList();
  } catch {
    // error handled by interceptor
  } finally {
    savingPerms.value = false;
  }
};

// Group permissions by module
const groupedPermissions = () => {
  const groups: Record<string, any[]> = {};
  for (const perm of allPermissions.value) {
    const module = perm.module || '其他';
    if (!groups[module]) groups[module] = [];
    groups[module].push(perm);
  }
  return groups;
};

onMounted(fetchList);
</script>

<template>
  <div>
    <h2>角色管理</h2>
    <div class="toolbar">
      <el-button v-permission="'system:admin'" type="primary" @click="handleCreate">创建角色</el-button>
    </div>

    <el-table :data="roleList" border stripe v-loading="loading">
      <el-table-column prop="name" label="角色名称" width="180" />
      <el-table-column prop="description" label="描述" min-width="300" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="openPermDialog(row)">权限</el-button>
        </template>
      </el-table-column>
    </el-table>

    <RoleForm
      v-model="formVisible"
      :role="editingRole"
      @success="handleFormSuccess"
    />

    <!-- Permission Assignment Dialog -->
    <el-dialog
      v-model="permDialogVisible"
      :title="`权限配置 - ${currentRole?.name}`"
      width="600px"
    >
      <el-form v-if="allPermissions.length">
        <el-form-item
          v-for="(perms, module) in groupedPermissions()"
          :key="module"
          :label="module"
          label-width="100px"
        >
          <el-checkbox-group v-model="selectedPermIds">
            <el-checkbox v-for="perm in perms" :key="perm.id" :label="perm.id" :value="perm.id">
              {{ perm.name }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <el-empty v-else description="暂无权限数据" />
      <template #footer>
        <el-button @click="permDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPerms" @click="savePermissions">保存权限</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
</style>
