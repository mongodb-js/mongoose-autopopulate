test-integration:
	./node_modules/mocha/bin/mocha ./test/integration.js

test-unit:
	./node_modules/mocha/bin/mocha ./test/unit.js

test-all:
	./node_modules/mocha/bin/mocha ./test/*.js

docs:
	node docs.js
