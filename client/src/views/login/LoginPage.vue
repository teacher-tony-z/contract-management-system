<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { ElMessage } from 'element-plus';
import { UserFilled, Lock } from '@element-plus/icons-vue';

const router = useRouter();
const userStore = useUserStore();
const form = ref({ username: '', password: '' });
const loading = ref(false);

const handleLogin = async () => {
  loading.value = true;
  try {
    await userStore.login(form.value.username, form.value.password);
    ElMessage.success('登录成功');
    router.push('/');
  } catch {
    // 错误由 axios 拦截器处理
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h2 class="login-title">合同管理系统</h2>
      <el-form :model="form" @keyup.enter="handleLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="UserFilled" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" show-password :prefix-icon="Lock" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width:100%" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,.1);
}
.login-title {
  text-align: center;
  margin-bottom: 30px;
  color: #303133;
}
</style>
