import React from "react"
import { createRoot } from "react-dom/client"
import { atom, createStore } from "jotai"

import { App } from "./app"
import "./index.css"

//
// Utils
//

function clamp(num, lower, upper) {
    return Math.min(Math.max(num, lower), upper);
}

function round(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100
}

//
// Plugins
//

function resizeCanvasPlugin(world, commands) {
    const {
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
        surfaceElement: surface,
    } = world

    // topic: window resize
    // docs: https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event
    // comment: when the canvas container changes in size, we adjust the canvas size and redraw the canvas.
    surface.addEventListener('resize', () => {
        commands.resize(canvas, surface, state)
        commands.draw(canvas, ctx, state)
    })
}

function panCanvasPlugin(world, commands) {
    const {
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
        surfaceElement: surface,
    } = world

    // topic: panning with trackpad
    // comment: we attach event handlers to the surface element,
    // this allows us to process pan events while hovering over the canvas or entity elements.
    //
    // topic: panning with trackpad
    // docs: https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
    // comment: we use the wheel event for detecting scroll events on the parent element.
    surface.addEventListener('wheel', (e) => {
        // topic: panning with trackpad
        // comment: we only want to pan when the ctrl key is not pressed,
        // because we want to reserve ctrl+wheel event for zooming.
        if (!e.ctrlKey) {
            e.preventDefault()

            // topic: panning with trackpad
            // comment: we invert the scroll direction for natural scrolling.
            state.offsetX += -e.deltaX
            state.offsetY += -e.deltaY

            requestAnimationFrame(() => {
                commands.draw(canvas, ctx, state)
            })
        }
    }, { passive: false })

    // topic: panning with mouse
    // docs: https://developer.mozilla.org/en-US/docs/Web/API/Element/mousedown_event
    // comment: we use the mousedown event for initiating a pan on the canvas.
    surface.addEventListener('mousedown', (e) => {
        // topic: panning with mouse
        // comment: we only want to pan when the left mouse button is pressed.
        if (e.button === 0) {
            state.isPanning = true
            state.hasMoved = false
            state.startX = e.clientX
            state.startY = e.clientY
        }
    })

    // topic: panning with mouse
    // docs: https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event
    // comment: we use the mousemove event for updating the pan offset while panning on the canvas.
    surface.addEventListener('mousemove', (e) => {
        // topic: panning with mouse
        // comment: we only want to update the pan offset while the canvas is being panned.
        if (state.isPanning) {
            // topic: panning with mouse
            // docs: https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX
            // docs: https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY
            // comment: we calculate the difference between the current mouse position and the starting mouse position.
            const dx = e.clientX - state.startX
            const dy = e.clientY - state.startY

            // topic: panning with mouse
            // comment: we mark the canvas as moved if the pan offset has exceeded a threshold.
            if (Math.abs(dx) > state.moveThreshold || Math.abs(dy) > state.moveThreshold) {
                state.hasMoved = true
            }

            // topic: panning with mouse
            // comment: we update the canvas offset based on the pan offset.
            state.offsetX += dx
            state.offsetY += dy

            state.startX = e.clientX
            state.startY = e.clientY

            requestAnimationFrame(() => {
                commands.draw(canvas, ctx, state)
            })
        }
    })

    // topic: panning with mouse
    // docs: https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseup_event
    // comment: we use the mouseup event for finishing the pan on the canvas.
    surface.addEventListener('mouseup', (e) => {
        if (state.isPanning) {
            state.isPanning = false
        }
    })

    // topic: panning with mouse
    // docs: https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseleave_event
    // comment: we use the mouseleave event for stopping the pan on the canvas.
    surface.addEventListener('mouseleave', () => {
        if (state.isPanning) {
            state.isPanning = false
        }
    })
}

