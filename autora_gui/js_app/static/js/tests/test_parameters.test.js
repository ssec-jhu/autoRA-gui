/**
 * Tests for parameter extraction and data formatting functions in app.js
 */

describe('extractParameters', () => {
  test('extracts parameters with defaults', () => {
    const componentData = {
      name: 'Test Component',
      description: 'A test',
      parameters: [
        { name: 'learning_rate', default: 0.01 },
        { name: 'epochs', default: 100 }
      ]
    };

    const params = extractParameters(componentData);

    expect(params.learning_rate).toBe(0.01);
    expect(params.epochs).toBe(100);
    expect(params._name).toBe('Test Component');
    expect(params._description).toBe('A test');
  });

  test('handles parameters without defaults', () => {
    const componentData = {
      name: 'Test',
      parameters: [
        { name: 'param1' },
        { name: 'param2' }
      ]
    };

    const params = extractParameters(componentData);

    expect(params.param1).toBeNull();
    expect(params.param2).toBeNull();
  });

  test('handles empty parameters array', () => {
    const componentData = {
      name: 'Test',
      parameters: []
    };

    const params = extractParameters(componentData);

    expect(params._name).toBe('Test');
    expect(Object.keys(params).filter(k => !k.startsWith('_')).length).toBe(0);
  });

  test('handles missing parameters array', () => {
    const componentData = {
      name: 'Test'
    };

    const params = extractParameters(componentData);

    expect(params._name).toBe('Test');
    expect(params._description).toBe('');
  });

  test('handles component with zero default value', () => {
    const componentData = {
      name: 'Test',
      parameters: [
        { name: 'offset', default: 0 }
      ]
    };

    const params = extractParameters(componentData);

    expect(params.offset).toBe(0);
  });

  test('handles component with false default value', () => {
    const componentData = {
      name: 'Test',
      parameters: [
        { name: 'enabled', default: false }
      ]
    };

    const params = extractParameters(componentData);

    expect(params.enabled).toBe(false);
  });

  test('handles component with empty string default', () => {
    const componentData = {
      name: 'Test',
      parameters: [
        { name: 'prefix', default: '' }
      ]
    };

    const params = extractParameters(componentData);

    expect(params.prefix).toBe('');
  });
});

describe('formatDataTypes', () => {
  test('formats simple array of strings', () => {
    const types = ['real', 'integer'];
    expect(formatDataTypes(types)).toBe('real, integer');
  });

  test('formats array of objects with name and datatype', () => {
    const types = [
      { name: 'X', datatype: 'real' },
      { name: 'Y', datatype: 'integer' }
    ];
    expect(formatDataTypes(types)).toBe('X: real, Y: integer');
  });

  test('formats single object with name and datatype', () => {
    const types = { name: 'X', datatype: 'real' };
    expect(formatDataTypes(types)).toBe('X: real');
  });

  test('handles object with missing name', () => {
    const types = { datatype: 'real' };
    expect(formatDataTypes(types)).toBe('unnamed: real');
  });

  test('handles object with missing datatype', () => {
    const types = { name: 'X' };
    expect(formatDataTypes(types)).toBe('X: any');
  });

  test('handles null input', () => {
    expect(formatDataTypes(null)).toBe('');
  });

  test('handles undefined input', () => {
    expect(formatDataTypes(undefined)).toBe('');
  });

  test('handles empty array', () => {
    expect(formatDataTypes([])).toBe('');
  });

  test('converts primitive to string', () => {
    expect(formatDataTypes('real')).toBe('real');
  });
});

describe('renderParameterInput', () => {
  test('renders integer input', () => {
    const param = { name: 'epochs', datatype: 'integer' };
    const html = renderParameterInput(param, 100, 'node-1');

    expect(html).toContain('type="number"');
    expect(html).toContain('step="1"');
    expect(html).toContain('data-param="epochs"');
    expect(html).toContain('value="100"');
  });

  test('renders real/float input', () => {
    const param = { name: 'learning_rate', datatype: 'real' };
    const html = renderParameterInput(param, 0.01, 'node-1');

    expect(html).toContain('type="number"');
    expect(html).toContain('step="any"');
    expect(html).toContain('value="0.01"');
  });

  test('renders boolean select', () => {
    const param = { name: 'enabled', datatype: 'boolean' };
    const html = renderParameterInput(param, true, 'node-1');

    expect(html).toContain('<select');
    expect(html).toContain('value="true"');
    expect(html).toContain('value="false"');
    expect(html).toContain('selected');
  });

  test('renders categorical select with options', () => {
    const param = {
      name: 'optimizer',
      datatype: 'categorical',
      validValues: ['adam', 'sgd', 'rmsprop']
    };
    const html = renderParameterInput(param, 'adam', 'node-1');

    expect(html).toContain('<select');
    expect(html).toContain('value="adam"');
    expect(html).toContain('value="sgd"');
    expect(html).toContain('value="rmsprop"');
  });

  test('renders string/default input', () => {
    const param = { name: 'prefix', datatype: 'string' };
    const html = renderParameterInput(param, 'test_', 'node-1');

    expect(html).toContain('type="text"');
    expect(html).toContain('value="test_"');
  });

  test('uses default value when value is null', () => {
    const param = { name: 'count', datatype: 'integer', default: 10 };
    const html = renderParameterInput(param, null, 'node-1');

    expect(html).toContain('value="10"');
  });

  test('includes description as title', () => {
    const param = {
      name: 'epochs',
      datatype: 'integer',
      description: 'Number of training epochs'
    };
    const html = renderParameterInput(param, 100, 'node-1');

    expect(html).toContain('title="Number of training epochs"');
  });

  test('handles type fallback when datatype is missing', () => {
    const param = { name: 'value', type: 'number' };
    const html = renderParameterInput(param, 5, 'node-1');

    expect(html).toContain('type="number"');
    expect(html).toContain('step="any"');
  });
});
