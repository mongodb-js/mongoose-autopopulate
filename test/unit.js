var plugin = require('../');
var assert = require('assert');
var _ = require('underscore');

describe('mongoose-autopopulate:unit', function() {
  var schemaStub;
  var queryStub;
  var paths = [];

  beforeEach(function() {
    queryStub = {};
    queryStub.populate = function(obj) {
      queryStub.populate.calls.push(obj);
    };
    queryStub.populate.calls = [];
  });

  it('populates when paths autopopulate option is true', function() {
    paths = [{ name: 'test', options: { options: { autopopulate: true } } }];
    schemaStub = createSchemaStub(paths);
    var p = plugin(schemaStub);
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(1, queryStub.populate.calls.length);
    assert.equal('test', queryStub.populate.calls[0].path);
  });

  it('ignores when paths autopopulate option is falsy', function() {
    paths = [
      { name: 'test', options: { options: { autopopulate: true } } },
      { name: 'test2', options: { options: { autopopulate: false } } },
      { name: 'test3', options: { options: { autopopulate: null } } }
    ];
    schemaStub = createSchemaStub(paths);
    var p = plugin(schemaStub);
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(1, queryStub.populate.calls.length);
    assert.equal('test', queryStub.populate.calls[0].path);
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
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(1, queryStub.populate.calls.length);
    assert.deepEqual({ path: 'test', select: 'name' }, queryStub.populate.calls[0]);
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
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(1, queryStub.populate.calls.length);
    assert.deepEqual('test', queryStub.populate.calls[0].path);
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
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(1, queryStub.populate.calls.length);
    assert.deepEqual({ path: 'test', select: 'name' }, queryStub.populate.calls[0]);
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
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(0, queryStub.populate.calls.length);
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
    assert.equal(schema.pre.calls.length, 2);
    assert.equal(queryStub.populate.calls.length, 0);

    schema.pre.calls[0].handler.call(queryStub);
    assert.deepEqual(queryStub.populate.calls[0].path,
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
  schemaStub.eachPath = function(handler) {
    _.each(paths, function(path) {
      handler(path.name, path.options);
    });
  };

  return schemaStub;
}
