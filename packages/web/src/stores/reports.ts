export const useReportStore = defineStore("reports", {
  state: (): {
    selectedMeterTypeId: number | null;
    selectedFromDate: Date;
    selectedToDate: Date;
  } => ({
    selectedMeterTypeId: null,
    selectedFromDate: new Date(0),
    selectedToDate: new Date(),
  }),
});
