import React, { useEffect } from "react"
import { createPortal } from "react-dom"
import { createRoot } from "react-dom/client"
import { atom, createStore, useAtomValue, Provider } from "jotai"

import { Editor } from "./editor"

import "./index.css"

function resizeCanvasPlugin(world, commands) {
    const {
        window: view,
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
    } = world

    canvas.width = view.innerWidth
    canvas.height = view.innerHeight

    view.addEventListener('resize', () => {
        canvas.width = view.innerWidth
        canvas.height = view.innerHeight
        commands.draw(canvas, ctx, state)
    })
}

function panCanvasPlugin(world, commands) {
    const {
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state
    } = world

    // Handle panning
    canvas.addEventListener('mousedown', (e) => {
        state.isPanning = true
        state.hasMoved = false // Reset movement tracker
        state.startX = e.clientX
        state.startY = e.clientY
    })

    canvas.addEventListener('mousemove', (e) => {
        if (!state.isPanning) return

        const dx = e.clientX - state.startX
        const dy = e.clientY - state.startY

        // If the movement exceeds the threshold, it's considered a pan
        if (Math.abs(dx) > state.moveThreshold || Math.abs(dy) > state.moveThreshold) {
            state.hasMoved = true
        }

        state.offsetX += dx
        state.offsetY += dy

        state.startX = e.clientX
        state.startY = e.clientY

        requestAnimationFrame(() => {
            commands.draw(canvas, ctx, state)
        })
    })

    canvas.addEventListener('mouseup', (e) => {
        state.isPanning = false

        // Only create an entity if it was a click (no significant movement)
        if (!state.hasMoved) {
            const rect = canvas.getBoundingClientRect()

            // Convert screen coordinates to world coordinates
            const worldX = (e.clientX - rect.left - state.offsetX) / state.scale
            const worldY = (e.clientY - rect.top - state.offsetY) / state.scale

            const entityId = commands.uuid()
            const portal = createEntityAtWorldPosition(world, entityId, worldX, worldY)
            commands.addPortal(entityId, portal)
            commands.draw(canvas, ctx, state)
        }
    })
}

function zoomCanvasPlugin(world, commands) {
    const {
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
        window: view,
    } = world

    // Handle zooming
    canvas.addEventListener('wheel', (e) => {
        const { scale } = state

        const zoomAmount = e.deltaY * -0.001
        const newScale = scale + zoomAmount

        if (newScale < 0.1 || newScale > 10) return // Prevent too much zoom in/out

        // Get the mouse position relative to the canvas
        const rect = canvas.getBoundingClientRect()
        const mouseX = (e.clientX - rect.left) // Mouse position relative to canvas
        const mouseY = (e.clientY - rect.top)

        // Convert mouse position to world space
        const worldX = (mouseX - state.offsetX) / scale
        const worldY = (mouseY - state.offsetY) / scale

        // Adjust offset to keep the zoom centered around the mouse
        state.offsetX -= (worldX * newScale - worldX * scale)
        state.offsetY -= (worldY * newScale - worldY * scale)

        state.scale = newScale
        view.document.body.style.setProperty('--element-scale', `${newScale}`)

        commands.draw(canvas, ctx, state)
    })
}

// Redraw canvas
function draw(canvas, ctx, state) {
    const { scale, offsetX, offsetY } = state

    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY) // Apply pan and zoom
    ctx.clearRect(-offsetX / scale, -offsetY / scale, canvas.width / scale, canvas.height / scale)

    // Draw dots instead of grid
    drawDots(canvas, ctx, state)

    // Draw arrows connecting circles
    drawArrows(ctx, state)

    // Update positions of HTML elements
    updateElementPositions(state)
}

// New function to draw dots
function drawDots(canvas, ctx, state) {
    const { scale, offsetX, offsetY } = state

    const gridSize = 50; // Size of grid cells
    const dotRadius = 1; // Size of the dots
    const startX = Math.floor((-offsetX / scale) / gridSize) * gridSize
    const startY = Math.floor((-offsetY / scale) / gridSize) * gridSize

    ctx.fillStyle = '#ddd'

    // Draw dots at grid intersections
    for (let x = startX; x < canvas.width / scale - offsetX / scale; x += gridSize) {
        for (let y = startY; y < canvas.height / scale - offsetY / scale; y += gridSize) {
            ctx.beginPath()
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
            ctx.fill()
        }
    }
}

function drawGrid(canvas, ctx, state) {
    const { scale, offsetX, offsetY } = state

    const gridSize = 50; // Size of grid cells
    const startX = Math.floor((-offsetX / scale) / gridSize) * gridSize
    const startY = Math.floor((-offsetY / scale) / gridSize) * gridSize

    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 0.5

    for (let x = startX; x < canvas.width / scale - offsetX / scale; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, -offsetY / scale)
        ctx.lineTo(x, (canvas.height - offsetY) / scale)
        ctx.stroke()
    }

    for (let y = startY; y < canvas.height / scale - offsetY / scale; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(-offsetX / scale, y)
        ctx.lineTo((canvas.width - offsetX) / scale, y)
        ctx.stroke()
    }
}

