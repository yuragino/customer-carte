import { getYearSettings } from "./common/year-selector.js";
import { signInWithGoogle, initAuthState, signOutGoogle } from "./common/firebase-auth.js";
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    user: null,

    init() {
      this.initYearSelector();
      initAuthState((firebaseUser) => {
        this.user = firebaseUser;
      });
    },

    login() {
      signInWithGoogle();
    },

    logout() {
      signOutGoogle();
    }

  }));
});
