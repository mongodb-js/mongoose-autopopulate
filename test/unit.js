var plugin = require('../');
var assert = require('assert');
var _ = require('underscore');

describe('mongoose-autopopulate:unit', function() {
  var schemaStub;
  var queryStub;
  var paths = [];

  beforeEach(function() {
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

    queryStub = {};
    queryStub.populate = function(obj) {
      queryStub.populate.calls.push(obj);
    };
    queryStub.populate.calls = [];
  });

  it('populates when paths autopopulate option is true', function() {
    paths = [{ name: 'test', options: { options: { autopopulate: true } } }];
    var p = plugin(schemaStub);
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(1, queryStub.populate.calls.length);
    assert.equal('test', queryStub.populate.calls[0]);
  });

  it('ignores when paths autopopulate option is falsy', function() {
    paths = [
      { name: 'test', options: { options: { autopopulate: true } } },
      { name: 'test2', options: { options: { autopopulate: false } } },
      { name: 'test3', options: { options: { autopopulate: null } } }
    ];
    var p = plugin(schemaStub);
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(1, queryStub.populate.calls.length);
    assert.equal('test', queryStub.populate.calls[0]);
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
    var p = plugin(schemaStub);
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(1, queryStub.populate.calls.length);
    assert.deepEqual('test', queryStub.populate.calls[0]);
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
    var p = plugin(schemaStub);
    assert.equal(2, schemaStub.pre.calls.length);
    assert.equal(0, queryStub.populate.calls.length);

    schemaStub.pre.calls[0].handler.call(queryStub);
    assert.equal(0, queryStub.populate.calls.length);
  });
});
