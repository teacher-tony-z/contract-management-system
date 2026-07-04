import { defineStore } from 'pinia';
import { ref } from 'vue';
import request from '@/utils/request';

export const useProductionStore = defineStore('production', () => {
  const list = ref<any[]>([]);
  const current = ref<any>(null);

  async function fetchList() {
    const res = await request.get('/production');
    list.value = res.data;
  }

  async function fetchById(id: number) {
    const res = await request.get(`/production/${id}`);
    current.value = res.data;
    return res.data;
  }

  async function create(contractId: number) {
    return request.post('/production', { contract_id: contractId });
  }

  async function start(id: number) {
    return request.put(`/production/${id}/start`);
  }

  async function complete(id: number) {
    return request.put(`/production/${id}/complete`);
  }

  async function qc(id: number, action: string, remark?: string) {
    return request.put(`/production/${id}/qc`, { action, remark });
  }

  return { list, current, fetchList, fetchById, create, start, complete, qc };
});
