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
        const snap = await getDocs(
          query(collection(db, RESERVATION_COLLECTION), orderBy("date", "asc"))
        );
        const allReservations = snap.docs.map(doc => ({
          docId: doc.id,
          ...doc.data(),
        }));
        const today = new Date().toISOString().split('T')[0];
        const upcoming = allReservations.filter(r => r.date > today);
        const past = allReservations.filter(r => r.date < today);
        this.reservations = upcoming.concat(past);
      } catch (e) {
        handleError("予約データ読込", e);
      }
    },

  }));
});
