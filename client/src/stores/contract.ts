import { defineStore } from 'pinia';
import { ref } from 'vue';
import request from '@/utils/request';
import type { Contract } from '@/types';

export const useContractStore = defineStore('contract', () => {
  const list = ref<Contract[]>([]);
  const current = ref<Contract | null>(null);
  const loading = ref(false);

  async function fetchList(params?: Record<string, any>) {
    loading.value = true;
    try {
      const res = await request.get('/contracts', { params });
      list.value = res.data;
    } finally { loading.value = false; }
  }

  async function fetchById(id: number) {
    const res = await request.get(`/contracts/${id}`);
    current.value = res.data;
    return res.data;
  }

  async function create(data: any) {
    const res = await request.post('/contracts', data);
    return res.data;
  }

  async function update(id: number, data: any) {
    const res = await request.put(`/contracts/${id}`, data);
    return res.data;
  }

  async function submit(id: number) {
    return request.post(`/contracts/${id}/submit`);
  }

  async function audit(id: number, action: string, remark?: string) {
    return request.post(`/contracts/${id}/audit`, { action, remark });
  }

  async function changeContract(id: number, data: any) {
    return request.post(`/contracts/${id}/change`, data);
  }

  async function completeContract(id: number) {
    return request.post(`/contracts/${id}/complete`);
  }

  async function terminateContract(id: number) {
    return request.post(`/contracts/${id}/terminate`);
  }

  return {
    list, current, loading,
    fetchList, fetchById, create, update,
    submit, audit, changeContract, completeContract, terminateContract,
  };
});
