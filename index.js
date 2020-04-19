'use strict';

module.exports = function(schema) {
  const pathsToPopulate = getPathsToPopulate(schema);

  const autopopulateHandler = function(filter) {
    if (this._mongooseOptions &&
        this._mongooseOptions.lean &&
        // If lean and user didn't explicitly do `lean({ autopulate: true })`,
        // skip it. See gh-27, gh-14, gh-48
        !this._mongooseOptions.lean.autopopulate) {
      return;
    }

    const options = this.options || {};
    if (options.autopopulate === false) {
      return;
    }

    if (options.autopopulate && options.autopopulate.maxDepth) {
    	options.maxDepth = options.autopopulate.maxDepth;
    }

    const depth = options._depth != null ? options._depth : 0;

    if (options.maxDepth > 0 && depth >= options.maxDepth) {
      return;
    }

    const numPaths = pathsToPopulate.length;
    for (let i = 0; i < numPaths; ++i) {
      pathsToPopulate[i].options = pathsToPopulate[i].options || {};
      if (typeof filter === 'function' && !filter(pathsToPopulate[i].options)) {
        continue;
      }
      pathsToPopulate[i].options.options = pathsToPopulate[i].options.options || {};

      const newOptions = { _depth: depth + 1 }
      if (options.maxDepth) newOptions.maxDepth = options.maxDepth;
      Object.assign(pathsToPopulate[i].options.options, newOptions);

      const optionsToUse = processOption.call(this,
        pathsToPopulate[i].autopopulate, pathsToPopulate[i].options);
      if (optionsToUse) {
        this.populate(optionsToUse);
      }
    }
  };

  schema.
    pre('find', function() { return autopopulateHandler.call(this); }).
    pre('findOne', function() { return autopopulateHandler.call(this); }).
    pre('findOneAndUpdate', function() { return autopopulateHandler.call(this); }).
    post('find', function(res) { return autopopulateDiscriminators.call(this, res) }).
    post('findOne', function(res) { return autopopulateDiscriminators.call(this, res) }).
    post('findOneAndUpdate', function(res) { return autopopulateDiscriminators.call(this, res) }).
    post('save', function() {
      if (pathsToPopulate.length === 0) {
        return Promise.resolve();
      }
      // Skip for subdocs, because we assume this function only runs on
      // top-level documents.
      if (typeof this.ownerDocument === 'function') {
        return Promise.resolve();
      }
      autopopulateHandler.call(this, options => {
        const pop = this.populated(options.path);
        if (Array.isArray(pop)) {
          const docVal = this.get(options.path);
          return docVal == null || pop.length !== docVal.length;
        }
        return true;
      });

      return this.execPopulate();
    });
};

function autopopulateDiscriminators(res) {
  if (res == null) {
    return;
  }
  if (this._mongooseOptions != null && this._mongooseOptions.lean) {
    // If lean, we don't have a good way to figure out the discriminator
    // schema, and so skip autopopulating.
    return;
  }
  if (!Array.isArray(res)) {
    res = [res];
  }

  const discriminators = new Map();
  for (const doc of res) {
    if (doc.constructor.baseModelName != null) {
      const discriminatorModel = doc.constructor;
      const modelName = discriminatorModel.modelName;

      if (!discriminators.has(modelName)) {
        const pathsToPopulate = getPathsToPopulate(discriminatorModel.schema).
          filter(p => !doc.populated(p.options.path));

        discriminators.set(modelName, {
          model: discriminatorModel,
          docs: [],
          pathsToPopulate: pathsToPopulate
        });
      }
      const modelMap = discriminators.get(modelName);
      modelMap.docs.push(doc);
    }
  }

  return Promise.all(Array.from(discriminators.values()).map(modelMap => {
    const pathsToPopulate = modelMap.pathsToPopulate.
      map(p => processOption.call(this, p.autopopulate, p.options)).
      filter(v => !!v);
    return modelMap.model.populate(modelMap.docs, pathsToPopulate);
  }));
}

function getPathsToPopulate(schema) {
  const pathsToPopulate = [];

  eachPathRecursive(schema, function(pathname, schemaType) {
    let option;
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

  if (schema.virtuals) {
    Object.keys(schema.virtuals).forEach(function(pathname) {
      if (schema.virtuals[pathname].options.autopopulate) {
        pathsToPopulate.push({
          options: defaultOptions(pathname, schema.virtuals[pathname].options),
          autopopulate: schema.virtuals[pathname].options.autopopulate,
        });
      }
    });
  }

  return pathsToPopulate;
}

function defaultOptions(pathname, v) {
  const ret = { path: pathname, options: { maxDepth: 10 } };
  if (v.ref != null) {
    ret.model = v.ref;
    ret.ref = v.ref;
  }
  if (v.refPath != null) {
    ret.refPath = v.refPath;
  }
  return ret;
}

function processOption(value, options) {
  switch (typeof value) {
    case 'function':
      return handleFunction.call(this, value, options);
    case 'object':
      return handleObject.call(this, value, options);
    default:
      return handlePrimitive.call(this, value, options);
  }
}

function handlePrimitive(value, options) {
  if (value) {
    return options;
  }
}

function handleObject(value, optionsToUse) {
  // Special case: support top-level `maxDepth`
  if (value.maxDepth != null) {
    optionsToUse.options = optionsToUse.options || {};
    optionsToUse.options.maxDepth = value.maxDepth;
    delete value.maxDepth;
  }
  optionsToUse = Object.assign({}, optionsToUse, value);

  return optionsToUse;
}

function handleFunction(fn, options) {
  const val = fn.call(this, options);
  return processOption.call(this, val, options);
}

function mergeOptions(destination, source) {
  const keys = Object.keys(source);
  const numKeys = keys.length;
  for (let i = 0; i < numKeys; ++i) {
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
