import React from "react"
import { createPortal } from "react-dom"
import { useAtomValue, Provider } from "jotai"

import { Editor } from "./editor"

function Block({ id }) {
    return <Editor />
}

const BlockMemo = React.memo(Block)

function Portal({ children, container }) {
    return createPortal(children, container)
}

function Portals({ portals: portalsAtom }) {
    const portals = useAtomValue(portalsAtom)
    return <>
        {portals.map(({ entityId, container }) =>
            <Portal key={entityId} container={container}>
                <BlockMemo id={entityId} />
            </Portal>)}
    </>
}

export function App({ store, portals }) {
    return <Provider store={store}>
        <Portals portals={portals} />
    </Provider>
}
