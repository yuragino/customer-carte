export const CLOUDINARY_CONFIG = {
  CLOUD_NAME: 'dxq1xqypx',
  UPLOAD_PRESET: 'unsigned_preset',
};

export const SEIJINSHIKI_PRICES = {
  FURISODE: {
    KITSUKE: { MAEDORI: 13200, TOUJITSU: 16500, BOTH: 25300 },
    HAIR_MAKE: 10000,
    HAIR_ONLY: 6000,
  },
  HAKAMA: {
    KITSUKE: { MAEDORI: 8500, TOUJITSU: 8500, BOTH: 17000 }
  }
};

export const OUTFIT_KEY_MAP = {
  "振袖": "FURISODE",
  "袴": "HAKAMA"
}

export const CASUAL_PRICES = {
  RENTAL_DRESSING: 6800,
  DRESSING_ONLY: 3800,
  FOOTWEAR: 500,
  BAG: 500,
};

export const STATUS_MAP = {
  nextStatusMap: {
    '受付完了': '案内完了',
    '案内完了': '着付完了',
    '着付完了': '見送り完了',
    '見送り完了': '済',
  },
  statusToTimestampKey: {
    '受付完了': 'receptionCompletedAt',
    '案内完了': 'guidanceCompletedAt',
    '着付完了': 'dressingCompletedAt',
    '見送り完了': 'sendOffCompletedAt',
  },
  getStatusClass(status) {
    const current = status ?? '受付完了';
    return {
      '受付完了': 'status-received',
      '案内完了': 'status-guided',
      '着付完了': 'status-dressing-done',
      '見送り完了': 'status-sent-off',
      '済': 'status-completed',
    }[current] ?? 'status-received';
  }
};
