/**
 * Tests for zoom and pan functions in app.js
 */

describe('setZoom', () => {
  beforeEach(() => {
    state.zoom = 1;
    state.pan = { x: 0, y: 0 };
    state.connections = [];
  });

  test('sets zoom level', () => {
    setZoom(1.5);

    expect(state.zoom).toBe(1.5);
  });

  test('clamps zoom to minimum of 0.25', () => {
    setZoom(0.1);

    expect(state.zoom).toBe(0.25);
  });

  test('clamps zoom to maximum of 2', () => {
    setZoom(3);

    expect(state.zoom).toBe(2);
  });

  test('updates zoom level display', () => {
    setZoom(1.5);

    const zoomLevel = document.getElementById('zoom-level');
    expect(zoomLevel.textContent).toBe('150%');
  });

  test('applies transform to canvas', () => {
    setZoom(0.75);

    const canvas = document.getElementById('workflow-canvas');
    expect(canvas.style.transform).toContain('scale(0.75)');
  });

  test('includes pan in transform', () => {
    state.pan = { x: 100, y: 50 };
    setZoom(1);

    const canvas = document.getElementById('workflow-canvas');
    expect(canvas.style.transform).toContain('translate(100px, 50px)');
  });

  test('rounds zoom percentage display', () => {
    setZoom(0.333);

    const zoomLevel = document.getElementById('zoom-level');
    expect(zoomLevel.textContent).toBe('33%');
  });
});

describe('handleWheel', () => {
  beforeEach(() => {
    state.zoom = 1;
  });

  test('zooms in with ctrl + scroll up', () => {
    const event = {
      ctrlKey: true,
      metaKey: false,
      deltaY: -100,
      preventDefault: jest.fn()
    };

    handleWheel(event);

    expect(state.zoom).toBeGreaterThan(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test('zooms out with ctrl + scroll down', () => {
    const event = {
      ctrlKey: true,
      metaKey: false,
      deltaY: 100,
      preventDefault: jest.fn()
    };

    handleWheel(event);

    expect(state.zoom).toBeLessThan(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test('zooms with meta key (Mac)', () => {
    const event = {
      ctrlKey: false,
      metaKey: true,
      deltaY: -100,
      preventDefault: jest.fn()
    };

    handleWheel(event);

    expect(state.zoom).toBeGreaterThan(1);
  });

  test('does not zoom without modifier key', () => {
    const event = {
      ctrlKey: false,
      metaKey: false,
      deltaY: -100,
      preventDefault: jest.fn()
    };

    handleWheel(event);

    expect(state.zoom).toBe(1);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test('respects zoom limits', () => {
    state.zoom = 2;

    const event = {
      ctrlKey: true,
      metaKey: false,
      deltaY: -100,
      preventDefault: jest.fn()
    };

    handleWheel(event);

    expect(state.zoom).toBe(2); // Should not exceed max
  });
});
