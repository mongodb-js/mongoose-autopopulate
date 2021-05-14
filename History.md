0.14.0 / 2021-05-14
===================
 * feat: add `functions` option to list out functions to register hooks on

0.13.0 / 2021-04-15
===================
 * fix: autopopulate nested array fields containing embedded discriminator #82
 * feat: autopopulate embedded discriminators #82

0.12.2 / 2020-04-19
===================
 * fix: avoid error in post('save') handler when this plugin is registered on a child schema #10
 * docs: explain that this plugin should only be registered on top-level schemas

0.12.1 / 2020-03-29
===================
 * fix: handle autopopulate within nested document array when top-level array is empty #70

0.12.0 / 2020-02-05
===================
 * feat: autopopulate discriminators post `find()`, `findOne()`, and `findOneAndUpdate()` #26

0.11.0 / 2020-01-24
===================
 * feat: allow override of maxDepth param via query options #62 [jmikrut](https://github.com/jmikrut)

0.10.0 / 2019-12-20
===================
 * feat: autopopulate paths after `save()` if they aren't already populated #8

0.9.1 / 2019-01-02
==================
 * docs: add note about selectPopulatedPaths option #50

0.9.0 / 2018-11-08
==================
 * feat: support turning on autopopulate with lean #48 #27 #14

0.8.2 / 2018-10-10
==================
 * docs: link to new plugins site on plugins.mongoosejs.io

0.8.1 / 2018-09-02
==================
 * fix: call function with options and include refPath in options #15

0.8.0 / 2018-07-01
==================
 * fix: add support for findOneAndUpdate() with autopopulate #42

0.7.0 / 2018-05-10
==================
 * BREAKING CHANGE: drop support for Node.js < 4.0.0
 * feat: add `maxDepth` option, set to 10 by default #37 #20 #11

0.5.0 / 2016-11-29
==================
 * feat: support lean #27 #14 [siboulet](https://github.com/siboulet)
 * feat: support virtual autopopulate #24 [siboulet](https://github.com/siboulet)

0.4.0 / 2015-09-03
==================
 * added; support for arrays #9 [rerthal](https://github.com/rerthal)

0.3.0 / 2015-07-30
==================
 * added; support of autopopulate in nested schemas #5 [eloytoro](https://github.com/eloytoro)
 * fixed; changed mongoose peer dependency to 4.x #4

0.2.0 / 2015-06-27
==================
 * added; support for nested schemas #3 [siboulet](https://github.com/siboulet)
