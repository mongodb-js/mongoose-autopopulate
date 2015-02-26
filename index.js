var mongoose = require('mongoose');

module.exports = function(schema) {
  var pathsToPopulate = [];
  schema.eachPath(function (pathname, schemaType) {
    if (schemaType.options && schemaType.options.autopopulate) {
      var option = schemaType.options.autopopulate;
      pathsToPopulate.push({ path: pathname, autopopulate: option });
    }
  });

  var autopopulateHandler = function() {
    var numPaths = pathsToPopulate.length;
    var optionsToUse;
    for (var i = 0; i < numPaths; ++i) {
      if (typeof pathsToPopulate[i].autopopulate !== 'function' &&
          typeof pathsToPopulate[i].autopopulate !== 'object') {
        this.populate(pathsToPopulate[i].path);
        continue;
      }

      if (typeof pathsToPopulate[i].autopopulate === 'object') {
        optionsToUse = { path: pathsToPopulate[i].path };
        mergeOptions(optionsToUse, pathsToPopulate[i].autopopulate);
        this.populate(optionsToUse);
        continue;
      }

      var populateOptions = pathsToPopulate[i].autopopulate.call(this);
      if (!populateOptions) {
        continue;        
      }
      if (typeof populateOptions !== 'object') {
        this.populate(pathsToPopulate[i].path);
        continue;
      }

      optionsToUse = { path: pathsToPopulate[i].path };
      mergeOptions(optionsToUse, populateOptions);

      this.populate(optionsToUse);
    }
  };

  schema.
    pre('find', autopopulateHandler).
    pre('findOne', autopopulateHandler);
};

function mergeOptions(destination, source) {
  var keys = Object.keys(source);
  var numKeys = keys.length;
  for (var i = 0; i < numKeys; ++i) {
    destination[keys[i]] = source[keys[i]];
  }
}
