import { defineStore } from 'pinia';

export const useMainStore = defineStore('main', {
  state: () => ({
    items: [],
    loading: false,
  }),
  actions: {
    addItem(item) {
      this.items.push(item);
    },
    setLoading(val) {
      this.loading = val;
    },
  },
});