// Draw arrows connecting the circles
function drawArrows(ctx, state) {
    const { entityIds, entities } = state;

    if (entityIds.length < 2) return;

    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'blue';

    for (let i = 0; i < entityIds.length - 1; i++) {
        const start = entities[entityIds[i]];
        const end = entities[entityIds[i + 1]];

        // Calculate control point for the curve (midpoint with an offset)
        const midX = (start.worldX + end.worldX) / 2;
        const midY = (start.worldY + end.worldY) / 2;
        const controlX = midX + (end.worldY - start.worldY) * 0.3; // Adjust curvature
        const controlY = midY - (end.worldX - start.worldX) * 0.3;

        // Draw the arrow curve
        ctx.beginPath();
        ctx.moveTo(start.worldX, start.worldY); // Start point in world space
        ctx.quadraticCurveTo(controlX, controlY, end.worldX, end.worldY); // Control and end point in world space
        ctx.stroke();

        // Draw arrowhead at the end
        drawArrowhead(ctx, state, end.worldX, end.worldY, controlX, controlY);
    }
}

// Draw an arrowhead at the end of a line
function drawArrowhead(ctx, state, x, y, fromX, fromY) {
    const { scale } = state

    const angle = Math.atan2(y - fromY, x - fromX);
    const size = 10 / scale; // Arrowhead size scales with zoom

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * Math.cos(angle - Math.PI / 6), y - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x - size * Math.cos(angle + Math.PI / 6), y - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function makeEntityElement(entityId, worldX, worldY) {
    const div = document.createElement('div')
    div.classList.add('world-element')
    div.id = `entity-${entityId}`
    div.dataset.entityId = entityId
    div.dataset.worldX = worldX
    div.dataset.worldY = worldY
    return div
}

// Create an HTML element at the given world position
function createEntityAtWorldPosition(world, entityId, worldX, worldY) {
    const { canvasState: state, window: view } = world
    const element = makeEntityElement(entityId, worldX, worldY)

    // Convert world coordinates to screen coordinates
    const screenX = worldX * state.scale + state.offsetX
    const screenY = worldY * state.scale + state.offsetY

    setElementPosition(element, screenX, screenY)
    view.document.body.appendChild(element)

    // Store entity in state
    state.entities[entityId] = { worldX, worldY, entityId }
    state.entityIds.push(entityId)

    // Update its position immediately
    updateElementPositions(state)

    return element
}

// Update positions of HTML elements based on transformations
function updateElementPositions(state) {
    for (const entityId of state.entityIds) {
        const element = document.getElementById(`entity-${entityId}`);
        const entity = state.entities[entityId];
        if (element && entity) {
            const { scale, offsetX, offsetY } = state;
            const screenX = entity.worldX * scale + offsetX;
            const screenY = entity.worldY * scale + offsetY;
            setElementPosition(element, screenX, screenY);
        }
    }
}

function setElementPosition(element, screenX, screenY) {
    element.style.setProperty('--element-screenX', `${screenX}px`)
    element.style.setProperty('--element-screenY', `${screenY}px`)
}

function makeUUID() {
    return crypto.randomUUID()
}

(function main() {
    const portals = document.getElementById('portals')
    const canvas = document.getElementById('canvas')
    const ctx = canvas.getContext('2d')

    const state = {
        scale: 1,
        offsetX: 0,
        offsetY: 0,

        isPanning: false,
        startX: undefined,
        startY: undefined,
        hasMoved: false,

        // Minimum movement in pixels to consider as a pan
        moveThreshold: 5,

        // Store entities by their ID
        entities: {},
        entityIds: [],
    }

    const world = {
        window: window,
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
        canvasPortals: atom([]),
        canvasStore: createStore(),
        portalsRoot: createRoot(portals),
        portalsElement: portals,
    }

    const render = () => {
        world.portalsRoot.render(<App store={world.canvasStore} portals={world.canvasPortals} />)
    }

    const addPortal = (entityId, container) => {
        const updatedPortals = [...world.canvasStore.get(world.canvasPortals), { entityId, container }]
        world.canvasStore.set(world.canvasPortals, updatedPortals)
    }

    const commands = {
        draw: draw,
        render: render,
        uuid: makeUUID,
        addPortal: addPortal,
    }

    const plugins = [
        resizeCanvasPlugin,
        panCanvasPlugin,
        zoomCanvasPlugin,
    ]

    for (const plugin of plugins) {
        plugin(world, commands)
    }

    commands.draw(canvas, ctx, state)

    world.canvasStore.sub(world.canvasPortals, () => {
        commands.render()
    })
})()

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

function App({ store, portals }) {
    return <Provider store={store}>
        <Portals portals={portals} />
    </Provider>
}
