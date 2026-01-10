import { getYearSettings } from "./common/year-selector.js";
import { signInWithGoogle, initAuthState, signOutGoogle } from "./common/firebase-auth.js";

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    user: null,
    isLoading: true,

    init() {
      this.initYearSelector();
      // Firebase Auth 状態監視
      initAuthState((firebaseUser) => {
        this.user = firebaseUser;
        this.isLoading = false;
      });
    },

    login() {
      signInWithGoogle();
    },

    logout() {
      confirm("ログアウトしますか?");
      signOutGoogle();
    }
  }));
});
