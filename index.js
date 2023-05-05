'use strict';

module.exports = function autopopulatePlugin(schema, options) {
  const pathsToPopulate = getPathsToPopulate(schema);

  let testFunction = () => true;
  if (options != null && (Array.isArray(options.functions) || options.functions instanceof RegExp)) {
    let _functions = options.functions;
    if (Array.isArray(_functions)) {
      _functions = new Set(_functions);

      testFunction = v => _functions.has(v);
    } else {
      testFunction = v => _functions.test(v);
    }
  }

  const autopopulateHandler = function(filter) {
    const finalPaths = [];

    if (this._mongooseOptions &&
        this._mongooseOptions.lean &&
        // If lean and user didn't explicitly do `lean({ autopopulate: true })`,
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

      const newOptions = { _depth: depth + 1 };
      if (options.maxDepth) newOptions.maxDepth = options.maxDepth;
      Object.assign(pathsToPopulate[i].options.options, newOptions);

      const optionsToUse = processOption.call(this,
        pathsToPopulate[i].autopopulate, pathsToPopulate[i].options);
      if (optionsToUse) {
        // If `this` is a query, population chaining is allowed.
        // If not, add it to an array for single population at the end.
        if (this.constructor.name === 'Query') {
          this.populate(optionsToUse);
        } else {
          finalPaths.push(optionsToUse);
        }
      }
    }

    return finalPaths;
  };

  if (testFunction('find')) {
    schema.pre('find', function() { return autopopulateHandler.call(this); });
    schema.post('find', function(res) { return autopopulateDiscriminators.call(this, res); });
  }
  if (testFunction('findOne')) {
    schema.pre('findOne', function() { return autopopulateHandler.call(this); });
    schema.post('findOne', function(res) { return autopopulateDiscriminators.call(this, res); });
  }
  if (testFunction('findOneAndUpdate')) {
    schema.pre('findOneAndUpdate', function() { return autopopulateHandler.call(this); });
    schema.post('findOneAndUpdate', function(res) { return autopopulateDiscriminators.call(this, res); });
  }
  if (testFunction('findOneAndDelete')) {
    schema.pre('findOneAndDelete', function() { return autopopulateHandler.call(this); });
    schema.post('findOneAndDelete', function(res) { return autopopulateDiscriminators.call(this, res); });
  }
  if (testFunction('findOneAndReplace')) {
    schema.pre('findOneAndReplace', function() { return autopopulateHandler.call(this); });
    schema.post('findOneAndReplace', function(res) { return autopopulateDiscriminators.call(this, res); });
  }
  if (testFunction('save')) {
    schema.post('save', function() {
      if (pathsToPopulate.length === 0) {
        return Promise.resolve();
      }
      // Skip for subdocs, because we assume this function only runs on
      // top-level documents.
      if (typeof this.ownerDocument === 'function' && this.$isSubdocument) {
        return Promise.resolve();
      }
      const finalPaths = autopopulateHandler.call(this, options => {
        const pop = this.populated(options.path);
        if (Array.isArray(pop)) {
          const docVal = this.get(options.path);
          return docVal == null ||
            pop.length !== docVal.length ||
            pop.some(v => v == null);
        }
        return true;
      });
      return this.populate(finalPaths);
    });
  }
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
  const schemaStack = new WeakMap();
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
  }, null, schemaStack);

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

function eachPathRecursive(schema, handler, path, schemaStack) {

  if (schemaStack.has(schema)) {
    return;
  }
  if (!path) {
    path = [];
  }
  schemaStack.set(schema, true);

  schema.eachPath(function(pathname, schemaType) {
    path.push(pathname);
    if (schemaType.schema) {
      eachPathRecursive(schemaType.schema, handler, path, schemaStack);

      if (schemaType.schema.discriminators != null) {
        for (const discriminatorName of Object.keys(schemaType.schema.discriminators)) {
          eachPathRecursive(
            schemaType.schema.discriminators[discriminatorName],
            handler,
            path,
            schemaStack
          );
        }
      }
    } else if (schemaType.$isMongooseArray && schemaType.$embeddedSchemaType.$isMongooseArray) {
      while (schemaType != null && schemaType.$isMongooseArray && !schemaType.$isMongooseDocumentArray) {
        schemaType = schemaType.$embeddedSchemaType;
      }
      if (schemaType != null && schemaType.$isMongooseDocumentArray) {
        eachPathRecursive(schemaType.schema, handler, path, schemaStack);

        if (schemaType.schema.discriminators != null) {
          for (const discriminatorName of Object.keys(schemaType.schema.discriminators)) {
            eachPathRecursive(
              schemaType.schema.discriminators[discriminatorName],
              handler,
              path,
              schemaStack
            );
          }
        }
      }
    } else {
      handler(path.join('.'), schemaType);
    }
    path.pop();
  });
  schemaStack.delete(schema);
  if (schema.virtuals) {
    Object.keys(schema.virtuals).forEach(function(pathname) {
      path.push(pathname);
      handler(path.join('.'), schema.virtuals[pathname]);
      path.pop();
    });
  }
}
