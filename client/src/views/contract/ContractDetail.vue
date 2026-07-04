<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';
import { useContractStore } from '@/stores/contract';
import ContractTimeline from './components/ContractTimeline.vue';
import AuditDialog from './components/AuditDialog.vue';

const route = useRoute();
const router = useRouter();
const store = useContractStore();
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

const handleSubmit = async () => {
  await store.submit(store.current!.id);
  ElMessage.success('已提交审核');
  store.fetchById(store.current!.id);
};

const handleChange = () => {
  router.push(`/contracts/${route.params.id}/edit?mode=change`);
};

const handleComplete = async () => {
  await ElMessageBox.confirm('确认完成交付？');
  await store.completeContract(store.current!.id);
  ElMessage.success('交付确认成功');
  store.fetchById(store.current!.id);
};

const handleTerminate = async () => {
  await ElMessageBox.confirm('确认终止此合同？此操作不可撤销。', '警告', { type: 'warning' });
  await store.terminateContract(store.current!.id);
  ElMessage.success('合同已终止');
  store.fetchById(store.current!.id);
};

// ===== 附件管理 =====
const attachments = ref<any[]>([]);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();

const loadAttachments = async () => {
  try {
    const res = await request.get(`/contracts/${route.params.id}/attachments`);
    attachments.value = res.data;
  } catch { /* ignore */ }
};

const triggerUpload = () => fileInput.value?.click();

const handleFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  const file = input.files[0];
  if (file.size > 20 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 20MB');
    return;
  }
  uploading.value = true;
  try {
    const form = new FormData();
    form.append('file', file);
    await request.post(`/contracts/${route.params.id}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success('上传成功');
    input.value = '' as any;
    await loadAttachments();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '上传失败');
  } finally {
    uploading.value = false;
  }
};

const downloadAttachment = async (att: any) => {
  try {
    const res = await request.get(`/contracts/attachments/${att.id}/download`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.file_name;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    ElMessage.error('下载失败');
  }
};

const deleteAttachment = async (att: any) => {
  await ElMessageBox.confirm(`确认删除附件「${att.file_name}」？`, '提示');
  await request.delete(`/contracts/attachments/${att.id}`);
  ElMessage.success('已删除');
  await loadAttachments();
};

onMounted(async () => {
  await store.fetchById(Number(route.params.id));
  await loadAttachments();
});
</script>

<template>
  <div v-if="store.current" class="contract-detail">
    <div class="detail-header">
      <el-button @click="router.push('/contracts')" text>
        <el-icon><ArrowLeft /></el-icon>返回列表
      </el-button>
      <h2>{{ store.current.contract_no }}</h2>
      <el-tag :type="(statusMap[store.current.status]?.type as any)">
        {{ statusMap[store.current.status]?.label }}
      </el-tag>
      <div class="header-actions">
        <el-button v-permission="'contract:submit'" v-if="store.current.status==='draft'" type="primary" @click="handleSubmit">提交审核</el-button>
        <el-button v-permission="'contract:audit'" v-if="store.current.status==='pending'" type="warning" @click="auditVisible=true">审核</el-button>
        <el-button v-permission="'contract:edit'" v-if="store.current.status==='draft'" @click="router.push(`/contracts/${store.current.id}/edit`)">编辑</el-button>
        <el-button v-permission="'contract:change'" v-if="!['cancelled','delivered'].includes(store.current.status)" @click="handleChange">变更</el-button>
        <el-button v-permission="'contract:complete'" v-if="store.current.status==='installing'" type="success" @click="handleComplete">交付确认</el-button>
        <el-button v-permission="'contract:terminate'" v-if="!['delivered','cancelled'].includes(store.current.status)" type="danger" @click="handleTerminate">终止</el-button>
      </div>
    </div>

    <el-card class="detail-card">
      <template #header>客户信息</template>
      <el-descriptions :column="2">
        <el-descriptions-item label="客户名称">{{ store.current.customer_name }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ store.current.customer_phone }}</el-descriptions-item>
        <el-descriptions-item label="交付地址" :span="2">{{ store.current.customer_address }}</el-descriptions-item>
        <el-descriptions-item label="销售员">{{ store.current.submitter?.real_name }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ store.current.created_at }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="detail-card">
      <template #header>设备清单</template>
      <el-table :data="store.current.items" border>
        <el-table-column prop="product?.model" label="产品型号" />
        <el-table-column prop="product?.name" label="产品名称" />
        <el-table-column prop="quantity" label="数量" width="100" />
        <el-table-column prop="remark" label="备注" />
      </el-table>
    </el-card>

    <el-card class="detail-card">
      <template #header>操作记录</template>
      <ContractTimeline :contract-id="store.current.id" />
    </el-card>

    <el-card class="detail-card">
      <template #header>
        <div class="card-header">
          <span>附件文件</span>
          <el-button v-permission="'contract:edit'" type="primary" size="small" @click="triggerUpload" :loading="uploading">
            <el-icon><Upload /></el-icon>上传文件
          </el-button>
        </div>
      </template>
      <input ref="fileInput" type="file" style="display:none" @change="handleFileChange" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.zip" />
      <el-table v-if="attachments.length" :data="attachments" border stripe>
        <el-table-column label="文件名" min-width="200">
          <template #default="{ row }">
            <el-icon style="margin-right:4px"><Document /></el-icon>{{ row.file_name }}
          </template>
        </el-table-column>
        <el-table-column label="上传人" width="130" prop="uploader?.real_name" />
        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">{{ row.createdAt?.slice(0,16)?.replace('T',' ') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="downloadAttachment(row)">
              <el-icon><Download /></el-icon>下载
            </el-button>
            <el-button v-permission="'contract:edit'" text type="danger" size="small" @click="deleteAttachment(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无附件" :image-size="80" />
    </el-card>

    <AuditDialog v-model:visible="auditVisible" :contract-id="store.current.id" @success="store.fetchById(store.current!.id)" />
  </div>
</template>

<style scoped>
.detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.header-actions { margin-left: auto; display: flex; gap: 8px; }
.detail-card { margin-bottom: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
</style>
