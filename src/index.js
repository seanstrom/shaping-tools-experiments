import React from "react"
import { createRoot } from "react-dom/client"
import { atom, createStore } from "jotai"

import { App } from "./app"
import "./index.css"

function resizeCanvasPlugin(world, commands) {
    const {
        window: screen,
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
    } = world

    screen.addEventListener('resize', () => {
        commands.resize(canvas, screen, state)
        commands.draw(canvas, ctx, state)
    })
}

function panCanvasPlugin(world, commands) {
    const {
        window: screen,
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state
    } = world

    const surface = screen.document.body

    // Handle panning
    surface.addEventListener('mousedown', (e) => {
        // Only start panning on primary (left) mouse button
        if (e.button !== 0) return

        state.isPanning = true
        state.hasMoved = false
        state.startX = e.clientX
        state.startY = e.clientY
    })

    // Add trackpad two-finger pan
    surface.addEventListener('wheel', (e) => {
        // Only handle two-finger pan when ctrl is not pressed (ctrl+wheel is for zoom)
        if (e.ctrlKey) return

        e.preventDefault()

        state.offsetX += -e.deltaX
        state.offsetY += -e.deltaY

        requestAnimationFrame(() => {
            commands.draw(canvas, ctx, state)
        })
    }, { passive: false })

    // Existing mouse move and up handlers for regular mouse panning
    surface.addEventListener('mousemove', (e) => {
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

    surface.addEventListener('mouseup', (e) => {
        state.isPanning = false
    })
}

function zoomCanvasPlugin(world, commands) {
    const {
        window: screen,
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
    } = world

    const surface = screen.document.body

    surface.addEventListener('wheel', (e) => {
        // Only zoom when Ctrl is pressed
        if (!e.ctrlKey) return

        e.preventDefault()

        // Use deltaY for zoom amount (might need to adjust sensitivity)
        const zoomAmount = e.deltaY * -0.001
        const newScale = state.scale + zoomAmount

        if (newScale < 0.1 || newScale > 10) return

        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const worldX = (mouseX - state.offsetX) / state.scale
        const worldY = (mouseY - state.offsetY) / state.scale

        state.offsetX -= (worldX * newScale - worldX * state.scale)
        state.offsetY -= (worldY * newScale - worldY * state.scale)

        state.scale = newScale
        screen.document.body.style.setProperty('--element-scale', `${newScale}`)

        requestAnimationFrame(() => {
            commands.draw(canvas, ctx, state)
        })
    }, { passive: false })
}

function createNotePlugin(world, commands) {
    const {
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state
    } = world

    canvas.addEventListener('click', (e) => {
        // Only create an entity if it was a click (no significant movement)
        if (!state.isPanning && !state.hasMoved) {
            const rect = canvas.getBoundingClientRect()

            // Convert screen coordinates to world coordinates
            const worldX = (e.clientX - rect.left - state.offsetX) / state.scale
            const worldY = (e.clientY - rect.top - state.offsetY) / state.scale

            const entityId = commands.uuid()
            const portal = createEntityAtWorldPosition(world, commands, entityId, worldX, worldY)
            commands.addPortal(entityId, portal)
            commands.draw(canvas, ctx, state)
        }
    })
}

function resize(canvas, screen, state) {
    canvas.width = screen.innerWidth * state.devicePixelRatio
    canvas.height = screen.innerHeight * state.devicePixelRatio
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
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

function clamp(num, lower, upper) {
    return Math.min(Math.max(num, lower), upper);
}

function round(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100
}

// New function to draw dots
function drawDots(canvas, ctx, state) {
    const { scale, offsetX, offsetY } = state

    const gridSize = 40 // Size of grid cells
    const dotRadiusInitial = 0.25 * state.scale * state.devicePixelRatio
    const dotRadiusRounded = round(dotRadiusInitial)
    const dotRadius = clamp(dotRadiusRounded, 1.5, 2)

    const startX = Math.floor((-offsetX / scale) / gridSize) * gridSize
    const startY = Math.floor((-offsetY / scale) / gridSize) * gridSize

    ctx.fillStyle = '#e6e6e630'

    // Draw dots at grid intersections
    for (let x = startX; x < canvas.width / scale - offsetX / scale; x += gridSize) {
        for (let y = startY; y < canvas.height / scale - offsetY / scale; y += gridSize) {
            ctx.beginPath()
            if (state.scale < 0.8) {
                ctx.fillRect(x - dotRadius, y - dotRadius, dotRadius * 2, dotRadius * 2)
            } else {
                ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
            }
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

function makeEntityElement(world, commands, entityId, entityState) {
    const { canvasState: state, canvasElement: canvas, canvasContext: ctx, window: view } = world
    const { worldX, worldY } = entityState

    const element = view.document.createElement('div')
    element.classList.add('world-element')
    element.id = `entity-${entityId}`
    element.dataset.entityId = entityId
    element.dataset.worldX = worldX
    element.dataset.worldY = worldY

    element.addEventListener('mousedown', (e) => {
        entityState.isDragging = true
        entityState.startX = e.clientX
        entityState.startY = e.clientY
        entityState.startWorldX = entityState.worldX
        entityState.startWorldY = entityState.worldY
        e.stopPropagation() // Prevent canvas pan
    })

    const surface = view.document.body

    surface.addEventListener('mousemove', (e) => {
        const entityState = state.entities[entityId]
        if (!entityState.isDragging) return

        const dx = e.clientX - entityState.startX
        const dy = e.clientY - entityState.startY
        const scale = state.scale

        // Convert screen movement to world movement
        const worldDX = dx / scale
        const worldDY = dy / scale

        const newWorldX = entityState.startWorldX + worldDX
        const newWorldY = entityState.startWorldY + worldDY

        element.dataset.worldX = newWorldX
        element.dataset.worldY = newWorldY

        entityState.worldX = newWorldX
        entityState.worldY = newWorldY

        commands.draw(canvas, ctx, state)
    })

    surface.addEventListener('mouseup', () => {
        entityState.isDragging = false
    })

    return element
}

function makeDefaultEntityState(entityId, worldX, worldY) {
    return {
        worldX,
        worldY,
        entityId,
        isDragging: false,
        startX: 0,
        startY: 0,
        startWorldX: 0,
        startWorldY: 0,
    }
}

// Create an HTML element at the given world position
function createEntityAtWorldPosition(world, commands, entityId, worldX, worldY) {
    const { canvasState: state, window: view } = world
    const entityState = makeDefaultEntityState(entityId, worldX, worldY)
    const element = makeEntityElement(world, commands, entityId, entityState)

    // Convert world coordinates to screen coordinates
    const screenX = worldX * state.scale + state.offsetX
    const screenY = worldY * state.scale + state.offsetY

    setElementPosition(element, screenX, screenY)
    view.document.body.appendChild(element)

    // Store entity in state
    state.entities[entityId] = entityState
    state.entityIds.push(entityId)

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
    const screen = window
    const portals = document.getElementById('portals')
    const canvas = document.getElementById('canvas')
    const ctx = canvas.getContext('2d')

    const state = {
        scale: 1,
        offsetX: 0,
        offsetY: 0,

        devicePixelRatio: screen.devicePixelRatio,

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
        window: screen,
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
        resize: resize,
        render: render,
        uuid: makeUUID,
        addPortal: addPortal,
    }

    const plugins = [
        resizeCanvasPlugin,
        panCanvasPlugin,
        zoomCanvasPlugin,
        createNotePlugin,
    ]

    for (const plugin of plugins) {
        plugin(world, commands)
    }

    commands.resize(canvas, screen, state)
    commands.draw(canvas, ctx, state)

    world.canvasStore.sub(world.canvasPortals, () => {
        commands.render()
    })
})()