function zoomCanvasPlugin(world, commands) {
    const {
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
        surfaceElement: surface,
    } = world

    // topic: zooming with trackpad
    // comment: we attach event handlers to the surface element,
    // this allows us to process zoom events while hovering over the canvas or entity elements.

    // topic: zooming with trackpad
    // docs: https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
    // comment: we use the wheel event for detecting scroll events on the parent element.
    surface.addEventListener('wheel', (e) => {
        // topic: zooming with trackpad
        // comment: we only want to zoom when the ctrl key is pressed,
        // because we want to reserve normal wheel events for panning.
        if (e.ctrlKey) {
            e.preventDefault()

            // topic: zooming with trackpad
            // docs: https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY
            // comment: we use the vertical scroll amount for adjusting the zoom level.
            // comment: we invert the scroll amount for natural scrolling.
            // comment: we multiply the scroll amount to configure the sensitivity.
            const zoomAmount = e.deltaY * -0.001

            // topic: zooming with trackpad
            // comment: we adjust the canvas and element scale based on the zoom level.
            // comment: we clamp the scale to a minimum and maximum scale values.
            const newScale = state.scale + zoomAmount

            // topic: zooming with trackpad
            // comment: we clamp the scale to a minimum and maximum scale values.
            if (newScale >= 0.1 || newScale <= 10) {
                // topic: zooming with trackpad
                // comment: we calculate the mouse position relative to the canvas container.
                const rect = canvas.getBoundingClientRect()
                const mouseX = e.clientX - rect.left
                const mouseY = e.clientY - rect.top

                // topic: zooming with trackpad
                // comment: we convert screen mouse position into world coordinates.
                const worldX = (mouseX - state.offsetX) / state.scale
                const worldY = (mouseY - state.offsetY) / state.scale

                // topic: zooming with trackpad
                // comment: we adjust the canvas offset to remain centered on the mouse position while zooming.
                state.offsetX -= (worldX * newScale - worldX * state.scale)
                state.offsetY -= (worldY * newScale - worldY * state.scale)

                // topic: zooming with trackpad
                // comment: we update the canvas scale value.
                state.scale = newScale

                // topic: zooming with trackpad
                // comment: we update the element scale value with a CSS variable.
                surface.style.setProperty('--element-scale', `${newScale}`)

                requestAnimationFrame(() => {
                    commands.draw(canvas, ctx, state)
                })
            }
        }
    }, { passive: false })
}

function createNotePlugin(world, commands) {
    const {
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state
    } = world

    // topic: creating a note entity
    // docs: https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event
    // comment: we attach a click handler to the canvas element,
    // so that we can create a note when clicking on an empty area of the canvas.
    canvas.addEventListener('click', (e) => {
        // topic: creating a note entity
        // comment: we only create a note if the mouse is not panning
        if (!state.isPanning && !state.hasMoved) {
            // topic: creating a note entity
            // comment: we calculate the world coordinates of the mouse position.
            const rect = canvas.getBoundingClientRect()
            const screenX = e.clientX - rect.left
            const screenY = e.clientY - rect.top

            // topic: creating a note entity
            // comment: we create a new entity based on the screen coordinates.
            // comment: we add the entity DOM element to a list of portal elements.
            // comment: we redraw the canvas to visualise the arrows between entities.
            const entityId = commands.uuid()
            const portal = createEntityAtPosition(world, commands, entityId, screenX, screenY)
            commands.addPortal(world, commands, entityId, portal)
            commands.draw(canvas, ctx, state)
        }
    })
}

//
// Drawing
//

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

