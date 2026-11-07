<template>
  <div class="report-chart bg-slate-600 rounded-lg">
    <Line :options="chartOptions" :data="chartData" :aria-label="`Verbrauchsverlauf in ${unit}`" />
  </div>
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs'
import { useDisplay } from 'vuetify'
import { Chart as ChartJS, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, LinearScale } from 'chart.js'
import 'chartjs-adapter-date-fns'
import type { Note } from '@/api/notes'
import type { ReportRow } from '@/api/reports'
import { buildReportChartData, buildReportChartOptions } from '@/features/report/chartData'

const store = useStore()
const { xs } = useDisplay()

const props = defineProps<{
  reportData: { data: ReportRow[]; notes: Note[] };
  unit: string;
}>()

ChartJS.register(Title, Tooltip, Legend, PointElement, LineElement, TimeScale, LinearScale)
ChartJS.defaults.color = "lightgray";

const chartData = computed(() => buildReportChartData(props.reportData.data, props.reportData.notes));

const chartOptions = computed(() => buildReportChartOptions(props.unit, store.dateFormat, xs.value));
</script>

<style scoped>
.report-chart {
  position: relative;
  width: 100%;
  min-width: 0;
  height: clamp(360px, 60vh, 640px);
  height: clamp(360px, 60svh, 640px);
  padding: 12px;
}

@media (max-width: 599px) {
  .report-chart {
    padding: 8px;
  }
}
</style>
