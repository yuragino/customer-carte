import { firestore } from "/js/firebase.js";
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    pricing: {
      rentalKitsuke: 0,
      kitsukeOnly: 0,
      bag: 0,
      geta: 0,
    },

    init() {
      this.loadPricing();
    },

    async loadPricing() {
      const docRef = firestore.collection('pricing').doc('yukata');
      const doc = await docRef.get();
      this.pricing = {
        rentalKitsuke: doc.data().rentalKitsuke,
        kitsukeOnly: doc.data().kitsukeOnly,
        bag: doc.data().bag,
        geta: doc.data().geta,
      };
    },

    // TODO 編集、追加、削除

  }));
});
// cSpell:ignore kitsuke geta firestore yukata

