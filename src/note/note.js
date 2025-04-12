import { createRoot } from "react-dom/client"
import * as note from "#cljs/note/note.js"
import * as editor from "#js/note/editor.jsx"
import "./note.css"

if (module.hot) {
    module.hot.accept()
}

function main() {
    window.ROOT_STATE = window.ROOT_STATE || {}
    if (module.hot && window.ROOT_STATE.initialized) {
        console.log("hot reload app")
        note.reload(ROOT_STATE)
    } else {
        console.log("init app")
        window.ROOT_STATE = note.init(ROOT_STATE)
    }
    
    const rootNode = document.getElementById("root-node")
    const reactRoot = createRoot(rootNode)

    reactRoot.render(editor.render())
}

main()
