type Snackbar = {
  text: string;
  show: boolean;
  color?: 'success' | 'error';
};

type AppStoreState = {
  dateFormat: string;
  dateApiFormat: string;
  dateApiSendFormat: string;
  snackbars: Snackbar[];
};

export const useStore = defineStore("store", {
  state: (): AppStoreState => ({
    dateFormat: "dd.MM.yyyy",
    dateApiFormat: "MM-dd-yyyy",
    dateApiSendFormat: "yyyy-MM-dd'T'00:00:00.000'Z'",
    snackbars: [],
  }),
  actions: {
    async addSnackbar(snackbar: Omit<Snackbar, 'show'> & Partial<Pick<Snackbar, 'show'>>) {
      this.snackbars.push(Object.assign({
        show: true,
      }, snackbar));
    },
  },
});
