<script setup lang="ts">
import Sidebar from './Sidebar.vue';
import Navbar from './Navbar.vue';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
</script>

<template>
  <div class="layout-container">
    <Sidebar />
    <div class="layout-main" :style="{ marginLeft: appStore.sidebarCollapsed ? '64px' : '200px' }">
      <Navbar />
      <div class="layout-content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout-container {
  height: 100vh;
  display: flex;
}
.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s;
}
.layout-content {
  flex: 1;
  padding: 20px;
  background: #f0f2f5;
  overflow-y: auto;
}
</style>
