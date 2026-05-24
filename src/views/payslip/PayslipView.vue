<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApi } from '@/composables/useApi'
import { Card, Badge, Button, SearchableDropdown } from 'ui-assets'

const { t } = useI18n()
const { request } = useApi()

const generating = ref(false)
const showPayslip = ref(false)
const selectedTailor = ref('')
const startDate = ref('')
const endDate = ref('')
const tailors = ref([])
const payslip = ref(null)

onMounted(async () => {
  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 6)

  endDate.value = today.toISOString().split('T')[0]
  startDate.value = sevenDaysAgo.toISOString().split('T')[0]

  try {
    const res = await request('/tailors?per_page=1000000')
    tailors.value = res.data.map(t => ({ value: t.id, label: t.name }))
  } catch { /* ignore */ }
})

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

function formatDate(dateStr) {
  return dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}

async function generate() {
  if (!selectedTailor.value || !startDate.value || !endDate.value) return
  generating.value = true
  showPayslip.value = false
  try {
    const params = new URLSearchParams({
      tailor_id: selectedTailor.value,
      start_date: startDate.value,
      end_date: endDate.value,
    })
    const res = await request(`/payslips/generate?${params}`)
    payslip.value = res
    showPayslip.value = true
  } catch { /* ignore */ }
  finally {
    generating.value = false
  }
}

