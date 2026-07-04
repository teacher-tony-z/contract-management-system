import type { Router } from 'vue-router';
import { useUserStore } from '@/stores/user';

export function setupPermissionGuard(router: Router) {
  router.beforeEach((to, _from, next) => {
    const userStore = useUserStore();
    userStore.restoreSession();

    if (to.path === '/login') return next();

    if (!userStore.isLoggedIn()) return next('/login');

    const permission = to.meta.permission as string;
    if (permission && !userStore.hasPermission(permission)) {
      return next('/403');
    }

    next();
  });
}
