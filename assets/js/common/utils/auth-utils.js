import { initAuthState } from "../firebase-auth.js";

export function setupAuth(context) {
  context.isLoggedIn = false;
  context.user = null;

  initAuthState((user) => {
    context.isLoggedIn = Boolean(user);
    context.user = user;
    if (!user) {
      window.location.href = '../index.html';
    }
  });
}
