import type { App, Directive } from 'vue';
import { useUserStore } from '@/stores/user';

const permissionDirective: Directive = {
  mounted(el: HTMLElement, binding) {
    const userStore = useUserStore();
    const permissionCode = binding.value as string;
    if (permissionCode && !userStore.hasPermission(permissionCode)) {
      el.style.display = 'none';
    }
  },
};

export function setupPermission(app: App) {
  app.directive('permission', permissionDirective);
}
