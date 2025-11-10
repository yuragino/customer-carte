ログインなどの機能をつけたい場合　index.htmlなど
js側に以下を記述
import { setupAuth } from "../common/utils/auth-utils.js";
import { signInWithGoogle } from "../common/firebase-auth.js";
init()内に      setupAuth(this);
    login() {
      signInWithGoogle();
    },

フォーム画面では書き込み権限を持たせる必要がある。
import { setupAuth } from "../common/utils/auth-utils.js";
init()内に      setupAuth(this);
