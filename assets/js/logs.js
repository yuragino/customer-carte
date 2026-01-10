import { getAllDocs } from "./common/utils/firestore-utils.js";
import { formatTimestamp } from "./common/utils/format-utils.js";
import { setupAuth } from "./common/utils/auth-utils.js";
const COLLECTION_NAME = "firestore_action_logs";
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    formatTimestamp,
    logs: [],

    async init() {
      setupAuth(this);
      this.logs = (await getAllDocs(COLLECTION_NAME))
        .sort((a, b) => b.timestamp.toMillis?.() - a.timestamp.toMillis?.());
    },

  }));
});

