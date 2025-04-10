import React from "react"
import { createRoot } from "react-dom/client"
import { atom, createStore } from "jotai"

import { App } from "./app"
import "./canvas.css"

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
        window: screen,
    } = world

    // topic: window resize
    // docs: https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event
    // comment: when the canvas container changes in size, we adjust the canvas size and redraw the canvas.
    screen.addEventListener('resize', () => {
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

function isZoomSupported() {
    // topic: detecting zoom support
    // comment: modern browsers in 2024 support zoom via CSS,
    // but we may still want to update this function so we can fallback using a transform.
    return true
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
            const nextScale = state.scale + zoomAmount
            const scaleMin = 0.5
            const scaleMax = 3
            const newScale = clamp(nextScale, scaleMin, scaleMax)

            // topic: zooming with trackpad
            // comment: we clamp the scale to a minimum and maximum scale values.
            if (newScale >= scaleMin && newScale <= scaleMax) {
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
                // comment: we use CSS zoom if supported, otherwise we use a transform.
                // comment: CSS zoom is preferred because it renders with crisp text.
                if (isZoomSupported()) {
                    surface.style.setProperty("--element-zoom", `${newScale}`)
                    if (surface.classList.contains("use-transform")) {
                        surface.classList.remove("use-transform")
                    }
                } else {
                    surface.style.setProperty("--element-scale", `${newScale}`)
                    if (!surface.classList.contains("use-transform")) {
                        surface.classList.add("use-transform")
                    }
                }

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
            const { worldElement, portalElement } = createEntityAtPosition(world, commands, entityId, screenX, screenY)
            commands.addPortal(world, commands, entityId, portalElement)
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
    for (let x = startX; x < canvas.width / state.scale - offsetX / state.scale; x += gridSize) {
        for (let y = startY; y < canvas.height / state.scale - offsetY / state.scale; y += gridSize) {
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

    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 1 * state.devicePixelRatio;
    ctx.fillStyle = '#6B7280';

    for (const connectionId of state.entityConnectionIds) {
        const connection = state.entityConnections[connectionId]
        const startEntity = state.entities[connection.fromId]
        const endEntity = state.entities[connection.toId]

        const anchorSize = 10 / 2;

        // Calculate anchor positions in world coordinates

        const startX = (() => {
            switch (connection.fromPosition) {
                case "top":
                    return startEntity.worldX
                case "bottom":
                    return startEntity.worldX
                case "left":
                    return startEntity.worldX - startEntity.currentWidth / 2 + anchorSize / 2
                case "right":
                    return startEntity.worldX + startEntity.currentWidth / 2 - anchorSize / 2
                default:
                    return startEntity.worldX + startEntity.currentWidth / 2 - anchorSize / 2
            }
        })()

        const startY = (() => {
            switch (connection.fromPosition) {
                case "top":
                    return startEntity.worldY - startEntity.currentHeight / 2 - anchorSize / 2
                case "bottom":
                    return startEntity.worldY + startEntity.currentHeight / 2 + anchorSize / 2
                case "left":
                    return startEntity.worldY
                case "right":
                    return startEntity.worldY
                default:
                    return startEntity.worldY
            }
        })()

        const endX = (() => {
            switch (connection.toPosition) {
                case "top":
                    return endEntity.worldX
                case "bottom":
                    return endEntity.worldX
                case "left":
                    return endEntity.worldX - endEntity.currentWidth / 2 + anchorSize / 2
                case "right":
                    return endEntity.worldX + endEntity.currentWidth / 2 - anchorSize / 2
                default:
                    return endEntity.worldX + endEntity.currentWidth / 2 - anchorSize / 2
            }
        })()

        const endY = (() => {
            switch (connection.toPosition) {
                case "top":
                    return endEntity.worldY - endEntity.currentHeight / 2 - anchorSize / 2
                case "bottom":
                    return endEntity.worldY + endEntity.currentHeight / 2 + anchorSize / 2
                case "left":
                    return endEntity.worldY
                case "right":
                    return endEntity.worldY
                default:
                    return endEntity.worldY
            }
        })()

        // Calculate control points for the curve
        const dx = endX - startX;
        const minOffset = 30;
        const maxOffset = 80;
        const controlOffset = Math.min(Math.max(Math.abs(dx) * 0.2, minOffset), maxOffset);

        const controlPoint1X = (connection?.pathPoints?.control1?.x || startX) + controlOffset;
        const controlPoint1Y = (connection?.pathPoints?.control1?.y || startY);

        const controlPoint2X = (connection?.pathPoints?.control2?.x || endX) - controlOffset;
        const controlPoint2Y = (connection?.pathPoints?.control2?.y || endY);

        // Store the path points in the connection object for hit testing
        connection.pathPoints = {
            start: { x: startX, y: startY },
            control1: { x: controlPoint1X, y: controlPoint1Y },
            control2: { x: controlPoint2X, y: controlPoint2Y },
            end: { x: endX, y: endY }
        }

        // Draw the curved line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(
            controlPoint1X, controlPoint1Y,
            controlPoint2X, controlPoint2Y,
            endX, endY
        );
        ctx.stroke();

        // Draw drag handle if this connection is being hovered
        if (state.selectedConnectionId === connectionId) {
            const midPoint = getBezierPoint(0.5,
                connection.pathPoints.start,
                connection.pathPoints.control1,
                connection.pathPoints.control2,
                connection.pathPoints.end
            );

            // Draw handle
            ctx.fillStyle = '#FFF';
            ctx.strokeStyle = '#6B7280';
            ctx.lineWidth = 1.5 * state.devicePixelRatio;
            ctx.beginPath();
            ctx.arc(midPoint.x, midPoint.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }
}

function drawArrowhead(ctx, state, x, y, fromX, fromY) {
    const angle = Math.atan2(y - fromY, x - fromX);
    const size = 8; // Smaller arrowhead that scales with zoom

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

function clearCanvas(ctx, state) {
    // Save the current transform
    ctx.save()
    // Reset transform to clear the entire canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Restore the transform
    ctx.restore()
}

function transformCanvas(ctx, state) {
    const scale = state.scale * state.devicePixelRatio
    const offsetX = state.offsetX * state.devicePixelRatio
    const offsetY = state.offsetY * state.devicePixelRatio

    // Apply both the zoom scale and device pixel ratio together
    // Scale the offset by device pixel ratio since we're working in physical pixels
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY)
}

function draw(canvas, ctx, state) {
    transformCanvas(ctx, state)
    clearCanvas(ctx, state)

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

    const scaledWidth = containerWidth * state.devicePixelRatio
    const scaledHeight = containerHeight * state.devicePixelRatio

    // Set the canvas's internal dimensions accounting for device pixel ratio
    canvas.width = scaledWidth
    canvas.height = scaledHeight

    // Set the display size through CSS
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
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

    // Create anchor container
    const anchorContainer = screen.document.createElement('div')
    anchorContainer.classList.add('anchor-container')

    // Create portal container
    const portalContainer = screen.document.createElement('div')
    portalContainer.classList.add('portal-container')

    // Create the four anchors
    const positions = ['top', 'right', 'bottom', 'left']
    for (const position of positions) {
        const anchor = screen.document.createElement('div')
        anchor.dataset.position = position
        anchor.classList.add('element-anchor', `anchor-${position}`)
        anchorContainer.appendChild(anchor)
    }

    // Add containers to element
    element.appendChild(anchorContainer)
    element.appendChild(portalContainer)

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

    // Add drag start handler for anchors
    anchorContainer.addEventListener('mousedown', (e) => {
        const anchor = e.target;
        if (anchor.classList.contains('element-anchor')) {
            e.stopPropagation(); // Prevent entity drag

            state.isDraggingAnchor = true;
            state.dragStartEntityId = entityId;
            state.dragStartAnchor = anchor;
            state.dragStartX = e.clientX;
            state.dragStartY = e.clientY;
            state.dragStartAnchorPosition = anchor.dataset.position

            // Add temporary line layer if it doesn't exist
            if (!state.tempLineLayer) {
                state.tempLineLayer = createTempLineLayer(world);
            }
        }
    });

    // Add hover effect for potential drop targets
    anchorContainer.addEventListener('mouseover', (e) => {
        const anchor = e.target;
        if (state.isDraggingAnchor && anchor.classList.contains('element-anchor')) {
            anchor.classList.add('anchor-hover');
            state.currentDropTarget = {
                entityId,
                anchor
            };
        }
    });

    anchorContainer.addEventListener('mouseout', (e) => {
        const anchor = e.target;
        if (anchor.classList.contains('element-anchor')) {
            anchor.classList.remove('anchor-hover');
            state.currentDropTarget = null;
        }
    });

    anchorContainer.addEventListener("mouseup", (e) => {
        const anchor = e.target
        if (anchor.classList.contains("element-anchor")) {
            if (state.currentDropTarget) {
                if (state.currentDropTarget.entityId !== state.dragStartEntityId) {
                    const connection = {
                        id: commands.uuid(),
                        fromPosition: state.dragStartAnchorPosition,
                        fromId: state.dragStartEntityId,
                        toId: state.currentDropTarget.entityId,
                        toPosition: anchor.dataset.position,
                    }
                    state.entityConnections[connection.id] = connection
                    state.entityConnectionIds.push(connection.id)
                }
            }
        }
    })

    return { worldElement: element, portalElement: portalContainer }
}

function makeResizeObserver(world, entityId, element) {
    const { canvasState: state } = world
    return new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.target.dataset.entityId === entityId) {
                if (entry.contentBoxSize) {
                    const width = entry.contentBoxSize[0].inlineSize
                    const height = entry.contentBoxSize[0].blockSize
                    setEntityDimensions(state, entityId, element, width, height)
                } else {
                    const width = entry.contentRect.width
                    const height = entry.contentRect.height
                    setEntityDimensions(state, entityId, element, width, height)
                }
            }
        }
    })
}

function setEntityDimensions(state, entityId, element, width, height) {
    state.entities[entityId].currentWidth = width
    state.entities[entityId].currentHeight = height
    element.style.setProperty('--element-width', `${width}px`)
    element.style.setProperty('--element-height', `${height}px`)
}

function setElementDefaultDimensions(element, width, height) {
    element.style.setProperty('--element-min-width', `${width}px`)
    element.style.setProperty('--element-min-height', `${height}px`)
}

function makeDefaultEntityState(entityId, worldX, worldY, defaultWidth = 360, defaultHeight = 130) {
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
    const { worldElement: element, portalElement } = makeEntityElement(world, commands, entityId)
    const observer = makeResizeObserver(world, entityId, element)

    setElementPosition(element, screenX, screenY)
    setElementDefaultDimensions(element, entityState.defaultWidth, entityState.defaultHeight)
    state.entities[entityId] = entityState
    state.entityIds.push(entityId)
    world.portalObservers[entityId] = observer
    surface.appendChild(element)
    observer.observe(element)

    return { worldElement: element, portalElement }
}

// Add these new functions

function createTempLineLayer(world) {
    const { window: screen, surfaceElement: surface } = world;
    const layer = screen.document.createElement('canvas');
    layer.classList.add('temp-line-layer');
    layer.style.position = 'absolute';
    layer.style.top = '0';
    layer.style.left = '0';
    layer.style.pointerEvents = 'none';
    layer.width = surface.clientWidth;
    layer.height = surface.clientHeight;
    surface.appendChild(layer);
    return layer;
}

function drawTempLine(world, startX, startY, endX, endY) {
    const { tempLineLayer } = world.canvasState;
    const ctx = tempLineLayer.getContext('2d');

    ctx.clearRect(0, 0, tempLineLayer.width, tempLineLayer.height);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// Add to your main surface event listeners:
function addAnchorDragHandlers(world, commands) {
    const { surfaceElement: surface, canvasState: state } = world;

    surface.addEventListener('mousemove', (e) => {
        if (state.isDraggingAnchor) {
            const startAnchor = state.dragStartAnchor;
            const startRect = startAnchor.getBoundingClientRect();
            const startX = startRect.left + startRect.width / 2;
            const startY = startRect.top + startRect.height / 2;

            drawTempLine(world, startX, startY, e.clientX, e.clientY);
        }
    });

    surface.addEventListener('mouseup', (e) => {
        if (state.isDraggingAnchor) {
            if (state.currentDropTarget) {
                // Create connection between entities
                const connection = {
                    from: state.dragStartEntityId,
                    to: state.currentDropTarget.entityId
                };
                // Add to your connections state/storage
                state.connections = state.connections || [];
                state.connections.push(connection);

                commands.draw(world.canvasElement, world.canvasContext, state);
            }

            // Cleanup
            state.isDraggingAnchor = false;
            state.dragStartEntityId = null;
            state.dragStartAnchor = null;
            if (state.tempLineLayer) {
                state.tempLineLayer.remove();
                state.tempLineLayer = null;
            }

            // Remove any remaining hover states
            const hoveredAnchors = surface.querySelectorAll('.anchor-hover');
            for (const anchor of hoveredAnchors) {
                anchor.classList.remove('anchor-hover');
            }
        }
    });
}

// Add these new utility functions
function getBezierPoint(t, p0, p1, p2, p3) {
    const oneMinusT = 1 - t;
    return {
        x: Math.pow(oneMinusT, 3) * p0.x +
            3 * Math.pow(oneMinusT, 2) * t * p1.x +
            3 * oneMinusT * Math.pow(t, 2) * p2.x +
            Math.pow(t, 3) * p3.x,
        y: Math.pow(oneMinusT, 3) * p0.y +
            3 * Math.pow(oneMinusT, 2) * t * p1.y +
            3 * oneMinusT * Math.pow(t, 2) * p2.y +
            Math.pow(t, 3) * p3.y
    };
}

function isPointOnBezierCurve(point, start, control1, control2, end, threshold = 5) {
    // Check multiple points along the curve
    for (let t = 0; t <= 1; t += 0.05) {
        const curvePoint = getBezierPoint(t, start, control1, control2, end);
        const distance = Math.sqrt(
            Math.pow(point.x - curvePoint.x, 2) +
            Math.pow(point.y - curvePoint.y, 2)
        );
        if (distance < threshold) return true;
    }
    return false;
}

// Add a new plugin for handling connector interactions
function connectorInteractionPlugin(world, commands) {
    const {
        canvasContext: ctx,
        canvasElement: canvas,
        canvasState: state,
    } = world

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect()
        const mouseX = (e.clientX - rect.left - state.offsetX) / state.scale
        const mouseY = (e.clientY - rect.top - state.offsetY) / state.scale

        // Check if mouse is over any connection
        let selectedConnectionId = null;
        for (const connectionId of state.entityConnectionIds) {
            const connection = state.entityConnections[connectionId]
            const { pathPoints } = connection
            const isConnectionSelected = isPointOnBezierCurve(
                { x: mouseX, y: mouseY },
                pathPoints.start,
                pathPoints.control1,
                pathPoints.control2,
                pathPoints.end)

            if (isConnectionSelected) {
                selectedConnectionId = connectionId
                break
            }
        }

        if (!state.isDraggingAnchor) {
        }
        if (state.selectedConnectionId !== selectedConnectionId) {
            state.selectedConnectionId = selectedConnectionId
            canvas.style.cursor = selectedConnectionId ? 'pointer' : 'default'
            commands.draw(canvas, ctx, state)
        }
    })

    canvas.addEventListener('mousedown', (e) => {
        if (state.selectedConnectionId) {
            e.stopPropagation(); // Prevent panning

            const connection = state.entityConnections[state.selectedConnectionId];
            state.isDraggingConnection = true;
            state.draggedConnectionId = state.selectedConnectionId;
            state.dragStartX = e.clientX;
            state.dragStartY = e.clientY;

            // Store original control points
            state.dragStartControl1 = { ...connection.pathPoints.control1 };
            state.dragStartControl2 = { ...connection.pathPoints.control2 };

            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (state.isDraggingConnection) {
            const dx = (e.clientX - state.dragStartX) / state.scale;
            const dy = (e.clientY - state.dragStartY) / state.scale;

            const connection = state.entityConnections[state.draggedConnectionId];

            // Update control points
            connection.pathPoints.control1 = {
                x: state.dragStartControl1.x + dx,
                y: state.dragStartControl1.y + dy
            };
            connection.pathPoints.control2 = {
                x: state.dragStartControl2.x + dx,
                y: state.dragStartControl2.y + dy
            };

            commands.draw(canvas, ctx, state);
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (state.isDraggingConnection) {
            canvas.style.cursor = state.selectedConnectionId ? 'pointer' : 'default';
            state.isDraggingConnection = false;
            state.draggedConnectionId = null;
        }
    });

    // Reset cursor when mouse leaves canvas
    canvas.addEventListener('mouseleave', () => {
        canvas.style.cursor = 'default';
        state.selectedConnectionId = null;
        commands.draw(canvas, ctx, state);
    });
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

        // Store entity connections by ID
        entityConnections: {},
        entityConnectionIds: [],
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
        portalObservers: {},
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
        addAnchorDragHandlers,
        connectorInteractionPlugin,
    ]

    for (const plugin of plugins) {
        plugin(world, commands)
    }

    commands.resize(canvas, surface, state)
    commands.draw(canvas, ctx, state)
})()
