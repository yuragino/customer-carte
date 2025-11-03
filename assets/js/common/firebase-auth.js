import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Googleでログイン
export function signInWithGoogle() {
  return signInWithPopup(auth, provider)
    .then((result) => {
      console.log("ログイン成功:", result.user);
      return result.user;
    })
    .catch((error) => {
      console.error("ログイン失敗:", error);
      alert("ログインに失敗しました: " + error.message);
    });
}

// ログイン状態監視
export function initAuthState(callback) {
  onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

export function signOutGoogle() {
  return signOut(auth)
    .then(() => {
      console.log("ログアウトしました");
      alert("ログアウトしました");
    })
    .catch((error) => {
      console.error("ログアウト失敗:", error);
      alert("ログアウトに失敗しました: " + error.message);
    });
}
