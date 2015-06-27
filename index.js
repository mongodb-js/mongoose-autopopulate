var mongoose = require('mongoose');

module.exports = function(schema) {
  var pathsToPopulate = [];
  eachPathRecursive(schema, function(pathname, schemaType) {
    if (schemaType.options && schemaType.options.autopopulate) {
      var option = schemaType.options.autopopulate;
      pathsToPopulate.push({ path: pathname, autopopulate: option });
    }
  });

  var autopopulateHandler = function() {
    var numPaths = pathsToPopulate.length;
    for (var i = 0; i < numPaths; ++i) {
      processOption.call(this,
        pathsToPopulate[i].autopopulate, pathsToPopulate[i].path);
    }
  };

  schema.
    pre('find', autopopulateHandler).
    pre('findOne', autopopulateHandler);
};

function processOption(value, path) {
  switch (typeof value) {
    case 'function':
      handleFunction.call(this, value, path);
      break;
    case 'object':
      handleObject.call(this, value, path);
      break;
    default:
      handlePrimitive.call(this, value, path);
      break;
  }
}

function handlePrimitive(value, path) {
  if (value) {
    this.populate(path);
  }
}

function handleObject(value, path) {
  var optionsToUse = { path: path };
  mergeOptions(optionsToUse, value);
  this.populate(optionsToUse);
}

function handleFunction(fn, path) {
  var val = fn.call(this);
  processOption.call(this, val, path);
}

function mergeOptions(destination, source) {
  var keys = Object.keys(source);
  var numKeys = keys.length;
  for (var i = 0; i < numKeys; ++i) {
    destination[keys[i]] = source[keys[i]];
  }
}

function eachPathRecursive(schema, handler, path) {
  if (!path) {
    path = [];
  }
  schema.eachPath(function(pathname, schemaType) {
    path.push(pathname);
    if (schemaType.schema) {
      eachPathRecursive(schemaType.schema, handler, path);
    } else {
      handler(path.join('.'), schemaType);
    }
    path.pop();
  });
}
