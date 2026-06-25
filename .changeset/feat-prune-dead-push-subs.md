---
"vike-push": minor
---

Prune dead push subscriptions on a 404/410 instead of retrying forever. The Web Push transport now flags a permanently-gone subscription (`err.subscriptionGone`), and vike-push deletes that subscription's row rather than retrying a send that can never succeed. Transient push-service failures still retry through vike-queue as before. A custom transport can opt into the same pruning by flagging its error the same way.
