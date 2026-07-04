<script setup lang="ts">
import { useUserStore } from '@/stores/user';
import { useAppStore } from '@/stores/app';
import { Expand, Fold } from '@element-plus/icons-vue';

const userStore = useUserStore();
const appStore = useAppStore();

const handleLogout = () => {
  userStore.logout();
};

const toggleSidebar = () => {
  appStore.toggleSidebar();
};
</script>

<template>
  <div class="navbar">
    <div class="navbar-left">
      <el-icon class="navbar-fold" @click="toggleSidebar" style="cursor:pointer; font-size:20px;">
        <component :is="appStore.sidebarCollapsed ? Expand : Fold" />
      </el-icon>
      <span class="navbar-title">合同管理系统</span>
    </div>
    <div class="navbar-right">
      <span class="navbar-user">{{ userStore.userInfo?.real_name || '未登录' }}</span>
      <el-button type="danger" size="small" @click="handleLogout">退出登录</el-button>
    </div>
  </div>
</template>

<style scoped>
.navbar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
  flex-shrink: 0;
}
.navbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.navbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.navbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.navbar-user {
  color: #606266;
  font-size: 14px;
}
</style>
