var mongoose = require('mongoose');

module.exports = function(schema) {
  var pathsToPopulate = [];
  eachPathRecursive(schema, function(pathname, schemaType) {
    var option;
    if (schemaType.options && schemaType.options.autopopulate) {
      option = schemaType.options.autopopulate;
      pathsToPopulate.push({
        options: defaultOptions(pathname, schemaType.options),
        autopopulate: option
      });
    } else if (schemaType.options &&
        schemaType.options.type &&
        schemaType.options.type[0] &&
        schemaType.options.type[0].autopopulate) {
      option = schemaType.options.type[0].autopopulate;
      pathsToPopulate.push({
        options: defaultOptions(pathname, schemaType.options.type[0]),
        autopopulate: option
      });
    }
  });

  var autopopulateHandler = function() {
    var numPaths = pathsToPopulate.length;
    for (var i = 0; i < numPaths; ++i) {
      processOption.call(this,
        pathsToPopulate[i].autopopulate, pathsToPopulate[i].options);
    }
  };

  schema.
    pre('find', autopopulateHandler).
    pre('findOne', autopopulateHandler);
};

function defaultOptions(pathname, v) {
  var ret = { path: pathname };
  if (v.ref) {
    ret.model = v.ref;
  }
  return ret;
}

function processOption(value, options) {
  switch (typeof value) {
    case 'function':
      handleFunction.call(this, value, options);
      break;
    case 'object':
      handleObject.call(this, value, options);
      break;
    default:
      handlePrimitive.call(this, value, options);
      break;
  }
}

function handlePrimitive(value, options) {
  if (value) {
    this.populate(options);
  }
}

function handleObject(value, optionsToUse) {
  mergeOptions(optionsToUse, value);
  this.populate(optionsToUse);
}

function handleFunction(fn, options) {
  var val = fn.call(this);
  processOption.call(this, val, options);
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
