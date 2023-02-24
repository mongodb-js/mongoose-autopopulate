# mongoose-autopopulate

Always `populate()` certain fields in your mongoose schemas

[![Build Status](https://travis-ci.org/mongodb-js/mongoose-autopopulate.svg?branch=master)](https://travis-ci.org/mongodb-js/mongoose-autopopulate)
[![Coverage Status](https://coveralls.io/repos/mongodb-js/mongoose-autopopulate/badge.svg?branch=master)](https://coveralls.io/r/mongodb-js/mongoose-autopopulate?branch=master)

[Read the docs here](http://plugins.mongoosejs.io/plugins/autopopulate).

**Note:** population is a powerful feature, but it has limitations and
helps you get away with poor schema design.  In particular, it is usually
bad MongoDB schema design to include arrays that grow without bound in
your documents. Do not include a constantly-growing array of ObjectIds
in your schema - your data will become unwieldy as the array grows and
you will eventually hit the [16 MB document size limit](http://docs.mongodb.org/manual/reference/limits/#BSON-Document-Size).
In general, think carefully when designing your schemas.

# Usage

The `mongoose-autopopulate` module exposes a single function that you can
pass to [Mongoose schema's `plugin()` function](https://mongoosejs.com/docs/api.html#schema_Schema-plugin).

```javascript
const schema = new mongoose.Schema({
  populatedField: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForeignModel',
    // The below option tells this plugin to always call `populate()` on
    // `populatedField`
    autopopulate: true
  }
});
schema.plugin(require('mongoose-autopopulate'));
```

Only apply this plugin to top-level schemas. Don't apply this plugin to child schemas.

```javascript
// Don't do `nestedSchema.plugin(require('mongoose-autopopulate'))`.
// You only need to add mongoose-autopopulate to top-level schemas.
const nestedSchema = mongoose.Schema({
  child: { type: Number, ref: 'Child', autopopulate: true }
});
const topSchema = mongoose.Schema({ nested: nestedSchema });
topSchema.plugin(require('mongoose-autopopulate'));
```
