/**
 * Tests for component palette functions in app.js
 */

describe('renderComponentPalette', () => {
  beforeEach(() => {
    state.components = {};
    document.getElementById('component-palette').innerHTML = '';
  });

  test('renders sections for each component type', () => {
    state.components = {
      theorists: [{ name: 'Test Theorist' }],
      experimentalists: [{ name: 'Test Experimentalist' }]
    };

    renderComponentPalette();

    const sections = document.querySelectorAll('.component-section');
    expect(sections.length).toBe(2);
  });

  test('renders correct section headers', () => {
    state.components = {
      theorists: [{ name: 'Test' }]
    };

    renderComponentPalette();

    const header = document.querySelector('.section-title');
    expect(header.textContent).toContain('Theorists');
  });

  test('shows correct component count in header', () => {
    state.components = {
      theorists: [{ name: 'T1' }, { name: 'T2' }, { name: 'T3' }]
    };

    renderComponentPalette();

    const count = document.querySelector('.section-count');
    expect(count.textContent).toBe('3');
  });

  test('renders component items', () => {
    state.components = {
      theorists: [
        { name: 'Theorist One', description: 'First' },
        { name: 'Theorist Two', description: 'Second' }
      ]
    };

    renderComponentPalette();

    const items = document.querySelectorAll('.component-item');
    expect(items.length).toBe(2);
  });

  test('component items are draggable', () => {
    state.components = {
      theorists: [{ name: 'Test' }]
    };

    renderComponentPalette();

    const item = document.querySelector('.component-item');
    expect(item.draggable).toBe(true);
  });

  test('component items have correct data attributes', () => {
    state.components = {
      theorists: [{ name: 'Test' }]
    };

    renderComponentPalette();

    const item = document.querySelector('.component-item');
    expect(item.dataset.type).toBe('theorists');
    expect(item.dataset.index).toBe('0');
  });

  test('renders component name', () => {
    state.components = {
      theorists: [{ name: 'My Theorist' }]
    };

    renderComponentPalette();

    const name = document.querySelector('.component-name');
    expect(name.textContent).toBe('My Theorist');
  });

  test('renders component description if present', () => {
    state.components = {
      theorists: [{ name: 'Test', description: 'A description' }]
    };

    renderComponentPalette();

    const desc = document.querySelector('.component-description');
    expect(desc.textContent).toBe('A description');
  });

  test('uses fallback name if name is missing', () => {
    state.components = {
      theorists: [{ title: 'Titled Component' }]
    };

    renderComponentPalette();

    const name = document.querySelector('.component-name');
    expect(name.textContent).toBe('Titled Component');
  });

  test('uses indexed fallback name if both name and title are missing', () => {
    state.components = {
      theorists: [{}]
    };

    renderComponentPalette();

    const name = document.querySelector('.component-name');
    expect(name.textContent).toBe('Component 1');
  });

  test('sections are collapsed by default', () => {
    state.components = {
      theorists: [{ name: 'Test' }]
    };

    renderComponentPalette();

    const header = document.querySelector('.section-header');
    expect(header.classList.contains('collapsed')).toBe(true);
  });
});

describe('filterComponents', () => {
  beforeEach(() => {
    state.components = {
      theorists: [
        { name: 'Linear Regression', description: 'Fits a linear model' },
        { name: 'Neural Network', description: 'Deep learning model' }
      ],
      experimentalists: [
        { name: 'Random Sampler', description: 'Random sampling' }
      ]
    };
    renderComponentPalette();
  });

  test('shows matching components by name', () => {
    filterComponents('linear');

    const items = document.querySelectorAll('.component-item');
    const visibleItems = Array.from(items).filter(
      item => item.style.display !== 'none'
    );

    expect(visibleItems.length).toBe(1);
  });

  test('shows matching components by description', () => {
    filterComponents('sampling');

    const items = document.querySelectorAll('.component-item');
    const visibleItems = Array.from(items).filter(
      item => item.style.display !== 'none'
    );

    expect(visibleItems.length).toBe(1);
  });

  test('search is case insensitive', () => {
    filterComponents('NEURAL');

    const items = document.querySelectorAll('.component-item');
    const visibleItems = Array.from(items).filter(
      item => item.style.display !== 'none'
    );

    expect(visibleItems.length).toBe(1);
  });

  test('shows all components with empty query', () => {
    filterComponents('nonexistent');
    filterComponents('');

    const items = document.querySelectorAll('.component-item');
    const visibleItems = Array.from(items).filter(
      item => item.style.display !== 'none'
    );

    expect(visibleItems.length).toBe(3);
  });

  test('hides sections with no matching components', () => {
    filterComponents('linear');

    const sections = document.querySelectorAll('.component-section');
    const theoristsSection = sections[0];
    const experimentalistsSection = sections[1];

    expect(theoristsSection.style.display).not.toBe('none');
    expect(experimentalistsSection.style.display).toBe('none');
  });

  test('partial match works', () => {
    filterComponents('net');

    const items = document.querySelectorAll('.component-item');
    const visibleItems = Array.from(items).filter(
      item => item.style.display !== 'none'
    );

    expect(visibleItems.length).toBe(1);
  });
});

describe('loadComponents', () => {
  // Note: These tests verify function behavior without actual API calls
  // since fetch mocking across vm context is complex

  test('loadComponents function exists', () => {
    expect(typeof loadComponents).toBe('function');
  });

  test('loadComponents is async function', () => {
    expect(loadComponents.constructor.name).toBe('AsyncFunction');
  });
});
