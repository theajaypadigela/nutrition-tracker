import { toDebugJson } from '../debug';

describe('toDebugJson', () => {
  it('pretty-prints values as indented JSON', () => {
    expect(toDebugJson({ a: 1, b: 'x' })).toBe('{\n  "a": 1,\n  "b": "x"\n}');
  });

  it('falls back to String() on circular structures', () => {
    const circular: any = {};
    circular.self = circular;
    expect(toDebugJson(circular)).toBe('[object Object]');
  });
});
