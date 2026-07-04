<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useContractStore } from '@/stores/contract';
import { ElMessage, ElMessageBox } from 'element-plus';
import AuditDialog from './components/AuditDialog.vue';

const router = useRouter();
const store = useContractStore();

const searchForm = ref({
  customer_name: '',
  contract_no: '',
  status: '',
});

const auditContractId = ref(0);
const auditVisible = ref(false);

const statusMap: Record<string, { label: string; type: string }> = {
  draft: { label: '草稿', type: 'info' },
  pending: { label: '待评审', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  returned: { label: '已退回', type: 'danger' },
  production: { label: '生产中', type: 'primary' },
  shipped: { label: '已发货', type: '' },
  installing: { label: '待交付', type: 'warning' },
  delivered: { label: '已完成', type: 'success' },
  cancelled: { label: '已作废', type: 'danger' },
};

onMounted(() => store.fetchList());

const handleSearch = () => {
  store.fetchList(searchForm.value);
};

const resetSearch = () => {
  searchForm.value = { customer_name: '', contract_no: '', status: '' };
  store.fetchList();
};

const handleCreate = () => {
  router.push('/contracts/create');
};

const handleSubmit = async (id: number) => {
  await store.submit(id);
  ElMessage.success('已提交审核');
  store.fetchList();
};

const handleAudit = (id: number) => {
  auditContractId.value = id;
  auditVisible.value = true;
};

const handleChange = (id: number) => {
  router.push(`/contracts/${id}/edit?mode=change`);
};

const handleComplete = async (id: number) => {
  await ElMessageBox.confirm('确认该合同已完成交付？');
  await store.completeContract(id);
  ElMessage.success('交付确认成功');
  store.fetchList();
};
</script>

<template>
  <div>
    <h2>合同管理</h2>
    <el-form :inline="true" :model="searchForm" class="search-form">
      <el-form-item label="合同号">
        <el-input v-model="searchForm.contract_no" placeholder="合同号" clearable />
      </el-form-item>
      <el-form-item label="客户名称">
        <el-input v-model="searchForm.customer_name" placeholder="客户名称" clearable />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="(v, k) in statusMap" :key="k" :label="v.label" :value="k" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </el-form-item>
      <el-form-item>
        <el-button v-permission="'contract:create'" type="success" @click="handleCreate">新建合同</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="store.list" v-loading="store.loading" border stripe>
      <el-table-column prop="contract_no" label="合同号" width="180" />
      <el-table-column prop="customer_name" label="客户名" min-width="150" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="(statusMap[row.status]?.type as any)">
            {{ statusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="销售员" width="100">
        <template #default="{ row }">
          {{ row.submitter?.real_name }}
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="router.push(`/contracts/${row.id}`)">详情</el-button>
          <el-button size="small" v-permission="'contract:submit'"
            v-if="row.status==='draft'" type="primary" @click="handleSubmit(row.id)">提交</el-button>
          <el-button size="small" v-permission="'contract:audit'"
            v-if="row.status==='pending'" type="warning" @click="handleAudit(row.id)">审核</el-button>
          <el-button size="small" v-permission="'contract:change'"
            v-if="row.status!=='cancelled' && row.status!=='delivered'" @click="handleChange(row.id)">变更</el-button>
          <el-button size="small" v-permission="'contract:complete'"
            v-if="row.status==='installing'" type="success" @click="handleComplete(row.id)">交付</el-button>
        </template>
      </el-table-column>
    </el-table>

    <AuditDialog v-model:visible="auditVisible" :contract-id="auditContractId" @success="store.fetchList()" />
  </div>
</template>

<style scoped>
.search-form {
  margin-bottom: 16px;
}
</style>
