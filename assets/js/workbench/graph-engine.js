export function createWorkbenchGraph(options) {
  if (!window.cytoscape) throw new Error("Whiteboard engine unavailable");
  return window.cytoscape({
    minZoom: 0.2,
    maxZoom: 2.5,
    ...options
  });
}

export function replaceGraphElements(graph, elements, layout = { name: "preset" }) {
  graph.elements().remove();
  graph.add(elements);
  graph.layout(layout).run();
}

export function fitWorkbenchGraph(graph, padding = 48) {
  window.requestAnimationFrame(() => {
    graph.resize();
    if (graph.elements().length) graph.fit(graph.elements(), padding);
  });
}