function printPayslip() {
  const p = payslip.value
  if (!p) return

  const isWeekMode = p.period.use_weeks
  const cols = p.columns || []
  const colCount = cols.length

  const rows = p.items.map(item => {
    const cells = cols.map(c => {
      const val = item.columns[c.key] || 0
      return `<td class="px-2 py-1.5 text-center border border-surface-300">${val > 0 ? val : '-'}</td>`
    }).join('')
    const deductions = item.repair_charges > 0 ? formatCurrency(item.repair_charges) : '-'
    return `<tr>
      <td class="px-3 py-1.5 text-sm font-medium border border-surface-300">${item.article_name}</td>
      ${cells}
      <td class="px-3 py-1.5 text-sm text-right border border-surface-300">${item.total_qty}</td>
      <td class="px-3 py-1.5 text-sm text-right border border-surface-300">${formatCurrency(item.price_per_pcs)}</td>
      <td class="px-3 py-1.5 text-sm text-right font-semibold border border-surface-300">${formatCurrency(item.earnings)}</td>
      <td class="px-3 py-1.5 text-sm text-right font-semibold border border-surface-300">${deductions}</td>
    </tr>`
  }).join('')

  const colHeaders = cols.map(c => `<th class="px-2 py-1.5 text-center border border-surface-300 text-xs" style="min-width:70px">
    <div>${c.label}</div>
    <div style="font-weight:400;font-size:9px;margin-top:1px">${c.sub_label}</div>
  </th>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${t('payslip.payslip')} - ${p.tailor.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; padding: 20px; }
    .slip { max-width: 700px; margin: 0 auto; border: 1px solid #000; }
    .top-bar { background: #000; color: #fff; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; }
    .top-bar .company { font-size: 16px; font-weight: 700; }
    .top-bar .label { font-size: 10px; opacity: 0.8; margin-top: 2px; }
    .top-bar .right { text-align: right; }
    .top-bar .right .slip-num { font-size: 11px; font-weight: 700; }
    .top-bar .right .slip-label { font-size: 9px; opacity: 0.8; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; }
    .info-block { padding: 8px 12px; border-right: 1px solid #000; }
    .info-block:last-child { border-right: none; }
    .info-row { display: flex; margin-bottom: 3px; }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { font-weight: 700; width: 80px; font-size: 11px; }
    .info-value { font-size: 11px; }
    .period-bar { background: #f2f2f2; border-bottom: 1px solid #000; padding: 6px 12px; display: flex; justify-content: space-between; }
    .period-bar .left { font-weight: 700; font-size: 11px; }
    .period-bar .right { font-size: 11px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead tr { background: #e6e6e6; }
    thead th { padding: 6px 4px; border: 1px solid #000; font-weight: 700; font-size: 10px; }
    tbody td { padding: 5px 4px; border: 1px solid #000; }
    tbody tr:nth-child(even) { background: #fafafa; }
    tfoot tr td { padding: 6px 4px; border: 1px solid #000; font-weight: 700; font-size: 11px; }
    tfoot tr td:first-child { font-weight: 700; }
    .col-emp { text-align: left; }
    .col-qty, .col-price, .col-total { text-align: right; }
    .empty-row td { text-align: center; color: #999; padding: 20px; }
    .bottom { padding: 8px 12px; display: flex; justify-content: space-between; border-top: 1px solid #000; background: #f2f2f2; }
    .bottom .left { font-size: 10px; color: #666; }
    .bottom .right { font-size: 10px; color: #666; }
    .remark { padding: 6px 12px; font-size: 10px; color: #666; border-top: 1px solid #000; }
  </style>
</head>
<body>
  <div class="slip">
    <div class="top-bar">
      <div>
        <div class="company">${t('payslip.printTitle')}</div>
        <div class="label">${t('payslip.printSubtitle')}</div>
      </div>
      <div class="right">
        <div class="slip-num">${t('payslip.payslip')}</div>
        <div class="slip-label">${t('payslip.employeeStatement')}</div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-block">
        <div class="info-row"><span class="info-label">${t('payslip.employee')}</span><span class="info-value">${p.tailor.name}</span></div>
        <div class="info-row"><span class="info-label">${t('payslip.address')}</span><span class="info-value">${p.tailor.address || '-'}</span></div>
        <div class="info-row"><span class="info-label">${t('payslip.phone')}</span><span class="info-value">${p.tailor.phone || '-'}</span></div>
      </div>
      <div class="info-block">
        <div class="info-row"><span class="info-label">${t('payslip.period')}</span><span class="info-value">${p.period.month_label}</span></div>
        <div class="info-row"><span class="info-label">${t('payslip.dateRange')}</span><span class="info-value">${formatDate(p.period.start_date)} — ${formatDate(p.period.end_date)}</span></div>
        <div class="info-row"><span class="info-label">${t('payslip.articles')}</span><span class="info-value">${p.summary.total_articles}</span></div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th class="col-emp" style="width:20%">${t('payslip.articleItem')}</th>
          ${colHeaders}
          <th class="col-qty" style="width:7%">${t('payslip.totalQty')}</th>
          <th class="col-price" style="width:10%">${t('payslip.pricePcs')}</th>
          <th class="col-total" style="width:12%">${t('payslip.earnings')}</th>
          <th class="col-total" style="width:12%">${t('payslip.deductions')}</th>
        </tr>
      </thead>
      <tbody>
        ${p.items.length === 0 ? `<tr class="empty-row"><td colspan="${colCount + 5}">${t('payslip.noProductionData')}</td></tr>` : rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="${colCount + 1}" class="text-right">${t('payslip.grandTotal')}</td>
          <td class="col-qty">${p.summary.total_qty}</td>
          <td></td>
          <td class="col-total" style="font-size:13px">${formatCurrency(p.summary.earnings)}</td>
          <td class="col-total" style="font-size:13px">${p.summary.repair_charges > 0 ? formatCurrency(p.summary.repair_charges) : '-'}</td>
        </tr>
        <tr>
          <td colspan="${colCount + 3}" class="text-right font-bold">${t('payslip.netTotal')}</td>
          <td colspan="2" class="col-total font-bold" style="font-size:13px">${formatCurrency(p.summary.net_total)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="bottom">
      <span class="left">${t('payslip.generated')}: ${formatDate(new Date().toISOString())}</span>
      <span class="right">${t('payslip.footer')}</span>
    </div>
    <div class="remark">${t('payslip.note')}</div>
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=780,height=900')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ t('payslip.title') }}</h1>
        <p class="mt-1 text-sm text-surface-500">{{ t('payslip.description') }}</p>
      </div>
    </div>

    <Card variant="bordered">
      <div class="p-4 flex flex-col sm:flex-row items-start sm:items-end gap-4">
        <div class="w-full sm:max-w-80">
          <label class="block text-sm font-medium text-surface-700 mb-1">{{ t('payslip.tailor') }}</label>
          <SearchableDropdown
            v-model="selectedTailor"
            :options="tailors"
            label=""
            :placeholder="t('payslip.selectTailor')"
            :clearable="true"
          />
        </div>
        <div class="flex">
          <div class="w-full sm:max-w-[160px] mr-5">
            <label class="block text-sm font-medium text-surface-700 mb-1">{{ t('payslip.startDate') }}</label>
            <input v-model="startDate" type="date" class="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          <div class="w-full sm:max-w-[160px]">
            <label class="block text-sm font-medium text-surface-700 mb-1">{{ t('payslip.endDate') }}</label>
            <input v-model="endDate" type="date" class="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
        </div>
        <div class="flex gap-2">
          <Button @click="generate" :loading="generating" :disabled="!selectedTailor || !startDate || !endDate">{{ t('payslip.generate') }}</Button>
          <Button v-if="showPayslip" variant="outline" @click="printPayslip">{{ t('payslip.print') }}</Button>
        </div>
      </div>
    </Card>

    <div v-if="generating" class="flex items-center justify-center py-20">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>

    <div v-else-if="showPayslip && payslip" class="payslip-print">
      <div class="mt-6 bg-white border border-surface-200 rounded-xl shadow-sm overflow-hidden print:border-0 print:shadow-none print:rounded-none">
        <div class="p-6 border-b border-surface-200">
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-xl font-bold text-surface-900">{{ payslip.tailor.name }}</h2>
              <p class="text-sm text-surface-500 mt-0.5">{{ payslip.tailor.phone || '-' }}{{ payslip.tailor.phone && payslip.tailor.address ? ' | ' : '' }}{{ payslip.tailor.address || '' }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold text-surface-800">{{ payslip.period.week_label }}</p>
              <p class="text-sm text-surface-500">{{ formatDate(payslip.period.start_date) }} — {{ formatDate(payslip.period.end_date) }}</p>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-surface-50 border-b border-surface-200">
                <th class="px-4 py-2.5 text-left font-semibold text-surface-700">{{ t('common.article') }}</th>
                <th v-for="c in payslip.columns" :key="c.key" class="px-2 py-2.5 text-center font-semibold text-surface-700 min-w-[60px]">
                  {{ c.label }}<br><span class="text-xs font-normal text-surface-400">{{ c.sub_label }}</span>
                </th>
                <th class="px-3 py-2.5 text-right font-semibold text-surface-700">{{ t('payslip.totalQty') }}</th>
                <th class="px-3 py-2.5 text-right font-semibold text-surface-700">{{ t('payslip.pricePcs') }}</th>
                <th class="px-4 py-2.5 text-right font-semibold text-surface-700">{{ t('payslip.earnings') }}</th>
                <th class="px-4 py-2.5 text-right font-semibold text-surface-700">{{ t('payslip.deductions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="payslip.items.length === 0">
                <td :colspan="payslip.columns.length + 5" class="px-4 py-8 text-center text-surface-400">{{ t('payslip.noData') }}</td>
              </tr>
              <tr v-for="item in payslip.items" :key="item.article_id" class="border-b border-surface-100 hover:bg-surface-50">
                <td class="px-4 py-2.5 font-medium text-surface-800 whitespace-nowrap">{{ item.article_name }}</td>
                <td v-for="c in payslip.columns" :key="c.key" class="px-2 py-2.5 text-center">
                  <span v-if="item.columns[c.key] > 0" class="font-medium text-surface-800">{{ item.columns[c.key] }}</span>
                  <span v-else class="text-surface-300">-</span>
                </td>
                <td class="px-3 py-2.5 text-right font-medium">{{ item.total_qty }}</td>
                <td class="px-3 py-2.5 text-right">{{ formatCurrency(item.price_per_pcs) }}</td>
                <td class="px-4 py-2.5 text-right font-semibold text-green-600">{{ formatCurrency(item.earnings) }}</td>
                <td class="px-4 py-2.5 text-right font-semibold text-red-600">{{ item.repair_charges > 0 ? formatCurrency(item.repair_charges) : '-' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-surface-50 border-t-2 border-surface-300">
                <td class="px-4 py-3 font-bold text-surface-900" :colspan="payslip.columns.length + 1">{{ t('payslip.grandTotal') }}</td>
                <td class="px-3 py-3 text-right font-bold text-surface-900">{{ payslip.summary.total_qty }}</td>
                <td class="px-3 py-3"></td>
                <td class="px-4 py-3 text-right font-bold text-lg text-green-600">{{ formatCurrency(payslip.summary.earnings) }}</td>
                <td class="px-4 py-3 text-right font-bold text-lg text-red-600">{{ payslip.summary.repair_charges > 0 ? formatCurrency(payslip.summary.repair_charges) : '-' }}</td>
              </tr>
              <tr class="bg-surface-100">
                <td :colspan="payslip.columns.length + 3" class="px-4 py-2 text-right font-bold text-surface-900">{{ t('payslip.netTotal') }}</td>
                <td colspan="2" class="px-4 py-2 text-right font-bold text-lg text-surface-900">{{ formatCurrency(payslip.summary.net_total) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="p-6 bg-surface-50 border-t border-surface-200 flex justify-end">
          <div class="text-right">
            <p class="text-xs text-surface-400">{{ t('payslip.generatedOn') }} {{ formatDate(new Date().toISOString()) }}</p>
            <p class="text-xs text-surface-400">{{ t('payslip.footer') }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="mt-12 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-surface-100 rounded-full mb-4">
        <svg class="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p class="text-surface-500">{{ t('payslip.emptyState') }}</p>
    </div>
  </div>
</template>

<style>
@page { margin: 15mm; size: A4; }
</style>
