(ns note.note)

(defn init
  [root-state]
  (js/console.log "init cljs")
  (assoc root-state :initialized true))

(defn reload
  [_root-state]
  (js/console.log "reload cljs"))
