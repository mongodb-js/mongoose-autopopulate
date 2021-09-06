var plugin = require('../');
var assert = require('assert');

describe('mongoose-autopopulate:unit', function() {
  var schemaStub;
  var queryStub;
  var paths = [];

  it('populates when paths autopopulate option is true', function() {
    paths = [{ name: 'test', options: { options: { autopopulate: true } } }];
    schemaStub = createSchemaStub(paths);
    var p = plugin(schemaStub);
    assert.equal(schemaStub.pre.calls.length, 3);

    const pathsToPopulate = schemaStub.pre.calls[0].handler.call({});
    assert.equal(pathsToPopulate.length, 1);
    assert.equal(pathsToPopulate[0].path, 'test');
  });

  it('ignores when paths autopopulate option is falsy', function() {
    paths = [
      { name: 'test', options: { options: { autopopulate: true } } },
      { name: 'test2', options: { options: { autopopulate: false } } },
      { name: 'test3', options: { options: { autopopulate: null } } }
    ];
    schemaStub = createSchemaStub(paths);
    var p = plugin(schemaStub);
    assert.equal(schemaStub.pre.calls.length, 3);

    const pathsToPopulate = schemaStub.pre.calls[0].handler.call({});
    assert.equal(pathsToPopulate.length, 1);
    assert.equal(pathsToPopulate[0].path, 'test');
  });

  it('merges options when autopopulate option is object', function() {
    paths = [
      {
        name: 'test',
        options: {
          options: {
            autopopulate: { select: 'name' }
          }
        }
      },
    ];
    schemaStub = createSchemaStub(paths);

    var p = plugin(schemaStub);
    assert.equal(schemaStub.pre.calls.length, 3);

    const pathsToPopulate = schemaStub.pre.calls[0].handler.call({});
    assert.equal(pathsToPopulate.length, 1);
    assert.deepEqual(pathsToPopulate[0],
      { path: 'test', select: 'name', options: { _depth: 1, maxDepth: 10 } });
  });

  it('can execute function options', function() {
    paths = [
      {
        name: 'test',
        options: {
          options: {
            autopopulate: function() {
              return true;
            }
          }
        }
      },
    ];
    schemaStub = createSchemaStub(paths);
    var p = plugin(schemaStub);
    assert.equal(schemaStub.pre.calls.length, 3);

    const pathsToPopulate = schemaStub.pre.calls[0].handler.call({});
    assert.equal(pathsToPopulate.length, 1);
    assert.deepEqual(pathsToPopulate[0].path, 'test');
  });

  it('augments populate options when autopopulate returns object', function() {
    paths = [
      {
        name: 'test',
        options: {
          options: {
            autopopulate: function() {
              return { select: 'name' };
            }
          }
        }
      },
    ];
    schemaStub = createSchemaStub(paths);

    var p = plugin(schemaStub);
    assert.equal(schemaStub.pre.calls.length, 3);

    const pathsToPopulate = schemaStub.pre.calls[0].handler.call({});
    assert.equal(pathsToPopulate.length, 1);
    assert.deepEqual(pathsToPopulate[0],
      { path: 'test', select: 'name', options: { maxDepth: 10, _depth: 1 } });
  });

  it('doesnt populate when autopopulate function returns falsy', function() {
    paths = [
      {
        name: 'test',
        options: {
          options: {
            autopopulate: function() {
              return false;
            }
          }
        }
      },
    ];
    schemaStub = createSchemaStub(paths);
    var p = plugin(schemaStub);
    assert.equal(schemaStub.pre.calls.length, 3);

    const pathsToPopulate = schemaStub.pre.calls[0].handler.call({});
    assert.equal(pathsToPopulate.length, 0);
  });

  it('handles nested schemas', function() {
    var nestedPath = {
      name: 'test',
      options: {
        options: {
          autopopulate: true
        }
      }
    };

    var topLevel = {
      name: 'nested',
      options: {
        schema: createSchemaStub([nestedPath])
      }
    };

    var schema = createSchemaStub([topLevel]);

    var p = plugin(schema);
    assert.equal(schema.pre.calls.length, 3);

    const pathsToPopulate = schema.pre.calls[0].handler.call({});
    assert.deepEqual(pathsToPopulate[0].path,
      'nested.test');
  });
});

function createSchemaStub(paths) {
  schemaStub = {};
  schemaStub.pre = function(func, handler) {
    schemaStub.pre.calls.push({ func: func, handler: handler });
    return schemaStub;
  };
  schemaStub.pre.calls = [];
  schemaStub.post = function(func, handler) {
    schemaStub.post.calls.push({ func: func, handler: handler });
    return schemaStub;
  };
  schemaStub.post.calls = [];
  schemaStub.eachPath = function(handler) {
    paths.forEach(function(path) {
      handler(path.name, path.options);
    });
  };

  return schemaStub;
}