function setElementPosition(element, screenX, screenY) {
    element.style.setProperty('--element-screenX', `${screenX}px`)
    element.style.setProperty('--element-screenY', `${screenY}px`)
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

//
// Commands
//

function makeUUID() {
    return crypto.randomUUID()
}

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

function resize(canvas, surface, state) {
    const containerWidth = surface.innerWidth || surface.clientWidth
    const containerHeight = surface.innerHeight || surface.clientHeight
    canvas.width = containerWidth * state.devicePixelRatio
    canvas.height = containerHeight * state.devicePixelRatio
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
}

function addPortal(world, commands, entityId, container) {
    const portals = world.canvasStore.get(world.canvasPortals)
    portals.push({ entityId, container })
    world.canvasStore.set(world.canvasPortals, portals)
    commands.render()
}

function render(world) {
    const props = {
        store: world.canvasStore,
        portals: world.canvasPortals,
    }
    world.portalsRoot.render(<App {...props} />)
}

//
// Entities
//

function makeEntityElement(world, commands, entityId) {
    const {
        window: screen,
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
        surfaceElement: surface,
    } = world

    const element = screen.document.createElement('div')
    element.classList.add('world-element')
    element.id = `entity-${entityId}`
    element.dataset.entityId = entityId

    element.addEventListener('mousedown', (e) => {
        const entityState = state.entities[entityId]
        if (typeof entityState === 'object') {
            // topic: dragging an entity
            // comment: we prevent the event from bubbling up to the parent element,
            // so that we don't trigger a pan when dragging an entity.
            e.stopPropagation()

            entityState.isDragging = true
            entityState.startX = e.clientX
            entityState.startY = e.clientY
            entityState.startWorldX = entityState.worldX
            entityState.startWorldY = entityState.worldY
        }
    })

    // topic: dragging an entity
    // comment: we attach a mousemove event listener to the surface element,
    // so that we can update the entity position even when slightly dragging outside the entity element.

    // topic: refactoring drag event listeners
    // comment: we could refactor each element drag event listeners into single event listener,
    // because that would reduce the amount of event listeners to notify when handling a drag gesture.

    surface.addEventListener('mousemove', (e) => {
        const entityState = state.entities[entityId]
        if (entityState?.isDragging) {
            // topic: dragging an entity
            // comment: we calculate the screen offset between the current and starting mouse positions.
            const dx = e.clientX - entityState.startX
            const dy = e.clientY - entityState.startY

            // topic: dragging an entity
            // comment: we convert the screen offset to a world offset.
            const worldDX = dx / state.scale
            const worldDY = dy / state.scale

            // topic: dragging an entity
            // comment: we update the entity world position with the new world offset.
            entityState.worldX = entityState.startWorldX + worldDX
            entityState.worldY = entityState.startWorldY + worldDY

            requestAnimationFrame(() => {
                commands.draw(canvas, ctx, state)
            })
        }
    })

    // topic: dragging an entity
    // comment: we attach a mouseup event listener to the parent element,
    // so that we can finish the drag gesture when releasing the mouse button.
    surface.addEventListener('mouseup', () => {
        const entityState = state.entities[entityId]
        if (entityState?.isDragging) {
            entityState.isDragging = false
        }
    })

    // topic: dragging an entity
    // comment: we attach a mouseleave event listener to the parent element,
    // so that we can finish the drag gesture when the mouse leaves the canvas.
    surface.addEventListener('mouseleave', () => {
        const entityState = state.entities[entityId]
        if (entityState?.isDragging) {
            entityState.isDragging = false
        }
    })

    return element
}

function setElementDimensions(element, width, height) {
    element.style.setProperty('--element-width', `${width}px`)
    element.style.setProperty('--element-min-height', `${height}px`)
}

function makeDefaultEntityState(entityId, worldX, worldY, defaultWidth = 400, defaultHeight = 300) {
    return {
        worldX,
        worldY,
        entityId,
        defaultWidth,
        defaultHeight,
        startX: 0,
        startY: 0,
        startWorldX: 0,
        startWorldY: 0,
        isDragging: false,
        currentWidth: defaultWidth,
        currentHeight: defaultHeight,
    }
}

function createEntityAtPosition(world, commands, entityId, screenX, screenY) {
    const {
        canvasState: state,
        surfaceElement: surface,
    } = world

    // topic: creating an entity
    // comment: we convert the screen coordinates to world coordinates.
    const worldX = (screenX - state.offsetX) / state.scale
    const worldY = (screenY - state.offsetY) / state.scale

    const entityState = makeDefaultEntityState(entityId, worldX, worldY)
    const element = makeEntityElement(world, commands, entityId)

    setElementPosition(element, screenX, screenY)
    setElementDimensions(element, entityState.defaultWidth, entityState.defaultHeight)
    state.entities[entityId] = entityState
    state.entityIds.push(entityId)
    surface.appendChild(element)

    return element
}

//
// Main
//

(function main() {
    const screen = window
    const surface = screen.document.body
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
        surfaceElement: surface,
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
        canvasPortals: atom([]),
        canvasStore: createStore(),
        portalsRoot: createRoot(portals),
        portalsElement: portals,
    }

    const commands = {
        draw: draw,
        resize: resize,
        uuid: makeUUID,
        addPortal: addPortal,
        render: render.bind(null, world),
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

    commands.resize(canvas, surface, state)
    commands.draw(canvas, ctx, state)
})()
