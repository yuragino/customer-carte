import { db } from "../common/firebase-config.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { formatDateOnly, formatTime } from "../common/utils/format-utils.js";
const RESERVATION_COLLECTION = "generalReservations";
document.addEventListener("alpine:init", () => {
  Alpine.data("app", () => ({
    formatDateOnly,
    formatTime,
    reservations: [],
    isLoading: false,

    async init() {
      setupAuth(this);
      this.isLoading = true;
      await this.loadReservations();
      this.isLoading = false;
    },

    async loadReservations() {
      try {
        // Firestoreから日付の新しい順で予約を取得
        const snap = await getDocs(
          query(collection(db, RESERVATION_COLLECTION), orderBy("date", "desc"))
        );

        this.reservations = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        handleError("予約データ読込", e);
      }
    },

  }));
});
