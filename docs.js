var acquit = require('acquit');

var content = require('fs').readFileSync('./test/integration.js').toString();
var header = require('fs').readFileSync('./header.md').toString();
var blocks = acquit.parse(content);

var mdOutput = header;
 
for (var i = 0; i < blocks.length; ++i) {
  var describe = blocks[i];

  for (var j = 0; j < describe.blocks.length; ++j) {
    var it = describe.blocks[j];
    mdOutput += '#### It ' + it.contents + '\n\n';
    mdOutput += it.comments[0] ?
      acquit.trimEachLine(it.comments[0]) + '\n\n' :
      '';
    mdOutput += '```javascript\n';
    mdOutput += '    ' + it.code + '\n';
    mdOutput += '```\n\n';
  }
}

require('fs').writeFileSync('README.md', mdOutput);
