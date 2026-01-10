export const CLOUDINARY_CONFIG = {
  CLOUD_NAME: 'dxq1xqypx',
  UPLOAD_PRESET: 'unsigned_preset',
};

export const CASUAL_PRICES = {
  RENTAL_DRESSING: 6800,
  DRESSING_ONLY: 3800,
  FOOTWEAR: 500,
  BAG: 500,
};

export const STATUS_MAP = {
  nextStatusMap: {
    '受付開始': '着付開始',
    '着付開始': '着付完了',
    '着付完了': '見送り完了',
    '見送り完了': '済',
  },
  statusToTimestampKey: {
    '受付開始': 'receptionStartedAt',
    '着付開始': 'dressingStartedAt',
    '着付完了': 'dressingCompletedAt',
    '見送り完了': 'sendOffCompletedAt',
  },
  getStatusClass(status) {
    const current = status ?? '受付開始';
    return {
      '受付開始': 'status-reception-started',
      '着付開始': 'status-dressing-started',
      '着付完了': 'status-dressing-completed',
      '見送り完了': 'status-sendoff-completed',
      '済': 'status-finished',
    }[current] ?? 'status-reception-started';
  }
};
