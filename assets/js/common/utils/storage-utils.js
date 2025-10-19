export const storage = {
  save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  load(key, defaultValue = null) {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  },
  remove(key) {
    localStorage.removeItem(key);
  },
  clear() {
    localStorage.clear();
  }
};
