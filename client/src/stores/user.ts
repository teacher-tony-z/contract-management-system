import { defineStore } from 'pinia';
import { ref } from 'vue';
import request from '@/utils/request';
import router from '@/router';
import type { UserInfo, LoginResult } from '@/types';

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '');
  const userInfo = ref<UserInfo | null>(null);

  const isLoggedIn = () => !!token.value;

  const login = async (username: string, password: string) => {
    const res = await request.post<LoginResult>('/auth/login', { username, password });
    token.value = res.data.access_token;
    userInfo.value = res.data.user;
    localStorage.setItem('token', res.data.access_token);
    localStorage.setItem('userInfo', JSON.stringify(res.data.user));
  };

  const logout = () => {
    token.value = '';
    userInfo.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    router.push('/login');
  };

  const restoreSession = () => {
    const stored = localStorage.getItem('userInfo');
    if (stored) userInfo.value = JSON.parse(stored);
  };

  const hasPermission = (code: string) => {
    return userInfo.value?.permissions?.includes(code) ?? false;
  };

  return { token, userInfo, login, logout, isLoggedIn, restoreSession, hasPermission };
});
