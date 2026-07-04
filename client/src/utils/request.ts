import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';

const request = axios.create({ baseURL: '/api', timeout: 15000 });

// 请求拦截器：自动携带 JWT
request.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截器：统一错误处理
request.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      router.push('/login');
    } else if (error.response?.status === 403) {
      ElMessage.error('没有操作权限');
    } else {
      ElMessage.error(error.response?.data?.message || '请求失败');
    }
    return Promise.reject(error);
  },
);

export default request;
