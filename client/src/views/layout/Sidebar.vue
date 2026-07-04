<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { useAppStore } from '@/stores/app';
import {
  Document, Tools, Box, Van, User, Setting, Goods,
} from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const appStore = useAppStore();

const menuItems = computed(() => {
  const items: { path: string; title: string; icon: unknown }[] = [];
  const roles = userStore.userInfo?.roles ?? [];

  items.push({ path: '/contracts', title: '合同管理', icon: Document });

  if (roles.some((r: string) => ['管理员', '生产'].includes(r))) {
    items.push({ path: '/production', title: '生产管理', icon: Tools });
    items.push({ path: '/inventory', title: '库存管理', icon: Box });
    items.push({ path: '/delivery', title: '交付管理', icon: Van });
  }
  if (roles.some((r: string) => ['管理员'].includes(r))) {
    items.push({ path: '/users', title: '用户管理', icon: User });
    items.push({ path: '/roles', title: '角色管理', icon: Setting });
    items.push({ path: '/products', title: '产品目录', icon: Goods });
  }
  return items;
});

const handleMenuSelect = (index: string) => {
  router.push(index);
};

</script>

<template>
  <div class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed }">
    <div class="sidebar-logo">
      <h2 v-show="!appStore.sidebarCollapsed">合同管理系统</h2>
      <h2 v-show="appStore.sidebarCollapsed">CMS</h2>
    </div>
    <el-menu
      :default-active="route.path"
      :collapse="appStore.sidebarCollapsed"
      background-color="#304156"
      text-color="#bfcbd9"
      active-text-color="#409eff"
      @select="handleMenuSelect"
    >
      <el-menu-item
        v-for="item in menuItems"
        :key="item.path"
        :index="item.path"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <template #title>{{ item.title }}</template>
      </el-menu-item>
    </el-menu>
  </div>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 200px;
  background: #304156;
  transition: width 0.3s;
  z-index: 100;
  overflow-y: auto;
}
.sidebar.collapsed {
  width: 64px;
}
.sidebar-logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-bottom: 1px solid rgba(255,255,255,.1);
}
.sidebar-logo h2 {
  font-size: 18px;
  white-space: nowrap;
}
.el-menu {
  border-right: none;
}
</style>
