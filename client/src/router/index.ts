import { createRouter, createWebHistory } from 'vue-router';
import Layout from '@/views/layout/Layout.vue';

const routes = [
  { path: '/login', component: () => import('@/views/login/LoginPage.vue') },
  {
    path: '/',
    component: Layout,
    redirect: '/contracts',
    meta: { requiresAuth: true },
    children: [
      // 合同管理
      { path: 'contracts', component: () => import('@/views/contract/ContractList.vue'), meta: { permission: 'contract:view' } },
      { path: 'contracts/create', component: () => import('@/views/contract/ContractForm.vue'), meta: { permission: 'contract:create' } },
      { path: 'contracts/:id', component: () => import('@/views/contract/ContractDetail.vue'), meta: { permission: 'contract:view' } },
      { path: 'contracts/:id/edit', component: () => import('@/views/contract/ContractForm.vue'), meta: { permission: 'contract:edit' } },
      // 生产管理
      { path: 'production', component: () => import('@/views/production/ProductionList.vue'), meta: { permission: 'production:view' } },
      { path: 'production/:id', component: () => import('@/views/production/ProductionDetail.vue'), meta: { permission: 'production:view' } },
      // 库存
      { path: 'inventory', component: () => import('@/views/inventory/InventoryList.vue'), meta: { permission: 'inventory:view' } },
      // 交付
      { path: 'delivery', component: () => import('@/views/delivery/DeliveryList.vue'), meta: { permission: 'delivery:ship' } },
      { path: 'delivery/create', component: () => import('@/views/delivery/DeliveryForm.vue'), meta: { permission: 'delivery:ship' } },
      { path: 'delivery/:id', component: () => import('@/views/delivery/DeliveryDetail.vue'), meta: { permission: 'delivery:ship' } },
      // 系统管理
      { path: 'users', component: () => import('@/views/system/UserList.vue'), meta: { permission: 'system:admin' } },
      { path: 'roles', component: () => import('@/views/system/RoleList.vue'), meta: { permission: 'system:admin' } },
      { path: 'products', component: () => import('@/views/product/ProductList.vue'), meta: { permission: 'product:manage' } },
    ],
  },
  { path: '/403', component: () => import('@/views/error/403.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/error/404.vue') },
];

const router = createRouter({ history: createWebHistory(), routes });

export default router;
