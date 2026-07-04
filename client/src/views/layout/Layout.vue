<script setup lang="ts">
import Sidebar from './Sidebar.vue';
import Navbar from './Navbar.vue';
</script>

<template>
  <div class="layout-container">
    <Sidebar />
    <div class="layout-main">
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
  margin-left: 200px;
  transition: margin-left 0.3s;
}
.layout-content {
  flex: 1;
  padding: 20px;
  background: #f0f2f5;
  overflow-y: auto;
}
</style>
