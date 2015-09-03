# mongoose-autopopulate

Always `populate()` certain fields in your mongoose schemas

[![Build Status](https://travis-ci.org/mongodb-js/mongoose-autopopulate.svg?branch=master)](https://travis-ci.org/mongodb-js/mongoose-autopopulate)
[![Coverage Status](https://coveralls.io/repos/mongodb-js/mongoose-autopopulate/badge.svg?branch=master)](https://coveralls.io/r/mongodb-js/mongoose-autopopulate?branch=master)

**Note:** This plugin will *only* work with mongoose >= 4.0. Do NOT use
this plugin with mongoose 3.x. You have been warned.

**Note:** population is a powerful feature, but it has limitations and
helps you get away with poor schema design.  In particular, it is usually
bad MongoDB schema design to include arrays that grow without bound in
your documents. Do not include a constantly-growing array of ObjectIds
in your schema - your data will become unwieldy as the array grows and
you will eventually hit the [16mb document size limit](http://docs.mongodb.org/manual/reference/limits/#BSON-Document-Size).
In general, think carefully when designing your schemas.

# API

The `mongoose-autopopulate` module exposes a single function that you can
pass to the `mongoose.Schema.prototype.plugin()` function. Below you will
see how to use this function.

Suppose you have two collections, "people" and "bands". The `People` model
looks like this:

```javascript
var personSchema = new Schema({ name: String, birthName: String });
Person = mongoose.model('people', personSchema, 'people');
```

Suppose your "people" collection has one document:

```javascript
{
  name: 'Axl Rose',
  birthName: 'William Bruce Rose, Jr.',
  _id: '54ef3f374849dcaa649a3abc'
};
```

And your "bands" collection has one document:

```javascript
{
  _id: '54ef3f374849dcaa649a3abd',
  name: "Guns N' Roses",
  lead: '54ef3f374849dcaa649a3abc',
  members: ['54ef3f374849dcaa649a3abc']
}
```
